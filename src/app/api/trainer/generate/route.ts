import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySession } from '../../../../lib/apiAuth'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'
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
  buildFoodPrefsPrompt,
  foodPrefsTool,
  type FoodPrefsOutput,
  type FoodPrefsAnswer,
} from '../../../../lib/trainer/prompts/foodPrefs'
import {
  buildMealsPrompt,
  mealsTool,
  type MealsOutput,
} from '../../../../lib/trainer/prompts/meals'
import type { IntakeInput } from '../../../../lib/trainer/intakeSchema'
import {
  buildAdjustPrompt,
  type WorkoutLog,
  type AdherenceSummary,
} from '../../../../lib/trainer/prompts/adjust'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — POST /api/trainer/generate
//
// Seven-action JSON dispatcher that drives the Sonnet prompt chain:
//   generate_baseline / generate_roadmap / generate_workout /
//   elicit_food_prefs / submit_food_prefs / generate_meals / adjust_block
//
// Mirrors the Phase 1 /api/trainer/trainees dispatcher shape exactly:
//   1. verifySession FIRST; agency_id comes from session, never body.
//   2. Feature-flag gate (assertFitnessCoachEnabled) — 404 on disabled
//      (link-enumeration rule, NOT 403).
//   3. Unknown / mistyped action → 400.
//   4. Cross-agency trainee / plan lookups → 404 (NOT 403).
//   5. Sonnet errors bubble up as 502 with the runner's error string.
//
// Reuses Agent A's callSonnet runner + prompt modules.  Every action that
// calls Sonnet follows the same pattern:
//   const { systemPrompt, userMessage } = buildXPrompt({ ... })
//   const result = await callSonnet<XOutput>({ featureTag, systemPrompt,
//                                               tool, userMessage, agencyId,
//                                               metadata: { trainee_id } })
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
// Meals prompt emits up to 16k tokens; leave headroom for the full chain
// when invoked sequentially on slow cold-starts.
export const maxDuration = 300

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const ALLOWED_ACTIONS = [
  'get_current_plan',
  'generate_baseline',
  'generate_roadmap',
  'generate_workout',
  'elicit_food_prefs',
  'submit_food_prefs',
  'generate_meals',
  'adjust_block',
] as const

type Action = (typeof ALLOWED_ACTIONS)[number]

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

// ── Helpers ────────────────────────────────────────────────────────────────

type TraineeRow = IntakeInput & {
  id: string
  agency_id: string
  status?: string | null
}
type PlanRow = Record<string, unknown> & {
  id: string
  agency_id: string
  trainee_id: string
  block_number: number
  baseline?: unknown
  roadmap?: unknown
  workout_plan?: unknown
  food_preferences?: unknown
  meal_plan?: unknown
  grocery_list?: unknown
  adjustment_summary?: unknown
  phase_ref?: number | null
}

async function loadTrainee(
  sb: SupabaseClient,
  agencyId: string,
  traineeId: string,
): Promise<TraineeRow | null> {
  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (error) throw new Error(`trainee_lookup:${error.message}`)
  return (data as TraineeRow | null) ?? null
}

async function loadPlan(
  sb: SupabaseClient,
  agencyId: string,
  planId: string,
  traineeId: string,
): Promise<PlanRow | null> {
  const { data, error } = await sb
    .from('koto_fitness_plans')
    .select('*')
    .eq('id', planId)
    .eq('agency_id', agencyId)
    .eq('trainee_id', traineeId)
    .maybeSingle()
  if (error) throw new Error(`plan_lookup:${error.message}`)
  return (data as PlanRow | null) ?? null
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId) return err(401, 'Unauthorized')
  const agencyId = session.agencyId

  // 2. Body parse
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const action = String(body?.action || '') as Action
  if (!(ALLOWED_ACTIONS as readonly string[]).includes(action)) {
    return err(400, 'Unknown action', { allowed_actions: ALLOWED_ACTIONS })
  }

  const sb = getDb()

  // 3. Feature-flag gate — 404 on disabled (link-enumeration rule)
  try {
    await assertFitnessCoachEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  // 4. Dispatch
  try {
    if (action === 'get_current_plan') return await handleGetCurrentPlan(sb, agencyId, body)
    if (action === 'generate_baseline') return await handleBaseline(sb, agencyId, body)
    if (action === 'generate_roadmap') return await handleRoadmap(sb, agencyId, body)
    if (action === 'generate_workout') return await handleWorkout(sb, agencyId, body)
    if (action === 'elicit_food_prefs') return await handleElicitFoodPrefs(sb, agencyId, body)
    if (action === 'submit_food_prefs') return await handleSubmitFoodPrefs(sb, agencyId, body)
    if (action === 'generate_meals') return await handleMeals(sb, agencyId, body)
    if (action === 'adjust_block') return await handleAdjust(sb, agencyId, body)
    return err(400, 'Unknown action')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[trainer/generate] dispatch error:', msg)
    return err(500, 'Internal error')
  }
}

