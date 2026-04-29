import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getAccessToken, fetchSearchConsoleData, fetchGA4Data } from '@/lib/seoService'
import { fetchGoogleAdsKeywords, fetchGoogleAdsCampaigns } from '@/lib/perfMarketing'
import { enrichDomain } from '@/lib/domainEnrichment'
import { getSERPResults, runGMBGridScan, getKeywordRankings, getBalance as getDFSBalance, getDomainCompetitors, getDomainRankedKeywords, getDomainIntersection } from '@/lib/dataforseo'
import { pullFullGBPData, listQuestions, answerQuestion } from '@/lib/gbpApi'
import { scanBrandSERP, getBrandSERP, getBrandDefenseStrategy } from '@/lib/brandSerpEngine'
import { generateBrief } from '@/lib/contentBriefEngine'
import { analyzeBacklinks, getBacklinkProfile } from '@/lib/backlinkEngine'
import { auditEEAT, getEEATAudit } from '@/lib/eeatEngine'
import { auditSchema, getSchemaAudit, generateSchemaForUrl } from '@/lib/schemaEngine'
import { scanInternalLinks, getInternalLinkAudit, getLinkSuggestions } from '@/lib/internalLinkEngine'
import { generateTopicalMap, getTopicalMap, updateTopicalNode, analyzeTopicalCoverage } from '@/lib/topicalMapEngine'
import { buildContentInventory, getContentInventory, getRefreshPlan } from '@/lib/contentRefreshEngine'
import { analyzeSemanticNetwork, getSemanticAnalysis } from '@/lib/semanticAnalyzer'
import { auditTechnicalDeep, getTechnicalDeep } from '@/lib/technicalSeoEngine'
import { analyzeQueryPaths, getQueryClusters } from '@/lib/queryPathEngine'
import { analyzeReviews, getReviewIntelligence, createReviewCampaign, getReviewCampaigns } from '@/lib/reviewIntelEngine'
import { buildContentCalendar, getContentCalendar, updateCalendarItem, calculateMomentum, getMomentum } from '@/lib/contentCalendarEngine'
import { runQueryGapAnalyzer, runFrameAnalyzer, runSemanticRoleLabeler, runNamedEntitySuggester } from '@/lib/semanticAgents'
import { runContextlessWordRemover, runTopicalityScorer, runSentenceFilterer, runSafeAnswerGenerator } from '@/lib/semanticPostProcessors'
import { runLexicalRelationAnalyzer, runTopicClusterer, runTitleQueryAuditor, runKeyFactSummarizer, runBridgeTopicSuggester } from '@/lib/semanticAgentsTier2'
import { runCommentGenerator, runSentimentOptimizer, runEntityInserter, runMetadiscourseAuditor, runNgramExtractor, runTripleGenerator, runSpamHitDetector, runQualityUpdateAuditor } from '@/lib/semanticAgentsTier3'
import { runTopicalAuthorityAuditor, runContextVectorAligner, runMultiEngineAEO, runContentDecayPredictor, runCompetitorTopicalMapExtractor, runPassageRankingOptimizer } from '@/lib/kotoiqAdvancedAgents'
import { runSerpIntentClassifier, runQueryDocumentAlignmentScorer, runTopicalBordersDetector, runCornerstoneContentIdentifier, runLinkPropositionValueScorer } from '@/lib/kotoiqAdvancedAgents2'
import { geoTagImage } from '@/lib/imageGeoTagger'
import { generateGMBImage, generateImageCaption, uploadImageToStorage, uploadImageToGBP } from '@/lib/gmbImageEngine'
import { analyzeUpworkJob, generateProposalPackage } from '@/lib/upworkChecklistEngine'
import { checkPlagiarism, getPlagiarismHistory } from '@/lib/plagiarismEngine'
import { analyzeOnPage, getOnPageHistory } from '@/lib/onPageEngine'
import { runRankGridPro, getGridScanHistory, compareGridScans } from '@/lib/rankGridProEngine'
import { removeAIWatermarks } from '@/lib/watermarkRemover'
import { runGSCAudit, getGSCAudit } from '@/lib/gscAuditEngine'
import { runBingAudit, getBingAudit } from '@/lib/bingAuditEngine'
import { scanAndGenerateBacklinks, getBacklinkOpportunities } from '@/lib/backlinkOpportunityEngine'
import { askKotoIQ, listConversations, getConversation, deleteConversation } from '@/lib/askKotoIQEngine'
import { setupCompetitorWatch, runCompetitorWatchCheck, getCompetitorEvents } from '@/lib/competitorWatchEngine'
import { setupSlackIntegration, setupTeamsIntegration, sendDailyDigest } from '@/lib/slackTeamsIntegration'
import { calculateIndustryBenchmarks, getBenchmarkForClient } from '@/lib/industryBenchmarkEngine'
import { generateScorecard } from '@/lib/scorecardEngine'
import { generateStrategicPlan, getLatestStrategicPlan } from '@/lib/strategyEngine'
import { convertTriplesToSchema, autoInjectSchemaFromPage } from '@/lib/tripleSchemaIntegration'
import { exportKnowledgeGraph } from '@/lib/knowledgeGraphExporter'
import { runAutonomousPipeline, getPipelineRuns, getPipelineRun } from '@/lib/autonomousPipeline'
import { triggerAutoSetup } from '@/lib/voiceOnboardingAutoSetup'
import { generateHyperlocalFromGrid } from '@/lib/hyperlocalContentEngine'
import { crawlSitemaps, getSitemapUrls, getLatestCrawl } from '@/lib/sitemapCrawler'
import { calculateAIVisibility, getAIVisibilityHistory } from '@/lib/aiVisibilityEngine'
import { generateQuickWinQueue, updateQuickWinStatus } from '@/lib/quickWinEngine'
import { getPortalData, checkPortalRateLimit, logPortalView } from '@/lib/portalEngine'
import { runBulkOperation, getBulkOperationStatus } from '@/lib/bulkOperationsEngine'
import { runConversationalBot, getBotConversation, listBotConversations } from '@/lib/conversationalBotEngine'
import { blendThreeAIs } from '@/lib/multiAiBlender'
import { ingestGoogleAds } from '@/lib/ads/ingestGoogleAds'
import { ingestGSC as ingestAdsGSC } from '@/lib/ads/ingestGSC'
import { ingestGA4 as ingestAdsGA4 } from '@/lib/ads/ingestGA4'
import { ingestCSV } from '@/lib/ads/ingestCSV'
import { analyzeWastedSpend, getWastedSpendResults } from '@/lib/ads/wastedSpend'
import { analyzeAnomalies, getAnomalies } from '@/lib/ads/anomalyDetector'
import { analyzeIntentGaps, getIntentGapResults } from '@/lib/ads/intentGaps'
import { comparePeriods } from '@/lib/ads/periodComparison'
import { generateWeeklySummary } from '@/lib/ads/weeklySummary'
import { generateAdCopy, getAdCopy, approveRecommendation, bulkApproveRecommendations } from '@/lib/ads/adCopyEngine'
import { ingestMetaAds } from '@/lib/ads/ingestMetaAds'
import { ingestLinkedInAds } from '@/lib/ads/ingestLinkedInAds'
import { generateForecast, getForecast, getDailySpendTrend } from '@/lib/ads/budgetForecasting'
import { ingestHotjar } from '@/lib/ads/ingestHotjar'
import { ingestClarity } from '@/lib/ads/ingestClarity'
import { detectRelevantConnections } from '@/lib/ads/autoDetectRelevantConnections'
import { autoTriggerSync } from '@/lib/ads/autoTriggerSync'

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

  // visit_in_place — local/physical intent
  if (/\b(near me|directions to|open now|hours of|drive to|walk to|closest|nearby)\b/.test(lc)) return 'visit_in_place'
  if (/\b\d{5}\b/.test(lc)) return 'visit_in_place' // contains zip code
  // Common city/state patterns: "plumber in austin", "dentist dallas tx"
  if (/\b(in|near)\s+[a-z]{3,}\b/.test(lc) && /\b(buy|hire|find|get|shop|eat|visit|plumber|dentist|lawyer|restaurant|store|salon|repair|service)\b/.test(lc)) return 'visit_in_place'

  // answer_seeking — direct answer queries
  if (/^(what is|what are|what does|what do|how much|how many|how long|how far|how old|when does|when is|when did|who is|who are|who was|where is|where are|where do|is it|are there|can you|does|do i need)\b/.test(lc)) return 'answer_seeking'

  if (/\b(buy|price|cost|quote|hire|book|schedule|emergency|same day|24.?hour|free estimate)\b/.test(lc)) return 'transactional'
  if (/\b(best|top|vs|review|compare|affordable|cheap|rated)\b/.test(lc)) return 'commercial'
  if (/\b(how|what|why|when|does|can|is|are|guide|tips|ideas)\b/.test(lc)) return 'informational'
  if (/\b(login|sign in|phone number|address|hours|website)\b/.test(lc)) return 'navigational'
  return 'commercial' // default for local service keywords
}

// ── Quality Threshold (replaces keyword difficulty concept) ─────────────────
function computeQualityThreshold(kw: any, allKeywords: any[]): number {
  // Content quality of ranking pages (proxy: word count + schema)
  const avgCompWordCount = kw.competitor_avg_word_count || 1200
  const contentQualityBar = Math.min(avgCompWordCount / 3000, 1) // 3000 words = max bar
  const hasCompetitorSchema = kw.competitor_has_schema ? 1 : 0
  const contentQuality = contentQualityBar * 0.7 + hasCompetitorSchema * 0.3

  // Relevance threshold: longer queries = more specific = lower threshold
  const queryWords = (kw.keyword || '').split(/\s+/).length
  const querySpecificity = 1 - Math.min(queryWords / 8, 1) // 1-word = hardest, 8+ = easiest

  // Predictive ranking: if client already ranks 11-20, threshold is lower
  const pos = kw.sc_avg_position || 100
  let positionFactor = 1.0
  if (pos <= 20 && pos >= 11) positionFactor = 0.6 // striking distance — easier
  else if (pos <= 10 && pos >= 4) positionFactor = 0.4 // almost there
  else if (pos <= 3) positionFactor = 0.2 // defending
  else positionFactor = 1.0 // not ranking

  // Propagation of relevance: how many related keywords does the client rank for?
  const fp = fingerprint(kw.keyword || '')
  const rootTerms = fp.split(' ').filter((w: string) => w.length > 3)
  let relatedCount = 0
  for (const other of allKeywords) {
    if (other.fingerprint === fp) continue
    const otherFp = other.fingerprint || ''
    if (rootTerms.some((t: string) => otherFp.includes(t))) relatedCount++
  }
  const topicalCoverage = 1 - Math.min(relatedCount / 10, 1) // 10+ related = strong coverage = easier

  const raw = (
    0.30 * contentQuality +
    0.20 * querySpecificity +
    0.25 * positionFactor +
    0.25 * topicalCoverage
  )

  return Math.round(raw * 100)
}

// ── Detect query relationships (represented/representative queries) ─────────
function detectQueryRelationships(keywords: any[]): Record<string, { seed: string; representative: string; variations: string[] }> {
  const fps = keywords.map((kw: any) => ({
    fp: fingerprint(kw.keyword || ''),
    keyword: kw.keyword || '',
    volume: kw.kp_monthly_volume || 0,
  }))

  // Sort by word count ascending so shorter = potential representative
  fps.sort((a: any, b: any) => a.fp.split(' ').length - b.fp.split(' ').length)

  const groups: Record<string, { seed: string; representative: string; variations: string[] }> = {}
  const assigned = new Set<string>()

  for (const item of fps) {
    if (assigned.has(item.fp)) continue

    // Find all keywords that contain this keyword as a substring (represented queries)
    const variations: string[] = []
    for (const other of fps) {
      if (other.fp === item.fp || assigned.has(other.fp)) continue
      // other is a longer variation containing the current keyword
      if (other.fp.includes(item.fp) && other.fp !== item.fp) {
        variations.push(other.keyword)
        assigned.add(other.fp)
      }
    }

    if (variations.length > 0) {
      // The representative is the highest-volume version
      const allInGroup = [item, ...fps.filter((f: any) => variations.includes(f.keyword))]
      const highestVolume = allInGroup.sort((a: any, b: any) => b.volume - a.volume)[0]

      groups[item.fp] = {
        seed: item.keyword,
        representative: highestVolume.keyword,
        variations,
      }
      assigned.add(item.fp)
    }
  }

  return groups
}

