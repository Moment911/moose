import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAnthropicFetch } from './fixtures/anthropicMock'
import { COMPLETE_PROFILE, PARTIAL_PROFILE } from './fixtures/profiles'
import type { ClientProfile } from '../src/lib/kotoiq/profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — profileGate.computeCompleteness tests.
//
// Covers PROF-04: ≤8 soft_gaps for mostly-complete, ≤15 for partial.
// All Anthropic calls mocked via tests/fixtures/anthropicMock.ts.
// ─────────────────────────────────────────────────────────────────────────────

process.env.ANTHROPIC_API_KEY = 'sk-test'

function mkProfile(p: Partial<ClientProfile>): ClientProfile {
  return {
    id: 'p',
    agency_id: 'a',
    client_id: 'c',
    entity_graph_seed: {},
    completeness_score: null,
    completeness_reasoning: null,
    soft_gaps: [],
    margin_notes: [],
    sources: [],
    last_seeded_at: null,
    last_edited_at: null,
    launched_at: null,
    last_pipeline_run_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    business_name: null,
    website: null,
    primary_service: null,
    target_customer: null,
    service_area: null,
    phone: null,
    founding_year: null,
    unique_selling_prop: null,
    industry: null,
    city: null,
    state: null,
    fields: {},
    ...p,
  } as ClientProfile
}

describe('computeCompleteness', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns ≤8 soft_gaps for mostly-complete profile (PROF-04)', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            completeness_score: 0.94,
            reasoning: 'Most fields present.',
            soft_gaps: [
              {
                field: 'service_area_specifics',
                reason: 'hyperlocal needs neighborhoods',
              },
              { field: 'competitors', reason: 'top 3 named' },
              { field: 'pricing_tiers', reason: '' },
            ],
          }),
        },
      ],
      usage: { input_tokens: 200, output_tokens: 80 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { computeCompleteness } = await import(
      '../src/lib/kotoiq/profileGate'
    )
    const out = await computeCompleteness(
      mkProfile({ ...(COMPLETE_PROFILE as Partial<ClientProfile>) }),
    )
    expect(out.completeness_score).toBe(0.94)
    expect(out.soft_gaps.length).toBeLessThanOrEqual(8)
    expect(out.soft_gaps.length).toBeGreaterThanOrEqual(3)
  })

  it('returns ≤15 soft_gaps for partial profile (PROF-04)', async () => {
    const fake = Array.from({ length: 14 }, (_, i) => ({
      field: `f${i}`,
      reason: 'missing',
    }))
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            completeness_score: 0.4,
            reasoning: 'Sparse profile.',
            soft_gaps: fake,
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { computeCompleteness } = await import(
      '../src/lib/kotoiq/profileGate'
    )
    const out = await computeCompleteness(
      mkProfile({ ...(PARTIAL_PROFILE as Partial<ClientProfile>) }),
    )
    expect(out.soft_gaps.length).toBeLessThanOrEqual(15)
    expect(out.completeness_score).toBe(0.4)
  })

  it('falls back gracefully on API failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('nope')) as any
    const { computeCompleteness } = await import(
      '../src/lib/kotoiq/profileGate'
    )
    const out = await computeCompleteness(mkProfile({}))
    expect(out.completeness_score).toBe(0)
    expect(out.soft_gaps).toEqual([])
  })

  it('clamps bogus completeness_score to [0,1]', async () => {
    globalThis.fetch = mockAnthropicFetch({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            completeness_score: 7.3,
            reasoning: 'bug',
            soft_gaps: [],
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    const { computeCompleteness } = await import(
      '../src/lib/kotoiq/profileGate'
    )
    const out = await computeCompleteness(mkProfile({}))
    expect(out.completeness_score).toBe(1)
  })
})
