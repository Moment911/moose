import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'
import { validateIntake, type IntakeInput } from '../../../../lib/trainer/intakeSchema'
import { callSonnet } from '../../../../lib/trainer/sonnetRunner'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import {
  buildBaselinePrompt,
  baselineTool,
  type BaselineOutput,
} from '../../../../lib/trainer/prompts/baseline'
import {
  buildRoadmapPrompt,
  roadmapTool,
  type RoadmapOutput,
} from '../../../../lib/trainer/prompts/roadmap'
import {
  buildWorkoutPrompt,
  workoutTool,
  type WorkoutOutput,
} from '../../../../lib/trainer/prompts/workout'
import {
  buildPlaybookPrompt,
  playbookTool,
  type CoachingPlaybookOutput,
} from '../../../../lib/trainer/prompts/playbook'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 4 — POST /api/trainer/self-signup
//
// Trainee-initiated signup flow (no trainer intermediary):
//   1. Trainee signs up via Supabase auth on the client (/start page)
//   2. Trainee fills IntakeForm on /my-intake and POSTs here with their JWT
//   3. We provision a koto_fitness_trainees row + koto_fitness_trainee_users
//      mapping, attached to the platform's default self-signup agency
//      (Olympic Heights Training).
//   4. We synchronously generate the core plan: baseline → roadmap → workout
//      (phase 1) → playbook.  Meals generation is deferred until the trainee
//      answers food-prefs on /my-plan (it needs that extra input).
//   5. Return { trainee_id, plan_id } — client redirects to /my-plan.
//
// Blocking: ~60-90s total.  maxDuration=300 gives headroom.  Client shows a
// "crafting your plan" screen with step-by-step progress text.
//
// Auth: Bearer JWT in Authorization header.  No trainer/admin session; we
// resolve user_id via supabase.auth.getUser(token).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 300

// Fallback to Olympic Heights Training's agency_id if env var isn't set.
// The env var should be preferred — hardcoding is only for safety in case
// the var is missing in a preview environment.
const DEFAULT_AGENCY_FALLBACK = '70ab75b3-1cee-4130-bfd5-bd2687c701ad'

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