// ── Action handlers ──────────────────────────────────────────────────────

async function handleGetCurrentPlan(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Confirm trainee exists under this agency (cross-agency → 404)
  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  // Latest plan (highest block_number, then newest created_at) for this trainee
  const { data, error } = await sb
    .from('koto_fitness_plans')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('trainee_id', traineeId)
    .order('block_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[trainer/generate] get_current_plan load error:', error.message)
    return err(500, 'Load failed')
  }
  return NextResponse.json({ plan: data ?? null })
}

async function handleBaseline(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const { systemPrompt, userMessage } = buildBaselinePrompt({ intake: trainee })
  const result = await callSonnet<BaselineOutput>({
    featureTag: FEATURE_TAGS.BASELINE,
    systemPrompt,
    tool: baselineTool,
    userMessage,
    agencyId,
    metadata: { trainee_id: traineeId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }
  const baseline = result.data

  // Insert new plan row with block_number=1
  const { data: inserted, error: insErr } = await sb
    .from('koto_fitness_plans')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      block_number: 1,
      baseline,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    console.error('[trainer/generate] baseline insert error:', insErr?.message)
    return err(500, 'Persist failed')
  }

  // Short-circuit if ok_to_train=false — don't run the rest of the chain.
  const trainingReadiness = (baseline as BaselineOutput | null)?.training_readiness
  const okToTrain = trainingReadiness?.ok_to_train
  const redFlags = trainingReadiness?.red_flags ?? []
  if (okToTrain === false) {
    return NextResponse.json({
      plan_id: (inserted as { id: string }).id,
      baseline,
      ok_to_train: false,
      red_flags: redFlags,
    })
  }

  return NextResponse.json({
    plan_id: (inserted as { id: string }).id,
    baseline,
  })
}

async function handleRoadmap(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (!planId) return err(400, 'plan_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')
  if (!plan.baseline) return err(400, 'baseline_missing')

  const { systemPrompt, userMessage } = buildRoadmapPrompt({
    intake: trainee,
    baseline: plan.baseline as BaselineOutput,
  })
  const result = await callSonnet<RoadmapOutput>({
    featureTag: FEATURE_TAGS.ROADMAP,
    systemPrompt,
    tool: roadmapTool,
    userMessage,
    agencyId,
    metadata: { trainee_id: traineeId, plan_id: planId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ roadmap: result.data })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] roadmap update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ roadmap: result.data })
}

async function handleWorkout(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  const phaseRaw = body.phase
  const phase = typeof phaseRaw === 'number' ? phaseRaw : Number(phaseRaw)
  if (!traineeId) return err(400, 'trainee_id required')
  if (!planId) return err(400, 'plan_id required')
  if (!Number.isInteger(phase) || phase < 1 || phase > 3) {
    return err(400, 'phase must be 1, 2, or 3')
  }

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')
  if (!plan.baseline) return err(400, 'baseline_missing')
  if (!plan.roadmap) return err(400, 'roadmap_missing')

  const { systemPrompt, userMessage } = buildWorkoutPrompt({
    intake: trainee,
    baseline: plan.baseline as BaselineOutput,
    roadmap: plan.roadmap as RoadmapOutput,
    phase: phase as 1 | 2 | 3,
  })
  const result = await callSonnet<WorkoutOutput>({
    featureTag: FEATURE_TAGS.WORKOUT,
    systemPrompt,
    tool: workoutTool,
    userMessage,
    agencyId,
    metadata: { trainee_id: traineeId, plan_id: planId, phase },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ workout_plan: result.data, phase_ref: phase })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] workout update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  // First successful workout generation flips the trainee's status.
  // Best-effort: if this fails we don't roll back the plan.
  await sb
    .from('koto_fitness_trainees')
    .update({ status: 'plan_generated' })
    .eq('id', traineeId)
    .eq('agency_id', agencyId)

  return NextResponse.json({ workout_plan: result.data })
}

