// ══════════════════════════════════════════════════════════════════════════════
// SCOUT INTELLIGENCE PIPELINE
// 
// Step 1: Google Places → real GMB data (name, address, phone, rating, reviews)
// Step 2: Place Details → hours, reviews text, editorial summary, types
// Step 3: Website analysis → tech stack, SEO signals, schema, CRM tools  
// Step 4: Sitemap analysis → page count, SEO page strategy
// Step 5: Competitor comparison → benchmarks, relative gaps
// Step 6: Claude analysis → deep gaps, opportunities, revenue modeling
// Step 7: Final scoring → weighted opportunity score
// ══════════════════════════════════════════════════════════════════════════════

import { callClaude } from './ai'

// ── Industry revenue benchmarks (average per new client/transaction) ──────────
const INDUSTRY_BENCHMARKS = {
  plumbing:       { avgJobValue: 385,   jobsPerClientYr: 2.1,  localSearchPct: 0.72 },
  hvac:           { avgJobValue: 1200,  jobsPerClientYr: 1.4,  localSearchPct: 0.68 },
  dental:         { avgJobValue: 850,   jobsPerClientYr: 1.8,  localSearchPct: 0.61 },
  roofing:        { avgJobValue: 9500,  jobsPerClientYr: 1.1,  localSearchPct: 0.65 },
  law_firm:       { avgJobValue: 3500,  jobsPerClientYr: 1.0,  localSearchPct: 0.58 },
  landscaping:    { avgJobValue: 475,   jobsPerClientYr: 8.0,  localSearchPct: 0.64 },
  auto_dealer:    { avgJobValue: 28000, jobsPerClientYr: 1.2,  localSearchPct: 0.55 },
  gym_fitness:    { avgJobValue: 780,   jobsPerClientYr: 12.0, localSearchPct: 0.42 },
  electrician:    { avgJobValue: 420,   jobsPerClientYr: 2.4,  localSearchPct: 0.70 },
  contractor:     { avgJobValue: 12000, jobsPerClientYr: 1.3,  localSearchPct: 0.60 },
  restaurant:     { avgJobValue: 38,    jobsPerClientYr: 26.0, localSearchPct: 0.78 },
  medical:        { avgJobValue: 290,   jobsPerClientYr: 4.5,  localSearchPct: 0.53 },
  default:        { avgJobValue: 800,   jobsPerClientYr: 2.5,  localSearchPct: 0.62 },
}

function getIndustryBenchmark(types = [], query = '') {
  const q = query.toLowerCase()
  if (q.includes('plumb'))     return INDUSTRY_BENCHMARKS.plumbing
  if (q.includes('hvac') || q.includes('air') || q.includes('heat')) return INDUSTRY_BENCHMARKS.hvac
  if (q.includes('dent'))      return INDUSTRY_BENCHMARKS.dental
  if (q.includes('roof'))      return INDUSTRY_BENCHMARKS.roofing
  if (q.includes('law') || q.includes('attorney') || q.includes('legal')) return INDUSTRY_BENCHMARKS.law_firm
  if (q.includes('landscap'))  return INDUSTRY_BENCHMARKS.landscaping
  if (q.includes('auto') || q.includes('car dealer')) return INDUSTRY_BENCHMARKS.auto_dealer
  if (q.includes('gym') || q.includes('fitness'))     return INDUSTRY_BENCHMARKS.gym_fitness
  if (q.includes('electric'))  return INDUSTRY_BENCHMARKS.electrician
  if (q.includes('contractor') || q.includes('remodel')) return INDUSTRY_BENCHMARKS.contractor
  if (q.includes('restaurant') || q.includes('cafe') || q.includes('food')) return INDUSTRY_BENCHMARKS.restaurant
  if (q.includes('doctor') || q.includes('medical') || q.includes('clinic')) return INDUSTRY_BENCHMARKS.medical
  // Fall back to primary type
  for (const t of types) {
    const tl = (t || '').toLowerCase()
    if (INDUSTRY_BENCHMARKS[tl]) return INDUSTRY_BENCHMARKS[tl]
  }
  return INDUSTRY_BENCHMARKS.default
}

