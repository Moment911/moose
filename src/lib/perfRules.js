// ══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC RULES ENGINE
// Math runs first. Facts are facts. Claude explains after.
//
// Each rule returns a Finding:
// { ruleId, type, priority, confidence, title, finding, evidence, impactVal,
//   relatedEntities, currentState, recommendedChange }
//
// Claude receives ONLY pre-proven findings and writes the human-readable
// description, rationale, est_impact string, and recommended action.
// ══════════════════════════════════════════════════════════════════════════════

// ── Thresholds (tunable) ─────────────────────────────────────────────────────
const T = {
  WASTE_SPEND_MIN:        20,    // $ spend before flagging zero-conv keyword
  WASTE_DAYS:             30,    // lookback window
  WASTE_TERM_SPEND_MIN:   8,     // $ before flagging search term as wasted
  LOW_QS_THRESHOLD:       5,     // quality score ≤ this = flag
  LOST_IS_BUDGET_MIN:     20,    // % impression share lost to budget = flag
  LOST_IS_RANK_MIN:       25,    // % lost to rank = flag
  LOW_ROAS_THRESHOLD:     1.5,   // below this = underperforming
  HIGH_ROAS_THRESHOLD:    5.0,   // above this = scale candidate
  LOW_CTR_SEARCH:         0.02,  // 2% CTR for search = low
  HIGH_CPC_VS_FIRSTPAGE:  1.5,   // paying 50% more than first-page bid
  PAGE_SCORE_MIN:         60,    // pages below this shouldn't get paid traffic
  PAGE_SCORE_GOOD:        75,    // pages above this are strong LP candidates
  CONV_RATE_MIN:          0.01,  // 1% conv rate minimum for paid LP
  BUDGET_EXHAUST_RATIO:   0.95,  // spending 95%+ of budget = likely constrained
  MIN_IMPRESSIONS_FOR_CTR:500,   // need this many impressions before flagging CTR
  ORGANIC_RANK_STRONG:    5,     // GSC position ≤ 5 = strong organic
  HIGH_SPEND_CAMPAIGN:    500,   // $/mo for a campaign to be "high spend"
}

// ── Rule 1: Wasted keyword spend — high cost, zero conversions ────────────────
export function ruleWastedKeywords(keywords) {
  const findings = []
  const wasted = keywords.filter(k =>
    (k.cost || 0) >= T.WASTE_SPEND_MIN &&
    (k.conversions || 0) < 0.5 &&
    k.status !== 'PAUSED' && k.status !== 'REMOVED'
  )
  if (!wasted.length) return findings

  const totalWaste = wasted.reduce((s, k) => s + (k.cost || 0), 0)
  const topWasted  = wasted.sort((a, b) => (b.cost||0) - (a.cost||0)).slice(0, 10)

  findings.push({
    ruleId:    'wasted_keywords',
    type:      'keyword_pause',
    priority:  totalWaste > 200 ? 'high' : 'medium',
    confidence: 0.95,
    title:     `${wasted.length} keywords spending $${Math.round(totalWaste)} with zero conversions`,
    finding:   `${wasted.length} active keywords have spent $${Math.round(totalWaste)} in the last ${T.WASTE_DAYS} days and generated 0 conversions.`,
    evidence:  topWasted.map(k => `"${k.keyword}" — $${(k.cost||0).toFixed(0)} spent, ${k.clicks||0} clicks, 0 conv, QS=${k.quality_score||'?'}`),
    impactVal: Math.round(totalWaste),
    relatedEntities: topWasted.map(k => ({ type:'keyword', id:k.id, name:k.keyword })),
    currentState:     { keywords_count: wasted.length, total_wasted_spend: Math.round(totalWaste) },
    recommendedChange:{ action:'pause_or_review', keywords: topWasted.map(k=>k.keyword) },
  })
  return findings
}

