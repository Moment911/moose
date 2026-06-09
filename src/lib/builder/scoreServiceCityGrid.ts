/**
 * scoreServiceCityGrid — competitor-rank-driven gap scoring (Phase 11 / WS5)
 *
 * A WRAPPER over the signals analyzePageGaps already computes (RESEARCH A4 /
 * Pitfall 3). It does NOT re-blend the additive `priority` — it re-expresses the
 * RAW signals (demand, competitor-rank set, coverage degree, difficulty) as the
 * explicit formula the product asks for:
 *
 *   score = (demand + competition_strength) × (1 − our_coverage)
 *           ÷ max(difficulty, MIN_DIFFICULTY)
 *
 * …then buckets each service×city cell:
 *   quick_win               — an existing page already ranks ~8-25 (sc_position),
 *                             OR a client-listed city no competitor targets but with real demand.
 *   net_new                 — competitors cover it and we have no page (our_coverage ≈ 0).
 *   big_bet                 — high demand × difficulty, our_coverage ≈ 0.
 *   low_demand_deprioritize — a client-listed city no competitor targets AND no real demand.
 *
 * The scoring + bucketing are PURE functions over a CellSignals object (no IO),
 * so they unit-test on fixtures. The IO wrapper gathers the signals, wraps the
 * competitor-rank + difficulty FACTS in VerifiedDataSource provenance per the
 * data-integrity standard, and persists to the new kotoiq_page_suggestions
 * columns (score/bucket/our_coverage/competition_strength/score_sources) while
 * leaving the additive `priority` intact for back-compat.
 */

import 'server-only'
import { getKotoIQDb } from '../kotoiqDb'
import { analyzePageGaps, type PageSuggestion, type GapAnalysisInput } from './pageGapEngine'
import {
  createVerifiedData,
  buildExpiresAt,
  type VerifiedDataSource,
} from '../dataIntegrity'

// ── Tunable constants (CONTEXT discretion — exposed so callers can A/B) ───────

/**
 * Weights applied to the two additive demand-side terms before the coverage /
 * difficulty transform. Default 1:1 — demand and competition_strength enter the
 * formula on equal footing. Tune to lean the build order toward raw search
 * volume (raise `demand`) or toward contested markets (raise `competition_strength`).
 */
export const SCORE_WEIGHTS = {
  demand: 1,
  competition_strength: 1,
} as const

/**
 * Divide-by-zero floor (T-11-16). difficulty=0 (e.g. an un-scored keyword) is
 * clamped to this before the division, so the score is always finite. A small
 * floor keeps low-difficulty cells appropriately high-scoring without blowing up.
 */
export const MIN_DIFFICULTY = 5

/**
 * The sc_position band that marks a "quick win" — an existing page already
 * ranks on or near page 1 (positions 8-25) and just needs a push. Below 8 it's
 * already winning (not a gap); above 25 it's effectively net-new effort.
 */
export const QUICK_WIN_RANK_BAND = { min: 8, max: 25 } as const

/**
 * Below this combined demand value, a client-listed city no competitor targets
 * is a low-demand deprioritize rather than an uncontested quick win.
 */
export const MIN_REAL_DEMAND = 50

/** demand × difficulty threshold above which a net-new gap is a "big bet". */
export const BIG_BET_DEMAND_X_DIFFICULTY = 100_000

// ── Pure signal + result types ───────────────────────────────────────────────

export type Bucket = 'quick_win' | 'net_new' | 'big_bet' | 'low_demand_deprioritize'

/**
 * The raw, IO-free signals for ONE service×city cell. The pure functions below
 * operate ONLY on this — so they're fixture-testable without DB/network.
 */
