import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySession } from '../../../../lib/apiAuth'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — POST /api/trainer/workout-logs
//
// Five-action JSON dispatcher for per-set workout logging:
//   list_for_plan / log_set / update_log / delete_log / compute_adherence
//
// Mirrors Phase 1 /api/trainer/trainees exactly (verifySession → feature-flag
// gate → ALLOWED_ACTIONS → 404-not-403 on cross-agency lookups).
//
// compute_adherence is also consumed by /api/trainer/generate's adjust_block
// action (via the shared computeAdherenceFromRows helper) but the HTTP
// surface stays here so UI grids can fetch adherence without hitting the
// Sonnet route.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const ALLOWED_ACTIONS = [
  'list_for_plan',
  'log_set',
  'update_log',
  'delete_log',
  'compute_adherence',
] as const

type Action = (typeof ALLOWED_ACTIONS)[number]

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

const LOG_SELECT = [
  'id',
  'agency_id',
  'trainee_id',
  'plan_id',
  'session_day_number',
  'session_logged_at',
  'exercise_id',
  'exercise_name',
  'set_number',
  'actual_weight_kg',
  'actual_reps',
  'rpe',
  'notes',
  'created_at',
  'updated_at',
].join(', ')

// ── Dispatcher ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await verifySession(req)
  if (!session.verified || !session.agencyId) return err(401, 'Unauthorized')
  const agencyId = session.agencyId

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

  try {
    await assertFitnessCoachEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  try {
    if (action === 'list_for_plan') return await handleList(sb, agencyId, body)
    if (action === 'log_set') return await handleLogSet(sb, agencyId, body)
    if (action === 'update_log') return await handleUpdate(sb, agencyId, body)
    if (action === 'delete_log') return await handleDelete(sb, agencyId, body)
    if (action === 'compute_adherence') return await handleAdherence(sb, agencyId, body)
    return err(400, 'Unknown action')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[trainer/workout-logs] dispatch error:', msg)
    return err(500, 'Internal error')
  }
}

// ── Action handlers ──────────────────────────────────────────────────────

async function handleList(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  if (!planId) return err(400, 'plan_id required')

  // Enforce that the plan belongs to this agency first — cross-agency plan id
  // returns 404, not an empty list (link-enumeration rule).
  const { data: plan, error: planErr } = await sb
    .from('koto_fitness_plans')
    .select('id')
    .eq('id', planId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (planErr) {
    console.error('[trainer/workout-logs] plan lookup error:', planErr.message)
    return err(500, 'Plan lookup failed')
  }
  if (!plan) return err(404, 'Not found')

  const { data, error } = await sb
    .from('koto_fitness_workout_logs')
    .select(LOG_SELECT)
    .eq('plan_id', planId)
    .eq('agency_id', agencyId)
    .order('session_day_number', { ascending: true })
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true })
  if (error) {
    console.error('[trainer/workout-logs] list error:', error.message)
    return err(500, 'List failed')
  }
  return NextResponse.json({ logs: data ?? [] })
}

