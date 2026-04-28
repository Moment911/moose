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
  'get_progress_photos',
  'upload_progress_photo',
  'get_body_measurements',
  'log_body_measurements',
  'get_insights',
  'generate_weekly_insight',
  'get_weight_history',
  'log_weight',
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
    // Progress tracking actions
    if (action === 'get_progress_photos') return handleTrainerPhotos(sb, agencyId, body, 'get')
    if (action === 'upload_progress_photo') return handleTrainerPhotos(sb, agencyId, body, 'upload')
    if (action === 'get_body_measurements') return handleTrainerMeasurements(sb, agencyId, body, 'get')
    if (action === 'log_body_measurements') return handleTrainerMeasurements(sb, agencyId, body, 'log')
    if (action === 'get_insights') return handleTrainerInsights(sb, agencyId, body, 'get')
    if (action === 'generate_weekly_insight') return handleTrainerInsights(sb, agencyId, body, 'generate')
    if (action === 'get_weight_history') return handleTrainerWeight(sb, agencyId, body, 'get')
    if (action === 'log_weight') return handleTrainerWeight(sb, agencyId, body, 'log')
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

// ── Progress tracking handlers (photos, measurements, insights) ──────────

async function handleTrainerPhotos(sb: SupabaseClient, agencyId: string, body: Record<string, unknown>, mode: 'get' | 'upload') {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (mode === 'get') {
    const { data } = await sb.from('koto_fitness_progress_photos').select('id, taken_at, pose, public_url, notes').eq('trainee_id', traineeId).eq('agency_id', agencyId).order('taken_at', { ascending: true }).limit(100)
    return NextResponse.json({ photos: data ?? [] })
  }
  const photoBase64 = typeof body.photo_base64 === 'string' ? body.photo_base64 : ''
  const pose = typeof body.pose === 'string' && ['front','side','back'].includes(body.pose) ? body.pose : 'front'
  if (!photoBase64) return err(400, 'photo_base64 required')
  const buffer = Buffer.from(photoBase64, 'base64')
  const filename = `${traineeId}/${Date.now()}_${pose}.jpg`
  const { error: upErr } = await sb.storage.from('progress-photos').upload(filename, buffer, { contentType: 'image/jpeg' })
  if (upErr) return err(500, 'Upload failed')
  const { data: urlData } = sb.storage.from('progress-photos').getPublicUrl(filename)
  const { data } = await sb.from('koto_fitness_progress_photos').insert({ agency_id: agencyId, trainee_id: traineeId, pose, storage_path: filename, public_url: urlData?.publicUrl, taken_at: new Date().toISOString() }).select('id, public_url').single()
  return NextResponse.json(data, { status: 201 })
}

async function handleTrainerMeasurements(sb: SupabaseClient, agencyId: string, body: Record<string, unknown>, mode: 'get' | 'log') {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (mode === 'get') {
    const { data } = await sb.from('koto_fitness_body_measurements').select('*').eq('trainee_id', traineeId).eq('agency_id', agencyId).order('measured_at', { ascending: true }).limit(200)
    return NextResponse.json({ measurements: data ?? [] })
  }
  const FIELDS = ['chest','waist','hips','shoulders','neck','bicep_left','bicep_right','thigh_left','thigh_right','calf_left','calf_right','forearm_left','forearm_right']
  const row: Record<string, unknown> = { agency_id: agencyId, trainee_id: traineeId, measured_at: new Date().toISOString() }
  let hasAny = false
  for (const f of FIELDS) { const v = body[f]; if (v != null && v !== '') { const n = Number(v); if (Number.isFinite(n) && n > 0) { row[f] = n; hasAny = true } } }
  if (!hasAny) return err(400, 'At least one measurement required')
  const { data } = await sb.from('koto_fitness_body_measurements').insert(row).select('id').single()
  return NextResponse.json(data, { status: 201 })
}

async function handleTrainerInsights(sb: SupabaseClient, agencyId: string, body: Record<string, unknown>, mode: 'get' | 'generate') {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (mode === 'get') {
    const { data } = await sb.from('koto_fitness_ai_insights').select('id, week_of, summary, whats_working, needs_attention, plan_changes, generated_at').eq('trainee_id', traineeId).eq('agency_id', agencyId).order('week_of', { ascending: false }).limit(12)
    return NextResponse.json({ insights: data ?? [] })
  }
  const [tRes, wRes, fRes, sRes] = await Promise.all([
    sb.from('koto_fitness_trainees').select('full_name, age, primary_goal').eq('id', traineeId).maybeSingle(),
    sb.from('koto_fitness_workout_logs').select('id').eq('trainee_id', traineeId).limit(50),
    sb.from('koto_fitness_food_logs').select('total_kcal, total_protein_g').eq('trainee_id', traineeId).order('log_date', { ascending: false }).limit(14),
    sb.from('koto_fitness_progress').select('weight_kg').eq('trainee_id', traineeId).order('checked_in_at', { ascending: false }).limit(1),
  ])
  const t = tRes.data as Record<string, unknown> | null
  const snapshot = { name: t?.full_name, age: t?.age, goal: t?.primary_goal, workouts: (wRes.data??[]).length, weight_lbs: (sRes.data as Array<{weight_kg:number}>)?.[0]?.weight_kg ? Math.round(Number((sRes.data as Array<{weight_kg:number}>)[0].weight_kg)*2.20462) : null }
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  try {
    const r = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: `AI coach weekly review. Plain English, lbs. DATA: ${JSON.stringify(snapshot)}. Return JSON: {summary,whats_working:[],needs_attention:[],plan_changes:[]}. No markdown.` }] })
    const txt = r.content?.[0]?.type === 'text' ? r.content[0].text : '{}'
    let ins: Record<string,unknown> = {}; try { ins = JSON.parse(txt.replace(/```json?\n?/g,'').replace(/```/g,'').trim()) } catch { return err(502,'Parse failed') }
    await sb.from('koto_fitness_ai_insights').insert({ agency_id: agencyId, trainee_id: traineeId, week_of: new Date().toISOString().slice(0,10), summary: ins.summary||'', whats_working: ins.whats_working||[], needs_attention: ins.needs_attention||[], plan_changes: ins.plan_changes||[], data_snapshot: snapshot, model: 'haiku' })
    return NextResponse.json({ insight: ins })
  } catch { return err(502, 'AI failed') }
}

async function handleTrainerWeight(sb: SupabaseClient, agencyId: string, body: Record<string, unknown>, mode: 'get' | 'log') {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')
  if (mode === 'get') {
    const { data } = await sb
      .from('koto_fitness_progress')
      .select('id, weight_kg, notes, checked_in_at, created_at')
      .eq('trainee_id', traineeId)
      .eq('agency_id', agencyId)
      .order('checked_in_at', { ascending: true })
      .limit(100)
    return NextResponse.json({ weight_history: data ?? [] })
  }
  // log
  const weightKg = Number(body.weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) return err(400, 'weight_kg must be a positive number')
  const notes = typeof body.notes === 'string' ? body.notes : null
  const { data, error: insErr } = await sb
    .from('koto_fitness_progress')
    .insert({ agency_id: agencyId, trainee_id: traineeId, weight_kg: weightKg, notes, checked_in_at: new Date().toISOString() })
    .select('id')
    .single()
  if (insErr) {
    console.error('[trainer/trainees] log_weight error:', insErr.message)
    return err(500, 'Save failed')
  }
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
