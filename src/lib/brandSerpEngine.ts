// ─────────────────────────────────────────────────────────────
// Brand SERP Engine — Feature #4
// Scans branded SERPs, detects features, scores brand presence
// ─────────────────────────────────────────────────────────────

import { getSERPResults } from '@/lib/dataforseo'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

function domainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function extractDomain(website: string): string {
  if (!website) return ''
  const w = website.startsWith('http') ? website : `https://${website}`
  return domainFromUrl(w)
}

// ── Scan Brand SERP ─────────────────────────────────────────────────────────
export async function scanBrandSERP(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // Get client info
  const { data: client } = await s.from('clients').select('name, website').eq('id', client_id).single()
  if (!client?.name) throw new Error('Client not found or missing name')

  const brandQuery = client.name
  const clientDomain = extractDomain(client.website || '')

  // Fetch SERP for brand name
  const serp = await getSERPResults(brandQuery)

  // Detect SERP features
  const has_knowledge_panel = !!serp.knowledge_graph
  const has_site_links = serp.items.some(i => (i as any).sitelinks || (i as any).type === 'site_links')
  const has_paa = serp.people_also_ask.length > 0
  const has_local_pack = serp.local_pack.length > 0
  const has_ai_overview = !!serp.ai_overview?.present

  // Check for specific result types in raw items
  let has_reviews = false
  let has_images = false
  let has_videos = false
  let has_news = false
  let has_social = false
  let has_jobs = false

  const socialDomains = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'pinterest.com']
  const reviewDomains = ['yelp.com', 'trustpilot.com', 'bbb.org', 'glassdoor.com', 'google.com/maps', 'g.page']
  const newsDomains = ['news.google.com', 'reuters.com', 'apnews.com', 'cnn.com', 'bbc.com', 'forbes.com', 'bloomberg.com']

  for (const item of serp.items) {
    const d = domainFromUrl(item.url)
    const desc = (item.description || '').toLowerCase()
    const title = (item.title || '').toLowerCase()

    if (socialDomains.some(sd => d.includes(sd))) has_social = true
    if (reviewDomains.some(rd => d.includes(rd)) || desc.includes('review') || desc.includes('rating')) has_reviews = true
    if (newsDomains.some(nd => d.includes(nd))) has_news = true
    if (d.includes('indeed.com') || d.includes('glassdoor.com') || title.includes('jobs') || title.includes('careers')) has_jobs = true
    if ((item as any).type === 'images' || d.includes('images.google')) has_images = true
    if ((item as any).type === 'video' || d.includes('youtube.com') || d.includes('vimeo.com')) has_videos = true
  }

  // Count owned results (top 10 organic from client domain)
  const top10 = serp.items.slice(0, 10)
  const owned_results = clientDomain
    ? top10.filter(i => domainFromUrl(i.url).includes(clientDomain)).length
    : 0
  const total_results = top10.length

  // Knowledge panel details
  const kp_description = serp.knowledge_graph?.description || null
  const kp_source = serp.knowledge_graph?.type || null
  const kp_attributes = serp.knowledge_graph || null

  // Use Claude to analyze PAA questions for sentiment
  let paa_questions: { question: string; sentiment: string }[] = []
  let negative_results: { title: string; url: string; reason: string }[] = []

  if (serp.people_also_ask.length > 0 || serp.items.length > 0) {
    const prompt = `Analyze these search results for the brand "${brandQuery}" (domain: ${clientDomain || 'unknown'}).

PAA Questions:
${serp.people_also_ask.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'None'}

Top 10 Organic Results:
${top10.map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.description}`).join('\n')}

Return JSON with:
{
  "paa_analysis": [{ "question": "...", "sentiment": "trust|neutral|negative" }],
  "negative_results": [{ "title": "...", "url": "...", "reason": "brief explanation why this is negative for the brand" }]
}

For PAA sentiment:
- "trust" = questions suggesting trust/legitimacy (e.g. "Is X legit?", "Who owns X?")
- "neutral" = informational (e.g. "What does X do?", "Where is X located?")
- "negative" = reputation risk (e.g. "X scam", "X complaints", "X lawsuit")

For negative results: flag any result that contains negative sentiment about the brand (complaints, scam reports, lawsuits, negative reviews). Only flag genuinely negative results, not just competitor pages.

