// ─────────────────────────────────────────────────────────────────────────
// Local SEO/AEO Strategist — 2026 hyperlocal recommender for Page Factory.
//
// Takes a client's services + target areas and returns a structured
// strategy: URL architecture, topic clusters, schema plan, AEO entity
// scaffolding, internal-linking pattern, and a prioritized attack queue.
//
// Powered by Claude Sonnet with a 2026 SEO/AEO best-practices preamble.
// Designed to feed kotoiq_page_suggestions when the user accepts.
// ─────────────────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ──────────────────────────────────────────────────────────────
export type BusinessModel =
  | 'service_area'    // SAB — operates AT the client's location (plumber drives to homes)
  | 'storefront'      // brick & mortar with foot traffic
  | 'hybrid'          // both (e.g. medspa with HQ + in-home visits)
  | 'multi_location'  // chain with several physical locations

export interface LocalStrategyInput {
  client_id: string
  agency_id?: string
  business_name: string
  business_model: BusinessModel
  services: string[]            // ['water heater repair', 'drain cleaning', 'tankless install']
  areas: Array<{                // service area definitions
    city: string
    state: string                // 2-letter
    county?: string
    zip?: string
    population?: number
    is_primary?: boolean         // headquarters / showroom city
  }>
  brand_voice?: string           // optional voice hint
  existing_pages?: string[]      // already-published URLs to avoid duplicating
  notes?: string                 // free-form context
}

export interface ClusterNode {
  kind: 'pillar' | 'service_x_city' | 'neighborhood' | 'comparison' | 'problem' | 'service_areas_hub' | 'about'
  url: string                    // suggested path, relative ("/services/water-heater-repair/")
  title: string
  meta_description?: string
  h1: string
  target_query: string
  search_intent: 'commercial' | 'informational' | 'comparison' | 'local' | 'problem'
  priority: 0 | 1 | 2 | 3        // 0 = drop everything, 3 = nice-to-have
  word_count_target: number
  schema_types: string[]         // ['LocalBusiness', 'Service', 'Place', 'FAQPage', 'BreadcrumbList', 'AggregateRating']
  internal_link_targets: string[]// other URLs in this strategy to link to
  e_e_a_t_signals: string[]      // what trust signals to include ('GBP CID', 'state license #', 'years in business')
}

export interface LocalStrategy {
  url_structure: {
    pattern: string                          // e.g. "/services/{service-slug}/{state}/{city}/"
    rationale: string
    examples: string[]                       // 3-5 concrete URLs
    alternatives_considered: Array<{ pattern: string; pros: string; cons: string }>
  }
  topic_clusters: ClusterNode[]
  internal_linking_strategy: {
    hub_and_spoke: string                    // narrative description
    cross_links: Array<{ from_pattern: string; to_pattern: string; anchor_strategy: string }>
  }
  schema_plan: {
    site_wide: string[]                      // schemas every page should carry
    service_pages: string[]
    city_pages: string[]
    notes: string                            // 2026-specific guidance
  }
  aeo_strategy: {
    target_entities: string[]                // entities to namedrop + linked-data
    answer_format_pages: ClusterNode[]       // FAQ-shaped pages designed to win AI Overviews
    citation_strategy: string                // how to seed AI training data + Perplexity sources
    structured_answers: string               // how to write content for AI extraction (entity-rich + atomic claims)
  }
  attack_plan: {
    phase: 'foundation' | 'expansion' | 'depth' | 'authority'
    label: string
    weeks: number
    pages: string[]                          // URLs from topic_clusters to build in this phase
    rationale: string
  }[]
  risks_and_pitfalls: string[]
  meta: {
    model: string
    cost_usd: number
    generated_at: string
  }
}

