import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  assertFourrMethodEnabled,
  isFeatureDisabledError,
} from '../../../../lib/fourr/featureFlag'
import { processChatTurn } from '../../../../lib/fourr/chatEngine'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fourr/chat
//
// Conversational intake endpoint.  Each POST is one chat turn:
//   - First call (no userMessage): creates patient row, returns greeting
//   - Subsequent calls: processes user message, extracts fields, returns
//     next question
//
// Auth: Bearer JWT (any Supabase user — pre-patient-row on first call)
// Body: { message?: string }  (null/undefined for first greeting turn)
// Response: { assistant_message, extracted_count, total_required, is_complete }
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

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
): Promise<{ ok: true; userId: string; email: string; fullName?: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  return {
    ok: true,
    userId: data.user.id,
    email: (data.user.email || '').toLowerCase(),
    fullName: (data.user.user_metadata?.full_name as string) || undefined,
  }
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  const agencyId = process.env.DEFAULT_FOURR_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  try {
    await assertFourrMethodEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  const auth = await resolveUser(req, sb)
  if (!auth.ok) return err(auth.status, auth.error)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // Empty body is ok for the greeting turn
  }

  const userMessage = typeof body.message === 'string' && body.message.trim().length > 0
    ? body.message.trim()
    : null

  const result = await processChatTurn({
    sb,
    agencyId,
    userId: auth.userId,
    email: auth.email,
    patientName: auth.fullName,
    userMessage,
  })

  if (!result.ok) {
    return err(502, result.error)
  }

  return NextResponse.json({
    assistant_message: result.assistant_message,
    extracted_count: result.extracted_count,
    total_required: result.total_required,
    is_complete: result.is_complete,
    fields_extracted_this_turn: result.fields_extracted_this_turn,
    patient_id: result.patient_id,
  })
}
