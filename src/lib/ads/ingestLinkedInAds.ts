// ─────────────────────────────────────────────────────────────
// Ads Intelligence — LinkedIn Ads ingestion
// Pulls campaign groups, campaigns, and daily analytics
// Stores in kotoiq_ads_* tables with platform='linkedin'
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureLinkedInToken } from './linkedinTokenRefresh'

const LI_API = 'https://api.linkedin.com/rest'
const LI_VERSION = '202401'

interface IngestResult {
  campaigns: number
  campaign_groups: number
  insights: number
  errors: string[]
}

async function liGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${LI_API}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'LinkedIn-Version': LI_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `LinkedIn API ${res.status}`)
  }
  return res.json()
}

export async function ingestLinkedInAds(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<IngestResult> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const result: IngestResult = { campaigns: 0, campaign_groups: 0, insights: 0, errors: [] }

  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'linkedin').single()
  if (!conn) throw new Error('No LinkedIn Ads connection found. Connect via KotoIQ Connect APIs tab.')

  const accountId = conn.account_id || conn.external_id
  if (!accountId) throw new Error('No LinkedIn Ad Account ID configured.')

  const token = await ensureLinkedInToken(s, conn)

  // ── Campaign Groups (→ kotoiq_ads_campaigns) ───────────────
  try {
    const groupData = await liGet(token, `/adAccounts/${accountId}/adCampaignGroups?q=search&count=100`)
    for (const g of groupData.elements || []) {
      const extId = String(g.id || '')
      if (!extId) continue

      await s.from('kotoiq_ads_campaigns').upsert({
        client_id,
        agency_id: agency_id || null,
        platform: 'linkedin',
        external_id: extId,
        name: g.name || 'Unknown',
        status: g.status || 'ACTIVE',
        channel: 'sponsored_content',
        budget_usd: g.totalBudget?.amount ? Number(g.totalBudget.amount) / 100 : null,
        metadata: { runSchedule: g.runSchedule },
      }, { onConflict: 'client_id,platform,external_id' })
      result.campaign_groups++
    }
  } catch (e: any) {
    result.errors.push(`Campaign Groups: ${e.message}`)
  }

  // ── Campaigns (→ kotoiq_ads_ad_groups) ─────────────────────
  try {
    const campData = await liGet(token, `/adAccounts/${accountId}/adCampaigns?q=search&count=200`)
    for (const c of campData.elements || []) {
      const extId = String(c.id || '')
      const groupExtId = String(c.campaignGroup?.replace(/.*:/, '') || '')

      const { data: groupRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('platform', 'linkedin').eq('external_id', groupExtId).single()

      if (groupRow) {
        await s.from('kotoiq_ads_ad_groups').upsert({
          client_id,
          campaign_id: groupRow.id,
          external_id: extId,
          name: c.name || 'Unknown',
          status: c.status || null,
        }, { onConflict: 'client_id,external_id' })
        result.campaigns++
      }
    }
  } catch (e: any) {
    result.errors.push(`Campaigns: ${e.message}`)
  }

  // ── Daily Analytics (→ kotoiq_ads_fact_campaigns) ──────────
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dateRange = `dateRange=(start:(year:${thirtyDaysAgo.getFullYear()},month:${thirtyDaysAgo.getMonth() + 1},day:${thirtyDaysAgo.getDate()}),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))`
    const analyticsData = await liGet(token,
      `/adAnalytics?q=analytics&pivot=CAMPAIGN_GROUP&${dateRange}&timeGranularity=DAILY&accounts=urn:li:sponsoredAccount:${accountId}&fields=externalWebsiteConversions,clicks,impressions,costInLocalCurrency,dateRange,pivotValue`
    )

    for (const row of analyticsData.elements || []) {
      const pivotUrn = row.pivotValue || ''
      const groupExtId = pivotUrn.replace(/.*:/, '')
      const dr = row.dateRange?.start
      if (!dr) continue
      const date = `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}`

      const { data: campRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('platform', 'linkedin').eq('external_id', groupExtId).single()
      if (!campRow) continue

      await s.from('kotoiq_ads_fact_campaigns').upsert({
        client_id,
        date,
        campaign_id: campRow.id,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        cost_micros: Math.round(Number(row.costInLocalCurrency || 0) * 1e6),
        conversions: Number(row.externalWebsiteConversions || 0),
        conversion_value: 0,
      }, { onConflict: 'client_id,date,campaign_id' })
      result.insights++
    }
  } catch (e: any) {
    result.errors.push(`Analytics: ${e.message}`)
  }

  return result
}
