// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Google Ads ingestion engine
// Reuses perfMarketing.js fetch functions, writes to kotoiq_ads_* tables
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchGoogleAdsCampaigns, fetchGoogleAdsKeywords, fetchSearchTerms } from '@/lib/perfMarketing'

export interface IngestResult {
  campaigns: number
  ad_groups: number
  keywords: number
  search_terms: number
  errors: string[]
}

export async function ingestGoogleAds(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<IngestResult> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const result: IngestResult = { campaigns: 0, ad_groups: 0, keywords: 0, search_terms: 0, errors: [] }

  // Get ads connection using the service-role client (bypasses RLS)
  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'ads').single()
  if (!conn) throw new Error('No Google Ads connection found for this client. Connect via KotoIQ Connect APIs tab.')

  const customerId = (conn.account_id || conn.customer_id || conn.external_id || '').replace(/-/g, '')
  if (!customerId) throw new Error('No Google Ads customer ID configured. Set the Account ID in the Connect APIs tab.')

  // ── Campaigns ──────────────────────────────────────────────
  try {
    const rawCampaigns = await fetchGoogleAdsCampaigns(conn, customerId)
    for (const row of rawCampaigns) {
      const c = row.campaign || {}
      const m = row.metrics || {}
      const b = row.campaignBudget || {}
      const externalId = String(c.id || c.resourceName?.split('/')?.pop() || '')
      if (!externalId) continue

      // Upsert dimension
      const { data: camp } = await s.from('kotoiq_ads_campaigns').upsert({
        client_id,
        agency_id: agency_id || null,
        platform: 'google_ads',
        external_id: externalId,
        name: c.name || 'Unknown',
        status: c.status || 'UNKNOWN',
        channel: c.advertisingChannelType || null,
        budget_usd: b.amountMicros ? Number(b.amountMicros) / 1e6 : null,
        metadata: { bidding_strategy: c.biddingStrategyType, target_cpa: c.targetCpa, target_roas: c.targetRoas },
      }, { onConflict: 'client_id,platform,external_id' }).select('id').single()

      if (camp) {
        // Upsert fact (daily aggregated from the API response)
        const today = new Date().toISOString().split('T')[0]
        await s.from('kotoiq_ads_fact_campaigns').upsert({
          client_id,
          date: today,
          campaign_id: camp.id,
          impressions: Number(m.impressions || 0),
          clicks: Number(m.clicks || 0),
          cost_micros: Number(m.costMicros || 0),
          conversions: Number(m.conversions || 0),
          conversion_value: Number(m.conversionsValue || 0),
        }, { onConflict: 'client_id,date,campaign_id' })
        result.campaigns++
      }
    }
  } catch (e: any) {
    result.errors.push(`Campaigns: ${e.message}`)
  }

  // ── Keywords + Ad Groups ───────────────────────────────────
  try {
    const rawKeywords = await fetchGoogleAdsKeywords(conn, customerId)
    const adGroupCache = new Map<string, string>() // external_id → uuid

    for (const row of rawKeywords) {
      const ag = row.adGroup || {}
      const criterion = row.adGroupCriterion || {}
      const kw = criterion.keyword || {}
      const m = row.metrics || {}
      const campaign = row.campaign || {}

      const agExtId = String(ag.id || ag.resourceName?.split('/')?.pop() || '')
      const campaignExtId = String(campaign.id || campaign.resourceName?.split('/')?.pop() || '')

      // Resolve campaign
      const { data: campRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('external_id', campaignExtId).single()
      if (!campRow) continue

      // Upsert ad group
      if (agExtId && !adGroupCache.has(agExtId)) {
        const { data: agRow } = await s.from('kotoiq_ads_ad_groups').upsert({
          client_id,
          campaign_id: campRow.id,
          external_id: agExtId,
          name: ag.name || 'Unknown',
          status: ag.status || null,
        }, { onConflict: 'client_id,external_id' }).select('id').single()
        if (agRow) {
          adGroupCache.set(agExtId, agRow.id)
          result.ad_groups++
        }
      }

      const agUuid = adGroupCache.get(agExtId)
      if (!agUuid) continue

      // Upsert keyword
      const kwExtId = String(criterion.criterionId || criterion.resourceName?.split('/')?.pop() || '')
      if (!kwExtId || !kw.text) continue

      const matchType = (kw.matchType || 'BROAD').toLowerCase().replace('_', '') as 'exact' | 'phrase' | 'broad'
      const { data: kwRow } = await s.from('kotoiq_ads_keywords').upsert({
        client_id,
        ad_group_id: agUuid,
        external_id: kwExtId,
        text: kw.text,
        match_type: ['exact', 'phrase', 'broad'].includes(matchType) ? matchType : 'broad',
        status: criterion.status || null,
        quality_score: criterion.qualityInfo?.qualityScore || null,
      }, { onConflict: 'client_id,external_id' }).select('id').single()

      if (kwRow) {
        const today = new Date().toISOString().split('T')[0]
        await s.from('kotoiq_ads_fact_keywords').upsert({
          client_id,
          date: today,
          keyword_id: kwRow.id,
          impressions: Number(m.impressions || 0),
          clicks: Number(m.clicks || 0),
          cost_micros: Number(m.costMicros || 0),
          conversions: Number(m.conversions || 0),
          conversion_value: Number(m.conversionsValue || 0),
          quality_score: criterion.qualityInfo?.qualityScore || null,
        }, { onConflict: 'client_id,date,keyword_id' })
        result.keywords++
      }
    }
  } catch (e: any) {
    result.errors.push(`Keywords: ${e.message}`)
  }

  // ── Search Terms ───────────────────────────────────────────
  try {
    const rawTerms = await fetchSearchTerms(conn, customerId)
    for (const row of rawTerms) {
      const st = row.searchTermView || {}
      const m = row.metrics || {}
      const campaign = row.campaign || {}
      const ag = row.adGroup || {}

      const searchTerm = st.searchTerm
      if (!searchTerm) continue

      const campaignExtId = String(campaign.id || campaign.resourceName?.split('/')?.pop() || '')
      const agExtId = String(ag.id || ag.resourceName?.split('/')?.pop() || '')

      // Resolve campaign + ad group
      const { data: campRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('external_id', campaignExtId).single()
      const { data: agRow } = await s.from('kotoiq_ads_ad_groups')
        .select('id').eq('client_id', client_id).eq('external_id', agExtId).single()

      const today = new Date().toISOString().split('T')[0]
      await s.from('kotoiq_ads_fact_search_terms').upsert({
        client_id,
        date: today,
        campaign_id: campRow?.id || null,
        ad_group_id: agRow?.id || null,
        search_term: searchTerm,
        match_type_used: st.status || null,
        impressions: Number(m.impressions || 0),
        clicks: Number(m.clicks || 0),
        cost_micros: Number(m.costMicros || 0),
        conversions: Number(m.conversions || 0),
        conversion_value: 0,
      }, { onConflict: 'client_id,date,ad_group_id,search_term' })
      result.search_terms++
    }
  } catch (e: any) {
    result.errors.push(`Search terms: ${e.message}`)
  }

  return result
}
