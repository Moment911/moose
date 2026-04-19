import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ───────────────────────────────────────────────────────────
//
// The four pullers chain `.from(table).select(...).eq(...).eq(...)...` then
// terminate with either `.maybeSingle()` (clients, discovery) or are awaited
// directly as a list (recipients).  Our chainable handles both: every
// builder method returns `this`; `.maybeSingle()` resolves with the staged
// row; awaiting the chainable resolves with `{ data: [rows], error: null }`.
// Per-table data is staged via `tableStub(table, value)` and routed through
// `mockFrom.mockImplementation`.
// ────────────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

function tableStub(_table: string, resolvedData: unknown) {
  const asArray = Array.isArray(resolvedData) ? resolvedData : resolvedData == null ? [] : [resolvedData]
  const asSingle = Array.isArray(resolvedData) ? resolvedData[0] ?? null : resolvedData
  // The Supabase fluent query builder is recursively self-referential and
  // (intentionally) overloaded — typing it precisely would dwarf the test.
  // The `any` here is local to the test stub and never crosses module
  // boundaries, so we silence the lint rule at this single site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: asSingle, error: null })),
    single: vi.fn(async () => ({ data: asSingle, error: null })),
    // Awaiting the chain (list query) resolves to an array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (resolve: (v: any) => void) => resolve({ data: asArray, error: null }),
  }
  return chain
}

beforeEach(() => {
  mockFrom.mockReset()
})

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test'
process.env.NEXT_PUBLIC_APP_URL = 'https://hellokoto.com'

// ─────────────────────────────────────────────────────────────────────────────
// pullFromClient
// ─────────────────────────────────────────────────────────────────────────────
describe('pullFromClient', () => {
  it('returns ≥10 ProvenanceRecord fields for a fully-populated client', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients')
        return tableStub('clients', {
          id: 'abc',
          agency_id: 'agY',
          name: 'Unified',
          website: 'https://u.com',
          primary_phone: '+15615551234',
          primary_service: 'Google Ads',
          target_customer: 'small biz',
          unique_selling_prop: 'Same-day',
          industry: 'Marketing',
          city: 'Boca Raton',
          state: 'FL',
          founding_year: '2019',
          deleted_at: null,
          updated_at: '2026-04-17T00:00:00Z',
          onboarding_answers: {},
          onboarding_confidence_scores: { primary_service: 0.9 },
        })
      return tableStub(table, null)
    })
    const { pullFromClient } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { client, records } = await pullFromClient({ clientId: 'abc', agencyId: 'agY' })
    expect(client).toBeTruthy()
    expect(Object.keys(records).length).toBeGreaterThanOrEqual(10)
    expect(records.business_name[0].source_type).toBe('onboarding_form')
    expect(records.business_name[0].source_url).toBe('https://hellokoto.com/clients/abc')
    expect(records.business_name[0].confidence).toBe(1.0)
    expect(records.founding_year[0].value).toBe(2019)
    // Voice-confidence override raises primary_service from 0.85 to 0.9
    expect(records.primary_service[0].confidence).toBe(0.9)
  })

  it('returns null + empty records when agency_id does not match (cross-agency guard)', async () => {
    mockFrom.mockImplementation(() => tableStub('clients', null))
    const { pullFromClient } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { client, records } = await pullFromClient({ clientId: 'abc', agencyId: 'WRONG' })
    expect(client).toBeNull()
    expect(Object.keys(records)).toHaveLength(0)
  })

  it('promotes onboarding_call_summary to a voice_call provenance record', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients')
        return tableStub('clients', {
          id: 'abc',
          agency_id: 'agY',
          name: 'Unified',
          deleted_at: null,
          onboarding_call_summary: 'Operator wants emergency 24/7 service.',
        })
      return tableStub(table, null)
    })
    const { pullFromClient } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { records } = await pullFromClient({ clientId: 'abc', agencyId: 'agY' })
    const welcome = records.welcome_statement || []
    // welcome_statement may have either 1 (just voice) or 2 (form + voice) records;
    // the voice_call entry must exist
    const hasVoice = welcome.some((r) => r.source_type === 'voice_call')
    expect(hasVoice).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pullFromRecipients
