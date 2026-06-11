// ─────────────────────────────────────────────────────────────────────────────
// Fast-Rank Strategy Engine (WS7 — Phase 12 / 12-06)
//
// The capstone composition. Assembles FOUR existing engines into ONE concrete
// fast-rank AI-SEO / GEO / AEO plan over the guided flow's confirmed inputs
// (12-01) + competitor intel (12-04) + the extensive opportunity list (12-05):
//
//   • recommendLocalStrategy (localStrategistEngine) — URL architecture, topic
//     clusters, internal-linking plan, schema plan, AEO entity scaffolding,
//     phased attack plan. AUTO-PERSISTS clusters → kotoiq_page_suggestions.
//   • runQueryGapAnalyzer (semanticAgents) — optional enrichment of the top
//     cluster's query network using the competitor pages as context.
//   • buildPlan (planBuilderEngine) — converts the strategy goal into an
//     executable, persisted plan (kotoiq_plans + kotoiq_plan_steps).
//   • hubBuilder is composed downstream by the existing build flow — the strategy
//     surfaces the pillar/hub cluster so the user can deploy it; no Claude call.
//
// ── THE KEY-GUARD (the whole reason this engine exists) ────────────────────────
// recommendLocalStrategy (localStrategistEngine.ts:188) and buildPlan
// (planBuilderEngine.ts:196) both construct
//   new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
// and THROW on a missing key. This engine MUST short-circuit FIRST:
//   if (!process.env.ANTHROPIC_API_KEY) return { ok:false, reason:'ai_unavailable' }
// WITHOUT ever invoking them — so a $0/unfunded key surfaces a VISIBLE
// "AI unavailable" banner instead of crashing the guided strategy step
// (T-12-21, T-12-22). The throwing engines are lazy-imported AFTER the guard so
// they are never even loaded on the no-key path.
//
// logTokenUsage already lives INSIDE both underlying engines (T-12-25) — this
// composition adds no direct Claude call of its own except the optional, guarded
// runQueryGapAnalyzer enrichment (which also logs its own usage).
//
// No bare catch{}: a downstream throw becomes { ok:false, reason } after logging.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessModel, LocalStrategy } from './localStrategistEngine'

// ── Public input/output types ──────────────────────────────────────────────

export interface FastRankStrategyInput {
  agencyId?: string
  clientId: string
  businessName?: string
  businessModel?: BusinessModel
  /** confirmed services (12-01 fields.services[]) */
  services: string[]
  /** confirmed offerings (12-01 fields.offerings[]) — folded into the strategist service set */
  offerings?: string[]
  /** target cities (guided spine selectedCities) */
  cities: string[]
  /** 2-letter state */
  state: string
  /** 12-04 fields.competitor_intel jsonb (per-competitor × per-lens set) */
  competitorIntel?: unknown
  /** 12-05 opportunity_list result (items + seeds + buckets) */
  opportunityList?: unknown
  /** already-published URLs to avoid duplicating (optional) */
  existingPages?: string[]
}

export interface FastRankStrategy {
  topic_clusters: LocalStrategy['topic_clusters']
  url_structure: LocalStrategy['url_structure']
  internal_linking_strategy: LocalStrategy['internal_linking_strategy']
  schema_plan: LocalStrategy['schema_plan']
  aeo_strategy: LocalStrategy['aeo_strategy']
  attack_plan: LocalStrategy['attack_plan']
  risks_and_pitfalls: LocalStrategy['risks_and_pitfalls']
  /** the executable plan persisted via buildPlan (kotoiq_plans) */
  plan_id?: string
  /** optional semantic enrichment of the top cluster's query network */
  query_enrichment?: {
    cluster_url: string
    primary_angle: string
    query_network: string[]
    competitor_gaps: string[]
  } | null
  meta: LocalStrategy['meta']
}

export interface FastRankStrategyResult {
  ok: boolean
  /** false when reason==='ai_unavailable' — drives the UI "AI unavailable" banner. */
  ai_available: boolean
  reason?: 'ai_unavailable' | 'strategy_error'
  strategy?: FastRankStrategy
  detail?: string
}

// ── The shape recommendLocalStrategy consumes (pure helper, exported for tests) ─

export interface StrategistContext {
  business_name: string
  business_model: BusinessModel
  services: string[]
  areas: Array<{ city: string; state: string; is_primary?: boolean }>
  existing_pages: string[]
  notes: string
}

/**
 * buildStrategyContext — pure shaping. Folds confirmed services + offerings into
 * ONE strategist service set, turns the chosen cities into areas[] (first city =
 * primary), and surfaces competitor names + the opportunity-list seeds as free-form
 * `notes` context so the strategist designs around real rivals + real gaps.
 *
 * IO-free + throw-free: a missing competitorIntel / opportunityList degrades to
 * empty notes rather than failing. Importable from the Vitest react-server env.
 */
