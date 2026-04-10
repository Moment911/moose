import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side suggestion endpoint for the onboarding form.
 *
 * A single catch-all proxy that takes a `field` identifier + form context
 * and returns either a string (for plain-text suggestions like a business
 * description) or a JSON-parsed value (for structured lists like SIC codes).
 *
 * Used by the OnboardingPage auto-populate system to make every "hard"
 * field either auto-fill from prior answers or show smart suggestions so
 * the client never stares at a blank field.
 *
 * Runs server-side through ANTHROPIC_API_KEY so the key stays off the
 * browser bundle. Falls through silently on any failure so the form keeps
 * working without AI.
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const {
    field,
    welcome_statement,
    business_name,
    industry,
    city,
    state,
    classification,
    already_filled,
  } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] })
  }

  const context = `
Business: ${business_name || 'Unknown'}
Industry: ${industry || 'Unknown'}
Location: ${city || ''} ${state || ''}
Business model: ${classification?.business_model || 'unknown'} | ${classification?.geographic_scope || 'unknown'}
Welcome statement: "${welcome_statement || 'Not provided'}"
Already filled: ${JSON.stringify(already_filled || {})}
`

  const FIELD_PROMPTS: Record<string, string> = {
    sic_suggestion: `Based on this business description, suggest the 10 most likely SIC codes. Return JSON array only: [{ "code": "1711", "label": "Plumbing, Heating, Air-Conditioning", "confidence": 95, "reason": "Matches HVAC description" }]. Order by confidence descending. Return ONLY the JSON array, no preamble.`,

    business_description: `Write a 2-3 sentence business description for marketing use based on the welcome statement. Make it compelling, specific, and in first person ("we"). Return plain text only — no quotes, no preamble, no markdown.`,

    products_services: `List all likely products and services this business offers based on the context. Be specific and realistic for this industry. Return as a plain text list with one item per line. No numbering, no bullets, no preamble.`,

    top_services: `List the top 5 revenue-driving services for this business. Return JSON array only: ["Service 1", "Service 2", "Service 3", "Service 4", "Service 5"]. Be specific to their industry. No preamble.`,

    ideal_customer: `Write a detailed ideal customer profile for this business. Include: who they are, their situation when they reach out, what they've already tried, what they want. 3-4 sentences. Plain text only, no quotes, no preamble.`,

    pain_points: `List the top 5 customer pain points for ${industry || 'this type of business'}. Be specific and realistic. Return JSON array only: ["Pain point 1", "Pain point 2", "Pain point 3", "Pain point 4", "Pain point 5"]. No preamble.`,

    uvp: `Write a one-sentence Unique Value Proposition for this business. Make it specific and concrete — avoid generic phrases like "great service", "quality work", or "trusted provider". Reference a specific differentiator. Plain text only, no quotes, no preamble.`,

    seasonal_patterns: `Describe the typical seasonal revenue patterns for ${industry || 'this type of business'}. Be specific about which months are busy and slow and why. 2-3 sentences. Plain text only, no quotes, no preamble.`,

    what_hasnt_worked: `Based on the industry and what they've shared, suggest 2-3 common marketing failures or wasted spend typical for ${industry || 'this type of business'}. This helps prompt their memory. Return JSON array only of short phrases: ["Phrase 1", "Phrase 2", "Phrase 3"]. No preamble.`,

    brand_voice_suggestions: `Suggest the 5 most appropriate brand personality traits for ${industry || 'this type of business'}. Return JSON array only of single words or short phrases: ["Professional", "Trustworthy", "Friendly", "Expert", "Approachable"]. Match the tone appropriate for their customers. No preamble.`,

    target_cities: `Based on their location (${city || 'unknown'}, ${state || 'unknown'}) and scope (${classification?.geographic_scope || 'local'}), suggest the key cities and areas they should target. Return as a comma-separated list of city names. No preamble, no numbering.`,

    revenue_estimates: `For a ${industry || 'service business'} in ${city || 'a US city'}, suggest realistic estimates for: average transaction value, average visits per year per customer, and customer lifetime value. Return JSON only: { "avg_transaction": "$X", "avg_visits": "N", "lifetime_value": "$X", "explanation": "brief note" }. No preamble.`,
  }

  const prompt = FIELD_PROMPTS[field]
  if (!prompt) {
    return NextResponse.json({ suggestions: [], error: 'Unknown field' })
  }

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
        max_tokens: 800,
        temperature: 0.3,
        system: 'You are helping fill out a business onboarding form. Return only what is asked — no preamble, no explanation, no markdown formatting unless specifically asked for JSON.',
        messages: [{ role: 'user', content: `${context}\n\nTask: ${prompt}` }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const data: any = await res.json()
    const text: string = (data.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()

    // Try to parse as JSON, fall back to plain text
    const cleaned = text.replace(/```json|```/g, '').trim()
    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({ suggestions: parsed, raw: text })
    } catch {
      return NextResponse.json({ suggestions: text, raw: text })
    }
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
