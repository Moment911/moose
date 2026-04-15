import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData, fetchGA4Data } from '@/lib/seoService'
import { fetchGoogleAdsKeywords, fetchGoogleAdsCampaigns } from '@/lib/perfMarketing'
import { enrichDomain } from '@/lib/domainEnrichment'
import { getSERPResults, runGMBGridScan, getKeywordRankings, getBalance as getDFSBalance } from '@/lib/dataforseo'

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
    // SEOConnectPage saves as: search_console, analytics, ads, gmb
    const googleConn = connections?.find((c: any) => (c.provider === 'analytics' || c.provider === 'google') && c.refresh_token)
    const adsConn = connections?.find((c: any) => c.provider === 'ads' && c.refresh_token)
    const scConn = connections?.find((c: any) => c.provider === 'search_console' && c.refresh_token)
    // Use the SC connection's token for GA4 too if no separate analytics connection
    const ga4Conn = googleConn || scConn

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
      // Get access tokens — each connection may have its own token
      const scToken = scConn ? await getAccessToken(scConn) : null
      const ga4Token = ga4Conn ? await getAccessToken(ga4Conn) : null
      const adsToken = adsConn ? await getAccessToken(adsConn) : null
      const anyToken = scToken || ga4Token || adsToken

      const customerId = adsConn?.account_id || googleConn?.account_id
      const scSiteUrl = scConn?.site_url || (website.startsWith('http') ? website : `https://${website}`)
      const ga4PropertyId = ga4Conn?.property_id || googleConn?.property_id

      const [adsKeywords, adsCampaigns, scData, ga4Data] = await Promise.all([
        customerId && adsToken
          ? fetchGoogleAdsKeywords({ access_token: adsToken }, customerId).catch(() => [])
          : [],
        customerId && adsToken
          ? fetchGoogleAdsCampaigns({ access_token: adsToken }, customerId).catch(() => [])
          : [],
        scToken && scSiteUrl
          ? fetchSearchConsoleData(scToken, scSiteUrl, startDate, endDate).catch(() => null)
          : null,
        ga4PropertyId && ga4Token
          ? fetchGA4Data(ga4Token, ga4PropertyId, startDate, endDate).catch(() => null)
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

  // ── QUICK SCAN: Seed keywords from website without OAuth ────────────
  if (action === 'quick_scan') {
    const { client_id, agency_id, website, industry, location } = body
    if (!client_id || !website) return NextResponse.json({ error: 'client_id and website required' }, { status: 400 })

    const { data: syncLog } = await s.from('kotoiq_sync_log').insert({
      client_id, source: 'quick_scan', status: 'running',
    }).select().single()

    try {
      let normalizedUrl = website.trim()
      if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
      const hostname = new URL(normalizedUrl).hostname

      // Fetch page, sitemap, competitors, Moz in parallel
      const [pageRes, sitemapUrls, competitors, mozRes] = await Promise.all([
        fetch(normalizedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' }, signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => ''),
        // Sitemap
        (async () => {
          const urls: string[] = []
          for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
            try {
              const r = await fetch(`${new URL(normalizedUrl).origin}${path}`, { signal: AbortSignal.timeout(5000) })
              if (r.ok) { const t = await r.text(); const locs = [...t.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1]); urls.push(...locs) }
              if (urls.length > 0) break
            } catch { continue }
          }
          return [...new Set(urls)].slice(0, 200)
        })(),
        // Competitors via Places
        (async () => {
          const apiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
          if (!apiKey || !industry) return []
          try {
            const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri' },
              body: JSON.stringify({ textQuery: `${industry} near ${location || ''}`, maxResultCount: 5 }),
              signal: AbortSignal.timeout(10000),
            })
            const d = await r.json()
            return (d.places || []).filter((p: any) => p.websiteUri && !p.websiteUri.includes(hostname)).slice(0, 4).map((p: any) => ({
              name: p.displayName?.text, website: p.websiteUri, rating: p.rating, reviews: p.userRatingCount,
            }))
          } catch { return [] }
        })(),
        // Moz DA
        (async () => {
          const mozKey = process.env.MOZ_API_KEY || ''
          if (!mozKey) return null
          try {
            const r = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${mozKey}` },
              body: JSON.stringify({ targets: [hostname], url_metrics_columns: ['domain_authority', 'page_authority', 'spam_score', 'root_domains_to_root_domain'] }),
              signal: AbortSignal.timeout(10000),
            })
            return r.ok ? (await r.json()).results?.[0] : null
          } catch { return null }
        })(),
      ])

      const clientDA = mozRes?.domain_authority || 0

      // Extract keywords from page content + sitemap URLs using Claude
      const pageText = pageRes.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
      const sitemapPaths = sitemapUrls.map(u => { try { return new URL(u).pathname } catch { return u } }).filter(p => p !== '/' && !p.includes('?'))

      const extractPrompt = `Analyze this business website and extract the most important SEO keywords they should be targeting.

WEBSITE: ${normalizedUrl}
INDUSTRY: ${industry || 'Unknown'}
LOCATION: ${location || 'Unknown'}
DOMAIN AUTHORITY: ${clientDA}

PAGE CONTENT (first 5000 chars):
${pageText.slice(0, 3000)}

SITEMAP URLS (${sitemapPaths.length} pages):
${sitemapPaths.slice(0, 50).join('\n')}

COMPETITORS: ${JSON.stringify(competitors.map((c: any) => c.name))}

Extract 30-60 keywords this business should target. Include:
- Service keywords (what they do)
- Location keywords (service + city combinations)
- Long-tail keywords (specific queries people search)
- Question keywords (how, what, why queries)
- Competitor comparison keywords (vs, alternative, best)

Return ONLY valid JSON array:
[{"keyword": "exact keyword phrase", "intent": "transactional|commercial|informational", "estimated_volume": number, "estimated_difficulty": "low|medium|high", "priority": "high|medium|low"}]`

      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 3000,
        system: 'Extract SEO keywords. Return ONLY valid JSON array.',
        messages: [{ role: 'user', content: extractPrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_quick_scan', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0, agencyId: agency_id })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const extracted = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

      // Build UKF records from extracted keywords
      const ukfRecords = (Array.isArray(extracted) ? extracted : []).map((kw: any) => ({
        client_id,
        agency_id: agency_id || null,
        keyword: kw.keyword,
        fingerprint: fingerprint(kw.keyword),
        intent: kw.intent || classifyIntent(kw.keyword),
        kp_monthly_volume: kw.estimated_volume || null,
        moz_da: clientDA || null,
        category: kw.priority === 'high' ? 'quick_win' : kw.priority === 'medium' ? 'striking_distance' : 'monitor',
        opportunity_score: kw.priority === 'high' ? 75 : kw.priority === 'medium' ? 55 : 35,
        rank_propensity: kw.estimated_difficulty === 'low' ? 70 : kw.estimated_difficulty === 'medium' ? 45 : 25,
        data_period: `Quick scan — ${new Date().toISOString().split('T')[0]}`,
      }))

      if (ukfRecords.length > 0) {
        await s.from('kotoiq_keywords').delete().eq('client_id', client_id)
        await s.from('kotoiq_keywords').insert(ukfRecords)
      }

      // Generate recommendations
      let aiRecs: any[] = []
      try {
        const recMsg = await ai.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 1500,
          system: 'Return ONLY valid JSON array.',
          messages: [{ role: 'user', content: `Generate 5 SEO recommendations for ${normalizedUrl} (${industry}, ${location}). DA: ${clientDA}. ${ukfRecords.length} keywords identified. Competitors: ${competitors.map((c: any) => c.name).join(', ')}.\n\nReturn JSON array: [{"type":"new_content|link_build|quick_win|schema_fix|gbp_action","priority":"critical|high|medium","title":"short title","detail":"2 sentences","estimated_impact":"description","effort":"quick_win|moderate|major_project"}]` }],
        })
        void logTokenUsage({ feature: 'kotoiq_quick_scan_recs', model: 'claude-sonnet-4-20250514', inputTokens: recMsg.usage?.input_tokens || 0, outputTokens: recMsg.usage?.output_tokens || 0, agencyId: agency_id })
        aiRecs = JSON.parse((recMsg.content[0].type === 'text' ? recMsg.content[0].text : '[]').replace(/```json?\n?/g, '').replace(/```/g, '').trim())
        if (aiRecs.length > 0) {
          await s.from('kotoiq_recommendations').delete().eq('client_id', client_id).eq('status', 'pending')
          await s.from('kotoiq_recommendations').insert(aiRecs.map((r: any) => ({ client_id, agency_id, type: r.type, priority: r.priority, title: r.title, detail: r.detail, estimated_impact: r.estimated_impact, effort: r.effort })))
        }
      } catch { /* skip recs */ }

      await s.from('kotoiq_sync_log').update({
        status: 'complete', records_synced: ukfRecords.length, completed_at: new Date().toISOString(),
        metadata: { scan_type: 'quick_scan', client_da: clientDA, competitors: competitors.length, sitemap_pages: sitemapUrls.length },
      }).eq('id', syncLog?.id)

      return NextResponse.json({
        success: true, total_keywords: ukfRecords.length, client_da: clientDA,
        competitors: competitors.length, sitemap_pages: sitemapUrls.length,
        recommendations: aiRecs,
      })
    } catch (e: any) {
      await s.from('kotoiq_sync_log').update({ status: 'failed', error_message: e.message, completed_at: new Date().toISOString() }).eq('id', syncLog?.id)
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

  // ── KEYWORD PLANNER: Fetch search volume for existing keywords ──────
  if (action === 'enrich_volume') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: connections } = await s.from('seo_connections').select('*').eq('client_id', client_id)
    const adsConn = connections?.find((c: any) => (c.provider === 'ads' || c.provider === 'google') && c.refresh_token)
    if (!adsConn) return NextResponse.json({ error: 'No Google Ads connection — cannot access Keyword Planner' }, { status: 400 })

    const accessToken = await getAccessToken(adsConn)
    const customerId = adsConn.account_id
    if (!accessToken || !customerId) return NextResponse.json({ error: 'Cannot authenticate with Google Ads' }, { status: 400 })

    // Get keywords that need volume data
    const { data: keywords } = await s.from('kotoiq_keywords').select('id, keyword, fingerprint')
      .eq('client_id', client_id).is('kp_monthly_volume', null).limit(200)

    if (!keywords?.length) return NextResponse.json({ success: true, message: 'All keywords already have volume data', enriched: 0 })

    // Batch keywords (Keyword Planner accepts up to 20 at a time)
    let enriched = 0
    for (let i = 0; i < keywords.length; i += 20) {
      const batch = keywords.slice(i, i + 20)
      try {
        const kpRes = await fetch(
          `https://googleads.googleapis.com/v17/customers/${customerId}:generateKeywordIdeas`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              keywordSeed: { keywords: batch.map(k => k.keyword) },
              language: 'languageConstants/1000', // English
              geoTargetConstants: ['geoTargetConstants/2840'], // US
              keywordPlanNetwork: 'GOOGLE_SEARCH',
            }),
          }
        )
        if (!kpRes.ok) continue
        const kpData = await kpRes.json()

        // Match results back to our keywords
        const volumeMap = new Map<string, any>()
        for (const result of kpData.results || []) {
          const kw = result.text || result.keywordIdeaMetrics?.text
          if (!kw) continue
          const fp = fingerprint(kw)
          const metrics = result.keywordIdeaMetrics || {}
          volumeMap.set(fp, {
            kp_monthly_volume: parseInt(metrics.avgMonthlySearches || '0'),
            kp_competition: metrics.competition || null,
            kp_competition_index: metrics.competitionIndex || null,
            kp_low_bid_cents: metrics.lowTopOfPageBidMicros ? Math.round(parseInt(metrics.lowTopOfPageBidMicros) / 10000) : null,
            kp_high_bid_cents: metrics.highTopOfPageBidMicros ? Math.round(parseInt(metrics.highTopOfPageBidMicros) / 10000) : null,
          })
        }

        // Update keywords with volume data
        for (const kw of batch) {
          const vol = volumeMap.get(kw.fingerprint)
          if (vol) {
            await s.from('kotoiq_keywords').update({
              ...vol,
              updated_at: new Date().toISOString(),
            }).eq('id', kw.id)
            enriched++
          }
        }
      } catch { /* skip failed batch */ }
    }

    return NextResponse.json({ success: true, enriched, total: keywords.length })
  }

  // ── GENERATE CONTENT BRIEF ────────────────────────────────────────────
  if (action === 'generate_brief') {
    const { client_id, agency_id, keyword, target_url, page_type } = body
    if (!client_id || !keyword) return NextResponse.json({ error: 'client_id and keyword required' }, { status: 400 })

    // Get keyword data from UKF
    const fp = fingerprint(keyword)
    const { data: kwData } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).eq('fingerprint', fp).single()

    // Get client info
    const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer').eq('id', client_id).single()

    // Fetch top 3 competitor pages for this keyword if we have SC data
    let competitorPages: any[] = []
    if (kwData?.sc_top_page || client?.website) {
      const targetUrl = kwData?.sc_top_page || client?.website
      try {
        const domain = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname
        // Fetch top organic competitors' pages (simplified — would use DataForSEO in full version)
        // For now, use the data we already have from the keyword record
      } catch { /* skip */ }
    }

    // Generate the brief with Claude
    const briefPrompt = `You are KotoIQ, an elite SEO content strategist. Generate a comprehensive content brief for a new page.

BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || 'Unknown'}
PRIMARY SERVICE: ${client?.primary_service || 'Unknown'}
TARGET CUSTOMER: ${client?.target_customer || 'Unknown'}

TARGET KEYWORD: "${keyword}"
SEARCH INTENT: ${kwData?.intent || classifyIntent(keyword)}
PAGE TYPE: ${page_type || 'service_page'}
SUGGESTED URL: ${target_url || `/${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`}

KEYWORD DATA:
- Monthly search volume: ${kwData?.kp_monthly_volume || 'Unknown'}
- Current organic position: ${kwData?.sc_avg_position ? `#${Math.round(kwData.sc_avg_position)}` : 'Not ranking'}
- Current organic clicks: ${kwData?.sc_clicks || 0}/month
- Competition: ${kwData?.kp_competition || 'Unknown'}
- CPC: ${kwData?.ads_cpc_cents ? `$${(kwData.ads_cpc_cents / 100).toFixed(2)}` : 'Unknown'}
- Opportunity score: ${kwData?.opportunity_score || 'Unknown'}/100
- Rank propensity: ${kwData?.rank_propensity || 'Unknown'}/100
- Client Domain Authority: ${kwData?.moz_da || 'Unknown'}

INSTRUCTIONS:
1. Generate a complete page brief that will rank #1 for this keyword
2. The brief should beat current top-ranking pages by being more comprehensive, better structured, and more useful
3. Include FAQ questions sourced from what real people ask about this topic
4. Include schema markup recommendations
5. Specify exact entity coverage needed for NLP/AEO optimization
6. The content should be written for HUMANS first, optimized for search second
7. For local service businesses, include city/area mentions naturally
8. Target featured snippet / AI Overview capture where applicable

Return ONLY valid JSON:
{
  "title_tag": "max 60 chars, keyword first, city, brand last",
  "meta_description": "max 155 chars, keyword, CTA, differentiator",
  "h1": "primary heading, keyword + city naturally",
  "target_url": "/suggested-url-path/",
  "target_word_count": number,
  "outline": [
    {
      "h2": "Section heading",
      "h3s": ["Subsection 1", "Subsection 2"],
      "key_points": ["What to cover in this section"],
      "word_count_target": number
    }
  ],
  "schema_types": ["LocalBusiness", "FAQPage", "Service", "BreadcrumbList"],
  "faq_questions": [
    { "question": "Exact question to answer", "answer_guidance": "What to include in the answer (40-60 words for featured snippet)" }
  ],
  "target_entities": ["entity1", "entity2"],
  "internal_links": {
    "link_to_this_page_from": ["homepage", "services hub", "related service page"],
    "link_from_this_page_to": ["related services", "location pages", "contact page"]
  },
  "content_guidelines": {
    "opening_paragraph": "40-60 word direct answer to the query intent (featured snippet target)",
    "tone": "professional but approachable",
    "cta_placement": "after intro, mid-page, end of page",
    "image_suggestions": ["type of image 1", "type of image 2"],
    "differentiator_angle": "what makes this page unique vs competitors"
  },
  "estimated_monthly_traffic": number,
  "ranking_timeline": "estimated weeks/months to rank based on competition",
  "aeo_optimization": {
    "target_snippet_type": "paragraph|list|table|faq",
    "ai_overview_eligible": true/false,
    "optimization_notes": "specific tips for AI citation"
  }
}`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'You are KotoIQ content strategist. Return ONLY valid JSON. No markdown.',
        messages: [{ role: 'user', content: briefPrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_content_brief', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0, agencyId: agency_id })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const brief = JSON.parse(cleaned)

      // Save to database
      const { data: saved, error: saveErr } = await s.from('kotoiq_content_briefs').insert({
        client_id,
        agency_id: agency_id || null,
        target_keyword: keyword,
        target_url: brief.target_url || target_url,
        page_type: page_type || 'service_page',
        title_tag: brief.title_tag,
        meta_description: brief.meta_description,
        h1: brief.h1,
        outline: brief.outline,
        schema_types: brief.schema_types,
        faq_questions: brief.faq_questions,
        target_word_count: brief.target_word_count,
        target_entities: brief.target_entities,
        competitor_analysis: competitorPages.length > 0 ? competitorPages : null,
        opportunity_score: kwData?.opportunity_score || null,
        rank_propensity: kwData?.rank_propensity || null,
        estimated_monthly_traffic: brief.estimated_monthly_traffic || null,
      }).select().single()

      return NextResponse.json({ brief: { id: saved?.id, ...brief }, keyword_data: kwData })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── LIST CONTENT BRIEFS ───────────────────────────────────────────────
  if (action === 'list_briefs') {
    const { client_id, status: briefStatus } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    let q = s.from('kotoiq_content_briefs').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
    if (briefStatus) q = q.eq('status', briefStatus)
    const { data } = await q
    return NextResponse.json({ briefs: data || [] })
  }

  // ── GET SINGLE BRIEF ──────────────────────────────────────────────────
  if (action === 'get_brief') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data } = await s.from('kotoiq_content_briefs').select('*').eq('id', id).single()
    return NextResponse.json({ brief: data })
  }

  // ── UPDATE BRIEF STATUS ───────────────────────────────────────────────
  if (action === 'update_brief') {
    const { id, status: newStatus, published_url } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const update: any = { status: newStatus, updated_at: new Date().toISOString() }
    if (published_url) update.published_url = published_url
    await s.from('kotoiq_content_briefs').update(update).eq('id', id)
    return NextResponse.json({ success: true })
  }

  // ── GMB HEALTH: Full GBP audit + review data ──────────────────────────
  if (action === 'gmb_health') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, city, state, industry').eq('id', client_id).single()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Get client location from latest intel report OR client record
    const { data: latestReport } = await s.from('koto_intel_reports').select('inputs, report_data')
      .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
    const location = latestReport?.inputs?.location || [client.city, client.state].filter(Boolean).join(', ') || ''
    const existingGBP = latestReport?.report_data?.gbp_audit

    // Fetch fresh GBP data if no recent report — use client name + city/state
    let gbpData = existingGBP
    if (!gbpData && client.name) {
      const apiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
      if (apiKey) {
        try {
          const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.regularOpeningHours,places.primaryType,places.types,places.photos,places.editorialSummary,places.googleMapsUri,places.reviews' },
            body: JSON.stringify({ textQuery: `${client.name} ${location}`, maxResultCount: 1 }),
            signal: AbortSignal.timeout(10000),
          })
          const searchData = await searchRes.json()
          const place = searchData.places?.[0]
          if (place) {
            const checks = [
              { label: 'Business name', pass: !!place.displayName?.text, weight: 10, fix: 'Add your business name to GBP' },
              { label: 'Address verified', pass: !!place.formattedAddress, weight: 10, fix: 'Verify your business address' },
              { label: 'Phone number', pass: !!place.nationalPhoneNumber, weight: 8, fix: 'Add a phone number' },
              { label: 'Website linked', pass: !!place.websiteUri, weight: 8, fix: 'Link your website' },
              { label: 'Business hours', pass: !!place.regularOpeningHours?.periods?.length, weight: 9, fix: 'Add complete hours' },
              { label: 'Primary category', pass: !!place.primaryType, weight: 10, fix: 'Set primary category' },
              { label: '5+ photos', pass: (place.photos?.length || 0) >= 5, weight: 10, fix: 'Upload 5+ photos' },
              { label: '10+ reviews', pass: (place.userRatingCount || 0) >= 10, weight: 8, fix: 'Build review count' },
              { label: 'Rating 4.0+', pass: (place.rating || 0) >= 4.0, weight: 7, fix: 'Improve rating' },
              { label: 'Description', pass: !!place.editorialSummary?.text, weight: 8, fix: 'Add business description' },
              { label: 'Active listing', pass: place.businessStatus === 'OPERATIONAL', weight: 10, fix: 'Ensure listing is active' },
            ]
            const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
            const earnedWeight = checks.filter(c => c.pass).reduce((s, c) => s + c.weight, 0)
            gbpData = {
              name: place.displayName?.text, address: place.formattedAddress, phone: place.nationalPhoneNumber,
              website: place.websiteUri, rating: place.rating || 0, review_count: place.userRatingCount || 0,
              photo_count: place.photos?.length || 0, business_status: place.businessStatus,
              primary_category: place.primaryType, maps_url: place.googleMapsUri,
              description: place.editorialSummary?.text || null,
              recent_reviews: (place.reviews || []).slice(0, 10).map((r: any) => ({
                rating: r.rating, text: r.text?.text?.slice(0, 500) || '', time: r.publishTime,
                author: r.authorAttribution?.displayName || 'Anonymous',
              })),
              audit: { score: Math.round((earnedWeight / totalWeight) * 100),
                passes: checks.filter(c => c.pass).map(c => c.label),
                fails: checks.filter(c => !c.pass).map(c => ({ label: c.label, fix: c.fix, weight: c.weight })).sort((a, b) => b.weight - a.weight) },
            }
          }
        } catch { /* skip */ }
      }
    }

    // Get Moz data from latest report
    const mozData = latestReport?.report_data?.moz_data || null

    return NextResponse.json({ gbp: gbpData, moz: mozData, location })
  }

  // ── GMB REVIEW RESPONSE: AI-draft reply to a review ───────────────────
  if (action === 'draft_review_response') {
    const { client_id, review_text, review_rating, reviewer_name, business_name } = body
    if (!review_text) return NextResponse.json({ error: 'review_text required' }, { status: 400 })

    const prompt = `You are a professional review response writer for ${business_name || 'a local business'}. Write a response to this Google review.

REVIEW:
Rating: ${review_rating}/5 stars
Reviewer: ${reviewer_name || 'Customer'}
Text: "${review_text}"

RULES:
- ${review_rating >= 4 ? '100-160 words. Warm, specific, mentions the service.' : review_rating >= 3 ? '120-160 words. Grateful, ask what could be better.' : '140-180 words. Empathetic, address the issue, offer offline resolution.'}
- Professional but human tone
- Mention the reviewer by first name
- Reference specific details from their review
- Include a subtle CTA (come back, refer a friend, call us)
- Never be defensive or argumentative
- For negative reviews: acknowledge, empathize, take offline

Return ONLY the response text, no JSON wrapper, no quotes around it.`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 500,
        system: 'Write a professional Google review response. Return ONLY the response text.',
        messages: [{ role: 'user', content: prompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_review_response', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })
      const response = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      return NextResponse.json({ response })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── GMB POST GENERATOR: AI-draft GBP posts ───────────────────────────
  if (action === 'generate_gbp_posts') {
    const { client_id, business_name, industry, services, num_posts } = body

    const prompt = `Generate ${num_posts || 4} Google Business Profile posts for ${business_name || 'a local business'} (${industry || 'local services'}).

Services: ${services || 'general services'}

Each post should be different:
1. An offer/promotion post (drives "Book" clicks)
2. A tips/educational post (builds authority)
3. A behind-the-scenes/team post (builds trust)
4. A seasonal/timely post (relevance signal)

RULES:
- 150-300 characters each (GBP limit is 1500 but short performs better)
- Include a clear CTA
- Mention the city/area when natural
- Use emojis sparingly (1-2 per post max)
- Each post should work as a standalone piece

Return ONLY valid JSON array:
[{"type": "offer|tips|team|seasonal", "text": "post text", "cta": "Book Now|Learn More|Call Us|Visit Us"}]`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 1500,
        system: 'Generate GBP posts. Return ONLY valid JSON array.',
        messages: [{ role: 'user', content: prompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_gbp_posts', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })
      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      return NextResponse.json({ posts: JSON.parse(cleaned) })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── COMPETITOR PAGE ANALYSIS: Reverse-engineer top-ranking pages ────
  if (action === 'analyze_competitors') {
    const { client_id, keyword } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    // Get client info
    const { data: client } = await s.from('clients').select('name, website').eq('id', client_id).single()
    const clientDomain = client?.website ? new URL(client.website.startsWith('http') ? client.website : `https://${client.website}`).hostname : ''

    // Get UKF data for this keyword
    const fp = fingerprint(keyword)
    const { data: kwData } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).eq('fingerprint', fp).single()

    // Use DataForSEO to get real SERP results for the keyword
    const analyses: any[] = []
    let serpUrls: { url: string; domain: string; title: string; rank: number }[] = []

    try {
      const serpResult = await getSERPResults(keyword)
      serpUrls = serpResult.items.slice(0, 5).map(item => ({
        url: item.url, domain: item.domain, title: item.title, rank: item.rank_group,
      }))
    } catch {
      // Fallback to intel report competitors if DataForSEO fails
      const { data: latestReport } = await s.from('koto_intel_reports').select('report_data')
        .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
      const competitors = latestReport?.report_data?.competitors || []
      serpUrls = competitors.slice(0, 5).map((c: any, i: number) => ({
        url: c.website || `https://${c.domain}`, domain: c.domain || '', title: c.name || '', rank: i + 1,
      }))
    }

    // Analyze client's own page first (if ranking)
    if (kwData?.sc_top_page) {
      const analysis = await analyzePageForKeyword(kwData.sc_top_page, keyword)
      if (analysis) analyses.push({ ...analysis, is_client: true, name: client?.name || clientDomain, rank: 0 })
    } else if (clientDomain) {
      // Check if client shows up in SERP results
      const clientSerp = serpUrls.find(u => u.domain.includes(clientDomain.replace('www.', '')))
      if (clientSerp) {
        const analysis = await analyzePageForKeyword(clientSerp.url, keyword)
        if (analysis) analyses.push({ ...analysis, is_client: true, name: client?.name || clientDomain, rank: clientSerp.rank })
        serpUrls = serpUrls.filter(u => u !== clientSerp) // don't analyze again below
      }
    }

    // Analyze top SERP results
    for (const comp of serpUrls.slice(0, 4)) {
      if (!comp.url) continue
      try {
        const analysis = await analyzePageForKeyword(comp.url, keyword)
        if (analysis) analyses.push({ ...analysis, is_client: false, name: comp.title || comp.domain, rank: comp.rank })
      } catch { continue }
    }

    // Get Moz PA for all analyzed URLs
    const mozKey = process.env.MOZ_API_KEY || ''
    if (mozKey && analyses.length > 0) {
      try {
        const targets = analyses.map(a => { try { return new URL(a.url).hostname } catch { return null } }).filter(Boolean)
        const mozRes = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${mozKey}` },
          body: JSON.stringify({ targets, url_metrics_columns: ['domain_authority', 'page_authority', 'spam_score', 'root_domains_to_root_domain'] }),
          signal: AbortSignal.timeout(10000),
        })
        if (mozRes.ok) {
          const mozData = await mozRes.json()
          analyses.forEach((a, i) => {
            const m = mozData.results?.[i]
            if (m) { a.da = m.domain_authority || 0; a.pa = m.page_authority || 0; a.spam_score = m.spam_score || 0; a.linking_domains = m.root_domains_to_root_domain || 0 }
          })
        }
      } catch { /* skip moz */ }
    }

    // AI gap analysis
    let gapAnalysis = null
    if (analyses.length > 1) {
      try {
        const gapPrompt = `Analyze the competitive gap for the keyword "${keyword}".

CLIENT PAGE: ${analyses.find(a => a.is_client) ? JSON.stringify(analyses.find(a => a.is_client)) : 'No page exists yet'}

COMPETITOR PAGES:
${JSON.stringify(analyses.filter(a => !a.is_client))}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence competitive landscape summary",
  "client_strengths": ["What client page does well"],
  "client_weaknesses": ["What's missing vs competitors"],
  "priority_actions": [
    {"action": "specific action", "impact": "high|medium|low", "effort": "quick|moderate|major", "detail": "why this matters"}
  ],
  "content_targets": {
    "target_word_count": number,
    "required_h2_sections": ["section topics competitors cover"],
    "required_schema": ["schema types competitors use"],
    "faq_count_target": number,
    "image_count_target": number
  },
  "winning_formula": "1-2 sentence description of what it takes to rank #1 for this keyword"
}`

        const msg = await ai.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 2000,
          system: 'You are KotoIQ competitive analyst. Return ONLY valid JSON.',
          messages: [{ role: 'user', content: gapPrompt }],
        })
        void logTokenUsage({ feature: 'kotoiq_competitor_analysis', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })
        const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
        gapAnalysis = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      } catch { /* skip AI analysis */ }
    }

    return NextResponse.json({ keyword, analyses, gap_analysis: gapAnalysis, keyword_data: kwData })
  }

  // ── RANK TRACKER: Position history over time ────────────────────────
  if (action === 'rank_history') {
    const { client_id, keyword_fingerprints, days } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const since = new Date(Date.now() - (days || 90) * 86400000).toISOString().split('T')[0]

    if (keyword_fingerprints?.length) {
      // Specific keywords
      const { data } = await s.from('kotoiq_snapshots').select('*')
        .eq('client_id', client_id).in('keyword_fingerprint', keyword_fingerprints)
        .gte('snapshot_date', since).order('snapshot_date', { ascending: true })
      return NextResponse.json({ snapshots: data || [] })
    }

    // All keywords — return latest + previous snapshot for movement calculation
    const { data: latest } = await s.from('kotoiq_keywords').select('keyword, fingerprint, sc_avg_position, sc_clicks, sc_impressions, opportunity_score, category')
      .eq('client_id', client_id).not('sc_avg_position', 'is', null).order('sc_avg_position', { ascending: true }).limit(100)

    // Get previous snapshot for each to calculate movement
    const movements: any[] = []
    if (latest?.length) {
      const fps = latest.map(k => k.fingerprint)
      const prevDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { data: prevSnaps } = await s.from('kotoiq_snapshots').select('keyword_fingerprint, sc_position')
        .eq('client_id', client_id).in('keyword_fingerprint', fps)
        .lte('snapshot_date', prevDate).order('snapshot_date', { ascending: false })

      // Build map of previous positions (most recent before 7 days ago)
      const prevMap = new Map<string, number>()
      for (const snap of prevSnaps || []) {
        if (!prevMap.has(snap.keyword_fingerprint)) prevMap.set(snap.keyword_fingerprint, snap.sc_position)
      }

      for (const kw of latest) {
        const prev = prevMap.get(kw.fingerprint)
        movements.push({
          keyword: kw.keyword,
          fingerprint: kw.fingerprint,
          current_position: kw.sc_avg_position,
          previous_position: prev || null,
          change: prev ? Math.round((prev - kw.sc_avg_position) * 10) / 10 : null, // positive = improved
          clicks: kw.sc_clicks,
          impressions: kw.sc_impressions,
          opportunity_score: kw.opportunity_score,
          category: kw.category,
        })
      }
    }

    // Sort: biggest movers first
    const improved = movements.filter(m => m.change && m.change > 0).sort((a, b) => b.change - a.change)
    const declined = movements.filter(m => m.change && m.change < 0).sort((a, b) => a.change - b.change)
    const stable = movements.filter(m => m.change === 0 || m.change === null)

    return NextResponse.json({
      total_tracked: movements.length,
      top3: movements.filter(m => m.current_position <= 3).length,
      top10: movements.filter(m => m.current_position <= 10).length,
      top20: movements.filter(m => m.current_position <= 20).length,
      improved: improved.slice(0, 20),
      declined: declined.slice(0, 20),
      stable_count: stable.length,
      all: movements,
    })
  }

  // ── PORTFOLIO: Cross-client overview for agency ─────────────────────
  if (action === 'portfolio') {
    const { agency_id } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    // Get all clients for agency
    const { data: clients } = await s.from('clients').select('id, name, website, primary_service')
      .eq('agency_id', agency_id).is('deleted_at', null).order('name')

    if (!clients?.length) return NextResponse.json({ clients: [] })

    // Get keyword stats per client
    const clientIds = clients.map(c => c.id)
    const { data: allKw } = await s.from('kotoiq_keywords').select('client_id, sc_avg_position, opportunity_score, category, ads_cost_cents')
      .in('client_id', clientIds)

    // Get last sync per client
    const { data: syncs } = await s.from('kotoiq_sync_log').select('client_id, status, completed_at, records_synced')
      .in('client_id', clientIds).eq('status', 'complete').order('completed_at', { ascending: false })

    // Get pending recommendations per client
    const { data: recs } = await s.from('kotoiq_recommendations').select('client_id, priority')
      .in('client_id', clientIds).eq('status', 'pending')

    // Build portfolio
    const syncMap = new Map<string, any>()
    for (const sync of syncs || []) {
      if (!syncMap.has(sync.client_id)) syncMap.set(sync.client_id, sync)
    }

    const portfolio = clients.map(client => {
      const kws = (allKw || []).filter(k => k.client_id === client.id)
      const lastSync = syncMap.get(client.id)
      const clientRecs = (recs || []).filter(r => r.client_id === client.id)

      const top3 = kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 3).length
      const top10 = kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 10).length
      const avgOpp = kws.length > 0 ? Math.round(kws.reduce((s, k) => s + (k.opportunity_score || 0), 0) / kws.length) : 0
      const totalSpend = kws.reduce((s, k) => s + (k.ads_cost_cents || 0), 0) / 100
      const cannibals = kws.filter(k => k.category === 'organic_cannibal').length
      const criticalRecs = clientRecs.filter(r => r.priority === 'critical' || r.priority === 'high').length

      return {
        id: client.id,
        name: client.name,
        website: client.website,
        service: client.primary_service,
        total_keywords: kws.length,
        top3,
        top10,
        avg_opportunity: avgOpp,
        ads_spend: Math.round(totalSpend),
        cannibals,
        critical_actions: criticalRecs,
        total_actions: clientRecs.length,
        last_sync: lastSync?.completed_at || null,
        synced: !!lastSync,
      }
    })

    return NextResponse.json({
      clients: portfolio,
      totals: {
        total_clients: portfolio.length,
        synced_clients: portfolio.filter(c => c.synced).length,
        total_keywords: portfolio.reduce((s, c) => s + c.total_keywords, 0),
        total_top3: portfolio.reduce((s, c) => s + c.top3, 0),
        total_top10: portfolio.reduce((s, c) => s + c.top10, 0),
        total_spend: portfolio.reduce((s, c) => s + c.ads_spend, 0),
        total_actions: portfolio.reduce((s, c) => s + c.total_actions, 0),
      },
    })
  }

  // ── EXPORT: Full report data for PDF generation ───────────────────────
  if (action === 'export_report') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()
    const { data: keywords } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).order('opportunity_score', { ascending: false })
    const { data: recs } = await s.from('kotoiq_recommendations').select('*').eq('client_id', client_id).eq('status', 'pending').order('priority')
    const { data: briefs } = await s.from('kotoiq_content_briefs').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
    const { data: lastSync } = await s.from('kotoiq_sync_log').select('*').eq('client_id', client_id).eq('status', 'complete').order('completed_at', { ascending: false }).limit(1)

    const kws = keywords || []
    return NextResponse.json({
      client,
      generated_at: new Date().toISOString(),
      summary: {
        total_keywords: kws.length,
        top3: kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 3).length,
        top10: kws.filter(k => k.sc_avg_position && k.sc_avg_position <= 10).length,
        total_ads_spend: Math.round(kws.reduce((s, k) => s + (k.ads_cost_cents || 0), 0) / 100),
        wasted_spend: Math.round(kws.filter(k => k.category === 'organic_cannibal').reduce((s, k) => s + (k.ads_cost_cents || 0), 0) / 100),
        avg_opportunity: kws.length > 0 ? Math.round(kws.reduce((s, k) => s + (k.opportunity_score || 0), 0) / kws.length) : 0,
      },
      categories: Object.fromEntries(
        ['organic_cannibal', 'striking_distance', 'quick_win', 'dark_matter', 'paid_only', 'defend', 'underperformer', 'monitor']
          .map(cat => [cat, kws.filter(k => k.category === cat).length])
      ),
      top_opportunities: kws.slice(0, 20).map(k => ({
        keyword: k.keyword, opportunity: k.opportunity_score, rank_propensity: k.rank_propensity,
        position: k.sc_avg_position, volume: k.kp_monthly_volume, ads_spend: k.ads_cost_cents ? Math.round(k.ads_cost_cents / 100) : 0,
        category: k.category, intent: k.intent,
      })),
      recommendations: recs || [],
      briefs: (briefs || []).map(b => ({ keyword: b.target_keyword, url: b.target_url, status: b.status, word_count: b.target_word_count })),
      last_sync: lastSync?.[0]?.completed_at || null,
    })
  }

  // ── CLIENT CRUD (server-side to bypass RLS) ────────────────────────
  if (action === 'create_client') {
    const { agency_id, name, website, primary_service } = body
    if (!agency_id || !name) return NextResponse.json({ error: 'agency_id and name required' }, { status: 400 })
    const { data, error } = await s.from('clients').insert({
      name, website: website || null, primary_service: primary_service || null, agency_id,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ client: data })
  }

  if (action === 'update_client') {
    const { client_id, agency_id, name, website, primary_service } = body
    if (!client_id || !agency_id) return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
    // Verify client belongs to agency
    const { data: existing } = await s.from('clients').select('id').eq('id', client_id).eq('agency_id', agency_id).single()
    if (!existing) return NextResponse.json({ error: 'Client not found or not owned by this agency' }, { status: 404 })
    const update: any = {}
    if (name) update.name = name
    if (website !== undefined) update.website = website || null
    if (primary_service !== undefined) update.primary_service = primary_service || null
    const { data, error } = await s.from('clients').update(update).eq('id', client_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ client: data })
  }

  // ── DEEP ENRICH: Run all SEO tools and store results ────────────────
  if (action === 'deep_enrich') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()
    if (!client?.website) return NextResponse.json({ error: 'Client has no website URL' }, { status: 400 })

    let normalizedUrl = client.website.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
    const hostname = new URL(normalizedUrl).hostname

    // Get location from latest intel report or client data
    const { data: latestReport } = await s.from('koto_intel_reports').select('inputs')
      .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
    const location = latestReport?.inputs?.location || ''
    const industry = client.primary_service || latestReport?.inputs?.industry || ''

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

    // Helper to call internal API routes
    async function callSEO(path: string, body: any) {
      try {
        const res = await fetch(`${appUrl}/api/seo/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        })
        return res.ok ? await res.json() : null
      } catch { return null }
    }

    // Run ALL tools in parallel
    const [
      domainData,
      technicalAudit,
      onpageAudit,
      citationCheck,
      aiVisibility,
      contentGap,
      marketDensity,
      keywordGap,
      gridScan,
      competitorIntel,
      ppcKeywords,
    ] = await Promise.all([
      // Domain enrichment (direct import, no HTTP call)
      enrichDomain(hostname).catch(() => null),

      // Technical audit
      callSEO('technical-audit', { url: normalizedUrl, max_pages: 5 }),

      // On-page audit
      callSEO('onpage-audit', { url: normalizedUrl, client_id, agency_id, business_name: client.name, location, sic_code: '' }),

      // Citation check
      callSEO('citation-check', { client_id, agency_id }),

      // AI visibility
      callSEO('ai-visibility', { business_name: client.name, industry, location, website: normalizedUrl }),

      // Content gap (needs GSC connection)
      callSEO('content-gap', { client_id, agency_id }),

      // Market density
      location ? callSEO('market-density', { location, business_type: industry, radius_km: 16 }) : null,

      // Keyword gap (needs GSC connection)
      callSEO('keyword-gap', { client_id, agency_id, business_name: client.name, industry, location, website: normalizedUrl }),

      // Grid scan (local pack positions)
      location && industry ? callSEO('grid-scan', { keyword: industry, location, target_business: client.name, grid_size: 3, spacing_km: 1.5 }) : null,

      // Competitor intel (needs a place_id — try to find from existing data)
      (async () => {
        // Find place_id from GBP data in latest intel report
        const gbpPlaceId = latestReport?.inputs?.place_id
        if (gbpPlaceId) return callSEO('competitor-intel', { client_id, agency_id, place_id: gbpPlaceId, location, business_name: client.name })
        // Try to find via Places search
        const apiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || ''
        if (!apiKey || !client.name) return null
        try {
          const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id' },
            body: JSON.stringify({ textQuery: `${client.name} ${location}`, maxResultCount: 1 }),
            signal: AbortSignal.timeout(8000),
          })
          const d = await searchRes.json()
          const placeId = d.places?.[0]?.id
          if (placeId) return callSEO('competitor-intel', { client_id, agency_id, place_id: placeId, location, business_name: client.name })
        } catch { /* skip */ }
        return null
      })(),

      // PPC keywords
      callSEO('ppc-keywords', { keyword: industry, location, target_business: client.name }),
    ])

    // Store enrichment data
    const enrichment = {
      domain: domainData,
      technical_audit: technicalAudit ? {
        score: technicalAudit.ai_report?.overall_score,
        grade: technicalAudit.ai_report?.grade,
        summary: technicalAudit.ai_report?.summary,
        critical_issues: technicalAudit.ai_report?.critical_issues,
        priority_fixes: technicalAudit.ai_report?.priority_fixes,
        speed: technicalAudit.speed,
        pages_crawled: technicalAudit.pages_crawled,
        broken_pages: technicalAudit.summary?.broken,
        missing_meta: technicalAudit.summary?.no_meta,
        missing_alt: technicalAudit.summary?.missing_alt,
        no_schema: technicalAudit.summary?.no_schema,
      } : null,
      onpage_audit: onpageAudit ? {
        score: onpageAudit.score,
        passes: onpageAudit.passes?.length,
        fails: onpageAudit.fails?.length,
        critical_fails: onpageAudit.fails?.filter((f: any) => f.severity === 'critical'),
        ai_summary: onpageAudit.ai?.executive_summary,
        keyword_gaps: onpageAudit.ai?.keyword_gaps,
        title_suggestion: onpageAudit.ai?.title_suggestion,
        meta_suggestion: onpageAudit.ai?.meta_suggestion,
        local_seo_tips: onpageAudit.ai?.local_seo_tips,
        speed: onpageAudit.speed,
      } : null,
      citations: citationCheck ? {
        score: citationCheck.score,
        found: citationCheck.found_count,
        missing: citationCheck.missing_count,
        total: citationCheck.total_checked,
        nap_issues: citationCheck.nap_issues_count,
        directories: citationCheck.directories,
        ai_summary: citationCheck.ai?.summary,
        top_priorities: citationCheck.ai?.top_priorities,
        quick_win: citationCheck.ai?.quick_win,
      } : null,
      ai_visibility: aiVisibility ? {
        mention_rate: aiVisibility.mention_rate,
        positive_rate: aiVisibility.positive_rate,
        score: aiVisibility.report?.visibility_score,
        grade: aiVisibility.report?.grade,
        summary: aiVisibility.report?.summary,
        optimization_tips: aiVisibility.report?.optimization_tips,
        content_to_create: aiVisibility.report?.content_to_create,
        schema_recommendations: aiVisibility.report?.schema_recommendations,
        results: aiVisibility.results,
      } : null,
      content_gap: contentGap?.strategy ? {
        topic_clusters: contentGap.strategy.topic_clusters,
        quick_content_wins: contentGap.strategy.quick_content_wins,
        content_calendar: contentGap.strategy.content_calendar,
        missing_page_types: contentGap.strategy.missing_page_types,
        content_to_update: contentGap.strategy.content_to_update,
      } : null,
      market_density: marketDensity?.summary ? {
        total_competitors: marketDensity.summary.total_competitors,
        saturation_score: marketDensity.summary.saturation_score,
        market_assessment: marketDensity.summary.market_assessment,
        opportunity_level: marketDensity.summary.opportunity_level,
        nearby_5km: marketDensity.summary.nearby_5km,
        high_rated: marketDensity.summary.high_rated_count,
        density_per_sq_km: marketDensity.summary.density_per_sq_km,
      } : null,
      keyword_gap: keywordGap?.analysis ? {
        gap_opportunities: keywordGap.analysis.gap_opportunities,
        quick_wins: keywordGap.analysis.quick_wins,
        location_keywords: keywordGap.analysis.location_keywords,
        long_tail_opportunities: keywordGap.analysis.long_tail_opportunities,
        competitor_keywords: keywordGap.analysis.competitor_keywords,
        content_calendar: keywordGap.analysis.content_calendar,
        current_strengths: keywordGap.analysis.current_strengths,
      } : null,
      grid_scan: gridScan ? {
        keyword: gridScan.keyword,
        grid_size: gridScan.grid_size,
        results: gridScan.grid_results,
        coverage_pct: gridScan.summary?.coverage_pct,
        avg_rank: gridScan.summary?.avg_rank,
        best_rank: gridScan.summary?.best_rank,
        ranked_cells: gridScan.summary?.ranked_cells,
        total_cells: gridScan.summary?.total_cells,
      } : null,
      competitor_intel: competitorIntel ? {
        client_score: competitorIntel.client?.score,
        competitors: competitorIntel.competitors?.map((c: any) => ({ name: c.name, score: c.score, rating: c.rating, reviews: c.review_count })),
        market_position: competitorIntel.intel?.market_position,
        biggest_threat: competitorIntel.intel?.biggest_threat,
        strengths: competitorIntel.intel?.strengths,
        weaknesses: competitorIntel.intel?.weaknesses,
        recommended_actions: competitorIntel.intel?.recommended_actions,
        quick_wins: competitorIntel.intel?.quick_wins,
      } : null,
      ppc_keywords: ppcKeywords ? {
        branded_keywords: ppcKeywords.branded_keywords,
        service_keywords: ppcKeywords.service_keywords,
        long_tail_keywords: ppcKeywords.long_tail_keywords,
        negative_keywords: ppcKeywords.negative_keywords,
        target_cpc_range: ppcKeywords.target_cpc_range,
        monthly_budget_suggestion: ppcKeywords.monthly_budget_suggestion,
        campaign_strategy: ppcKeywords.campaign_strategy,
        ad_headlines: ppcKeywords.ad_headline_ideas,
        ad_descriptions: ppcKeywords.ad_description_ideas,
      } : null,
      enriched_at: new Date().toISOString(),
      tools_run: [
        domainData ? 'Domain Enrichment' : null,
        technicalAudit ? 'Technical SEO Audit' : null,
        onpageAudit ? 'On-Page Audit' : null,
        citationCheck ? 'Citation Check (20 directories)' : null,
        aiVisibility ? 'AI Visibility Test' : null,
        contentGap ? 'Content Gap Analysis' : null,
        marketDensity ? 'Market Density Analysis' : null,
        keywordGap ? 'Keyword Gap Analysis' : null,
        gridScan ? 'Local Pack Grid Scan' : null,
        competitorIntel ? 'Competitor Intelligence' : null,
        ppcKeywords ? 'PPC Keyword Strategy' : null,
      ].filter(Boolean),
    }

    // Save to a jsonb column on the latest keyword sync or as metadata
    // Store as a kotoiq_sync_log entry with enrichment data
    await s.from('kotoiq_sync_log').insert({
      client_id, source: 'deep_enrich', status: 'complete',
      records_synced: enrichment.tools_run.length,
      completed_at: new Date().toISOString(),
      metadata: enrichment,
    })

    // Merge keyword gap opportunities into UKF
    if (keywordGap?.analysis?.gap_opportunities?.length) {
      const newKws = keywordGap.analysis.gap_opportunities
        .filter((g: any) => g.keyword)
        .map((g: any) => ({
          client_id, agency_id: agency_id || null,
          keyword: g.keyword, fingerprint: fingerprint(g.keyword),
          intent: g.intent || classifyIntent(g.keyword),
          kp_monthly_volume: g.monthly_volume_estimate ? parseInt(String(g.monthly_volume_estimate).replace(/\D/g, '')) || null : null,
          category: g.priority === 'high' ? 'quick_win' : g.priority === 'medium' ? 'striking_distance' : 'dark_matter',
          opportunity_score: g.priority === 'high' ? 80 : g.priority === 'medium' ? 60 : 40,
          rank_propensity: g.difficulty === 'easy' ? 75 : g.difficulty === 'medium' ? 50 : 25,
          recommendation: g.action || null,
          data_period: `Deep enrich — ${new Date().toISOString().split('T')[0]}`,
        }))
      // Upsert — don't duplicate existing keywords
      for (const kw of newKws) {
        const { data: existing } = await s.from('kotoiq_keywords').select('id').eq('client_id', client_id).eq('fingerprint', kw.fingerprint).single()
        if (!existing) await s.from('kotoiq_keywords').insert(kw)
      }
    }

    // Merge content gap quick wins into recommendations
    if (contentGap?.strategy?.quick_content_wins?.length) {
      const recs = contentGap.strategy.quick_content_wins.slice(0, 5).map((w: any) => ({
        client_id, agency_id: agency_id || null,
        type: 'new_content', priority: 'high',
        title: w.title, detail: `${w.why}. Target keyword: "${w.target_keyword}". Estimated effort: ${w.estimated_time}.`,
        keywords: [w.target_keyword], estimated_impact: `New page targeting "${w.target_keyword}"`, effort: w.estimated_time === '1 hour' ? 'quick_win' : 'moderate',
      }))
      if (recs.length) await s.from('kotoiq_recommendations').insert(recs)
    }

    // Merge citation fixes into recommendations
    if (citationCheck?.ai?.top_priorities?.length) {
      const recs = citationCheck.ai.top_priorities.slice(0, 3).map((p: string) => ({
        client_id, agency_id: agency_id || null,
        type: 'quick_win', priority: 'medium',
        title: 'Fix citation: ' + p.slice(0, 80), detail: p,
        estimated_impact: `Improve NAP consistency (current score: ${citationCheck.score}/100)`, effort: 'quick_win',
      }))
      if (recs.length) await s.from('kotoiq_recommendations').insert(recs)
    }

    // Store grid scan results in kotoiq_gmb_grid
    if (gridScan?.grid_results?.length) {
      await s.from('kotoiq_gmb_grid').delete().eq('client_id', client_id).eq('keyword', gridScan.keyword)
      await s.from('kotoiq_gmb_grid').insert(
        gridScan.grid_results.map((g: any) => ({
          client_id, keyword: gridScan.keyword,
          lat: g.lat, lng: g.lng, grid_row: g.row, grid_col: g.col,
          position: g.rank, in_pack: g.rank && g.rank <= 3, pack_rank: g.rank && g.rank <= 3 ? g.rank : null,
          competitor_name: g.top3?.[0] || null,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      tools_run: enrichment.tools_run,
      enrichment,
    })
  }

  // ── GET ENRICHMENT DATA ───────────────────────────────────────────────
  if (action === 'get_enrichment') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data } = await s.from('kotoiq_sync_log').select('metadata, completed_at')
      .eq('client_id', client_id).eq('source', 'deep_enrich').order('completed_at', { ascending: false }).limit(1).single()
    return NextResponse.json({ enrichment: data?.metadata || null, enriched_at: data?.completed_at || null })
  }

  // ── DataForSEO — SERP scan with AI Overview detection ────────
  if (action === 'dfs_serp_scan') {
    const { keyword, keywords: kwList, location, domain, client_id, agency_id } = body
    const kws = kwList || (keyword ? [keyword] : [])
    if (!kws.length) return NextResponse.json({ error: 'keyword(s) required' }, { status: 400 })

    const results: any[] = []
    for (const kw of kws.slice(0, 20)) {
      try {
        const serp = await getSERPResults(kw, location || 'United States')
        let position: number | null = null
        let matchUrl: string | null = null
        if (domain) {
          const clean = domain.replace(/^www\./, '').toLowerCase()
          for (const item of serp.items) {
            if (item.domain?.toLowerCase().includes(clean)) { position = item.rank_group; matchUrl = item.url; break }
          }
        }
        // Update keyword in DB
        if (client_id) {
          await s.from('kotoiq_keywords').update({
            sc_position: position || undefined,
            ai_overview: serp.ai_overview?.present || false,
            serp_features: { ai_overview: serp.ai_overview, featured_snippet: serp.featured_snippet, local_pack: serp.local_pack, paa: serp.people_also_ask, related: serp.related_searches, knowledge_graph: serp.knowledge_graph },
            updated_at: new Date().toISOString(),
          }).eq('client_id', client_id).eq('keyword', fingerprint(kw))
          // Save snapshot
          await s.from('kotoiq_snapshots').insert({ client_id, agency_id, keyword: kw, snapshot_type: 'dfs_serp', data: serp })
        }
        results.push({ keyword: kw, position, ai_overview: !!serp.ai_overview?.present, featured_snippet: !!serp.featured_snippet, local_pack: serp.local_pack?.length || 0, paa: serp.people_also_ask?.length || 0 })
      } catch (e: any) { results.push({ keyword: kw, error: e.message }) }
    }
    return NextResponse.json({ success: true, results, scanned: results.length })
  }

  // ── DataForSEO — GMB Grid scan ──────────────────────────────
  if (action === 'dfs_grid_scan') {
    const { keyword, business_name, lat, lng, grid_size, spacing_km, client_id, agency_id } = body
    if (!keyword || !business_name || !lat || !lng) return NextResponse.json({ error: 'keyword, business_name, lat, lng required' }, { status: 400 })
    try {
      const result = await runGMBGridScan(keyword, business_name, parseFloat(lat), parseFloat(lng), grid_size || 5, spacing_km || 1.5)
      if (client_id) {
        await s.from('kotoiq_gmb_grid').insert({
          client_id, agency_id, keyword, business_name,
          center_lat: lat, center_lng: lng, grid_size: grid_size || 5,
          grid_data: result, avg_rank: result.avg_rank, best_rank: result.best_rank,
          worst_rank: result.worst_rank, ranked_cells: result.ranked_cells,
          total_cells: result.total_cells, coverage_pct: result.coverage_pct,
        })
      }
      return NextResponse.json({ success: true, result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── DataForSEO — bulk rank check ────────────────────────────
  if (action === 'dfs_rank_check') {
    const { domain, keywords: kwList, client_id } = body
    if (!domain || !kwList?.length) return NextResponse.json({ error: 'domain and keywords required' }, { status: 400 })
    try {
      const results = await getKeywordRankings(domain, kwList.slice(0, 50))
      if (client_id) {
        for (const r of results) {
          if (r.position) {
            await s.from('kotoiq_keywords').update({ sc_position: r.position, updated_at: new Date().toISOString() })
              .eq('client_id', client_id).eq('keyword', fingerprint(r.keyword))
          }
        }
      }
      return NextResponse.json({ success: true, results })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── DataForSEO — account balance ────────────────────────────
  if (action === 'dfs_balance') {
    try { return NextResponse.json(await getDFSBalance()) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── Page analyzer helper ────────────────────────────────────────────────────
async function analyzePageForKeyword(url: string, keyword: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const lc = html.toLowerCase()
    const kwLc = keyword.toLowerCase()

    // Word count (strip tags)
    const textOnly = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const wordCount = textOnly.split(/\s+/).length

    // Headings
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
    const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

    // Title + meta desc
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || ''
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const metaDesc = metaDescMatch?.[1] || ''

    // Schema detection
    const schemas: string[] = []
    const ldMatches = html.matchAll(/<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)
    for (const m of ldMatches) {
      try { const p = JSON.parse(m[1]); if (p['@type']) schemas.push(String(p['@type'])) } catch {}
    }

    // FAQ detection
    const hasFAQ = lc.includes('faq') || lc.includes('frequently asked') || schemas.includes('FAQPage')
    const faqCount = [...html.matchAll(/<(dt|summary)[^>]*>/gi)].length || (hasFAQ ? h3s.filter(h => h.includes('?')).length : 0)

    // Images
    const images = [...html.matchAll(/<img[^>]+>/gi)]
    const imagesWithAlt = images.filter(m => /alt=["'][^"']+["']/i.test(m[0]))

    // Internal links
    const domain = new URL(url).hostname
    const internalLinks = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .filter(m => { try { return new URL(m[1], url).hostname === domain } catch { return m[1].startsWith('/') } }).length

    // Keyword in key places
    const kwInTitle = title.toLowerCase().includes(kwLc)
    const kwInH1 = h1s.some(h => h.toLowerCase().includes(kwLc))
    const kwInFirst100 = textOnly.slice(0, 500).toLowerCase().includes(kwLc)
    const kwInMeta = metaDesc.toLowerCase().includes(kwLc)

    // Opening paragraph length (for featured snippet)
    const firstPara = textOnly.slice(0, 300).split(/[.!?]/).slice(0, 2).join('. ').trim()
    const firstParaWords = firstPara.split(/\s+/).length

    return {
      url,
      word_count: wordCount,
      title: title.slice(0, 80),
      title_length: title.length,
      meta_description: metaDesc.slice(0, 180),
      meta_desc_length: metaDesc.length,
      h1: h1s[0] || null,
      h1_count: h1s.length,
      h2_count: h2s.length,
      h2s: h2s.slice(0, 10),
      h3_count: h3s.length,
      schemas,
      has_faq: hasFAQ,
      faq_count: faqCount,
      image_count: images.length,
      images_with_alt: imagesWithAlt.length,
      internal_links: internalLinks,
      keyword_in_title: kwInTitle,
      keyword_in_h1: kwInH1,
      keyword_in_first_100: kwInFirst100,
      keyword_in_meta: kwInMeta,
      first_para_words: firstParaWords,
    }
  } catch { return null }
}