export function buildStrategyContext(input: FastRankStrategyInput): StrategistContext {
  const services = dedupePreserve([
    ...(input.services || []),
    ...(input.offerings || []),
  ].map(s => String(s || '').trim()).filter(Boolean))

  const cities = (input.cities || []).map(c => String(c || '').trim()).filter(Boolean)
  const state = String(input.state || '').trim()
  const areas = cities.map((city, i) => ({
    city,
    state,
    ...(i === 0 ? { is_primary: true } : {}),
  }))

  const competitorNames = competitorNamesFromIntel(input.competitorIntel)
  const opportunitySeeds = seedsFromOpportunityList(input.opportunityList)

  const noteParts: string[] = []
  if (competitorNames.length) {
    noteParts.push(
      `Competitors already ranking in these markets (out-build them): ${competitorNames.slice(0, 12).join(', ')}.`,
    )
  }
  if (opportunitySeeds.length) {
    noteParts.push(
      `High-priority opportunity keywords/phrases derived from competitor gaps: ${opportunitySeeds.slice(0, 25).join(', ')}.`,
    )
  }
  noteParts.push(
    'Design for FAST ranking across traditional SEO, Google AI Overviews, and LLM answer engines (Perplexity/ChatGPT/Claude/Gemini). Prioritize the lowest-effort/highest-impact clusters first.',
  )

  return {
    business_name: input.businessName || 'this business',
    business_model: input.businessModel || 'service_area',
    services,
    areas,
    existing_pages: input.existingPages || [],
    notes: noteParts.join(' '),
  }
}

// ── Pure extractors over the persisted 12-04 / 12-05 payloads ────────────────

function competitorNamesFromIntel(intel: unknown): string[] {
  if (!intel || typeof intel !== 'object') return []
  const competitors = (intel as { competitors?: unknown }).competitors
  if (!Array.isArray(competitors)) return []
  const names = competitors
    .map((c) => (c && typeof c === 'object' ? String((c as { name?: unknown }).name || '').trim() : ''))
    .filter(Boolean)
  return dedupePreserve(names)
}

function seedsFromOpportunityList(list: unknown): string[] {
  if (!list || typeof list !== 'object') return []
  const l = list as { seeds?: unknown; items?: unknown }
  const out: string[] = []
  if (Array.isArray(l.seeds)) {
    for (const s of l.seeds) {
      const v = String(s || '').trim()
      if (v) out.push(v)
    }
  }
  // Fall back to item service/keyword fields when seeds[] is absent.
  if (out.length === 0 && Array.isArray(l.items)) {
    for (const it of l.items) {
      if (it && typeof it === 'object') {
        const v = String(
          (it as { service?: unknown; keyword?: unknown }).service
          ?? (it as { keyword?: unknown }).keyword
          ?? '',
        ).trim()
        if (v) out.push(v)
      }
    }
  }
  return dedupePreserve(out)
}

function dedupePreserve(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const key = it.toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(it) }
  }
  return out
}

/** competitor pages (url + snippet) for the optional runQueryGapAnalyzer enrichment. */
function competitorPagesFromIntel(intel: unknown): Array<{ url: string; content_snippet: string }> {
  if (!intel || typeof intel !== 'object') return []
  const competitors = (intel as { competitors?: unknown }).competitors
  if (!Array.isArray(competitors)) return []
  const pages: Array<{ url: string; content_snippet: string }> = []
  for (const c of competitors) {
    if (!c || typeof c !== 'object') continue
    const domain = String((c as { domain?: unknown }).domain || '').trim()
    const name = String((c as { name?: unknown }).name || '').trim()
    if (domain) {
      pages.push({
        url: domain.startsWith('http') ? domain : `https://${domain}`,
        content_snippet: name || domain,
      })
    }
    if (pages.length >= 5) break
  }
  return pages
}

// ── Public entrypoint ────────────────────────────────────────────────────────

/**
 * recommendFastRankStrategy — compose the four engines behind a HARD key-guard.
 *
 * Never throws. Returns { ok:false, reason:'ai_unavailable' } the instant no
 * funded key is present, WITHOUT loading or invoking recommendLocalStrategy /
 * buildPlan (both of which throw on a missing key).
 */
