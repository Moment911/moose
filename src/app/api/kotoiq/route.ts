import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData, fetchGA4Data } from '@/lib/seoService'
import { fetchGoogleAdsKeywords, fetchGoogleAdsCampaigns } from '@/lib/perfMarketing'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fingerprint(kw: string): string {
  return kw.toLowerCase().trim().replace(/\s+/g, ' ')
}

function micros(n: string | number | null): number {
  return Math.round(parseInt(String(n || '0')) / 1000000 * 100) // cents
}

function pct(n: string | number | null): number {
  return parseFloat(String(n || '0'))
}

// ── Detect intent from keyword ──────────────────────────────────────────────
function classifyIntent(kw: string): string {
  const lc = kw.toLowerCase()
  if (/\b(buy|price|cost|quote|hire|book|schedule|near me|emergency|same day|24.?hour|free estimate)\b/.test(lc)) return 'transactional'
  if (/\b(best|top|vs|review|compare|affordable|cheap|rated)\b/.test(lc)) return 'commercial'
  if (/\b(how|what|why|when|does|can|is|are|guide|tips|ideas)\b/.test(lc)) return 'informational'
  if (/\b(login|sign in|phone number|address|hours|website)\b/.test(lc)) return 'navigational'
  return 'commercial' // default for local service keywords
}

// ── Scoring: Opportunity Score ──────────────────────────────────────────────
function computeOpportunityScore(kw: any): number {
  const intentMap: Record<string, number> = { transactional: 1.3, commercial: 1.1, informational: 0.8, navigational: 0.6 }
  const intentMultiplier = intentMap[kw.intent] || 1.0

  // Normalize volume (0-1, cap at 5000 monthly)
  const normVolume = Math.min((kw.kp_monthly_volume || 0) / 5000, 1)

  // Normalize conversion rate from Ads (0-1)
  const adsClicks = kw.ads_clicks || 0
  const adsConv = kw.ads_conversions || 0
  const normCVR = adsClicks > 10 ? Math.min(adsConv / adsClicks / 0.15, 1) : 0.5 // 15% = perfect score

  // Normalize rank gap (how far from #1)
  const pos = kw.sc_avg_position || 50
  const normRankGap = pos <= 3 ? 0 : Math.min((pos - 3) / 47, 1) // 3→0, 50→1

  // Normalize paid waste (paying for clicks you could earn organically)
  const paidWaste = (pos <= 5 && adsClicks > 0) ? Math.min((kw.ads_cost_cents || 0) / 50000, 1) : 0

  // Trend momentum (SC impressions growth — simplified for now)
  const normTrend = 0.5 // placeholder until we have historical data

  const raw = (
    0.25 * normVolume +
    0.30 * normCVR +
    0.20 * normRankGap +
    0.15 * paidWaste +
    0.10 * normTrend
  ) * intentMultiplier

  return Math.round(Math.min(raw * 100, 100) * 100) / 100
}

// ── Scoring: Rank Propensity ────────────────────────────────────────────────
function computeRankPropensity(kw: any, clientDA: number): number {
  // DA gap score
  const compDA = kw.competitor_avg_da || 40
  const daGap = Math.max(0, 1 - ((compDA - clientDA) / 50))

  // CTR signal (higher CTR at current position = Google may rank you higher)
  const expectedCTR = kw.sc_avg_position ? 0.35 / kw.sc_avg_position : 0
  const actualCTR = kw.sc_ctr || 0
  const ctrSignal = expectedCTR > 0 ? Math.min(actualCTR / expectedCTR, 1.5) / 1.5 : 0.5

  // Position signal (closer to top 3 = easier to push)
  const pos = kw.sc_avg_position || 50
  const positionScore = pos <= 3 ? 1.0 : pos <= 10 ? 0.8 : pos <= 20 ? 0.5 : 0.2

  // Local boost
  const localBoost = /near me|city|town|local/i.test(kw.keyword) ? 0.15 : 0

  const raw = (
    0.25 * daGap +
    0.20 * positionScore +
    0.15 * ctrSignal +
    0.15 * 0.5 + // topical authority placeholder
    0.10 * 0.5 + // content quality placeholder
    0.10 * 0.5 + // CWV placeholder
    0.05 * 0.5   // page age placeholder
  ) + localBoost

  return Math.round(Math.min(raw * 100, 100) * 100) / 100
}

