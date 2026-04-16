// ─────────────────────────────────────────────────────────────
// GSC Audit Engine — Google Search Console Deep Analysis
// Indexing issues, CTR anomalies, impression decay, cannibalization,
// striking-distance opportunities, and AI-prioritized recommendations.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData } from '@/lib/seoService'

type AnyRow = Record<string, any>

// Expected CTR per SERP position (industry-standard organic CTR curve)
const EXPECTED_CTR: Record<number, number> = {
  1: 0.285, 2: 0.157, 3: 0.094,
  4: 0.063, 5: 0.047, 6: 0.037,
  7: 0.030, 8: 0.025, 9: 0.021,
  10: 0.018,
}

function expectedCtrFor(pos: number): number {
  const rounded = Math.max(1, Math.min(10, Math.round(pos)))
  return EXPECTED_CTR[rounded] ?? 0.018
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

async function fetchSCBy(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[]
): Promise<AnyRow[]> {
  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit: 5000,
          aggregationType: 'auto',
        }),
      }
    )
    if (!res.ok) return []
    const json = await res.json().catch(() => null)
    return json?.rows || []
  } catch {
    return []
  }
}

async function fetchIndexingStatus(
  token: string,
  siteUrl: string
): Promise<AnyRow | null> {
  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return null
    return res.json().catch(() => null)
  } catch {
    return null
  }
}

