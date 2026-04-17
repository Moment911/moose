import 'server-only'

/**
 * KPI Rollup — Per-Page and Campaign-Level Metrics (ATTR-07)
 *
 * Joins data from:
 * - kotoiq_publishes (publish metadata)
 * - kotoiq_cwv_readings (Core Web Vitals)
 * - kotoiq_call_attribution (call attribution)
 * - koto_wp_rankings (keyword rankings — optional, may not exist)
 *
 * Returns unified KPI objects for the attribution dashboard.
 */

import { getKotoIQDb } from '../kotoiqDb'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CwvSnapshot {
  lcp_p75_ms: number | null
  cls_p75: number | null
  inp_p75_ms: number | null
  fcp_p75_ms: number | null
  ttfb_p75_ms: number | null
  source: string | null
  device: string | null
  fetched_at: string | null
}

export interface PageKPIs {
  publish_id: string
  url: string
  variant_id: string | null
  published_at: string | null
  // CWV
  cwv: CwvSnapshot | null
  cwv_readings_count: number
  // Attribution
  call_count: number
  attributed_calls: Array<{
    inbound_call_id: string
    match_method: string
    confidence: number
    matched_at: string
  }>
  // Rankings (nullable — table may not exist)
  rank: number | null
  rank_keyword: string | null
  // Revenue estimate
  estimated_revenue: number | null
}

export interface CampaignKPIs {
  campaign_id: string
  total_publishes: number
  total_calls: number
  avg_lcp_ms: number | null
  avg_cls: number | null
  avg_inp_ms: number | null
  pages: PageKPIs[]
}

// ── Per-Page KPIs ───────────────────────────────────────────────────────────

/**
 * Get a unified KPI row for a single published page.
 */
export async function getPageKPIs(
  publishId: string,
  agencyId: string
): Promise<PageKPIs | null> {
  const db = getKotoIQDb(agencyId)

  // Fetch publish record
  const { data: pub, error: pubErr } = await db.from('kotoiq_publishes')
    .select('id, variant_id, url, published_at')
    .eq('id', publishId)
    .single()

  if (pubErr || !pub) return null

  // Fetch latest CWV reading
  const { data: cwvRows } = await db.from('kotoiq_cwv_readings')
    .select('lcp_p75_ms, cls_p75, inp_p75_ms, fcp_p75_ms, ttfb_p75_ms, source, device, fetched_at')
    .eq('publish_id', publishId)
    .order('fetched_at', { ascending: false })
    .limit(1)

  const latestCwv: CwvSnapshot | null = cwvRows?.[0] ?? null
  const { count: cwvCount } = await db.from('kotoiq_cwv_readings')
    .select('id', { count: 'exact', head: true })
    .eq('publish_id', publishId)

  // Fetch attributed calls
  const { data: calls } = await db.from('kotoiq_call_attribution')
    .select('inbound_call_id, match_method, confidence, matched_at')
    .eq('publish_id', publishId)
    .order('matched_at', { ascending: false })

  // Attempt ranking lookup (table may not exist — swallow errors)
  let rank: number | null = null
  let rankKeyword: string | null = null
  try {
    const { data: rankRow } = await db.client
      .from('koto_wp_rankings')
      .select('rank, keyword')
      .eq('url', pub.url)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (rankRow) {
      rank = rankRow.rank ?? null
      rankKeyword = rankRow.keyword ?? null
    }
  } catch {
    // Table may not exist yet — not critical
  }

  const callList = calls ?? []

  return {
    publish_id: publishId,
    url: pub.url,
    variant_id: pub.variant_id,
    published_at: pub.published_at,
    cwv: latestCwv,
    cwv_readings_count: cwvCount ?? 0,
    call_count: callList.length,
    attributed_calls: callList,
    rank,
    rank_keyword: rankKeyword,
    estimated_revenue: estimateRevenue(callList.length),
  }
}

// ── Campaign KPIs ───────────────────────────────────────────────────────────

/**
 * Aggregate KPIs across all published variants in a campaign.
 */
export async function getCampaignKPIs(
  campaignId: string,
  agencyId: string
): Promise<CampaignKPIs | null> {
  const db = getKotoIQDb(agencyId)

  // Get all variants for this campaign
  const { data: variants } = await db.from('kotoiq_variants')
    .select('id')
    .eq('campaign_id', campaignId)

  if (!variants?.length) return null

  const variantIds = variants.map((v: any) => v.id)

  // Get all publishes for those variants
  const { data: publishes } = await db.from('kotoiq_publishes')
    .select('id')
    .in('variant_id', variantIds)

  if (!publishes?.length) {
    return {
      campaign_id: campaignId,
      total_publishes: 0,
      total_calls: 0,
      avg_lcp_ms: null,
      avg_cls: null,
      avg_inp_ms: null,
      pages: [],
    }
  }

  // Get per-page KPIs for each publish
  const pages: PageKPIs[] = []
  for (const pub of publishes) {
    const kpi = await getPageKPIs(pub.id, agencyId)
    if (kpi) pages.push(kpi)
  }

  // Aggregate
  const totalCalls = pages.reduce((sum, p) => sum + p.call_count, 0)

  const lcpValues = pages.filter(p => p.cwv?.lcp_p75_ms != null).map(p => p.cwv!.lcp_p75_ms!)
  const clsValues = pages.filter(p => p.cwv?.cls_p75 != null).map(p => p.cwv!.cls_p75!)
  const inpValues = pages.filter(p => p.cwv?.inp_p75_ms != null).map(p => p.cwv!.inp_p75_ms!)

  return {
    campaign_id: campaignId,
    total_publishes: pages.length,
    total_calls: totalCalls,
    avg_lcp_ms: lcpValues.length ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : null,
    avg_cls: clsValues.length ? +(clsValues.reduce((a, b) => a + b, 0) / clsValues.length).toFixed(3) : null,
    avg_inp_ms: inpValues.length ? Math.round(inpValues.reduce((a, b) => a + b, 0) / inpValues.length) : null,
    pages,
  }
}

// ── Revenue estimate ────────────────────────────────────────────────────────

/**
 * Simple revenue estimate based on attributed calls.
 * Uses a conservative $150/call average for service businesses.
 * This should eventually be configurable per-agency.
 */
function estimateRevenue(callCount: number): number | null {
  if (callCount === 0) return null
  const AVG_CALL_VALUE = 150
  return callCount * AVG_CALL_VALUE
}