async function handleLogSet(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  const sessionDay =
    typeof body.session_day_number === 'number'
      ? body.session_day_number
      : Number(body.session_day_number)
  const exerciseId = typeof body.exercise_id === 'string' ? body.exercise_id : ''
  const exerciseName =
    typeof body.exercise_name === 'string' ? body.exercise_name : ''
  const setNumber =
    typeof body.set_number === 'number' ? body.set_number : Number(body.set_number)
  const actualReps =
    typeof body.actual_reps === 'number'
      ? body.actual_reps
      : Number(body.actual_reps)

  if (!planId) return err(400, 'plan_id required')
  if (!traineeId) return err(400, 'trainee_id required')
  if (!Number.isInteger(sessionDay) || sessionDay < 1 || sessionDay > 14) {
    return err(400, 'session_day_number must be 1-14')
  }
  if (!exerciseId) return err(400, 'exercise_id required')
  if (!exerciseName) return err(400, 'exercise_name required')
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    return err(400, 'set_number must be >= 1')
  }
  if (!Number.isFinite(actualReps) || actualReps < 0) {
    return err(400, 'actual_reps must be >= 0')
  }

  // Cross-check: plan belongs to this agency AND the trainee matches.
  const { data: plan, error: planErr } = await sb
    .from('koto_fitness_plans')
    .select('id, trainee_id')
    .eq('id', planId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (planErr) {
    console.error('[trainer/workout-logs] plan lookup error:', planErr.message)
    return err(500, 'Plan lookup failed')
  }
  if (!plan) return err(404, 'Not found')
  if ((plan as { trainee_id: string }).trainee_id !== traineeId) {
    return err(404, 'Not found')
  }

  const row: Record<string, unknown> = {
    agency_id: agencyId,
    trainee_id: traineeId,
    plan_id: planId,
    session_day_number: sessionDay,
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    set_number: setNumber,
    actual_reps: actualReps,
  }
  if (body.actual_weight_kg !== undefined && body.actual_weight_kg !== null) {
    const w =
      typeof body.actual_weight_kg === 'number'
        ? body.actual_weight_kg
        : Number(body.actual_weight_kg)
    if (!Number.isFinite(w)) return err(400, 'actual_weight_kg must be numeric')
    row.actual_weight_kg = w
  }
  if (body.rpe !== undefined && body.rpe !== null) {
    const rpe = typeof body.rpe === 'number' ? body.rpe : Number(body.rpe)
    if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
      return err(400, 'rpe must be between 1 and 10')
    }
    row.rpe = rpe
  }
  if (typeof body.notes === 'string') row.notes = body.notes

  const { data, error } = await sb
    .from('koto_fitness_workout_logs')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    console.error('[trainer/workout-logs] insert error:', error.message)
    return err(500, 'Insert failed')
  }
  return NextResponse.json(
    { log_id: (data as { id: string }).id },
    { status: 201 },
  )
}

