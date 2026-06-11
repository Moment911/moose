// ─────────────────────────────────────────────────────────────
// Extensive Opportunity List — KotoIQ Phase 12 / WS6
//
// Thin GLUE over the proven gap engine. Takes WS5's aggregated competitor
// keywords/pages (fields.competitor_intel from 12-04) + the client's confirmed
// inputs and feeds them through analyzePageGaps / scoreServiceCityGrid to produce
// ONE EXTENSIVE ranked keyword + page opportunity list — the build target the
// strategy step (12-06) consumes.
//
// Per research recommendation A5, this extends the GRID (passing competitor
// keywords as extra seed phrases) rather than augmenting the Sonnet
// content-gap/keyword-gap routes (which lack logTokenUsage + throw on a missing
// key). There is therefore NO Claude call here and no new key-throw risk — the
// existing bucketing (quick_win / net_new / big_bet / low_demand_deprioritize)
// and the createVerifiedData provenance carried by scoreServiceCityGrid are
// preserved verbatim. The result is genuinely larger/competitor-driven, not just
// the client's own GSC keywords.
//
// Pure exports (unit-tested on fixtures, no DB/network):
//   - competitorKeywordsFromIntel
//   - mergeServicePhrases
// IO export:
//   - buildOpportunityList
// ─────────────────────────────────────────────────────────────

// NOTE: this module is imported by both server code (buildOpportunityList) and
// the pure-function unit test. The IO function lazy-imports its server-only deps
// so the pure helpers stay importable from the Vitest (react-server) env —
// mirrors competitorIntel.ts.

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * The persisted WS5 competitor_intel payload (fields.competitor_intel from
 * 12-04). Only the fields this glue reads are typed; everything else is passed
 * through. All competitor-keyword sources are OPTIONAL so the extractor degrades
 * gracefully on a partial payload.
 */
export interface CompetitorIntelLike {
  /** Reconciled per-competitor × per-lens set (12-04 reconcileCompetitorIdentities). */
  competitors?: Array<{
    name?: string
    domain?: string
    organic?: { rank: number }
    geo?: { local_pack_rank: number | null; cells_present: number }
    aeo?: { share: number; avg_position: number | null; mentions: number }
  }>
  /** Domain-intersection keywords from a dfs_compare run, when present. */
  dfs_compare?: { intersection_keywords?: string[] } | null
  /** AEO cited URLs (getCitedSources), when a paid scan ran. */
  aeo_cited_urls?: Array<string | { url?: string }> | null
  /** Optional raw organic SERP titles, when retained alongside the unified set. */
  serp_titles?: string[] | null
}

/** Generic noise words dropped when tokenizing titles/slugs into phrases. */
const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'with',
  'best', 'top', 'near', 'me', 'your', 'our', 'us', 'home', 'page',
  'company', 'inc', 'llc', 'co', 'official', 'site', 'website', 'www', 'com',
  'html', 'php', 'index',
])

/** Phrases shorter/longer than these bounds are not useful page seeds. */
const MIN_PHRASE_WORDS = 1
const MAX_PHRASE_WORDS = 5
const MIN_PHRASE_LEN = 3

/**
 * Normalize a free-text phrase for use as a gap seed: lowercase, punctuation →
 * space, collapse whitespace, trim. Pure + idempotent. Returns '' for garbage.
 */
