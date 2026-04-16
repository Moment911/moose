// ─────────────────────────────────────────────────────────────
// proposalDataEnricher.ts
//
// Pulls live KotoIQ SEO intelligence for a client and converts it
// into a compact, numbers-forward summary for the proposal builder
// to weave into the generated pitch. When no KotoIQ data exists
// this returns has_kotoiq_data: false and callers fall back to the
// onboarding-only proposal path.
// ─────────────────────────────────────────────────────────────

type SB = any

export interface QuickWin {
  action: string
  estimated_impact: string
  effort: 'low' | 'medium' | 'high'
}

export interface CompetitorGap {
  keyword: string
  competitor: string
  estimated_value: number
}

export interface EnrichedProposalData {
  has_kotoiq_data: boolean
  wasted_ad_spend_monthly: number
  competitor_gaps: CompetitorGap[]
  topical_authority_score: number
  competitor_avg_authority_score: number | null
  authority_gap: number | null
  decay_risk_pages: number
  decay_traffic_loss_estimate: number
  missing_schema_count: number
  broken_backlinks_count: number
  domain_authority: number
  competitor_avg_da: number | null
  total_keywords_tracked: number
  total_opportunity_value: number
  quick_wins: QuickWin[]
  // Narrative-ready bullets the Claude prompt can drop in verbatim.
  narrative_bullets: string[]
  // Raw specifics for deep references in the proposal.
  specifics: {
    top_competitors: { domain: string; keyword_count: number; estimated_monthly_value: number }[]
    top_commercial_gaps: { keyword: string; volume: number; position: number | null; opportunity: number | null }[]
    declining_urls: { url: string; trajectory: string; sc_clicks: number | null }[]
  }
}

const EMPTY: EnrichedProposalData = {
  has_kotoiq_data: false,
  wasted_ad_spend_monthly: 0,
  competitor_gaps: [],
  topical_authority_score: 0,
  competitor_avg_authority_score: null,
  authority_gap: null,
  decay_risk_pages: 0,
  decay_traffic_loss_estimate: 0,
  missing_schema_count: 0,
  broken_backlinks_count: 0,
  domain_authority: 0,
  competitor_avg_da: null,
  total_keywords_tracked: 0,
  total_opportunity_value: 0,
  quick_wins: [],
  narrative_bullets: [],
  specifics: { top_competitors: [], top_commercial_gaps: [], declining_urls: [] },
}

