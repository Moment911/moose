// ─────────────────────────────────────────────────────────────
// Scorecard Benchmarking Engine
// Side-by-side scorecard: client vs top competitors across all KotoIQ metrics
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getDomainRankedKeywords } from '@/lib/dataforseo'

function extractDomain(website: string): string {
  if (!website) return ''
  try {
    const w = website.startsWith('http') ? website : `https://${website}`
    return new URL(w).hostname.replace(/^www\./, '')
  } catch { return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] }
}

async function fetchMozMetrics(domain: string): Promise<{ da: number; pa: number; backlinks: number; referring_domains: number; spam_score: number } | null> {
  if (!process.env.MOZ_API_KEY || !domain) return null
  try {
    const res = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.MOZ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targets: [domain] }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const m = data?.results?.[0] || {}
    return {
      da: Number(m.domain_authority) || 0,
      pa: Number(m.page_authority) || 0,
      backlinks: Number(m.external_pages_to_root_domain) || 0,
      referring_domains: Number(m.root_domains_to_root_domain) || 0,
      spam_score: Number(m.spam_score) || 0,
    }
  } catch { return null }
}

async function fetchHomepageSignals(domain: string): Promise<{ word_count: number; has_schema: boolean; title_length: number; meta_description_length: number }> {
  const url = `https://${domain}`
  const defaults = { word_count: 0, has_schema: false, title_length: 0, meta_description_length: 0 }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return defaults
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    const word_count = text.trim().split(/\s+/).filter(Boolean).length
    const has_schema = /application\/ld\+json/i.test(html) || /itemscope|itemtype/i.test(html)
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
    const meta = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || ''
    return { word_count, has_schema, title_length: title.length, meta_description_length: meta.length }
  } catch { return defaults }
}