async function handleUpdate(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const logId = typeof body.log_id === 'string' ? body.log_id : ''
  const patch = body.patch
  if (!logId) return err(400, 'log_id required')
  if (typeof patch !== 'object' || patch === null) {
    return err(400, 'patch object required')
  }

  const p = patch as Record<string, unknown>
  const update: Record<string, unknown> = {}

  if ('actual_weight_kg' in p) {
    if (p.actual_weight_kg === null) {
      update.actual_weight_kg = null
    } else {
      const w =
        typeof p.actual_weight_kg === 'number'
          ? p.actual_weight_kg
          : Number(p.actual_weight_kg)
      if (!Number.isFinite(w)) return err(400, 'actual_weight_kg must be numeric')
      update.actual_weight_kg = w
    }
  }
  if ('actual_reps' in p) {
    const r = typeof p.actual_reps === 'number' ? p.actual_reps : Number(p.actual_reps)
    if (!Number.isFinite(r) || r < 0) return err(400, 'actual_reps must be >= 0')
    update.actual_reps = r
  }
  if ('rpe' in p) {
    if (p.rpe === null) {
      update.rpe = null
    } else {
      const rpe = typeof p.rpe === 'number' ? p.rpe : Number(p.rpe)
      if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
        return err(400, 'rpe must be between 1 and 10')
      }
      update.rpe = rpe
    }
  }
  if ('notes' in p) {
    update.notes = p.notes === null ? null : String(p.notes ?? '')
  }

  if (Object.keys(update).length === 0) return err(400, 'patch empty')

  const { data, error } = await sb
    .from('koto_fitness_workout_logs')
    .update(update)
    .eq('id', logId)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[trainer/workout-logs] update error:', error.message)
    return err(500, 'Update failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

async function handleDelete(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const logId = typeof body.log_id === 'string' ? body.log_id : ''
  if (!logId) return err(400, 'log_id required')

  const { data, error } = await sb
    .from('koto_fitness_workout_logs')
    .delete()
    .eq('id', logId)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[trainer/workout-logs] delete error:', error.message)
    return err(500, 'Delete failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

async function handleAdherence(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
  if (!planId) return err(400, 'plan_id required')

  const { data: plan, error: planErr } = await sb
    .from('koto_fitness_plans')
    .select('id, workout_plan')
    .eq('id', planId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (planErr) {
    console.error('[trainer/workout-logs] plan lookup error:', planErr.message)
    return err(500, 'Plan lookup failed')
  }
  if (!plan) return err(404, 'Not found')

  const { data: logRows, error: logErr } = await sb
    .from('koto_fitness_workout_logs')
    .select('session_day_number, exercise_id')
    .eq('plan_id', planId)
    .eq('agency_id', agencyId)
  if (logErr) {
    console.error('[trainer/workout-logs] logs load error:', logErr.message)
    return err(500, 'Logs load failed')
  }

  const workoutPlan = (plan as { workout_plan?: unknown }).workout_plan
  const result = computeAdherenceFromRows(
    workoutPlan,
    (logRows ?? []) as Array<{ session_day_number: number; exercise_id: string }>,
  )
  return NextResponse.json(result)
}

// ── Adherence helper (exported for generate/route.ts sanity but kept local
// to stay inside the file territory; /api/trainer/generate has its own
// copy sized for its specific needs) ─────────────────────────────────────

type PlanSessionShape = {
  day_number?: number
  session_day_number?: number
  exercises?: Array<{
    exercise_id?: string
    slug?: string
    sets?: number | Array<unknown>
  }>
}

function computeAdherenceFromRows(
  workoutPlan: unknown,
  logs: Array<{ session_day_number: number; exercise_id: string }>,
): {
  scheduled_sessions: number
  logged_sessions: number
  adherence_pct: number
  per_exercise: Array<{
    exercise_id: string
    scheduled_sets: number
    logged_sets: number
  }>
} {
  const wp = workoutPlan as { sessions?: PlanSessionShape[] } | null

  const scheduledSessionDays = new Set<number>()
  const scheduledSetsByExercise = new Map<string, number>()
  for (const s of wp?.sessions ?? []) {
    const day = (s?.day_number ?? s?.session_day_number) as number | undefined
    if (typeof day === 'number') scheduledSessionDays.add(day)
    for (const ex of s?.exercises ?? []) {
      const exId = (ex?.exercise_id ?? ex?.slug) as string | undefined
      if (!exId) continue
      const sets = ex?.sets
      const count = Array.isArray(sets) ? sets.length : typeof sets === 'number' ? sets : 0
      scheduledSetsByExercise.set(
        exId,
        (scheduledSetsByExercise.get(exId) ?? 0) + count,
      )
    }
  }

  const loggedSessionDays = new Set<number>()
  const loggedSetsByExercise = new Map<string, number>()
  for (const l of logs) {
    if (typeof l.session_day_number === 'number') {
      loggedSessionDays.add(l.session_day_number)
    }
    if (l.exercise_id) {
      loggedSetsByExercise.set(
        l.exercise_id,
        (loggedSetsByExercise.get(l.exercise_id) ?? 0) + 1,
      )
    }
  }

  const scheduledSessions = scheduledSessionDays.size
  const loggedSessions = loggedSessionDays.size
  const adherencePct =
    scheduledSessions > 0
      ? Math.round((loggedSessions / scheduledSessions) * 100)
      : 0

  const exerciseIds = new Set<string>([
    ...scheduledSetsByExercise.keys(),
    ...loggedSetsByExercise.keys(),
  ])
  const perExercise = Array.from(exerciseIds).map((exId) => ({
    exercise_id: exId,
    scheduled_sets: scheduledSetsByExercise.get(exId) ?? 0,
    logged_sets: loggedSetsByExercise.get(exId) ?? 0,
  }))

  return {
    scheduled_sessions: scheduledSessions,
    logged_sessions: loggedSessions,
    adherence_pct: adherencePct,
    per_exercise: perExercise,
  }
}