export function normalizePhrase(s: string): string {
  if (!s || typeof s !== 'string') return ''
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turn a competitor SERP title or URL slug into one short noun phrase: split on
 * separators, drop stop tokens, and clamp the word count. A title like
 * "Emergency Water Damage Restoration | Acme" → "emergency water damage
 * restoration"; a slug "basement-flood-cleanup" → "basement flood cleanup".
 * Pure.
 */
function phraseFromText(raw: string): string {
  // Take the most descriptive segment before a brand separator (| or –).
  const head = (raw || '').split(/[|–—\-]{1,2}|·/)[0] ?? raw
  const norm = normalizePhrase(head)
  if (!norm) return ''
  const words = norm.split(' ').filter(w => w && !STOP_TOKENS.has(w))
  if (words.length < MIN_PHRASE_WORDS) return ''
  const clamped = words.slice(0, MAX_PHRASE_WORDS).join(' ')
  return clamped.length >= MIN_PHRASE_LEN ? clamped : ''
}

/** Extract the last path segment of a URL as a slug phrase. Pure. */
function phraseFromUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let path = raw
  try {
    path = new URL(raw).pathname
  } catch {
    // Not a full URL — treat the whole string as a path.
  }
  const seg = path
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
    .pop()
  if (!seg) return ''
  // In a URL slug, dashes/underscores are WORD separators (not brand
  // separators), so normalize the whole segment rather than splitting on '-'.
  const norm = normalizePhrase(seg.replace(/\.[a-z0-9]{2,5}$/i, ''))
  if (!norm) return ''
  const words = norm.split(' ').filter(w => w && !STOP_TOKENS.has(w))
  if (words.length < MIN_PHRASE_WORDS) return ''
  const clamped = words.slice(0, MAX_PHRASE_WORDS).join(' ')
  return clamped.length >= MIN_PHRASE_LEN ? clamped : ''
}

/**
 * PURE: extract a deduped competitor keyword/phrase set from the WS5
 * competitor_intel payload. Sources (all optional, all best-effort):
 *   - dfs_compare intersection keywords (verbatim phrases competitors rank for)
 *   - organic SERP competitor titles, tokenized to short noun phrases
 *   - AEO cited-URL slugs
 *
 * Returns normalized + deduped string[]. Never throws; an absent/partial payload
 * yields []. This is the competitor-driven signal that makes the opportunity
 * list EXTENSIVE rather than just the client's own services.
 */
export function competitorKeywordsFromIntel(intel: CompetitorIntelLike | null | undefined): string[] {
  if (!intel || typeof intel !== 'object') return []
  const out: string[] = []
  const seen = new Set<string>()
  const push = (phrase: string) => {
    const p = phrase.trim()
    if (!p || seen.has(p)) return
    seen.add(p)
    out.push(p)
  }

  // 1. dfs_compare intersection keywords — the strongest signal (verbatim).
  const intersection = intel.dfs_compare?.intersection_keywords
  if (Array.isArray(intersection)) {
    for (const kw of intersection) {
      const p = normalizePhrase(typeof kw === 'string' ? kw : '')
      if (p) push(p)
    }
  }

  // 2. Organic SERP competitor titles → short noun phrases.
  const titles: string[] = []
  if (Array.isArray(intel.serp_titles)) {
    for (const t of intel.serp_titles) if (typeof t === 'string') titles.push(t)
  }
  for (const c of intel.competitors || []) {
    // Organic-lens competitors carry the SERP title in `name`.
    if (c?.organic && typeof c.name === 'string') titles.push(c.name)
  }
  for (const t of titles) {
    const p = phraseFromText(t)
    if (p) push(p)
  }

  // 3. AEO cited-URL slugs → phrases.
  const citedUrls = intel.aeo_cited_urls
  if (Array.isArray(citedUrls)) {
    for (const u of citedUrls) {
      const url = typeof u === 'string' ? u : u?.url
      if (!url) continue
      const p = phraseFromUrl(url)
      if (p) push(p)
    }
  }

  return out
}

export interface MergeResult {
  /** Client services first (verbatim casing), then NEW competitor-derived phrases. */
  merged: string[]
  /** How many entries came from each source — so the UI can show the list grew. */
  source_counts: { own: number; competitor_derived: number }
}

/**
 * PURE: union the client's own services with competitor-derived phrases without
 * duplicating an existing service (case-insensitive). Internal competitor-phrase
 * duplicates collapse too. Own services keep their original casing and lead the
 * list; only genuinely-new competitor phrases are appended. Reports own vs
 * competitor_derived counts.
 */
