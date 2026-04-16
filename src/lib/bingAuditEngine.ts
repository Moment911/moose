// ─────────────────────────────────────────────────────────────
// Bing Audit Engine — Bing Webmaster Tools deep analysis
// Query stats, rank & traffic stats, crawl stats, Google-vs-Bing
// comparison, and AI-generated recommendations.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData } from '@/lib/seoService'

type AnyRow = Record<string, any>

const BING_BASE = 'https://ssl.bing.com/webmaster/api.svc/json'

class BingAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'BingAuthError'
    this.status = status
  }
}

async function bingGet(endpoint: string, params: Record<string, string>): Promise<AnyRow | null> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BING_BASE}/${endpoint}?${qs}`
  try {
    const res = await fetch(url, { method: 'GET' })
    if (res.status === 401 || res.status === 403) {
      throw new BingAuthError(
        `Bing Webmaster API auth failed (${res.status}) — verify the API key and that the site is verified in Bing Webmaster Tools.`,
        res.status
      )
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Bing ${endpoint} ${res.status}: ${text.slice(0, 300)}`)
    }
    return res.json().catch(() => null)
  } catch (e) {
    if (e instanceof BingAuthError) throw e
    throw e
  }
}

function normalizeBingRows(d: any): AnyRow[] {
  // Bing API returns { d: [ ... ] } typically
  if (!d) return []
  if (Array.isArray(d)) return d
  if (Array.isArray(d.d)) return d.d
  if (Array.isArray(d.Data)) return d.Data
  return []
}

