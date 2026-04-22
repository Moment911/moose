import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySession } from '../../../../lib/apiAuth'
import {
  assertFitnessCoachEnabled,
  isFeatureDisabledError,
} from '../../../../lib/trainer/featureFlag'
import { provisionTrainee } from '../../../../lib/trainer/provisionTrainee'
import { sendTraineeInvite } from '../../../../lib/trainer/traineeInvite'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — POST /api/trainer/invite
//
// Four-action JSON dispatcher for the trainee invite lifecycle:
//   send_invite / resend_invite / revoke_invite / get_invite_status
//
// Mirrors /api/trainer/trainees + /api/trainer/workout-logs:
//   1. verifySession FIRST — agencyId from session, NEVER from body.
//   2. assertFitnessCoachEnabled — feature-flag gate (404 on disabled).
//   3. ALLOWED_ACTIONS frozen const.
//   4. Cross-agency trainee lookup → 404 (NOT 403 — link-enumeration rule).
//
// revoke_invite sets status=revoked but does NOT delete the auth user.
// Rationale: a trainee may be re-invited later; keeping the auth row
// preserves their magic-link history + lets us re-fire an invite email
// without the provisionTrainee "listUsers" step finding a stale row.
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
  'send_invite',
  'resend_invite',
  'revoke_invite',
  'get_invite_status',
] as const

type Action = (typeof ALLOWED_ACTIONS)[number]

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

const INVITE_SELECT = [
  'id',
  'agency_id',
  'trainee_id',
  'user_id',
  'invite_email',
  'invite_status',
  'invite_sent_at',
  'invite_accepted_at',
  'disclaimer_ack_at',
  'created_at',
  'updated_at',
].join(', ')

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
    if (action === 'send_invite') return await handleSend(sb, agencyId, body, false)
    if (action === 'resend_invite') return await handleSend(sb, agencyId, body, true)
    if (action === 'revoke_invite') return await handleRevoke(sb, agencyId, body)
    if (action === 'get_invite_status') return await handleStatus(sb, agencyId, body)
    return err(400, 'Unknown action')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[trainer/invite] dispatch error:', msg)
    return err(500, 'Internal error')
  }
}

// ── Shared: load trainee, cross-agency safe ─────────────────────────────────
async function loadTrainee(
  sb: SupabaseClient,
  agencyId: string,
  traineeId: string,
): Promise<{ id: string; email: string | null; full_name: string | null } | null> {
  const { data, error } = await sb
    .from('koto_fitness_trainees')
    .select('id, email, full_name')
    .eq('id', traineeId)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (error) {
    console.error('[trainer/invite] trainee lookup error:', error.message)
    return null
  }
  return (data as { id: string; email: string | null; full_name: string | null }) ?? null
}

// ── send_invite / resend_invite — same handler, different semantics ────────
//
// send_invite + resend_invite share a flow: provision the auth user +
// mapping row, then send the magic-link email. The only difference is the
// expected state — send_invite from a 'pending' row, resend_invite from an
// 'invited'/'bounced'/'revoked' row — but we don't hard-enforce that, since
// "resend right after send" is a common failure-recovery path and failing
// is more hostile than just re-sending.
async function handleSend(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
  isResend: boolean,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')
  if (!trainee.email) {
    return err(400, 'Trainee has no email on file — add one before inviting.')
  }

  // 1. Ensure auth user + mapping row exist.
  let provision
  try {
    provision = await provisionTrainee({
      agencyId,
      traineeId: trainee.id,
      email: trainee.email,
      fullName: trainee.full_name || undefined,
    })
  } catch (e) {
    console.error('[trainer/invite] provision failed:', (e as Error).message)
    return err(500, 'Provision failed')
  }

  // 2. Send the magic-link email.
  try {
    await sendTraineeInvite({
      userId: provision.userId,
      email: trainee.email,
      agencyId,
      traineeId: trainee.id,
      traineeName: trainee.full_name || undefined,
    })
  } catch (e) {
    // Log + mark the row as bounced so the dashboard shows the failure.
    console.error('[trainer/invite] send failed:', (e as Error).message)
    await sb
      .from('koto_fitness_trainee_users')
      .update({ invite_status: 'bounced' })
      .eq('trainee_id', trainee.id)
      .eq('agency_id', agencyId)
    return err(500, 'Send failed')
  }

  // 3. Mark the mapping row as invited.
  const { error: updErr } = await sb
    .from('koto_fitness_trainee_users')
    .update({
      invite_status: 'invited',
      invite_sent_at: new Date().toISOString(),
      invite_email: trainee.email,
    })
    .eq('trainee_id', trainee.id)
    .eq('agency_id', agencyId)
  if (updErr) {
    console.error('[trainer/invite] status update failed:', updErr.message)
    // Email is already out; don't fail the caller. Just log.
  }

  return NextResponse.json({ ok: true, resent: isResend })
}

async function handleRevoke(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const { data, error } = await sb
    .from('koto_fitness_trainee_users')
    .update({ invite_status: 'revoked' })
    .eq('trainee_id', trainee.id)
    .eq('agency_id', agencyId)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[trainer/invite] revoke error:', error.message)
    return err(500, 'Revoke failed')
  }
  if (!data) return err(404, 'Not found')
  return NextResponse.json({ ok: true })
}

async function handleStatus(
  sb: SupabaseClient,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const trainee = await loadTrainee(sb, agencyId, traineeId)
  if (!trainee) return err(404, 'Not found')

  const { data, error } = await sb
    .from('koto_fitness_trainee_users')
    .select(INVITE_SELECT)
    .eq('trainee_id', trainee.id)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (error) {
    console.error('[trainer/invite] status lookup error:', error.message)
    return err(500, 'Status lookup failed')
  }
  if (!data) {
    // No mapping row yet — trainee has never been invited.
    return NextResponse.json({
      status: 'pending',
      invite_sent_at: null,
      invite_accepted_at: null,
      disclaimer_ack_at: null,
    })
  }
  const row = data as unknown as {
    invite_status: string
    invite_sent_at: string | null
    invite_accepted_at: string | null
    disclaimer_ack_at: string | null
  }
  return NextResponse.json({
    status: row.invite_status,
    invite_sent_at: row.invite_sent_at,
    invite_accepted_at: row.invite_accepted_at,
    disclaimer_ack_at: row.disclaimer_ack_at,
  })
}