// ── Revenue at risk calculator ─────────────────────────────────────────────────
export function calcRevenueImpact(lead, benchmark, competitors) {
  const { avgJobValue, jobsPerClientYr, localSearchPct } = benchmark

  // Monthly searches for this category in this area
  // Rough proxy: high-review competitors suggest active market
  const avgCompReviews = competitors.length
    ? competitors.reduce((s,c) => s + (c.review_count||0), 0) / competitors.length
    : 100

  // Visibility gap: what % of local searches are they likely missing?
  const reviewRatio = Math.min(1, (lead.review_count||1) / Math.max(avgCompReviews, 1))
  const ratingGap   = lead.rating > 0 ? Math.max(0, 4.5 - lead.rating) / 4.5 : 0.3
  const missingTech = (!lead.website_analysis?.tech?.analytics ? 0.1 : 0)
                    + (!lead.website_analysis?.seo?.hasGA ? 0.1 : 0)
                    + (!lead.website_analysis?.seo?.hasSchema ? 0.05 : 0)

  // Estimated visibility score 0-1 (higher = more visible currently)
  const currentVisibility = Math.max(0.05,
    (reviewRatio * 0.4) + ((1 - ratingGap) * 0.3) + (lead.has_website ? 0.2 : 0) + (0.1 - missingTech)
  )

  // Optimized visibility after full marketing program
  const optimizedVisibility = Math.min(0.85, currentVisibility * 2.2)

  // Estimate monthly searchers in market (rough — scales with review volume)
  const marketMonthlySearchers = Math.max(200, avgCompReviews * 8)
  const currentMonthlyLeads    = Math.round(marketMonthlySearchers * localSearchPct * currentVisibility * 0.08)
  const optimizedMonthlyLeads  = Math.round(marketMonthlySearchers * localSearchPct * optimizedVisibility * 0.08)
  const newClientsPerMonth      = Math.max(1, optimizedMonthlyLeads - currentMonthlyLeads)

  const revenuePerClientYr = avgJobValue * jobsPerClientYr
  const monthlyRevenueGain = newClientsPerMonth * (revenuePerClientYr / 12)
  const annualRevenueGain  = monthlyRevenueGain * 12

  // Revenue at risk = what they're currently losing vs optimal
  const missedClientsPerMonth = Math.max(0, optimizedMonthlyLeads - currentMonthlyLeads)
  const annualRevenueAtRisk   = missedClientsPerMonth * revenuePerClientYr

  return {
    currentMonthlyLeads,
    optimizedMonthlyLeads,
    newClientsPerMonth,
    revenuePerClientYr: Math.round(revenuePerClientYr),
    monthlyRevenueGain: Math.round(monthlyRevenueGain),
    annualRevenueGain:  Math.round(annualRevenueGain),
    annualRevenueAtRisk: Math.round(annualRevenueAtRisk),
    avgJobValue,
    currentVisibility:   Math.round(currentVisibility * 100),
    optimizedVisibility: Math.round(optimizedVisibility * 100),
    fiveYearValue: Math.round(annualRevenueGain * 4.2), // avg client lifetime
  }
}