// ── Rule 2: Wasted search terms — should become negative keywords ─────────────
export function ruleWastedSearchTerms(searchTerms) {
  const findings = []
  const wasted = searchTerms.filter(st =>
    (st.cost || 0) >= T.WASTE_TERM_SPEND_MIN &&
    (st.conversions || 0) < 0.5 &&
    !st.is_negative
  )
  if (!wasted.length) return findings

  const totalWaste = wasted.reduce((s, st) => s + (st.cost || 0), 0)
  const top = wasted.sort((a, b) => (b.cost||0) - (a.cost||0)).slice(0, 20)

  findings.push({
    ruleId:    'wasted_search_terms',
    type:      'negative_keyword',
    priority:  totalWaste > 150 ? 'high' : 'medium',
    confidence: 0.93,
    title:     `${wasted.length} irrelevant search terms burning $${Math.round(totalWaste)}`,
    finding:   `${wasted.length} search terms triggered your ads, spent $${Math.round(totalWaste)}, and converted 0 times. These should be added as negative keywords.`,
    evidence:  top.slice(0, 8).map(st => `"${st.search_term}" — $${(st.cost||0).toFixed(0)}, ${st.clicks||0} clicks, 0 conv`),
    impactVal: Math.round(totalWaste * 0.9), // ~90% of waste can be recovered
    relatedEntities: top.map(st => ({ type:'search_term', name:st.search_term })),
    currentState:     { terms_count: wasted.length, total_waste: Math.round(totalWaste) },
    recommendedChange:{ action:'add_negatives', search_terms: top.map(st=>st.search_term) },
  })
  return findings
}

// ── Rule 3: Budget-constrained campaigns losing impression share ──────────────
export function ruleBudgetConstrained(campaigns) {
  const findings = []
  const constrained = campaigns.filter(c =>
    (c.lost_is_budget || 0) >= T.LOST_IS_BUDGET_MIN &&
    (c.roas || 0) >= T.LOW_ROAS_THRESHOLD &&
    c.status === 'ENABLED'
  )
  for (const camp of constrained) {
    const potentialExtraConv = Math.round(
      (camp.conversions || 0) * ((camp.lost_is_budget || 0) / 100)
    )
    findings.push({
      ruleId:    'budget_constrained_' + camp.id,
      type:      'budget',
      priority:  (camp.lost_is_budget || 0) > 40 ? 'high' : 'medium',
      confidence: 0.88,
      title:     `"${camp.name}" losing ${(camp.lost_is_budget||0).toFixed(0)}% impression share to budget`,
      finding:   `Campaign "${camp.name}" has a ${(camp.roas||0).toFixed(2)}x ROAS but is losing ${(camp.lost_is_budget||0).toFixed(0)}% of possible impressions due to budget constraints. It's profitable and underfunded.`,
      evidence:  [
        `Current ROAS: ${(camp.roas||0).toFixed(2)}x`,
        `Lost IS (budget): ${(camp.lost_is_budget||0).toFixed(0)}%`,
        `Current daily budget: $${(camp.budget_amount||0).toFixed(0)}`,
        `Est. missed conversions: ${potentialExtraConv}`,
      ],
      impactVal: Math.round((camp.cost || 0) * (camp.lost_is_budget || 0) / 100 * (camp.roas || 1)),
      relatedEntities: [{ type:'campaign', id:camp.id, name:camp.name }],
      currentState:     { budget: camp.budget_amount, lost_is_budget: camp.lost_is_budget, roas: camp.roas },
      recommendedChange:{ action:'increase_budget', campaign_name: camp.name, lost_is_pct: camp.lost_is_budget },
    })
  }
  return findings
}

