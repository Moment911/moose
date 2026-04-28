// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Wasted Spend Detection
// Finds search terms with $20+ spend, 0 conversions, 5+ clicks
// over rolling 30 days, then calls LLM to recommend negatives
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adsLLM } from './llmRouter'

export interface WastedSpendCandidate {
  search_term: string
  cost_usd: number
  clicks: number
  conversions: number
  ad_groups_seen_in: string[]
  first_seen: string
  last_seen: string
}

export async function findWastedSpend(
  s: SupabaseClient,
  body: { client_id: string }
): Promise<WastedSpendCandidate[]> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  // Use the wasted spend view
  const { data, error } = await s
    .from('v_kotoiq_ads_wasted_spend_30d' as any)
    .select('*')
    .eq('client_id', client_id)
    .order('cost_usd', { ascending: false })
    .limit(500)

  if (error) throw new Error(`Wasted spend query failed: ${error.message}`)
  if (!data?.length) return []

  return (data as any[]).map((r) => ({
    search_term: r.search_term,
    cost_usd: Number(r.cost_usd),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    ad_groups_seen_in: [],
    first_seen: r.first_seen || '',
    last_seen: r.last_seen || '',
  }))
}

export async function analyzeWastedSpend(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<{ candidates: number; recommendations: number; total_wasted_usd: number }> {
  const { client_id, agency_id } = body

  const candidates = await findWastedSpend(s, { client_id })
  if (!candidates.length) return { candidates: 0, recommendations: 0, total_wasted_usd: 0 }

  const totalWasted = candidates.reduce((sum, c) => sum + c.cost_usd, 0)

  // Get client summary for LLM context
  const { data: client } = await s.from('clients')
    .select('name, primary_service, target_customer, website')
    .eq('id', client_id).single()

  const clientSummary = client
    ? `${client.name || 'Client'}: ${client.primary_service || 'Unknown service'}. Target: ${client.target_customer || 'Unknown'}. Website: ${client.website || 'N/A'}`
    : 'Client details unavailable'

  // Send top 50 candidates to LLM for recommendation
  const top50 = candidates.slice(0, 50)
  const result = await adsLLM.run({
    task: 'recommend_negatives',
    clientId: client_id,
    agencyId: agency_id,
    input: {
      client_summary: clientSummary,
      candidates: top50.map((c) => ({
        search_term: c.search_term,
        cost_usd: c.cost_usd,
        clicks: c.clicks,
        conversions: c.conversions,
        ad_groups_seen_in: c.ad_groups_seen_in,
        first_seen_date: c.first_seen,
        last_seen_date: c.last_seen,
      })),
    },
  })

  const recs = (result.data as any)?.recommendations || []

  // Insert recommendations
  for (const rec of recs) {
    await s.from('kotoiq_ads_rec_negatives').insert({
      client_id,
      agency_id: agency_id || null,
      search_term: rec.search_term,
      proposed_match_type: rec.add_as,
      scope: rec.scope,
      reason: rec.reason,
      rationale_md: rec.reason,
      estimated_savings_usd: rec.estimated_monthly_savings_usd,
      model_used: result.usage.model,
      prompt_version: 1,
      supporting_data: { confidence: rec.confidence },
    })
  }

  return { candidates: candidates.length, recommendations: recs.length, total_wasted_usd: totalWasted }
}

export async function getWastedSpendResults(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const [candidates, recs] = await Promise.all([
    findWastedSpend(s, { client_id }),
    s.from('kotoiq_ads_rec_negatives')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const totalWasted = candidates.reduce((sum, c) => sum + c.cost_usd, 0)

  return {
    candidates,
    recommendations: recs.data || [],
    total_wasted_usd: totalWasted,
  }
}