async function fetchSitemapSize(domain: string): Promise<number> {
  const candidates = [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`]
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const xml = await res.text()
      const matches = xml.match(/<loc>[^<]+<\/loc>/g) || []
      return matches.length
    } catch {}
  }
  return 0
}

// ── Generate scorecard ──────────────────────────────────────────────────────
export async function generateScorecard(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; competitor_domains?: string[]; agency_id?: string }
) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // Client + existing KotoIQ data
  const { data: client } = await s.from('clients').select('id, name, website, primary_service').eq('id', client_id).single()
  if (!client) throw new Error('client not found')

  // Resolve competitor domains
  let competitor_domains = (body.competitor_domains || []).map(extractDomain).filter(Boolean)
  if (competitor_domains.length === 0) {
    const { data: comps } = await s.from('kotoiq_competitors')
      .select('domain')
      .eq('client_id', client_id)
      .order('overlap_score', { ascending: false, nullsFirst: false })
      .limit(3)
    competitor_domains = (comps || []).map((c: any) => extractDomain(c.domain)).filter(Boolean)
  }
  competitor_domains = Array.from(new Set(competitor_domains)).slice(0, 3)

  // Pull all client KotoIQ metrics in parallel
  const [topical, eeat, schema, bl, brandSerp, contentInv, rankGrid, techDeep, aeo] = await Promise.all([
    s.from('kotoiq_topical_maps').select('authority_score, meta').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_eeat_audit').select('overall_score').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_schema_audit').select('coverage_pct').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_backlink_profile').select('domain_authority, total_backlinks, total_referring_domains, toxic_pct, dr_distribution').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_brand_serp').select('overall_score').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_content_inventory').select('url, published_date, word_count').eq('client_id', client_id),
    s.from('kotoiq_grid_scans_pro').select('solv, avg_rank, created_at').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_technical_deep').select('lcp, inp, cls, passing_pct').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_aeo_audits').select('overall_score').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Publishing velocity + avg word count from content inventory
  const now = Date.now()
  const since90 = now - 90 * 86400000
  const recentContent = (contentInv.data || []).filter((r: any) => r.published_date && new Date(r.published_date).getTime() >= since90)
  const clientPublishVelocity = recentContent.length / 3 // per month
  const wordCounts = (contentInv.data || []).map((r: any) => Number(r.word_count) || 0).filter((n: number) => n > 0)
  const clientAvgWordCount = wordCounts.length > 0 ? Math.round(wordCounts.reduce((a: number, b: number) => a + b, 0) / wordCounts.length) : 0

  const clientDomain = extractDomain(client.website || '')
  const [clientMoz, clientHomepage, clientSitemapCount] = await Promise.all([
    fetchMozMetrics(clientDomain),
    clientDomain ? fetchHomepageSignals(clientDomain) : Promise.resolve({ word_count: 0, has_schema: false, title_length: 0, meta_description_length: 0 }),
    clientDomain ? fetchSitemapSize(clientDomain) : Promise.resolve(0),
  ])

  const client_scores: Record<string, number | null> = {
    topical_authority: Number(topical.data?.authority_score) || 0,
    content_depth_avg_words: clientAvgWordCount || clientHomepage.word_count,
    eeat_score: Number(eeat.data?.overall_score) || 0,
    schema_coverage_pct: Number(schema.data?.coverage_pct) || (clientHomepage.has_schema ? 50 : 0),
    domain_authority: Number(bl.data?.domain_authority) || (clientMoz?.da ?? 0),
    backlink_count: Number(bl.data?.total_backlinks) || (clientMoz?.backlinks ?? 0),
    referring_domains: Number(bl.data?.total_referring_domains) || (clientMoz?.referring_domains ?? 0),
    toxic_backlink_pct: Number(bl.data?.toxic_pct) || 0,
    brand_serp_score: Number(brandSerp.data?.overall_score) || 0,
    publishing_velocity_per_month: Number(clientPublishVelocity.toFixed(2)),
    solv: Number(rankGrid.data?.solv) || 0,
    core_web_vitals_passing_pct: Number(techDeep.data?.passing_pct) || 0,
    aeo_multi_engine_score: Number(aeo.data?.overall_score) || 0,
    total_pages: clientSitemapCount || (contentInv.data || []).length,
  }

  // Competitors — fetch live signals
  const competitor_scores: any[] = []
  for (const domain of competitor_domains) {
    try {
      const [moz, homepage, sitemapCount, ranked] = await Promise.all([
        fetchMozMetrics(domain),
        fetchHomepageSignals(domain),
        fetchSitemapSize(domain),
        (async () => {
          try { return await getDomainRankedKeywords(domain, 'United States', 1) } catch { return { total: 0, keywords: [] } }
        })(),
      ])
      competitor_scores.push({
        domain,
        topical_authority: null, // unavailable without running full topical audit on competitor
        content_depth_avg_words: homepage.word_count,
        eeat_score: null,
        schema_coverage_pct: homepage.has_schema ? 50 : 0,
        domain_authority: moz?.da ?? 0,
        backlink_count: moz?.backlinks ?? 0,
        referring_domains: moz?.referring_domains ?? 0,
        toxic_backlink_pct: moz?.spam_score ?? 0,
        brand_serp_score: null,
        publishing_velocity_per_month: null, // requires historical data
        solv: null,
        core_web_vitals_passing_pct: null,
        aeo_multi_engine_score: null,
        total_pages: sitemapCount,
        ranking_keywords_total: ranked.total || 0,
      })
    } catch (err: any) {
      competitor_scores.push({ domain, error: err.message })
    }
  }

  // Compute gaps
  type Gap = { metric: string; client_value: number | null; competitor_best: number | null; gap_size: number; impact: 'critical' | 'high' | 'medium' | 'low' }
  const gaps: Gap[] = []
  const strengths: string[] = []

  const metricWeights: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    domain_authority: 'critical',
    referring_domains: 'critical',
    topical_authority: 'high',
    eeat_score: 'high',
    content_depth_avg_words: 'high',
    publishing_velocity_per_month: 'high',
    schema_coverage_pct: 'medium',
    backlink_count: 'medium',
    brand_serp_score: 'medium',
    solv: 'medium',
    core_web_vitals_passing_pct: 'medium',
    aeo_multi_engine_score: 'high',
    toxic_backlink_pct: 'low',
    total_pages: 'low',
  }

  const comparableMetrics: (keyof typeof metricWeights)[] = [
    'domain_authority', 'referring_domains', 'backlink_count', 'content_depth_avg_words',
    'schema_coverage_pct', 'total_pages',
  ]

  for (const metric of comparableMetrics) {
    const cv = (client_scores as any)[metric]
    const compValues = competitor_scores.map(c => (c as any)[metric]).filter((n: any) => typeof n === 'number' && isFinite(n))
    if (compValues.length === 0) continue
    const compBest = metric === 'toxic_backlink_pct' ? Math.min(...compValues) : Math.max(...compValues)
    const gapSize = metric === 'toxic_backlink_pct' ? cv - compBest : compBest - cv

    if (gapSize > 0) {
      // Normalize gap as % for weighting
      const pctGap = compBest > 0 ? (gapSize / compBest) * 100 : 0
      const impact: 'critical' | 'high' | 'medium' | 'low' = pctGap > 50 ? (metricWeights[metric] || 'medium')
        : pctGap > 25 ? (metricWeights[metric] === 'critical' ? 'high' : metricWeights[metric] === 'high' ? 'medium' : 'low')
        : 'low'
      gaps.push({ metric, client_value: cv, competitor_best: compBest, gap_size: gapSize, impact })
    } else if (gapSize < 0) {
      strengths.push(metric)
    }
  }

  gaps.sort((a, b) => {
    const order = { critical: 4, high: 3, medium: 2, low: 1 }
    return order[b.impact] - order[a.impact]
  })

  // AI-generated narrative
  let narrative = ''
  let overall_position: 'leader' | 'contender' | 'challenger' | 'behind' = 'contender'
  let recommended_focus: string[] = []

  try {
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are analyzing an SEO competitive scorecard. Compare the CLIENT to ${competitor_scores.length} competitors and produce a JSON response.

CLIENT: ${client.name} (${clientDomain})
Client scores:
${JSON.stringify(client_scores, null, 2)}

Competitor scores:
${JSON.stringify(competitor_scores, null, 2)}

Strengths (metrics where client leads): ${strengths.join(', ') || 'none'}
Top gaps (metrics where client lags):
${gaps.slice(0, 5).map(g => `- ${g.metric}: client=${g.client_value}, competitor_best=${g.competitor_best}, impact=${g.impact}`).join('\n')}

Return ONLY valid JSON with:
{
  "overall_position": "leader" | "contender" | "challenger" | "behind",
  "narrative": "3-4 sentence plain-English summary",
  "recommended_focus_areas": ["short action 1", "short action 2", "short action 3"]
}`,
      }],
    })
    const text = (msg.content[0] as any)?.text || ''
    await logTokenUsage({
      feature: 'scorecard_generation',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      agencyId: agency_id,
    })
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      overall_position = parsed.overall_position || 'contender'
      narrative = parsed.narrative || ''
      recommended_focus = Array.isArray(parsed.recommended_focus_areas) ? parsed.recommended_focus_areas : []
    }
  } catch (err: any) {
    // Fall back to rule-based position
    const criticalGaps = gaps.filter(g => g.impact === 'critical').length
    const highGaps = gaps.filter(g => g.impact === 'high').length
    overall_position = strengths.length > gaps.length ? 'leader'
      : criticalGaps === 0 && highGaps <= 1 ? 'contender'
      : criticalGaps <= 1 ? 'challenger'
      : 'behind'
    narrative = `Client leads on ${strengths.length} metrics, trails on ${gaps.length}. ${criticalGaps} critical gaps identified.`
    recommended_focus = gaps.slice(0, 3).map(g => `Close ${g.metric} gap`)
  }

  // Persist
  const { data: saved, error: saveErr } = await s.from('kotoiq_scorecards').insert({
    client_id,
    competitor_domains,
    client_scores,
    competitor_scores,
    gaps,
    strengths,
    recommended_focus,
    overall_position,
  }).select().single()
  if (saveErr) throw saveErr

  return {
    scorecard_id: saved.id,
    client_scores,
    competitor_scores,
    gaps,
    strengths,
    recommended_focus_areas: recommended_focus,
    overall_position,
    narrative,
  }
}
