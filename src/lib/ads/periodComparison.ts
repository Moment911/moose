// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Period-over-Period Comparison
// WoW/MoM deltas with efficiency flags + LLM narrative
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM } from './llmRouter'

export interface PeriodMetrics {
  cost_usd: number
  clicks: number
  conversions: number
  conversion_value: number
  impressions: number
  cpa_usd: number | null
  roas: number | null
  ctr: number
  cvr: number
  cpc_usd: number
}

export interface CampaignDelta {
  campaign_id: string
  name: string
  a: PeriodMetrics
  b: PeriodMetrics
  delta_pct: { cost: number; conversions: number; cpa: number; roas: number; ctr: number; cvr: number }
  flag: 'major_increase' | 'major_decrease' | 'efficiency_drop' | 'efficiency_gain' | null
}

function pct(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  if (a === 0) return 100
  return ((b - a) / Math.abs(a)) * 100
}

function toMetrics(m: { impressions: number; clicks: number; cost: number; conv: number; value: number }): PeriodMetrics {
  return {
    impressions: m.impressions,
    clicks: m.clicks,
    cost_usd: m.cost,
    conversions: m.conv,
    conversion_value: m.value,
    cpa_usd: m.conv > 0 ? m.cost / m.conv : null,
    roas: m.cost > 0 ? m.value / m.cost : null,
    ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
    cvr: m.clicks > 0 ? m.conv / m.clicks : 0,
    cpc_usd: m.clicks > 0 ? m.cost / m.clicks : 0,
  }
}

export async function comparePeriods(
  s: SupabaseClient,
  body: {
    client_id: string
    agency_id?: string
    period_a: { start: string; end: string }
    period_b: { start: string; end: string }
  }
): Promise<{ deltas: CampaignDelta[]; narrative?: { narrative_md: string; key_takeaways: string[] } }> {
  const { client_id, agency_id, period_a, period_b } = body
  if (!client_id) throw new Error('client_id required')

  // Fetch period A and B data
  const [{ data: dataA }, { data: dataB }] = await Promise.all([
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, impressions, clicks, cost_micros, conversions, conversion_value')
      .eq('client_id', client_id)
      .gte('date', period_a.start).lte('date', period_a.end),
    s.from('kotoiq_ads_fact_campaigns')
      .select('campaign_id, impressions, clicks, cost_micros, conversions, conversion_value')
      .eq('client_id', client_id)
      .gte('date', period_b.start).lte('date', period_b.end),
  ])

  // Aggregate by campaign
  const aggA = aggregate(dataA || [])
  const aggB = aggregate(dataB || [])

  // Get campaign names
  const allIds = new Set([...aggA.keys(), ...aggB.keys()])
  const { data: campaigns } = await s.from('kotoiq_ads_campaigns')
    .select('id, name').eq('client_id', client_id)
  const nameMap = new Map((campaigns || []).map((c) => [c.id, c.name]))

  const deltas: CampaignDelta[] = []
  for (const cid of allIds) {
    const a = aggA.get(cid) || { impressions: 0, clicks: 0, cost: 0, conv: 0, value: 0 }
    const b = aggB.get(cid) || { impressions: 0, clicks: 0, cost: 0, conv: 0, value: 0 }
    if (a.cost === 0 && b.cost === 0) continue

    const mA = toMetrics(a)
    const mB = toMetrics(b)
    const delta_pct = {
      cost: pct(mA.cost_usd, mB.cost_usd),
      conversions: pct(mA.conversions, mB.conversions),
      cpa: pct(mA.cpa_usd ?? 0, mB.cpa_usd ?? 0),
      roas: pct(mA.roas ?? 0, mB.roas ?? 0),
      ctr: pct(mA.ctr, mB.ctr),
      cvr: pct(mA.cvr, mB.cvr),
    }

    let flag: CampaignDelta['flag'] = null
    if (delta_pct.cost > 50 && delta_pct.conversions < 10) flag = 'efficiency_drop'
    else if (delta_pct.cost < -25 && delta_pct.conversions > 10) flag = 'efficiency_gain'
    else if (delta_pct.cost > 100) flag = 'major_increase'
    else if (delta_pct.cost < -50) flag = 'major_decrease'

    deltas.push({ campaign_id: cid, name: nameMap.get(cid) || 'Unknown', a: mA, b: mB, delta_pct, flag })
  }

  // Generate LLM narrative if there are meaningful deltas
  let narrative: { narrative_md: string; key_takeaways: string[] } | undefined
  if (deltas.some((d) => d.flag)) {
    const { data: client } = await s.from('clients')
      .select('name, primary_service').eq('id', client_id).single()

    const result = await adsLLM.run({
      task: 'period_comparison_narrative',
      clientId: client_id,
      agencyId: agency_id,
      input: {
        client_summary: `${client?.name || 'Client'}: ${client?.primary_service || 'Unknown'}`,
        period_a,
        period_b,
        campaign_deltas: deltas.map((d) => ({
          name: d.name, a: d.a, b: d.b, delta_pct: d.delta_pct, flag: d.flag,
        })),
        keyword_deltas: [],
        flags: deltas.filter((d) => d.flag).map((d) => ({ entity: d.name, flag: d.flag })),
      },
    })
    narrative = result.data as any
  }

  return { deltas, narrative }
}

function aggregate(rows: any[]): Map<string, { impressions: number; clicks: number; cost: number; conv: number; value: number }> {
  const map = new Map<string, { impressions: number; clicks: number; cost: number; conv: number; value: number }>()
  for (const r of rows) {
    const existing = map.get(r.campaign_id) || { impressions: 0, clicks: 0, cost: 0, conv: 0, value: 0 }
    existing.impressions += Number(r.impressions || 0)
    existing.clicks += Number(r.clicks || 0)
    existing.cost += Number(r.cost_micros || 0) / 1e6
    existing.conv += Number(r.conversions || 0)
    existing.value += Number(r.conversion_value || 0)
    map.set(r.campaign_id, existing)
  }
  return map
}