// ── Rule 4: Low quality score keywords dragging down ad rank ─────────────────
export function ruleLowQualityScore(keywords) {
  const findings = []
  const lowQS = keywords.filter(k =>
    k.quality_score && k.quality_score <= T.LOW_QS_THRESHOLD &&
    (k.impressions || 0) > 100 &&
    k.status === 'ENABLED'
  )
  if (!lowQS.length) return findings

  // Group by issue pattern
  const avgQS = (lowQS.reduce((s, k) => s + (k.quality_score || 0), 0) / lowQS.length).toFixed(1)
  const highSpendLowQS = lowQS.filter(k => (k.cost||0) > 20)
  const totalExtraCost = highSpendLowQS.reduce((s, k) => {
    // Low QS typically increases CPC 20-40%
    const premiumEst = (k.avg_cpc || 0) * 0.3 * (k.clicks || 0)
    return s + premiumEst
  }, 0)

  findings.push({
    ruleId:    'low_quality_score',
    type:      'bid',
    priority:  highSpendLowQS.length > 0 ? 'high' : 'medium',
    confidence: 0.85,
    title:     `${lowQS.length} keywords with quality score ≤ ${T.LOW_QS_THRESHOLD} (avg: ${avgQS})`,
    finding:   `${lowQS.length} keywords have a quality score of ${T.LOW_QS_THRESHOLD} or below. Low QS forces Google to charge you more per click and show your ads less often. You're likely paying a premium of ~$${Math.round(totalExtraCost)}/period.`,
    evidence:  lowQS.slice(0, 8).map(k => `"${k.keyword}" — QS=${k.quality_score}, $${(k.avg_cpc||0).toFixed(2)} CPC, ${k.impressions||0} impressions`),
    impactVal: Math.round(totalExtraCost),
    relatedEntities: lowQS.map(k => ({ type:'keyword', id:k.id, name:k.keyword })),
    currentState:     { low_qs_count: lowQS.length, avg_qs: parseFloat(avgQS), est_cpc_premium: Math.round(totalExtraCost) },
    recommendedChange:{ action:'improve_ad_relevance_and_landing_pages', keywords: lowQS.slice(0,5).map(k=>k.keyword) },
  })
  return findings
}

// ── Rule 5: Campaigns with low ROAS — underperforming ────────────────────────
export function ruleLowROAS(campaigns) {
  const findings = []
  const poor = campaigns.filter(c =>
    (c.roas || 0) > 0 && (c.roas || 0) < T.LOW_ROAS_THRESHOLD &&
    (c.cost || 0) > T.HIGH_SPEND_CAMPAIGN * 0.3 &&
    c.status === 'ENABLED'
  )
  for (const camp of poor) {
    findings.push({
      ruleId:    'low_roas_' + camp.id,
      type:      'bid',
      priority:  (camp.cost || 0) > T.HIGH_SPEND_CAMPAIGN ? 'high' : 'medium',
      confidence: 0.82,
      title:     `"${camp.name}" ROAS ${(camp.roas||0).toFixed(2)}x — below breakeven`,
      finding:   `Campaign "${camp.name}" generated ${(camp.roas||0).toFixed(2)}x ROAS on $${(camp.cost||0).toFixed(0)} spend. Below ${T.LOW_ROAS_THRESHOLD}x is typically unprofitable for most business models. This campaign is losing money or just breaking even.`,
      evidence:  [
        `ROAS: ${(camp.roas||0).toFixed(2)}x (target: ${T.LOW_ROAS_THRESHOLD}x+)`,
        `Spend: $${(camp.cost||0).toFixed(0)}`,
        `Conversions: ${(camp.conversions||0).toFixed(1)}`,
        `CPA: $${(camp.cpa||0).toFixed(0)}`,
        `Bidding: ${camp.bidding_strategy || 'unknown'}`,
      ],
      impactVal: Math.round((camp.cost || 0) * (T.LOW_ROAS_THRESHOLD - (camp.roas || 0))),
      relatedEntities: [{ type:'campaign', id:camp.id, name:camp.name }],
      currentState:     { roas: camp.roas, spend: camp.cost, cpa: camp.cpa, bidding: camp.bidding_strategy },
      recommendedChange:{ action:'review_bidding_strategy_and_targeting', campaign_name: camp.name },
    })
  }
  return findings
}

