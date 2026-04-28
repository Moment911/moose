// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Intent Gap Detection
// Finds GSC queries with 100+ impressions not covered by Ads keywords
// LLM recommends new keywords to add
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM } from './llmRouter'

export interface IntentGap {
  query: string
  gsc_impressions: number
  gsc_clicks: number
  avg_position: number
  ads_coverage: 'none' | 'partial'
}

export async function findIntentGaps(
  s: SupabaseClient,
  body: { client_id: string; min_impressions?: number }
): Promise<IntentGap[]> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')
  const minImp = body.min_impressions ?? 100

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]

  // Get GSC queries grouped
  const { data: gscData } = await s.from('kotoiq_ads_fact_gsc')
    .select('query, impressions, clicks, position')
    .eq('client_id', client_id)
    .gte('date', startDate)

  if (!gscData?.length) return []

  // Aggregate GSC by query
  const gscMap = new Map<string, { impressions: number; clicks: number; positions: number[] }>()
  for (const row of gscData) {
    const q = (row.query || '').toLowerCase()
    if (!q) continue
    const existing = gscMap.get(q) || { impressions: 0, clicks: 0, positions: [] }
    existing.impressions += Number(row.impressions || 0)
    existing.clicks += Number(row.clicks || 0)
    if (row.position) existing.positions.push(Number(row.position))
    gscMap.set(q, existing)
  }

  // Get existing keywords
  const { data: kwData } = await s.from('kotoiq_ads_keywords')
    .select('text').eq('client_id', client_id)
  const kwSet = new Set((kwData || []).map((k) => (k.text || '').toLowerCase()))

  // Get search terms that have appeared in ads
  const { data: stData } = await s.from('kotoiq_ads_fact_search_terms')
    .select('search_term')
    .eq('client_id', client_id)
    .gte('date', startDate)
    .gt('clicks', 0)
  const stSet = new Set((stData || []).map((st) => (st.search_term || '').toLowerCase()))

  // Find gaps
  const gaps: IntentGap[] = []
  for (const [query, agg] of gscMap) {
    if (agg.impressions < minImp) continue
    if (kwSet.has(query)) continue // already an exact keyword

    const avgPos = agg.positions.length
      ? agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length
      : 0

    gaps.push({
      query,
      gsc_impressions: agg.impressions,
      gsc_clicks: agg.clicks,
      avg_position: Math.round(avgPos * 10) / 10,
      ads_coverage: stSet.has(query) ? 'partial' : 'none',
    })
  }

  gaps.sort((a, b) => b.gsc_impressions - a.gsc_impressions)
  return gaps.slice(0, 200)
}

export async function analyzeIntentGaps(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<{ gaps_found: number; recommendations: number }> {
  const { client_id, agency_id } = body
  const gaps = await findIntentGaps(s, { client_id })
  if (!gaps.length) return { gaps_found: 0, recommendations: 0 }

  // Get client context
  const { data: client } = await s.from('clients')
    .select('name, primary_service, target_customer').eq('id', client_id).single()
  const clientSummary = `${client?.name || 'Client'}: ${client?.primary_service || 'Unknown'}. Target: ${client?.target_customer || 'Unknown'}`

  // Get existing keywords sample
  const { data: kwSample } = await s.from('kotoiq_ads_keywords')
    .select('text').eq('client_id', client_id).limit(200)

  // Get ad groups for placement
  const { data: adGroups } = await s.from('kotoiq_ads_ad_groups')
    .select('id, name').eq('client_id', client_id)

  // Get settings for target CPA
  const { data: settings } = await s.from('kotoiq_ads_settings')
    .select('target_cpa_usd').eq('client_id', client_id).single()

  const result = await adsLLM.run({
    task: 'recommend_new_keywords',
    clientId: client_id,
    agencyId: agency_id,
    input: {
      client_summary: clientSummary,
      existing_keywords_sample: (kwSample || []).map((k) => k.text),
      gsc_query_gaps: gaps.slice(0, 100).map((g) => ({
        query: g.query,
        impressions: g.gsc_impressions,
        clicks: g.gsc_clicks,
        avg_position: g.avg_position,
      })),
      ad_group_options: (adGroups || []).map((ag) => ({
        id: ag.id, name: ag.name, theme: ag.name,
      })),
      target_cpa_usd: settings?.target_cpa_usd ? Number(settings.target_cpa_usd) : undefined,
    },
  })

  const recs = (result.data as any)?.recommendations || []

  for (const rec of recs) {
    await s.from('kotoiq_ads_rec_new_keywords').insert({
      client_id,
      agency_id: agency_id || null,
      keyword: rec.keyword,
      proposed_match_type: rec.match_type,
      proposed_ad_group: rec.proposed_ad_group_id,
      rationale_md: rec.rationale,
      est_monthly_clicks: rec.estimated_monthly_clicks,
      est_cpc_usd: rec.estimated_cpc_usd,
      intent: rec.intent,
      priority: rec.priority,
      model_used: result.usage.model,
      prompt_version: 1,
    })
  }

  return { gaps_found: gaps.length, recommendations: recs.length }
}

export async function getIntentGapResults(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const [gaps, recs] = await Promise.all([
    findIntentGaps(s, { client_id }),
    s.from('kotoiq_ads_rec_new_keywords')
      .select('*').eq('client_id', client_id)
      .order('created_at', { ascending: false }).limit(100),
  ])

  return { gaps, recommendations: recs.data || [] }
}