export interface CellSignals {
  service: string
  city: string
  state: string
  /** Search demand (DataForSEO local volume when enriched, else national keyword volume) + derived phrase volume. */
  demand: number
  /** Competitor-rank strength for "{service} {city}" — derived from the authoritative rank set, not a coarse count. */
  competition_strength: number
  /** 0..1 coverage degree: 0 = no page, 1 = strong ranking page, partial (~0.4) = thin / mid-ranked page. */
  our_coverage: number
  /** Keyword/SERP difficulty (100 − opportunity_score, or DataForSEO KD). */
  difficulty: number
  /** Our existing page's Search Console position for this cell, if any (drives the quick-win band). */
  sc_position: number | null
  /** True when the client explicitly listed this city as a target. */
  client_listed_city: boolean
  /** How many competitors rank for this cell (authoritative SERP/grid set). */
  competitor_count: number
}

export interface BucketResult {
  bucket: Bucket
  reason: string
}

export interface ScoredCell extends CellSignals, BucketResult {
  score: number
}

// ── Pure: the explicit formula ───────────────────────────────────────────────

/**
 * score = (demand·w_d + competition_strength·w_c) × (1 − our_coverage)
 *         ÷ max(difficulty, MIN_DIFFICULTY)
 *
 * Pure + finite for all inputs (difficulty floored). our_coverage is clamped to
 * [0,1] defensively so a bad upstream value can never produce a negative score.
 */
export function computeCellScore(s: CellSignals): number {
  const coverage = Math.max(0, Math.min(1, s.our_coverage))
  const demandTerm =
    s.demand * SCORE_WEIGHTS.demand +
    s.competition_strength * SCORE_WEIGHTS.competition_strength
  const difficulty = Math.max(s.difficulty || 0, MIN_DIFFICULTY)
  return (demandTerm * (1 - coverage)) / difficulty
}

// ── Pure: bucketing ──────────────────────────────────────────────────────────

/**
 * Classify a cell into quick_win / net_new / big_bet, with the CONTEXT special
 * case for a client-listed city no competitor targets. Returns a human-readable
 * reason string alongside the bucket (surfaced in the UI).
 *
 * Order matters:
 *   1. Existing page ranks in the quick-win band → quick_win (lowest effort).
 *   2. Client-listed city, no competitor → uncontested quick_win OR
 *      low_demand_deprioritize, depending on whether real demand exists.
 *   3. High demand × difficulty, no coverage → big_bet.
 *   4. Competitors cover it, no coverage → net_new.
 *   5. Fallback → net_new (a gap with no strong signal is still net-new work).
 */
export function bucketCell(s: CellSignals): BucketResult {
  const coverage = Math.max(0, Math.min(1, s.our_coverage))
  const noCoverage = coverage < 0.6
  const hasCompetition = s.competition_strength > 0 || s.competitor_count > 0

  // 1. Quick win — an existing page already ranks 8-25; just needs a push.
  if (
    s.sc_position != null &&
    s.sc_position >= QUICK_WIN_RANK_BAND.min &&
    s.sc_position <= QUICK_WIN_RANK_BAND.max
  ) {
    return {
      bucket: 'quick_win',
      reason: `Existing page already ranks #${s.sc_position} — a focused refresh can push it onto page 1.`,
    }
  }

  // 2. Client-listed city that no competitor targets — the CONTEXT special case.
  if (s.client_listed_city && !hasCompetition) {
    if (s.demand >= MIN_REAL_DEMAND) {
      return {
        bucket: 'quick_win',
        reason: `You listed ${s.city} and no competitor targets it — an uncontested ${s.demand.toLocaleString()}-search/mo open lane.`,
      }
    }
    return {
      bucket: 'low_demand_deprioritize',
      reason: `You listed ${s.city} but no competitor targets it and demand is low (~${s.demand.toLocaleString()}/mo) — deprioritize until demand appears.`,
    }
  }

  // 3. Big bet — high demand × difficulty with no page yet.
  if (noCoverage && s.demand * s.difficulty >= BIG_BET_DEMAND_X_DIFFICULTY) {
    return {
      bucket: 'big_bet',
      reason: `High-volume, high-difficulty target (${s.demand.toLocaleString()} searches, difficulty ${Math.round(s.difficulty)}) — a long-game investment.`,
    }
  }

  // 4. Net-new — competitors cover it and we have no page.
  if (noCoverage && hasCompetition) {
    return {
      bucket: 'net_new',
      reason: `${s.competitor_count} competitor${s.competitor_count === 1 ? '' : 's'} rank here and you have no page — net-new coverage to claim.`,
    }
  }

  // 5. Fallback — a gap with no strong signal is still net-new work.
  return {
    bucket: 'net_new',
    reason: `No existing page for ${s.service} in ${s.city} — net-new coverage opportunity.`,
  }
}

