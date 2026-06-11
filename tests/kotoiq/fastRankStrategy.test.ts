import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// fastRankStrategy.test — WS7 semantic fast-rank strategy (Phase 12 / 12-06).
//
// The composition layer (recommendFastRankStrategy) orchestrates four EXISTING
// engines into ONE fast-rank AI-SEO/GEO/AEO plan:
//   recommendLocalStrategy (localStrategistEngine) + runQueryGapAnalyzer
//   (semanticAgents) + buildPlan (planBuilderEngine) + hubBuilder.
//
// CRITICAL: recommendLocalStrategy (localStrategistEngine.ts:188) and buildPlan
// (planBuilderEngine.ts:196) construct `new Anthropic({ apiKey: ANTHROPIC_API_KEY! })`
// and THROW on a missing key. The engine MUST key-guard FIRST and return
// { ok:false, reason:'ai_unavailable' } WITHOUT ever invoking the throwing engines.
//
// These tests mock the throwing engines and assert they are NEVER called when
// no key is set — proving the guard short-circuits before the throw path.
// buildStrategyContext is a pure shaping helper tested on a fixture (no DB/AI).
// ─────────────────────────────────────────────────────────────────────────────

// Mock the throwing engines so we can assert they are NEVER invoked without a key.
const recommendLocalStrategyMock = vi.fn()
const buildPlanMock = vi.fn()
vi.mock('../../src/lib/kotoiq/localStrategistEngine', () => ({
  recommendLocalStrategy: recommendLocalStrategyMock,
}))
vi.mock('../../src/lib/kotoiq/planBuilderEngine', () => ({
  buildPlan: buildPlanMock,
}))
// semanticAgents.runQueryGapAnalyzer is optional enrichment — mock it too so a
// missing key never reaches a real Claude call.
const runQueryGapAnalyzerMock = vi.fn()
vi.mock('../../src/lib/semanticAgents', () => ({
  runQueryGapAnalyzer: runQueryGapAnalyzerMock,
}))

import {
  recommendFastRankStrategy,
  buildStrategyContext,
} from '../../src/lib/kotoiq/fastRankStrategyEngine'

describe('recommendFastRankStrategy — key-guard', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    recommendLocalStrategyMock.mockReset()
    buildPlanMock.mockReset()
    runQueryGapAnalyzerMock.mockReset()
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = savedKey
  })

  it('returns { ok:false, reason:"ai_unavailable" } without a key and NEVER invokes the throwing engines', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const result = await recommendFastRankStrategy({
      agencyId: 'agency-1',
      clientId: 'client-1',
      businessName: 'Acme Plumbing',
      services: ['water heater repair', 'drain cleaning'],
      offerings: ['tankless install'],
      cities: ['Austin'],
      state: 'TX',
      competitorIntel: { competitors: [{ name: 'Rival Plumbing', domain: 'rival.com' }] },
      opportunityList: { items: [], seeds: ['flood cleanup'] },
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ai_unavailable')
    expect(result.ai_available).toBe(false)

    // The whole point: the engines that throw on a missing key are NEVER called.
    expect(recommendLocalStrategyMock).not.toHaveBeenCalled()
    expect(buildPlanMock).not.toHaveBeenCalled()
    expect(runQueryGapAnalyzerMock).not.toHaveBeenCalled()
  })
})

describe('buildStrategyContext — pure shaping', () => {
  it('includes confirmed services + cities + competitor names in the strategist input', () => {
    const ctx = buildStrategyContext({
      agencyId: 'agency-1',
      clientId: 'client-1',
      businessName: 'Acme Plumbing',
      businessModel: 'service_area',
      services: ['Water Heater Repair', 'Drain Cleaning'],
      offerings: ['Tankless Install'],
      cities: ['Austin', 'Round Rock'],
      state: 'TX',
      competitorIntel: {
        competitors: [
          { name: 'Rival Plumbing', domain: 'rival.com' },
          { name: 'BestCo Drain', domain: 'bestco.com' },
        ],
      },
      opportunityList: { seeds: ['flood cleanup', 'sewer line repair'] },
    })

    // Services + offerings flow into the strategist services list.
    expect(ctx.services).toContain('Water Heater Repair')
    expect(ctx.services).toContain('Tankless Install')

    // Each city becomes an areas[] entry with the state.
    expect(ctx.areas.map(a => a.city)).toEqual(expect.arrayContaining(['Austin', 'Round Rock']))
    expect(ctx.areas.every(a => a.state === 'TX')).toBe(true)
    // The first city is the primary.
    expect(ctx.areas[0].is_primary).toBe(true)

    // Competitor names are surfaced to the strategist as context (notes).
    expect(ctx.notes).toMatch(/Rival Plumbing/)
    expect(ctx.notes).toMatch(/BestCo Drain/)

    // The business identity is carried through.
    expect(ctx.business_name).toBe('Acme Plumbing')
    expect(ctx.business_model).toBe('service_area')
  })

  it('is graceful with missing competitor intel / opportunity list (no throw, empty notes ok)', () => {
    const ctx = buildStrategyContext({
      agencyId: 'a', clientId: 'c',
      businessName: 'Solo Co',
      services: ['lawn care'],
      cities: ['Dallas'],
      state: 'TX',
    })
    expect(ctx.services).toEqual(['lawn care'])
    expect(ctx.areas).toHaveLength(1)
    expect(ctx.areas[0].city).toBe('Dallas')
    expect(typeof ctx.notes).toBe('string')
  })
})
