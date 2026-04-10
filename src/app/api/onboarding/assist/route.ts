import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side proxy for the onboarding form's per-field AI Suggest buttons.
 * Runs Claude with the server's ANTHROPIC_API_KEY so the key is never shipped
 * in the browser bundle (NEXT_PUBLIC_ANTHROPIC_API_KEY is not and should not
 * be set in Vercel).
 *
 * Accepts either shape:
 *   1. { prompt, welcome_statement?, business_context?, industry? }
 *      — pre-built prompt from the <AIAssist> component, server prepends
 *        the welcome_statement + business_context as primary context.
 *   2. { field_name, field_label, current_value, welcome_statement?,
 *         business_context?, industry? }
 *      — structured field payload, server builds the prompt.
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const {
    prompt,
    field_name,
    field_label,
    current_value,
    welcome_statement,
    business_context,
    industry,
  } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggestion: null, error: 'AI not configured' })
  }

  // Build a context preamble from whatever the caller supplied. This runs
  // regardless of whether we got a raw `prompt` or a structured field payload,
  // so the welcome statement always leads.
  const contextLines: string[] = []
  if (welcome_statement && String(welcome_statement).trim()) {
    contextLines.push(`THEIR OWN DESCRIPTION OF THE BUSINESS: "${String(welcome_statement).trim()}"`)
  }
  if (industry) contextLines.push(`Industry: ${industry}`)
  if (business_context && String(business_context).trim()) {
    contextLines.push(`Other known info:\n${String(business_context).trim()}`)
  }
  const contextBlock = contextLines.length ? contextLines.join('\n') + '\n\n' : ''

  // Build the user message — prefer the free-form prompt when provided.
  let userMessage: string
  if (prompt && String(prompt).trim()) {
    userMessage = `${contextBlock}${String(prompt).trim()}`
  } else if (field_label || field_name) {
    userMessage = `${contextBlock}Field to fill: ${field_label || field_name}
Current value (if any): ${current_value || 'empty'}

Suggest a good value for this field based on what you know about this business.`
  } else {
    return NextResponse.json({ suggestion: null, error: 'Missing prompt or field' })
  }

  const system = `You are helping a business owner fill out an onboarding form for their marketing agency. Based on what you know about their business — especially their own-words description if provided — suggest a concise, accurate answer for the specific field they are filling in.

Return only the suggested field value — no explanation, no preamble, no quotes around the answer. Be specific and realistic. If you don't have enough context to suggest a good answer, return an empty string.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return NextResponse.json({ suggestion: null, error: `Claude ${res.status}` })
    }

    const data: any = await res.json()
    const suggestion: string = (data.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()

    return NextResponse.json({ suggestion: suggestion || null })
  } catch (e: any) {
    return NextResponse.json({ suggestion: null, error: e?.message || 'failed' })
  }
}
