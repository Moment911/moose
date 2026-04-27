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
import {
  buildPlaybookPrompt,
  playbookTool,
  type CoachingPlaybookOutput,
} from '../../../../lib/trainer/prompts/playbook'
import {
  buildRefinePrompt,
  refineTool,
  mergeAnswersIntoAboutYou,
  type RefineOutput,
  type RefineAnswer,
} from '../../../../lib/trainer/prompts/refine'
import type { IntakeInput } from '../../../../lib/trainer/intakeSchema'
import { missingIntakeFields } from '../../../../lib/trainer/intakeCompleteness'
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
  'generate_playbook',
  'adjust_block',
  'refine_elicit',
  'refine_submit',
  'extract_from_about',
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
  playbook?: unknown
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
    if (action === 'generate_playbook') return await handlePlaybook(sb, agencyId, body)
    if (action === 'adjust_block') return await handleAdjust(sb, agencyId, body)
    if (action === 'refine_elicit') return await handleRefineElicit(sb, agencyId, body)
    if (action === 'refine_submit') return await handleRefineSubmit(sb, agencyId, body)
    if (action === 'extract_from_about') return await handleExtractFromAbout(sb, agencyId, body)
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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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
  let result = await callSonnet<WorkoutOutput>({
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

  let shapeErr = assertWorkoutShape(result.data)
  if (shapeErr) {
    // Retry once — Sonnet shape drift is transient
    console.warn('[trainer/generate] workout shape violation, retrying:', shapeErr)
    result = await callSonnet<WorkoutOutput>({
      featureTag: FEATURE_TAGS.WORKOUT,
      systemPrompt,
      tool: workoutTool,
      userMessage,
      agencyId,
      metadata: { trainee_id: traineeId, plan_id: planId, phase, retry: true },
    })
    if (!result.ok) {
      return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
    }
    shapeErr = assertWorkoutShape(result.data)
    if (shapeErr) {
      console.error('[trainer/generate] workout shape violation after retry:', shapeErr)
      return err(502, 'sonnet_shape_violation', { detail: shapeErr })
    }
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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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

async function handlePlaybook(
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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

  const plan = await loadPlan(sb, agencyId, planId, traineeId)
  if (!plan) return err(404, 'Not found')
  if (!plan.baseline) return err(400, 'baseline_missing')
  if (!plan.roadmap) return err(400, 'roadmap_missing')

  const { systemPrompt, userMessage } = buildPlaybookPrompt({
    intake: trainee,
    baseline: plan.baseline as BaselineOutput,
    roadmap: plan.roadmap as RoadmapOutput,
  })
  const result = await callSonnet<CoachingPlaybookOutput>({
    featureTag: FEATURE_TAGS.PLAYBOOK,
    systemPrompt,
    tool: playbookTool,
    userMessage,
    agencyId,
    maxTokens: 16000, // playbook is the longest output
    metadata: { trainee_id: traineeId, plan_id: planId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }
  const playbook = result.data

  const { error: updErr } = await sb
    .from('koto_fitness_plans')
    .update({ playbook })
    .eq('id', planId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] playbook update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ playbook })
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
  const gateErr = requireCompleteIntake(trainee)
  if (gateErr) return gateErr

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

  const shapeErr = assertWorkoutShape(newWorkoutPlan)
  if (shapeErr) {
    console.error('[trainer/generate] adjust shape violation:', shapeErr)
    return err(502, 'sonnet_shape_violation', { detail: shapeErr })
  }

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

// ── Refine handlers ──────────────────────────────────────────────────────
// Two actions:
//   refine_elicit   — call Sonnet to produce 4-6 follow-up questions tailored
//                     to this trainee.  Returns the questions without
//                     persisting them — UI re-runs elicit on demand.
//   refine_submit   — take trainee's answers and merge them into about_you
//                     as a "— Additional context (refined with AI) —" block.
//                     Every downstream Sonnet prompt reads about_you so this
//                     feeds into baseline, roadmap, workout, meals, etc. for
//                     free (no schema change needed).
//
// The intake-completeness gate intentionally does NOT fire on refine:
// refining is a legitimate intermediate step between initial intake and
// baseline, and shouldn't be blocked by the completeness rule that governs
// strategy generation.

async function handleRefineElicit(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const { systemPrompt, userMessage } = buildRefinePrompt({ intake: trainee })
  const result = await callSonnet<RefineOutput>({
    featureTag: FEATURE_TAGS.REFINE,
    systemPrompt,
    tool: refineTool,
    userMessage,
    agencyId,
    metadata: { trainee_id: traineeId },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const questions = (result.data as RefineOutput).questions ?? []
  return NextResponse.json({ questions })
}

async function handleRefineSubmit(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const answersRaw = body.answers
  if (!traineeId) return err(400, 'trainee_id required')
  if (!Array.isArray(answersRaw)) return err(400, 'answers must be an array')

  const answers: RefineAnswer[] = []
  for (const a of answersRaw) {
    if (!a || typeof a !== 'object') return err(400, 'invalid answer entry')
    const entry = a as { question_id?: unknown; question_text?: unknown; answer?: unknown }
    if (typeof entry.question_id !== 'string' || entry.question_id.length === 0) {
      return err(400, 'answer.question_id required')
    }
    if (typeof entry.question_text !== 'string') {
      return err(400, 'answer.question_text required')
    }
    if (typeof entry.answer !== 'string' || entry.answer.trim().length === 0) {
      // Skip unanswered — no point merging an empty Q&A.
      continue
    }
    answers.push({
      question_id: entry.question_id,
      question_text: entry.question_text,
      answer: entry.answer,
    })
  }

  if (answers.length === 0) {
    return err(400, 'no_answers_provided')
  }

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const nextAboutYou = mergeAnswersIntoAboutYou(trainee.about_you, answers)

  const { error: updErr } = await sb
    .from('koto_fitness_trainees')
    .update({ about_you: nextAboutYou })
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/generate] refine_submit update error:', updErr.message)
    return err(500, 'Persist failed')
  }

  return NextResponse.json({ ok: true, about_you: nextAboutYou })
}

// ── Intake completeness gate ──────────────────────────────────────────────
// Every plan-generating action (baseline, roadmap, workout, food prefs, meals,
// playbook, adjust) runs this first.  If the trainee's intake is incomplete,
// we return 400 with the list of missing fields so the UI can route back to
// the intake form.  "Ask every question before any strategy is drafted."
function requireCompleteIntake(trainee: TraineeRow): NextResponse | null {
  const missing = missingIntakeFields(trainee)
  if (missing.length === 0) return null
  return NextResponse.json(
    {
      error: 'intake_incomplete',
      detail: 'Finish the intake before generating a plan.',
      missing_fields: missing,
    },
    { status: 400 },
  )
}

// ── Shape guard for Sonnet workout output ─────────────────────────────────
// Returns an error message if the plan is missing weeks or has any empty
// sessions array; null when the shape is usable.  The accordion's defensive
// banner still renders if a bad row slips through, but this guard prevents
// the bad row from being persisted in the first place.
function assertWorkoutShape(wp: unknown): string | null {
  const o = wp as { weeks?: unknown } | null
  const weeks = Array.isArray(o?.weeks) ? (o!.weeks as unknown[]) : []
  if (weeks.length === 0 || weeks.length > 4) return `weeks must contain 1-4 entries, got ${weeks.length}`
  for (const w of weeks) {
    const sessions = (w as { sessions?: unknown } | null)?.sessions
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return 'each week must contain at least one session'
    }
  }
  return null
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

// ── extract_from_about — parse about_you text and extract structured fields ──
//
// Uses Haiku (fast + cheap) to pull age, height, weight, velocity, position,
// etc. from the free-text "About this athlete" field. Patches the trainee row
// with any fields it can confidently extract.

async function handleExtractFromAbout(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const aboutText = (trainee as Record<string, unknown>).about_you
  if (!aboutText || typeof aboutText !== 'string' || aboutText.trim().length < 10) {
    return NextResponse.json({ extracted: {}, patched: [] })
  }

  // Call Haiku for fast extraction
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const extractionPrompt = `Extract structured athlete profile fields from this free-text description. Return ONLY a JSON object with the fields you can confidently extract. Do NOT guess or infer — only extract what is explicitly stated.

Available fields:
- age (number)
- sex ("M" or "F")
- height_cm (number — convert from feet/inches if stated. 5'10" = 177.8cm)
- current_weight_kg (number — convert from lbs if stated. 160 lbs = 72.6kg)
- target_weight_kg (number — convert from lbs if stated)
- primary_goal (one of: "lose_fat", "gain_muscle", "maintain", "performance", "recomp")
- training_experience_years (number)
- training_days_per_week (number)
- equipment_access (one of: "none", "bands", "home_gym", "full_gym")
- position_primary (string, e.g. "RHP", "OF", "C", "1B")
- position_secondary (string)
- throwing_hand ("R" or "L")
- batting_hand ("R", "L", or "S")
- fastball_velo_peak (number in mph)
- fastball_velo_sit (number in mph)
- exit_velo (number in mph)
- sixty_time (number in seconds)
- pitch_arsenal (array of strings, e.g. ["fastball", "curveball", "changeup"])
- grad_year (number, e.g. 2028)
- gpa (number)
- high_school (string)
- club_team (string)
- injuries (string)
- medical_flags (string)
- sleep_hours_avg (number)
- meals_per_day (number)
- dietary_preference (string)
- allergies (string)
- bullpen_sessions_per_week (number)
- games_per_week (number)
- practices_per_week (number)

Athlete description:
"""
${aboutText}
"""

Return ONLY valid JSON. No markdown, no explanation.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: extractionPrompt }],
    })

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
    let extracted: Record<string, unknown> = {}
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ extracted: {}, patched: [], parse_error: true })
    }

    // Only patch fields that are currently empty on the trainee row
    const patch: Record<string, unknown> = {}
    const traineeData = trainee as Record<string, unknown>
    for (const [key, value] of Object.entries(extracted)) {
      if (value == null || value === '') continue
      const current = traineeData[key]
      // Only fill empty fields — don't overwrite existing data
      if (current == null || current === '' || current === 0) {
        patch[key] = value
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await sb
        .from('koto_fitness_trainees')
        .update(patch)
        .eq('id', traineeId)
        .eq('agency_id', agencyId)
      if (updateErr) {
        console.error('[trainer/generate] extract_from_about update error:', updateErr.message)
      }
    }

    return NextResponse.json({ extracted, patched: Object.keys(patch) })
  } catch (e) {
    console.error('[trainer/generate] extract_from_about error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ extracted: {}, patched: [], error: 'Extraction failed' })
  }
}