// ── Run GSC Audit ──────────────────────────────────────────────────────────
export async function runGSCAudit(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string; days?: number }
) {
  const { client_id, agency_id } = body
  const days = body.days || 90
  if (!client_id) throw new Error('client_id required')

  // Look up client + SC connection
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

  const scConn = (connections || []).find(
    (c: any) => c.provider === 'search_console' && c.refresh_token
  )
  if (!scConn) throw new Error('Search Console not connected for this client')

  const token = await getAccessToken(scConn)
  if (!token) throw new Error('Unable to retrieve Search Console access token')

  const siteUrl =
    scConn.site_url ||
    (client.website?.startsWith('http') ? client.website : `https://${client.website || ''}`)

  const endDate = todayIso()
  const startDate = daysAgoIso(days)
  // For impression-decay, compare current window vs prior window
  const priorEndDate = daysAgoIso(days + 1)
  const priorStartDate = daysAgoIso(days * 2)

  const [byQuery, byPage, byQueryDate, priorByQuery] = await Promise.all([
    fetchSCBy(token, siteUrl, startDate, endDate, ['query']),
    fetchSCBy(token, siteUrl, startDate, endDate, ['page']),
    fetchSCBy(token, siteUrl, startDate, endDate, ['query', 'page']),
    fetchSCBy(token, siteUrl, priorStartDate, priorEndDate, ['query']),
  ])

  // ── CTR anomalies: pos 3-10 with CTR < 50% of expected ──────────────────
  const ctr_anomalies = byQuery
    .filter((r) => {
      const pos = r.position || 0
      const imp = r.impressions || 0
      return pos >= 3 && pos <= 10 && imp >= 100
    })
    .map((r) => {
      const pos = r.position || 0
      const expected = expectedCtrFor(pos)
      const actual = r.ctr || 0
      const gap = expected - actual
      return {
        query: r.keys?.[0] || '',
        position: Math.round(pos * 10) / 10,
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        actual_ctr: Math.round(actual * 1000) / 10,
        expected_ctr: Math.round(expected * 1000) / 10,
        ctr_gap_points: Math.round(gap * 1000) / 10,
        potential_missed_clicks: Math.round((gap > 0 ? gap : 0) * (r.impressions || 0)),
        severity: gap > 0.08 ? 'high' : gap > 0.04 ? 'medium' : 'low',
      }
    })
    .filter((r) => r.ctr_gap_points > 2 && r.actual_ctr < r.expected_ctr * 0.6)
    .sort((a, b) => b.potential_missed_clicks - a.potential_missed_clicks)
    .slice(0, 40)

  // ── Striking distance: pos 11-20 with high impressions ─────────────────
  const striking_distance = byQuery
    .filter((r) => {
      const pos = r.position || 0
      const imp = r.impressions || 0
      return pos >= 11 && pos <= 20 && imp >= 50
    })
    .map((r) => {
      const pos = r.position || 0
      return {
        query: r.keys?.[0] || '',
        position: Math.round(pos * 10) / 10,
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        estimated_clicks_at_5: Math.round((r.impressions || 0) * expectedCtrFor(5)),
        current_ctr: Math.round((r.ctr || 0) * 1000) / 10,
        opportunity_score: Math.round((21 - pos) * (r.impressions || 0) / 50),
      }
    })
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 40)

  // ── Impression decay: -20% vs prior period ─────────────────────────────
  const priorMap = new Map<string, { impressions: number; clicks: number }>()
  for (const r of priorByQuery) {
    const q = r.keys?.[0] || ''
    priorMap.set(q, { impressions: r.impressions || 0, clicks: r.clicks || 0 })
  }

  const impression_decay = byQuery
    .map((r) => {
      const q = r.keys?.[0] || ''
      const prior = priorMap.get(q)
      if (!prior || prior.impressions < 50) return null
      const curr = r.impressions || 0
      const change = (curr - prior.impressions) / prior.impressions
      if (change > -0.2) return null
      return {
        query: q,
        previous_impressions: prior.impressions,
        current_impressions: curr,
        impression_change_pct: Math.round(change * 1000) / 10,
        previous_clicks: prior.clicks,
        current_clicks: r.clicks || 0,
        position: Math.round((r.position || 0) * 10) / 10,
        severity:
          change < -0.5 ? 'critical' : change < -0.35 ? 'high' : 'medium',
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.impression_change_pct - b.impression_change_pct)
    .slice(0, 40)

  // ── Keyword cannibalization: 2+ URLs ranking for same query ────────────
  const queryToPages = new Map<string, AnyRow[]>()
  for (const r of byQueryDate) {
    const q = r.keys?.[0] || ''
    const p = r.keys?.[1] || ''
    if (!q || !p) continue
    const existing = queryToPages.get(q) || []
    existing.push({
      page: p,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      position: r.position || 0,
      ctr: r.ctr || 0,
    })
    queryToPages.set(q, existing)
  }

  const cannibalization: AnyRow[] = []
  for (const [query, pages] of queryToPages.entries()) {
    if (pages.length < 2) continue
    const totalImp = pages.reduce((sum, p) => sum + (p.impressions || 0), 0)
    if (totalImp < 100) continue
    pages.sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    const [primary, ...rest] = pages
    const competing = rest.filter((p) => (p.impressions || 0) >= 20)
    if (competing.length === 0) continue
    cannibalization.push({
      query,
      competing_pages_count: 1 + competing.length,
      primary_page: primary.page,
      primary_impressions: primary.impressions,
      primary_position: Math.round((primary.position || 0) * 10) / 10,
      competing_pages: competing.slice(0, 3).map((p) => ({
        page: p.page,
        impressions: p.impressions,
        position: Math.round((p.position || 0) * 10) / 10,
        clicks: p.clicks,
      })),
      total_impressions: totalImp,
      severity:
        competing.length >= 3 ? 'high' : competing.length >= 2 ? 'medium' : 'low',
    })
  }
  cannibalization.sort(
    (a, b) => (b.total_impressions || 0) - (a.total_impressions || 0)
  )
  const topCannibalization = cannibalization.slice(0, 30)

  // ── Indexing issues: pages with 0 clicks but high impressions or vice versa
  const indexing_issues: AnyRow[] = []
  for (const r of byPage) {
    const imp = r.impressions || 0
    const clicks = r.clicks || 0
    const pos = r.position || 100
    if (imp >= 100 && clicks === 0) {
      indexing_issues.push({
        page: r.keys?.[0] || '',
        issue_type: 'zero_clicks_high_impressions',
        impressions: imp,
        position: Math.round(pos * 10) / 10,
        description: 'Page shows in search but receives no clicks',
        severity: 'high',
      })
    } else if (pos > 50 && imp > 10) {
      indexing_issues.push({
        page: r.keys?.[0] || '',
        issue_type: 'deep_ranking',
        impressions: imp,
        position: Math.round(pos * 10) / 10,
        description: 'Page ranks beyond position 50 — may have indexing or relevance issue',
        severity: 'medium',
      })
    }
  }
  indexing_issues.sort(
    (a, b) => (b.impressions || 0) - (a.impressions || 0)
  )
  const topIndexingIssues = indexing_issues.slice(0, 30)

  // ── Summary metrics ────────────────────────────────────────────────────
  const totalImpressions = byQuery.reduce(
    (sum, r) => sum + (r.impressions || 0),
    0
  )
  const totalClicks = byQuery.reduce((sum, r) => sum + (r.clicks || 0), 0)
  const avgPosition =
    byQuery.length > 0
      ? byQuery.reduce((sum, r) => sum + (r.position || 0), 0) / byQuery.length
      : 0
  const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0

  const priorImpressions = priorByQuery.reduce(
    (sum, r) => sum + (r.impressions || 0),
    0
  )
  const priorClicks = priorByQuery.reduce(
    (sum, r) => sum + (r.clicks || 0),
    0
  )

  const summary = {
    site_url: siteUrl,
    days_analyzed: days,
    total_queries: byQuery.length,
    total_pages: byPage.length,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    overall_ctr_pct: Math.round(overallCtr * 1000) / 10,
    avg_position: Math.round(avgPosition * 10) / 10,
    impression_change_pct: priorImpressions
      ? Math.round(
          ((totalImpressions - priorImpressions) / priorImpressions) * 1000
        ) / 10
      : null,
    click_change_pct: priorClicks
      ? Math.round(((totalClicks - priorClicks) / priorClicks) * 1000) / 10
      : null,
  }

  // ── Overall health score (0-100) ────────────────────────────────────────
  const ctrScore = Math.min(Math.max(overallCtr * 100 * 4, 0), 25) // up to 25
  const posScore = Math.max(25 - Math.max(avgPosition - 10, 0) * 1.5, 0)
  const growthScore =
    summary.impression_change_pct === null
      ? 15
      : summary.impression_change_pct >= 0
      ? 20
      : Math.max(20 + summary.impression_change_pct / 2, 0)
  const cannibalizationPenalty = Math.min(topCannibalization.length * 1.5, 15)
  const decayPenalty = Math.min(impression_decay.length * 1, 10)
  const indexingPenalty = Math.min(topIndexingIssues.length * 0.7, 15)

  const overall_health_score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ctrScore +
          posScore +
          growthScore +
          30 -
          cannibalizationPenalty -
          decayPenalty -
          indexingPenalty
      )
    )
  )

  // ── AI recommendations ─────────────────────────────────────────────────
  let ai_recommendations: AnyRow[] = []
  try {
    const prompt = `You are a senior technical SEO analyst. Review this Search Console audit and produce prioritized, action-oriented recommendations.

Site: ${siteUrl}
Industry: ${client.primary_service || 'Unknown'}
Window: last ${days} days

Summary:
- Impressions: ${totalImpressions} (${summary.impression_change_pct ?? 'n/a'}% vs prior period)
- Clicks: ${totalClicks} (${summary.click_change_pct ?? 'n/a'}% vs prior)
- Avg position: ${summary.avg_position}
- Overall CTR: ${summary.overall_ctr_pct}%
- Health score: ${overall_health_score}/100

Top CTR anomalies (first 8):
${ctr_anomalies.slice(0, 8).map((c) => `- "${c.query}" pos ${c.position}, actual ${c.actual_ctr}% vs expected ${c.expected_ctr}% (missing ~${c.potential_missed_clicks} clicks)`).join('\n') || '- none'}

Striking distance (first 8):
${striking_distance.slice(0, 8).map((c) => `- "${c.query}" pos ${c.position}, ${c.impressions} impressions, could add ${c.estimated_clicks_at_5} clicks at pos 5`).join('\n') || '- none'}

Impression decay (first 6):
${impression_decay.slice(0, 6).map((c) => `- "${c.query}" ${c.impression_change_pct}% decline (${c.previous_impressions} -> ${c.current_impressions})`).join('\n') || '- none'}

Cannibalization (first 6):
${topCannibalization.slice(0, 6).map((c) => `- "${c.query}" ${c.competing_pages_count} competing pages (${c.total_impressions} total impressions)`).join('\n') || '- none'}

Indexing issues (first 6):
${topIndexingIssues.slice(0, 6).map((c) => `- ${c.issue_type}: ${c.page} (${c.impressions} imp, pos ${c.position})`).join('\n') || '- none'}

Return JSON array of 6-10 recommendations, each shaped:
{ "title": "short action title", "category": "ctr|striking_distance|decay|cannibalization|indexing|technical|content", "priority": "high|medium|low", "effort": "easy|moderate|hard", "impact": "high|medium|low", "description": "1-2 sentences with the specific fix", "example_queries_or_pages": ["..."] }

Return ONLY a JSON array, no markdown, no commentary.`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_gsc_audit',
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

  // ── Save ────────────────────────────────────────────────────────────────
  const row = {
    client_id,
    days_analyzed: days,
    summary,
    indexing_issues: topIndexingIssues,
    ctr_anomalies,
    impression_decay,
    cannibalization: topCannibalization,
    striking_distance,
    ai_recommendations,
    overall_health_score,
    scanned_at: new Date().toISOString(),
  }

  const { data: inserted } = await s
    .from('kotoiq_gsc_audits')
    .insert(row)
    .select()
    .single()

  return {
    audit_id: inserted?.id,
    summary,
    indexing_issues: topIndexingIssues,
    ctr_anomalies,
    impression_decay,
    cannibalization: topCannibalization,
    striking_distance,
    ai_recommendations,
    overall_health_score,
  }
}

// ── Get Latest GSC Audit ───────────────────────────────────────────────────
export async function getGSCAudit(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s
    .from('kotoiq_gsc_audits')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}
