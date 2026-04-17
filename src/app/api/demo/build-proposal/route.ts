import { NextRequest } from 'next/server'

/**
 * Streaming proposal generator. Given a business profile (name, industry,
 * budget, goal, city), Claude composes a full 6-section agency proposal
 * and streams it back as plain-text chunks. The system prompt keeps the
 * structure tight so the client can render Markdown sections as they arrive.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const ANTHROPIC_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

const SYSTEM_PROMPT = `You are a senior strategist at Koto, a marketing + custom-AI agency. You write proposals that get signed.

A prospective client has given you a short profile of their business. Write a complete, sales-ready proposal in Markdown using exactly these six ## sections, in this order:

## 1. Executive summary
Two short paragraphs. Open with the single most compelling outcome this business can expect in the first 90 days (specific and believable — e.g. "By day 90: 40–60 booked consults/month at a blended $185 CPL.") Then one paragraph naming the two or three highest-leverage tactics we'll run, and why they fit this business specifically.

## 2. Situation analysis
Three short bullets naming the honest constraints and opportunities this business likely faces in the given industry + budget range. Concrete and specific. No vague platitudes. Example: "At $6k/mo, paid search will be starved in competitive GEOs — we'll blend it with organic social retargeting to stretch each dollar."

## 3. Proposed strategy
Three prongs, each as a bold-leading mini-paragraph (3–4 lines). Label them for this industry — e.g. "Demand capture", "Trust layer", "Retention & LTV." Each prong explains the move, the expected timeline to impact, and the primary metric.

## 4. Scope & deliverables
Three tiers — Starter, Growth, Scale. For each tier:
- **Tier name · $X/mo** (price the Starter tier to just fit inside the prospect's stated monthly budget; Growth at ~2× that; Scale at ~3.5×)
- 4–5 specific deliverables — specific channels, cadences, quantities. No filler like "social media management." Instead: "12 channel-native short-form videos / mo, 2 creative iterations per top performer."
- One sentence explaining which business situation each tier best fits.

Recommend one tier as the best starting point, given the prospect's budget and industry. Call it out in bold below the three tiers.

## 5. ROI projection
A markdown table with these columns: **Metric | Month 1 | Month 3 | Month 6**. Include at least these rows, with realistic industry-grounded ranges: Leads / mo, Cost per lead, Booked appointments / mo, Close rate, Revenue attributable.

Use ranges ("45–60") instead of false-precision numbers. Below the table, one sentence plainly noting these are Koto benchmarks for this industry + budget, not guarantees.

## 6. Next steps
Three numbered steps, each one sentence:
1. 20-minute scoping call this week (we quote live)
2. Kickoff + onboarding in week 1 (we co-build the campaign brief)
3. First campaigns launched by end of week 2

Rules:
- Be specific and believable. Use details from the prospect's business, not generic placeholder text.
- No invented client testimonials, named brands, or fake stats.
- Use the prospect's actual business name and city/industry when provided.
- Currency is USD, formatted with commas (e.g., $4,500/mo).
- No emojis. No "we'd love to help" / "exciting opportunity" fluff.
- Total length 700–1100 words.
- Never break character.`

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'Anthropic key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    business?: string
    industry?: string
    budget?: number | string
    goal?: string
    city?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const business = (body.business || '').trim().slice(0, 200)
  const industry = (body.industry || '').trim().slice(0, 100)
  const goal = (body.goal || '').trim().slice(0, 400)
  const city = (body.city || '').trim().slice(0, 100)
  const budget = Number(body.budget) || 0

  if (!business || business.length < 2) {
    return new Response(JSON.stringify({ error: 'Business name is required.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!industry || industry.length < 2) {
    return new Response(JSON.stringify({ error: 'Industry is required.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!budget || budget < 500 || budget > 500_000) {
    return new Response(JSON.stringify({ error: 'Monthly budget must be between $500 and $500,000.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const userMessage = [
    `Business name: ${business}`,
    `Industry: ${industry}`,
    city ? `City / market: ${city}` : '',
    `Monthly marketing budget: $${budget.toLocaleString()} USD`,
    goal ? `Primary goal: ${goal}` : 'Primary goal: not provided — infer the most likely one from the industry and make it explicit in the Situation Analysis.',
  ].filter(Boolean).join('\n')

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
      max_tokens: 3200,
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

          let idx
          while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
            const block = sseBuffer.slice(0, idx)
            sseBuffer = sseBuffer.slice(idx + 2)

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
              } catch {
                // skip malformed
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
