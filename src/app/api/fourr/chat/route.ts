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
// Anonymous-first conversational intake.  No auth required.
//   - Identified by session_id (client-generated UUID stored in localStorage)
//   - First call creates patient row, returns greeting
//   - Subsequent calls process user message, extract fields, return next question
//   - AI collects name + email naturally during conversation
//
// Body: { session_id: string, message?: string }
// Response: { assistant_message, extracted_count, total_required, is_complete }
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_AGENCY_FALLBACK = '09ac0024-2634-4f52-8a68-b9b8fedc26bf'

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
  const agencyId = process.env.DEFAULT_FOURR_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  try {
    await assertFourrMethodEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
  if (!sessionId || sessionId.length < 10) {
    return err(400, 'session_id is required')
  }

  const userMessage = typeof body.message === 'string' && body.message.trim().length > 0
    ? body.message.trim()
    : null

  const result = await processChatTurn({
    sb,
    agencyId,
    sessionId,
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
