// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Anomaly Detection
// Median + MAD over 28-day baseline. Flags z-score > 3.
// Top 5 campaign contributors. LLM explains each anomaly.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM } from './llmRouter'

export type AdsMetric = 'cost' | 'clicks' | 'conversions' | 'ctr' | 'cpc' | 'cpa'

export interface AnomalyFlag {
  date: string
  metric: AdsMetric
  scope: string
  baseline: number
  observed: number
  delta_pct: number
  z_score: number
  contributors: Array<{ entity_type: string; entity_name: string; delta_value: number; contribution_pct: number }>
}

// ── Stats helpers ─────────────────────────────────────────────

function quantile(arr: number[], q: number): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

function mad(arr: number[], median: number): number {
  return quantile(arr.map((x) => Math.abs(x - median)), 0.5)
}

// ── Detect anomalies ──────────────────────────────────────────

export async function detectAnomalies(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string; metrics?: AdsMetric[] }
): Promise<AnomalyFlag[]> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const metricsToCheck = body.metrics || ['cost', 'conversions', 'cpa']
  const flags: AnomalyFlag[] = []

  for (const metric of metricsToCheck) {
    const series = await getMetricSeries(s, client_id, metric, 29)
    if (series.length < 15) continue // not enough data

    const today = series[series.length - 1]
    const baseline = series.slice(0, -1).map((r) => r.value)
    const median = quantile(baseline, 0.5)
    const scaledMad = 1.4826 * mad(baseline, median) || 1e-9
    const z = (today.value - median) / scaledMad

    if (Math.abs(z) >= 3) {
      const contributors = await getTopContributors(s, client_id, metric, today.date)
      flags.push({
        date: today.date,
        metric,
        scope: 'account',
        baseline: median,
        observed: today.value,
        delta_pct: median === 0 ? 0 : ((today.value - median) / median) * 100,
        z_score: z,
        contributors,
      })
    }
  }

  return flags
}

export async function analyzeAnomalies(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<{ flags_found: number; alerts_created: number }> {
  const { client_id, agency_id } = body
  const flags = await detectAnomalies(s, body)
  if (!flags.length) return { flags_found: 0, alerts_created: 0 }

  // Get client summary
  const { data: client } = await s.from('clients')
    .select('name, primary_service').eq('id', client_id).single()
  const clientSummary = `${client?.name || 'Client'}: ${client?.primary_service || 'Unknown service'}`

  let alertsCreated = 0
  for (const flag of flags) {
    // Call LLM to explain
    const result = await adsLLM.run({
      task: 'explain_anomaly',
      clientId: client_id,
      agencyId: agency_id,
      input: {
        client_summary: clientSummary,
        metric: flag.metric,
        scope: flag.scope,
        baseline_value: flag.baseline,
        observed_value: flag.observed,
        delta_pct: flag.delta_pct,
        window_days: 28,
        contributors: flag.contributors,
        recent_changes: [],
      },
    })

    const explanation = result.data as any
    const severity = Math.abs(flag.z_score) > 5 ? 'critical' : Math.abs(flag.z_score) > 4 ? 'warn' : 'info'

    await s.from('kotoiq_ads_alerts').insert({
      client_id,
      agency_id: agency_id || null,
      severity,
      metric: flag.metric,
      scope: flag.scope,
      baseline: flag.baseline,
      observed: flag.observed,
      delta_pct: flag.delta_pct,
      window_days: 28,
      explanation_md: explanation?.one_paragraph_explanation || 'Anomaly detected.',
      contributors: flag.contributors,
    })
    alertsCreated++
  }

  return { flags_found: flags.length, alerts_created: alertsCreated }
}

export async function getAnomalies(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data } = await s.from('kotoiq_ads_alerts')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return data || []
}

// ── Helpers ───────────────────────────────────────────────────

async function getMetricSeries(
  s: SupabaseClient, clientId: string, metric: AdsMetric, days: number
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data } = await s.from('kotoiq_ads_fact_campaigns')
    .select('date, impressions, clicks, cost_micros, conversions')
    .eq('client_id', clientId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date')

  if (!data?.length) return []

  // Group by date
  const byDate = new Map<string, { impressions: number; clicks: number; cost_micros: number; conversions: number }>()
  for (const row of data) {
    const d = String(row.date)
    const existing = byDate.get(d) || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 }
    existing.impressions += Number(row.impressions || 0)
    existing.clicks += Number(row.clicks || 0)
    existing.cost_micros += Number(row.cost_micros || 0)
    existing.conversions += Number(row.conversions || 0)
    byDate.set(d, existing)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, m]) => ({
      date,
      value: computeMetric(metric, m),
    }))
}

function computeMetric(metric: AdsMetric, m: { impressions: number; clicks: number; cost_micros: number; conversions: number }): number {
  switch (metric) {
    case 'cost': return m.cost_micros / 1e6
    case 'clicks': return m.clicks
    case 'conversions': return m.conversions
    case 'ctr': return m.impressions > 0 ? m.clicks / m.impressions : 0
    case 'cpc': return m.clicks > 0 ? m.cost_micros / 1e6 / m.clicks : 0
    case 'cpa': return m.conversions > 0 ? m.cost_micros / 1e6 / m.conversions : 0
  }
}

async function getTopContributors(
  s: SupabaseClient, clientId: string, metric: AdsMetric, date: string
): Promise<AnomalyFlag['contributors']> {
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const yestStr = yesterday.toISOString().split('T')[0]

  // Get today's and yesterday's campaign-level data
  const [{ data: todayData }, { data: yestData }] = await Promise.all([
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, impressions, clicks, cost_micros, conversions')
      .eq('client_id', clientId).eq('date', date),
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, impressions, clicks, cost_micros, conversions')
      .eq('client_id', clientId).eq('date', yestStr),
  ])

  const todayMap = new Map((todayData || []).map((r) => [r.campaign_id, r]))
  const yestMap = new Map((yestData || []).map((r) => [r.campaign_id, r]))
  const allCampaignIds = new Set([...todayMap.keys(), ...yestMap.keys()])

  // Get campaign names
  const { data: campaigns } = await s.from('kotoiq_ads_campaigns')
    .select('id, name').eq('client_id', clientId)
  const nameMap = new Map((campaigns || []).map((c) => [c.id, c.name]))

  const deltas = [...allCampaignIds].map((cid) => {
    const t = todayMap.get(cid) || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 }
    const y = yestMap.get(cid) || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 }
    const tVal = computeMetric(metric, { impressions: Number(t.impressions), clicks: Number(t.clicks), cost_micros: Number(t.cost_micros), conversions: Number(t.conversions) })
    const yVal = computeMetric(metric, { impressions: Number(y.impressions), clicks: Number(y.clicks), cost_micros: Number(y.cost_micros), conversions: Number(y.conversions) })
    return { campaign_id: cid, name: nameMap.get(cid) || 'Unknown', delta: tVal - yVal }
  })

  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const top5 = deltas.slice(0, 5)
  const totalAbs = top5.reduce((s, d) => s + Math.abs(d.delta), 0) || 1

  return top5.map((d) => ({
    entity_type: 'campaign',
    entity_name: d.name,
    delta_value: d.delta,
    contribution_pct: (Math.abs(d.delta) / totalAbs) * 100,
  }))
}
