import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import { buildCoachChatPrompt } from '../../../../lib/trainer/prompts/coachChat'
import { streamSonnetChat } from '../../../../lib/trainer/streamSonnet'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/coach-chat
//
// Persistent AI coach chat for the trainee detail page.  Loads the full
// trainee record + plan from the DB, then streams a conversational response
// using Haiku for speed.
//
// Body: { trainee_id: string, messages: [{role, content}] }
//
// If the model calls update_profile with field updates, those are saved back
// to the trainee row.
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

  // Load the full trainee record.
  const { data: trainee, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('*')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !trainee) return err(404, 'Trainee not found')

  const agencyId = (trainee as Record<string, unknown>).agency_id as string

  // Load the latest plan (if any).
  const { data: plan } = await sb
    .from('koto_fitness_plans')
    .select('*')
    .eq('trainee_id', traineeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const messages = Array.isArray(body.messages)
    ? (body.messages as Array<{ role: string; content: string }>)
    : []

  for (const m of messages) {
    if (typeof m.role !== 'string' || typeof m.content !== 'string') {
      return err(400, 'Each message must have role and content strings')
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return err(400, 'Message role must be "user" or "assistant"')
    }
  }

  const turnCount = messages.filter((m) => m.role === 'user').length

  const { systemPrompt, tools } = buildCoachChatPrompt({
    trainee: trainee as Record<string, unknown>,
    plan: plan as Record<string, unknown> | null,
  })

  const stream = streamSonnetChat({
    featureTag: FEATURE_TAGS.COACH_CHAT,
    systemPrompt,
    tools,
    messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    agencyId,
    model: 'haiku',
    maxTokens: 2048,
    metadata: { trainee_id: traineeId, stage: 'coach_chat', turn: turnCount },
  })

  // Wrap the stream to intercept tool calls and save field updates.
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  ;(async () => {
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Pass through to client.
        await writer.write(value)

        // Inspect for field updates from the update_profile tool.
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(line) as Record<string, unknown>
          } catch {
            continue
          }

          if (event.type === 'fields' && event.extracted && typeof event.extracted === 'object') {
            const fields = event.extracted as Record<string, unknown>
            if (Object.keys(fields).length > 0) {
              // Save field updates to the trainee row (fire-and-forget).
              void sb
                .from('koto_fitness_trainees')
                .update(fields)
                .eq('id', traineeId)
                .then()
            }
          }
        }
      }
    } catch {
      // Stream read error — close gracefully.
    }
    await writer.close()
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
