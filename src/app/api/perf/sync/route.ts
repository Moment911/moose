import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const ADS_API = 'https://googleads.googleapis.com/v17'

async function getToken(connection: any): Promise<string|null> {
  if (!connection?.access_token) return null
  if (connection.token_expires_at && new Date(connection.token_expires_at) > new Date()) {
    return connection.access_token
  }
  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '',
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    })
  })
  const data = await res.json()
  if (data.access_token) {
    await getSupabase().from('seo_connections').update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in||3600)*1000).toISOString()
    }).eq('id', connection.id)
    return data.access_token
  }
  return null
}

async function adsQuery(token: string, customerId: string, query: string) {
  const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Ads ${res.status}`) }
  const data = await res.json()
  return data.results || []
}

export async function POST(req: NextRequest) {
  const { clientId, agencyId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'No clientId' }, { status: 400 })

  const { data: adsConn } = await getSupabase().from('seo_connections')
    .select('*').eq('client_id', clientId).eq('provider', 'ads').single()

  let campaignCount = 0, keywordCount = 0, searchTermCount = 0

  if (adsConn?.connected && adsConn.account_id) {
    const token = await getToken(adsConn)
    if (token) {
      const customerId = adsConn.account_id.replace(/-/g, '')
      try {
        // Sync campaigns
        const campaignRows = await adsQuery(token, customerId, `
          SELECT campaign.id, campaign.name, campaign.status,
            campaign.advertising_channel_type, campaign.bidding_strategy_type,
            campaign_budget.amount_micros, campaign_budget.type,
            campaign.target_cpa.target_cpa_micros, campaign.target_roas.target_roas,
            metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.conversions_value, metrics.ctr,
            metrics.average_cpc, metrics.search_impression_share,
            metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
          FROM campaign
          WHERE campaign.status != 'REMOVED'
          AND segments.date DURING LAST_30_DAYS
        `)

        for (const row of campaignRows) {
          const c = row.campaign, m = row.metrics, b = row.campaignBudget
          const cost = (m?.costMicros||0) / 1_000_000
          const convVal = m?.conversionsValue || 0
          const convs   = m?.conversions || 0
          await getSupabase().from('perf_campaigns').upsert({
            client_id:        clientId,
            agency_id:        agencyId,
            ads_campaign_id:  c.id,
            name:             c.name,
            status:           c.status,
            campaign_type:    c.advertisingChannelType,
            budget_amount:    (b?.amountMicros||0) / 1_000_000,
            bidding_strategy: c.biddingStrategyType,
            target_cpa:       (c.targetCpa?.targetCpaMicros||0) / 1_000_000,
            target_roas:      c.targetRoas?.targetRoas || null,
            impressions:      m?.impressions || 0,
            clicks:           m?.clicks || 0,
            cost,
            conversions:      convs,
            conv_value:       convVal,
            ctr:              (m?.ctr||0) * 100,
            avg_cpc:          (m?.averageCpc||0) / 1_000_000,
            cpa:              convs > 0 ? cost/convs : null,
            roas:             cost > 0 ? convVal/cost : null,
            impression_share: (m?.searchImpressionShare||0) * 100,
            lost_is_budget:   (m?.searchBudgetLostImpressionShare||0) * 100,
            lost_is_rank:     (m?.searchRankLostImpressionShare||0) * 100,
            metrics_start:    new Date(Date.now()-30*86400000).toISOString().split('T')[0],
            metrics_end:      new Date().toISOString().split('T')[0],
            synced_at:        new Date().toISOString(),
          }, { onConflict: 'ads_campaign_id,client_id' })
          campaignCount++
        }

        // Sync keywords
        const kwRows = await adsQuery(token, customerId, `
          SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type, ad_group_criterion.status,
            ad_group_criterion.effective_cpc_bid_micros,
            ad_group_criterion.quality_info.quality_score,
            ad_group_criterion.position_estimates.first_page_cpc_micros,
            ad_group.id, campaign.id,
            metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.average_cpc
          FROM keyword_view
          WHERE ad_group_criterion.status != 'REMOVED'
          AND segments.date DURING LAST_30_DAYS
          ORDER BY metrics.cost_micros DESC LIMIT 500
        `)

        for (const row of kwRows) {
          const kw = row.adGroupCriterion, m = row.metrics
          // Find or create ad group record
          const { data: ag } = await getSupabase().from('perf_ad_groups')
            .select('id').eq('ads_adgroup_id', row.adGroup?.id).eq('client_id', clientId).single()

          const cost = (m?.costMicros||0)/1_000_000
          const convs = m?.conversions||0
          await getSupabase().from('perf_keywords').upsert({
            client_id:      clientId,
            ad_group_id:    ag?.id || null,
            ads_keyword_id: kw?.criterionId,
            keyword:        kw?.keyword?.text || '',
            match_type:     kw?.keyword?.matchType,
            status:         kw?.status,
            bid:            (kw?.effectiveCpcBidMicros||0)/1_000_000,
            avg_cpc:        (m?.averageCpc||0)/1_000_000,
            impressions:    m?.impressions||0,
            clicks:         m?.clicks||0,
            cost,
            conversions:    convs,
            conv_rate:      m?.clicks > 0 ? convs/m.clicks : null,
            quality_score:  kw?.qualityInfo?.qualityScore||null,
            first_page_bid: (kw?.positionEstimates?.firstPageCpcMicros||0)/1_000_000,
            synced_at:      new Date().toISOString(),
          }, { onConflict: 'ads_keyword_id,client_id' })
          keywordCount++
        }

      } catch(e: any) {
        console.error('[Sync] Ads error:', e.message)
      }
    }
  }

  // Also sync GA4 snapshot if connected
  const today = new Date().toISOString().split('T')[0]
  await getSupabase().from('perf_snapshots').upsert({
    client_id: clientId, snapshot_date: today,
  }, { onConflict: 'client_id,snapshot_date' })

  return NextResponse.json({ campaigns: campaignCount, keywords: keywordCount, searchTerms: searchTermCount, synced_at: new Date().toISOString() })
}