function parseBingDate(v: any): string | null {
  if (!v) return null
  // Bing sometimes returns /Date(1700000000000)/
  if (typeof v === 'string') {
    const m = v.match(/\/Date\((\d+)\)\//)
    if (m) return new Date(parseInt(m[1], 10)).toISOString().split('T')[0]
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  if (typeof v === 'number') return new Date(v).toISOString().split('T')[0]
  return null
}

// ── Run Bing Audit ─────────────────────────────────────────────────────────
export async function runBingAudit(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; site_url?: string; api_key?: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // Look up client + Bing connection
  const { data: client } = await s
    .from('clients')
    .select('name, website, primary_service')
    .eq('id', client_id)
    .single()
  if (!client) throw new Error('Client not found')

  const { data: connections } = await s
    .from('seo_connections')
    .select('*')
    .eq('client_id', client_id)

  const bingConn = (connections || []).find((c: any) => c.provider === 'bing')

  const apiKey =
    body.api_key ||
    bingConn?.refresh_token ||
    (bingConn as any)?.access_token ||
    process.env.BING_WEBMASTER_API_KEY ||
    ''

  if (!apiKey) {
    throw new Error(
      'Bing Webmaster API key not configured. Add a `bing` entry to seo_connections (api key in refresh_token) or set BING_WEBMASTER_API_KEY.'
    )
  }

  const rawSite =
    body.site_url ||
    bingConn?.site_url ||
    (client.website?.startsWith('http')
      ? client.website
      : `https://${client.website || ''}`)
  if (!rawSite || rawSite === 'https://') {
    throw new Error('site_url is required (client has no website configured)')
  }

  // ── Fetch Bing endpoints in parallel ───────────────────────────────────
  const [queryStatsRes, rankStatsRes, crawlStatsRes] = await Promise.allSettled([
    bingGet('GetQueryStats', { siteUrl: rawSite, apikey: apiKey }),
    bingGet('GetRankAndTrafficStats', { siteUrl: rawSite, apikey: apiKey }),
    bingGet('GetCrawlStats', { siteUrl: rawSite, apikey: apiKey }),
  ])

  // If any call returns an auth error, surface it clearly (check the first rejection)
  for (const r of [queryStatsRes, rankStatsRes, crawlStatsRes]) {
    if (r.status === 'rejected' && r.reason instanceof BingAuthError) {
      throw r.reason
    }
  }

  const queryRows = normalizeBingRows(
    queryStatsRes.status === 'fulfilled' ? queryStatsRes.value : null
  )
  const rankRows = normalizeBingRows(
    rankStatsRes.status === 'fulfilled' ? rankStatsRes.value : null
  )
  const crawlRows = normalizeBingRows(
    crawlStatsRes.status === 'fulfilled' ? crawlStatsRes.value : null
  )

  // ── Top queries ────────────────────────────────────────────────────────
  const top_queries = queryRows
    .map((r) => ({
      query: r.Query || r.query || '',
      impressions: r.Impressions || r.impressions || 0,
      clicks: r.Clicks || r.clicks || 0,
      position: r.AvgImpressionPosition || r.avg_position || r.Position || 0,
      avg_click_position:
        r.AvgClickPosition || r.avg_click_position || null,
      ctr:
        (r.Impressions || r.impressions)
          ? Math.round(
              ((r.Clicks || r.clicks || 0) /
                (r.Impressions || r.impressions || 1)) *
                1000
            ) / 10
          : 0,
    }))
    .filter((q) => q.query)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 50)

  // ── Ranking/traffic summary ───────────────────────────────────────────
  const traffic_by_day = rankRows
    .map((r) => ({
      date:
        parseBingDate(r.Date || r.date) ||
        (typeof r.Date === 'string' ? r.Date : null),
      impressions: r.Impressions || r.impressions || 0,
      clicks: r.Clicks || r.clicks || 0,
    }))
    .filter((r) => r.date)
    .slice(-30)

  const totalBingImpressions = traffic_by_day.reduce(
    (sum, r) => sum + (r.impressions || 0),
    0
  )
  const totalBingClicks = traffic_by_day.reduce(
    (sum, r) => sum + (r.clicks || 0),
    0
  )

  const ranking_summary = {
    site_url: rawSite,
    total_queries: queryRows.length,
    total_impressions_30d: totalBingImpressions,
    total_clicks_30d: totalBingClicks,
    overall_ctr_pct: totalBingImpressions
      ? Math.round((totalBingClicks / totalBingImpressions) * 1000) / 10
      : 0,
    avg_position:
      top_queries.length > 0
        ? Math.round(
            (top_queries.reduce((sum, q) => sum + (q.position || 0), 0) /
              top_queries.length) *
              10
          ) / 10
        : 0,
    traffic_by_day,
  }

  // ── Crawl stats ────────────────────────────────────────────────────────
  const latestCrawl = crawlRows[0] || {}
  const crawl_stats = {
    crawled_pages:
      latestCrawl.CrawledPages || latestCrawl.crawled_pages || 0,
    crawl_errors: latestCrawl.CrawlErrors || latestCrawl.crawl_errors || 0,
    blocked_by_robots:
      latestCrawl.BlockedByRobotsTxt || latestCrawl.blocked_by_robots || 0,
    dns_failures:
      latestCrawl.DnsFailures || latestCrawl.dns_failures || 0,
    http_error_codes:
      latestCrawl.HttpErrorCodes || latestCrawl.http_error_codes || 0,
    timeouts: latestCrawl.Timeouts || latestCrawl.timeouts || 0,
    history: crawlRows.slice(0, 30).map((r) => ({
      date: parseBingDate(r.Date || r.date),
      crawled: r.CrawledPages || r.crawled_pages || 0,
      errors: r.CrawlErrors || r.crawl_errors || 0,
    })),
  }

  // ── Google-vs-Bing comparison (if GSC connected) ──────────────────────
  let google_vs_bing: AnyRow[] = []
  try {
    const scConn = (connections || []).find(
      (c: any) => c.provider === 'search_console' && c.refresh_token
    )
    if (scConn) {
      const token = await getAccessToken(scConn)
      if (token) {
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 30 * 86400000)
          .toISOString()
          .split('T')[0]
        const scSiteUrl = scConn.site_url || rawSite
        const scData = await fetchSearchConsoleData(
          token,
          scSiteUrl,
          startDate,
          endDate
        ).catch(() => null)

        const scByQuery = new Map<string, AnyRow>()
        for (const r of scData?.rows || []) {
          const q = r.keys?.[0] || ''
          if (!q) continue
          if (!scByQuery.has(q)) scByQuery.set(q, r)
        }

        for (const bq of top_queries.slice(0, 25)) {
          const g = scByQuery.get(bq.query)
          google_vs_bing.push({
            query: bq.query,
            bing_impressions: bq.impressions,
            bing_clicks: bq.clicks,
            bing_position: Math.round((bq.position || 0) * 10) / 10,
            google_impressions: g?.impressions || 0,
            google_clicks: g?.clicks || 0,
            google_position: g ? Math.round((g.position || 0) * 10) / 10 : null,
            bing_wins:
              g && bq.position && g.position
                ? bq.position < g.position
                : null,
          })
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  // ── Opportunities ──────────────────────────────────────────────────────
  const opportunities: AnyRow[] = []

  for (const q of top_queries) {
    if (q.position >= 11 && q.position <= 25 && q.impressions >= 50) {
      opportunities.push({
        type: 'striking_distance_bing',
        query: q.query,
        position: q.position,
        impressions: q.impressions,
        description: `Striking distance on Bing (pos ${q.position}). Optimize page to push into top 10.`,
      })
    }
    if (q.position <= 10 && q.ctr < 2 && q.impressions >= 100) {
      opportunities.push({
        type: 'low_ctr_bing',
        query: q.query,
        position: q.position,
        ctr: q.ctr,
        impressions: q.impressions,
        description: `Ranking top 10 on Bing but CTR is ${q.ctr}%. Review title/meta on this query.`,
      })
    }
  }

  for (const row of google_vs_bing) {
    if (
      row.bing_position &&
      row.google_position &&
      row.bing_position < row.google_position - 5
    ) {
      opportunities.push({
        type: 'bing_outranks_google',
        query: row.query,
        bing_position: row.bing_position,
        google_position: row.google_position,
        description: `Bing ranks this page significantly higher than Google. Investigate why Google is penalizing relative to Bing — may signal thin content, E-E-A-T, or link gap.`,
      })
    }
  }

  if (crawl_stats.crawl_errors > 10) {
    opportunities.push({
      type: 'crawl_errors',
      count: crawl_stats.crawl_errors,
      description: `${crawl_stats.crawl_errors} crawl errors reported by Bing. Audit error report and fix high-volume URLs first.`,
    })
  }
  if (crawl_stats.blocked_by_robots > 0) {
    opportunities.push({
      type: 'robots_blocks',
      count: crawl_stats.blocked_by_robots,
      description: `${crawl_stats.blocked_by_robots} URLs blocked by robots.txt. Confirm this is intentional.`,
    })
  }

  // ── AI recommendations ────────────────────────────────────────────────
  let ai_recommendations: AnyRow[] = []
  try {
    const prompt = `You are a senior technical SEO analyst reviewing a Bing Webmaster Tools audit. Produce prioritized recommendations specific to Bing (not Google).

Site: ${rawSite}
Industry: ${client.primary_service || 'Unknown'}

Bing 30-day summary:
- Impressions: ${ranking_summary.total_impressions_30d}
- Clicks: ${ranking_summary.total_clicks_30d}
- CTR: ${ranking_summary.overall_ctr_pct}%
- Avg position (sampled): ${ranking_summary.avg_position}
- Total queries tracked: ${ranking_summary.total_queries}

Crawl:
- Crawled pages: ${crawl_stats.crawled_pages}
- Crawl errors: ${crawl_stats.crawl_errors}
- Blocked by robots: ${crawl_stats.blocked_by_robots}
- HTTP errors: ${crawl_stats.http_error_codes}

Top Bing queries (first 10):
${top_queries.slice(0, 10).map((q) => `- "${q.query}" pos ${q.position}, ${q.impressions} imp, CTR ${q.ctr}%`).join('\n') || '- none'}

Google vs Bing (first 6 where data exists):
${google_vs_bing.slice(0, 6).map((r) => `- "${r.query}" Bing pos ${r.bing_position} vs Google ${r.google_position ?? 'n/a'}`).join('\n') || '- no comparison data'}

Opportunities detected (first 6):
${opportunities.slice(0, 6).map((o) => `- ${o.type}: ${o.description}`).join('\n') || '- none'}

Return a JSON array of 5-8 prioritized recommendations shaped:
{ "title": "short action title", "category": "rankings|ctr|crawl|indexing|content|technical", "priority": "high|medium|low", "effort": "easy|moderate|hard", "impact": "high|medium|low", "description": "1-2 sentence fix", "bing_specific": true/false }

Return ONLY a JSON array, no markdown.`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_bing_audit',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    const cleaned = raw
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) ai_recommendations = parsed
    else if (Array.isArray(parsed.recommendations))
      ai_recommendations = parsed.recommendations
  } catch {
    ai_recommendations = []
  }

  // ── Save ──────────────────────────────────────────────────────────────
  const row = {
    client_id,
    site_url: rawSite,
    ranking_summary,
    top_queries,
    crawl_stats,
    google_vs_bing,
    opportunities,
    ai_recommendations,
    scanned_at: new Date().toISOString(),
  }

  const { data: inserted } = await s
    .from('kotoiq_bing_audits')
    .insert(row)
    .select()
    .single()

  return {
    audit_id: inserted?.id,
    site_url: rawSite,
    ranking_summary,
    top_queries,
    crawl_stats,
    google_vs_bing,
    opportunities,
    ai_recommendations,
  }
}

// ── Get Latest Bing Audit ──────────────────────────────────────────────────
export async function getBingAudit(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s
    .from('kotoiq_bing_audits')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}