// ── AEO Score (AI Engine Optimization) ─────────────────────────────────────
function computeAEOScore(kw: any, pageAnalysis: any): number {
  if (!pageAnalysis) return 0

  // FORMAT MATCH (30%) — Does content format match AI Overview preferences?
  let formatScore = 0
  // Direct answer in first paragraph (definition-style opening)
  if (pageAnalysis.first_para_words && pageAnalysis.first_para_words >= 20 && pageAnalysis.first_para_words <= 60) formatScore += 0.3
  else if (pageAnalysis.first_para_words && pageAnalysis.first_para_words <= 80) formatScore += 0.15
  // Question-answer H2/H3 structure
  const questionHeadings = (pageAnalysis.h2s || []).filter((h: string) => h.includes('?')).length
  if (questionHeadings >= 3) formatScore += 0.3
  else if (questionHeadings >= 1) formatScore += 0.15
  // Lists/tables present
  if (pageAnalysis.has_lists || pageAnalysis.has_tables) formatScore += 0.2
  // Short factual paragraphs (proxy: word count / heading count ratio)
  const avgWordsPerSection = pageAnalysis.word_count / Math.max(pageAnalysis.h2_count + pageAnalysis.h3_count, 1)
  if (avgWordsPerSection >= 100 && avgWordsPerSection <= 300) formatScore += 0.2
  else if (avgWordsPerSection < 500) formatScore += 0.1
  const formatFinal = Math.min(formatScore, 1) * 30

  // DIRECT ANSWER (25%) — Does the first paragraph directly answer the query?
  let directAnswerScore = 0
  const kwTerms = (kw.keyword || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  if (pageAnalysis.keyword_in_first_100) directAnswerScore += 0.4
  if (pageAnalysis.keyword_in_h1) directAnswerScore += 0.2
  if (pageAnalysis.keyword_in_title) directAnswerScore += 0.2
  // Complete answer check: first paragraph has reasonable length
  if (pageAnalysis.first_para_words >= 30 && pageAnalysis.first_para_words <= 60) directAnswerScore += 0.2
  else if (pageAnalysis.first_para_words >= 20) directAnswerScore += 0.1
  const directFinal = Math.min(directAnswerScore, 1) * 25

  // SCHEMA MARKUP (20%) — Relevant structured data present?
  let schemaScore = 0
  const schemas = pageAnalysis.schemas || []
  if (schemas.includes('FAQPage')) schemaScore += 0.35
  if (schemas.includes('HowTo')) schemaScore += 0.25
  if (schemas.some((s: string) => ['Article', 'NewsArticle', 'BlogPosting'].includes(s))) schemaScore += 0.2
  if (schemas.length > 0) schemaScore += 0.2 // any schema is better than none
  const schemaFinal = Math.min(schemaScore, 1) * 20

  // AUTHORITY SIGNALS (15%) — E-E-A-T indicators
  let authorityScore = 0
  // Author byline proxy: schema has author or Person
  if (schemas.some((s: string) => ['Person', 'author'].includes(s))) authorityScore += 0.3
  // Domain Authority
  const da = kw.moz_da || 0
  if (da >= 50) authorityScore += 0.4
  else if (da >= 30) authorityScore += 0.25
  else if (da >= 15) authorityScore += 0.1
  // Internal links as citation proxy
  if (pageAnalysis.internal_links >= 10) authorityScore += 0.3
  else if (pageAnalysis.internal_links >= 5) authorityScore += 0.15
  const authorityFinal = Math.min(authorityScore, 1) * 15

  // FRESHNESS (10%) — How recent is the content?
  let freshnessScore = 0.1 // default: assume old
  if (kw.last_modified_days != null) {
    if (kw.last_modified_days <= 90) freshnessScore = 1.0
    else if (kw.last_modified_days <= 180) freshnessScore = 0.7
    else if (kw.last_modified_days <= 365) freshnessScore = 0.4
    else freshnessScore = 0.1
  } else {
    freshnessScore = 0.5 // unknown — assume moderate
  }
  const freshnessFinal = freshnessScore * 10

  return Math.round(formatFinal + directFinal + schemaFinal + authorityFinal + freshnessFinal)
}

// ── Scoring: Opportunity Score ──────────────────────────────────────────────
function computeOpportunityScore(kw: any): number {
  const intentMap: Record<string, number> = { transactional: 1.3, commercial: 1.1, visit_in_place: 1.25, answer_seeking: 0.9, informational: 0.8, navigational: 0.6 }
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
      const scSiteUrl = scConn?.account_id || scConn?.site_url || (website.startsWith('http') ? website : `https://${website}`)
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

    let syncLog: any = null
    try {
      const { data } = await s.from('kotoiq_sync_log').insert({
        client_id, source: 'quick_scan', status: 'running',
      }).select().single()
      syncLog = data
    } catch { /* table may not exist */ }

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
          try {
            await s.from('kotoiq_recommendations').delete().eq('client_id', client_id).eq('status', 'pending')
            await s.from('kotoiq_recommendations').insert(aiRecs.map((r: any) => ({ client_id, agency_id, type: r.type, priority: r.priority, title: r.title, detail: r.detail, estimated_impact: r.estimated_impact, effort: r.effort })))
          } catch { /* table may not exist */ }
        }
      } catch { /* skip recs */ }

      if (syncLog?.id) {
        try { await s.from('kotoiq_sync_log').update({
          status: 'complete', records_synced: ukfRecords.length, completed_at: new Date().toISOString(),
          metadata: { scan_type: 'quick_scan', client_da: clientDA, competitors: competitors.length, sitemap_pages: sitemapUrls.length },
        }).eq('id', syncLog.id) } catch { /* non-fatal */ }
      }

      return NextResponse.json({
        success: true, total_keywords: ukfRecords.length, client_da: clientDA,
        competitors: competitors.length, sitemap_pages: sitemapUrls.length,
        recommendations: aiRecs,
      })
    } catch (e: any) {
      if (syncLog?.id) { try { await s.from('kotoiq_sync_log').update({ status: 'failed', error_message: e.message, completed_at: new Date().toISOString() }).eq('id', syncLog.id) } catch {} }
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

  // ── VALIDATE CONNECTIONS — live probe each provider's API ───────────
  if (action === 'validate_connections') {
    const { client_id, provider } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { validateConnections } = await import('@/lib/kotoiq/validateConnections')
    const results = await validateConnections(s, client_id, provider)
    return NextResponse.json({ results })
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
    try {
      const result = await generateBrief(s, ai, { client_id, agency_id, keyword, target_url, page_type })
      return NextResponse.json(result)
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

    return NextResponse.json({
      gbp: gbpData,
      moz: mozData,
      location,
      review_count_note: 'Review count from Google Places API — may differ from your GBP dashboard. Connect Google Business Profile for exact data.',
    })
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

    const today = new Date()
    const prompt = `Generate ${num_posts || 4} Google Business Profile posts for "${business_name || 'a local business'}" (${industry || 'local services'}).

Services: ${services || 'general services'}
Current date: ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Season: ${['Winter','Winter','Spring','Spring','Spring','Summer','Summer','Summer','Fall','Fall','Fall','Winter'][today.getMonth()]}

Generate 4 different posts scheduled 5-7 days apart:
1. An OFFER post (drives conversions — these get highest visibility in search)
2. A TIPS/educational post (builds authority + AEO signals)
3. An UPDATE ("What's New") post — company news, new service, or blog summary
4. An EVENT or seasonal post (community engagement, time-sensitive)

═══ CRITICAL GBP POST RULES (2026 Best Practices) ═══

THE FIRST 80 RULE: Only the first 80-150 characters show on mobile before "Read More."
Put the core value proposition or primary keyword in the FIRST sentence. No preamble.

BAD: "We are excited to announce that our team at ABC Plumbing is now offering..."
GOOD: "24/7 emergency drain cleaning in Fort Lauderdale — $50 off this week only."

- Total length: 200-400 characters (short performs better than long)
- NEVER put phone numbers or website URLs in the post text (causes soft-rejections)
- Use 1-2 emojis maximum per post — at the start or end, not mid-sentence
- Include the city/neighborhood name naturally for local ranking signal
- Each post must include a CTA button type (Book, Learn More, Call, Order, Sign Up)
- Include a suggested landing page URL with UTM tracking: ?utm_source=google&utm_medium=organic&utm_campaign=gbp_post
- Include a suggested image search query so we can match a relevant photo
- Make posts SPECIFIC to the business — never generic
- Reference the season, weather, or current events when relevant
- For offers: include specific discount amount, expiry creates urgency
- For tips: lead with the actionable tip, not "Here are some tips..."
- For updates: lead with what changed, not "We're excited to share..."

Return ONLY valid JSON array:
[{"type": "offer|tips|update|event", "text": "post text — first 80 chars are critical", "cta": "Book Now|Learn More|Call Now|Order Online|Sign Up", "url": "/suggested-landing-page?utm_source=google&utm_medium=organic&utm_campaign=gbp_post", "image_query": "search query for finding a relevant stock photo", "scheduled_date": "YYYY-MM-DD"}]`

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
      serpUrls = serpResult.items.slice(0, 15).map(item => ({
        url: item.url, domain: item.domain, title: item.title, rank: item.rank_group,
      }))
    } catch {
      // Fallback to intel report competitors if DataForSEO fails
      const { data: latestReport } = await s.from('koto_intel_reports').select('report_data')
        .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
      const competitors = latestReport?.report_data?.competitors || []
      serpUrls = competitors.slice(0, 10).map((c: any, i: number) => ({
        url: c.website || `https://${c.domain}`, domain: c.domain || '', title: c.name || '', rank: i + 1,
      }))
    }

    // Analyze client's own page first (if ranking)
    if (kwData?.sc_top_page) {
      try {
        const analysis = await analyzePageForKeyword(kwData.sc_top_page, keyword)
        if (analysis) analyses.push({ ...analysis, is_client: true, name: client?.name || clientDomain, rank: 0 })
      } catch { /* skip */ }
    } else if (clientDomain) {
      const clientSerp = serpUrls.find(u => u.domain.includes(clientDomain.replace('www.', '')))
      if (clientSerp) {
        try {
          const analysis = await analyzePageForKeyword(clientSerp.url, keyword)
          if (analysis) analyses.push({ ...analysis, is_client: true, name: client?.name || clientDomain, rank: clientSerp.rank })
        } catch { /* skip */ }
        serpUrls = serpUrls.filter(u => u !== clientSerp)
      }
    }

    // Analyze top 10 SERP results in parallel (fast)
    const compResults = await Promise.allSettled(
      serpUrls.slice(0, 10).filter(c => c.url).map(async comp => {
        const analysis = await analyzePageForKeyword(comp.url, keyword)
        return analysis ? { ...analysis, is_client: false, name: comp.title || comp.domain, rank: comp.rank, domain: comp.domain } : null
      })
    )
    for (const r of compResults) {
      if (r.status === 'fulfilled' && r.value) analyses.push(r.value)
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

  // ── WRITE FULL PAGE: Generate complete content from brief ────────────
  if (action === 'write_full_page') {
    const { brief_id, client_id, agency_id } = body
    if (!brief_id) return NextResponse.json({ error: 'brief_id required' }, { status: 400 })

    const { data: brief } = await s.from('kotoiq_content_briefs').select('*').eq('id', brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })

    const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer, industry').eq('id', brief.client_id).single()

    // ── Pre-generation: Run ALL applicable semantic agents in parallel ──
    let queryGap: any = null
    let frameAnalysis: any = null
    let safeAnswer: any = null
    let entitySuggestions: any = null
    let lexicalRelations: any = null
    let titleAudit: any = null
    try {
      // Wave 1: Core analysis agents (parallel)
      const [qgResult, faResult, entityResult, lexResult] = await Promise.all([
        runQueryGapAnalyzer(ai, { keyword: brief.target_keyword, industry: client?.primary_service || '', business_name: client?.name || '' }).catch(() => null),
        runFrameAnalyzer(ai, { keyword: brief.target_keyword }).catch(() => null),
        runNamedEntitySuggester(ai, { keyword: brief.target_keyword, industry: client?.primary_service || '', business_name: client?.name || '', location: client?.industry || '' }).catch(() => null),
        runLexicalRelationAnalyzer(ai, { keyword: brief.target_keyword, industry: client?.primary_service || '' }).catch(() => null),
      ])
      queryGap = qgResult
      frameAnalysis = faResult
      entitySuggestions = entityResult
      lexicalRelations = lexResult

      // Wave 2: Depends on wave 1 results (parallel)
      const [saResult, taResult] = await Promise.all([
        runSafeAnswerGenerator(ai, { keyword: brief.target_keyword, business_name: client?.name || '', industry: client?.primary_service || '', location: client?.industry || '' }).catch(() => null),
        runTitleQueryAuditor(ai, { title: brief.title_tag || '', target_keyword: brief.target_keyword }).catch(() => null),
      ])
      safeAnswer = saResult
      titleAudit = taResult
    } catch (e) {
      console.error('[semantic-agents] Pre-generation agents failed, continuing without:', e)
    }

    // Build semantic context sections for the prompt
    const semanticContext = [
      queryGap ? `\nQUERY GAP INTELLIGENCE:\nThe following content signifiers MUST be addressed — they represent gaps in current search results:\n${JSON.stringify(queryGap.context_signifiers || queryGap.competitor_gaps || queryGap, null, 2)}` : '',
      frameAnalysis ? `\nFRAME SEMANTICS — REQUIRED COVERAGE:\nSearch engines expect these conceptual frame elements for this topic. Cover each one:\n${JSON.stringify(frameAnalysis.frame_elements || frameAnalysis, null, 2)}` : '',
      entitySuggestions ? `\nREQUIRED NAMED ENTITIES:\nInclude these entities naturally throughout the content to signal topical authority:\n${JSON.stringify((entitySuggestions.entities || []).filter((e: any) => e.priority === 'must_include').map((e: any) => `${e.name} (${e.type})`), null, 2)}` : '',
      lexicalRelations ? `\nLEXICAL COVERAGE — REQUIRED TERMS:\nHypernyms (broader terms): ${(lexicalRelations.hypernyms || []).join(', ')}\nHyponyms (specific types): ${(lexicalRelations.hyponyms || []).join(', ')}\nMeronyms (parts/components): ${(lexicalRelations.meronyms || []).join(', ')}\nInclude these related terms for complete entity coverage.` : '',
      safeAnswer ? `\nREQUIRED OPENING PARAGRAPH (optimized for featured snippets and AI Overviews):\n${safeAnswer.featured_snippet_answer || safeAnswer.answer || safeAnswer}` : '',
      titleAudit && titleAudit.improved_titles?.length ? `\nTITLE TAG OPTIONS (choose the best or use the original):\n${titleAudit.improved_titles.map((t: any) => `- ${t.title} (${t.method})`).join('\n')}` : '',
    ].filter(Boolean).join('\n')

    const writePrompt = `You are an expert SEO content writer. Write the COMPLETE page content based on this brief.

BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || ''}
SERVICE: ${client?.primary_service || ''}
TARGET CUSTOMER: ${client?.target_customer || ''}
${semanticContext}

BRIEF:
Title Tag: ${brief.title_tag}
Meta Description: ${brief.meta_description}
H1: ${brief.h1}
Target Word Count: ${brief.target_word_count}
Target Keyword: ${brief.target_keyword}

OUTLINE:
${JSON.stringify(brief.outline, null, 2)}

FAQ QUESTIONS:
${JSON.stringify(brief.faq_questions, null, 2)}

TARGET ENTITIES TO MENTION: ${JSON.stringify(brief.target_entities)}

RULES:
1. Write ${brief.target_word_count || 1200}+ words of high-quality content
2. Follow the outline EXACTLY — use the H2s and H3s as given
3. ${safeAnswer ? 'Use the REQUIRED OPENING PARAGRAPH provided above as the first paragraph' : 'Opening paragraph must be 40-60 words and directly answer the search intent (featured snippet target)'}
4. Mention every target entity naturally throughout the content
5. Include the FAQ section with full answers (40-60 words each)
6. Write for HUMANS first — no keyword stuffing, natural language
7. Include specific details: mention the city/area, the business name, concrete numbers
8. End with a strong CTA paragraph
9. Use short paragraphs (2-3 sentences max) for readability
10. Include natural internal link anchor text suggestions in [brackets]
${queryGap ? '11. Address every query gap signifier identified in the QUERY GAP INTELLIGENCE section' : ''}
${frameAnalysis ? '12. Ensure all frame semantic elements from the REQUIRED COVERAGE section are represented' : ''}

Return the content in this format:
---TITLE---
[title tag]
---META---
[meta description]
---H1---
[h1]
---CONTENT---
[full page content in clean HTML with h2, h3, p, ul, ol tags]
---FAQ_HTML---
[FAQ section in HTML with proper FAQ markup]
---PLAIN_TEXT---
[same content as plain text, no HTML]`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 8000,
        system: 'You are an expert SEO content writer. Write complete, publishable page content.',
        messages: [{ role: 'user', content: writePrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_full_page_write', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0, agencyId: agency_id })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const sections: Record<string, string> = {}
      const parts = raw.split(/---(\w+)---/)
      for (let i = 1; i < parts.length; i += 2) {
        sections[parts[i].toLowerCase().trim()] = parts[i + 1]?.trim() || ''
      }

      let contentHtml = sections.content || raw
      let plainText = sections.plain_text || raw.replace(/<[^>]+>/g, '')
      let topicalityScore: any = null

      // ── Post-generation: Run ALL semantic post-processors ──────────
      let sentenceFilter: any = null
      let metadiscourseAudit: any = null
      let entityInsertResult: any = null
      let triples: any = null
      try {
        // Step 1: Remove contextless filler words
        const cleaned = await runContextlessWordRemover(ai, { content: plainText, keyword: brief.target_keyword, target_entities: brief.target_entities || [] }).catch(() => null)
        if (cleaned?.cleaned_content) plainText = cleaned.cleaned_content

        // Step 2: Audit metadiscourse markers ("In conclusion", "It's important to note", etc.)
        metadiscourseAudit = await runMetadiscourseAuditor(ai, { content: plainText }).catch(() => null)
        if (metadiscourseAudit?.cleaned_content) plainText = metadiscourseAudit.cleaned_content

        // Step 3: Filter low-value sentences
        sentenceFilter = await runSentenceFilterer(ai, { content: plainText, keyword: brief.target_keyword }).catch(() => null)

        // Step 4: Insert missing named entities (if entity suggestions exist from pre-gen)
        if (entitySuggestions?.entities?.length) {
          const missingEntities = (entitySuggestions.entities || [])
            .filter((e: any) => e.priority === 'must_include' && !plainText.toLowerCase().includes(e.name.toLowerCase()))
            .map((e: any) => ({ name: e.name, type: e.type, context: e.context || '' }))
          if (missingEntities.length > 0) {
            entityInsertResult = await runEntityInserter(ai, { content: plainText, entities_to_insert: missingEntities, keyword: brief.target_keyword }).catch(() => null)
            if (entityInsertResult?.enhanced_content) plainText = entityInsertResult.enhanced_content
          }
        }

        // Step 5: Score final topicality
        topicalityScore = await runTopicalityScorer(ai, {
          content: plainText,
          keyword: brief.target_keyword,
          required_entities: entitySuggestions?.entities?.map((e: any) => e.name),
          frame_elements: frameAnalysis?.frame_elements?.map((f: any) => f.element),
        }).catch(() => null)

        // Step 6: Generate knowledge graph triples (for schema markup suggestions)
        triples = await runTripleGenerator(ai, { content: plainText, keyword: brief.target_keyword, business_name: client?.name }).catch(() => null)
      } catch (e) {
        console.error('[semantic-agents] Post-generation agents failed, returning raw content:', e)
      }

      // Step 7: Convert the generated triples to ready-to-inject JSON-LD @graph.
      // Non-fatal — if this fails we still return the content + raw triples.
      let autoSchemaJsonLd: any = null
      let autoSchemaTypesUsed: string[] = []
      let autoSchemaEntityCount = 0
      let autoSchemaRelationshipCount = 0
      if (triples?.triples?.length) {
        try {
          const pageUrl = client?.website ? `${client.website.replace(/\/$/, '')}/${(brief.target_keyword || '').toLowerCase().replace(/\s+/g, '-')}` : 'https://example.com/'
          const pageType = brief.page_type || 'LocalBusiness'
          const converted = await convertTriplesToSchema(ai, {
            triples: triples.triples,
            business_name: client?.name || '',
            page_url: pageUrl,
            page_type: pageType,
            agencyId: agency_id,
          })
          autoSchemaJsonLd = converted.json_ld
          autoSchemaTypesUsed = converted.schema_types_used
          autoSchemaEntityCount = converted.entity_count
          autoSchemaRelationshipCount = converted.relationship_count
        } catch (e) {
          console.error('[write_full_page] triple-to-schema conversion failed:', e)
        }
      }

      return NextResponse.json({
        title: sections.title || brief.title_tag,
        meta: sections.meta || brief.meta_description,
        h1: sections.h1 || brief.h1,
        content_html: contentHtml,
        faq_html: sections.faq_html || '',
        plain_text: plainText,
        word_count: plainText.split(/\s+/).length,
        brief_id,
        topicality_score: topicalityScore,
        title_audit: titleAudit || null,
        knowledge_graph_triples: triples?.triples?.slice(0, 20) || null,
        schema_suggestions: triples?.schema_suggestions || null,
        auto_generated_json_ld: autoSchemaJsonLd,
        auto_schema_types_used: autoSchemaTypesUsed,
        auto_schema_entity_count: autoSchemaEntityCount,
        auto_schema_relationship_count: autoSchemaRelationshipCount,
        sentence_quality: sentenceFilter ? {
          filler_pct: sentenceFilter.filler_pct,
          informative_pct: sentenceFilter.informative_pct,
          quality_score: sentenceFilter.quality_score,
        } : null,
        metadiscourse_removed: metadiscourseAudit?.total_found || 0,
        entities_inserted: entityInsertResult?.entities_inserted || 0,
        semantic_agents_used: {
          query_gap: !!queryGap,
          frame_analysis: !!frameAnalysis,
          safe_answer: !!safeAnswer,
          named_entities: !!entitySuggestions,
          lexical_relations: !!lexicalRelations,
          title_audit: !!titleAudit,
          contextless_remover: true,
          metadiscourse_audit: !!metadiscourseAudit,
          sentence_filter: !!sentenceFilter,
          entity_inserter: !!entityInsertResult,
          topicality_scorer: !!topicalityScore,
          triple_generator: !!triples,
          triple_to_schema: !!autoSchemaJsonLd,
        },
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── GENERATE SCHEMA: JSON-LD from brief + client data ─────────────────
  if (action === 'generate_schema') {
    const { brief_id, client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer').eq('id', client_id).single()
    const brief = brief_id ? (await s.from('kotoiq_content_briefs').select('*').eq('id', brief_id).single()).data : null

    // Get GBP data from latest intel report
    const { data: latestReport } = await s.from('koto_intel_reports').select('report_data')
      .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
    const gbp = latestReport?.report_data?.gbp_audit

    const schemaPrompt = `Generate production-ready JSON-LD structured data for this business page.

BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || ''}
SERVICE: ${client?.primary_service || ''}
ADDRESS: ${gbp?.address || ''}
PHONE: ${gbp?.phone || ''}
RATING: ${gbp?.rating || ''}
REVIEW COUNT: ${gbp?.review_count || ''}
CATEGORIES: ${gbp?.categories?.join(', ') || ''}
DESCRIPTION: ${gbp?.description || ''}

${brief ? `PAGE BRIEF:
Target Keyword: ${brief.target_keyword}
Page URL: ${brief.target_url}
Schema Types Needed: ${JSON.stringify(brief.schema_types)}
FAQ Questions: ${JSON.stringify(brief.faq_questions)}
` : 'Generate LocalBusiness + BreadcrumbList as minimum.'}

Generate SEPARATE JSON-LD script blocks for each schema type. Include:
1. LocalBusiness (or specific subtype like Plumber, Dentist, etc.) with ALL available data
2. BreadcrumbList for the page navigation
3. FAQPage if FAQ questions are provided
4. Service schema if this is a service page

Return ONLY valid JSON array of schema objects (each one goes in its own <script type="application/ld+json"> tag):
[
  { "@context": "https://schema.org", "@type": "...", ... },
  { "@context": "https://schema.org", "@type": "FAQPage", ... }
]`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 3000,
        system: 'Generate production-ready JSON-LD schema. Return ONLY valid JSON array.',
        messages: [{ role: 'user', content: schemaPrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_schema_gen', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const schemas = JSON.parse(cleaned)

      // Format as ready-to-paste HTML
      const htmlBlocks = (Array.isArray(schemas) ? schemas : [schemas]).map((s: any) =>
        `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`
      )

      return NextResponse.json({ schemas, html: htmlBlocks.join('\n\n'), schema_count: htmlBlocks.length })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── BATCH REVIEW RESPONSES: AI-draft all reviews at once ──────────────
  if (action === 'batch_review_responses') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name').eq('id', client_id).single()
    const { data: latestReport } = await s.from('koto_intel_reports').select('report_data')
      .eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
    const reviews = latestReport?.report_data?.gbp_audit?.recent_reviews || []

    if (!reviews.length) return NextResponse.json({ error: 'No reviews found — run a KotoIntel scan first' }, { status: 400 })

    const batchPrompt = `Write professional Google review responses for ${client?.name || 'a local business'}.

REVIEWS:
${reviews.map((r: any, i: number) => `
Review ${i + 1}:
Rating: ${r.rating}/5
Reviewer: ${r.author || 'Customer'}
Text: "${r.text || 'No text'}"
`).join('\n')}

RULES:
- 5-star: 100-160 words. Warm, specific, mentions service.
- 4-star: 120-160 words. Grateful, ask what could be better.
- 3-star or below: 140-180 words. Empathetic, address issue, offer offline resolution.
- Use reviewer's first name. Reference specific details from their review.
- Include subtle CTA. Never defensive.

Return ONLY valid JSON array:
[{"review_index": 0, "reviewer": "name", "rating": 5, "response": "full response text"}]`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 4000,
        system: 'Write Google review responses. Return ONLY valid JSON array.',
        messages: [{ role: 'user', content: batchPrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_batch_reviews', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const responses = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

      return NextResponse.json({
        responses: responses.map((r: any, i: number) => ({
          ...r,
          original_text: reviews[r.review_index || i]?.text || '',
          original_rating: reviews[r.review_index || i]?.rating || 0,
          original_author: reviews[r.review_index || i]?.author || 'Customer',
        })),
        total: responses.length,
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── ROI PROJECTIONS: Estimated impact from fixing audit issues ────────
  if (action === 'roi_projections') {
    const { client_id, job_value, ltv } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, primary_service, marketing_budget').eq('id', client_id).single()
    const { data: keywords } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).order('opportunity_score', { ascending: false }).limit(50)
    const { data: recs } = await s.from('kotoiq_recommendations').select('*').eq('client_id', client_id).eq('status', 'pending')
    const { data: enrichLog } = await s.from('kotoiq_sync_log').select('metadata')
      .eq('client_id', client_id).eq('source', 'deep_enrich').order('completed_at', { ascending: false }).limit(1).single()
    const enrichment = enrichLog?.metadata

    const customValues = (job_value || ltv) ? `\nCUSTOM REVENUE INPUTS (use these to calculate revenue projections — multiply leads by these values):${job_value ? `\n- Average Job Value: $${job_value}` : ''}${ltv ? `\n- Customer Lifetime Value: $${ltv}` : ''}\n` : ''

    const roiPrompt = `You are KotoIQ ROI analyst. Calculate realistic traffic and revenue projections from fixing the issues found in this client's audit.

CLIENT: ${client?.name} | ${client?.primary_service} | Budget: ${client?.marketing_budget || 'Unknown'}
${customValues}

KEYWORD DATA (top 50):
${JSON.stringify((keywords || []).slice(0, 30).map(k => ({ kw: k.keyword, opp: k.opportunity_score, pos: k.sc_avg_position, clicks: k.sc_clicks, vol: k.kp_monthly_volume, cat: k.category })))}

PENDING RECOMMENDATIONS: ${(recs || []).length}
${JSON.stringify((recs || []).slice(0, 10).map(r => ({ title: r.title, type: r.type, priority: r.priority, impact: r.estimated_impact })))}

AUDIT SCORES:
- Technical: ${enrichment?.technical_audit?.grade || 'N/A'} (${enrichment?.technical_audit?.score || 'N/A'}/100)
- On-Page: ${enrichment?.onpage_audit?.score || 'N/A'}/100
- Citations: ${enrichment?.citations?.score || 'N/A'}%
- AI Visibility: ${enrichment?.ai_visibility?.grade || 'N/A'}
- Market Saturation: ${enrichment?.market_density?.saturation_score || 'N/A'}/100

Return ONLY valid JSON:
{
  "current_state": {
    "estimated_monthly_organic_traffic": number,
    "estimated_monthly_leads": number,
    "estimated_monthly_revenue": number
  },
  "projected_state": {
    "estimated_monthly_organic_traffic": number,
    "estimated_monthly_leads": number,
    "estimated_monthly_revenue": number,
    "timeline_months": number
  },
  "improvements": [
    {
      "action": "specific fix",
      "category": "technical|content|local|paid|authority",
      "traffic_gain_pct": number,
      "estimated_additional_clicks": number,
      "estimated_additional_revenue": number,
      "effort": "1 week|2 weeks|1 month|3 months",
      "confidence": "high|medium|low"
    }
  ],
  "total_opportunity": {
    "additional_monthly_traffic": number,
    "additional_monthly_leads": number,
    "additional_monthly_revenue": number,
    "annual_revenue_impact": number,
    "roi_on_seo_investment": "X:1"
  },
  "executive_summary": "2-3 sentence summary of the ROI case"
}`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 3000,
        system: 'Calculate realistic SEO ROI projections. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: roiPrompt }],
      })
      void logTokenUsage({ feature: 'kotoiq_roi_projections', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0 })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const projections = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      return NextResponse.json({ projections })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── BRAND SERP: Scan branded SERP ──────────────────────────────────────
  if (action === 'scan_brand_serp') {
    try {
      const result = await scanBrandSERP(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_brand_serp') {
    try {
      const data = await getBrandSERP(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'brand_defense_strategy') {
    try {
      const strategy = await getBrandDefenseStrategy(s, ai, body)
      return NextResponse.json({ strategy })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── BACKLINKS: Analyze backlink profile ───────────────────────────────
  if (action === 'analyze_backlinks') {
    try {
      const result = await analyzeBacklinks(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_backlink_profile') {
    try {
      const data = await getBacklinkProfile(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── INTERNAL LINKS: Scan site internal links ───────────────────────────
  if (action === 'scan_internal_links') {
    try {
      const result = await scanInternalLinks(s, ai, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_link_audit') {
    try {
      const result = await getInternalLinkAudit(s, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_link_suggestions') {
    try {
      const result = await getLinkSuggestions(s, ai, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── E-E-A-T AUDIT ──────────────────────────────────────────────────────
  if (action === 'audit_eeat') {
    try {
      const result = await auditEEAT(s, ai, body)
      return NextResponse.json({ audit: result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_eeat_audit') {
    try {
      const audit = await getEEATAudit(s, body)
      return NextResponse.json({ audit })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── SCHEMA & STRUCTURED DATA AUDIT ────────────────────────────────────
  if (action === 'audit_schema') {
    try {
      const result = await auditSchema(s, ai, body)
      return NextResponse.json({ audit: result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_schema_audit') {
    try {
      const audit = await getSchemaAudit(s, body)
      return NextResponse.json({ audit })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'generate_schema_for_url') {
    try {
      const result = await generateSchemaForUrl(s, ai, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPICAL MAP: Generate ──────────────────────────────────────────────
  if (action === 'generate_topical_map') {
    try {
      const result = await generateTopicalMap(s, ai, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPICAL MAP: Get ─────────────────────────────────────────────────
  if (action === 'get_topical_map') {
    try {
      const result = await getTopicalMap(s, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPICAL MAP: Update node ─────────────────────────────────────────
  if (action === 'update_topical_node') {
    try {
      const result = await updateTopicalNode(s, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPICAL MAP: Analyze coverage ────────────────────────────────────
  if (action === 'analyze_topical_coverage') {
    try {
      const result = await analyzeTopicalCoverage(s, ai, body)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── CONTENT REFRESH ENGINE ─────────────────────────────────────────
  if (action === 'build_content_inventory') {
    const result = await buildContentInventory(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_content_inventory') {
    const result = await getContentInventory(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_refresh_plan') {
    const result = await getRefreshPlan(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }

  // ── SEMANTIC CONTENT NETWORK ANALYZER ─────────────────────────────
  if (action === 'analyze_semantic_network') {
    const result = await analyzeSemanticNetwork(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_semantic_analysis') {
    const result = await getSemanticAnalysis(s, body)
    return NextResponse.json(result)
  }

  // ── AEO DEEP ANALYSIS ──────────────────────────────────────────────────
  if (action === 'aeo_deep_analysis' || action === 'aeo_research') {
    const { client_id, agency_id, keyword, target_url } = body
    if (!client_id || !keyword) return NextResponse.json({ error: 'client_id and keyword required' }, { status: 400 })

    const fp = fingerprint(keyword)
    const { data: kwData } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).eq('fingerprint', fp).single()
    const { data: client } = await s.from('clients').select('name, website').eq('id', client_id).single()

    // Step 1: Analyze client's page for this keyword
    const pageUrl = target_url || kwData?.sc_top_page || client?.website
    let pageAnalysis: any = null
    if (pageUrl) {
      try {
        const fullUrl = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`
        pageAnalysis = await analyzePageForKeyword(fullUrl, keyword)
      } catch { /* skip */ }
    }

    // Step 2: Compute AEO score for the client's page
    const aeoScore = pageAnalysis ? computeAEOScore(kwData || { keyword }, pageAnalysis) : 0

    // Step 3: Check SERP for AI Overview via DataForSEO (if available)
    let serpData: any = null
    let hasAIOverview = false
    try {
      const serpResults = await getSERPResults(keyword, 'United States', 'en')
      serpData = serpResults
      // DataForSEO returns AI Overview in featured_snippet or ai_overview field
      if (serpResults?.items) {
        hasAIOverview = serpResults.items.some((item: any) =>
          item.type === 'ai_overview' || item.type === 'featured_snippet' || item.type === 'answer_box'
        )
      }
    } catch { /* DataForSEO not available or quota exceeded */ }

    // Step 4: Use Claude to generate specific AEO recommendations
    const aeoPrompt = `You are KotoIQ AEO (AI Engine Optimization) analyst. Analyze this keyword and page data to provide specific recommendations for winning AI Overviews and Featured Snippets.

KEYWORD: "${keyword}"
BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || 'Unknown'}
INTENT: ${kwData?.intent || classifyIntent(keyword)}

CLIENT PAGE ANALYSIS:
${pageAnalysis ? JSON.stringify(pageAnalysis, null, 2) : 'No page found for this keyword'}

AEO SCORE: ${aeoScore}/100
AI OVERVIEW DETECTED IN SERP: ${hasAIOverview ? 'Yes' : 'Unknown/No'}
CURRENT POSITION: ${kwData?.sc_avg_position ? `#${Math.round(kwData.sc_avg_position)}` : 'Not ranking'}

Provide a detailed analysis. Return ONLY valid JSON:
{
  "current_aeo_status": {
    "score": ${aeoScore},
    "grade": "A/B/C/D/F based on score",
    "has_ai_overview": ${hasAIOverview},
    "current_snippet_type": "paragraph|list|table|none",
    "is_client_cited": false
  },
  "gap_analysis": {
    "format_gaps": ["specific format issues preventing AI citation"],
    "content_gaps": ["missing content that AI Overviews typically include for this query"],
    "schema_gaps": ["missing schema markup that would help"],
    "authority_gaps": ["E-E-A-T signals that are missing or weak"]
  },
  "recommendations": [
    {
      "priority": 1,
      "action": "specific action to take",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "details": "detailed implementation instructions",
      "expected_improvement": "estimated AEO score improvement"
    }
  ],
  "ideal_answer_format": {
    "opening_sentence": "the exact type of opening sentence that would win the AI Overview",
    "structure": "paragraph|list|table|comparison",
    "target_word_count": 40,
    "key_entities_to_include": ["entity1", "entity2"],
    "sample_answer": "a 40-word sample direct answer that could win the AI Overview for this query"
  },
  "estimated_difficulty": {
    "score": 0,
    "factors": ["what makes it easy or hard to win this AI Overview"],
    "timeline": "estimated weeks to see AEO improvement"
  }
}`

    try {
      const blend = await blendThreeAIs({
        systemPrompt: 'You are KotoIQ AEO analyst specializing in AI Overview optimization. Return ONLY valid JSON. No markdown.',
        userPrompt: aeoPrompt,
        synthesisInstruction: 'Merge these AEO analyses into one authoritative assessment — consolidate the most actionable gap_analysis entries, keep the strongest ideal_answer_format, and rank recommendations by real impact. Preserve the exact JSON schema.',
        feature: 'kotoiq_aeo_deep_analysis_blended',
        agencyId: agency_id,
        maxTokens: 4000,
      })

      const raw = blend.synthesized || '{}'
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const analysis = JSON.parse(cleaned)

      return NextResponse.json({
        success: true,
        keyword,
        aeo_score: aeoScore,
        page_analysis: pageAnalysis,
        analysis,
        keyword_data: kwData,
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TECHNICAL SEO DEEP INTELLIGENCE ─────────────────────────────────
  if (action === 'audit_technical_deep') {
    const result = await auditTechnicalDeep(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_technical_deep') {
    const result = await getTechnicalDeep(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }

  // ── QUERY PATH / SESSION ANALYZER ─────────────────────────────────────
  if (action === 'analyze_query_paths') {
    const result = await analyzeQueryPaths(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_query_clusters') {
    const result = await getQueryClusters(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }

  // ── REVIEW INTELLIGENCE ENGINE ──────────────────────────────────────
  if (action === 'analyze_reviews') {
    const result = await analyzeReviews(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_review_intelligence') {
    const result = await getReviewIntelligence(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'create_review_campaign') {
    const result = await createReviewCampaign(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_review_campaigns') {
    const result = await getReviewCampaigns(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }

  // ── CONTENT CALENDAR & PUBLISHING MOMENTUM ENGINE ───────────────────
  if (action === 'build_content_calendar') {
    const result = await buildContentCalendar(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_content_calendar') {
    const result = await getContentCalendar(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'update_calendar_item') {
    const result = await updateCalendarItem(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'calculate_momentum') {
    const result = await calculateMomentum(s, ai, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }
  if (action === 'get_momentum') {
    const result = await getMomentum(s, body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  }

  // ── SEMANTIC AGENTS: Pre-generation intelligence ─────────────────────
  if (action === 'run_semantic_agents') {
    const { client_id, keyword, agency_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    const { data: client } = await s.from('clients')
      .select('name, website, primary_service, industry, target_customer')
      .eq('id', client_id).single()

    const { data: existingKeywords } = await s.from('kotoiq_keywords')
      .select('keyword, category, fingerprint')
      .eq('client_id', client_id).limit(50)

    try {
      const [queryGap, frameAnalysis, entitySuggestions] = await Promise.all([
        runQueryGapAnalyzer(ai, { keyword, industry: client?.primary_service || '', business_name: client?.name || '', existing_keywords: (existingKeywords || []).map((k: any) => k.keyword) }),
        runFrameAnalyzer(ai, { keyword }),
        runNamedEntitySuggester(ai, { keyword, industry: client?.primary_service || '', business_name: client?.name || '', location: client?.industry || '' }),
      ])

      void logTokenUsage({ feature: 'kotoiq_semantic_agents', model: 'claude-sonnet-4-20250514', inputTokens: 0, outputTokens: 0, agencyId: agency_id })

      return NextResponse.json({ query_gap: queryGap, frame_analysis: frameAnalysis, entity_suggestions: entitySuggestions })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── CONTENT POLISH: Post-generation semantic processing ────────────
  if (action === 'run_content_polish') {
    const { content, keyword, client_id, agency_id } = body
    if (!content || !keyword) return NextResponse.json({ error: 'content and keyword required' }, { status: 400 })

    try {
      // Run in sequence: remove contextless words → filter sentences → score topicality
      const cleaned = await runContextlessWordRemover(ai, { content, keyword, target_entities: [] })
      const cleanedContent = cleaned?.cleaned_content || content

      const filtered = await runSentenceFilterer(ai, { content: cleanedContent, keyword })

      const scored = await runTopicalityScorer(ai, { content: (filtered as any)?.cleaned_content || cleanedContent, keyword })

      void logTokenUsage({ feature: 'kotoiq_content_polish', model: 'claude-sonnet-4-20250514', inputTokens: 0, outputTokens: 0, agencyId: agency_id })

      return NextResponse.json({
        cleaned_content: (filtered as any)?.cleaned_content || cleanedContent,
        filter_report: filtered || null,
        topicality_score: scored,
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── SEMANTIC ROLE OPTIMIZATION: Optimize sentence structure ─────────
  if (action === 'run_semantic_role_optimization') {
    const { sentences, keyword, primary_entity, agency_id } = body
    if (!sentences?.length || !keyword) return NextResponse.json({ error: 'sentences and keyword required' }, { status: 400 })

    try {
      const result = await runSemanticRoleLabeler(ai, { sentences, keyword, primary_entity })

      void logTokenUsage({ feature: 'kotoiq_semantic_role', model: 'claude-sonnet-4-20250514', inputTokens: 0, outputTokens: 0, agencyId: agency_id })

      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── SAFE ANSWER GENERATOR: Featured snippet / AI Overview opening ──
  if (action === 'generate_safe_answer') {
    const { keyword, client_id, agency_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    const { data: client } = await s.from('clients')
      .select('name, website, primary_service, target_customer, industry')
      .eq('id', client_id).single()

    try {
      const result = await runSafeAnswerGenerator(ai, {
        keyword,
        business_name: client?.name || '',
        industry: client?.primary_service || '',
        location: client?.industry || '',
      })

      void logTokenUsage({ feature: 'kotoiq_safe_answer', model: 'claude-sonnet-4-20250514', inputTokens: 0, outputTokens: 0, agencyId: agency_id })

      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── LEXICAL RELATION ANALYZER: Taxonomy tree mapping ────────
  if (action === 'analyze_lexical_relations') {
    const { keyword, client_id, agency_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    let industry: string | undefined
    if (client_id) {
      const { data: client } = await s.from('clients')
        .select('primary_service').eq('id', client_id).single()
      industry = client?.primary_service || undefined
    }

    try {
      const result = await runLexicalRelationAnalyzer(ai, { keyword, industry, agencyId: agency_id })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPIC CLUSTERER: Pillar/cluster/support architecture ───
  if (action === 'cluster_topics') {
    const { client_id, agency_id, business_context } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: keywords } = await s.from('kotoiq_keywords')
      .select('keyword, search_volume, sc_avg_position, intent')
      .eq('client_id', client_id).limit(200)

    if (!keywords?.length) return NextResponse.json({ error: 'No keywords found for this client' }, { status: 400 })

    let ctx = business_context
    if (!ctx && client_id) {
      const { data: client } = await s.from('clients')
        .select('name, primary_service, target_customer, industry')
        .eq('id', client_id).single()
      if (client) ctx = `${client.name || ''} — ${client.primary_service || ''} targeting ${client.target_customer || ''} (${client.industry || ''})`
    }

    try {
      const result = await runTopicClusterer(ai, {
        keywords: keywords.map((k: any) => ({
          keyword: k.keyword,
          volume: k.search_volume,
          position: k.sc_avg_position,
          intent: k.intent,
        })),
        business_context: ctx,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TITLE-QUERY AUDITOR: Title tag optimization ────────────
  if (action === 'audit_title') {
    const { title, keyword, page_type, agency_id } = body
    if (!title || !keyword) return NextResponse.json({ error: 'title and keyword required' }, { status: 400 })

    try {
      const result = await runTitleQueryAuditor(ai, { title, target_keyword: keyword, page_type, agencyId: agency_id })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── KEY-FACT SUMMARIZER: Extract semantic facts from content ─
  if (action === 'summarize_key_facts') {
    const { content, url, keyword, purpose, agency_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    let resolvedContent = content
    if (!resolvedContent && url) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const html = await res.text()
          resolvedContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000)
        }
      } catch { /* fetch failed — will error below */ }
    }

    if (!resolvedContent) return NextResponse.json({ error: 'content or valid url required' }, { status: 400 })

    try {
      const result = await runKeyFactSummarizer(ai, {
        content: resolvedContent,
        keyword,
        purpose: purpose || 'self_audit',
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── BRIDGE TOPIC SUGGESTER: Connect topical map nodes ──────
  if (action === 'suggest_bridge_topics') {
    const { topic_a, topic_b, client_id, agency_id, existing_pages } = body
    if (!topic_a || !topic_b) return NextResponse.json({ error: 'topic_a and topic_b required' }, { status: 400 })

    let businessContext: string | undefined
    if (client_id) {
      const { data: client } = await s.from('clients')
        .select('name, primary_service, target_customer, industry')
        .eq('id', client_id).single()
      if (client) businessContext = `${client.name || ''} — ${client.primary_service || ''} targeting ${client.target_customer || ''} (${client.industry || ''})`
    }

    try {
      const result = await runBridgeTopicSuggester(ai, {
        topic_a,
        topic_b,
        business_context: businessContext,
        existing_pages,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── COMMENT GENERATOR: Aspect-based review analysis ───────────
  if (action === 'generate_comment_analysis') {
    const { reviews, business_name, product_or_service, client_id, agency_id } = body
    if (!reviews?.length) return NextResponse.json({ error: 'reviews array required' }, { status: 400 })

    let bizName = business_name
    if (!bizName && client_id) {
      const { data: client } = await s.from('clients')
        .select('name').eq('id', client_id).single()
      bizName = client?.name || 'Unknown'
    }

    try {
      const result = await runCommentGenerator(ai, {
        reviews,
        business_name: bizName || 'Unknown',
        product_or_service,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── SENTIMENT OPTIMIZER: Authentic sentiment flow ────────────
  if (action === 'optimize_sentiment') {
    const { content, target_sentiment, business_context, agency_id } = body
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    try {
      const result = await runSentimentOptimizer(ai, {
        content,
        target_sentiment: target_sentiment || 'authentic',
        business_context,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── ENTITY INSERTER: Insert missing entities into content ───
  if (action === 'insert_entities') {
    const { content, entities, keyword, agency_id } = body
    if (!content || !entities?.length || !keyword) return NextResponse.json({ error: 'content, entities array, and keyword required' }, { status: 400 })

    try {
      const result = await runEntityInserter(ai, {
        content,
        entities_to_insert: entities,
        keyword,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── METADISCOURSE AUDITOR: Filler detection + cleanup ───────
  if (action === 'audit_metadiscourse') {
    const { content, agency_id } = body
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    try {
      const result = await runMetadiscourseAuditor(ai, {
        content,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── N-GRAM EXTRACTOR: Phrase pattern analysis ───────────────
  if (action === 'extract_ngrams') {
    const { content, url, keyword, competitor_contents, agency_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    let analysisContent = content
    if (!analysisContent && url) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const html = await res.text()
          analysisContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }
      } catch { /* ignore fetch errors */ }
    }
    if (!analysisContent) return NextResponse.json({ error: 'content or url required' }, { status: 400 })

    try {
      const result = await runNgramExtractor(ai, {
        content: analysisContent,
        competitor_contents,
        keyword,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TRIPLE GENERATOR: Knowledge graph triples ───────────────
  if (action === 'generate_triples') {
    const { content, keyword, client_id, agency_id } = body
    if (!content || !keyword) return NextResponse.json({ error: 'content and keyword required' }, { status: 400 })

    let businessName: string | undefined
    if (client_id) {
      const { data: client } = await s.from('clients')
        .select('name').eq('id', client_id).single()
      businessName = client?.name || undefined
    }

    try {
      const result = await runTripleGenerator(ai, {
        content,
        keyword,
        business_name: businessName,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── SPAM HIT DETECTOR: Google update impact analysis ────────
  if (action === 'detect_spam_hits') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    try {
      // Pull last 180 days of daily SC data from kotoiq_snapshots
      const since = new Date()
      since.setDate(since.getDate() - 180)
      const sinceStr = since.toISOString().split('T')[0]

      const { data: snapshots } = await s.from('kotoiq_snapshots')
        .select('created_at, sc_clicks, sc_impressions, sc_position')
        .eq('client_id', client_id)
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: true })

      if (!snapshots?.length) return NextResponse.json({ error: 'No snapshot data found for this client' }, { status: 404 })

      // Group by date and compute daily totals
      const dailyMap = new Map<string, { clicks: number; impressions: number; positions: number[]; count: number }>()
      for (const snap of snapshots) {
        const date = (snap.created_at as string).split('T')[0]
        const entry = dailyMap.get(date) || { clicks: 0, impressions: 0, positions: [], count: 0 }
        entry.clicks += snap.sc_clicks || 0
        entry.impressions += snap.sc_impressions || 0
        if (snap.sc_position) { entry.positions.push(snap.sc_position); entry.count++ }
        dailyMap.set(date, entry)
      }

      const trafficData = [...dailyMap.entries()]
        .map(([date, d]) => ({
          date,
          clicks: d.clicks,
          impressions: d.impressions,
          position: d.positions.length ? d.positions.reduce((a, b) => a + b, 0) / d.positions.length : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Get domain from client
      const { data: client } = await s.from('clients')
        .select('website').eq('id', client_id).single()
      const domain = client?.website || 'unknown'

      const result = await runSpamHitDetector(ai, {
        traffic_data: trafficData,
        domain,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── QUALITY UPDATE AUDITOR: HCU compliance audit ────────────
  if (action === 'audit_quality_update') {
    const { url, content, keyword, agency_id } = body
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    try {
      const result = await runQualityUpdateAuditor(ai, {
        url,
        content,
        keyword,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GMB IMAGE GEO-TAGGER
  // ─────────────────────────────────────────────────────────────────────────

  // Helper — pull client location context for geo-tagging
  async function getClientLocationContext(client_id: string) {
    const { data: client } = await s.from('clients').select('name, website, primary_service, address').eq('id', client_id).single()
    const { data: report } = await s.from('koto_intel_reports').select('report_data').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()
    const gbp = report?.report_data?.gbp_audit || {}
    return {
      businessName: client?.name || '',
      primaryService: client?.primary_service || '',
      address: client?.address || gbp.address || '',
      lat: gbp.lat || gbp.latitude,
      lng: gbp.lng || gbp.longitude,
      city: gbp.city,
      state: gbp.state,
    }
  }

  // Geo-tag an uploaded image
  if (action === 'geo_tag_image') {
    const { client_id, image_base64, keywords, caption } = body
    if (!client_id || !image_base64) return NextResponse.json({ error: 'client_id and image_base64 required' }, { status: 400 })
    try {
      const ctx = await getClientLocationContext(client_id)
      if (!ctx.address && !ctx.lat) return NextResponse.json({ error: 'No address or GPS on file for this client. Add client address first.' }, { status: 400 })
      const result = await geoTagImage({
        imageBase64: image_base64,
        businessName: ctx.businessName,
        address: ctx.address,
        lat: ctx.lat,
        lng: ctx.lng,
        city: ctx.city,
        state: ctx.state,
        keywords,
        caption,
      })
      // Upload tagged image to storage
      const upload = await uploadImageToStorage(s, { clientId: client_id, dataUrl: result.taggedImageBase64 })
      // Save record
      const { data: saved } = await s.from('kotoiq_gmb_images').insert({
        client_id,
        source: 'upload',
        caption: caption || null,
        keywords: keywords || [],
        gps_lat: result.metadata.gps.lat,
        gps_lng: result.metadata.gps.lng,
        address: result.metadata.location.address,
        city: result.metadata.location.city,
        state: result.metadata.location.state,
        country: result.metadata.location.country,
        metadata: result.metadata,
        storage_path: upload.path,
        public_url: upload.publicUrl,
      }).select().single()
      return NextResponse.json({ success: true, image: saved, tagged_data_url: result.taggedImageBase64, metadata: result.metadata })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Generate AI image + optional geo-tag + optional upload
  if (action === 'generate_gmb_image') {
    const { client_id, agency_id, prompt, style, auto_tag, auto_upload, gbp_category } = body
    if (!client_id || !prompt) return NextResponse.json({ error: 'client_id and prompt required' }, { status: 400 })
    try {
      const ctx = await getClientLocationContext(client_id)
      // Generate image
      const generated = await generateGMBImage(ai, {
        prompt,
        businessName: ctx.businessName,
        primaryService: ctx.primaryService,
        city: ctx.city,
        style,
        agencyId: agency_id,
      })
      // Generate caption
      const captionData = await generateImageCaption(ai, {
        businessName: ctx.businessName,
        service: ctx.primaryService,
        city: ctx.city,
        keywords: body.keywords,
        imageDescription: generated.enhancedPrompt,
        agencyId: agency_id,
      })

      // NOTE: OpenAI gpt-image-1 returns PNG. EXIF geo-tagging requires JPEG.
      // For now, store the generated PNG as-is. Client-side will need to convert to JPEG
      // before geo-tagging (via Canvas). We return the generated image and caption;
      // the client triggers 'geo_tag_image' after converting.
      const upload = await uploadImageToStorage(s, { clientId: client_id, dataUrl: generated.imageBase64 })

      const { data: saved } = await s.from('kotoiq_gmb_images').insert({
        client_id,
        source: 'generated',
        prompt,
        enhanced_prompt: generated.enhancedPrompt,
        caption: captionData.caption,
        alt_text: captionData.alt_text,
        keywords: captionData.keywords || [],
        storage_path: upload.path,
        public_url: upload.publicUrl,
      }).select().single()

      return NextResponse.json({
        success: true,
        image: saved,
        image_base64: generated.imageBase64,
        enhanced_prompt: generated.enhancedPrompt,
        caption: captionData.caption,
        alt_text: captionData.alt_text,
        keywords: captionData.keywords,
        note: 'Generated as PNG. Convert to JPEG client-side before geo-tagging.',
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Upload a stored image to GBP
  if (action === 'upload_image_to_gbp') {
    const { client_id, image_id, category } = body
    if (!client_id || !image_id) return NextResponse.json({ error: 'client_id and image_id required' }, { status: 400 })
    try {
      const { data: img } = await s.from('kotoiq_gmb_images').select('*').eq('id', image_id).single()
      if (!img?.public_url) return NextResponse.json({ error: 'Image has no public URL' }, { status: 400 })

      // Get GBP connection
      const { data: connections } = await s.from('seo_connections').select('*').eq('client_id', client_id)
      const gbpConn = connections?.find((c: any) => (c.provider === 'gmb' || c.provider === 'google') && c.refresh_token)
      if (!gbpConn) return NextResponse.json({ error: 'No GBP connection found' }, { status: 400 })

      const { getAccessToken } = await import('@/lib/seoService')
      const accessToken = await getAccessToken(gbpConn)
      if (!accessToken) return NextResponse.json({ error: 'Cannot authenticate with GBP' }, { status: 400 })

      const accountId = gbpConn.account_id
      const locationId = gbpConn.location_id || gbpConn.property_id
      if (!accountId || !locationId) return NextResponse.json({ error: 'GBP connection missing account_id or location_id' }, { status: 400 })

      const gbpResult = await uploadImageToGBP({
        accessToken,
        accountId,
        locationId,
        sourceUrl: img.public_url,
        category: (category || 'ADDITIONAL') as any,
        description: img.caption,
      })

      await s.from('kotoiq_gmb_images').update({
        gbp_media_id: gbpResult.name || gbpResult.mediaId,
        gbp_category: category || 'ADDITIONAL',
        gbp_uploaded_at: new Date().toISOString(),
      }).eq('id', image_id)

      return NextResponse.json({ success: true, gbp: gbpResult })
    } catch (e: any) {
      await s.from('kotoiq_gmb_images').update({ gbp_error: e.message }).eq('id', body.image_id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Generate just a caption (for existing images)
  if (action === 'generate_image_caption') {
    const { client_id, agency_id, image_description, keywords } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    try {
      const ctx = await getClientLocationContext(client_id)
      const result = await generateImageCaption(ai, {
        businessName: ctx.businessName,
        service: ctx.primaryService,
        city: ctx.city,
        keywords,
        imageDescription: image_description,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // List all GMB images for a client
  if (action === 'list_gmb_images') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data } = await s.from('kotoiq_gmb_images').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(100)
    return NextResponse.json({ images: data || [] })
  }

  // ── Upwork Checklist: analyze job posting ─────────────────────────────────
  if (action === 'analyze_upwork_job') {
    try {
      const result = await analyzeUpworkJob(ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Upwork Checklist: generate full proposal package ──────────────────────
  if (action === 'generate_proposal_package') {
    try {
      const result = await generateProposalPackage(ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Plagiarism Checker ───────────────────────────────────────────────────
  if (action === 'check_plagiarism') {
    try {
      const result = await checkPlagiarism(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_plagiarism_history') {
    try {
      const data = await getPlagiarismHistory(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── On-Page SEO Analyzer ─────────────────────────────────────────────────
  if (action === 'analyze_on_page') {
    try {
      // Normalize: frontend sends `keyword`, engine expects `target_keyword`
      if (body.keyword && !body.target_keyword) body.target_keyword = body.keyword
      // Normalize bare domains: add https:// if no protocol
      if (body.url && !/^https?:\/\//i.test(body.url)) body.url = `https://${body.url}`
      const result = await analyzeOnPage(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_on_page_history') {
    try {
      const data = await getOnPageHistory(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Rank Grid Pro ────────────────────────────────────────────────────────
  if (action === 'run_rank_grid_pro') {
    try {
      const result = await runRankGridPro(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_grid_scan_history') {
    try {
      const data = await getGridScanHistory(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'compare_grid_scans') {
    try {
      const data = await compareGridScans(s, body)
      return NextResponse.json({ data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── ChatGPT Watermark Remover ────────────────────────────────────────────
  if (action === 'remove_ai_watermarks') {
    try {
      const result = await removeAIWatermarks(ai, { ...body, supabase: s })
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── GSC Audit Engine ──────────────────────────────────────────────────────
  if (action === 'run_gsc_audit') {
    try {
      const result = await runGSCAudit(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_gsc_audit') {
    try {
      const audit = await getGSCAudit(s, body)
      return NextResponse.json({ audit })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Bing Audit Engine ─────────────────────────────────────────────────────
  if (action === 'run_bing_audit') {
    try {
      const result = await runBingAudit(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_bing_audit') {
    try {
      const audit = await getBingAudit(s, body)
      return NextResponse.json({ audit })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Backlink Opportunity Engine ───────────────────────────────────────────
  if (action === 'scan_backlink_opportunities') {
    try {
      const result = await scanAndGenerateBacklinks(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_backlink_opportunities') {
    try {
      const opportunities = await getBacklinkOpportunities(s, body)
      return NextResponse.json({ opportunities })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED SEMANTIC AGENTS
  // ═══════════════════════════════════════════════════════════════

  // ── TOPICAL AUTHORITY AUDITOR ─────────────────────────────────
  if (action === 'audit_topical_authority') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    try {
      // Get latest topical map + nodes
      const { data: mapRow } = await s.from('kotoiq_topical_maps')
        .select('*').eq('client_id', client_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      const { data: nodes } = mapRow
        ? await s.from('kotoiq_topical_nodes').select('*').eq('map_id', mapRow.id)
        : { data: [] }

      // Get keywords
      const { data: keywords } = await s.from('kotoiq_keywords')
        .select('keyword, fingerprint, sc_avg_position, search_volume, sc_clicks, sc_impressions, category')
        .eq('client_id', client_id).limit(200)

      // Build 30d & 90d trajectory from snapshots
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const fingerprints = (keywords || []).map((k: any) => k.fingerprint).filter(Boolean)

      const { data: snapshots30 } = fingerprints.length
        ? await s.from('kotoiq_snapshots').select('keyword_fingerprint, sc_position, created_at')
            .eq('client_id', client_id)
            .in('keyword_fingerprint', fingerprints.slice(0, 200))
            .gte('created_at', thirtyDaysAgo.toISOString().split('T')[0])
            .lte('created_at', new Date(thirtyDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        : { data: [] }

      const { data: snapshots90 } = fingerprints.length
        ? await s.from('kotoiq_snapshots').select('keyword_fingerprint, sc_position, created_at')
            .eq('client_id', client_id)
            .in('keyword_fingerprint', fingerprints.slice(0, 200))
            .gte('created_at', ninetyDaysAgo.toISOString().split('T')[0])
            .lte('created_at', new Date(ninetyDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        : { data: [] }

      const pos30Map = new Map<string, number>()
      for (const snap of (snapshots30 || [])) {
        if (snap.sc_position && !pos30Map.has(snap.keyword_fingerprint)) {
          pos30Map.set(snap.keyword_fingerprint, snap.sc_position)
        }
      }
      const pos90Map = new Map<string, number>()
      for (const snap of (snapshots90 || [])) {
        if (snap.sc_position && !pos90Map.has(snap.keyword_fingerprint)) {
          pos90Map.set(snap.keyword_fingerprint, snap.sc_position)
        }
      }

      // Pull DA from domain enrichment if available
      const { data: client } = await s.from('clients')
        .select('name, website, primary_service, target_customer, industry')
        .eq('id', client_id).single()

      const { data: daRow } = await s.from('kotoiq_domain_enrichment')
        .select('domain_authority').eq('client_id', client_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      const result = await runTopicalAuthorityAuditor(ai, {
        central_entity: mapRow?.central_entity,
        source_context: mapRow?.source_context,
        topical_nodes: ((nodes as any[]) || []).map((n: any) => ({
          entity: n.entity,
          section: n.section,
          status: n.status,
          priority: n.priority,
          macro_context: n.macro_context,
          existing_url: n.existing_url,
          search_volume: n.search_volume,
        })),
        keywords: (keywords || []).map((k: any) => ({
          keyword: k.keyword,
          current_position: k.sc_avg_position,
          position_30d_ago: pos30Map.get(k.fingerprint) ?? null,
          position_90d_ago: pos90Map.get(k.fingerprint) ?? null,
          search_volume: k.search_volume,
          clicks: k.sc_clicks,
          impressions: k.sc_impressions,
          category: k.category,
        })),
        domain_authority: daRow?.domain_authority ?? null,
        business_context: client ? `${client.name || ''} — ${client.primary_service || ''} serving ${client.target_customer || ''} (${client.industry || ''})` : undefined,
        agencyId: agency_id,
      })

      // Optionally save authority_score back to topical_maps
      if (mapRow?.id) {
        try {
          await s.from('kotoiq_topical_maps').update({
            authority_score: result.authority_score,
            authority_grade: result.grade,
            authority_audited_at: new Date().toISOString(),
          }).eq('id', mapRow.id)
        } catch { /* column may not exist yet; non-fatal */ }
      }

      // Normalize field names for the frontend
      return NextResponse.json({
        overall_score: result.authority_score,
        grade: result.grade,
        coverage_score: result.topical_coverage,
        historical_score: result.historical_data_strength,
        depth_score: result.content_depth,
        competitive_score: result.competitive_position,
        clusters: (result.cluster_scores || []).map((c: any) => ({
          name: c.cluster_name,
          score: c.score,
          strengths: c.strengths,
          gaps: c.gaps,
        })),
        overall_verdict: result.overall_verdict,
        recommendations: result.recommendations,
        updated_at: new Date().toISOString(),
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── GET TOPICAL AUTHORITY (read-only — returns last audit) ────
  if (action === 'get_topical_authority') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: mapRow } = await s.from('kotoiq_topical_maps')
      .select('authority_score, authority_grade, authority_audited_at, central_entity, source_context, coverage_pct, node_count')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!mapRow?.authority_score) return NextResponse.json({ data: null })
    return NextResponse.json({ data: mapRow })
  }

  // ── CONTEXT VECTOR ALIGNER ────────────────────────────────────
  if (action === 'align_context_vectors') {
    const { keyword, outline, competitor_h2s, intent, business_context, agency_id } = body
    if (!keyword || !outline) return NextResponse.json({ error: 'keyword and outline required' }, { status: 400 })

    try {
      const result = await runContextVectorAligner(ai, {
        target_keyword: keyword,
        planned_content_outline: outline,
        competitor_h2s: competitor_h2s || [],
        query_intent: intent,
        business_context,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── MULTI-ENGINE AEO SCORER ───────────────────────────────────
  if (action === 'score_multi_engine_aeo') {
    const { content: rawContent, keyword, url, has_schema, has_citations, agency_id, client_id } = body
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

    // Auto-fetch content from client website if none provided
    let content = rawContent || ''
    if (!content && client_id) {
      const { data: client } = await s.from('clients').select('website').eq('id', client_id).single()
      if (client?.website) {
        try {
          const fullUrl = client.website.startsWith('http') ? client.website : `https://${client.website}`
          const r = await fetch(fullUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' }, signal: AbortSignal.timeout(10000) })
          if (r.ok) {
            const html = await r.text()
            content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)
          }
        } catch { /* skip */ }
      }
    }
    if (!content) return NextResponse.json({ error: 'content required — paste content or add a website to your client' }, { status: 400 })

    try {
      const result = await runMultiEngineAEO(ai, {
        content,
        keyword,
        url,
        has_schema,
        has_citations,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── CONTENT DECAY PREDICTOR ───────────────────────────────────
  if (action === 'predict_content_decay') {
    const { client_id, url, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // If no URL provided, return the inventory with existing decay data
    if (!url) {
      try {
        const { data: inv } = await s.from('kotoiq_content_inventory')
          .select('*').eq('client_id', client_id)
          .order('refresh_priority', { ascending: true }).limit(100)
        return NextResponse.json({ urls: inv || [] })
      } catch {
        return NextResponse.json({ urls: [] })
      }
    }

    try {
      // Pull inventory row for this URL
      const { data: inv } = await s.from('kotoiq_content_inventory')
        .select('*').eq('client_id', client_id).eq('url', url).maybeSingle()

      // Find a keyword that targets this URL via topical nodes with existing_url
      const { data: node } = await s.from('kotoiq_topical_nodes')
        .select('entity').eq('client_id', client_id).eq('existing_url', url).maybeSingle()

      const targetKeyword: string | undefined = node?.entity || undefined

      let currentPos = 50
      let pos30: number | null = null
      let pos90: number | null = null
      let pos180: number | null = null
      let currentClicks: number | null = null
      let searchVol: number | null = null

      if (targetKeyword) {
        const fp = targetKeyword.toLowerCase().trim().replace(/\s+/g, ' ')
        const { data: kw } = await s.from('kotoiq_keywords')
          .select('sc_avg_position, sc_clicks, search_volume')
          .eq('client_id', client_id).eq('fingerprint', fp).maybeSingle()
        if (kw) {
          currentPos = kw.sc_avg_position ?? 50
          currentClicks = kw.sc_clicks ?? null
          searchVol = kw.search_volume ?? null
        }

        const now = new Date()
        const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
        const d90 = new Date(now); d90.setDate(d90.getDate() - 90)
        const d180 = new Date(now); d180.setDate(d180.getDate() - 180)

        const { data: snaps } = await s.from('kotoiq_snapshots')
          .select('sc_position, created_at')
          .eq('client_id', client_id).eq('keyword_fingerprint', fp)
          .gte('created_at', d180.toISOString().split('T')[0])
          .order('created_at', { ascending: true })

        if (snaps?.length) {
          const findNear = (target: Date): number | null => {
            let best: any = null
            let bestDiff = Infinity
            for (const snap of snaps) {
              const sd = new Date(snap.created_at as string)
              const diff = Math.abs(sd.getTime() - target.getTime())
              if (diff < bestDiff && snap.sc_position) { best = snap; bestDiff = diff }
            }
            return best?.sc_position ?? null
          }
          pos30 = findNear(d30)
          pos90 = findNear(d90)
          pos180 = findNear(d180)
        }
      }

      const result = await runContentDecayPredictor(ai, {
        url,
        keyword: targetKeyword,
        current_position: currentPos,
        position_30d_ago: pos30,
        position_90d_ago: pos90,
        position_180d_ago: pos180,
        last_updated: inv?.last_modified ?? null,
        word_count: inv?.word_count ?? null,
        current_clicks_monthly: currentClicks,
        search_volume: searchVol,
        agencyId: agency_id,
      })

      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── COMPETITOR TOPICAL MAP EXTRACTOR ──────────────────────────
  if (action === 'extract_competitor_topical_map') {
    const { competitor_url: _cu, url: _u, client_id, agency_id } = body
    const competitor_url = _cu || _u
    if (!competitor_url) return NextResponse.json({ error: 'competitor_url required' }, { status: 400 })

    try {
      const base = competitor_url.replace(/\/+$/, '')
      const candidates = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap-index.xml`]
      let sitemapXml = ''
      let fetched = ''
      for (const cand of candidates) {
        try {
          const r = await fetch(cand, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
            signal: AbortSignal.timeout(10000),
          })
          if (r.ok) { sitemapXml = await r.text(); fetched = cand; break }
        } catch { /* try next */ }
      }

      const extractLocs = (xml: string): string[] =>
        [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map(m => m[1].trim())

      let allUrls: string[] = extractLocs(sitemapXml)

      // If sitemap_index, recurse into child sitemaps
      const childSitemaps = allUrls.filter(u => /sitemap.*\.xml/i.test(u))
      if (childSitemaps.length && allUrls.length === childSitemaps.length) {
        allUrls = []
        for (const child of childSitemaps.slice(0, 5)) {
          try {
            const r = await fetch(child, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
              signal: AbortSignal.timeout(10000),
            })
            if (r.ok) {
              const xml = await r.text()
              allUrls.push(...extractLocs(xml).filter(u => !/sitemap.*\.xml/i.test(u)))
            }
          } catch { /* skip */ }
          if (allUrls.length >= 150) break
        }
      }

      const urls = allUrls.slice(0, 150)
      if (!urls.length) return NextResponse.json({ error: `No URLs found in sitemap for ${competitor_url}. Tried: ${candidates.join(', ')}` }, { status: 404 })

      let clientCentralEntity: string | undefined
      let clientTopics: string[] = []
      if (client_id) {
        const { data: clientMap } = await s.from('kotoiq_topical_maps')
          .select('central_entity').eq('client_id', client_id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        clientCentralEntity = clientMap?.central_entity

        const { data: clientNodes } = await s.from('kotoiq_topical_nodes')
          .select('entity, section').eq('client_id', client_id).limit(100)
        clientTopics = (clientNodes || []).map((n: any) => n.entity)
      }

      const result = await runCompetitorTopicalMapExtractor(ai, {
        competitor_url,
        sitemap_urls: urls,
        client_central_entity: clientCentralEntity,
        client_topics: clientTopics,
        agencyId: agency_id,
      })

      return NextResponse.json({ ...result, sitemap_source: fetched, urls_analyzed: urls.length })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── PASSAGE RANKING OPTIMIZER ─────────────────────────────────
  if (action === 'optimize_passages') {
    const { content, keyword, user_question, agency_id } = body
    if (!content || !keyword) return NextResponse.json({ error: 'content and keyword required' }, { status: 400 })

    try {
      const result = await runPassageRankingOptimizer(ai, {
        content,
        keyword,
        user_question,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── ASK KOTOIQ — conversational chat ──────────────────────────────────────
  if (action === 'ask_kotoiq') {
    try {
      const result = await askKotoIQ(s, ai, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'list_chat_conversations') {
    try {
      const result = await listConversations(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_chat_conversation') {
    try {
      const result = await getConversation(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'delete_chat_conversation') {
    try {
      const result = await deleteConversation(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Chrome extension — minimal client list ────────────────────────────────
  if (action === 'list_clients_for_extension') {
    try {
      const { agency_id } = body
      if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
      const { data, error } = await s.from('clients')
        .select('id, name, website')
        .eq('agency_id', agency_id)
        .is('deleted_at', null)
        .order('name', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ clients: data || [] })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Competitor Watch ──────────────────────────────────────────────────
  if (action === 'setup_competitor_watch') {
    try { return NextResponse.json(await setupCompetitorWatch(s, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'run_competitor_watch_check') {
    try { return NextResponse.json(await runCompetitorWatchCheck(s, ai, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'get_competitor_events') {
    try { return NextResponse.json(await getCompetitorEvents(s, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Slack / Teams Integration ─────────────────────────────────────────
  if (action === 'setup_slack_integration') {
    try { return NextResponse.json(await setupSlackIntegration(s, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'setup_teams_integration') {
    try { return NextResponse.json(await setupTeamsIntegration(s, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'send_daily_digest') {
    try { return NextResponse.json(await sendDailyDigest(s, ai, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Industry Benchmarks ───────────────────────────────────────────────
  if (action === 'calculate_industry_benchmarks') {
    try { return NextResponse.json(await calculateIndustryBenchmarks(s, ai)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'get_benchmark_for_client') {
    try { return NextResponse.json(await getBenchmarkForClient(s, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Scorecard ─────────────────────────────────────────────────────────
  if (action === 'generate_scorecard') {
    try { return NextResponse.json(await generateScorecard(s, ai, body)) }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── STRATEGY ENGINE — unified strategic planner ───────────────────────────
  if (action === 'generate_strategic_plan') {
    try {
      return await generateStrategicPlan(s, ai, body)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_latest_strategic_plan') {
    try {
      return await getLatestStrategicPlan(s, body)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TRIPLE → SCHEMA AUTO-INJECTION ────────────────────────────────────────
  if (action === 'auto_inject_schema_from_triples') {
    try {
      return await autoInjectSchemaFromPage(s, ai, body)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'convert_triples_to_schema') {
    try {
      const { triples, business_name, page_url, page_type, agency_id } = body
      if (!Array.isArray(triples)) return NextResponse.json({ error: 'triples array required' }, { status: 400 })
      const result = await convertTriplesToSchema(ai, {
        triples, business_name: business_name || '', page_url: page_url || '',
        page_type: page_type || 'LocalBusiness', agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── KNOWLEDGE GRAPH EXPORT (Wikidata / JSON-LD / RDF Turtle) ──────────────
  if (action === 'export_knowledge_graph') {
    try {
      return await exportKnowledgeGraph(s, ai, body)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATION WORKFLOWS
  // ═══════════════════════════════════════════════════════════════

  // ── AUTONOMOUS CONTENT PIPELINE ──────────────────────────────────────
  if (action === 'run_autonomous_pipeline') {
    try {
      const result = await runAutonomousPipeline(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_pipeline_runs') {
    try {
      const runs = await getPipelineRuns(s, body)
      return NextResponse.json({ runs })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_pipeline_run') {
    try {
      const run = await getPipelineRun(s, body)
      return NextResponse.json({ run })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── VOICE ONBOARDING AUTO-SETUP ──────────────────────────────────────
  if (action === 'trigger_auto_setup') {
    try {
      const result = await triggerAutoSetup(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── HYPERLOCAL CONTENT FROM GRID DEAD ZONES ──────────────────────────
  if (action === 'generate_hyperlocal_from_grid') {
    try {
      const result = await generateHyperlocalFromGrid(s, ai, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SITEMAP CRAWLER — handles massive multi-sitemap sites
  // ─────────────────────────────────────────────────────────────

  // Ingest full sitemap (supports 10,000+ URL multi-sitemap structures)
  if (action === 'crawl_sitemaps') {
    const { client_id, options } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    try {
      const { data: client } = await s.from('clients').select('website').eq('id', client_id).single()
      if (!client?.website) return NextResponse.json({ error: 'Client website not set' }, { status: 400 })
      const result = await crawlSitemaps(s, { client_id, website: client.website, options })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Get crawl status
  if (action === 'get_sitemap_crawl_status') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    try {
      const crawl = await getLatestCrawl(s, client_id)
      return NextResponse.json({ crawl })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Get sitemap URLs with pagination + filtering
  if (action === 'get_sitemap_urls') {
    const { client_id, limit, offset, orderBy, filter } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    try {
      const result = await getSitemapUrls(s, { client_id, limit, offset, orderBy, filter })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Create a chunked processing job (for engines to process 10k+ URLs without timeout)
  if (action === 'create_processing_job') {
    const { client_id, engine, total_urls, batch_size, concurrency, metadata } = body
    if (!client_id || !engine) return NextResponse.json({ error: 'client_id and engine required' }, { status: 400 })
    try {
      const { data, error } = await s.from('kotoiq_processing_jobs').insert({
        client_id,
        engine,
        total_urls: total_urls || 0,
        batch_size: batch_size || 50,
        concurrency: concurrency || 10,
        metadata: metadata || {},
        status: 'queued',
      }).select().single()
      if (error) throw error
      return NextResponse.json({ job: data })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Get processing job status
  if (action === 'get_processing_jobs') {
    const { client_id, engine, status: jobStatus } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    let q = s.from('kotoiq_processing_jobs').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
    if (engine) q = q.eq('engine', engine)
    if (jobStatus) q = q.eq('status', jobStatus)
    const { data } = await q.limit(20)
    return NextResponse.json({ jobs: data || [] })
  }

  // ── UNIFIED KPI: AI Visibility Score ──────────────────────────────────
  if (action === 'calculate_ai_visibility') {
    try {
      const result = await calculateAIVisibility(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'get_ai_visibility_history') {
    try {
      const result = await getAIVisibilityHistory(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── UNIFIED KPI: Quick Win Queue ──────────────────────────────────────
  if (action === 'generate_quick_win_queue') {
    try {
      const result = await generateQuickWinQueue(s, ai, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'update_quick_win_status') {
    try {
      const result = await updateQuickWinStatus(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Client Portal (public, read-only) ──
  if (action === 'get_portal_data') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
    if (!checkPortalRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    try {
      const data = await getPortalData(s, client_id)
      logPortalView(s, client_id, ip, req.headers.get('user-agent') || '')
      return NextResponse.json(data)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Bulk Operations ──
  if (action === 'run_bulk_operation') {
    try {
      const result = await runBulkOperation(s, ai, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
  }

  if (action === 'get_bulk_operation_status') {
    try {
      const result = await getBulkOperationStatus(s, body)
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
  }

  // ── SERP INTENT CLASSIFIER ────────────────────────────────────
  if (action === 'classify_serp_intents') {
    const { keywords, serp_data, agency_id } = body
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords (string[]) required' }, { status: 400 })
    }

    try {
      let serpData: any[] | undefined = Array.isArray(serp_data) ? serp_data : undefined

      // If no SERP data was provided, hydrate up to 20 keywords from DataForSEO
      if (!serpData || serpData.length === 0) {
        const hydrated: any[] = []
        for (const kw of keywords.slice(0, 20)) {
          try {
            const r: any = await getSERPResults(kw)
            if (r) hydrated.push({ keyword: kw, items: r?.items || r?.results || r })
          } catch { /* skip individual SERP fetch failures */ }
        }
        if (hydrated.length) serpData = hydrated
      }

      const result = await runSerpIntentClassifier(ai, {
        keywords,
        serp_data: serpData,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── QUERY / DOCUMENT ALIGNMENT SCORER ─────────────────────────
  if (action === 'score_query_doc_alignment') {
    const { document_content, primary_keyword, query_network, agency_id } = body
    if (!document_content || !primary_keyword) {
      return NextResponse.json({ error: 'document_content and primary_keyword required' }, { status: 400 })
    }

    try {
      const result = await runQueryDocumentAlignmentScorer(ai, {
        document_content,
        primary_keyword,
        query_network,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── TOPICAL BORDERS DETECTOR ──────────────────────────────────
  if (action === 'detect_topical_borders') {
    const { content, target_central_entity, related_entities, agency_id } = body
    if (!content || !target_central_entity) {
      return NextResponse.json({ error: 'content and target_central_entity required' }, { status: 400 })
    }

    try {
      const result = await runTopicalBordersDetector(ai, {
        content,
        target_central_entity,
        related_entities,
        agencyId: agency_id,
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── CORNERSTONE CONTENT IDENTIFIER ────────────────────────────
  if (action === 'identify_cornerstone_content') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    try {
      const { data: invRows } = await s.from('kotoiq_content_inventory')
        .select('url, title, word_count, sc_clicks, sc_impressions, internal_links_in, sc_position')
        .eq('client_id', client_id)
        .order('sc_clicks', { ascending: false, nullsFirst: false })
        .limit(200)

      const pages = (invRows || []).map((r: any) => ({
        url: r.url,
        title: r.title || r.url,
        word_count: r.word_count ?? null,
        sc_clicks: r.sc_clicks ?? null,
        sc_impressions: r.sc_impressions ?? null,
        internal_links_in: r.internal_links_in ?? null,
        position: r.sc_position ?? null,
      }))

      if (!pages.length) {
        return NextResponse.json({ error: 'No content inventory found for this client. Run Content Refresh first to build the inventory.' }, { status: 404 })
      }

      const { data: clusterRows } = await s.from('kotoiq_query_clusters')
        .select('cluster_name')
        .eq('client_id', client_id)
        .limit(40)

      const topical_clusters = (clusterRows || []).map((c: any) => c.cluster_name).filter(Boolean)

      const result = await runCornerstoneContentIdentifier(ai, {
        pages,
        topical_clusters: topical_clusters.length ? topical_clusters : undefined,
        agencyId: agency_id,
      })
      return NextResponse.json({ ...result, pages_analyzed: pages.length, clusters_used: topical_clusters.length })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── LINK PROPOSITION VALUE SCORER ─────────────────────────────
  if (action === 'score_link_proposition_value') {
    const { client_id, agency_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    try {
      const { data: linkRows } = await s.from('kotoiq_internal_links')
        .select('source_url, target_url, anchor_text')
        .eq('client_id', client_id)
        .limit(120)

      const links: { source_url: string; target_url: string; anchor_text: string; source_topic: string | null; target_topic: string | null }[] = (linkRows || []).map((r: any) => ({
        source_url: r.source_url,
        target_url: r.target_url,
        anchor_text: r.anchor_text || '',
        source_topic: null,
        target_topic: null,
      }))

      if (!links.length) {
        return NextResponse.json({ error: 'No internal links found for this client. Run the internal link scan first.' }, { status: 404 })
      }

      // Try to resolve source/target topics from content inventory titles (cheap, no extra calls)
      const urlSet = new Set<string>()
      for (const l of links) { urlSet.add(l.source_url); urlSet.add(l.target_url) }
      const { data: invRows } = await s.from('kotoiq_content_inventory')
        .select('url, title')
        .eq('client_id', client_id)
        .in('url', Array.from(urlSet))
        .limit(500)

      const titleByUrl = new Map<string, string>()
      for (const r of (invRows as any[]) || []) {
        if (r?.url && r?.title) titleByUrl.set(r.url, r.title)
      }
      for (const l of links) {
        l.source_topic = titleByUrl.get(l.source_url) || null
        l.target_topic = titleByUrl.get(l.target_url) || null
      }

      const result = await runLinkPropositionValueScorer(ai, {
        links,
        agencyId: agency_id,
      })
      return NextResponse.json({ ...result, links_analyzed: links.length })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'run_conversational_bot') {
    // When no active client is selected, pass the full agency client list so the bot can
    // match a named client ("audit RDC's homepage") and emit client_id back to the UI.
    if (body.agency_id && !body.client_id) {
      const { data: availClients } = await sb().from('clients')
        .select('id, name, website, primary_service, industry')
        .eq('agency_id', body.agency_id)
        .is('deleted_at', null)
      body.available_clients = availClients || []
    }
    const result = await runConversationalBot(sb(), ai, body)
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status || 500 })
    return NextResponse.json(result)
  }

  if (action === 'get_bot_conversation') {
    const result = await getBotConversation(sb(), body)
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status || 500 })
    return NextResponse.json(result)
  }

  if (action === 'list_bot_conversations') {
    const result = await listBotConversations(sb(), body)
    return NextResponse.json(result)
  }

  // ── CLIENT ACTIVITY LOG ─────────────────────────────────────────────────
  // Whitelist of tables whose rows a revert is permitted to delete.
  // Enforced server-side so a compromised client cannot coerce us into
  // DROPping arbitrary data via the result_ref_table column.
  const REVERTIBLE_TABLES = new Set([
    'kotoiq_content_briefs',
    'kotoiq_topical_maps',
    'kotoiq_content_calendar',
    'kotoiq_schema_outputs',
    'kotoiq_on_page_audits',
    'kotoiq_aeo_scores',
    'kotoiq_competitor_maps',
    'kotoiq_hyperlocal_content',
    'kotoiq_strategic_plans',
  ])

  if (action === 'log_client_activity') {
    const {
      client_id, agency_id, bot_conversation_id, bot_message_id,
      intent, action_api, inputs, result,
      result_ref_table, result_ref_id, status, user_id,
    } = body
    if (!client_id || !agency_id || !intent) {
      return NextResponse.json({ error: 'client_id, agency_id, intent required' }, { status: 400 })
    }
    const { data: c } = await s.from('clients').select('id, agency_id').eq('id', client_id).single()
    if (!c || c.agency_id !== agency_id) {
      return NextResponse.json({ error: 'client not in agency' }, { status: 403 })
    }
    try {
      const { data: row, error } = await s.from('kotoiq_client_activity').insert({
        client_id,
        agency_id,
        bot_conversation_id: bot_conversation_id || null,
        bot_message_id: bot_message_id || null,
        intent,
        action_api: action_api || null,
        inputs: inputs || {},
        result: result || {},
        result_ref_table: result_ref_table || null,
        result_ref_id: result_ref_id || null,
        status: status || 'success',
        created_by: user_id || null,
      }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ activity_id: row?.id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'list_client_activity') {
    const { client_id, agency_id, limit, intent } = body
    if (!client_id || !agency_id) {
      return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
    }
    const { data: c } = await s.from('clients').select('id, agency_id').eq('id', client_id).single()
    if (!c || c.agency_id !== agency_id) {
      return NextResponse.json({ error: 'client not in agency' }, { status: 403 })
    }
    let q = s.from('kotoiq_client_activity')
      .select('*')
      .eq('client_id', client_id)
      .eq('agency_id', agency_id)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200))
    if (intent) q = q.eq('intent', intent)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ activities: data || [] })
  }

  if (action === 'revert_client_activity') {
    const { activity_id, agency_id, user_id } = body
    if (!activity_id || !agency_id) {
      return NextResponse.json({ error: 'activity_id and agency_id required' }, { status: 400 })
    }
    const { data: row } = await s.from('kotoiq_client_activity')
      .select('*').eq('id', activity_id).single()
    if (!row) return NextResponse.json({ error: 'activity not found' }, { status: 404 })
    if (row.agency_id !== agency_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (row.status !== 'success') return NextResponse.json({ error: 'not revertible — already ' + row.status }, { status: 400 })

    if (row.result_ref_table && row.result_ref_id) {
      if (!REVERTIBLE_TABLES.has(row.result_ref_table)) {
        return NextResponse.json({ error: 'Not revertible' }, { status: 400 })
      }
      const { error: delErr } = await s.from(row.result_ref_table).delete().eq('id', row.result_ref_id)
      if (delErr) {
        return NextResponse.json({ error: 'Revert failed: ' + delErr.message }, { status: 500 })
      }
    }

    const { error: upErr } = await s.from('kotoiq_client_activity').update({
      status: 'reverted',
      reverted_at: new Date().toISOString(),
      reverted_by: user_id || null,
    }).eq('id', activity_id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ reverted: true, activity_id })
  }

  // ── CONTENT VARIANT GENERATOR ────────────────────────────────────────
  if (action === 'generate_content_variant') {
    const { client_id, agency_id, module_id, module_label, module_desc, keyword, variant_count } = body
    if (!client_id || !module_id) return NextResponse.json({ error: 'client_id and module_id required' }, { status: 400 })

    const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer, industry').eq('id', client_id).single()
    const count = Math.min(variant_count || 2, 4)

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 3000,
        system: `You are an expert SEO content writer. Generate ${count} distinct content variants for a page section module. Each variant must be unique in angle, tone, or structure while covering the same topic. Write in natural, human language — no AI slop.`,
        messages: [{ role: 'user', content: `Generate ${count} content variants for the "${module_label}" section.

BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || 'Unknown'}
SERVICE: ${client?.primary_service || 'Unknown'}
TARGET: ${client?.target_customer || 'Unknown'}
INDUSTRY: ${client?.industry || 'Unknown'}
${keyword ? `TARGET KEYWORD: ${keyword}` : ''}

MODULE: ${module_label}
PURPOSE: ${module_desc}

Return ONLY valid JSON:
{ "variants": ["variant 1 content (200-400 words, HTML formatting allowed)", "variant 2 content ..."] }` }],
      })
      void logTokenUsage({ feature: 'kotoiq_content_variant', model: 'claude-sonnet-4-20250514', inputTokens: msg.usage?.input_tokens || 0, outputTokens: msg.usage?.output_tokens || 0, agencyId: agency_id })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      return NextResponse.json({ module_id, ...parsed })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── ACTION ALIASES — frontend names that map to existing handlers ─────
  if (action === 'get_keywords') {
    // PipelineOrchestratorTab calls 'get_keywords', backend uses 'keywords'
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: kws } = await s.from('kotoiq_keywords').select('keyword, fingerprint, category, sc_avg_position, search_volume, sc_clicks, sc_impressions, opportunity_score, intent')
      .eq('client_id', client_id).order('opportunity_score', { ascending: false }).limit(200)
    return NextResponse.json({ keywords: kws || [] })
  }

  if (action === 'get_content_decay') {
    // ContentDecayTab calls 'get_content_decay', return content inventory with decay data
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: urls } = await s.from('kotoiq_content_inventory')
      .select('*').eq('client_id', client_id)
      .order('refresh_priority', { ascending: true }).limit(100)
    return NextResponse.json({ urls: urls || [] })
  }

  if (action === 'delete_scan') {
    const { client_id, scan_type } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    if (scan_type === 'quick_scan') {
      await s.from('kotoiq_keywords').delete().eq('client_id', client_id)
      await s.from('kotoiq_snapshots').delete().eq('client_id', client_id)
    }
    return NextResponse.json({ success: true })
  }

  if (action === 'dfs_competitors') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: client } = await s.from('clients').select('website').eq('id', client_id).single()
    if (!client?.website) return NextResponse.json({ error: 'Client has no website' }, { status: 400 })
    const domain = client.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    try {
      const competitors = await getDomainCompetitors(domain)
      return NextResponse.json({ success: true, domain, competitors })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'dfs_compare') {
    const { domain1, domain2 } = body
    if (!domain1 || !domain2) return NextResponse.json({ error: 'domain1 and domain2 required' }, { status: 400 })
    try {
      const intersection = await getDomainIntersection(domain1, domain2)
      return NextResponse.json({ success: true, domain1, domain2, intersection })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'dfs_grid_scan') {
    const { client_id, agency_id, keyword, business_name, lat, lng } = body
    if (!keyword || !lat || !lng) return NextResponse.json({ error: 'keyword, lat, and lng required' }, { status: 400 })
    try {
      const result = await runGMBGridScan(
        keyword, business_name || '', Number(lat), Number(lng), 5
      )
      return NextResponse.json({ success: true, result })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADS INTELLIGENCE ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Ingestion ────────────────────────────────────────────────────────────
  if (action === 'ads_sync_google') {
    try {
      const result = await ingestGoogleAds(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_sync_gsc') {
    try {
      const result = await ingestAdsGSC(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_sync_ga4') {
    try {
      const result = await ingestAdsGA4(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_sync_all') {
    try {
      const results: any = {}
      try { results.google = await ingestGoogleAds(s, body) } catch (e: any) { results.google_error = e.message }
      try { results.meta = await ingestMetaAds(s, body) } catch (e: any) { results.meta_error = e.message }
      try { results.linkedin = await ingestLinkedInAds(s, body) } catch (e: any) { results.linkedin_error = e.message }
      try { results.gsc = await ingestAdsGSC(s, body) } catch (e: any) { results.gsc_error = e.message }
      try { results.ga4 = await ingestAdsGA4(s, body) } catch (e: any) { results.ga4_error = e.message }
      return NextResponse.json({ success: true, ...results })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_upload_csv') {
    try {
      const result = await ingestCSV(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  if (action === 'ads_get_overview') {
    try {
      const { client_id } = body
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startDate = sevenDaysAgo.toISOString().split('T')[0]

      const [facts, campaigns, alerts, recs] = await Promise.all([
        s.from('kotoiq_ads_fact_campaigns').select('cost_micros, clicks, conversions')
          .eq('client_id', client_id).gte('date', startDate),
        s.from('kotoiq_ads_campaigns').select('id, name, status, budget_usd')
          .eq('client_id', client_id),
        s.from('kotoiq_ads_alerts').select('id', { count: 'exact', head: true })
          .eq('client_id', client_id).is('acknowledged_at', null),
        s.from('kotoiq_ads_rec_negatives').select('id', { count: 'exact', head: true })
          .eq('client_id', client_id).eq('status', 'pending'),
      ])

      let cost_7d = 0, clicks_7d = 0, conversions_7d = 0
      for (const r of facts.data || []) {
        cost_7d += Number(r.cost_micros || 0) / 1e6
        clicks_7d += Number(r.clicks || 0)
        conversions_7d += Number(r.conversions || 0)
      }

      // Get per-campaign metrics for table
      const campMetrics = new Map<string, { cost_usd: number; clicks: number; conversions: number }>()
      for (const r of facts.data || []) {
        // We need campaign_id from fact_campaigns — re-fetch with it
      }

      // Simpler: just get campaign list + aggregate facts
      const { data: factsByCampaign } = await s.from('kotoiq_ads_fact_campaigns')
        .select('campaign_id, cost_micros, clicks, conversions')
        .eq('client_id', client_id).gte('date', startDate)

      const campAgg = new Map<string, { cost_usd: number; clicks: number; conversions: number }>()
      for (const r of factsByCampaign || []) {
        const e = campAgg.get(r.campaign_id) || { cost_usd: 0, clicks: 0, conversions: 0 }
        e.cost_usd += Number(r.cost_micros || 0) / 1e6
        e.clicks += Number(r.clicks || 0)
        e.conversions += Number(r.conversions || 0)
        campAgg.set(r.campaign_id, e)
      }

      const campList = (campaigns.data || []).map((c: any) => ({
        ...c,
        ...(campAgg.get(c.id) || { cost_usd: 0, clicks: 0, conversions: 0 }),
      }))

      return NextResponse.json({
        data: {
          cost_7d, clicks_7d, conversions_7d,
          alert_count: alerts.count || 0,
          rec_count: recs.count || 0,
          campaigns: campList,
        }
      })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Search Terms ─────────────────────────────────────────────────────────
  if (action === 'ads_get_search_terms') {
    try {
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data } = await s.from('kotoiq_ads_fact_search_terms')
        .select('search_term, impressions, clicks, cost_micros, conversions, status')
        .eq('client_id', body.client_id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('cost_micros', { ascending: false })
        .limit(500)

      const terms = (data || []).map((r: any) => ({
        search_term: r.search_term,
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        cost_usd: Number(r.cost_micros || 0) / 1e6,
        conversions: Number(r.conversions || 0),
        status: r.status,
      }))
      return NextResponse.json({ data: terms })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Analysis ─────────────────────────────────────────────────────────────
  if (action === 'ads_wasted_spend') {
    try {
      const result = await analyzeWastedSpend(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_get_wasted_spend') {
    try {
      const result = await getWastedSpendResults(s, body)
      return NextResponse.json({ data: result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_anomaly_detect') {
    try {
      const result = await analyzeAnomalies(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_get_anomalies') {
    try {
      const data = await getAnomalies(s, body)
      return NextResponse.json({ data })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_acknowledge_alert') {
    try {
      await s.from('kotoiq_ads_alerts')
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: body.acknowledged_by || null })
        .eq('id', body.alert_id)
      return NextResponse.json({ success: true })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_intent_gaps') {
    try {
      const result = await analyzeIntentGaps(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_get_intent_gaps') {
    try {
      const result = await getIntentGapResults(s, body)
      return NextResponse.json({ data: result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_period_compare') {
    try {
      const result = await comparePeriods(s, body)
      return NextResponse.json({ data: result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_weekly_summary') {
    try {
      const result = await generateWeeklySummary(s, body)
      return NextResponse.json({ data: result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Ad Copy ──────────────────────────────────────────────────────────────
  if (action === 'ads_generate_copy') {
    try {
      const result = await generateAdCopy(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_get_copy') {
    try {
      const data = await getAdCopy(s, body)
      return NextResponse.json({ data })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── Recommendations ──────────────────────────────────────────────────────
  if (action === 'ads_get_recommendations') {
    try {
      const { client_id, rec_type, status } = body
      const table = `kotoiq_ads_rec_${rec_type || 'negatives'}`
      let q = s.from(table).select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(100)
      if (status) q = q.eq('status', status)
      const { data } = await q
      return NextResponse.json({ data: data || [] })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_approve_rec') {
    try {
      const result = await approveRecommendation(s, {
        rec_type: body.rec_type,
        rec_id: body.rec_id,
        action: body.action_type,
        reviewed_by: body.reviewed_by,
      })
      return NextResponse.json(result)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_bulk_approve') {
    try {
      const result = await bulkApproveRecommendations(s, {
        rec_type: body.rec_type,
        rec_ids: body.rec_ids,
        action: body.action_type,
        reviewed_by: body.reviewed_by,
      })
      return NextResponse.json(result)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // META + LINKEDIN ADS SYNC
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'ads_sync_meta') {
    try {
      const result = await ingestMetaAds(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'ads_sync_linkedin') {
    try {
      const result = await ingestLinkedInAds(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUDGET FORECASTING
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'budget_forecast') {
    try {
      const result = await generateForecast(s, body)
      return NextResponse.json(result)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'budget_get_forecast') {
    try {
      const data = await getForecast(s, body)
      return NextResponse.json({ data })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'budget_daily_trend') {
    try {
      const data = await getDailySpendTrend(s, body)
      return NextResponse.json({ data })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR ANALYTICS (HOTJAR + CLARITY)
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'behavior_sync_hotjar') {
    try {
      const result = await ingestHotjar(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'behavior_sync_clarity') {
    try {
      const result = await ingestClarity(s, body)
      return NextResponse.json({ success: true, ...result })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'behavior_sync_all') {
    try {
      const results: any = {}
      try { results.hotjar = await ingestHotjar(s, body) } catch (e: any) { results.hotjar_error = e.message }
      try { results.clarity = await ingestClarity(s, body) } catch (e: any) { results.clarity_error = e.message }
      return NextResponse.json({ success: true, ...results })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'behavior_get_overview') {
    try {
      const { client_id } = body
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startDate = sevenDaysAgo.toISOString().split('T')[0]
      const [sessions, heatmaps] = await Promise.all([
        s.from('kotoiq_behavior_sessions').select('*').eq('client_id', client_id).gte('date', startDate).order('date', { ascending: false }),
        s.from('kotoiq_behavior_heatmaps').select('*').eq('client_id', client_id).order('synced_at', { ascending: false }).limit(50),
      ])
      return NextResponse.json({ data: { sessions: sessions.data || [], heatmaps: heatmaps.data || [] } })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING WIZARD — CONNECTION DETECTION + AUTO-SYNC
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'get_connections') {
    try {
      const { data } = await s.from('seo_connections').select('provider, connected, account_id').eq('client_id', body.client_id).eq('connected', true)
      return NextResponse.json({ data: data || [] })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'detect_relevant_connections') {
    try {
      const recs = detectRelevantConnections(body.profile_text || '', body.existing_providers || [])
      return NextResponse.json({ data: recs })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  if (action === 'auto_trigger_sync') {
    try {
      const result = await autoTriggerSync(s, body)
      return NextResponse.json(result)
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
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
