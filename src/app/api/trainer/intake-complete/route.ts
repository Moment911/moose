import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
// POST /api/trainer/intake-complete
//
// Token-based plan generation for trainer-initiated trainees.  Identical to
// self-signup's plan chain (baseline → roadmap → workout → playbook) but:
//   - Authenticates via trainee_id (no JWT)
//   - Updates an EXISTING trainee row instead of creating one
//   - No user↔trainee mapping needed (trainer manages the relationship)
//
// Called by /intake/:traineeId after all fields are collected.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 300

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

export async function POST(req: NextRequest) {
  const sb = getDb()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Validate trainee exists.
  const { data: traineeRow, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !traineeRow) return err(404, 'Trainee not found')

  const agencyId = (traineeRow as { agency_id: string }).agency_id

  // Merge the incoming intake with existing trainee data.
  const intake = (body.intake ?? body) as Record<string, unknown>
  const merged = { ...traineeRow, ...intake }

  const valid = validateIntake(merged)
  if (!valid.ok) return err(400, 'Validation failed', { field_errors: valid.errors })

  // Update trainee row with final intake.
  const { error: updErr } = await sb
    .from('koto_fitness_trainees')
    .update({ ...valid.data, status: 'intake_complete' })
    .eq('id', traineeId)
  if (updErr) {
    console.error('[trainer/intake-complete] trainee update error:', updErr.message)
    return err(500, 'Could not update trainee')
  }

  const trainee = { ...traineeRow, ...valid.data, id: traineeId, agency_id: agencyId } as IntakeInput & { id: string; agency_id: string }

  // ── Generate the core plan chain (same as self-signup) ──────────────────
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
      metadata: { trainee_id: traineeId, token_intake: true },
    })
    if (r.ok) progress.baseline = r.data
    else errors.push(`baseline:${r.error}`)
  } catch (e) {
    errors.push(`baseline:${e instanceof Error ? e.message : String(e)}`)
  }

  const { data: planRow, error: planErr } = await sb
    .from('koto_fitness_plans')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      block_number: 1,
      baseline: progress.baseline ?? null,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (planErr || !planRow) {
    console.error('[trainer/intake-complete] plan insert error:', planErr?.message)
    return err(500, 'Could not create plan row')
  }
  const planId = (planRow as { id: string }).id

  // Bail if not ok to train.
  const okToTrain = progress.baseline?.training_readiness?.ok_to_train
  if (okToTrain === false) {
    return NextResponse.json({
      trainee_id: traineeId,
      plan_id: planId,
      ok_to_train: false,
      red_flags: progress.baseline?.training_readiness?.red_flags ?? [],
      errors,
    })
  }

  // Roadmap
  if (progress.baseline) {
    try {
      const { systemPrompt, userMessage } = buildRoadmapPrompt({ intake: trainee, baseline: progress.baseline })
      const r = await callSonnet<RoadmapOutput>({
        featureTag: FEATURE_TAGS.ROADMAP,
        systemPrompt,
        tool: roadmapTool,
        userMessage,
        agencyId,
        metadata: { trainee_id: traineeId, plan_id: planId, token_intake: true },
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
      const { systemPrompt, userMessage } = buildWorkoutPrompt({ intake: trainee, baseline: progress.baseline, roadmap: progress.roadmap, phase: 1 })
      const r = await callSonnet<WorkoutOutput>({
        featureTag: FEATURE_TAGS.WORKOUT,
        systemPrompt,
        tool: workoutTool,
        userMessage,
        agencyId,
        metadata: { trainee_id: traineeId, plan_id: planId, phase: 1, token_intake: true },
      })
      if (r.ok) progress.workout = r.data
      else errors.push(`workout:${r.error}`)
    } catch (e) {
      errors.push(`workout:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Playbook
  if (progress.baseline && progress.roadmap) {
    try {
      const { systemPrompt, userMessage } = buildPlaybookPrompt({ intake: trainee, baseline: progress.baseline, roadmap: progress.roadmap })
      const r = await callSonnet<CoachingPlaybookOutput>({
        featureTag: FEATURE_TAGS.PLAYBOOK,
        systemPrompt,
        tool: playbookTool,
        userMessage,
        agencyId,
        maxTokens: 16000,
        metadata: { trainee_id: traineeId, plan_id: planId, token_intake: true },
      })
      if (r.ok) progress.playbook = r.data
      else errors.push(`playbook:${r.error}`)
    } catch (e) {
      errors.push(`playbook:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Persist plan.
  await sb
    .from('koto_fitness_plans')
    .update({
      baseline: progress.baseline ?? null,
      roadmap: progress.roadmap ?? null,
      workout_plan: progress.workout ?? null,
      playbook: progress.playbook ?? null,
      phase_ref: progress.workout ? 1 : null,
    })
    .eq('id', planId)

  // Update status.
  if (progress.workout) {
    await sb
      .from('koto_fitness_trainees')
      .update({ status: 'plan_generated' })
      .eq('id', traineeId)
  }

  return NextResponse.json({
    trainee_id: traineeId,
    plan_id: planId,
    baseline_ready: !!progress.baseline,
    roadmap_ready: !!progress.roadmap,
    workout_ready: !!progress.workout,
    playbook_ready: !!progress.playbook,
    errors,
  })
}
