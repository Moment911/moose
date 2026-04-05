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

async function getToken(clientId: string): Promise<{token: string|null, customerId: string|null}> {
  const { data: conn } = await getSupabase().from('seo_connections')
    .select('*').eq('client_id', clientId).eq('provider', 'ads').single()
  if (!conn?.access_token) return { token: null, customerId: null }

  let token = conn.access_token
  if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '',
        refresh_token: conn.refresh_token,
        grant_type:    'refresh_token',
      })
    })
    const data = await res.json()
    if (data.access_token) {
      token = data.access_token
      await getSupabase().from('seo_connections').update({ access_token: token,
        token_expires_at: new Date(Date.now()+(data.expires_in||3600)*1000).toISOString()
      }).eq('id', conn.id)
    }
  }
  return { token, customerId: conn.account_id?.replace(/-/g,'') || null }
}

async function adsRequest(token: string, customerId: string, endpoint: string, body: any) {
  const res = await fetch(`${ADS_API}/customers/${customerId}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Ads API ${res.status}: ${JSON.stringify(err).slice(0,200)}`)
  }
  return res.json()
}

// ── Action handlers — each returns { success, detail, rollback_data } ─────────

async function applyNegativeKeywords(token: string, customerId: string, rec: any) {
  const terms: string[] = rec.recommended?.search_terms || []
  if (!terms.length) return { success: false, detail: 'No search terms provided' }

  // Get all campaign IDs for this client
  const { data: campaigns } = await getSupabase().from('perf_campaigns')
    .select('ads_campaign_id').eq('client_id', rec.client_id)

  if (!campaigns?.length) return { success: false, detail: 'No campaigns found' }

  const operations = []
  for (const camp of campaigns.slice(0, 3)) { // apply to top 3 campaigns
    for (const term of terms.slice(0, 20)) {
      operations.push({
        campaignCriterionOperation: {
          create: {
            campaign: `customers/${customerId}/campaigns/${camp.ads_campaign_id}`,
            negative: true,
            keyword: { text: term, matchType: 'BROAD' }
          }
        }
      })
    }
  }

  const result = await adsRequest(token, customerId, 'campaignCriteria:mutate', {
    operations: operations.slice(0, 50) // API limit
  })

  return {
    success: true,
    detail: `Added ${Math.min(terms.length, 20)} negative keywords across ${Math.min(campaigns.length, 3)} campaigns`,
    rollback_data: { type: 'negative_keywords', terms, campaign_ids: campaigns.map(c=>c.ads_campaign_id) },
    api_result: result,
  }
}

async function applyBudgetChange(token: string, customerId: string, rec: any) {
  const campaignName: string = rec.recommended?.campaign || rec.current_state?.campaign_name || ''
  const lostISPct: number = rec.current_state?.lost_is_budget || 20

  // Find the campaign
  const { data: camp } = await getSupabase().from('perf_campaigns')
    .select('*').eq('client_id', rec.client_id)
    .ilike('name', `%${campaignName}%`).single()

  if (!camp) return { success: false, detail: `Campaign "${campaignName}" not found` }

  const currentBudget = camp.budget_amount || 0
  // Increase by proportion of lost IS, capped at 30%
  const increaseMultiplier = Math.min(1 + (lostISPct / 100), 1.30)
  const newBudget = Math.round(currentBudget * increaseMultiplier * 100) / 100
  const newBudgetMicros = Math.round(newBudget * 1_000_000)

  // Get budget resource name via GAQL
  const budgetRows = await adsRequest(token, customerId, 'googleAds:search', {
    query: `SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign_budget WHERE campaign.id = ${camp.ads_campaign_id}`
  })
  const budgetResourceName = budgetRows.results?.[0]?.campaignBudget?.resourceName
  if (!budgetResourceName) return { success: false, detail: 'Could not find budget resource' }

  const result = await adsRequest(token, customerId, 'campaignBudgets:mutate', {
    operations: [{
      update: { resourceName: budgetResourceName, amountMicros: newBudgetMicros },
      updateMask: 'amount_micros'
    }]
  })

  return {
    success: true,
    detail: `Increased "${campaignName}" daily budget from $${currentBudget.toFixed(2)} to $${newBudget.toFixed(2)} (+${((increaseMultiplier-1)*100).toFixed(0)}%)`,
    rollback_data: { type: 'budget_change', campaign_id: camp.ads_campaign_id, previous_budget_micros: Math.round(currentBudget*1_000_000), new_budget_micros: newBudgetMicros, budget_resource: budgetResourceName },
    api_result: result,
  }
}

