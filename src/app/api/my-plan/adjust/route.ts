import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'
import { callSonnet } from '../../../../lib/trainer/sonnetRunner'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import { buildAdjustNLPrompt, type AdjustNLScope } from '../../../../lib/trainer/prompts/adjustNL'
import { workoutTool, type WorkoutOutput } from '../../../../lib/trainer/prompts/workout'
import type { BaselineOutput } from '../../../../lib/trainer/prompts/baseline'
import type { RoadmapOutput } from '../../../../lib/trainer/prompts/roadmap'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/my-plan/adjust — trainee-initiated natural-language plan adjustment.
//
// Powers the "What's going on?" box on /my-plan.  Trainee types free text
// (injury, travel, schedule, mood, equipment change) + picks a scope:
//   - this_session       → only modifies the given day
//   - rest_of_block      → rewrites remaining sessions in the 2-week block
//   - swap_exercise      → substitutes one exercise id everywhere it appears
//
// Server loads the trainee's current plan, calls Sonnet with the adjustNL
// prompt, validates the output shape, and updates the plan row in place.
// Returns the updated workout_plan so the client can re-render without a
// full plan refetch.
//
// Auth: trainee JWT → mapping row → trainee_id + agency_id.  Enforces
// ownership — trainee can only adjust their own plan.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 120

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

const ALLOWED_SCOPES: ReadonlySet<AdjustNLScope> = new Set([
  'this_session',
  'rest_of_block',
  'swap_exercise',
])

async function verifyTraineeSession(
  req: NextRequest,
  sb: SupabaseClient,
): Promise<
  | { ok: true; traineeId: string; agencyId: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data: mapping } = await sb
    .from('koto_fitness_trainee_users')
    .select('trainee_id, agency_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!mapping) return { ok: false, status: 404, error: 'Not found' }
  const m = mapping as { trainee_id: string; agency_id: string }
  return { ok: true, traineeId: m.trainee_id, agencyId: m.agency_id }
}

function assertWorkoutShape(wp: unknown): string | null {
  const o = wp as { weeks?: unknown } | null
  const weeks = Array.isArray(o?.weeks) ? (o!.weeks as unknown[]) : []
  if (weeks.length !== 2) return 'weeks must contain exactly 2 entries'
  for (const w of weeks) {
    const sessions = (w as { sessions?: unknown } | null)?.sessions
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return 'each week must contain at least one session'
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const scopeRaw = (typeof body.scope === 'string' ? body.scope : 'rest_of_block') as AdjustNLScope
  const sessionDayNumber = typeof body.session_day_number === 'number' ? body.session_day_number : undefined
  const exerciseId = typeof body.exercise_id === 'string' ? body.exercise_id : undefined

  if (message.length === 0) return err(400, 'message required')
  if (message.length > 1500) return err(400, 'message too long (max 1500 chars)')
  if (!ALLOWED_SCOPES.has(scopeRaw)) return err(400, 'invalid scope')
  if (scopeRaw === 'this_session' && typeof sessionDayNumber !== 'number') {
    return err(400, 'session_day_number required for scope=this_session')
  }
  if (scopeRaw === 'swap_exercise' && (!exerciseId || exerciseId.length === 0)) {
    return err(400, 'exercise_id required for scope=swap_exercise')
  }

  const auth = await verifyTraineeSession(req, sb)
  if (!auth.ok) return err(auth.status, auth.error)
  const { traineeId, agencyId } = auth

  try {
    await assertFitnessCoachEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  // Load trainee + latest plan.
  const { data: traineeRow } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (!traineeRow) return err(404, 'Not found')

  const { data: planRow } = await sb
    .from('koto_fitness_plans')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('trainee_id', traineeId)
    .order('block_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!planRow) return err(404, 'No plan yet')

  const plan = planRow as {
    id: string
    block_number: number | null
    baseline: unknown
    roadmap: unknown
    workout_plan: unknown
    phase_ref: number | null
  }
  if (!plan.baseline) return err(400, 'baseline_missing')
  if (!plan.roadmap) return err(400, 'roadmap_missing')
  if (!plan.workout_plan) return err(400, 'workout_plan_missing')

  const { systemPrompt, userMessage } = buildAdjustNLPrompt({
    intake: traineeRow as Parameters<typeof buildAdjustNLPrompt>[0]['intake'],
    baseline: plan.baseline as BaselineOutput,
    roadmap: plan.roadmap as RoadmapOutput,
    currentPlan: plan.workout_plan as WorkoutOutput,
    message,
    scope: scopeRaw,
    sessionDayNumber,
    exerciseId,
    blockNumber: plan.block_number ?? 1,
    phase: (plan.phase_ref as 1 | 2 | 3) ?? 1,
  })

  const result = await callSonnet<WorkoutOutput>({
    featureTag: FEATURE_TAGS.ADJUST,
    systemPrompt,
    tool: workoutTool,
    userMessage,
    agencyId,
    metadata: {
      trainee_id: traineeId,
      plan_id: plan.id,
      scope: scopeRaw,
      message_length: message.length,
      natural_language: true,
    },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const newPlan = result.data
  const shapeErr = assertWorkoutShape(newPlan)
  if (shapeErr) {
    return err(502, 'sonnet_shape_violation', { detail: shapeErr })
  }

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ workout_plan: newPlan })
    .eq('id', plan.id)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[my-plan/adjust] update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({
    ok: true,
    workout_plan: newPlan,
    adherence_note: (newPlan as WorkoutOutput).adherence_note ?? null,
    adjustments_made: (newPlan as WorkoutOutput).adjustments_made ?? [],
  })
}
