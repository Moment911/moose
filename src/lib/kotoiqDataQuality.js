/**
 * Data Quality Helper — what fraction of computeOpportunityScore's inputs are
 * actually sourced from upstream APIs vs filled in by hardcoded defaults.
 *
 * Background: computeOpportunityScore() in src/app/api/kotoiq/route.ts
 * silently substitutes defaults for missing data:
 *   - sc_avg_position falls back to 50
 *   - normCVR falls back to 0.5 when ads_clicks <= 10
 *   - normTrend is hardcoded to 0.5 (placeholder, no historical data yet)
 *   - competitor_avg_da falls back to 40 in computeRankPropensity
 *
 * Result: a keyword with NO real upstream data still gets a score like 45.21
 * that looks meaningful. This helper exposes when a score is mostly the
 * product of those defaults so the UI can surface "insufficient data" with
 * an explicit fix path instead of presenting a fake score as real.
 */

const INPUTS = [
  {
    field: 'kp_monthly_volume',
    have: (kw) => !!(kw?.kp_monthly_volume && Number(kw.kp_monthly_volume) > 0),
    label: 'Monthly search volume',
    source: 'DataForSEO Keyword Planner',
    why: 'Without real volume the score can\'t tell a high-traffic term from a no-traffic one — every keyword looks equally important.',
    fixUrl: '/seo/connect',
    fixLabel: 'Run DataForSEO enrichment',
    fixDetail: 'Open Search Console → KotoIQ Connect → click "Enrich Keywords" to fetch real volumes from DataForSEO.',
  },
  {
    field: 'sc_avg_position',
    have: (kw) => !!(kw?.sc_avg_position && Number(kw.sc_avg_position) > 0),
    label: 'Search Console position',
    source: 'Google Search Console',
    why: 'When position is missing the formula uses 50 as a midpoint fallback — every keyword scores as if it\'s at page 5.',
    fixUrl: '/seo/connect',
    fixLabel: 'Connect Search Console',
    fixDetail: 'Connect this client\'s Search Console property at /seo/connect, then re-run Launch All to pull positions.',
  },
  {
    field: 'ads_clicks',
    have: (kw) => !!(kw?.ads_clicks && Number(kw.ads_clicks) > 10),
    label: 'Google Ads conversion data',
    source: 'Google Ads',
    why: 'With fewer than 10 Ads clicks the formula uses 0.5 as the conversion-rate placeholder — half of every keyword\'s score is this default.',
    fixUrl: '/seo/connect',
    fixLabel: 'Connect Google Ads',
    fixDetail: 'Connect this client\'s Ads account at /seo/connect so the formula can read real CVR and CPC instead of the 0.5 fallback.',
  },
  {
    field: 'competitor_avg_da',
    have: (kw) => !!(kw?.competitor_avg_da && Number(kw.competitor_avg_da) > 0),
    label: 'Competitor domain authority',
    source: 'Moz / DataForSEO domain enrichment',
    why: 'When competitor DA is missing rank propensity assumes competitors all have DA 40 — your gap calculation is meaningless.',
    fixUrl: '/seo/connect',
    fixLabel: 'Run competitor enrichment',
    fixDetail: 'Add MOZ_API_KEY to the agency settings or run "Deep Enrich" from KotoIQ → Connect to fetch competitor authority via DataForSEO.',
  },
]

/**
 * Per-keyword data quality report.
 * @param {object} kw
 * @returns {{ quality: 'high'|'medium'|'low', pctReal: number, missing: Array, hasInsufficientData: boolean }}
 */
export function getKeywordDataQuality(kw) {
  const results = INPUTS.map((i) => ({ ...i, have: i.have(kw) }))
  const realCount = results.filter((r) => r.have).length
  const totalCount = results.length
  const pctReal = Math.round((realCount / totalCount) * 100)
  const missing = results.filter((r) => !r.have)

  let quality = 'high'
  if (pctReal < 50) quality = 'low'        // mostly placeholders → score is fake-looking
  else if (pctReal < 100) quality = 'medium'

  return {
    quality,
    pctReal,
    missing,
    hasInsufficientData: quality === 'low',
  }
}

/**
 * Aggregate quality across a batch — returns the most common missing inputs
 * so a banner can show "X% of your rows have no GSC connection — here's how
 * to fix it for all of them at once."
 */
export function getBatchDataQuality(keywords) {
  if (!keywords || !keywords.length) return null
  const counts = {}
  const meta = {}
  let lowCount = 0
  let mediumCount = 0
  for (const kw of keywords) {
    const q = getKeywordDataQuality(kw)
    if (q.quality === 'low') lowCount++
    else if (q.quality === 'medium') mediumCount++
    for (const m of q.missing) {
      counts[m.field] = (counts[m.field] || 0) + 1
      meta[m.field] = m
    }
  }
  const topMissing = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([field, rowsMissing]) => ({ ...meta[field], rowsMissing }))
  return {
    totalRows: keywords.length,
    lowQualityRows: lowCount,
    mediumQualityRows: mediumCount,
    lowQualityPct: Math.round((lowCount / keywords.length) * 100),
    topMissing,
  }
}