// ── Rule 6: High-performing campaigns that should scale ──────────────────────
export function ruleScaleOpportunity(campaigns) {
  const findings = []
  const stars = campaigns.filter(c =>
    (c.roas || 0) >= T.HIGH_ROAS_THRESHOLD &&
    (c.lost_is_rank || 0) < 15 &&  // not losing to rank — just needs more budget
    (c.lost_is_budget || 0) < T.LOST_IS_BUDGET_MIN &&
    c.status === 'ENABLED' &&
    (c.cost || 0) > 100
  )
  for (const camp of stars) {
    findings.push({
      ruleId:    'scale_opportunity_' + camp.id,
      type:      'budget',
      priority:  'medium',
      confidence: 0.80,
      title:     `"${camp.name}" achieving ${(camp.roas||0).toFixed(2)}x ROAS — scale candidate`,
      finding:   `Campaign "${camp.name}" is your strongest performer at ${(camp.roas||0).toFixed(2)}x ROAS with a ${(camp.impression_share||0).toFixed(0)}% impression share. There may be room to scale budget while maintaining efficiency.`,
      evidence:  [
        `ROAS: ${(camp.roas||0).toFixed(2)}x`,
        `Impression share: ${(camp.impression_share||0).toFixed(0)}%`,
        `Lost IS (budget): ${(camp.lost_is_budget||0).toFixed(0)}%`,
        `Lost IS (rank): ${(camp.lost_is_rank||0).toFixed(0)}%`,
      ],
      impactVal: Math.round((camp.cost || 0) * 0.3 * ((camp.roas || 1) - 1)),
      relatedEntities: [{ type:'campaign', id:camp.id, name:camp.name }],
      currentState:     { roas: camp.roas, budget: camp.budget_amount, is: camp.impression_share },
      recommendedChange:{ action:'increase_budget_incrementally', campaign_name: camp.name, suggested_increase_pct: 20 },
    })
  }
  return findings
}

// ── Rule 7: Weak landing pages getting paid traffic ──────────────────────────
export function ruleWeakLandingPages(pages, campaigns) {
  const findings = []
  if (!pages.length) return findings

  const weakPages = pages.filter(p => p.ai_score && p.ai_score < T.PAGE_SCORE_MIN)
  const strongPages = pages.filter(p => p.ai_score && p.ai_score >= T.PAGE_SCORE_GOOD)

  if (weakPages.length > 0 && strongPages.length > 0) {
    findings.push({
      ruleId:    'weak_landing_pages',
      type:      'landing_page',
      priority:  weakPages.length > 2 ? 'high' : 'medium',
      confidence: 0.78,
      title:     `${weakPages.length} weak landing pages (score <${T.PAGE_SCORE_MIN}) vs ${strongPages.length} strong alternatives`,
      finding:   `Your account has ${weakPages.length} pages scoring below ${T.PAGE_SCORE_MIN}/100 that may be receiving paid traffic, and ${strongPages.length} higher-quality pages scoring ${T.PAGE_SCORE_GOOD}+. Sending traffic to stronger landing pages typically improves conversion rate and quality score.`,
      evidence:  [
        ...weakPages.slice(0,3).map(p => `Weak: ${p.url} — score ${p.ai_score}, ${p.has_cta?'has CTA':'no CTA'}`),
        ...strongPages.slice(0,3).map(p => `Strong: ${p.url} — score ${p.ai_score}, ${p.has_cta?'has CTA':'no CTA'}, ${p.word_count||0} words`),
      ],
      impactVal: weakPages.length * 50, // estimated $ impact per improved LP
      relatedEntities: [
        ...weakPages.slice(0,3).map(p => ({ type:'page', id:p.id, url:p.url, score:p.ai_score })),
        ...strongPages.slice(0,3).map(p => ({ type:'page', id:p.id, url:p.url, score:p.ai_score })),
      ],
      currentState:     { weak_pages: weakPages.length, strong_pages: strongPages.length },
      recommendedChange:{ action:'switch_final_urls', from_pages: weakPages.slice(0,3).map(p=>p.url), to_pages: strongPages.slice(0,3).map(p=>p.url) },
    })
  }
  return findings
}

