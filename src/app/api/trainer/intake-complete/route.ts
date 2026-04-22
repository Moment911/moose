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
// Token-based plan generation for trainer-initiated trainees.  Streams
// NDJSON progress events so the client can show per-phase progress and,
// more importantly, so Vercel's gateway doesn't close the connection on
// minute-long plan chains (returning 504 to the caller).
//
// Stream events (one JSON object per line):
//   {type:'start', trainee_id, plan_id}
//   {type:'phase_start', phase:'baseline'|'roadmap'|'workout'|'playbook'}
//   {type:'phase_complete', phase:'...', ok_to_train?:bool}
//   {type:'heartbeat', phase:'...'} (every 15s during a phase, keeps gateway alive)
//   {type:'done', plan_id, trainee_id, baseline_ready, roadmap_ready,
//      workout_ready, playbook_ready, ok_to_train?, red_flags?, errors}
//   {type:'error', error, code?}
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

function errJson(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errJson(400, 'Invalid JSON')
  }

  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return errJson(400, 'trainee_id required')

  // Validate trainee exists.
  const { data: traineeRow, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !traineeRow) return errJson(404, 'Trainee not found')

  const agencyId = (traineeRow as { agency_id: string }).agency_id

  // Merge + validate intake BEFORE starting the stream so validation
  // errors return as normal 400 JSON (not mid-stream).
  const intake = (body.intake ?? body) as Record<string, unknown>
  const merged = { ...traineeRow, ...intake }
  const valid = validateIntake(merged)
  if (!valid.ok) return errJson(400, 'Validation failed', { field_errors: valid.errors })

  // Update trainee row with final intake.
  const { error: updErr } = await sb
    .from('koto_fitness_trainees')
    .update({ ...valid.data, status: 'intake_complete' })
    .eq('id', traineeId)
  if (updErr) {
    console.error('[trainer/intake-complete] trainee update error:', updErr.message)
    return errJson(500, 'Could not update trainee')
  }

  const trainee = { ...traineeRow, ...valid.data, id: traineeId, agency_id: agencyId } as IntakeInput & { id: string; agency_id: string }

  // Create plan row up front so we can emit plan_id in the start event.
  const { data: planRow, error: planErr } = await sb
    .from('koto_fitness_plans')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      block_number: 1,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (planErr || !planRow) {
    console.error('[trainer/intake-complete] plan insert error:', planErr?.message)
    return errJson(500, 'Could not create plan row')
  }
  const planId = (planRow as { id: string }).id

  // ── Stream NDJSON for the plan chain ────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const emit = (obj: Record<string, unknown>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          closed = true
        }
      }

      // Wrap each Sonnet phase with a heartbeat that emits every 15s while
      // the call is in flight.  Keeps the Vercel edge gateway from timing
      // out a stream that otherwise goes quiet for 30-60s.
      async function runPhase<T>(phase: string, work: () => Promise<T>): Promise<T> {
        emit({ type: 'phase_start', phase })
        const hb = setInterval(() => emit({ type: 'heartbeat', phase }), 15000)
        try {
          return await work()
        } finally {
          clearInterval(hb)
        }
      }

      const progress: {
        baseline?: BaselineOutput
        roadmap?: RoadmapOutput
        workout?: WorkoutOutput
        playbook?: CoachingPlaybookOutput
      } = {}
      const errors: string[] = []

      emit({ type: 'start', trainee_id: traineeId, plan_id: planId })

      // Baseline
      try {
        const { systemPrompt, userMessage } = buildBaselinePrompt({ intake: trainee })
        const r = await runPhase('baseline', () => callSonnet<BaselineOutput>({
          featureTag: FEATURE_TAGS.BASELINE,
          systemPrompt,
          tool: baselineTool,
          userMessage,
          agencyId,
          metadata: { trainee_id: traineeId, token_intake: true },
        }))
        if (r.ok) progress.baseline = r.data
        else errors.push(`baseline:${r.error}`)
      } catch (e) {
        errors.push(`baseline:${e instanceof Error ? e.message : String(e)}`)
      }

      await sb
        .from('koto_fitness_plans')
        .update({ baseline: progress.baseline ?? null })
        .eq('id', planId)

      const okToTrain = progress.baseline?.training_readiness?.ok_to_train
      emit({ type: 'phase_complete', phase: 'baseline', ok_to_train: okToTrain })

      // Medical hold — no further generation if readiness check fails.
      if (okToTrain === false) {
        emit({
          type: 'done',
          trainee_id: traineeId,
          plan_id: planId,
          ok_to_train: false,
          baseline_ready: !!progress.baseline,
          roadmap_ready: false,
          workout_ready: false,
          playbook_ready: false,
          red_flags: progress.baseline?.training_readiness?.red_flags ?? [],
          errors,
        })
        controller.close()
        closed = true
        return
      }

      // Roadmap
      if (progress.baseline) {
        try {
          const { systemPrompt, userMessage } = buildRoadmapPrompt({ intake: trainee, baseline: progress.baseline })
          const r = await runPhase('roadmap', () => callSonnet<RoadmapOutput>({
            featureTag: FEATURE_TAGS.ROADMAP,
            systemPrompt,
            tool: roadmapTool,
            userMessage,
            agencyId,
            metadata: { trainee_id: traineeId, plan_id: planId, token_intake: true },
          }))
          if (r.ok) progress.roadmap = r.data
          else errors.push(`roadmap:${r.error}`)
        } catch (e) {
          errors.push(`roadmap:${e instanceof Error ? e.message : String(e)}`)
        }
      }
      emit({ type: 'phase_complete', phase: 'roadmap' })

      // Workout (phase 1)
      if (progress.baseline && progress.roadmap) {
        try {
          const { systemPrompt, userMessage } = buildWorkoutPrompt({ intake: trainee, baseline: progress.baseline, roadmap: progress.roadmap, phase: 1 })
          const r = await runPhase('workout', () => callSonnet<WorkoutOutput>({
            featureTag: FEATURE_TAGS.WORKOUT,
            systemPrompt,
            tool: workoutTool,
            userMessage,
            agencyId,
            metadata: { trainee_id: traineeId, plan_id: planId, phase: 1, token_intake: true },
          }))
          if (r.ok) progress.workout = r.data
          else errors.push(`workout:${r.error}`)
        } catch (e) {
          errors.push(`workout:${e instanceof Error ? e.message : String(e)}`)
        }
      }
      emit({ type: 'phase_complete', phase: 'workout' })

      // Playbook
      if (progress.baseline && progress.roadmap) {
        try {
          const { systemPrompt, userMessage } = buildPlaybookPrompt({ intake: trainee, baseline: progress.baseline, roadmap: progress.roadmap })
          const r = await runPhase('playbook', () => callSonnet<CoachingPlaybookOutput>({
            featureTag: FEATURE_TAGS.PLAYBOOK,
            systemPrompt,
            tool: playbookTool,
            userMessage,
            agencyId,
            maxTokens: 16000,
            metadata: { trainee_id: traineeId, plan_id: planId, token_intake: true },
          }))
          if (r.ok) progress.playbook = r.data
          else errors.push(`playbook:${r.error}`)
        } catch (e) {
          errors.push(`playbook:${e instanceof Error ? e.message : String(e)}`)
        }
      }
      emit({ type: 'phase_complete', phase: 'playbook' })

      // Persist remaining plan pieces + flip trainee status on success.
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

      if (progress.workout) {
        await sb
          .from('koto_fitness_trainees')
          .update({ status: 'plan_generated' })
          .eq('id', traineeId)
      }

      emit({
        type: 'done',
        trainee_id: traineeId,
        plan_id: planId,
        baseline_ready: !!progress.baseline,
        roadmap_ready: !!progress.roadmap,
        workout_ready: !!progress.workout,
        playbook_ready: !!progress.playbook,
        // okToTrain is true | undefined at this point (false early-returned
        // above). Emit as-is; undefined => field omitted in JSON, client
        // defaults to "ok" when absent.
        ok_to_train: okToTrain,
        errors,
      })
      controller.close()
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
