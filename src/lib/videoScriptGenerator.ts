// ── Video Voicemail Script Generator ─────────────────────────────────────────
// Uses Claude to generate personalized 15-25 second video scripts.

export async function generateVideoScript(lead: {
  prospect_name?: string
  prospect_first_name?: string
  business_name?: string
  industry_name?: string
  city?: string
  state?: string
  pain_point?: string
  google_rating?: number
  review_count?: number
}, agencyName: string = 'Momenta Marketing', closerName: string = ''): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) return fallbackScript(lead, agencyName)

  const firstName = lead.prospect_first_name || lead.prospect_name?.split(' ')[0] || ''
  const business = lead.business_name || ''
  const industry = lead.industry_name || ''
  const city = lead.city || ''
  const rating = lead.google_rating
  const reviews = lead.review_count
  const pain = lead.pain_point || ''

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: `Write a 15-20 second personalized video voicemail script. This is spoken by a real person on camera directly to the prospect. Must sound natural and conversational, NOT scripted.

Prospect: ${firstName || 'there'}
Business: ${business}
Industry: ${industry}
City: ${city}
${rating ? `Google Rating: ${rating}/5 (${reviews || 0} reviews)` : ''}
${pain ? `Known Pain Point: ${pain}` : ''}
Agency: ${agencyName}
${closerName ? `Closer: ${closerName}` : ''}

Rules:
- Start with "Hey ${firstName || 'there'}" (casual, warm)
- Mention their business name specifically
- Reference ONE specific data point about their business (rating, reviews, or industry context)
- End with a clear CTA: "Check your email for a quick link to book 15 minutes"
- Under 60 words total (this is a 15-20 second video)
- NO placeholder brackets, NO stage directions, NO quotes around the text
- Sound like you're talking to a friend, not reading a script
- Do NOT start with "Hi, I'm..." -- start with "Hey [name]"

Return ONLY the script text, nothing else.` }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return fallbackScript(lead, agencyName)
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || fallbackScript(lead, agencyName)
  } catch {
    return fallbackScript(lead, agencyName)
  }
}

function fallbackScript(lead: any, agencyName: string): string {
  const name = lead.prospect_first_name || lead.prospect_name?.split(' ')[0] || 'there'
  const biz = lead.business_name || 'your business'
  return `Hey ${name}, I was just trying to reach you about ${biz}. We've been helping businesses like yours get significantly more leads and I wanted to see if that's something you'd be open to exploring. Check your email for a quick link to book 15 minutes with our team. Talk soon.`
}