export function mergeServicePhrases(services: string[], competitorPhrases: string[]): MergeResult {
  const merged: string[] = []
  const seen = new Set<string>()

  let own = 0
  for (const s of services || []) {
    const v = (typeof s === 'string' ? s : '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(v)
    own++
  }

  let competitor_derived = 0
  for (const p of competitorPhrases || []) {
    const v = (typeof p === 'string' ? p : '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue // dedup against own services AND prior comp phrases
    seen.add(key)
    merged.push(v)
    competitor_derived++
  }

  return { merged, source_counts: { own, competitor_derived } }
}

// ─────────────────────────────────────────────────────────────
// IO: buildOpportunityList — feed competitor phrases through the reused grid
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { ScoredCell } from '../builder/scoreServiceCityGrid'
import type { VerifiedDataSource } from '../dataIntegrity'

export interface BuildOpportunityListInput {
  agencyId: string
  clientId: string
  /** The client's confirmed services (own grid axis). */
  services: string[]
  /** Explicit user-chosen cities (WS4 CityPicker; Census-filtered upstream). */
  cities: string[]
  state: string
  /** WS5 competitor_intel payload (fields.competitor_intel from 12-04). */
  intel?: CompetitorIntelLike | null
  /** Pass false to skip persisting scored cells (tests/preview). */
  persist?: boolean
}

export interface BuildOpportunityListResult {
  /** ONE extensive ranked list (highest score first) — own + competitor-derived. */
  items: ScoredCell[]
  buckets: {
    quick_win: number
    net_new: number
    big_bet: number
    low_demand_deprioritize: number
  }
  /** Exposes that the list grew: own services vs competitor-derived seed phrases. */
  source_counts: { own: number; competitor_derived: number }
  /** The full merged seed set actually scored (services + competitor phrases). */
  seeds: string[]
  /** Provenance for the competitor-rank + difficulty facts (from the grid). */
  sources: VerifiedDataSource[]
  /** Outcome-style headline copy from scoreServiceCityGrid. */
  headline: string
}

/**
 * Build ONE extensive ranked opportunity list. Reuses scoreServiceCityGrid (which
 * wraps analyzePageGaps) — does NOT reimplement scoring or bucketing. Competitor
 * keywords from WS5 are merged into the service seed set as extra phrases so they
 * flow through the SAME grid → one ranked, bucketed, provenance-preserving list.
 *
 * No Claude call. No Sonnet content-gap/keyword-gap routes (research A5). The
 * existing buckets (quick_win/net_new/big_bet/low_demand_deprioritize) and the
 * createVerifiedData provenance are preserved verbatim.
 */
export async function buildOpportunityList(
  input: BuildOpportunityListInput,
): Promise<BuildOpportunityListResult> {
  const { agencyId, clientId, services, cities, state, intel, persist = true } = input

  // Lazy server-only import so the pure helpers above stay importable from the
  // react-server test env (mirrors competitorIntel.ts).
  const { scoreServiceCityGrid } = await import('../builder/scoreServiceCityGrid')

  // 1. Derive competitor seed phrases (pure) and merge into the service set.
  const competitorPhrases = competitorKeywordsFromIntel(intel)
  const { merged: seeds, source_counts } = mergeServicePhrases(services, competitorPhrases)

  // 2. Feed the EXTENSIVE seed set through the reused grid → one ranked list.
  //    Reusing the existing bucketing + provenance verbatim.
  const grid = await scoreServiceCityGrid({
    agencyId,
    clientId,
    services: seeds,
    state,
    cities: Array.isArray(cities) && cities.length ? cities : undefined,
    persist,
  })

  return {
    items: grid.cells,
    buckets: {
      quick_win: grid.report.quick_wins,
      net_new: grid.report.net_new,
      big_bet: grid.report.big_bets,
      low_demand_deprioritize: grid.report.deprioritized,
    },
    source_counts,
    seeds,
    sources: grid.sources,
    headline: grid.report.headline,
  }
}