// ── Categorize keyword ──────────────────────────────────────────────────────
function categorize(kw: any): string {
  const pos = kw.sc_avg_position || 999
  const hasAds = (kw.ads_clicks || 0) > 0
  const hasSC = pos < 100

  // Organic cannibal: ranking top 5 organically AND paying for clicks
  if (pos <= 5 && hasAds && (kw.ads_cost_cents || 0) > 1000) return 'organic_cannibal'

  // Striking distance: position 4-15, worth pushing to top 3
  if (pos >= 4 && pos <= 15) return 'striking_distance'

  // Quick wins: position 11-20 with high volume
  if (pos >= 11 && pos <= 20 && (kw.kp_monthly_volume || 0) >= 100) return 'quick_win'

  // Paid only: has Ads data but no organic presence
  if (hasAds && !hasSC) return 'paid_only'

  // Dark matter: no Ads, no SC, but has KP volume
  if (!hasAds && !hasSC && (kw.kp_monthly_volume || 0) > 0) return 'dark_matter'

  // Defend: top 3 organically
  if (pos <= 3) return 'defend'

  // Underperformer: has impressions but low CTR
  if (hasSC && (kw.sc_ctr || 0) < 0.02 && (kw.sc_impressions || 0) > 100) return 'underperformer'

  return 'monitor'
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN API HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  // ── SYNC: Pull all data sources and merge into UKF ────────────────────
  if (action === 'sync') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // Get client's Google connection
    const { data: connections } = await s.from('seo_connections').select('*').eq('client_id', client_id)
    const googleConn = connections?.find((c: any) => c.provider === 'google' && c.refresh_token)
    const adsConn = connections?.find((c: any) => c.provider === 'ads' && c.refresh_token)
    const scConn = connections?.find((c: any) => c.provider === 'search_console' && c.refresh_token)

    // Get client website for SC
    const { data: client } = await s.from('clients').select('website, name').eq('id', client_id).single()
    const website = client?.website?.trim() || ''

    // Log sync start
    const { data: syncLog } = await s.from('kotoiq_sync_log').insert({
      client_id, source: 'full_sync', status: 'running',
    }).select().single()

    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const dataPeriod = `${startDate} to ${endDate}`

      // ── Pull from all sources in parallel ──
      const activeConn = googleConn || adsConn || scConn
      const accessToken = activeConn ? await getAccessToken(activeConn) : null

      const customerId = adsConn?.account_id || googleConn?.account_id
      const scSiteUrl = website.startsWith('http') ? website : `https://${website}`

      const [adsKeywords, adsCampaigns, scData, ga4Data] = await Promise.all([
        customerId && accessToken
          ? fetchGoogleAdsKeywords({ access_token: accessToken }, customerId).catch(() => [])
          : [],
        customerId && accessToken
          ? fetchGoogleAdsCampaigns({ access_token: accessToken }, customerId).catch(() => [])
          : [],
        scConn && accessToken && website
          ? fetchSearchConsoleData(accessToken, scSiteUrl, startDate, endDate).catch(() => null)
          : null,
        googleConn?.property_id && accessToken
          ? fetchGA4Data(accessToken, googleConn.property_id, startDate, endDate).catch(() => null)
          : null,
      ])

      // ── Build UKF map: fingerprint → merged data ──
      const ukf = new Map<string, any>()

      // Merge Ads keywords
      for (const row of (adsKeywords as any[]) || []) {
        const kw = row.ad_group_criterion?.keyword?.text
        if (!kw) continue
        const fp = fingerprint(kw)
        const existing = ukf.get(fp) || { keyword: kw, fingerprint: fp }
        existing.ads_clicks = parseInt(row.metrics?.clicks || '0')
        existing.ads_impressions = parseInt(row.metrics?.impressions || '0')
        existing.ads_cost_cents = micros(row.metrics?.cost_micros)
        existing.ads_conversions = parseFloat(row.metrics?.conversions || '0')
        existing.ads_cpc_cents = micros(row.metrics?.average_cpc)
        existing.ads_ctr = pct(row.metrics?.ctr)
        existing.ads_quality_score = row.ad_group_criterion?.quality_info?.quality_score || null
        existing.ads_campaign_name = row.campaign?.name || null
        existing.ads_ad_group = row.ad_group?.name || null
        existing.ads_status = row.ad_group_criterion?.status || null
        existing.match_type = row.ad_group_criterion?.keyword?.match_type || null
        ukf.set(fp, existing)
      }

      // Merge Search Console data
      if (scData?.rows) {
        for (const row of scData.rows) {
          const kw = row.keys?.[0]
          if (!kw) continue
          const fp = fingerprint(kw)
          const existing = ukf.get(fp) || { keyword: kw, fingerprint: fp }
          // Keep best position / highest clicks if multiple pages
          if (!existing.sc_clicks || row.clicks > existing.sc_clicks) {
            existing.sc_clicks = row.clicks || 0
            existing.sc_impressions = row.impressions || 0
            existing.sc_ctr = row.ctr || 0
            existing.sc_avg_position = row.position ? Math.round(row.position * 100) / 100 : null
            existing.sc_top_page = row.keys?.[1] || null
          }
          ukf.set(fp, existing)
        }
      }

      // Merge GA4 data (by landing page → match to SC top_page)
      if (ga4Data?.rows) {
        const ga4ByPage: Record<string, any> = {}
        for (const row of ga4Data.rows) {
          const page = row.dimensionValues?.[0]?.value || ''
          const channel = row.dimensionValues?.[1]?.value || ''
          if (!ga4ByPage[page]) ga4ByPage[page] = { sessions: 0, users: 0, conversions: 0, channel }
          ga4ByPage[page].sessions += parseInt(row.metricValues?.[0]?.value || '0')
          ga4ByPage[page].users += parseInt(row.metricValues?.[1]?.value || '0')
          ga4ByPage[page].conversions += parseInt(row.metricValues?.[3]?.value || '0')
        }
        // Match GA4 pages to UKF keywords via sc_top_page
        for (const [fp, kw] of ukf) {
          if (kw.sc_top_page) {
            const pagePath = kw.sc_top_page.replace(/^https?:\/\/[^/]+/, '')
            const ga4 = ga4ByPage[pagePath]
            if (ga4) {
              kw.ga4_sessions = ga4.sessions
              kw.ga4_users = ga4.users
              kw.ga4_conversions = ga4.conversions
              kw.ga4_channel = ga4.channel
            }
          }
        }
      }

      // ── Fetch Moz DA for client domain ──
      let clientDA = 0
      if (website) {
        const mozKey = process.env.MOZ_API_KEY || ''
        if (mozKey) {
          try {
            const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
            const mozRes = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${mozKey}` },
              body: JSON.stringify({ targets: [domain], url_metrics_columns: ['domain_authority', 'spam_score'] }),
              signal: AbortSignal.timeout(10000),
            })
            if (mozRes.ok) {
              const mozData = await mozRes.json()
              clientDA = mozData.results?.[0]?.domain_authority || 0
            }
          } catch { /* skip */ }
        }
      }

      // ── Classify, score, and enrich each keyword ──
      for (const [fp, kw] of ukf) {
        kw.intent = classifyIntent(kw.keyword)
        kw.moz_da = clientDA || null
        kw.opportunity_score = computeOpportunityScore(kw)
        kw.rank_propensity = computeRankPropensity(kw, clientDA)
        kw.category = categorize(kw)
        kw.data_period = dataPeriod
        kw.client_id = client_id
        kw.agency_id = agency_id || null
      }

      // ── Upsert into kotoiq_keywords ──
      const keywords = [...ukf.values()]
      if (keywords.length > 0) {
        // Delete old keywords for this client, then insert fresh
        await s.from('kotoiq_keywords').delete().eq('client_id', client_id)

        // Batch insert (Supabase max ~1000 rows per insert)
        for (let i = 0; i < keywords.length; i += 500) {
          const batch = keywords.slice(i, i + 500)
          await s.from('kotoiq_keywords').insert(batch)
        }

        // Save snapshot for trending
        const snapshots = keywords.map(kw => ({
          client_id,
          keyword_fingerprint: kw.fingerprint,
          sc_position: kw.sc_avg_position,
          sc_clicks: kw.sc_clicks,
          sc_impressions: kw.sc_impressions,
          ads_clicks: kw.ads_clicks,
          ads_cost_cents: kw.ads_cost_cents,
          ads_conversions: kw.ads_conversions,
          kp_volume: kw.kp_monthly_volume,
          opportunity_score: kw.opportunity_score,
          rank_propensity: kw.rank_propensity,
        }))
        for (let i = 0; i < snapshots.length; i += 500) {
          await s.from('kotoiq_snapshots').insert(snapshots.slice(i, i + 500))
        }
      }

      // Update sync log
      await s.from('kotoiq_sync_log').update({
        status: 'complete', records_synced: keywords.length,
        completed_at: new Date().toISOString(),
        metadata: {
          ads_keywords: (adsKeywords as any[])?.length || 0,
          sc_rows: scData?.rows?.length || 0,
          ga4_rows: ga4Data?.rows?.length || 0,
          client_da: clientDA,
          data_period: `${startDate} to ${endDate}`,
        },
      }).eq('id', syncLog?.id)

      // ── Generate AI recommendations ──
      const topOpp = keywords.sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0)).slice(0, 30)
      const cannibals = keywords.filter(k => k.category === 'organic_cannibal').slice(0, 10)
      const strikingDist = keywords.filter(k => k.category === 'striking_distance').slice(0, 10)
      const darkMatter = keywords.filter(k => k.category === 'dark_matter').slice(0, 10)

      let aiRecs: any[] = []
      if (keywords.length > 0) {
        try {
          const recPrompt = `You are KotoIQ, an AI search strategist. Analyze this keyword data and generate 5-8 prioritized recommendations.

CLIENT: ${client?.name || 'Unknown'} | DA: ${clientDA}
TOTAL KEYWORDS: ${keywords.length}

TOP OPPORTUNITIES (by score):
${JSON.stringify(topOpp.map(k => ({ kw: k.keyword, opp: k.opportunity_score, rank: k.rank_propensity, pos: k.sc_avg_position, vol: k.kp_monthly_volume, ads_spend: k.ads_cost_cents, conv: k.ads_conversions, cat: k.category, intent: k.intent })), null, 0)}

ORGANIC CANNIBALS (ranking top 5 AND paying for ads):
${cannibals.length > 0 ? JSON.stringify(cannibals.map(k => ({ kw: k.keyword, pos: k.sc_avg_position, ads_spend_cents: k.ads_cost_cents, ads_clicks: k.ads_clicks }))) : 'None found'}

STRIKING DISTANCE (position 4-15):
${strikingDist.length > 0 ? JSON.stringify(strikingDist.map(k => ({ kw: k.keyword, pos: k.sc_avg_position, vol: k.kp_monthly_volume, ctr: k.sc_ctr }))) : 'None found'}

DARK MATTER (not ranking, not bidding, but has search volume):
${darkMatter.length > 0 ? JSON.stringify(darkMatter.map(k => ({ kw: k.keyword, vol: k.kp_monthly_volume }))) : 'None found'}

Return ONLY valid JSON array:
[{
  "type": "bid_change|new_content|schema_fix|gbp_action|link_build|reduce_waste|quick_win",
  "priority": "critical|high|medium|low",
  "title": "Short actionable title",
  "detail": "2-3 sentences with specific data",
  "keywords": ["keyword1", "keyword2"],
  "estimated_impact": "Save $X/mo or Gain ~X clicks/mo",
  "effort": "quick_win|moderate|major_project"
}]`

          const msg = await ai.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: 'You are KotoIQ. Return ONLY valid JSON array. No markdown.',
            messages: [{ role: 'user', content: recPrompt }],
          })
          void logTokenUsage({ feature: 'kotoiq_recommendations', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0, agencyId: agency_id })

          const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
          const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
          aiRecs = JSON.parse(cleaned)

          // Save recommendations
          if (aiRecs.length > 0) {
            await s.from('kotoiq_recommendations').delete().eq('client_id', client_id).eq('status', 'pending')
            await s.from('kotoiq_recommendations').insert(
              aiRecs.map((r: any) => ({
                client_id, agency_id: agency_id || null,
                type: r.type, priority: r.priority, title: r.title,
                detail: r.detail, keywords: r.keywords,
                estimated_impact: r.estimated_impact, effort: r.effort,
              }))
            )
          }
        } catch { /* AI recs are optional */ }
      }

      return NextResponse.json({
        success: true,
        total_keywords: keywords.length,
        categories: {
          organic_cannibal: keywords.filter(k => k.category === 'organic_cannibal').length,
          striking_distance: keywords.filter(k => k.category === 'striking_distance').length,
          quick_win: keywords.filter(k => k.category === 'quick_win').length,
          paid_only: keywords.filter(k => k.category === 'paid_only').length,
          dark_matter: keywords.filter(k => k.category === 'dark_matter').length,
          defend: keywords.filter(k => k.category === 'defend').length,
          underperformer: keywords.filter(k => k.category === 'underperformer').length,
          monitor: keywords.filter(k => k.category === 'monitor').length,
        },
        client_da: clientDA,
        recommendations: aiRecs,
        data_sources: {
          ads_keywords: (adsKeywords as any[])?.length || 0,
          sc_queries: scData?.rows?.length || 0,
          ga4_pages: ga4Data?.rows?.length || 0,
        },
      })
    } catch (e: any) {
      await s.from('kotoiq_sync_log').update({
        status: 'failed', error_message: e.message,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLog?.id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── GET KEYWORDS: Paginated, filterable ───────────────────────────────
  if (action === 'keywords') {
    const { client_id, category, sort_by, sort_dir, limit: lim, offset: off, search } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    let q = s.from('kotoiq_keywords').select('*').eq('client_id', client_id)
    if (category) q = q.eq('category', category)
    if (search) q = q.ilike('keyword', `%${search}%`)
    q = q.order(sort_by || 'opportunity_score', { ascending: sort_dir === 'asc', nullsFirst: false })
    q = q.range(off || 0, (off || 0) + (lim || 50) - 1)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get total count
    const { count } = await s.from('kotoiq_keywords').select('*', { count: 'exact', head: true }).eq('client_id', client_id)

    return NextResponse.json({ keywords: data || [], total: count || 0 })
  }

  // ── GET DASHBOARD SUMMARY ─────────────────────────────────────────────
  if (action === 'dashboard') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: keywords } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id)
    const { data: recs } = await s.from('kotoiq_recommendations').select('*').eq('client_id', client_id).eq('status', 'pending').order('priority')
    const { data: lastSync } = await s.from('kotoiq_sync_log').select('*').eq('client_id', client_id).order('started_at', { ascending: false }).limit(1)

    if (!keywords?.length) return NextResponse.json({ empty: true, message: 'No data yet — run a sync first' })

    const kws = keywords
    const totalAdsSpend = kws.reduce((s, k) => s + (k.ads_cost_cents || 0), 0) / 100
    const totalAdsConv = kws.reduce((s, k) => s + (k.ads_conversions || 0), 0)
    const totalSCClicks = kws.reduce((s, k) => s + (k.sc_clicks || 0), 0)
    const avgPosition = kws.filter(k => k.sc_avg_position).reduce((s, k, _, a) => s + k.sc_avg_position / a.length, 0)
    const top3Count = kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 3).length
    const top10Count = kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 10).length

    // Category breakdown
    const categories: Record<string, number> = {}
    kws.forEach(k => { categories[k.category || 'unknown'] = (categories[k.category || 'unknown'] || 0) + 1 })

    // Top opportunities
    const topOpportunities = [...kws].sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0)).slice(0, 10)

    // Waste (organic cannibals)
    const wastedSpend = kws.filter(k => k.category === 'organic_cannibal').reduce((s, k) => s + (k.ads_cost_cents || 0), 0) / 100

    return NextResponse.json({
      summary: {
        total_keywords: kws.length,
        total_ads_spend: Math.round(totalAdsSpend),
        total_ads_conversions: Math.round(totalAdsConv),
        total_organic_clicks: totalSCClicks,
        avg_position: Math.round(avgPosition * 10) / 10,
        top3_keywords: top3Count,
        top10_keywords: top10Count,
        wasted_spend: Math.round(wastedSpend),
        avg_cpc: totalAdsSpend > 0 && kws.filter(k => k.ads_clicks).length > 0
          ? Math.round(totalAdsSpend / kws.reduce((s, k) => s + (k.ads_clicks || 0), 0) * 100) / 100
          : null,
      },
      categories,
      top_opportunities: topOpportunities.map(k => ({
        keyword: k.keyword,
        opportunity_score: k.opportunity_score,
        rank_propensity: k.rank_propensity,
        category: k.category,
        intent: k.intent,
        sc_position: k.sc_avg_position,
        sc_clicks: k.sc_clicks,
        ads_spend: k.ads_cost_cents ? Math.round(k.ads_cost_cents / 100) : 0,
        ads_conversions: k.ads_conversions,
        volume: k.kp_monthly_volume,
      })),
      recommendations: recs || [],
      last_sync: lastSync?.[0] || null,
    })
  }

  // ── GET RECOMMENDATIONS ───────────────────────────────────────────────
  if (action === 'recommendations') {
    const { client_id, status: recStatus } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    let q = s.from('kotoiq_recommendations').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
    if (recStatus) q = q.eq('status', recStatus)
    const { data } = await q
    return NextResponse.json({ recommendations: data || [] })
  }

  // ── UPDATE RECOMMENDATION STATUS ──────────────────────────────────────
  if (action === 'update_recommendation') {
    const { id, status: newStatus } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const update: any = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'completed') update.completed_at = new Date().toISOString()
    await s.from('kotoiq_recommendations').update(update).eq('id', id)
    return NextResponse.json({ success: true })
  }

  // ── GET SYNC HISTORY ──────────────────────────────────────────────────
  if (action === 'sync_history') {
    const { client_id } = body
    const { data } = await s.from('kotoiq_sync_log').select('*').eq('client_id', client_id).order('started_at', { ascending: false }).limit(20)
    return NextResponse.json({ syncs: data || [] })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