async function handleElicitFoodPrefs(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (!planId) return err(400, 'plan_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')
  if (!plan.baseline) return err(400, 'baseline_missing')

  const { systemPrompt, userMessage } = buildFoodPrefsPrompt({
    intake: trainee,
    baseline: plan.baseline as BaselineOutput,
  })
  const result = await callSonnet<FoodPrefsOutput>({
    featureTag: FEATURE_TAGS.FOOD_PREFS,
    systemPrompt,
    tool: foodPrefsTool,
    userMessage,
    agencyId,
    metadata: { trainee_id: traineeId, plan_id: planId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const envelope = {
    questions: (result.data as FoodPrefsOutput).questions,
    answers: null,
  }

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ food_preferences: envelope })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] food-prefs update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ questions: envelope.questions })
}

async function handleSubmitFoodPrefs(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  const answers = body.answers
  if (!traineeId) return err(400, 'trainee_id required')
  if (!planId) return err(400, 'plan_id required')
  if (!Array.isArray(answers)) return err(400, 'answers must be an array')

  // Validate shape: each entry has question_id + answer.
  const valid: FoodPrefsAnswer[] = []
  for (const a of answers) {
    if (!a || typeof a !== 'object') return err(400, 'invalid answer entry')
    const entry = a as { question_id?: unknown; answer?: unknown }
    if (typeof entry.question_id !== 'string' || entry.question_id.length === 0) {
      return err(400, 'answer.question_id required')
    }
    if (typeof entry.answer === 'undefined') {
      return err(400, 'answer.answer required')
    }
    valid.push({ question_id: entry.question_id, answer: entry.answer } as FoodPrefsAnswer)
  }

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')

  const existingEnvelope =
    (plan.food_preferences as { questions?: unknown; answers?: unknown } | null) ?? {}
  const nextEnvelope = {
    questions: (existingEnvelope as { questions?: unknown }).questions ?? null,
    answers: valid,
  }

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ food_preferences: nextEnvelope })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] submit-food-prefs update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ ok: true })
}

async function handleMeals(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (!planId) return err(400, 'plan_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')
  if (!plan.baseline) return err(400, 'baseline_missing')

  const envelope =
    (plan.food_preferences as {
      questions?: unknown
      answers?: FoodPrefsAnswer[] | null
    } | null) ?? null
  const answers = envelope?.answers
  if (!Array.isArray(answers) || answers.length === 0) {
    return err(400, 'answers_not_submitted')
  }
  const questions = (envelope?.questions ?? []) as FoodPrefsOutput['questions']

  const { systemPrompt, userMessage } = buildMealsPrompt({
    intake: trainee,
    baseline: plan.baseline as BaselineOutput,
    foodPreferences: { questions, answers },
  })
  const result = await callSonnet<MealsOutput>({
    featureTag: FEATURE_TAGS.MEALS,
    systemPrompt,
    tool: mealsTool,
    userMessage,
    agencyId,
    // Meals prompt is the largest output — give it the 16k budget.
    maxTokens: 16000,
    metadata: { trainee_id: traineeId, plan_id: planId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  // MealsOutput schema (from prompts/meals.ts) nests the 2-week menu under
  // `weeks` and keeps `grocery_list` as a sibling.  We persist the full
  // meals envelope as meal_plan so the plan row captures plan_name,
  // calorie_daily_target_kcal, macro_daily_targets_g, weeks, and disclaimer
  // together — and split grocery_list into its own jsonb column.
  const meals = result.data as MealsOutput
  const mealsRec = result.data as Record<string, unknown>
  const groceryList = mealsRec.grocery_list ?? null
  // Strip grocery_list from the meal_plan envelope so it isn't double-stored.
  const mealPlanPersisted: Record<string, unknown> = { ...mealsRec }
  delete mealPlanPersisted.grocery_list
  const mealPlan = Object.keys(mealPlanPersisted).length > 0 ? mealPlanPersisted : meals

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ meal_plan: mealPlan, grocery_list: groceryList })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] meals update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ meal_plan: mealPlan, grocery_list: groceryList })
}