// ─────────────────────────────────────────────────────────────
export async function enrichProposalWithSEOData(s: SB, client_id: string): Promise<EnrichedProposalData> {
  if (!client_id) return EMPTY

  const [
    { data: keywords },
    { data: topicalMaps },
    { data: backlinkProfile },
    { data: contentInventory },
    { data: schemaAudit },
  ] = await Promise.all([
    s.from('kotoiq_keywords').select('keyword, kp_monthly_volume, sc_avg_position, sc_clicks, ads_clicks, ads_cost_cents, ads_conversions, opportunity_score, intent, competitor_domains').eq('client_id', client_id).limit(2000),
    s.from('kotoiq_topical_maps').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1),
    s.from('kotoiq_backlink_profile').select('domain_authority, total_backlinks, total_referring_domains, broken_link_opportunities, competitor_comparison').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_content_inventory').select('url, trajectory, sc_clicks, clicks_30d_ago, refresh_priority, freshness_status, has_schema').eq('client_id', client_id).limit(1000),
    s.from('kotoiq_schema_audit').select('total_pages_without, eligible_not_implemented, missing_vs_competitors').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const hasData = (keywords?.length || 0) > 0
    || !!topicalMaps?.[0]
    || !!backlinkProfile
    || (contentInventory?.length || 0) > 0
    || !!schemaAudit

  if (!hasData) return EMPTY

  const kwList = keywords || []

  // ── Cannibal / wasted ad spend: keywords where client ranks organically
  //    AND is paying for the same query via Ads.
  let wastedAdSpend = 0
  for (const kw of kwList as any[]) {
    const hasOrganic = kw.sc_clicks && kw.sc_avg_position && kw.sc_avg_position <= 10
    const hasPaid = kw.ads_clicks && kw.ads_cost_cents
    if (hasOrganic && hasPaid) {
      wastedAdSpend += Number(kw.ads_cost_cents || 0) / 100
    }
  }

  // ── Competitor gaps: keywords where a competitor domain appears but
  //    the client is not in the top 10.
  const competitorFreq: Record<string, { count: number; value: number }> = {}
  const gapKeywords: CompetitorGap[] = []
  for (const kw of kwList as any[]) {
    const comps: string[] = Array.isArray(kw.competitor_domains) ? kw.competitor_domains : []
    const clientOutranked = kw.sc_avg_position == null || Number(kw.sc_avg_position) > 10
    for (const c of comps) {
      if (!c) continue
      if (!competitorFreq[c]) competitorFreq[c] = { count: 0, value: 0 }
      competitorFreq[c].count += 1
      const estValue = Number(kw.kp_monthly_volume || 0) * 2 // rough CPC-adjacent proxy
      competitorFreq[c].value += estValue
      if (clientOutranked && gapKeywords.length < 50) {
        gapKeywords.push({ keyword: kw.keyword, competitor: c, estimated_value: estValue })
      }
    }
  }
  const topCompetitors = Object.entries(competitorFreq)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, 5)
    .map(([domain, v]) => ({ domain, keyword_count: v.count, estimated_monthly_value: Math.round(v.value) }))

  // ── Topical authority
  const map = topicalMaps?.[0] || null
  const topicalAuth = Number(map?.overall_authority_score || 0)
  // Competitor authority proxy: average DA gap tells us how far behind
  const competitorCompare: any[] = backlinkProfile?.competitor_comparison || []
  const competitorDAs = competitorCompare.map((c) => Number(c.da || 0)).filter((n) => n > 0)
  const avgCompetitorDA = competitorDAs.length > 0 ? competitorDAs.reduce((a, b) => a + b, 0) / competitorDAs.length : null

  // ── Decay risk
  const decayUrls = (contentInventory || []).filter((c: any) => c.trajectory === 'declining' || c.refresh_priority === 'urgent')
  const decayLoss = decayUrls.reduce((acc: number, c: any) => {
    const drop = Number(c.clicks_30d_ago || 0) - Number(c.sc_clicks || 0)
    return acc + Math.max(0, drop)
  }, 0)

  // ── Schema
  const missingSchema = Number(schemaAudit?.total_pages_without || 0)
  const schemaEligible: any[] = schemaAudit?.eligible_not_implemented || []

  // ── Backlinks
  const brokenBacklinks = Array.isArray(backlinkProfile?.broken_link_opportunities) ? backlinkProfile.broken_link_opportunities.length : 0
  const clientDA = Number(backlinkProfile?.domain_authority || 0)

  // ── Commercial keyword gap list (for specifics)
  const commercialGaps = (kwList as any[])
    .filter((k) => (k.intent === 'transactional' || k.intent === 'commercial') && (k.sc_avg_position == null || Number(k.sc_avg_position) > 10))
    .sort((a, b) => (Number(b.kp_monthly_volume) || 0) - (Number(a.kp_monthly_volume) || 0))
    .slice(0, 10)
    .map((k) => ({ keyword: k.keyword, volume: Number(k.kp_monthly_volume || 0), position: k.sc_avg_position ? Number(k.sc_avg_position) : null, opportunity: k.opportunity_score ? Number(k.opportunity_score) : null }))

  const totalOpportunityValue = topCompetitors.reduce((acc, c) => acc + c.estimated_monthly_value, 0)

  // ── Quick wins — deterministic synthesis from the above.
  const quickWins: QuickWin[] = []
  if (wastedAdSpend > 50) {
    quickWins.push({
      action: `Pause ads on ${kwList.filter((k: any) => k.sc_clicks && k.ads_clicks).length} queries you already rank organically`,
      estimated_impact: `$${Math.round(wastedAdSpend).toLocaleString()}/mo recovered`,
      effort: 'low',
    })
  }
  if (schemaEligible.length > 0) {
    quickWins.push({
      action: `Add schema to ${schemaEligible.length} rich-result-eligible pages`,
      estimated_impact: 'CTR lift of 10-30% on eligible pages',
      effort: 'low',
    })
  }
  if (decayUrls.length > 0) {
    quickWins.push({
      action: `Refresh ${decayUrls.length} declining pages losing ~${decayLoss.toLocaleString()} clicks/mo`,
      estimated_impact: `${decayLoss.toLocaleString()} monthly clicks recovered`,
      effort: 'medium',
    })
  }
  if (commercialGaps.length > 0) {
    const totalVol = commercialGaps.reduce((a, b) => a + b.volume, 0)
    quickWins.push({
      action: `Build pages for ${commercialGaps.length} transactional keywords you don't currently rank for`,
      estimated_impact: `${totalVol.toLocaleString()} addressable monthly searches`,
      effort: 'high',
    })
  }
  if (brokenBacklinks > 0) {
    quickWins.push({
      action: `Reclaim ${brokenBacklinks} broken backlink opportunities`,
      estimated_impact: 'Link equity recovered',
      effort: 'low',
    })
  }

  // ── Narrative bullets ready to inject into the Claude prompt
  const bullets: string[] = []
  if (wastedAdSpend > 0) bullets.push(`Found $${Math.round(wastedAdSpend).toLocaleString()}/mo in wasted ad spend on keywords you already rank for organically`)
  for (const comp of topCompetitors.slice(0, 2)) {
    bullets.push(`Competitor ${comp.domain} ranks for ${comp.keyword_count} keywords you don't (estimated $${comp.estimated_monthly_value.toLocaleString()}/mo in captured value)`)
  }
  if (map) {
    const gapText = avgCompetitorDA != null ? `Competitor avg: ${avgCompetitorDA.toFixed(1)}. Gap to close: ${(avgCompetitorDA - topicalAuth).toFixed(1)}` : ''
    bullets.push(`Your topical authority score: ${topicalAuth.toFixed(1)}. ${gapText}`)
  }
  if (decayUrls.length > 0) bullets.push(`${decayUrls.length} pages showing decay trajectory — losing ~${decayLoss.toLocaleString()} clicks/mo`)
  if (missingSchema > 0) bullets.push(`${missingSchema} pages missing structured data — blocking rich results in Google and citations in AI answer engines`)
  if (brokenBacklinks > 0) bullets.push(`${brokenBacklinks} broken backlinks pointing to dead URLs — recoverable link equity`)
  if (commercialGaps.length > 0) {
    const top = commercialGaps[0]
    bullets.push(`"${top.keyword}" has ${top.volume.toLocaleString()} monthly searches — you're ${top.position ? `at position ${Math.round(top.position)}` : 'not ranking'}`)
  }

  const declining = decayUrls.slice(0, 5).map((c: any) => ({ url: c.url, trajectory: c.trajectory || 'declining', sc_clicks: c.sc_clicks ? Number(c.sc_clicks) : null }))

  return {
    has_kotoiq_data: true,
    wasted_ad_spend_monthly: Math.round(wastedAdSpend),
    competitor_gaps: gapKeywords.slice(0, 20),
    topical_authority_score: topicalAuth,
    competitor_avg_authority_score: avgCompetitorDA,
    authority_gap: avgCompetitorDA != null ? avgCompetitorDA - topicalAuth : null,
    decay_risk_pages: decayUrls.length,
    decay_traffic_loss_estimate: decayLoss,
    missing_schema_count: missingSchema,
    broken_backlinks_count: brokenBacklinks,
    domain_authority: clientDA,
    competitor_avg_da: avgCompetitorDA,
    total_keywords_tracked: kwList.length,
    total_opportunity_value: totalOpportunityValue,
    quick_wins: quickWins,
    narrative_bullets: bullets,
    specifics: {
      top_competitors: topCompetitors,
      top_commercial_gaps: commercialGaps,
      declining_urls: declining,
    },
  }
}