// ─────────────────────────────────────────────────────────────────────────────
describe('pullFromRecipients', () => {
  it('extracts canonical fields from each recipient answers jsonb (skipping _call_analysis)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'koto_onboarding_recipients')
        return tableStub('koto_onboarding_recipients', [
          {
            id: 'r1',
            client_id: 'abc',
            agency_id: 'agY',
            last_active_at: '2026-04-15T00:00:00Z',
            answers: {
              products_services: 'PPC and SEO',
              ideal_customer_desc: 'home services contractors',
              monthly_ad_budget: '$5000',
              _call_analysis: { caller_sentiment: 'engaged' }, // must be skipped
              _internal_meta: 'should be skipped — leading _',
            },
          },
          {
            id: 'r2',
            client_id: 'abc',
            agency_id: 'agY',
            last_active_at: '2026-04-10T00:00:00Z',
            answers: {
              competitors: ['CompA', 'CompB'],
              why_choose_you: 'fixed-price retainers',
            },
          },
        ])
      return tableStub(table, [])
    })
    const { pullFromRecipients } = await import('../src/lib/kotoiq/profileIngestInternal')
    const records = await pullFromRecipients({ clientId: 'abc', agencyId: 'agY' })
    expect(records.primary_service).toBeDefined()
    expect(records.primary_service[0].value).toBe('PPC and SEO')
    expect(records.target_customer[0].value).toBe('home services contractors')
    expect(records.marketing_budget[0].value).toBe('$5000')
    expect(records.competitors[0].value).toBe('CompA, CompB')
    expect(records.unique_selling_prop[0].value).toBe('fixed-price retainers')
    // _call_analysis MUST NOT leak in
    expect(records.caller_sentiment).toBeUndefined()
  })

  it('returns empty when no recipients exist', async () => {
    mockFrom.mockImplementation((table: string) => tableStub(table, []))
    const { pullFromRecipients } = await import('../src/lib/kotoiq/profileIngestInternal')
    const records = await pullFromRecipients({ clientId: 'abc', agencyId: 'agY' })
    expect(Object.keys(records)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pullFromDiscovery
// ─────────────────────────────────────────────────────────────────────────────
describe('pullFromDiscovery', () => {
  it('extracts welcome_statement from executive_summary + canonical fields from client_answers', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'koto_discovery_engagements')
        return tableStub('koto_discovery_engagements', {
          id: 'eng1',
          client_id: 'abc',
          agency_id: 'agY',
          created_at: '2026-04-15T00:00:00Z',
          updated_at: '2026-04-16T00:00:00Z',
          executive_summary: 'Unified is a Boca-based agency focused on lead-gen for HVAC.',
          client_answers: {
            competitors: ['Local SEO Co', 'Big Agency'],
            pain_points: 'difficulty tracking which leads turn into revenue',
          },
        })
      return tableStub(table, null)
    })
    const { pullFromDiscovery } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { engagement, narrativeRecords } = await pullFromDiscovery({ clientId: 'abc', agencyId: 'agY' })
    expect(engagement).toBeTruthy()
    expect(narrativeRecords.welcome_statement).toBeDefined()
    expect(narrativeRecords.welcome_statement[0].source_type).toBe('discovery_doc')
    expect(narrativeRecords.welcome_statement[0].source_url).toBe('https://hellokoto.com/discovery/eng1')
    expect(narrativeRecords.competitors[0].value).toBe('Local SEO Co, Big Agency')
    expect(narrativeRecords.pain_points[0].source_ref).toBe('discovery_doc:eng1:client_answers.pain_points')
  })

  it('returns null engagement + empty records when no discovery exists', async () => {
    mockFrom.mockImplementation(() => tableStub('koto_discovery_engagements', null))
    const { pullFromDiscovery } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { engagement, narrativeRecords } = await pullFromDiscovery({ clientId: 'abc', agencyId: 'agY' })
    expect(engagement).toBeNull()
    expect(Object.keys(narrativeRecords)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pullFromVoiceCallAnalysis
// ─────────────────────────────────────────────────────────────────────────────
describe('pullFromVoiceCallAnalysis', () => {
  it('extracts caller_sentiment, follow_up_flag, expansion_signals, pain_point_emphasis from _call_analysis', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'koto_onboarding_recipients')
        return tableStub('koto_onboarding_recipients', [
          {
            id: 'r1',
            answers: {
              _call_analysis: {
                caller_sentiment: 'engaged',
                follow_up_recommended: true,
                upsell_signals: ['wants more services'],
                hot_lead_reasons: ['budget confirmed'],
                notable_insights: ['mentioned emergency four times'],
                call_summary: 'Caller is ready to move forward this week.',
                call_id: 'call_xxx',
                analyzed_at: '2026-04-17T00:00:00Z',
              },
            },
          },
        ])
      return tableStub(table, [])
    })
    const { pullFromVoiceCallAnalysis } = await import('../src/lib/kotoiq/profileIngestInternal')
    const records = await pullFromVoiceCallAnalysis({ clientId: 'abc', agencyId: 'agY' })
    expect(records.caller_sentiment[0].value).toBe('engaged')
    expect(records.caller_sentiment[0].source_type).toBe('voice_call')
    expect(records.caller_sentiment[0].source_ref).toBe('retell_call:call_xxx')
    expect(records.caller_sentiment[0].confidence).toBe(1.0)
    expect(records.follow_up_flag[0].value).toBe('true')
    // Array values stay as arrays (per RESEARCH §3.4 mapping)
    expect(records.expansion_signals[0].value).toEqual(['wants more services'])
    // pain_point_emphasis is appended from BOTH hot_lead_reasons and notable_insights
    expect(records.pain_point_emphasis).toBeDefined()
    expect(records.pain_point_emphasis.length).toBe(2)
    // welcome_statement carries the call_summary
    const welcomeFromVoice = records.welcome_statement?.find((r) => r.source_type === 'voice_call')
    expect(welcomeFromVoice?.value).toBe('Caller is ready to move forward this week.')
  })

  it('skips recipients with no _call_analysis', async () => {
    mockFrom.mockImplementation(() =>
      tableStub('koto_onboarding_recipients', [{ id: 'r1', answers: { products_services: 'PPC' } }]),
    )
    const { pullFromVoiceCallAnalysis } = await import('../src/lib/kotoiq/profileIngestInternal')
    const records = await pullFromVoiceCallAnalysis({ clientId: 'abc', agencyId: 'agY' })
    expect(Object.keys(records)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// VerifiedDataSource compliance — D-04 quintet on every record
// ─────────────────────────────────────────────────────────────────────────────
describe('ProvenanceRecord shape (D-04 compliance)', () => {
  it('every record from pullFromClient has source_type + captured_at + confidence', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients')
        return tableStub('clients', {
          id: 'abc',
          agency_id: 'agY',
          name: 'Unified',
          website: 'https://u.com',
          deleted_at: null,
          updated_at: '2026-04-17T00:00:00Z',
        })
      return tableStub(table, null)
    })
    const { pullFromClient } = await import('../src/lib/kotoiq/profileIngestInternal')
    const { records } = await pullFromClient({ clientId: 'abc', agencyId: 'agY' })
    for (const [field, recs] of Object.entries(records)) {
      for (const r of recs) {
        expect(r.source_type, `${field} missing source_type`).toBeTruthy()
        expect(r.captured_at, `${field} missing captured_at`).toBeTruthy()
        expect(typeof r.confidence, `${field} confidence must be number`).toBe('number')
        expect(r.confidence).toBeGreaterThanOrEqual(0)
        expect(r.confidence).toBeLessThanOrEqual(1)
        // Either source_url or source_ref must be set
        expect(Boolean(r.source_url || r.source_ref), `${field} missing source_url and source_ref`).toBe(true)
      }
    }
  })
})