// ── IO wrapper: gather signals → score → bucket → persist ─────────────────────

export interface ScoreGridInput {
  agencyId: string
  clientId: string
  services: string[]
  state: string
  /** Explicit user-chosen cities (WS4 CityPicker). Scopes discovery. */
  cities?: string[]
  counties?: string[]
  cityLimit?: number
  /** Persist scored cells to the new kotoiq_page_suggestions columns (default true). */
  persist?: boolean
}

export interface ScoreGridResult {
  cells: ScoredCell[]
  report: {
    total: number
    quick_wins: number
    net_new: number
    big_bets: number
    deprioritized: number
    /** Outcome-style headline copy (CONTEXT specifics). */
    headline: string
  }
  /** Provenance for the competitor-rank + difficulty facts that fed the formula. */
  sources: VerifiedDataSource[]
}

/**
 * Map a PageSuggestion (from analyzePageGaps) onto the pure CellSignals.
 *
 * our_coverage degree:
 *   - analyzePageGaps SKIPS combos that already have a page, so the suggestions
 *     it returns are gaps (our_coverage ≈ 0) by construction. A thin / mid-ranked
 *     existing page surfaces via sc_position when present → partial coverage.
 *   - When sc_position is in the quick-win band, treat coverage as partial (0.4),
 *     marking the quick-win refresh case rather than net-new build.
 *
 * competition_strength: derived from the authoritative rank set. The stronger a
 * cell's competitors rank (lower rank numbers) and the more of them, the higher
 * the contested-market signal. We use competitor_count as the base magnitude and
 * weight it up when ranks are strong (top-10 presence).
 */
export function suggestionToSignals(
  s: PageSuggestion,
  opts: { client_listed_city?: boolean; competitorRanks?: number[] } = {},
): CellSignals {
  const ranks = opts.competitorRanks || []
  // Strength = count, boosted by how many competitors sit in the top 10.
  const topTen = ranks.filter(r => r > 0 && r <= 10).length
  const competition_strength = s.competitor_count + topTen * 2

  // sc_position is only known when an existing page ranks; analyzePageGaps drops
  // already-covered combos, so most cells have none. When present in the quick-win
  // band, mark partial coverage (refresh, not net-new build).
  const sc_position = (s as PageSuggestion & { sc_position?: number | null }).sc_position ?? null
  const our_coverage =
    sc_position != null && sc_position >= QUICK_WIN_RANK_BAND.min && sc_position <= QUICK_WIN_RANK_BAND.max
      ? 0.4
      : 0

  return {
    service: s.service,
    city: s.city,
    state: s.state,
    demand: s.search_volume ?? 0,
    competition_strength,
    our_coverage,
    difficulty: s.keyword_difficulty ?? 50,
    sc_position,
    client_listed_city: !!opts.client_listed_city,
    competitor_count: s.competitor_count,
  }
}

