// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE MARKETING ENGINE
// Google Ads API + GA4 + Search Console + GMB + Sitemap → AI Optimization
// ══════════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase'
import { callClaude } from './ai'
import { getAccessToken, refreshGoogleToken } from './seoService'

const ADS_API = 'https://googleads.googleapis.com/v17'
const GMB_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GMB_INSIGHTS_API = 'https://businessprofileperformance.googleapis.com/v1'

// ── Get Google Ads connection for client ──────────────────────────────────────
export async function getAdsConnection(clientId) {
  const { data } = await supabase.from('seo_connections')
    .select('*').eq('client_id', clientId).eq('provider', 'ads').single()
  return data
}

// ── Fetch all campaigns from Google Ads ──────────────────────────────────────
export async function fetchGoogleAdsCampaigns(connection, customerId) {
  try {
    const token = await getAccessToken(connection)
    const query = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros, campaign_budget.type,
        campaign.bidding_strategy_type,
        campaign.target_cpa.target_cpa_micros,
        campaign.target_roas.target_roas,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions, metrics.conversions_value,
        metrics.ctr, metrics.average_cpc, metrics.search_impression_share,
        metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING LAST_30_DAYS
    `
    const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json',
        'login-customer-id': customerId,
      },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `Ads API ${res.status}`)
    }
    const data = await res.json()
    return data.results || []
  } catch(e) {
    console.error('[Ads] fetchCampaigns failed:', e.message)
    return []
  }
}

// ── Fetch keywords for a customer ────────────────────────────────────────────
export async function fetchGoogleAdsKeywords(connection, customerId) {
  try {
    const token = await getAccessToken(connection)
    const query = `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        ad_group.id, ad_group.name, ad_group.status,
        campaign.id, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions, metrics.average_cpc,
        metrics.search_top_impression_share,
        ad_group_criterion.position_estimates.first_page_cpc_micros,
        ad_group_criterion.position_estimates.first_position_cpc_micros
      FROM keyword_view
      WHERE ad_group_criterion.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND campaign.status != 'REMOVED'
      AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
      LIMIT 1000
    `
    const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch(e) { console.error('[Ads] fetchKeywords failed:', e.message); return [] }
}

// ── Fetch search terms report ─────────────────────────────────────────────────
export async function fetchSearchTerms(connection, customerId) {
  try {
    const token = await getAccessToken(connection)
    const query = `
      SELECT
        search_term_view.search_term,
        search_term_view.status,
        ad_group.id, campaign.id,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
      AND metrics.impressions > 5
      ORDER BY metrics.cost_micros DESC
      LIMIT 2000
    `
    const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch(e) { console.error('[Ads] fetchSearchTerms failed:', e.message); return [] }
}

// ── Fetch GMB performance insights ───────────────────────────────────────────
export async function fetchGMBInsights(connection, locationName, startDate, endDate) {
  try {
    const token = await getAccessToken(connection)
    const res = await fetch(
      `${GMB_INSIGHTS_API}/${locationName}:fetchMultiDailyMetricsTimeSeries?` +
      `dailyMetrics=BUSINESS_IMPRESSIONS_DESKTOP_SEARCH&` +
      `dailyMetrics=BUSINESS_IMPRESSIONS_MOBILE_SEARCH&` +
      `dailyMetrics=CALL_CLICKS&dailyMetrics=WEBSITE_CLICKS&` +
      `dailyMetrics=BUSINESS_DIRECTION_REQUESTS&` +
      `dailyRange.start_date.year=${startDate.split('-')[0]}&` +
      `dailyRange.start_date.month=${startDate.split('-')[1]}&` +
      `dailyRange.start_date.day=${startDate.split('-')[2]}&` +
      `dailyRange.end_date.year=${endDate.split('-')[0]}&` +
      `dailyRange.end_date.month=${endDate.split('-')[1]}&` +
      `dailyRange.end_date.day=${endDate.split('-')[2]}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (!res.ok) return null
    return res.json()
  } catch(e) { console.error('[GMB] fetchInsights failed:', e.message); return null }
}

