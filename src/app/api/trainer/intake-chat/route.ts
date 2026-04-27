import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import { buildIntakeChatPrompt } from '../../../../lib/trainer/prompts/intakeChat'
import { streamSonnetChat } from '../../../../lib/trainer/streamSonnet'
import { missingIntakeFields } from '../../../../lib/trainer/intakeCompleteness'
import type { IntakeInput } from '../../../../lib/trainer/intakeSchema'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/intake-chat
//
// Streaming conversational intake.  Each turn: trainee message in, AI
// response streamed back as NDJSON (text_delta + fields + done events).
//
// Auth: Bearer JWT (same as intake-extract — pre-trainee-row).
// Billing: DEFAULT_SELF_SIGNUP_AGENCY_ID.
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

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return err(401, 'Unauthorized')
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) return err(401, 'Unauthorized')

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role: string; content: string }> : []
  const extracted = (body.extracted && typeof body.extracted === 'object')
    ? body.extracted as Partial<IntakeInput>
    : {}

  // Validate messages — each must have role + content strings.
  for (const m of messages) {
    if (typeof m.role !== 'string' || typeof m.content !== 'string') {
      return err(400, 'Each message must have role and content strings')
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return err(400, 'Message role must be "user" or "assistant"')
    }
  }

  const agencyId = process.env.DEFAULT_SELF_SIGNUP_AGENCY_ID || DEFAULT_AGENCY_FALLBACK
  const missing = missingIntakeFields(extracted)
  const turnCount = messages.filter((m) => m.role === 'user').length
  const mode = typeof body.mode === 'string' ? body.mode : 'onboarding'

  const { systemPrompt, tools } = buildIntakeChatPrompt({
    extracted,
    missingFields: missing,
    turnCount,
    mode: mode as 'onboarding' | 'coaching',
  })

  const stream = streamSonnetChat({
    featureTag: FEATURE_TAGS.INTAKE_CHAT,
    systemPrompt,
    tools,
    messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    agencyId,
    maxTokens: 1024,
    model: 'haiku',
    metadata: { user_id: userData.user.id, stage: mode === 'coaching' ? 'coach_chat' : 'intake_chat', turn: turnCount },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
