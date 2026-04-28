// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Weekly Executive Summary
// Aggregates week's metrics, anomalies, recommendations
// LLM generates headline + narrative + wins/concerns/priorities
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM } from './llmRouter'

function dateStr(base: Date, daysOffset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

export async function generateWeeklySummary(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const now = new Date()
  const period = { start: dateStr(now, -7), end: dateStr(now, -1) }
  const priorPeriod = { start: dateStr(now, -14), end: dateStr(now, -8) }

  // Get topline metrics for both periods
  const [current, prior] = await Promise.all([
    getTopline(s, client_id, period),
    getTopline(s, client_id, priorPeriod),
  ])

  // Get client name
  const { data: client } = await s.from('clients')
    .select('name').eq('id', client_id).single()

  // Get alert count
  const { count: alertsCount } = await s.from('kotoiq_ads_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .gte('created_at', period.start)

  // Get pending recommendations count
  const { count: recsCount } = await s.from('kotoiq_ads_rec_negatives')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id).eq('status', 'pending')

  // Wasted spend total
  const { data: wastedData } = await s.from('v_kotoiq_ads_wasted_spend_30d' as any)
    .select('cost_usd').eq('client_id', client_id)
  const wastedTotal = (wastedData || []).reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0)

  // Top movers (campaigns with biggest delta)
  const topMovers = await getTopMovers(s, client_id, period, priorPeriod)

  // Cross-channel snapshot from GA4
  const crossChannel = await getCrossChannelSnapshot(s, client_id, period)

  const costDelta = prior.cost > 0 ? ((current.cost - prior.cost) / prior.cost) * 100 : 0
  const convDelta = prior.conversions > 0 ? ((current.conversions - prior.conversions) / prior.conversions) * 100 : 0
  const currentCpa = current.conversions > 0 ? current.cost / current.conversions : 0
  const priorCpa = prior.conversions > 0 ? prior.cost / prior.conversions : 0
  const cpaDelta = priorCpa > 0 ? ((currentCpa - priorCpa) / priorCpa) * 100 : 0
  const currentRoas = current.cost > 0 ? current.value / current.cost : null
  const priorRoas = prior.cost > 0 ? prior.value / prior.cost : null
  const roasDelta = priorRoas && priorRoas > 0 ? (((currentRoas || 0) - priorRoas) / priorRoas) * 100 : null

  const result = await adsLLM.run({
    task: 'weekly_executive_summary',
    clientId: client_id,
    agencyId: agency_id,
    input: {
      client_name: client?.name || 'Client',
      period,
      prior_period: priorPeriod,
      topline: {
        cost_usd: current.cost,
        cost_delta_pct: costDelta,
        conversions: current.conversions,
        conversions_delta_pct: convDelta,
        cpa_usd: currentCpa,
        cpa_delta_pct: cpaDelta,
        roas: currentRoas,
        roas_delta_pct: roasDelta,
      },
      top_movers: topMovers,
      wasted_spend_total_usd: wastedTotal,
      pending_recommendations_count: recsCount || 0,
      alerts_count: alertsCount || 0,
      cross_channel_snapshot: crossChannel,
    },
  })

  return result.data
}

async function getTopline(s: SupabaseClient, clientId: string, period: { start: string; end: string }) {
  const { data } = await s.from('kotoiq_ads_fact_campaigns')
    .select('cost_micros, clicks, conversions, conversion_value, impressions')
    .eq('client_id', clientId)
    .gte('date', period.start).lte('date', period.end)

  let cost = 0, clicks = 0, conversions = 0, value = 0, impressions = 0
  for (const r of data || []) {
    cost += Number(r.cost_micros || 0) / 1e6
    clicks += Number(r.clicks || 0)
    conversions += Number(r.conversions || 0)
    value += Number(r.conversion_value || 0)
    impressions += Number(r.impressions || 0)
  }
  return { cost, clicks, conversions, value, impressions }
}

async function getTopMovers(
  s: SupabaseClient, clientId: string,
  period: { start: string; end: string }, prior: { start: string; end: string }
) {
  const [{ data: curr }, { data: prev }] = await Promise.all([
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, cost_micros, conversions')
      .eq('client_id', clientId).gte('date', period.start).lte('date', period.end),
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, cost_micros, conversions')
      .eq('client_id', clientId).gte('date', prior.start).lte('date', prior.end),
  ])

  const agg = (data: any[]) => {
    const map = new Map<string, { cost: number; conv: number }>()
    for (const r of data) {
      const e = map.get(r.campaign_id) || { cost: 0, conv: 0 }
      e.cost += Number(r.cost_micros || 0) / 1e6
      e.conv += Number(r.conversions || 0)
      map.set(r.campaign_id, e)
    }
    return map
  }

  const currAgg = agg(curr || [])
  const prevAgg = agg(prev || [])

  const { data: campaigns } = await s.from('kotoiq_ads_campaigns')
    .select('id, name').eq('client_id', clientId)
  const nameMap = new Map((campaigns || []).map((c) => [c.id, c.name]))

  const movers: Array<{ entity: string; metric: string; delta_pct: number; direction: 'up' | 'down' }> = []
  for (const [cid, c] of currAgg) {
    const p = prevAgg.get(cid) || { cost: 0, conv: 0 }
    if (p.cost > 10) {
      const costDelta = ((c.cost - p.cost) / p.cost) * 100
      if (Math.abs(costDelta) > 20) {
        movers.push({ entity: nameMap.get(cid) || cid, metric: 'cost', delta_pct: costDelta, direction: costDelta > 0 ? 'up' : 'down' })
      }
    }
  }

  return movers.sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct)).slice(0, 10)
}

async function getCrossChannelSnapshot(
  s: SupabaseClient, clientId: string, period: { start: string; end: string }
) {
  const { data } = await s.from('kotoiq_ads_fact_ga4')
    .select('source, medium, sessions, conversions')
    .eq('client_id', clientId)
    .gte('date', period.start).lte('date', period.end)

  const map = new Map<string, { cost: number; conv: number }>()
  for (const r of data || []) {
    const channel = `${r.source || 'direct'} / ${r.medium || 'none'}`
    const e = map.get(channel) || { cost: 0, conv: 0 }
    e.conv += Number(r.conversions || 0)
    map.set(channel, e)
  }

  return [...map.entries()]
    .sort(([, a], [, b]) => b.conv - a.conv)
    .slice(0, 6)
    .map(([channel, m]) => ({
      channel,
      cost_usd: 0,
      conversions: m.conv,
      cpa_usd: 0,
    }))
}