async function applyKeywordPause(token: string, customerId: string, rec: any) {
  const keywords: string[] = rec.recommended?.keywords || []
  if (!keywords.length) return { success: false, detail: 'No keywords specified' }

  // Find keyword IDs in our DB
  const { data: kwRows } = await getSupabase().from('perf_keywords')
    .select('ads_keyword_id, keyword, ad_group_id')
    .eq('client_id', rec.client_id)
    .in('keyword', keywords)

  if (!kwRows?.length) return { success: false, detail: 'Keywords not found in database — re-sync first' }

  // Get ad group resource names
  const { data: agRows } = await getSupabase().from('perf_ad_groups')
    .select('ads_adgroup_id, id')
    .in('id', kwRows.map(k=>k.ad_group_id).filter(Boolean))

  const agMap: Record<string,string> = {}
  for (const ag of agRows||[]) agMap[ag.id] = ag.ads_adgroup_id

  const operations = kwRows.slice(0, 20).map(kw => ({
    update: {
      resourceName: `customers/${customerId}/adGroupCriteria/${agMap[kw.ad_group_id]}~${kw.ads_keyword_id}`,
      status: 'PAUSED'
    },
    updateMask: 'status'
  }))

  if (!operations.length) return { success: false, detail: 'No valid keyword operations built' }

  const result = await adsRequest(token, customerId, 'adGroupCriteria:mutate', { operations })

  return {
    success: true,
    detail: `Paused ${operations.length} keywords: ${keywords.slice(0,5).join(', ')}${keywords.length>5?'…':''}`,
    rollback_data: { type: 'keyword_pause', keyword_ids: kwRows.map(k=>k.ads_keyword_id), keywords },
    api_result: result,
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { recId, clientId, agencyId, agentName } = await req.json()
  if (!recId || !clientId) return NextResponse.json({ error: 'recId and clientId required' }, { status: 400 })

  // Load the recommendation
  const { data: rec } = await getSupabase().from('perf_recommendations')
    .select('*').eq('id', recId).single()
  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
  if (rec.status === 'applied') return NextResponse.json({ error: 'Already applied' }, { status: 400 })

  // Get Google Ads token
  const { token, customerId } = await getToken(clientId)

  let executionResult: any
  let success = false
  let errorMsg = ''

  // Dry-run mode if no token (advisory only)
  const dryRun = !token || !customerId

  try {
    if (dryRun) {
      // No Ads connection — mark as applied without API call
      executionResult = {
        success: true,
        detail: `[Advisory mode] Marked as applied — connect Google Ads to push changes automatically`,
        dry_run: true,
      }
      success = true
    } else {
      // Route to correct handler based on recommendation type
      const action = rec.recommended?.action || ''

      if (rec.type === 'negative_keyword' || action === 'add_negatives') {
        executionResult = await applyNegativeKeywords(token!, customerId!, rec)
      } else if (rec.type === 'budget' || action === 'increase_budget') {
        executionResult = await applyBudgetChange(token!, customerId!, rec)
      } else if (rec.type === 'keyword_pause' || action === 'pause_or_review') {
        executionResult = await applyKeywordPause(token!, customerId!, rec)
      } else {
        // For types we can't automate yet, mark as advisory applied
        executionResult = {
          success: true,
          detail: `[Advisory] "${rec.type}" changes require manual implementation in Google Ads. Recommendation marked as acknowledged.`,
          dry_run: true,
        }
      }
      success = executionResult.success
      if (!success) errorMsg = executionResult.detail
    }
  } catch(e: any) {
    errorMsg = e.message
    executionResult = { success: false, detail: e.message }
  }

  // Log to execution history
  const { data: log } = await getSupabase().from('perf_execution_log').insert({
    rec_id:       recId,
    client_id:    clientId,
    agency_id:    agencyId,
    rec_type:     rec.type,
    rec_title:    rec.title,
    status:       success ? 'success' : 'failed',
    detail:       executionResult.detail,
    error:        errorMsg || null,
    rollback_data: executionResult.rollback_data || null,
    dry_run:      executionResult.dry_run || false,
    applied_by:   agentName || 'Agency',
    applied_at:   new Date().toISOString(),
  }).select().single()

  // Update recommendation status
  await getSupabase().from('perf_recommendations').update({
    status:     success ? 'applied' : 'failed',
    applied_at: new Date().toISOString(),
  }).eq('id', recId)

  return NextResponse.json({
    success,
    detail:      executionResult.detail,
    dry_run:     executionResult.dry_run || false,
    log_id:      log?.id,
    error:       errorMsg || undefined,
  })
}