async function handleAdjust(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const priorPlanId = typeof body.prior_plan_id === 'string' ? body.prior_plan_id : ''
  const nextPhaseRaw = body.next_phase
  const nextPhase = typeof nextPhaseRaw === 'number' ? nextPhaseRaw : Number(nextPhaseRaw)
  if (!traineeId) return err(400, 'trainee_id required')
  if (!priorPlanId) return err(400, 'prior_plan_id required')
  if (!Number.isInteger(nextPhase) || nextPhase < 1 || nextPhase > 3) {
    return err(400, 'next_phase must be 1, 2, or 3')
  }

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const priorPlan = await loadPlan(sb, agencyId, priorPlanId, traineeId)
  if (!priorPlan) return err(404, 'Not found')
  if (!priorPlan.baseline) return err(400, 'baseline_missing')
  if (!priorPlan.workout_plan) return err(400, 'workout_plan_missing')

  // Load all logs for the prior plan.
  const { data: logRows, error: logErr } = await sb
    .from('koto_fitness_workout_logs')
    .select('*')
    .eq('plan_id', priorPlanId)
    .eq('agency_id', agencyId)
    .order('session_day_number', { ascending: true })
  if (logErr) {
    console.error('[trainer/generate] logs load error:', logErr.message)
    return err(500, 'Logs load failed')
  }
  const logs = (logRows ?? []) as WorkoutLog[]

  // Compute adherence.  scheduled_sessions = count of distinct session_day_numbers
  // declared in the prior plan's workout_plan; logged_sessions = count of
  // distinct session_day_numbers appearing in the logs.
  const adherence = computeAdherenceSummary(priorPlan.workout_plan, logs)

  const { systemPrompt, userMessage } = buildAdjustPrompt({
    intake: trainee,
    baseline: priorPlan.baseline as BaselineOutput,
    roadmap: priorPlan.roadmap as RoadmapOutput,
    priorPlan: priorPlan.workout_plan as WorkoutOutput,
    logs,
    adherence,
    nextPhase: nextPhase as 1 | 2 | 3,
    nextBlockNumber: (priorPlan.block_number ?? 1) + 1,
  })
  const result = await callSonnet<{
    workout_plan: unknown
    adjustments_made: unknown
  }>({
    featureTag: FEATURE_TAGS.ADJUST,
    systemPrompt,
    // buildAdjustPrompt does not ship a shared tool — adjust prompt may
    // re-use workoutTool; if Agent A exports an adjustTool we can swap.
    tool: workoutTool,
    userMessage,
    agencyId,
    metadata: {
      trainee_id: traineeId,
      prior_plan_id: priorPlanId,
      next_phase: nextPhase,
    },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const payload = result.data as {
    workout_plan?: unknown
    adjustments_made?: unknown
  }
  const newWorkoutPlan = payload?.workout_plan ?? payload
  const adjustmentsMade = payload?.adjustments_made ?? null

  const { data: inserted, error: insErr } = await sb
    .from('koto_fitness_plans')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      block_number: (priorPlan.block_number ?? 1) + 1,
      baseline: priorPlan.baseline,
      roadmap: priorPlan.roadmap,
      workout_plan: newWorkoutPlan,
      phase_ref: nextPhase,
      adjustment_summary: adjustmentsMade,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    console.error('[trainer/generate] adjust insert error:', insErr?.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({
    new_plan_id: (inserted as { id: string }).id,
    workout_plan: newWorkoutPlan,
    adjustments_made: adjustmentsMade,
  })
}

// ── Adherence helper (also exercised by /api/trainer/workout-logs) ────────
function computeAdherenceSummary(
  workoutPlan: unknown,
  logs: WorkoutLog[],
): AdherenceSummary {
  const scheduledSessionDays = new Set<number>()
  const wp = workoutPlan as
    | { sessions?: Array<{ day_number?: number; session_day_number?: number }> }
    | null
  for (const s of wp?.sessions ?? []) {
    const day = (s?.day_number ?? s?.session_day_number) as number | undefined
    if (typeof day === 'number') scheduledSessionDays.add(day)
  }
  const scheduledSessions = scheduledSessionDays.size

  const loggedSessionDays = new Set<number>()
  for (const l of logs) {
    if (typeof l.session_day_number === 'number') {
      loggedSessionDays.add(l.session_day_number)
    }
  }
  const loggedSessions = loggedSessionDays.size

  const adherencePct =
    scheduledSessions > 0
      ? Math.round((loggedSessions / scheduledSessions) * 100)
      : 0

  return {
    scheduled_sessions: scheduledSessions,
    logged_sessions: loggedSessions,
    adherence_pct: adherencePct,
  }
}