// ── Rule 8: SEO-to-PPC opportunity — strong organic with no paid coverage ─────
export function ruleSEOtoPPC(pages, keywords) {
  const findings = []
  if (!pages.length) return findings

  // Pages with strong organic signals (GSC data overlay) but no matching keyword
  const keywordTexts = new Set(keywords.map(k => k.keyword?.toLowerCase().trim()))

  const opportunities = pages.filter(p => {
    const hasOrganic = p.sessions > 20 && p.conv_rate && p.conv_rate > 0.01
    const primaryKws  = p.primary_keywords || []
    const hasNoPaidCoverage = !primaryKws.some(kw => keywordTexts.has(kw.toLowerCase()))
    return hasOrganic && hasNoPaidCoverage && p.ai_score && p.ai_score >= T.PAGE_SCORE_GOOD
  })

  if (!opportunities.length) return findings

  findings.push({
    ruleId:    'seo_to_ppc_opportunity',
    type:      'keyword_add',
    priority:  'medium',
    confidence: 0.72,
    title:     `${opportunities.length} high-converting organic pages with no paid coverage`,
    finding:   `${opportunities.length} pages are driving organic sessions and conversions but have no corresponding paid keywords. These are proven converting pages — adding paid coverage could amplify results.`,
    evidence:  opportunities.slice(0, 5).map(p =>
      `${p.url} — ${p.sessions} sessions, ${((p.conv_rate||0)*100).toFixed(1)}% conv rate, score ${p.ai_score}, keywords: ${(p.primary_keywords||[]).slice(0,3).join(', ')}`
    ),
    impactVal: opportunities.reduce((s, p) => s + Math.round((p.sessions||0) * (p.conv_rate||0) * 50), 0),
    relatedEntities: opportunities.map(p => ({ type:'page', id:p.id, url:p.url })),
    currentState:     { organic_pages_without_paid: opportunities.length },
    recommendedChange:{ action:'create_paid_campaigns_for_pages', pages: opportunities.slice(0,3).map(p=>p.url) },
  })
  return findings
}

// ── Rule 9: Lost impression share due to rank (low Ad Rank / QS issues) ───────
export function ruleLostISRank(campaigns) {
  const findings = []
  const rankIssues = campaigns.filter(c =>
    (c.lost_is_rank || 0) >= T.LOST_IS_RANK_MIN &&
    (c.cost || 0) > 100 &&
    c.status === 'ENABLED'
  )
  for (const camp of rankIssues) {
    findings.push({
      ruleId:    'lost_is_rank_' + camp.id,
      type:      'bid',
      priority:  (camp.lost_is_rank||0) > 40 ? 'high' : 'medium',
      confidence: 0.83,
      title:     `"${camp.name}" losing ${(camp.lost_is_rank||0).toFixed(0)}% impressions to ad rank`,
      finding:   `Campaign "${camp.name}" is losing ${(camp.lost_is_rank||0).toFixed(0)}% of possible impressions because competitors outrank your ads. This is a quality score or bid issue, not a budget problem.`,
      evidence:  [
        `Lost IS (rank): ${(camp.lost_is_rank||0).toFixed(0)}%`,
        `Current impression share: ${(camp.impression_share||0).toFixed(0)}%`,
        `Bidding: ${camp.bidding_strategy || 'unknown'}`,
        `Avg CPA: $${(camp.cpa||0).toFixed(0)}`,
      ],
      impactVal: Math.round((camp.cost || 0) * (camp.lost_is_rank || 0) / 100),
      relatedEntities: [{ type:'campaign', id:camp.id, name:camp.name }],
      currentState:     { lost_is_rank: camp.lost_is_rank, impression_share: camp.impression_share, bidding: camp.bidding_strategy },
      recommendedChange:{ action:'improve_quality_score_or_adjust_bids', campaign_name: camp.name },
    })
  }
  return findings
}

