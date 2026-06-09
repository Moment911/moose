import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 / Plan 05 — scoreServiceCityGrid (WS5).
//
// scoreServiceCityGrid() is a WRAPPER over analyzePageGaps' signals (RESEARCH A4
// / Pitfall 3) — it does NOT re-blend the additive `priority`. The math is two
// PURE functions over a CellSignals object so they unit-test on fixtures with no
// DB / network:
//
//   computeCellScore(signals) = (demand + competition_strength)
//                               × (1 − our_coverage)
//                               ÷ max(difficulty, MIN_DIFFICULTY)
//
//   bucketCell(scored)        → quick_win | net_new | big_bet
//                               | low_demand_deprioritize  (+ a reason string)
//
// SCORE_WEIGHTS + MIN_DIFFICULTY are exported tunable constants.
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeCellScore,
  bucketCell,
  SCORE_WEIGHTS,
  MIN_DIFFICULTY,
  type CellSignals,
} from '../../src/lib/builder/scoreServiceCityGrid'

// A neutral baseline cell — individual tests override only the fields they probe.
function cell(overrides: Partial<CellSignals> = {}): CellSignals {
  return {
    service: 'Plumbing',
    city: 'Austin',
    state: 'TX',
    demand: 100,
    competition_strength: 0,
    our_coverage: 0,
    difficulty: 50,
    sc_position: null,
    client_listed_city: false,
    competitor_count: 0,
    ...overrides,
  }
}

describe('SCORE_WEIGHTS + MIN_DIFFICULTY constants', () => {
  it('exports a positive MIN_DIFFICULTY floor (no divide-by-zero)', () => {
    expect(MIN_DIFFICULTY).toBeGreaterThan(0)
  })
  it('exports tunable demand + competition weights', () => {
    expect(typeof SCORE_WEIGHTS.demand).toBe('number')
    expect(typeof SCORE_WEIGHTS.competition_strength).toBe('number')
  })
})

describe('computeCellScore — explicit formula', () => {
  it('(1) computes (demand + competition_strength) × (1 − our_coverage) ÷ difficulty', () => {
    const s = cell({ demand: 200, competition_strength: 100, our_coverage: 0.5, difficulty: 25 })
    const expected =
      (200 * SCORE_WEIGHTS.demand + 100 * SCORE_WEIGHTS.competition_strength) *
      (1 - 0.5) /
      Math.max(25, MIN_DIFFICULTY)
    expect(computeCellScore(s)).toBeCloseTo(expected, 6)
  })

  it('a fully-covered cell (our_coverage = 1) scores 0', () => {
    expect(computeCellScore(cell({ our_coverage: 1 }))).toBe(0)
  })

  it('higher difficulty lowers the score (monotonic ÷ difficulty)', () => {
    const easy = computeCellScore(cell({ difficulty: 20 }))
    const hard = computeCellScore(cell({ difficulty: 80 }))
    expect(easy).toBeGreaterThan(hard)
  })

  it('(6) difficulty = 0 does NOT divide-by-zero — MIN_DIFFICULTY floor applies', () => {
    const score = computeCellScore(cell({ difficulty: 0, demand: 100 }))
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeGreaterThan(0)
    // identical to clamping difficulty to the floor
    expect(score).toBeCloseTo(computeCellScore(cell({ difficulty: MIN_DIFFICULTY, demand: 100 })), 6)
  })
})

describe('bucketCell — quick_win / net_new / big_bet / deprioritize', () => {
  it('(2) quick_win when an existing page already ranks ~8-25 (sc_position in [8,25])', () => {
    const r = bucketCell(cell({ sc_position: 12, our_coverage: 0.4, competition_strength: 50 }))
    expect(r.bucket).toBe('quick_win')
    expect(r.reason).toMatch(/rank/i)
  })

  it('quick_win at the [8,25] band edges', () => {
    expect(bucketCell(cell({ sc_position: 8, our_coverage: 0.4 })).bucket).toBe('quick_win')
    expect(bucketCell(cell({ sc_position: 25, our_coverage: 0.4 })).bucket).toBe('quick_win')
  })

  it('(3) net_new when competitors cover (competition_strength > 0) and our_coverage ≈ 0', () => {
    const r = bucketCell(cell({ competition_strength: 80, competitor_count: 4, our_coverage: 0, demand: 150, difficulty: 40 }))
    expect(r.bucket).toBe('net_new')
    expect(r.reason).toMatch(/competitor/i)
  })

  it('(4) big_bet on high demand × difficulty with our_coverage ≈ 0', () => {
    const r = bucketCell(cell({ demand: 5000, difficulty: 90, competition_strength: 200, competitor_count: 6, our_coverage: 0 }))
    expect(r.bucket).toBe('big_bet')
  })

  it('(5) client-listed city with NO competitor target → low_demand_deprioritize with a reason', () => {
    const r = bucketCell(cell({ client_listed_city: true, competitor_count: 0, competition_strength: 0, demand: 5, our_coverage: 0 }))
    expect(r.bucket).toBe('low_demand_deprioritize')
    expect(r.reason).toBeTruthy()
    expect(r.reason).toMatch(/no competitor|low demand|deprioriti/i)
  })

  it('(5b) client-listed city, no competitor, but real demand → quick_win with a reason', () => {
    const r = bucketCell(cell({ client_listed_city: true, competitor_count: 0, competition_strength: 0, demand: 800, our_coverage: 0, difficulty: 20 }))
    expect(r.bucket).toBe('quick_win')
    expect(r.reason).toMatch(/no competitor|open|uncontested/i)
  })
})