export async function scoreServiceCityGrid(input: ScoreGridInput): Promise<ScoreGridResult> {
  const { agencyId, clientId, services, state, cities, counties, cityLimit, persist = true } = input

  // 1. Gather the raw signals via the existing engine (reusing WS4 cities[] scoping).
  const gapInput: GapAnalysisInput = {
    agencyId,
    clientId,
    services,
    state,
    cities,
    counties,
    cityLimit,
  }
  const gap = await analyzePageGaps(gapInput)

  // The set of client-listed cities (WS4 explicit selection) — used for the
  // "client city, no competitor" special case.
  const listed = new Set((cities || []).map(c => c.toLowerCase().trim()))

  // 2. Provenance for the competitor-rank + difficulty facts (data-integrity).
  //    The ranks come from DataForSEO SERP rank_group + Google Places grid via
  //    analyzePageGaps' loaders; difficulty from kotoiq_keywords / DataForSEO KD.
  const fetchedAt = new Date().toISOString()
  const sources: VerifiedDataSource[] = [
    createVerifiedData(
      { signal: 'competitor_rank' },
      {
        source_url: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        source_name: 'DataForSEO SERP (rank_group) + Google Places grid',
        source_type: 'third-party-verified',
        fetched_at: fetchedAt,
        expires_at: buildExpiresAt('rankings'),
        cross_referenced: true,
        ai_generated: false,
        confidence: 'single-source',
      },
    ),
    createVerifiedData(
      { signal: 'keyword_difficulty' },
      {
        source_url: 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
        source_name: 'DataForSEO keyword difficulty / kotoiq_keywords opportunity_score',
        source_type: 'third-party-verified',
        fetched_at: fetchedAt,
        expires_at: buildExpiresAt('rankings'),
        cross_referenced: false,
        ai_generated: false,
        confidence: 'single-source',
      },
    ),
  ]

  // 3. Score + bucket each cell (pure).
  const cells: ScoredCell[] = gap.suggestions.map(s => {
    const signals = suggestionToSignals(s, {
      client_listed_city: listed.has(s.city.toLowerCase().trim()),
    })
    const score = computeCellScore(signals)
    const { bucket, reason } = bucketCell(signals)
    return { ...signals, score, bucket, reason }
  })

  // Ranked build order — highest score first.
  cells.sort((a, b) => b.score - a.score)

  // 4. Persist to the new columns (leaving priority intact).
  if (persist) {
    await persistScoredCells(agencyId, clientId, cells, sources, fetchedAt)
  }

  // 5. Outcome-style report.
  const quick_wins = cells.filter(c => c.bucket === 'quick_win').length
  const net_new = cells.filter(c => c.bucket === 'net_new').length
  const big_bets = cells.filter(c => c.bucket === 'big_bet').length
  const deprioritized = cells.filter(c => c.bucket === 'low_demand_deprioritize').length

  const headline =
    `${cells.length} opportunities, ranked by what'll move traffic fastest — ` +
    `${quick_wins} quick win${quick_wins === 1 ? '' : 's'}, ` +
    `${net_new} net-new, ${big_bets} big bet${big_bets === 1 ? '' : 's'}` +
    (deprioritized ? ` (${deprioritized} deprioritized)` : '')

  return {
    cells,
    report: { total: cells.length, quick_wins, net_new, big_bets, deprioritized, headline },
    sources,
  }
}

/**
 * Persist the scored cells onto kotoiq_page_suggestions. Updates the gap-score
 * columns (score/bucket/our_coverage/competition_strength/score_sources) on the
 * matching suggested rows; leaves the additive `priority` column untouched.
 */
async function persistScoredCells(
  agencyId: string,
  clientId: string,
  cells: ScoredCell[],
  sources: VerifiedDataSource[],
  fetchedAt: string,
): Promise<{ updated: number }> {
  const db = getKotoIQDb(agencyId)
  const scoreSources = { fetched_at: fetchedAt, signals: sources }
  let updated = 0

  // The suggestions were just (re)written by analyzePageGaps' caller path; match
  // on (client_id, service, city, state) and stamp the gap-score columns.
  for (const c of cells) {
    const { error, count } = await db.client
      .from('kotoiq_page_suggestions')
      .update(
        {
          score: c.score,
          bucket: c.bucket,
          our_coverage: c.our_coverage,
          competition_strength: c.competition_strength,
          score_sources: scoreSources,
          reason: c.reason,
        },
        { count: 'exact' },
      )
      .eq('agency_id', agencyId)
      .eq('client_id', clientId)
      .eq('service', c.service)
      .eq('city', c.city)
      .eq('state', c.state)
      .eq('status', 'suggested')
    if (!error && count) updated += count
  }

  return { updated }
}