// ── Rule 10: Anomaly detection on snapshots ───────────────────────────────────
export function ruleAnomalies(snapshots) {
  const findings = []
  if (snapshots.length < 14) return findings

  const sorted  = [...snapshots].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date))
  const recent  = sorted.slice(-7)
  const prev    = sorted.slice(-14, -7)
  const avg     = (arr, key) => arr.reduce((s, d) => s + (d[key] || 0), 0) / (arr.length || 1)

  const checks = [
    { key:'ads_roas',  label:'ROAS',      dir:'down', threshold:25, sev:'high'   },
    { key:'ads_spend', label:'Ad spend',  dir:'up',   threshold:35, sev:'warning' },
    { key:'ads_cpa',   label:'CPA',       dir:'up',   threshold:30, sev:'high'   },
    { key:'gsc_ctr',   label:'Organic CTR',dir:'down',threshold:30, sev:'medium' },
  ]

  for (const check of checks) {
    const recentAvg = avg(recent, check.key)
    const prevAvg   = avg(prev,   check.key)
    if (!prevAvg || prevAvg === 0) continue
    const pctChange = ((recentAvg - prevAvg) / prevAvg) * 100
    const triggered = check.dir === 'down' ? pctChange <= -check.threshold
                                           : pctChange >= check.threshold
    if (triggered) {
      findings.push({
        ruleId:    'anomaly_' + check.key,
        type:      'bid',
        priority:  check.sev === 'high' ? 'high' : 'medium',
        confidence: 0.90,
        title:     `${check.label} ${check.dir === 'down' ? 'dropped' : 'spiked'} ${Math.abs(pctChange).toFixed(0)}% vs prior week`,
        finding:   `${check.label} changed ${pctChange.toFixed(1)}% compared to the previous 7-day period. Current avg: ${recentAvg.toFixed(2)}, Previous avg: ${prevAvg.toFixed(2)}.`,
        evidence:  [
          `Prior 7-day avg: ${prevAvg.toFixed(2)}`,
          `Recent 7-day avg: ${recentAvg.toFixed(2)}`,
          `Change: ${pctChange.toFixed(1)}%`,
        ],
        impactVal: Math.round(Math.abs(recentAvg - prevAvg) * 30),
        relatedEntities: [],
        currentState:     { metric: check.key, recent: recentAvg, prev: prevAvg, pct_change: pctChange },
        recommendedChange:{ action:'investigate_and_address', metric: check.label },
      })
    }
  }
  return findings
}

// ── Master runner — runs all rules, dedupes, sorts by impact ─────────────────
export function runAllRules({ campaigns=[], keywords=[], searchTerms=[], pages=[], snapshots=[] }) {
  const all = [
    ...ruleWastedKeywords(keywords),
    ...ruleWastedSearchTerms(searchTerms),
    ...ruleBudgetConstrained(campaigns),
    ...ruleLowQualityScore(keywords),
    ...ruleLowROAS(campaigns),
    ...ruleScaleOpportunity(campaigns),
    ...ruleWeakLandingPages(pages, campaigns),
    ...ruleSEOtoPPC(pages, keywords),
    ...ruleLostISRank(campaigns),
    ...ruleAnomalies(snapshots),
  ]

  // Sort by priority then impact value
  const priOrder = { high:0, medium:1, low:2 }
  return all
    .sort((a, b) => (priOrder[a.priority]||1) - (priOrder[b.priority]||1) || (b.impactVal||0) - (a.impactVal||0))
    .slice(0, 15) // cap at 15 findings
}
