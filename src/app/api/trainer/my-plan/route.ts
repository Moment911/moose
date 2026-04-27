import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — POST /api/trainer/my-plan
//
// Trainee-facing dispatcher. The trainee has a Supabase magic-link session
// but is NOT an agency_members member, so the usual verifySession() cannot
// resolve an agencyId for them. We verify the trainee's auth token inline
// and resolve their trainee_id / agency_id via koto_fitness_trainee_users.
//
// Three actions, all agency-scoped and trainee-scoped via the mapping row:
//   get_my_plan  — returns latest plan (highest block_number) + meta
//   log_set      — insert a workout-log row
//   update_log   — update one of THIS TRAINEE'S workout-log rows
//
// The trainee CANNOT regenerate the plan, pick their own trainee_id, or
// see other trainees. All scoping is enforced server-side from the JWT →
// mapping row — body.trainee_id is ignored.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const ALLOWED_ACTIONS = ['get_my_plan', 'log_set', 'update_log', 'update_intake', 'delete_my_account', 'get_progress_history', 'log_progress'] as const
type Action = (typeof ALLOWED_ACTIONS)[number]

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

interface TraineeCtx {
  userId: string
  traineeId: string
  agencyId: string
  disclaimerAckAt: string | null
  inviteStatus: string
}

// ── verifyTraineeSession ───────────────────────────────────────────────────
//
// 1. Pull Bearer token from Authorization header.
// 2. Exchange it for a user via supabase.auth.getUser(token).
// 3. Look up koto_fitness_trainee_users by user_id (never by body).
// 4. Return { trainee_id, agency_id } or an error payload.
//
// Development bypass: NEXT_PUBLIC_BYPASS_AUTH mirrors apiAuth.ts. We accept
// a header x-koto-trainee-id to name which trainee is "logged in" for local
// testing. Hard-gated on NODE_ENV !== 'production'.
async function verifyTraineeSession(
  req: NextRequest,
  sb: SupabaseClient,
): Promise<
  | { ok: true; ctx: TraineeCtx }
  | { ok: false; status: number; error: string }
> {
  const bypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'

  if (bypass) {
    const traineeId = req.headers.get('x-koto-trainee-id')
    if (!traineeId) {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }
    const { data: mapping } = await sb
      .from('koto_fitness_trainee_users')
      .select('trainee_id, agency_id, user_id, disclaimer_ack_at, invite_status')
      .eq('trainee_id', traineeId)
      .maybeSingle()
    if (!mapping) return { ok: false, status: 401, error: 'Unauthorized' }
    const m = mapping as {
      trainee_id: string
      agency_id: string
      user_id: string | null
      disclaimer_ack_at: string | null
      invite_status: string
    }
    return {
      ok: true,
      ctx: {
        userId: m.user_id || 'bypass-user',
        traineeId: m.trainee_id,
        agencyId: m.agency_id,
        disclaimerAckAt: m.disclaimer_ack_at,
        inviteStatus: m.invite_status,
      },
    }
  }

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }

  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  const user = userData.user

  const { data: mapping, error: mapErr } = await sb
    .from('koto_fitness_trainee_users')
    .select('trainee_id, agency_id, disclaimer_ack_at, invite_status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (mapErr) {
    console.error('[trainer/my-plan] mapping lookup error:', mapErr.message)
    return { ok: false, status: 500, error: 'Session lookup failed' }
  }
  if (!mapping) {
    // Authenticated but not linked to a trainee — treat as not-invited.
    // 404 (not 403) per link-enumeration rule: a non-trainee probing
    // this endpoint shouldn't learn that "trainee users" even exist.
    return { ok: false, status: 404, error: 'Not found' }
  }
  const m = mapping as {
    trainee_id: string
    agency_id: string
    disclaimer_ack_at: string | null
    invite_status: string
  }
  if (m.invite_status === 'revoked') {
    return { ok: false, status: 404, error: 'Not found' }
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      traineeId: m.trainee_id,
      agencyId: m.agency_id,
      disclaimerAckAt: m.disclaimer_ack_at,
      inviteStatus: m.invite_status,
    },
  }
}