export async function recommendFastRankStrategy(
  input: FastRankStrategyInput,
  /** optional injected supabase client; created on demand otherwise */
  supabase?: SupabaseClient,
): Promise<FastRankStrategyResult> {
  // ── KEY-GUARD — short-circuit BEFORE importing/calling the throwing engines. ──
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      ai_available: false,
      reason: 'ai_unavailable',
      detail: 'ANTHROPIC_API_KEY is not set — the strategy engines (recommendLocalStrategy/buildPlan) would throw. Surfacing ai_unavailable so the UI shows a visible banner.',
    }
  }

  if (!input.clientId) {
    return { ok: false, ai_available: true, reason: 'strategy_error', detail: 'clientId required' }
  }
  const cleanServices = (input.services || []).map(s => String(s || '').trim()).filter(Boolean)
  if (cleanServices.length === 0) {
    return { ok: false, ai_available: true, reason: 'strategy_error', detail: 'at least one confirmed service required' }
  }
  if (!(input.cities || []).some(c => String(c || '').trim())) {
    return { ok: false, ai_available: true, reason: 'strategy_error', detail: 'at least one target city required' }
  }

  try {
    // Lazy-import the throwing engines AFTER the guard.
    const [{ recommendLocalStrategy }, { buildPlan }] = await Promise.all([
      import('./localStrategistEngine'),
      import('./planBuilderEngine'),
    ])

    const s = supabase ?? (await import('@/lib/supabaseAdmin')).supabaseAdmin

    const ctx = buildStrategyContext(input)

    // 1) The core local SEO/AEO/GEO strategy (auto-persists clusters → page_suggestions).
    const strategy = await recommendLocalStrategy(s, {
      client_id: input.clientId,
      agency_id: input.agencyId,
      business_name: ctx.business_name,
      business_model: ctx.business_model,
      services: ctx.services,
      areas: ctx.areas,
      existing_pages: ctx.existing_pages,
      notes: ctx.notes,
    })

    // 2) Optional semantic enrichment of the top transactional cluster's query
    //    network using the competitor pages as context. Best-effort — never fail
    //    the whole strategy if this one Sonnet pass errors.
    let queryEnrichment: FastRankStrategy['query_enrichment'] = null
    try {
      const { runQueryGapAnalyzer } = await import('@/lib/semanticAgents')
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const topCluster = (strategy.topic_clusters || []).find(c => c.search_intent === 'commercial' || c.search_intent === 'local')
        || (strategy.topic_clusters || [])[0]
      if (topCluster) {
        const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const gap = await runQueryGapAnalyzer(ai, {
          keyword: topCluster.target_query,
          industry: ctx.business_model,
          business_name: ctx.business_name,
          existing_keywords: ctx.services,
          competitor_pages: competitorPagesFromIntel(input.competitorIntel),
          agencyId: input.agencyId,
        })
        queryEnrichment = {
          cluster_url: topCluster.url,
          primary_angle: gap.primary_angle,
          query_network: gap.query_network || [],
          competitor_gaps: gap.competitor_gaps || [],
        }
      }
    } catch (e) {
      // Enrichment is optional — log and continue with the core strategy.
      console.warn('[fastRankStrategy] query-gap enrichment skipped:', (e as Error)?.message || e)
      queryEnrichment = null
    }

    // 3) Persist the executable build order via buildPlan (kotoiq_plans + steps).
    let planId: string | undefined
    try {
      const goal = `Fast-rank ${ctx.business_name} across AI-SEO / GEO / AEO for ${ctx.services.slice(0, 4).join(', ')} in ${ctx.areas.map(a => a.city).slice(0, 4).join(', ')}.`
      const { plan_id } = await buildPlan(s, {
        client_id: input.clientId,
        agency_id: input.agencyId,
        goal,
        context: {
          services: ctx.services,
          areas: ctx.areas,
          business_model: ctx.business_model,
          strategy_generated_at: strategy.meta.generated_at,
        },
      })
      planId = plan_id
    } catch (e) {
      // The strategy itself succeeded — a plan-persist failure shouldn't drop it.
      console.warn('[fastRankStrategy] buildPlan persistence skipped:', (e as Error)?.message || e)
    }

    const fastRank: FastRankStrategy = {
      topic_clusters: strategy.topic_clusters,
      url_structure: strategy.url_structure,
      internal_linking_strategy: strategy.internal_linking_strategy,
      schema_plan: strategy.schema_plan,
      aeo_strategy: strategy.aeo_strategy,
      attack_plan: strategy.attack_plan,
      risks_and_pitfalls: strategy.risks_and_pitfalls,
      plan_id: planId,
      query_enrichment: queryEnrichment,
      meta: strategy.meta,
    }

    return { ok: true, ai_available: true, strategy: fastRank }
  } catch (e) {
    // Surface, don't swallow: log the reason then degrade. A downstream throw
    // (e.g. the strategist returned non-JSON, or the key turned out unfunded
    // mid-flight) becomes a structured ai_unavailable result, never a crash.
    const err = e as Error
    console.error('[fastRankStrategy] composition error:', err?.message || err)
    const isAuth = /api[_ ]?key|credit|balance|401|unauthorized|authentication/i.test(err?.message || '')
    return {
      ok: false,
      ai_available: !isAuth,
      reason: isAuth ? 'ai_unavailable' : 'strategy_error',
      detail: err?.message || 'fast-rank strategy composition failed',
    }
  }
}