// ── Fetch Place Details (reviews + hours + types) ─────────────────────────────
export async function fetchPlaceDetails(placeId, apiKey) {
  if (!placeId || !apiKey) return null
  try {
    const fieldMask = [
      'displayName','rating','userRatingCount','nationalPhoneNumber',
      'websiteUri','formattedAddress','regularOpeningHours','businessStatus',
      'types','primaryType','editorialSummary','reviews',
      'servesBeer','delivery','reservable','currentOpeningHours',
    ].join(',')
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      }
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Analyze website via server-side API route ─────────────────────────────────
export async function analyzeWebsite(websiteUrl) {
  if (!websiteUrl) return null
  try {
    const res = await fetch('/api/scout/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website: websiteUrl }),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Generate competitive gap analysis via Claude ──────────────────────────────
export async function analyzeWithClaude(lead, competitors, websiteData, benchmark, revenue) {
  const techStack  = websiteData?.tech || {}
  const seoData    = websiteData?.seo  || {}
  const sitemap    = websiteData?.sitemap || {}
  const hasCRM     = Object.keys(techStack).some(k => ['crm','call_tracking'].includes(k))
  const hasAnalytics = techStack.analytics?.length > 0
  const hasSEOPlugin = techStack.seo_plugin?.length > 0
  const pageCount  = sitemap.pageCount || 0
  const reviews    = lead.review_count || 0
  const rating     = lead.rating || 0

  // Build competitor comparison string
  const compStr = competitors.slice(0,5).map((c,i) =>
    `${i+1}. ${c.name}: ${c.rating}★ (${c.review_count} reviews)${c.website?' — has website':' — no website'}`
  ).join('\n') || 'No competitor data available'

  const prompt =
    'You are a senior digital marketing strategist analyzing a local business prospect for a marketing agency. ' +
    'Use ONLY the real data provided. Be specific, data-driven, and brutally honest about gaps.\n\n' +
    'BUSINESS: ' + lead.name + '\n' +
    'Address: ' + (lead.address||'unknown') + '\n' +
    'Phone: ' + (lead.phone||'not listed') + '\n' +
    'Website: ' + (lead.website||'none') + '\n' +
    'Google Rating: ' + rating + '/5\n' +
    'Google Reviews: ' + reviews + '\n' +
    'Business hours: ' + (lead.hours||'unknown') + '\n' +
    'Business type: ' + (lead.types||[]).join(', ') + '\n\n' +
    'WEBSITE TECH STACK:\n' +
    'CMS: ' + (techStack.cms?.join(', ')||'unknown') + '\n' +
    'SEO Plugin: ' + (techStack.seo_plugin?.join(', ')||'none detected') + '\n' +
    'CRM/Email: ' + (techStack.crm?.join(', ')||'none detected') + '\n' +
    'Call Tracking: ' + (techStack.call_tracking?.join(', ')||'none detected') + '\n' +
    'Analytics: ' + (techStack.analytics?.join(', ')||'none detected') + '\n' +
    'Chat/Reviews: ' + ([...(techStack.chat||[]),...(techStack.reviews||[])].join(', ')||'none') + '\n' +
    'Booking Software: ' + (techStack.booking?.join(', ')||'none detected') + '\n\n' +
    'SEO SIGNALS:\n' +
    'Page title: "' + (seoData.title||'none') + '"\n' +
    'Meta description: "' + (seoData.metaDesc||'none') + '"\n' +
    'H1 tags: ' + (seoData.h1s?.slice(0,3).join(' | ')||'none') + '\n' +
    'Schema markup: ' + (seoData.schemaTypes?.join(', ')||'none') + '\n' +
    'Has LocalBusiness schema: ' + (seoData.hasLocalBiz?'YES':'NO') + '\n' +
    'Google Analytics: ' + (seoData.hasGA?'YES':'NO') + '\n' +
    'Facebook Pixel: ' + (seoData.hasFBPixel?'YES':'NO') + '\n' +
    'Sitemap found: ' + (sitemap.found?`YES (${pageCount} pages)`:'NO') + '\n' +
    'Sample pages: ' + (sitemap.sampleUrls?.slice(0,5).join(', ')||'n/a') + '\n\n' +
    'TOP LOCAL COMPETITORS:\n' + compStr + '\n\n' +
    'REVENUE CONTEXT:\n' +
    'Avg job value: $' + benchmark.avgJobValue + '\n' +
    'Current est. monthly leads: ' + revenue.currentMonthlyLeads + '\n' +
    'Potential monthly leads: ' + revenue.optimizedMonthlyLeads + '\n' +
    'Annual revenue at risk: $' + revenue.annualRevenueAtRisk.toLocaleString() + '\n\n' +
    'Return ONLY this JSON object (no markdown):\n' +
    '{"opportunityScore":number 0-100,' +
    '"executiveSummary":"3 specific sentences using real data points from above",' +
    '"seoScore":number 0-100,' +
    '"aeoScore":number 0-100,' +
    '"reputationScore":number 0-100,' +
    '"localVisibilityScore":number 0-100,' +
    '"techStackScore":number 0-100 (how sophisticated their current tech is),' +
    '"seoGaps":["specific gap using real data","gap2","gap3","gap4"],' +
    '"aeoGaps":["AI search gap 1","gap2","gap3"],' +
    '"keywordOpportunities":[{"keyword":"specific local keyword","volume":"est monthly searches","difficulty":"Easy/Medium/Hard","opportunity":"why this matters for this specific business"}],' +
    '"competitorInsights":"2 sentences comparing to the real competitors listed",' +
    '"techGaps":["specific missing tool or integration","gap2","gap3"],' +
    '"quickWins":[{"action":"specific action","impact":"High/Medium","timeline":"X weeks","result":"specific measurable outcome"}],' +
    '"proposedSolutions":[{"service":"service name","description":"what it does for this business","outcome":"specific measurable result","price":"$X-Y/mo or $X one-time"}],' +
    '"revenueProjection":{"month3":"specific result","month6":"specific result","month12":"specific result"},' +
    '"closingStatement":"2 compelling sentences specific to this business and location"}'

  const raw = await callClaude(
    'You are a marketing intelligence analyst. Return ONLY a raw JSON object. No markdown, no backticks, no commentary.',
    prompt, 3500
  )

  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s === -1) throw new Error('No JSON in Claude response')
  let parsed
  try { parsed = JSON.parse(clean.slice(s, e+1)) }
  catch(_) { parsed = JSON.parse(clean.slice(s, e+1).replace(/,\s*}/g,'}').replace(/,\s*]/g,']')) }
  return parsed
}

// ── MASTER PIPELINE ───────────────────────────────────────────────────────────
export async function runLeadPipeline(lead, competitors, searchQuery, apiKey, onProgress) {
  const result = { ...lead, pipeline_complete: false }

  try {
    // ── Phase 1: Place Details (if we have a place_id from Google) ────────────
    onProgress?.('Fetching detailed GMB data…', 10)
    if (lead.place_id && apiKey) {
      const details = await fetchPlaceDetails(lead.place_id, apiKey)
      if (details) {
        result.hours     = details.regularOpeningHours?.weekdayDescriptions?.join(', ') || ''
        result.types     = details.types || []
        result.editorial = details.editorialSummary?.text || ''
        result.gmb_reviews = (details.reviews || []).slice(0,3).map((r:any) => ({
          rating: r.rating,
          text:   r.text?.text?.slice(0,200) || '',
          time:   r.relativePublishTimeDescription,
        }))
        // Update rating/reviews from detail call (more authoritative)
        if (details.userRatingCount > (result.review_count||0)) {
          result.review_count = details.userRatingCount
          result.rating       = details.rating
        }
      }
    }

    // ── Phase 2: Website analysis ─────────────────────────────────────────────
    onProgress?.('Analyzing website tech stack & SEO…', 25)
    if (lead.website) {
      const webData = await analyzeWebsite(lead.website)
      if (webData) {
        result.website_analysis = webData
        // Surface key tech findings
        result.cms         = webData.tech?.cms?.[0] || null
        result.seo_plugin  = webData.tech?.seo_plugin?.[0] || null
        result.has_crm     = !!(webData.tech?.crm?.length)
        result.has_call_tracking = !!(webData.tech?.call_tracking?.length)
        result.has_analytics     = !!(webData.seo?.hasGA)
        result.has_pixel         = !!(webData.seo?.hasFBPixel)
        result.has_schema        = !!(webData.seo?.hasSchema)
        result.has_local_schema  = !!(webData.seo?.hasLocalBiz)
        result.sitemap_pages     = webData.sitemap?.pageCount || 0
        result.page_title        = webData.seo?.title || ''
        result.meta_desc         = webData.seo?.metaDesc || ''
        result.h1                = webData.seo?.h1s?.[0] || ''
        result.booking_software  = webData.tech?.booking?.[0] || null
      }
    }

    // ── Phase 3: Industry benchmarks & revenue modeling ───────────────────────
    onProgress?.('Calculating revenue opportunity…', 50)
    const benchmark = getIndustryBenchmark(result.types || [], searchQuery)
    const revenue   = calcRevenueImpact(result, benchmark, competitors)
    result.benchmark = benchmark
    result.revenue   = revenue

    // Update review gaps now we have accurate data
    result.gaps = []
    const rv = result.review_count || 0
    const rt = result.rating || 0
    const avComp = competitors.length
      ? competitors.reduce((s,c) => s+(c.review_count||0),0) / competitors.length : 100
    if (rv < 10)   result.gaps.push('Critically low reviews — only ' + rv + ' vs market avg ' + Math.round(avComp))
    else if (rv < avComp * 0.5) result.gaps.push('Review gap: ' + rv + ' reviews vs competitor avg ' + Math.round(avComp))
    if (rt < 4.0 && rt > 0) result.gaps.push('Below-average rating: ' + rt + '★')
    else if (rt < 4.4 && rt > 0) result.gaps.push('Rating below top competitors: ' + rt + '★')
    if (!lead.website) result.gaps.push('No website — losing leads daily')
    if (!result.has_analytics) result.gaps.push('No analytics — flying blind on traffic')
    if (!result.has_schema)    result.gaps.push('No schema markup — missing rich results')
    if (!result.has_crm)       result.gaps.push('No CRM detected — likely losing leads')
    if (!result.has_call_tracking) result.gaps.push('No call tracking — no ROI visibility')
    if (!result.seo_plugin)    result.gaps.push('No SEO plugin — on-page SEO unoptimized')
    if (result.sitemap_pages < 5) result.gaps.push('Thin sitemap — limited SEO page coverage')
    if (!result.has_pixel)     result.gaps.push('No Facebook Pixel — no retargeting capability')
    if (result.gaps.length === 0) result.gaps.push('Strong digital presence — target for premium services')

    // ── Phase 4: Claude deep analysis ─────────────────────────────────────────
    onProgress?.('Running AI competitive analysis…', 70)
    const aiAnalysis = await analyzeWithClaude(result, competitors, result.website_analysis, benchmark, revenue)
    result.ai_analysis  = aiAnalysis
    result.ai_summary   = aiAnalysis.executiveSummary

    // Recalculate opportunity score from Claude's assessment
    result.score        = aiAnalysis.opportunityScore || result.score || 50
    result.temperature  = result.score >= 75 ? 'hot' : result.score >= 50 ? 'warm' : result.score >= 30 ? 'lukewarm' : 'cold'

    result.pipeline_complete = true
    onProgress?.('Analysis complete', 100)

  } catch(e) {
    console.error('[Pipeline] Error for', lead.name, ':', e.message)
    result.pipeline_error = e.message
  }

  return result
}

export { getIndustryBenchmark }