// ── POST dispatcher ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const sb = getDb()

  const session = await verifyTraineeSession(req, sb)
  if (!session.ok) return err(session.status, session.error)
  const ctx = session.ctx

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

  // Feature-flag gate — a trainee can't use the product if the agency's
  // fitness_coach flag has been turned off (e.g. subscription lapsed).
  try {
    await assertFitnessCoachEnabled(sb, ctx.agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  try {
    if (action === 'get_my_plan') return await handleGetMyPlan(sb, ctx)
    if (action === 'log_set') return await handleLogSet(sb, ctx, body)
    if (action === 'update_log') return await handleUpdateLog(sb, ctx, body)
    if (action === 'update_intake') return await handleUpdateIntake(sb, ctx, body)
    if (action === 'delete_my_account') return await handleDeleteMyAccount(sb, ctx)
    if (action === 'get_progress_history') return await handleGetProgressHistory(sb, ctx)
    if (action === 'log_progress') return await handleLogProgress(sb, ctx, body)
    return err(400, 'Unknown action')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[trainer/my-plan] dispatch error:', msg)
    return err(500, 'Internal error')
  }
}

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleGetMyPlan(sb: SupabaseClient, ctx: TraineeCtx) {
  // Pull the latest plan row — highest block_number is the current block.
  const { data: planRow, error: planErr } = await sb
    .from('koto_fitness_plans')
    .select(
      'id, block_number, baseline, workout_plan, food_preferences, meal_plan, grocery_list, roadmap, phase_ref, playbook, adjustment_summary, generated_at, model',
    )
    .eq('trainee_id', ctx.traineeId)
    .eq('agency_id', ctx.agencyId)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (planErr) {
    console.error('[trainer/my-plan] plan load error:', planErr.message)
    return err(500, 'Plan load failed')
  }

  const { data: traineeRow } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', ctx.traineeId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()

  const { data: agencyRow } = await sb
    .from('agencies')
    .select('name, brand_name, brand_color, brand_logo_url, logo_url, support_email')
    .eq('id', ctx.agencyId)
    .maybeSingle()

  // Hygiene: strip any personal_closing_note cross-trainee mentions if
  // present. The generator shouldn't emit these but we belt-and-suspender.
  const plan = (planRow ?? null) as Record<string, unknown> | null
  if (plan && plan.playbook && typeof plan.playbook === 'object') {
    const pb = plan.playbook as Record<string, unknown>
    if (pb.personal_closing_note && typeof pb.personal_closing_note === 'object') {
      const pcn = { ...(pb.personal_closing_note as Record<string, unknown>) }
      delete pcn.other_client_mentions
      plan.playbook = { ...pb, personal_closing_note: pcn }
    }
  }

  // Logs for the current plan — feeds the WorkoutAccordion grid.
  let logs: unknown[] = []
  if (plan) {
    const { data: logRows } = await sb
      .from('koto_fitness_workout_logs')
      .select(
        'id, session_day_number, exercise_id, exercise_name, set_number, actual_weight_kg, actual_reps, rpe, notes, session_logged_at',
      )
      .eq('plan_id', (plan as { id: string }).id)
      .eq('trainee_id', ctx.traineeId)
      .eq('agency_id', ctx.agencyId)
      .order('session_day_number', { ascending: true })
    logs = logRows ?? []
  }

  return NextResponse.json({
    plan,
    logs,
    trainee: {
      id: ctx.traineeId,
      ...(traineeRow || {}),
    },
    agency: agencyRow
      ? {
          name:
            (agencyRow as { brand_name?: string; name?: string }).brand_name ||
            (agencyRow as { name?: string }).name ||
            null,
          brand_color: (agencyRow as { brand_color?: string }).brand_color || null,
          logo_url:
            (agencyRow as { brand_logo_url?: string }).brand_logo_url ||
            (agencyRow as { logo_url?: string }).logo_url ||
            null,
          support_email: (agencyRow as { support_email?: string }).support_email || null,
        }
      : null,
    invite: {
      status: ctx.inviteStatus,
      disclaimer_ack_at: ctx.disclaimerAckAt,
    },
  })
}

// ── log_set — trainee logs one set ─────────────────────────────────────────
//
// Mirrors the /api/trainer/workout-logs log_set contract, but derives
// trainee_id + agency_id from ctx (never body), and cross-checks that the
// plan_id belongs to this trainee.
async function handleLogSet(
  sb: SupabaseClient,
  ctx: TraineeCtx,
  body: Record<string, unknown>,
) {
  const planId = typeof body.plan_id === 'string' ? body.plan_id : ''
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
    typeof body.actual_reps === 'number' ? body.actual_reps : Number(body.actual_reps)

  if (!planId) return err(400, 'plan_id required')
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

  // Plan must belong to this trainee under this agency.
  const { data: plan, error: planErr } = await sb
    .from('koto_fitness_plans')
    .select('id, trainee_id')
    .eq('id', planId)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  if (planErr) {
    console.error('[trainer/my-plan] plan lookup error:', planErr.message)
    return err(500, 'Plan lookup failed')
  }
  if (!plan) return err(404, 'Not found')
  if ((plan as { trainee_id: string }).trainee_id !== ctx.traineeId) {
    return err(404, 'Not found')
  }

  const row: Record<string, unknown> = {
    agency_id: ctx.agencyId,
    trainee_id: ctx.traineeId,
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
    console.error('[trainer/my-plan] insert error:', error.message)
    return err(500, 'Insert failed')
  }
  return NextResponse.json(
    { log_id: (data as { id: string }).id },
    { status: 201 },
  )
}

async function handleUpdateLog(
  sb: SupabaseClient,
  ctx: TraineeCtx,
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

  // Scope the update to this trainee — never trust log_id alone.
  const { data, error } = await sb
    .from('koto_fitness_workout_logs')
    .update(update)
    .eq('id', logId)
    .eq('trainee_id', ctx.traineeId)
    .eq('agency_id', ctx.agencyId)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[trainer/my-plan] update error:', error.message)
    return err(500, 'Update failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

// ── update_intake — trainee edits any of their own intake fields ─────────
// Accepts a partial patch of IntakeInput fields.  validateIntakePartial
// enforces per-field validity without requiring every field (so the trainee
// can correct one thing at a time).  body.trainee_id is ignored — the
// update is ALWAYS scoped to ctx.traineeId from the JWT.
async function handleUpdateIntake(
  sb: SupabaseClient,
  ctx: TraineeCtx,
  body: Record<string, unknown>,
) {
  const { validateIntakePartial } = await import('../../../../lib/trainer/intakeSchema')
  const patchInput = (body.patch ?? body) as Record<string, unknown>
  const result = validateIntakePartial(patchInput)
  if (!result.ok) {
    return err(400, 'Validation failed', { field_errors: result.errors })
  }
  if (Object.keys(result.data).length === 0) {
    return err(400, 'No fields to update')
  }
  const { error } = await sb
    .from('koto_fitness_trainees')
    .update(result.data)
    .eq('id', ctx.traineeId)
    .eq('agency_id', ctx.agencyId)
  if (error) {
    console.error('[trainer/my-plan] update_intake error:', error.message)
    return err(500, 'Update failed')
  }
  return NextResponse.json({ ok: true, patched: Object.keys(result.data) })
}

// ── delete_my_account — full cascade delete, self-service ─────────────────
// Hard-deletes every trainee-scoped row the trainee owns:
//   - koto_fitness_workout_logs (their set logs)
//   - koto_fitness_plans        (all block rows)
//   - koto_fitness_trainees     (the intake row)
//   - koto_fitness_trainee_users (auth mapping)
//   - auth.users                (Supabase auth account)
//
// Service-role cascade.  The trainee is signed out as a side effect of the
// auth user being deleted; client clears its own session.
async function handleDeleteMyAccount(sb: SupabaseClient, ctx: TraineeCtx) {
  const { traineeId, agencyId, userId } = ctx
  const failures: string[] = []

  // Best-effort: delete children first, then parents.
  const steps: Array<[string, () => PromiseLike<{ error?: { message: string } | null }>]> = [
    ['workout_logs', () => sb.from('koto_fitness_workout_logs').delete().eq('trainee_id', traineeId).eq('agency_id', agencyId)],
    ['plans',        () => sb.from('koto_fitness_plans').delete().eq('trainee_id', traineeId).eq('agency_id', agencyId)],
    ['trainees',     () => sb.from('koto_fitness_trainees').delete().eq('id', traineeId).eq('agency_id', agencyId)],
    ['mapping',      () => sb.from('koto_fitness_trainee_users').delete().eq('trainee_id', traineeId).eq('agency_id', agencyId)],
  ]
  for (const [label, run] of steps) {
    try {
      const { error } = await run()
      if (error) failures.push(`${label}:${error.message}`)
    } catch (e) {
      failures.push(`${label}:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Finally, delete the auth user.  If the mapping row is already gone the
  // JWT will continue to resolve to no trainee — so the user is effectively
  // locked out even if this step fails.
  if (userId && userId !== 'bypass-user') {
    try {
      const { error } = await sb.auth.admin.deleteUser(userId)
      if (error) failures.push(`auth_user:${error.message}`)
    } catch (e) {
      failures.push(`auth_user:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (failures.length > 0) {
    console.error('[trainer/my-plan] delete_my_account partial failures:', failures)
    return NextResponse.json({ ok: true, partial: true, failures })
  }
  return NextResponse.json({ ok: true })
}

// ── get_progress_history — weight check-ins + volume by date ──────────────
async function handleGetProgressHistory(sb: SupabaseClient, ctx: TraineeCtx) {
  // Weight check-ins from koto_fitness_progress
  const { data: weightHistory } = await sb
    .from('koto_fitness_progress')
    .select('id, weight_kg, notes, checked_in_at, created_at')
    .eq('trainee_id', ctx.traineeId)
    .eq('agency_id', ctx.agencyId)
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({
    weight_history: weightHistory ?? [],
  })
}

// ── log_progress — trainee records a weight check-in ─────────────────────
async function handleLogProgress(
  sb: SupabaseClient,
  ctx: TraineeCtx,
  body: Record<string, unknown>,
) {
  const weightKg =
    typeof body.weight_kg === 'number' ? body.weight_kg : Number(body.weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return err(400, 'weight_kg must be a positive number')
  }
  const notes = typeof body.notes === 'string' ? body.notes : null

  const { data, error } = await sb
    .from('koto_fitness_progress')
    .insert({
      trainee_id: ctx.traineeId,
      agency_id: ctx.agencyId,
      weight_kg: weightKg,
      notes,
      checked_in_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[trainer/my-plan] log_progress error:', error.message)
    return err(500, 'Insert failed')
  }
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
