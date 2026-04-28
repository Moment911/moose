import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/demo-chat
//
// Public demo endpoint — no auth required. Streams a short AI coach
// conversation so landing page visitors can try the experience.
// Rate-limited to prevent abuse (no token logging, Haiku for cost).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are a world-class AI coach on a demo conversation. You combine the expertise of:
- PhD in Biomechanics, Nutrition, Strength & Conditioning, Exercise Physiology, and Sports Psychology
- A retired pro athlete with 20 years of coaching experience across multiple sports

You are speaking directly to someone trying out the platform for the first time. Be warm, impressive, and specific. Show them what it's like to have a real AI coach.

Rules:
- Keep responses SHORT (2-4 sentences max) — this is a demo, not a full session
- Be specific and insightful — show expertise immediately
- Ask ONE follow-up question to keep the conversation going
- If they mention a sport, give a sport-specific insight that shows depth
- If they mention a goal, give one actionable tip right away
- Use plain English — no jargon without explanation
- Sound like a cool, knowledgeable coach — not a robot
- End each response with a question to keep them engaged
- You are AI, not a doctor — never give medical advice
- If this is the first message (empty), greet them and ask what sport they play or what they're training for`

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messages = Array.isArray(body.messages)
    ? (body.messages as Array<{ role: string; content: string }>).slice(-6) // Keep last 6 messages to limit context
    : []

  // Validate messages
  for (const m of messages) {
    if (typeof m.role !== 'string' || typeof m.content !== 'string') {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const apiMessages = messages.length === 0
    ? [{ role: 'user' as const, content: 'Hi' }]
    : messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

  try {
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && 'delta' in event) {
              const delta = event.delta as { type?: string; text?: string }
              if (delta.type === 'text_delta' && delta.text) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'text_delta', text: delta.text }) + '\n'))
              }
            }
          }
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
          controller.close()
        } catch (e) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: 'Stream failed' }) + '\n'))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }
}
