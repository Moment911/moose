import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import { buildIntakeChatPrompt } from '../../../../lib/trainer/prompts/intakeChat'
import { streamSonnetChat } from '../../../../lib/trainer/streamSonnet'
import { missingIntakeFields } from '../../../../lib/trainer/intakeCompleteness'
import type { IntakeInput } from '../../../../lib/trainer/intakeSchema'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/intake-chat-token
//
// Token-based variant of intake-chat.  Authenticates via trainee_id in the
// request body (no JWT required).  Used by /intake/:traineeId — the unique
// link a trainer sends to their client.
//
// On each turn:
//   1. Validates trainee_id exists in koto_fitness_trainees
//   2. Streams the AI response (same as intake-chat)
//   3. Saves extracted fields back to the trainee row (real-time progress)
//   4. Updates status to 'intake_started' if still in initial state
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

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

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Validate trainee exists.
  const { data: trainee, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('id, agency_id, status, full_name')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !trainee) return err(404, 'Trainee not found')

  const agencyId = (trainee as { agency_id: string }).agency_id
  const traineeStatus = (trainee as { status: string }).status

  // Mark as started if this is their first chat turn.
  if (traineeStatus === 'new' || traineeStatus === 'intake_pending') {
    void sb
      .from('koto_fitness_trainees')
      .update({ status: 'intake_started' })
      .eq('id', traineeId)
      .then()
  }

  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role: string; content: string }> : []
  const extracted = (body.extracted && typeof body.extracted === 'object')
    ? body.extracted as Partial<IntakeInput>
    : {}

  for (const m of messages) {
    if (typeof m.role !== 'string' || typeof m.content !== 'string') {
      return err(400, 'Each message must have role and content strings')
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return err(400, 'Message role must be "user" or "assistant"')
    }
  }

  // Save current extracted fields to the trainee row (real-time progress).
  if (Object.keys(extracted).length > 0) {
    const updatePayload: Record<string, unknown> = {}
    const allowedFields = [
      'full_name', 'age', 'sex', 'height_cm', 'current_weight_kg', 'target_weight_kg',
      'primary_goal', 'training_experience_years', 'training_days_per_week', 'equipment_access',
      'medical_flags', 'injuries', 'dietary_preference', 'allergies', 'sleep_hours_avg',
      'stress_level', 'occupation_activity', 'meals_per_day', 'about_you',
    ]
    for (const k of allowedFields) {
      if (k in extracted && (extracted as Record<string, unknown>)[k] !== undefined && (extracted as Record<string, unknown>)[k] !== null) {
        updatePayload[k] = (extracted as Record<string, unknown>)[k]
      }
    }
    if (Object.keys(updatePayload).length > 0) {
      void sb
        .from('koto_fitness_trainees')
        .update(updatePayload)
        .eq('id', traineeId)
        .then()
    }
  }

  const missing = missingIntakeFields(extracted)
  const turnCount = messages.filter((m) => m.role === 'user').length
  const services = Array.isArray(body.services) ? body.services as string[] : ['training']

  const { systemPrompt, tools } = buildIntakeChatPrompt({
    extracted,
    missingFields: missing,
    turnCount,
    services,
  })

  const stream = streamSonnetChat({
    featureTag: FEATURE_TAGS.INTAKE_CHAT,
    systemPrompt,
    tools,
    messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    agencyId,
    maxTokens: 1024,
    metadata: { trainee_id: traineeId, stage: 'intake_chat_token', turn: turnCount },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