// ── 2026 best-practice preamble (the brain) ────────────────────────────
const SYSTEM_PROMPT = `You are KotoIQ's local SEO/AEO strategist as of 2026-05.

Your job: design a winning local search and answer-engine attack plan for a
service business. You think in topic clusters, entity graphs, and a balance
between traditional SEO ranking and modern AEO (Answer Engine Optimization
across ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews).

2026 LANDSCAPE — what's different vs 2023:
- AI Overviews now appear on ~40% of local-intent queries. Winning AEO
  matters as much as winning rank #1.
- LLM answer engines (Perplexity, ChatGPT search) use llms.txt + JSON-LD +
  Wikipedia/Wikidata + reputable citations heavily. Pages designed for
  AI extraction win citations.
- Schema.org Service + Place + LocalBusiness with sameAs to GBP + WikiData
  ID is now table stakes. Most service-area businesses still don't do this.
- "Service area" doctype (no physical-address LocalBusiness, just areaServed
  array of Cities and Places) is now correctly handled by Google. Use it
  for SABs.
- Programmatic SEO at huge scale (1000s of pages) STILL works but only when
  every page has unique on-page proof: pricing for that city, photos from
  that area, a testimonial from that ZIP, or a service area map clip.
  Thin programmatic pages with templated paragraphs get demoted hard.
- Topic clusters: a service "pillar" page targets the bare query
  ("water heater repair"), service-x-city pages target the local variant
  ("water heater repair Austin TX"), and neighborhood pages target sub-city
  intent ("water heater repair 78704"). Pillars rank for transactional
  national intent, service-x-city for local pack, neighborhood for
  long-tail map-pack tail.
- URL structure: hierarchy still matters. Prefer
    /services/{service-slug}/{state-abbrev}/{city-slug}/
  over either /{city}/{service}/ (city-first; weak for multi-service ops)
  or /{service}-{city} (slug-stuffing; reads spammy in AI answers).
- Single-purpose: never combine multiple services on one page. Never
  combine multiple cities on one page beyond a hub/index.

YOUR OUTPUT (strict JSON, no prose, no markdown fences):
{
  "url_structure": {
    "pattern": "string",
    "rationale": "string (2-3 sentences)",
    "examples": ["url1", "url2", ...],
    "alternatives_considered": [{"pattern":"","pros":"","cons":""}]
  },
  "topic_clusters": [
    { kind, url, title, meta_description, h1, target_query, search_intent,
      priority (0-3), word_count_target, schema_types[], internal_link_targets[], e_e_a_t_signals[] }
  ],
  "internal_linking_strategy": {
    "hub_and_spoke": "string (3-5 sentences)",
    "cross_links": [{"from_pattern":"", "to_pattern":"", "anchor_strategy":""}]
  },
  "schema_plan": {
    "site_wide": ["WebSite","Organization", ...],
    "service_pages": ["Service","FAQPage", ...],
    "city_pages": ["LocalBusiness or Service","Place","BreadcrumbList", ...],
    "notes": "2026-specific guidance, 2-3 sentences"
  },
  "aeo_strategy": {
    "target_entities": ["entity1","entity2", ...],
    "answer_format_pages": [/* ClusterNode shape, FAQ-style pages */],
    "citation_strategy": "string (2-3 sentences)",
    "structured_answers": "string (2-3 sentences)"
  },
  "attack_plan": [
    { phase: "foundation"|"expansion"|"depth"|"authority", label, weeks, pages[], rationale }
  ],
  "risks_and_pitfalls": ["...","..."]
}

CONSTRAINTS:
- Generate 6-15 topic_clusters total (more for multi-service, multi-city; fewer for simple ops).
- Every URL must be relative ("/services/...") and end with a trailing slash.
- url-slug-case: lowercase, hyphen-separated, no trailing index/.html.
- For SABs: never use LocalBusiness with physical address — use Service + areaServed.
- For multi-location storefronts: each location gets its own LocalBusiness page.
- attack_plan: 3-5 phases, total weeks ≤ 24.
- Be specific. Real URLs. Real entity names. Real schema types. No fluff.
`

