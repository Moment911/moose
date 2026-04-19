import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — profileSeeder integration tests.
//
// Composition test: every Plan 2 puller + Plan 3 extractor is mocked; we
// verify the seeder calls them, merges their output, and persists via the
// kotoiqDb helper. Real Anthropic + real Supabase are NEVER hit.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({}) })),
}))

const upsertCalls: Array<Record<string, unknown>> = []
const getMock = vi.fn().mockResolvedValue({ data: null })
const upsertMock = vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
  upsertCalls.push(data)
  return { data: { ...data, id: 'p1' } }
})

vi.mock('../src/lib/kotoiqDb', () => ({
  getKotoIQDb: () => ({
    clientProfile: {
      get: getMock,
      upsert: upsertMock,
    },
    client: {},
  }),
}))

vi.mock('../src/lib/kotoiq/profileIngestInternal', () => ({
  pullFromClient: vi.fn().mockResolvedValue({
    client: { id: 'c1', name: 'Unified' },
    records: {
      business_name: [
        {
          value: 'Unified',
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 1.0,
        },
      ],
      primary_service: [
        {
          value: 'Google Ads',
          source_type: 'onboarding_form',
          captured_at: '2026-01-01',
          confidence: 0.9,
        },
      ],
    },
  }),
  pullFromRecipients: vi.fn().mockResolvedValue({}),
  pullFromDiscovery: vi
    .fn()
    .mockResolvedValue({ engagement: null, narrativeRecords: {} }),
  pullFromVoiceCallAnalysis: vi.fn().mockResolvedValue({}),
}))

vi.mock('../src/lib/kotoiq/profileRetellPull', () => ({
  pullRetellTranscripts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/lib/kotoiq/profileVoiceExtract', () => ({
  extractFromVoiceTranscript: vi.fn(),
}))

vi.mock('../src/lib/kotoiq/profileDiscoveryExtract', () => ({
  extractFromDiscoverySection: vi.fn(),
}))

vi.mock('../src/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: vi.fn().mockResolvedValue([
    {
      field_name: 'service_area',
      record: {
        value: 'South Florida',
        source_type: 'claude_inference',
        source_ref: 'paste:test',
        captured_at: '2026-01-01',
        confidence: 0.85,
      },
    },
  ]),
}))

describe('seedProfile', () => {
  beforeEach(() => {
    upsertCalls.length = 0
    getMock.mockReset()
    upsertMock.mockClear()
    getMock.mockResolvedValue({ data: null })
  })

  it('composes internal pullers + pasted-text extraction into a merged fields map', async () => {
    const { seedProfile } = await import('../src/lib/kotoiq/profileSeeder')
    const result = await seedProfile({
      clientId: 'c1',
      agencyId: 'a1',
      pastedText: 'serving South Florida',
    })
    expect(result.profile.client_id).toBe('c1')
    // Two upserts: the main row, then the entity_graph_seed write
    expect(upsertCalls.length).toBeGreaterThanOrEqual(1)
    // The main row should carry the merged fields jsonb
    const mainUpsert = upsertCalls[0]
    expect(mainUpsert.client_id).toBe('c1')
    expect(mainUpsert.agency_id).toBe('a1')
    // business_name from pullFromClient + service_area from paste both present
    const fields = mainUpsert.fields as Record<string, unknown[]>
    expect(fields.business_name).toBeDefined()
    expect(fields.primary_service).toBeDefined()
    expect(fields.service_area).toBeDefined()
  })

  it('debounces re-seed when last_seeded_at is fresh', async () => {
    vi.resetModules()
    const fresh = new Date(Date.now() - 5 * 1000).toISOString() // 5s ago, within 30s
    const freshGet = vi.fn().mockResolvedValue({
      data: {
        id: 'p1',
        client_id: 'c1',
        agency_id: 'a1',
        fields: {
          business_name: [
            {
              value: 'Unified',
              source_type: 'onboarding_form',
              captured_at: fresh,
              confidence: 1.0,
            },
          ],
        },
        last_seeded_at: fresh,
      },
    })
    const freshUpsert = vi.fn()
    vi.doMock('../src/lib/kotoiqDb', () => ({
      getKotoIQDb: () => ({
        clientProfile: { get: freshGet, upsert: freshUpsert },
        client: {},
      }),
    }))
    const pullClientMock = vi.fn().mockResolvedValue({ client: null, records: {} })
    vi.doMock('../src/lib/kotoiq/profileIngestInternal', () => ({
      pullFromClient: pullClientMock,
      pullFromRecipients: vi.fn().mockResolvedValue({}),
      pullFromDiscovery: vi
        .fn()
        .mockResolvedValue({ engagement: null, narrativeRecords: {} }),
      pullFromVoiceCallAnalysis: vi.fn().mockResolvedValue({}),
    }))
    const { seedProfile } = await import('../src/lib/kotoiq/profileSeeder')
    const result = await seedProfile({ clientId: 'c1', agencyId: 'a1' })
    // The debounce path does NOT call pullFromClient or upsert
    expect(pullClientMock.mock.calls.length).toBe(0)
    expect(freshUpsert.mock.calls.length).toBe(0)
    expect(result.profile.client_id).toBe('c1')
  })
})
