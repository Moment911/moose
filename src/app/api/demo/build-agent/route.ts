import { NextRequest } from 'next/server'

/**
 * Streaming agent-spec generator. Takes a 1–3 sentence business
 * description and streams a Claude-written agent specification back
 * as plain-text chunks (the Anthropic Messages SSE stream, filtered
 * to just the text deltas).
 *
 * Client reads the stream incrementally and renders markdown as it
 * arrives — the visible "typing" effect is what sells the demo.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

const SYSTEM_PROMPT = `You are a senior AI engineer at Koto, an agency that ships custom AI voice + chat agents for real businesses. A prospective client has just described their business. Produce a complete, production-grade agent specification the Koto team could build from directly.

Write in Markdown using exactly these six ## sections in this order:

## 1. Agent persona
Two or three fields:
- **Name:** a real-sounding first name (not a made-up robot name)
- **Voice:** voice direction — age, tone, warmth level, pace
- **Personality:** two or three sentence paragraph describing disposition, acknowledgement style, and how the agent handles frustration

## 2. Core responsibilities
4–6 bullets. Each bullet is a specific outcome the agent is responsible for. No fluff — e.g. "Book qualified new-patient appointments for the Invisalign consultant", not "help with scheduling".

## 3. System prompt (production-ready)
A real system prompt you'd drop into a Retell LLM or Claude tool-use call. 8–14 short instructions. Include: identity, scope, call flow, when to collect PII, when to escalate to a human, rules about not making up prices/policies.

## 4. Tool schemas
3–5 tools the agent would call. For each:
- **\`tool_name_snake_case\`** — one-sentence description · inputs: list 3–5 typed inputs in parens (e.g. \`name: string\`, \`phone: string\`, \`preferred_date: date\`).

## 5. Sample call transcript
6–10 lines of realistic dialogue showing the agent in action. Format as \`**Caller:**\` and \`**Agent:**\` alternating. Pick a realistic scenario for this business. Show the agent using at least one tool (mention the tool call inline like \`[calls book_appointment]\`). End with a clear outcome.

## 6. Deployment
Three short paragraphs labeled with bold leads:
- **Channel:** voice, chat, or both — with a one-line reason.
- **Model routing:** which model(s) and why (Claude for reasoning, GPT-4o for fast chat, Mistral for classification, etc.)
- **Estimated cost per interaction:** a realistic range in USD based on typical call length / message count, with a one-line assumption.

Rules:
- Be specific and believable. Use details from the described business, not generic placeholder text.
- No invented prices, insurance acceptance, or policies — if pricing comes up, use "$X" placeholder or "per your rate card".
- No emojis. No superlatives ("amazing", "best-in-class").
- Total length 500–900 words.
- Never break character as a senior engineer writing a real spec.`

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'Anthropic key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { description?: string; industry?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const description = (body.description || '').trim()
  const industry = (body.industry || '').trim()
  if (!description || description.length < 20) {
    return new Response(JSON.stringify({ error: 'Please describe your business in at least a sentence or two (20+ characters).' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (description.length > 1200) {
    return new Response(JSON.stringify({ error: 'Keep the description under 1200 characters — no need to write us a novel.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const userMessage =
    industry
      ? `Industry: ${industry}\n\nBusiness description:\n${description}`
      : `Business description:\n${description}`

  // Call Anthropic with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2400,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!anthropicRes.ok || !anthropicRes.body) {
    const data = await anthropicRes.json().catch(() => ({}))
    return new Response(JSON.stringify({ error: data?.error?.message || `Claude error ${anthropicRes.status}` }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Transform Anthropic's SSE into plain text-delta chunks that the
  // client can append to a buffer without SSE parsing on its side.
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let sseBuffer = ''

  const output = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sseBuffer += decoder.decode(value, { stream: true })

          // SSE framing — split on blank lines (event boundaries)
          let idx
          while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
            const block = sseBuffer.slice(0, idx)
            sseBuffer = sseBuffer.slice(idx + 2)

            // Each block has one or more "field: value" lines. We only
            // care about "data: {...}" lines that carry text deltas.
            const dataLines = block.split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())

            for (const line of dataLines) {
              if (!line || line === '[DONE]') continue
              try {
                const evt = JSON.parse(line)
                if (
                  evt.type === 'content_block_delta' &&
                  evt.delta?.type === 'text_delta' &&
                  typeof evt.delta.text === 'string'
                ) {
                  controller.enqueue(encoder.encode(evt.delta.text))
                }
                // Silently ignore non-text events (message_start, etc.)
              } catch {
                // Malformed line — skip
              }
            }
          }
        }
        controller.close()
      } catch (e: any) {
        controller.error(e)
      }
    },
  })

  return new Response(output, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
