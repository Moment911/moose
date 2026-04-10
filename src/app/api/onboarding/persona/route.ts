import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side proxy for the onboarding form's persona generator.
 * Runs Claude with the server's ANTHROPIC_API_KEY so the key is never
 * shipped in the browser bundle.
 *
 * Preserves the exact rich schema the OnboardingPage persona viewer
 * expects (persona_name, tagline, age_range, triggers, fears,
 * google_keywords, ad_headline_angles, trust_signals, etc.) so the
 * existing parser in generatePersona() keeps working unchanged.
 *
 * Accepts:
 *   { ctx: { business, industry, city, state, ... }, welcome_statement? }
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const ctx = (body && body.ctx && typeof body.ctx === 'object') ? body.ctx : {}
  const welcomeStatement: string = body?.welcome_statement
    ? String(body.welcome_statement).trim()
    : ''

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ text: null, error: 'AI not configured' })
  }

  const welcomeBlock = welcomeStatement
    ? `\n\nThe client described their business in their own words: "${welcomeStatement}"\nUse this as the primary foundation of the persona — it's the highest-signal context available.`
    : ''

  const system = 'You are a senior marketing strategist with 20 years in PPC, SEO, and AEO. Generate a vivid, specific, actionable client persona. Be detailed and confident. Return ONLY valid JSON.'

  const userMessage = `Generate a comprehensive marketing persona for this business: ${JSON.stringify(ctx, null, 2)}${welcomeBlock}

Return ONLY valid JSON (no markdown) with EXACTLY these keys:
{
  "persona_name": "Memorable name like 'Stressed-Out Sarah' or 'Renovation Randy'",
  "tagline": "One punchy sentence describing them",
  "age_range": "e.g. 35-54",
  "gender": "e.g. 60% female, 40% male",
  "income": "e.g. $75K-$150K household",
  "education": "e.g. College-educated homeowners",
  "location_type": "e.g. Suburban homeowners, Miami-Dade / Broward",
  "psychographic_summary": "3-4 sentences about their mindset, values, lifestyle",
  "triggers": ["What specific event triggers them to search for this service (3-5 items)"],
  "fears": ["Their biggest fears/objections when hiring (3-4 items)"],
  "decision_factors": ["What makes them choose one provider over another (4-5 items)"],
  "online_behavior": "Where they spend time online and how they search",
  "google_keywords": ["10 high-intent keywords they type into Google"],
  "facebook_interests": ["8-10 Facebook targeting interests"],
  "ad_headline_angles": ["5 different ad headline approaches that would stop them scrolling"],
  "pain_point_hooks": ["3-4 pain-point-led ad hooks (start with the pain)"],
  "trust_signals": ["5 things that build instant trust with this persona"],
  "best_channels": ["Top 3-4 marketing channels ranked by priority for this persona"],
  "content_themes": ["5 content topics that would engage this persona"],
  "do_not": ["3-4 things that would immediately turn this persona off"]
}`

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
        max_tokens: 2500,
        temperature: 0.5,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      return NextResponse.json({ text: null, error: `Claude ${res.status}` })
    }

    const data: any = await res.json()
    const text: string = (data.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()

    return NextResponse.json({ text: text || null })
  } catch (e: any) {
    return NextResponse.json({ text: null, error: e?.message || 'failed' })
  }
}