// ── Public entrypoint ──────────────────────────────────────────────────
export async function recommendLocalStrategy(
  s: SupabaseClient,
  body: LocalStrategyInput,
): Promise<LocalStrategy> {
  const { client_id, agency_id, business_name, business_model, services, areas } = body
  if (!client_id)        throw new Error('client_id required')
  if (!business_name)    throw new Error('business_name required')
  if (!services?.length) throw new Error('at least one service required')
  if (!areas?.length)    throw new Error('at least one target area required')

  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userPrompt = JSON.stringify({
    business_name,
    business_model,
    services,
    areas,
    brand_voice: body.brand_voice || null,
    existing_pages: body.existing_pages || [],
    notes: body.notes || null,
  })

  const t0 = Date.now()
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Strip any accidental fencing the model may emit despite the instruction
  const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: Omit<LocalStrategy, 'meta'>
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    const err = e as Error
    throw new Error(`Strategist returned non-JSON output: ${err.message}. First 200 chars: ${jsonStr.slice(0, 200)}`)
  }

  // Cost tracking — Sonnet 4.6 rates (per 1M tokens, May 2026): $3 in / $15 out
  const inputTokens  = msg.usage?.input_tokens  || 0
  const outputTokens = msg.usage?.output_tokens || 0
  const cost_usd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15

  void logTokenUsage({
    feature:  'kotoiq_local_strategist',
    model:    'claude-sonnet-4-6',
    inputTokens, outputTokens,
    agencyId: agency_id,
  })

  const strategy: LocalStrategy = {
    ...parsed,
    meta: {
      model: 'claude-sonnet-4-6',
      cost_usd: Math.round(cost_usd * 10000) / 10000,
      generated_at: new Date().toISOString(),
    },
  }

  // Persist to kotoiq_page_suggestions: convert every topic_cluster to a
  // suggestion row so the existing Page Factory dashboard surfaces them.
  await persistAsPageSuggestions(s, body, strategy)

  // (timing reference for future cron — kept off the type system)
  void t0

  return strategy
}

// ── Persist clusters → page suggestions ────────────────────────────────
async function persistAsPageSuggestions(
  s: SupabaseClient,
  body: LocalStrategyInput,
  strategy: LocalStrategy,
) {
  const rows: Array<Record<string, unknown>> = []
  for (const node of strategy.topic_clusters) {
    // Extract service + city from the URL path when possible
    const parts = node.url.split('/').filter(Boolean)
    let service = ''
    let city = ''
    let state = ''
    const svcIdx = parts.indexOf('services')
    if (svcIdx >= 0) {
      service = parts[svcIdx + 1] || ''
      state   = (parts[svcIdx + 2] || '').toUpperCase()
      city    = parts[svcIdx + 3] || ''
    }
    rows.push({
      agency_id: body.agency_id || null,
      client_id: body.client_id,
      service: service || node.kind,
      city: city || '',
      state: state || '',
      priority: node.priority === 0 ? 95 : node.priority === 1 ? 75 : node.priority === 2 ? 50 : 25,
      reason: `${node.title} — ${node.target_query} (${node.search_intent})`,
      status: 'suggested',
      metadata: {
        source: 'local_strategist',
        kind: node.kind,
        h1: node.h1,
        meta_description: node.meta_description || null,
        word_count_target: node.word_count_target,
        schema_types: node.schema_types,
        internal_link_targets: node.internal_link_targets,
        e_e_a_t_signals: node.e_e_a_t_signals,
        strategy_generated_at: strategy.meta.generated_at,
      },
    })
  }
  if (rows.length === 0) return
  // Insert in chunks — Supabase tolerates ~500 rows per insert
  const CHUNK = 200
  for (let i = 0; i < rows.length; i += CHUNK) {
    await s.from('kotoiq_page_suggestions').insert(rows.slice(i, i + CHUNK))
  }
}
