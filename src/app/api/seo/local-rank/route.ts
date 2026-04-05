import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY  || ''

// ── Search using Google Places (real local pack data) ─────────────────────────
async function searchGoogleLocal(keyword: string, location: string, radius = 16000) {
  if (!GOOGLE_KEY) return null
  const query = `${keyword} ${location}`
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.primaryType,places.googleMapsUri' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return (d.places || []).map((p: any, i: number) => ({
    rank:         i + 1,
    name:         p.displayName?.text || '',
    address:      p.formattedAddress || '',
    rating:       p.rating || null,
    review_count: p.userRatingCount || 0,
    website:      p.websiteUri || null,
    phone:        p.nationalPhoneNumber || null,
    type:         p.primaryType || null,
    maps_url:     p.googleMapsUri || null,
    place_id:     p.id || null,
    source:       'google_places',
  }))
}

// ── AI cross-reference analysis ───────────────────────────────────────────────
async function analyzeWithClaude(results: any[], keyword: string, location: string, targetBusiness: string) {
  if (!ANTHROPIC_KEY) return null
  const top10 = results.slice(0, 10).map(r =>
    `${r.rank}. ${r.name} — ${r.rating}★ (${r.review_count} reviews) — ${r.address}`
  ).join('\n')

  const targetRank = results.findIndex(r => r.name?.toLowerCase().includes(targetBusiness.toLowerCase())) + 1

  const prompt = `You are a local SEO expert. Analyze this Google Maps search result for "${keyword}" in ${location}.

TOP 10 RESULTS:
${top10}

TARGET BUSINESS: "${targetBusiness}"
CURRENT RANK: ${targetRank > 0 ? `#${targetRank}` : 'Not in top 20'}

Analyze and return ONLY valid JSON:
{
  "overall_assessment": "2-3 sentence summary of the competitive landscape",
  "target_rank": ${targetRank > 0 ? targetRank : 'null'},
  "rank_difficulty": "easy|medium|hard|very_hard",
  "top_3_analysis": [{ "rank": 1, "name": "...", "why_ranking": "...", "weaknesses": "..." }],
  "opportunities": ["specific actionable opportunity"],
  "recommendations": [
    { "priority": "high|medium|low", "action": "...", "impact": "...", "effort": "low|medium|high" }
  ],
  "review_gap": "analysis of review count gap",
  "estimated_time_to_rank": "e.g. 3-6 months with consistent effort",
  "quick_wins": ["action you can take this week"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) return null
  const d = await res.json()
  const text = d.content?.[0]?.text || ''
  try {
    const clean = text.replace(/```json|```/g,'').trim()
    return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1))
  } catch { return { overall_assessment: text } }
}

// ── Google search scraping for SERP position (organic) ────────────────────────
async function getOrganicRank(keyword: string, location: string, targetDomain: string) {
  // Use GSC data if available, otherwise return null
  // (Direct Google SERP scraping violates ToS — we use GSC data from seo_connections)
  return null
}

export async function POST(req: NextRequest) {
  try {
    const {
      keyword,
      location,
      target_business,
      target_domain,
      radius_km = 16,
      include_ai = true,
    } = await req.json()

    if (!keyword || !location) {
      return NextResponse.json({ error: 'keyword and location are required' }, { status: 400 })
    }

    const startTime = Date.now()

    // Fetch Google local results
    const googleResults = await searchGoogleLocal(keyword, location, radius_km * 1000)

    // AI analysis
    let aiAnalysis = null
    if (include_ai && target_business && googleResults) {
      aiAnalysis = await analyzeWithClaude(googleResults, keyword, location, target_business)
    }

    const targetRank = target_business && googleResults
      ? googleResults.findIndex((r: any) => r.name?.toLowerCase().includes(target_business.toLowerCase())) + 1
      : null

    return NextResponse.json({
      keyword,
      location,
      target_business,
      radius_km,
      searched_at:   new Date().toISOString(),
      duration_ms:   Date.now() - startTime,
      google_local:  googleResults || [],
      target_rank:   targetRank || null,
      ai_analysis:   aiAnalysis,
      total_results: googleResults?.length || 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