Return ONLY valid JSON, no markdown.`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      void logTokenUsage({
        feature: 'kotoiq_brand_serp',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: agency_id,
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      paa_questions = parsed.paa_analysis || []
      negative_results = parsed.negative_results || []
    } catch { /* non-fatal */ }
  }

  // Calculate brand_serp_score (0-100)
  const ownedScore = Math.min((owned_results / 10) * 40, 40) // up to 40 pts for owned results
  const kpScore = has_knowledge_panel ? 20 : 0
  const paaScore = paa_questions.length > 0
    ? Math.max(0, 15 - (paa_questions.filter(q => q.sentiment === 'negative').length * 5))
    : 10
  const negativeScore = Math.max(0, 15 - (negative_results.length * 5))
  const featureScore = [has_site_links, has_social, has_reviews && negative_results.length === 0, has_local_pack, has_ai_overview]
    .filter(Boolean).length * 2 // up to 10 pts
  const brand_serp_score = Math.min(Math.round(ownedScore + kpScore + paaScore + negativeScore + featureScore), 100)

  // Save to DB
  const row = {
    client_id,
    brand_query: brandQuery,
    has_knowledge_panel,
    has_site_links,
    has_paa,
    has_reviews,
    has_local_pack,
    has_images,
    has_videos,
    has_news,
    has_social,
    has_jobs,
    has_ai_overview,
    paa_questions,
    negative_results,
    kp_description,
    kp_source,
    kp_attributes,
    owned_results,
    total_results,
    brand_serp_score,
    scanned_at: new Date().toISOString(),
  }

  // Delete old then insert — one record per client
  await s.from('kotoiq_brand_serp').delete().eq('client_id', client_id)
  await s.from('kotoiq_brand_serp').insert(row)

  return row
}

// ── Get Brand SERP ──────────────────────────────────────────────────────────
export async function getBrandSERP(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s.from('kotoiq_brand_serp')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}

// ── Brand Defense Strategy ──────────────────────────────────────────────────
export async function getBrandDefenseStrategy(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // Get the latest brand SERP data
  const { data: serpData } = await s.from('kotoiq_brand_serp')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  if (!serpData) throw new Error('No brand SERP data found — run a scan first')

  const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()

  const prompt = `You are a brand SERP optimization expert. Analyze this brand's SERP presence and generate a defense/optimization strategy.

Brand: ${client?.name || 'Unknown'}
Website: ${client?.website || 'Unknown'}
Industry: ${client?.primary_service || 'Unknown'}

Current Brand SERP Data:
- Brand SERP Score: ${serpData.brand_serp_score}/100
- Knowledge Panel: ${serpData.has_knowledge_panel ? 'YES' : 'NO'}
- Site Links: ${serpData.has_site_links ? 'YES' : 'NO'}
- PAA Present: ${serpData.has_paa ? 'YES' : 'NO'}
- Reviews in SERP: ${serpData.has_reviews ? 'YES' : 'NO'}
- Local Pack: ${serpData.has_local_pack ? 'YES' : 'NO'}
- Social Profiles: ${serpData.has_social ? 'YES' : 'NO'}
- AI Overview: ${serpData.has_ai_overview ? 'YES' : 'NO'}
- Owned Results: ${serpData.owned_results} / ${serpData.total_results}
- Negative Results: ${JSON.stringify(serpData.negative_results || [])}
- PAA Questions: ${JSON.stringify(serpData.paa_questions || [])}
- KP Description: ${serpData.kp_description || 'None'}

Generate a JSON strategy with:
{
  "overall_assessment": "1-2 sentence summary",
  "score_breakdown": "Explain the score and what drives it",
  "knowledge_panel": {
    "status": "active|missing|incomplete",
    "actions": ["specific action items to trigger/improve KP"]
  },
  "owned_results": {
    "current": ${serpData.owned_results},
    "target": 7,
    "actions": ["specific pages/profiles to create to dominate SERP"]
  },
  "paa_strategy": {
    "actions": ["how to influence PAA questions and answers"]
  },
  "negative_mitigation": {
    "threats": ["identified threats"],
    "actions": ["specific counter-measures"]
  },
  "feature_optimization": {
    "actions": ["how to trigger missing SERP features"]
  },
  "priority_actions": [
    { "action": "specific task", "impact": "high|medium|low", "effort": "easy|moderate|hard", "timeline": "1-2 weeks" }
  ]
}

Return ONLY valid JSON, no markdown.`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  })
  void logTokenUsage({
    feature: 'kotoiq_brand_serp',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agency_id,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  const strategy = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  return strategy
}
