import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySession } from '../../../../lib/apiAuth'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'
import {
  validateIntake,
  validateIntakePartial,
  type IntakeInput,
} from '../../../../lib/trainer/intakeSchema'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — POST /api/trainer/trainees
//
// Six-action JSON dispatcher:
//   list / get / create / update / archive / unarchive
//
// Contract mirrors /api/kotoiq/profile/route.ts:
//   1. verifySession FIRST; agencyId comes from session, NEVER from body.
//   2. Feature-flag gate (CONTEXT D-09) — agencies.features.fitness_coach
//      must be true; otherwise 404 (link-enumeration mitigation, NOT 403).
//   3. Unknown action → 400.
//   4. Cross-agency trainee lookup → 404 (NOT 403).
//   5. Intake validation errors → 400 with per-field messages.
//
// Agency scoping: no kotoiqDb helper yet (CONTEXT D-19 — Phase 1 uses raw
// supabase + explicit .eq('agency_id', agencyId)).  A trainerDb helper
// can land in a future plan if call sites proliferate.
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
  'list',
  'get',
  'create',
  'update',
  'archive',
  'unarchive',
  'delete',
] as const

type Action = (typeof ALLOWED_ACTIONS)[number]

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

// Columns we expose to the client.  Denormalizing explicitly keeps the
// dispatcher decoupled from migration column shuffles.
const TRAINEE_SELECT = [
  'id',
  'agency_id',
  'full_name',
  'email',
  'phone',
  'age',
  'sex',
  'height_cm',
  'current_weight_kg',
  'target_weight_kg',
  'primary_goal',
  'training_experience_years',
  'training_days_per_week',
  'equipment_access',
  'medical_flags',
  'injuries',
  'pregnancy_or_nursing',
  'dietary_preference',
  'allergies',
  'grocery_budget_usd_per_week',
  'meals_per_day',
  'sleep_hours_avg',
  'stress_level',
  'occupation_activity',
  'trainer_notes',
  'status',
  'archived_at',
  'created_at',
  'updated_at',
].join(', ')

export async function POST(req: NextRequest) {
  // 1. Auth — agencyId from session, never body
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

  // 3. Feature-flag gate — 404 on disabled (not 403, per link-enumeration rule)
  try {
    await assertFitnessCoachEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    // Anything else is an unexpected lookup failure
    return err(500, 'Feature gate check failed')
  }

  // 4. Dispatch
  try {
    if (action === 'list') return await handleList(sb, agencyId, body)
    if (action === 'get') return await handleGet(sb, agencyId, body)
    if (action === 'create') return await handleCreate(sb, agencyId, body)
    if (action === 'update') return await handleUpdate(sb, agencyId, body)
    if (action === 'archive') return await handleArchive(sb, agencyId, body)
    if (action === 'unarchive') return await handleUnarchive(sb, agencyId, body)
    if (action === 'delete') return await handleDelete(sb, agencyId, body)
    // Exhaustiveness — TS narrows action; this is unreachable
    return err(400, 'Unknown action')
  } catch (e) {
    // Don't leak internal details to the client
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[trainer/trainees] dispatch error:', msg)
    return err(500, 'Internal error')
  }
}

// ── Action handlers ─────────────────────────────────────────────────────────

async function handleList(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const archived = body.archived === true // default false
  let q = sb
    .from('koto_fitness_trainees')
    .select(TRAINEE_SELECT)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (!archived) {
    q = q.is('archived_at', null)
  }

  const { data, error } = await q
  if (error) {
    console.error('[trainer/trainees] list error:', error.message)
    return err(500, 'List failed')
  }
  return NextResponse.json({ trainees: data ?? [] })
}

async function handleGet(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .select(TRAINEE_SELECT)
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (error) {
    console.error('[trainer/trainees] get error:', error.message)
    return err(500, 'Get failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ trainee: data })
}

async function handleCreate(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  // body itself IS the intake payload (plus 'action' which we ignore here).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { action: _a, agency_id: _ignoredAgencyId, ...payload } = body
  const result = validateIntake(payload)
  if (!result.ok) {
    return err(400, 'Invalid intake', { field_errors: result.errors })
  }

  const row: IntakeInput & { agency_id: string } = {
    ...result.data,
    agency_id: agencyId, // always from session, never from body
  }

  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('[trainer/trainees] create error:', error.message)
    return err(500, 'Create failed')
  }
  return NextResponse.json({ trainee_id: (data as { id: string }).id }, { status: 201 })
}

async function handleUpdate(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const patch = body.patch
  if (typeof patch !== 'object' || patch === null) {
    return err(400, 'patch object required')
  }

  const result = validateIntakePartial(patch)
  if (!result.ok) {
    return err(400, 'Invalid patch', { field_errors: result.errors })
  }

  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .update(result.data)
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[trainer/trainees] update error:', error.message)
    return err(500, 'Update failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

async function handleArchive(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .update({ archived_at: new Date().toISOString(), status: 'archived' })
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[trainer/trainees] archive error:', error.message)
    return err(500, 'Archive failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

async function handleUnarchive(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Phase 1: unarchive always resets status to intake_complete.  Phase 2
  // may refine this to check whether a plan exists → plan_generated.
  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .update({ archived_at: null, status: 'intake_complete' })
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[trainer/trainees] unarchive error:', error.message)
    return err(500, 'Unarchive failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

// Hard delete — cascades plans + workout_logs (FK ON DELETE CASCADE) and
// explicitly removes the trainee_user mapping + any invite tokens that
// tie this row to an auth user. Agency-scoped every step — a trainer
// from a different agency cannot delete rows they don't own.
async function handleDelete(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Verify the trainee belongs to this agency before any delete runs.
  const { data: existing, error: lookupErr } = await sb
    .from('koto_fitness_trainees')
    .select('id')
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (lookupErr) {
    console.error('[trainer/trainees] delete lookup error:', lookupErr.message)
    return err(500, 'Delete lookup failed')
  }
  if (!existing) return err(404, 'Not found')

  // Best-effort: remove the auth mapping row so any existing session is
  // orphaned (the trainee can no longer sign into /my-plan). FK cascade
  // from koto_fitness_plans handles the plan + workout_logs cleanup.
  await sb
    .from('koto_fitness_trainee_users')
    .delete()
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)

  const { error: delErr } = await sb
    .from('koto_fitness_trainees')
    .delete()
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
  if (delErr) {
    console.error('[trainer/trainees] delete error:', delErr.message)
    return err(500, 'Delete failed')
  }
  return NextResponse.json({ ok: true })
}
