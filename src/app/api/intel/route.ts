import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Fetch + strip HTML helper ────────────────────────────────────────────────
async function fetchPage(url: string): Promise<{ head: string; body: string; raw: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const raw = await res.text()
    const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    const head = (headMatch?.[1] || '').slice(0, 6000)
    const body = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)
    return { head, body, raw: raw.slice(0, 20000) }
  } catch { return { head: '', body: '', raw: '' } }
}

// ── Sitemap fetcher — deep crawl, follows nested sitemaps ────────────────────
async function fetchSitemap(url: string): Promise<string[]> {
  const allUrls: string[] = []
  const visited = new Set<string>()

  async function crawlSitemap(sUrl: string) {
    if (visited.has(sUrl) || visited.size > 20) return
    visited.add(sUrl)
    try {
      const res = await fetch(sUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const text = await res.text()
      const locs = [...text.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1]).filter(Boolean)

      for (const loc of locs) {
        // If it's a nested sitemap (contains .xml), crawl it recursively
        if (loc.endsWith('.xml') || loc.includes('sitemap')) {
          await crawlSitemap(loc)
        } else {
          allUrls.push(loc)
        }
      }
    } catch { /* skip unreachable sitemaps */ }
  }

  try {
    const base = new URL(url).origin
    // Try all common sitemap locations
    const sitemapUrls = [
      `${base}/sitemap.xml`,
      `${base}/sitemap_index.xml`,
      `${base}/wp-sitemap.xml`,
      `${base}/sitemap-index.xml`,
      `${base}/post-sitemap.xml`,
      `${base}/page-sitemap.xml`,
    ]
    // Also check robots.txt for sitemap directives
    try {
      const robotsRes = await fetch(`${base}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (robotsRes.ok) {
        const robotsTxt = await robotsRes.text()
        const sitemapMatches = [...robotsTxt.matchAll(/Sitemap:\s*(.*)/gi)]
        sitemapMatches.forEach(m => { if (m[1]?.trim()) sitemapUrls.push(m[1].trim()) })
      }
    } catch { /* ignore */ }

    // Crawl all found sitemaps
    for (const sUrl of [...new Set(sitemapUrls)]) {
      await crawlSitemap(sUrl)
      if (allUrls.length > 0) break // found pages, stop trying alternatives
    }

    return [...new Set(allUrls)].slice(0, 500)
  } catch { return [] }
}

function categorizeSitemapUrls(urls: string[]): Record<string, string[]> {
  const cats: Record<string, string[]> = {
    services: [], locations: [], blog: [], about: [], contact: [], landing: [], other: []
  }
  for (const url of urls) {
    const path = url.toLowerCase()
    if (/blog|news|article|post|resource/i.test(path)) cats.blog.push(url)
    else if (/service|what-we-do|treatment|procedure|offering/i.test(path)) cats.services.push(url)
    else if (/location|area|city|state|near-me|serving/i.test(path)) cats.locations.push(url)
    else if (/about|team|staff|doctor|attorney|meet/i.test(path)) cats.about.push(url)
    else if (/contact|schedule|book|appointment|consult/i.test(path)) cats.contact.push(url)
    else if (/landing|lp|offer|promo|special/i.test(path)) cats.landing.push(url)
    else cats.other.push(url)
  }
  return cats
}

// ── Google PageSpeed ─────────────────────────────────────────────────────────
async function fetchPageSpeed(url: string) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return null
  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(30000) })
    const data = await res.json()
    const cats = data.lighthouseResult?.categories || {}
    const audits = data.lighthouseResult?.audits || {}
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
      fcp: audits['first-contentful-paint']?.displayValue || null,
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      tbt: audits['total-blocking-time']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      speedIndex: audits['speed-index']?.displayValue || null,
      tti: audits['interactive']?.displayValue || null,
    }
  } catch { return null }
}

// ── Google Places — find competitors ─────────────────────────────────────────
async function findCompetitors(businessName: string, location: string, industry: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!apiKey) return []
  try {
    const query = `${industry || businessName} near ${location}`
    const res = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri',
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 10 }),
        signal: AbortSignal.timeout(10000),
      }
    )
    const data = await res.json()
    return (data.places || [])
      .filter((p: any) => p.displayName?.text?.toLowerCase() !== businessName.toLowerCase())
      .slice(0, 5)
      .map((p: any) => ({
        name: p.displayName?.text || 'Unknown',
        address: p.formattedAddress || '',
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        website: p.websiteUri || null,
        mapsUrl: p.googleMapsUri || null,
      }))
  } catch { return [] }
}

// ── Claude analysis — the brain ──────────────────────────────────────────────
async function analyzeWithClaude(data: any, agencyId?: string) {
  const prompt = `You are KotoIntel, an elite marketing intelligence analyst. Analyze this business data and produce a comprehensive lead pipeline audit.

BUSINESS: ${data.businessName}
INDUSTRY: ${data.industry}
LOCATION: ${data.location}
WEBSITE: ${data.website}
MONTHLY BUDGET: ${data.budget || 'Unknown'}
AVG JOB VALUE: ${data.avgJobValue || 'Unknown'}
CURRENT LEAD SOURCES: ${data.currentLeadSources || 'Unknown'}
MONTHLY LEAD GOAL: ${data.monthlyLeadGoal || 'Unknown'}

WEBSITE SCAN DATA:
${data.websiteData ? JSON.stringify(data.websiteData).slice(0, 3000) : 'Not available'}

PAGESPEED SCORES:
${data.pageSpeed ? JSON.stringify(data.pageSpeed) : 'Not available'}

COMPETITORS FOUND:
${data.competitors ? JSON.stringify(data.competitors) : 'Not available'}

SITEMAP ANALYSIS:
${data.sitemapData ? JSON.stringify(data.sitemapData) : 'Not available'}

CLIENT ACTUAL PAGE URLS (from sitemap crawl — these pages DEFINITELY EXIST, do NOT flag them as missing):
${data.sitemapData?.clientUrls ? data.sitemapData.clientUrls.join('\n') : 'Sitemap not found'}

IMPORTANT: Before flagging ANY content gap, check the actual URL list above. If a URL contains location names, service names, or topic keywords — that page EXISTS. Only flag a gap if you are CERTAIN the page does not appear in the sitemap URLs above. False positives damage credibility.

Return ONLY valid JSON with this exact structure:
{
  "pipeline_scores": {
    "awareness": { "score": 0-100, "label": "brief assessment" },
    "inquiry": { "score": 0-100, "label": "brief assessment" },
    "response": { "score": 0-100, "label": "brief assessment" },
    "proposal": { "score": 0-100, "label": "brief assessment" },
    "win_repeat": { "score": 0-100, "label": "brief assessment" }
  },
  "metrics": {
    "est_monthly_leads": { "value": number, "label": "explanation" },
    "avg_cost_per_lead": { "value": number, "label": "explanation" },
    "lead_to_close_rate": { "value": "X%", "label": "explanation" },
    "response_time_avg": { "value": "Xhrs", "label": "explanation" },
    "referral_pct": { "value": "X%", "label": "explanation" },
    "repeat_customer_rate": { "value": "X%", "label": "explanation" }
  },
  "lead_sources": [
    {
      "source": "Google Business Profile",
      "monthly_volume": number,
      "cost_per_lead": number,
      "close_rate": "X%",
      "quality": "High|Medium|Low|Very High",
      "status": "Active|Underoptimized|Not active|Absent|Paying|Unstructured|Not running"
    }
  ],
  "critical_finding": {
    "title": "Main issue found",
    "detail": "2-3 sentences explaining the specific problem with data"
  },
  "top_opportunity": {
    "title": "Best untapped opportunity",
    "detail": "2-3 sentences with specific actionable advice"
  },
  "competitor_analysis": {
    "summary": "2-3 sentences on competitive landscape",
    "biggest_threat": "Name and why",
    "your_advantage": "What this business has that competitors don't"
  },
  "content_gaps": [
    { "type": "missing_service_page|missing_location_page|missing_blog|missing_faq|missing_landing_page|weak_content", "title": "What's missing", "detail": "Why this matters + which competitor has it", "priority": "high|medium|low" }
  ],
  "budget_analysis": {
    "estimated_current_spend": number,
    "optimal_spend": number,
    "spend_by_channel": [
      { "channel": "name", "current": number, "recommended": number, "projected_leads": number }
    ],
    "roi_at_current": "X.Xx",
    "roi_at_optimal": "X.Xx"
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "title": "Short title",
      "detail": "1-2 sentences",
      "timeline": "This week|30 days|90 days",
      "expected_impact": "brief description"
    }
  ],
  "industry_benchmarks": {
    "avg_cpl": { "value": number, "source": "Source name + year (e.g. WordStream 2024, HubSpot State of Marketing 2024)" },
    "avg_close_rate": { "value": "X%", "source": "source" },
    "avg_response_time": { "value": "Xhrs", "source": "source" },
    "avg_monthly_leads": { "value": number, "source": "source" },
    "avg_review_count": { "value": number, "source": "source" },
    "avg_rating": { "value": number, "source": "source" }
  },
  "data_sources": [
    { "metric": "What this stat measures", "value": "The number", "source": "Organization/study name", "year": "2023 or 2024", "url": "URL to the source if known, or null", "context": "Why this matters for this business" }
  ],
  "executive_summary": "3-4 sentence overview of findings and top recommendation"
}

Rules:
- Use REAL industry benchmarks from known sources: WordStream, HubSpot, BrightLocal, Statista, Google Economic Impact, ServiceTitan, Housecall Pro, CallRail, etc.
- EVERY benchmark must cite its source and year. If you cannot cite a specific source, say "Industry estimate based on [methodology]"
- data_sources array should contain 10-15 key stats used in the report, each with source attribution
- Lead sources should include: Google Business Profile, Google Ads/LSA, Organic SEO, Angi/HomeAdvisor/Thumbtack, Facebook/Instagram, Referral/word of mouth, Nextdoor/community, Past customer reactivation
- Budget analysis should show realistic CPL per channel for this specific industry and market
- Recommendations should be specific and actionable, not generic
- All numbers should be realistic for a ${data.industry} business in ${data.location}
- For each lead source, the cost_per_lead should cite which source (e.g. "Google Ads benchmark from WordStream 2024")
- Include at least 3 stats about the local market or geographic area`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: 'You are KotoIntel, an elite marketing intelligence analyst. Return ONLY valid JSON. No markdown, no explanation.',
    messages: [{ role: 'user', content: prompt }],
  })

  void logTokenUsage({
    feature: 'koto_intel_report',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: agencyId || null,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { error: 'Failed to parse analysis', raw }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  // ── Run full KotoIntel scan ──────────────────────────────────────────────
  if (action === 'run_scan') {
    const { client_id, agency_id, website, business_name, industry, location, budget, avg_job_value, current_lead_sources, monthly_lead_goal } = body

    // Create report record
    const { data: report, error: createErr } = await s.from('koto_intel_reports').insert({
      client_id: client_id || null,
      agency_id: agency_id || null,
      status: 'running',
      inputs: { website, business_name, industry, location, budget, avg_job_value, current_lead_sources, monthly_lead_goal },
      report_data: {},
    }).select().single()
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

    try {
      // Run all scans in parallel
      let normalizedUrl = website?.trim() || ''
      if (normalizedUrl && !normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl

      const [pageData, pageSpeed, competitors, clientSitemap] = await Promise.all([
        normalizedUrl ? fetchPage(normalizedUrl) : Promise.resolve({ head: '', body: '', raw: '' }),
        normalizedUrl ? fetchPageSpeed(normalizedUrl) : Promise.resolve(null),
        findCompetitors(business_name, location, industry),
        normalizedUrl ? fetchSitemap(normalizedUrl) : Promise.resolve([]),
      ])

      // Fetch competitor sitemaps in parallel (top 3)
      const competitorSitemaps: Record<string, { urls: string[]; categories: Record<string, string[]> }> = {}
      if (competitors.length > 0) {
        const compSitemapPromises = competitors.slice(0, 3)
          .filter((c: any) => c.website)
          .map(async (c: any) => {
            const urls = await fetchSitemap(c.website)
            return { name: c.name, urls, categories: categorizeSitemapUrls(urls) }
          })
        const results = await Promise.all(compSitemapPromises)
        results.forEach(r => { competitorSitemaps[r.name] = { urls: r.urls, categories: r.categories } })
      }

      const clientSitemapCats = categorizeSitemapUrls(clientSitemap)

      // Run Claude analysis with all gathered data
      const analysis = await analyzeWithClaude({
        businessName: business_name,
        industry,
        location,
        website: normalizedUrl,
        budget,
        avgJobValue: avg_job_value,
        currentLeadSources: current_lead_sources,
        monthlyLeadGoal: monthly_lead_goal,
        websiteData: { head: pageData.head.slice(0, 2000), bodyPreview: pageData.body.slice(0, 3000) },
        pageSpeed,
        competitors,
        sitemapData: {
          client: { total: clientSitemap.length, categories: clientSitemapCats },
          clientUrls: clientSitemap.slice(0, 200),
          competitors: Object.fromEntries(
            Object.entries(competitorSitemaps).map(([name, d]) => [name, { total: d.urls.length, categories: Object.fromEntries(Object.entries(d.categories).map(([k, v]) => [k, v.length])) }])
          ),
        },
      }, agency_id)

      // Save completed report
      const reportData = {
        ...analysis,
        page_speed: pageSpeed,
        competitors,
        sitemap: {
          client: { total: clientSitemap.length, categories: clientSitemapCats, urls: clientSitemap.slice(0, 50) },
          competitors: Object.fromEntries(
            Object.entries(competitorSitemaps).map(([name, d]) => [name, { total: d.urls.length, categories: d.categories }])
          ),
        },
        scanned_at: new Date().toISOString(),
      }

      await s.from('koto_intel_reports').update({
        report_data: reportData,
        status: 'complete',
        completed_at: new Date().toISOString(),
      }).eq('id', report.id)

      return NextResponse.json({ report: { id: report.id, ...reportData } })
    } catch (e: any) {
      await s.from('koto_intel_reports').update({
        status: 'failed',
        report_data: { error: e.message },
      }).eq('id', report.id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Get report by ID ─────────────────────────────────────────────────────
  if (action === 'get_report') {
    const { report_id } = body
    const { data } = await s.from('koto_intel_reports').select('*').eq('id', report_id).single()
    return NextResponse.json({ report: data })
  }

  // ── List reports for agency/client ───────────────────────────────────────
  if (action === 'list_reports') {
    const { agency_id, client_id } = body
    let q = s.from('koto_intel_reports').select('id, client_id, agency_id, status, inputs, created_at, completed_at')
      .order('created_at', { ascending: false }).limit(50)
    if (client_id) q = q.eq('client_id', client_id)
    else if (agency_id) q = q.eq('agency_id', agency_id)
    const { data } = await q
    return NextResponse.json({ reports: data || [] })
  }

  // ── Re-run budget analysis with different numbers ────────────────────────
  if (action === 'recalculate_budget') {
    const { report_id, new_budget, new_channels } = body
    const { data: existing } = await s.from('koto_intel_reports').select('report_data, inputs').eq('id', report_id).single()
    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are KotoIntel budget optimizer. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Recalculate the budget allocation for this business.

BUSINESS: ${existing.inputs?.business_name} (${existing.inputs?.industry})
LOCATION: ${existing.inputs?.location}
NEW MONTHLY BUDGET: $${new_budget}
CHANNEL PREFERENCES: ${JSON.stringify(new_channels || 'auto-optimize')}
CURRENT REPORT DATA: ${JSON.stringify(existing.report_data?.budget_analysis || {}).slice(0, 2000)}
INDUSTRY BENCHMARKS: ${JSON.stringify(existing.report_data?.industry_benchmarks || {}).slice(0, 1000)}

Return JSON:
{
  "estimated_current_spend": number,
  "optimal_spend": number,
  "spend_by_channel": [{ "channel": "name", "current": number, "recommended": number, "projected_leads": number, "cpl": number }],
  "total_projected_leads": number,
  "blended_cpl": number,
  "roi_projection": "X.Xx",
  "revenue_projection": number,
  "summary": "2 sentence summary of what this budget change means"
}`,
      }],
    })

    void logTokenUsage({
      feature: 'koto_intel_budget_recalc',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      return NextResponse.json({ budget: JSON.parse(cleaned) })
    } catch {
      return NextResponse.json({ error: 'Failed to parse budget analysis' }, { status: 500 })
    }
  }

  // ── Delete report ────────────────────────────────────────────────────────
  if (action === 'delete_report') {
    const { report_id } = body
    await s.from('koto_intel_reports').delete().eq('id', report_id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