// ── Fetch + scan sitemap pages ────────────────────────────────────────────────
export async function fetchSitemapPages(sitemapUrl) {
  try {
    const res = await fetch(`/api/perf/sitemap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sitemapUrl }),
    })
    if (!res.ok) throw new Error('Sitemap fetch failed')
    return res.json()
  } catch(e) { console.error('[Sitemap] fetch failed:', e.message); return { pages: [] } }
}

// ── AI: Analyze a single landing page ────────────────────────────────────────
export async function analyzePageWithAI(page, campaignContext = '') {
  const prompt =
    'Analyze this web page as a potential Google Ads landing page.\n\n' +
    'URL: ' + page.url + '\n' +
    'Title: ' + (page.title||'none') + '\n' +
    'H1: ' + (page.h1||'none') + '\n' +
    'Meta description: ' + (page.metaDesc||'none') + '\n' +
    'Word count: ' + (page.wordCount||0) + '\n' +
    'Has CTA button: ' + (page.hasCTA?'yes':'no') + '\n' +
    'Has form: ' + (page.hasForm?'yes':'no') + '\n' +
    'Has phone number: ' + (page.hasPhone?'yes':'no') + '\n' +
    'Content preview: ' + (page.contentPreview||'').slice(0,300) + '\n' +
    (campaignContext ? '\nCampaign context: ' + campaignContext + '\n' : '') +
    '\nReturn JSON: {"overall_score":0-100,"headline_score":0-100,"content_score":0-100,' +
    '"cta_score":0-100,"summary":"what this page is about in one sentence",' +
    '"strengths":["s1","s2"],"weaknesses":["w1","w2"],' +
    '"primary_keywords":["kw1","kw2","kw3"],' +
    '"best_for_queries":["query1","query2","query3"],' +
    '"recommendation":"one sentence on how to improve this page for ads"}'

  const raw = await callClaude(
    'You are a Google Ads landing page quality expert. Return only raw JSON.',
    prompt, 600
  )
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  return JSON.parse(clean.slice(s,e+1))
}

// ── AI: Generate optimization recommendations ─────────────────────────────────
export async function generateOptimizationRecs(clientData) {
  const {
    campaigns = [], keywords = [], searchTerms = [],
    ga4Data = null, gscData = null, pages = []
  } = clientData

  // Prepare data summary for Claude
  const topCampaigns = campaigns.slice(0,5).map(c=>
    `${c.name}: spend=$${c.cost?.toFixed(0)||0}, ROAS=${c.roas?.toFixed(2)||0}, CPA=$${c.cpa?.toFixed(0)||0}, IS=${c.impression_share?.toFixed(0)||0}%`
  ).join('\n')

  const lowQualityKws = keywords.filter(k=>k.quality_score && k.quality_score < 6).slice(0,10)
  const highCostNoConvKws = keywords
    .filter(k=>k.cost > 50 && k.conversions < 1)
    .sort((a,b)=>b.cost-a.cost).slice(0,10)

  const wastedSearchTerms = searchTerms
    .filter(st=>st.clicks > 5 && st.conversions < 0.5 && st.cost > 10)
    .sort((a,b)=>b.cost-a.cost).slice(0,15)

  const topPages = pages.filter(p=>p.ai_score).sort((a,b)=>b.ai_score-a.ai_score).slice(0,5)

  const prompt =
    'You are a senior Google Ads optimization specialist. Analyze this account data and generate specific, actionable recommendations.\n\n' +
    'CAMPAIGNS (last 30 days):\n' + topCampaigns + '\n\n' +
    'LOW QUALITY SCORE KEYWORDS (' + lowQualityKws.length + '):\n' +
    lowQualityKws.map(k=>`"${k.keyword}" QS=${k.quality_score} cost=$${k.cost?.toFixed(0)}`).join(', ') + '\n\n' +
    'HIGH SPEND / ZERO CONVERSIONS KEYWORDS:\n' +
    highCostNoConvKws.map(k=>`"${k.keyword}" $${k.cost?.toFixed(0)}`).join(', ') + '\n\n' +
    'WASTED SPEND SEARCH TERMS (add as negatives):\n' +
    wastedSearchTerms.map(st=>`"${st.search_term}" $${st.cost?.toFixed(0)} ${st.clicks}clicks 0conv`).join('\n') + '\n\n' +
    (ga4Data ? 'GA4: ' + JSON.stringify(ga4Data).slice(0,300) + '\n\n' : '') +
    (gscData ? 'Search Console top queries: ' + JSON.stringify(gscData).slice(0,200) + '\n\n' : '') +
    'TOP LANDING PAGES:\n' +
    topPages.map(p=>`${p.url} score=${p.ai_score} "${p.h1}"`).join('\n') + '\n\n' +
    'Generate 8-12 specific recommendations. Each must have a real $ impact estimate.\n' +
    'Return JSON array: [{"type":"bid|budget|negative_keyword|ad_copy|landing_page|keyword_pause|audience","priority":"high|medium|low","title":"short title","description":"specific actionable detail","current_state":{},"recommended":{},"est_impact":"e.g. Save $420/mo or +18% conv rate","est_impact_val":420,"confidence":0.0-1.0,"data_sources":["ads","ga4","gsc"]}]'

  const raw = await callClaude(
    'You are an expert Google Ads optimizer. Return only a raw JSON array, no markdown.',
    prompt, 3000
  )
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('['), e = clean.lastIndexOf(']')
  if (s === -1) return []
  try { return JSON.parse(clean.slice(s,e+1)) }
  catch(_) { return JSON.parse(clean.slice(s,e+1).replace(/,\s*}/g,'}').replace(/,\s*]/g,']')) }
}

// ── AI: Generate RSA ad copy from page + queries ──────────────────────────────
export async function generateAdCopy(page, topQueries, adGroup) {
  const prompt =
    'Generate Google Responsive Search Ad copy for this landing page and ad group.\n\n' +
    'Landing page: ' + page.url + '\n' +
    'Page headline: ' + (page.h1||page.page_title||'') + '\n' +
    'Page summary: ' + (page.ai_summary||'') + '\n' +
    'Ad group: ' + (adGroup.name||'') + '\n' +
    'Top search queries: ' + topQueries.slice(0,8).join(', ') + '\n\n' +
    'Requirements:\n' +
    '- 15 headlines (max 30 chars each)\n' +
    '- 4 descriptions (max 90 chars each)\n' +
    '- Include primary keyword in at least 3 headlines\n' +
    '- Include a clear CTA in at least 2 headlines\n' +
    '- Include benefits/USPs in descriptions\n' +
    '- No exclamation marks in headlines (Google policy)\n\n' +
    'Return JSON: {"headlines":["h1",...15 total],"descriptions":["d1",...4 total],"display_path_1":"path1","display_path_2":"path2"}'

  const raw = await callClaude(
    'You are a Google Ads copywriter expert. Return only raw JSON.',
    prompt, 1000
  )
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  return JSON.parse(clean.slice(s,e+1))
}

// ── Detect anomalies in account metrics ──────────────────────────────────────
export function detectAnomalies(snapshots) {
  const alerts = []
  if (snapshots.length < 7) return alerts

  // Sort by date
  const sorted = [...snapshots].sort((a,b)=>new Date(a.snapshot_date)-new Date(b.snapshot_date))
  const recent = sorted.slice(-7)
  const prev   = sorted.slice(-14,-7)

  const avg = (arr, key) => arr.reduce((s,d)=>s+(d[key]||0),0) / (arr.length||1)

  const checks = [
    { key:'ads_roas',   name:'ROAS',          threshold:-20, severity:'critical', label:'ROAS dropped' },
    { key:'ads_spend',  name:'Spend',          threshold:30,  severity:'warning',  label:'Spend spike' },
    { key:'ads_cpa',    name:'CPA',            threshold:30,  severity:'warning',  label:'CPA increased' },
    { key:'gsc_ctr',    name:'Organic CTR',    threshold:-25, severity:'info',     label:'Organic CTR dropped' },
  ]

  for (const check of checks) {
    const recentAvg = avg(recent, check.key)
    const prevAvg   = avg(prev,   check.key)
    if (!prevAvg) continue
    const pctChange = ((recentAvg - prevAvg) / prevAvg) * 100
    if (Math.abs(pctChange) >= Math.abs(check.threshold)) {
      alerts.push({
        alert_type:      check.key + '_anomaly',
        severity:        check.severity,
        title:           check.label + ' alert',
        detail:          `${check.name} changed ${pctChange.toFixed(1)}% vs prior 7 days`,
        metric_name:     check.key,
        metric_value:    recentAvg,
        metric_prev:     prevAvg,
        pct_change:      pctChange,
        metric_threshold: check.threshold,
      })
    }
  }
  return alerts
}

export { ADS_API }