async function resolveUser(
  req: NextRequest,
  sb: SupabaseClient,
): Promise<{ ok: true; userId: string; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, userId: data.user.id, email: (data.user.email || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  const agencyId = process.env.DEFAULT_SELF_SIGNUP_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  // Feature flag on the target agency — 404 if disabled (link-enumeration rule).
  try {
    await assertFitnessCoachEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  const auth = await resolveUser(req, sb)
  if (!auth.ok) return err(auth.status, auth.error)
  const { userId, email } = auth

  // Parse + validate intake.
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }
  const intake = (body.intake ?? body) as Record<string, unknown>
  const valid = validateIntake(intake)
  if (!valid.ok) return err(400, 'Validation failed', { field_errors: valid.errors })

  // ── 1. Create (or re-use) the trainee row ────────────────────────────────
  // If the user is already linked to a trainee, reject — client should route
  // them to /my-plan instead.
  const { data: existingMapping } = await sb
    .from('koto_fitness_trainee_users')
    .select('trainee_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existingMapping) {
    return err(409, 'already_signed_up', { trainee_id: (existingMapping as { trainee_id: string }).trainee_id })
  }

  const traineePayload = {
    agency_id: agencyId,
    ...valid.data,
    email: (valid.data as IntakeInput).email || email,
    status: 'intake_complete',
  }
  const { data: traineeRow, error: insErr } = await sb
    .from('koto_fitness_trainees')
    .insert(traineePayload)
    .select('*')
    .single()
  if (insErr || !traineeRow) {
    console.error('[trainer/self-signup] trainee insert error:', insErr?.message)
    return err(500, 'Could not provision trainee')
  }
  const trainee = traineeRow as IntakeInput & { id: string; agency_id: string }

  // ── 2. Create the user↔trainee mapping so /my-plan can resolve from JWT ──
  const { error: mapErr } = await sb
    .from('koto_fitness_trainee_users')
    .insert({
      agency_id: agencyId,
      trainee_id: trainee.id,
      user_id: userId,
      invite_email: email,
      invite_status: 'active',
    })
  if (mapErr) {
    console.error('[trainer/self-signup] mapping insert error:', mapErr.message)
    return err(500, 'Could not link user to trainee')
  }

  // ── 3. Generate the core plan chain synchronously ────────────────────────
  // Baseline → roadmap → workout (phase 1) → playbook.  Meals defer to the
  // food-prefs flow on /my-plan.  If any step fails mid-chain, we return a
  // 207-style partial response so the client can render what's done so far
  // and prompt a retry for the missing pieces.
  const progress: { baseline?: BaselineOutput; roadmap?: RoadmapOutput; workout?: WorkoutOutput; playbook?: CoachingPlaybookOutput } = {}
  const errors: string[] = []

  // Baseline
  try {
    const { systemPrompt, userMessage } = buildBaselinePrompt({ intake: trainee })
    const r = await callSonnet<BaselineOutput>({
      featureTag: FEATURE_TAGS.BASELINE,
      systemPrompt,
      tool: baselineTool,
      userMessage,
      agencyId,
      metadata: { trainee_id: trainee.id, self_signup: true },
    })
    if (r.ok) progress.baseline = r.data
    else errors.push(`baseline:${r.error}`)
  } catch (e) {
    errors.push(`baseline:${e instanceof Error ? e.message : String(e)}`)
  }

  // Persist after baseline so the trainee sees SOMETHING even if later steps fail.
  const { data: planRow, error: planErr } = await sb
    .from('koto_fitness_plans')
    .insert({
      agency_id: agencyId,
      trainee_id: trainee.id,
      block_number: 1,
      baseline: progress.baseline ?? null,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (planErr || !planRow) {
    console.error('[trainer/self-signup] plan insert error:', planErr?.message)
    return err(500, 'Could not create plan row')
  }
  const planId = (planRow as { id: string }).id

  // Bail out here if baseline says ok_to_train=false — physician clearance.
  const okToTrain = progress.baseline?.training_readiness?.ok_to_train
  if (okToTrain === false) {
    return NextResponse.json({
      trainee_id: trainee.id,
      plan_id: planId,
      ok_to_train: false,
      red_flags: progress.baseline?.training_readiness?.red_flags ?? [],
      errors,
    })
  }

  // Roadmap
  if (progress.baseline) {
    try {
      const { systemPrompt, userMessage } = buildRoadmapPrompt({
        intake: trainee,
        baseline: progress.baseline,
      })
      const r = await callSonnet<RoadmapOutput>({
        featureTag: FEATURE_TAGS.ROADMAP,
        systemPrompt,
        tool: roadmapTool,
        userMessage,
        agencyId,
        metadata: { trainee_id: trainee.id, plan_id: planId, self_signup: true },
      })
      if (r.ok) progress.roadmap = r.data
      else errors.push(`roadmap:${r.error}`)
    } catch (e) {
      errors.push(`roadmap:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Workout (phase 1)
  if (progress.baseline && progress.roadmap) {
    try {
      const { systemPrompt, userMessage } = buildWorkoutPrompt({
        intake: trainee,
        baseline: progress.baseline,
        roadmap: progress.roadmap,
        phase: 1,
      })
      const r = await callSonnet<WorkoutOutput>({
        featureTag: FEATURE_TAGS.WORKOUT,
        systemPrompt,
        tool: workoutTool,
        userMessage,
        agencyId,
        metadata: { trainee_id: trainee.id, plan_id: planId, phase: 1, self_signup: true },
      })
      if (r.ok) progress.workout = r.data
      else errors.push(`workout:${r.error}`)
    } catch (e) {
      errors.push(`workout:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Playbook (reads baseline + roadmap; no workout dependency)
  if (progress.baseline && progress.roadmap) {
    try {
      const { systemPrompt, userMessage } = buildPlaybookPrompt({
        intake: trainee,
        baseline: progress.baseline,
        roadmap: progress.roadmap,
      })
      const r = await callSonnet<CoachingPlaybookOutput>({
        featureTag: FEATURE_TAGS.PLAYBOOK,
        systemPrompt,
        tool: playbookTool,
        userMessage,
        agencyId,
        maxTokens: 16000,
        metadata: { trainee_id: trainee.id, plan_id: planId, self_signup: true },
      })
      if (r.ok) progress.playbook = r.data
      else errors.push(`playbook:${r.error}`)
    } catch (e) {
      errors.push(`playbook:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Persist whatever we got.
  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({
      baseline: progress.baseline ?? null,
      roadmap: progress.roadmap ?? null,
      workout_plan: progress.workout ?? null,
      playbook: progress.playbook ?? null,
      phase_ref: progress.workout ? 1 : null,
    })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/self-signup] plan update error:', updErr.message)
    // Trainee + mapping are live; plan row exists.  Flag but don't fail hard.
    errors.push(`persist:${updErr.message}`)
  }

  // Flip status so the trainer dashboard shows progress too.
  if (progress.workout) {
    await sb
      .from('koto_fitness_trainees')
      .update({ status: 'plan_generated' })
      .eq('id', trainee.id)
      .eq('agency_id', agencyId)
  }

  return NextResponse.json({
    trainee_id: trainee.id,
    plan_id: planId,
    baseline_ready: !!progress.baseline,
    roadmap_ready: !!progress.roadmap,
    workout_ready: !!progress.workout,
    playbook_ready: !!progress.playbook,
    errors,
  })
}
