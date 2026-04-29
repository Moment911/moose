// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Meta (Facebook/Instagram) Ads ingestion
// Pulls campaigns, ad sets, and daily insights from Meta Marketing API
// Stores in kotoiq_ads_* tables with platform='meta'
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureMetaToken } from './metaTokenRefresh'

const META_API = 'https://graph.facebook.com/v21.0'

interface IngestResult {
  campaigns: number
  ad_sets: number
  insights: number
  errors: string[]
}

async function metaGet(token: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${META_API}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Meta API ${res.status}`)
  }
  return res.json()
}

export async function ingestMetaAds(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
): Promise<IngestResult> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const result: IngestResult = { campaigns: 0, ad_sets: 0, insights: 0, errors: [] }

  // Get Meta connection
  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'meta').single()
  if (!conn) throw new Error('No Meta Ads connection found. Connect via KotoIQ Connect APIs tab.')

  const accountId = (conn.account_id || conn.external_id || '').replace(/^act_/, '')
  if (!accountId) throw new Error('No Meta Ad Account ID configured.')

  const token = await ensureMetaToken(s, conn)

  // ── Campaigns ──────────────────────────────────────────────
  try {
    const campData = await metaGet(token, `/act_${accountId}/campaigns`, {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,effective_status',
      limit: '500',
    })

    for (const c of campData.data || []) {
      const { data: camp } = await s.from('kotoiq_ads_campaigns').upsert({
        client_id,
        agency_id: agency_id || null,
        platform: 'meta',
        external_id: c.id,
        name: c.name || 'Unknown',
        status: c.effective_status || c.status || 'UNKNOWN',
        channel: c.objective || null,
        budget_usd: c.daily_budget ? Number(c.daily_budget) / 100 : c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        metadata: { objective: c.objective },
      }, { onConflict: 'client_id,platform,external_id' }).select('id').single()

      if (camp) result.campaigns++
    }
  } catch (e: any) {
    result.errors.push(`Campaigns: ${e.message}`)
  }

  // ── Ad Sets (→ kotoiq_ads_ad_groups) ───────────────────────
  try {
    const adSetData = await metaGet(token, `/act_${accountId}/adsets`, {
      fields: 'id,name,status,campaign_id,daily_budget,effective_status',
      limit: '500',
    })

    for (const as of adSetData.data || []) {
      const { data: campRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('platform', 'meta').eq('external_id', as.campaign_id).single()
      if (!campRow) continue

      await s.from('kotoiq_ads_ad_groups').upsert({
        client_id,
        campaign_id: campRow.id,
        external_id: as.id,
        name: as.name || 'Unknown',
        status: as.effective_status || as.status || null,
      }, { onConflict: 'client_id,external_id' })
      result.ad_sets++
    }
  } catch (e: any) {
    result.errors.push(`Ad Sets: ${e.message}`)
  }

  // ── Daily Insights (→ kotoiq_ads_fact_campaigns) ───────────
  try {
    const insightsData = await metaGet(token, `/act_${accountId}/insights`, {
      fields: 'campaign_id,impressions,clicks,spend,actions,action_values',
      level: 'campaign',
      date_preset: 'last_30d',
      time_increment: '1',
      limit: '5000',
    })

    for (const row of insightsData.data || []) {
      const { data: campRow } = await s.from('kotoiq_ads_campaigns')
        .select('id').eq('client_id', client_id).eq('platform', 'meta').eq('external_id', row.campaign_id).single()
      if (!campRow) continue

      // Parse conversions from actions array
      const actions = row.actions || []
      const conversions = actions
        .filter((a: any) => ['offsite_conversion', 'lead', 'purchase', 'complete_registration'].some(t => a.action_type?.includes(t)))
        .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

      const actionValues = row.action_values || []
      const conversionValue = actionValues
        .filter((a: any) => a.action_type?.includes('purchase') || a.action_type?.includes('offsite_conversion'))
        .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

      await s.from('kotoiq_ads_fact_campaigns').upsert({
        client_id,
        date: row.date_start,
        campaign_id: campRow.id,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        cost_micros: Math.round(Number(row.spend || 0) * 1e6), // Meta reports USD, convert to micros
        conversions,
        conversion_value: conversionValue,
      }, { onConflict: 'client_id,date,campaign_id' })
      result.insights++
    }
  } catch (e: any) {
    result.errors.push(`Insights: ${e.message}`)
  }

  return result
}
