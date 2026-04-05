import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { keyword, location, target_business, target_rank, top_competitors, market_assessment } = await req.json()

    if (!keyword || !location) {
      return NextResponse.json({ error: 'keyword and location required' }, { status: 400 })
    }

    const prompt = `You are a Google Ads / PPC expert for local service businesses. Generate actionable keyword and ad copy ideas.

BUSINESS: ${target_business || 'Local business'}
SERVICE/KEYWORD: ${keyword}
LOCATION: ${location}
GOOGLE MAPS RANK: ${target_rank ? '#' + target_rank : 'Not ranking locally'}
TOP COMPETITORS: ${top_competitors || 'Unknown'}
MARKET: ${market_assessment || 'competitive'}

Return ONLY valid JSON with no markdown:
{
  "branded_keywords": ["business name exact", "business name + service"],
  "service_keywords": ["service + city", "service near me", "best service + city", "affordable service + city", "24/7 service + city"],
  "competitor_keywords": ["competitor name + alternatives", "better than [competitor]"],
  "long_tail_keywords": ["emergency service + city", "same day service + city", "licensed service + city", "free estimate service + city"],
  "negative_keywords": ["diy", "jobs", "how to", "salary", "youtube", "free service"],
  "ad_headline_ideas": ["Headline 1 max 30 chars", "Headline 2 max 30 chars", "Headline 3 max 30 chars"],
  "ad_description_ideas": ["Description 1 max 90 chars that includes a call to action", "Description 2 max 90 chars with unique value prop"],
  "target_cpc_range": "$X-$Y per click estimate",
  "monthly_budget_suggestion": "$X-$Y/month for meaningful results",
  "campaign_strategy": "2-3 sentence strategy recommendation including bid strategy and audience targeting",
  "ad_extensions": ["callout extension idea", "sitelink idea", "call extension note"],
  "landing_page_tips": ["key element for high conversion landing page"]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    })

    if (!res.ok) return NextResponse.json({ error: 'AI request failed' }, { status: 500 })

    const d = await res.json()
    const text = d.content?.[0]?.text || ''
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const json  = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
      return NextResponse.json(json)
    } catch {
      return NextResponse.json({ campaign_strategy: text, service_keywords: [], ad_headline_ideas: [] })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
