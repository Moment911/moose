import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 5 — profileClarifications tests.
//
// Covers:
//   - classifySeverity rule-based fallback (no ANTHROPIC_API_KEY)
//     · core-identity fields → 'high'
//     · single-required-stage → 'medium'
//   - generateClarifications
//     · creates one row per softGap, capped at 15 (PROF-04 shape)
//     · high-severity path fires for primary_service gap
//   - recomputeClarifications
//     · preserves non-open rows (asked_client / answered / skipped)
//     · skips open rows whose field is no longer in softGaps
//     · adds new rows for new softGaps
//
// All Supabase + tokenTracker calls are mocked. No network.
// ─────────────────────────────────────────────────────────────────────────────

// Test fixtures use Record<string, any> for the mocked Supabase row payloads —
// matches the kotoiqDb.ts row-shape idiom established by Plan 1-4 (see those
// SUMMARYs for the full rationale).
/* eslint-disable @typescript-eslint/no-explicit-any */
const created: any[] = []
const updated: Array<{ id: string; patch: any }> = []
let listReturn: any[] = []

vi.mock('../src/lib/kotoiqDb', () => {
  return {
    getKotoIQDb: () => ({
      clarifications: {
        create: vi.fn(async (data: any) => {
          created.push(data)
          return { data: { id: `id-${created.length}`, ...data } }
        }),
        list: vi.fn(async () => ({ data: listReturn })),
        update: vi.fn(async (id: string, patch: any) => {
          updated.push({ id, patch })
          return { data: { id, ...patch } }
        }),
      },
    }),
  }
})
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock('../src/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  created.length = 0
  updated.length = 0
  listReturn = []
  delete process.env.ANTHROPIC_API_KEY
})

describe('classifySeverity (rule-based fallback)', () => {
  it('returns "high" for core-identity fields (business_name)', async () => {
    const { classifySeverity } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const sev = await classifySeverity({
      question: 'What is the business name?',
      field: 'business_name',
      affected_stages: [],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(sev).toBe('high')
  })

  it('returns "high" when ≥2 stages require the field', async () => {
    const { classifySeverity } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const sev = await classifySeverity({
      question: 'What is the primary service?',
      field: 'primary_service',
      affected_stages: [
        { stage: 'hyperlocal_content', unit: 'pages', weight: 1.0 },
        { stage: 'strategy', unit: 'sections', weight: 0.9 },
        { stage: 'entity_graph', unit: 'nodes', weight: 0.8 },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(sev).toBe('high')
  })

  it('returns "medium" when exactly one stage requires the field', async () => {
    const { classifySeverity } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const sev = await classifySeverity({
      question: 'What is the marketing budget?',
      field: 'marketing_budget',
      affected_stages: [
        { stage: 'strategy', unit: 'sections', weight: 0.9 },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(sev).toBe('medium')
  })

  it('returns "low" when no stage requires the field', async () => {
    const { classifySeverity } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const sev = await classifySeverity({
      question: 'Trust anchors?',
      field: 'trust_anchors',
      affected_stages: [
        { stage: 'eeat', unit: 'sections', weight: 0.6 },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(sev).toBe('low')
  })
})

describe('generateClarifications', () => {
  it('creates one row per softGap, capped at 15 (PROF-04 shape)', async () => {
    const { generateClarifications } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const softGaps = Array.from({ length: 20 }, (_, i) => ({
      field: `f${i}`,
      reason: `gap ${i}`,
    }))
    const out = await generateClarifications({
      profile: { id: 'p1', client_id: 'c1', agency_id: 'a1' },
      softGaps,
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(out.length).toBe(15)
    expect(created.length).toBe(15)
    // Every row has the required clarification shape
    for (const row of created) {
      expect(row).toMatchObject({
        client_id: 'c1',
        profile_id: 'p1',
        question: expect.any(String),
        target_field_path: expect.any(String),
        severity: expect.stringMatching(/^(low|medium|high)$/),
        impact_unlocks: expect.any(Array),
      })
      expect(row.question.length).toBeGreaterThan(0)
    }
  })

  it('high-severity path fires for primary_service gap (core-identity)', async () => {
    const { generateClarifications } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const out = await generateClarifications({
      profile: { id: 'p1', client_id: 'c1', agency_id: 'a1' },
      softGaps: [
        {
          field: 'primary_service',
          reason: 'required for hyperlocal + strategy + entity_graph',
        },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(out.length).toBe(1)
    expect(out[0].severity).toBe('high')
    expect(out[0].field).toBe('primary_service')
    expect(created[0].impact_hint).toMatch(/unlocks/i)
  })

  it('uses canonical question template when one exists for the field', async () => {
    const { generateClarifications } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    await generateClarifications({
      profile: { id: 'p1', client_id: 'c1', agency_id: 'a1' },
      softGaps: [
        { field: 'competitors', reason: 'no competitors named' },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(created[0].question).toMatch(/competitors/i)
  })
})

describe('recomputeClarifications', () => {
  it('skips open rows whose field is no longer in softGaps', async () => {
    listReturn = [
      { id: 'open-1', target_field_path: 'old_field', status: 'open' },
      { id: 'open-2', target_field_path: 'still_relevant', status: 'open' },
    ]
    const { recomputeClarifications } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const result = await recomputeClarifications({
      profile: { id: 'p1', client_id: 'c1', agency_id: 'a1' },
      softGaps: [
        { field: 'still_relevant', reason: 'still missing' },
        { field: 'brand_new_gap', reason: 'just discovered' },
      ],
      agencyId: 'a1',
      clientId: 'c1',
    })
    // Retire one (old_field — open but no longer in gaps)
    expect(result.retired).toBe(1)
    expect(updated.find((u) => u.id === 'open-1')?.patch.status).toBe(
      'skipped',
    )
    // Add one (brand_new_gap was not in openFields)
    expect(result.added).toBe(1)
    expect(created[0].target_field_path).toBe('brand_new_gap')
  })

  it('does not duplicate already-open clarifications', async () => {
    listReturn = [
      { id: 'open-1', target_field_path: 'still_open', status: 'open' },
    ]
    const { recomputeClarifications } = await import(
      '../src/lib/kotoiq/profileClarifications'
    )
    const result = await recomputeClarifications({
      profile: { id: 'p1', client_id: 'c1', agency_id: 'a1' },
      softGaps: [{ field: 'still_open', reason: 'still missing' }],
      agencyId: 'a1',
      clientId: 'c1',
    })
    expect(result.retired).toBe(0)
    expect(result.added).toBe(0)
    expect(created.length).toBe(0)
    expect(updated.length).toBe(0)
  })
})
