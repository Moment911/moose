import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 6 — POST /api/kotoiq/profile route tests.
//
// Integration-style: every lib module the route composes is mocked
// (kotoiqDb, profileSeeder, profileGate, profileExtractClaude,
// profileDiscrepancy, profileClarifications, profileChannels,
// pipelineOrchestrator). No Anthropic, no Supabase, no Telnyx, no Resend
// is contacted. The tests verify:
//   - session enforcement (401 when not verified)
//   - cross-agency clientId returns 404 (not 403 — RESEARCH §15 T-07
//     link enumeration mitigation)
//   - oversized pasted_text returns 413 (T-07-07b DoS guard)
//   - SMS rate-limit error from forwardViaSMS bubbles as 429
//   - launch always fires runFullPipeline + markLaunched (D-15
//     non-blocking launch — even when completeness < threshold)
//   - answer_clarification calls BOTH markAnswered AND updateField
//     when the clarification has target_field_path (PROF-05 answer flow)
//   - unknown action → 400 with allowed_actions list
//   - agencyId is read from session, never from body (T-07-01d)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({}) })),
}))

const mockVerify = vi.fn()
vi.mock('../src/lib/apiAuth', () => ({
  verifySession: (...a: unknown[]) => mockVerify(...a),
}))

const clientProfile = {
  get: vi.fn(),
  upsert: vi.fn(),
  updateField: vi.fn(),
  addField: vi.fn(),
  deleteField: vi.fn(),
  list: vi.fn(),
  markLaunched: vi.fn(),
}
const clarifications = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  markAnswered: vi.fn(),
  markForwarded: vi.fn(),
  update: vi.fn(),
}
const dbFrom = vi.fn()
const dbClient = { from: dbFrom }

vi.mock('../src/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn(() => ({
    agencyId: 'a',
    client: dbClient,
    from: dbFrom,
    clientProfile,
    clarifications,
  })),
}))

const seedProfileMock = vi.fn().mockResolvedValue({
  profile: { id: 'p1', client_id: 'c', fields: {} },
  discrepancies: [],
  sourcesAdded: [],
})
vi.mock('../src/lib/kotoiq/profileSeeder', () => ({
  seedProfile: (...a: unknown[]) => seedProfileMock(...a),
}))

const computeCompletenessMock = vi.fn().mockResolvedValue({
  completeness_score: 0.94,
  completeness_reasoning: 'ok',
  soft_gaps: [],
})
vi.mock('../src/lib/kotoiq/profileGate', () => ({
  computeCompleteness: (...a: unknown[]) => computeCompletenessMock(...a),
}))

const extractFromPastedTextMock = vi.fn().mockResolvedValue([])
vi.mock('../src/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: (...a: unknown[]) => extractFromPastedTextMock(...a),
}))

const detectDiscrepanciesMock = vi.fn().mockReturnValue([])
vi.mock('../src/lib/kotoiq/profileDiscrepancy', () => ({
  detectDiscrepancies: (...a: unknown[]) => detectDiscrepanciesMock(...a),
}))

const recomputeClarificationsMock = vi.fn().mockResolvedValue({ added: 0, retired: 0 })
vi.mock('../src/lib/kotoiq/profileClarifications', () => ({
  generateClarifications: vi.fn().mockResolvedValue([]),
  recomputeClarifications: (...a: unknown[]) => recomputeClarificationsMock(...a),
}))

const pickClarificationChannelMock = vi.fn().mockResolvedValue({ channel: 'sms', reason: 'short' })
const forwardViaSMSMock = vi.fn().mockResolvedValue({ ok: true })
const forwardViaEmailMock = vi.fn().mockResolvedValue({ ok: true })
const forwardViaPortalMock = vi.fn().mockResolvedValue({ ok: true })
vi.mock('../src/lib/kotoiq/profileChannels', () => ({
  pickClarificationChannel: (...a: unknown[]) => pickClarificationChannelMock(...a),
  forwardViaSMS: (...a: unknown[]) => forwardViaSMSMock(...a),
  forwardViaEmail: (...a: unknown[]) => forwardViaEmailMock(...a),
  forwardViaPortal: (...a: unknown[]) => forwardViaPortalMock(...a),
}))

const runFullPipelineMock = vi.fn().mockResolvedValue('run-123')
vi.mock('../src/lib/builder/pipelineOrchestrator', () => ({
  runFullPipeline: (...a: unknown[]) => runFullPipelineMock(...a),
}))

function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request
}

function resetAll() {
  mockVerify.mockReset()
  Object.values(clientProfile).forEach(fn => (fn as ReturnType<typeof vi.fn>).mockReset())
  Object.values(clarifications).forEach(fn => (fn as ReturnType<typeof vi.fn>).mockReset())
  dbFrom.mockReset()
  seedProfileMock.mockClear()
  computeCompletenessMock.mockClear()
  extractFromPastedTextMock.mockClear()
  detectDiscrepanciesMock.mockClear()
  recomputeClarificationsMock.mockClear()
  pickClarificationChannelMock.mockClear()
  forwardViaSMSMock.mockClear().mockResolvedValue({ ok: true })
  forwardViaEmailMock.mockClear().mockResolvedValue({ ok: true })
  forwardViaPortalMock.mockClear().mockResolvedValue({ ok: true })
  runFullPipelineMock.mockClear().mockResolvedValue('run-123')
  // Defaults
  computeCompletenessMock.mockResolvedValue({
    completeness_score: 0.94,
    completeness_reasoning: 'ok',
    soft_gaps: [],
  })
  seedProfileMock.mockResolvedValue({
    profile: { id: 'p1', client_id: 'c', fields: {} },
    discrepancies: [],
    sourcesAdded: [],
  })
}

describe('POST /api/kotoiq/profile', () => {
  beforeEach(resetAll)

  it('returns 401 when session not verified', async () => {
    mockVerify.mockResolvedValue({ verified: false, agencyId: null, userId: null })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed', client_id: 'c' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 401 when verified but agencyId missing', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: null, userId: 'u' })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed', client_id: 'c' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 on unknown action with allowed_actions list', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'wtf' }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.allowed_actions).toContain('seed')
    expect(json.allowed_actions).toContain('launch')
    expect(json.allowed_actions).toContain('answer_clarification')
  })

  it('seed returns 404 when client row missing (cross-agency guard — RESEARCH §15 T-07)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        }),
      }),
    })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({ action: 'seed', client_id: '00000000-0000-0000-0000-000000000000' }) as never,
    )
    expect(res.status).toBe(404)
  })

  it('seed rejects oversized pasted_text with 413 (T-07-07b)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({ action: 'seed', client_id: 'c', pasted_text: 'x'.repeat(50001) }) as never,
    )
    expect(res.status).toBe(413)
  })

  it('seed succeeds and forwards body fields to seedProfile (agencyId from session, NOT body)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'session-agency', userId: 'u' })
    dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({ maybeSingle: async () => ({ data: { id: 'c' } }) }),
          }),
        }),
      }),
    })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({
        action: 'seed',
        client_id: 'c',
        agency_id: 'attacker-agency', // attempt spoof — must be ignored
        pasted_text: 'short',
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(seedProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c', agencyId: 'session-agency' }),
    )
  })

  it('launch fires runFullPipeline + markLaunched even when completeness low (D-15 non-blocking)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    clientProfile.get.mockResolvedValue({ data: { id: 'p1', client_id: 'c' } })
    clientProfile.upsert.mockResolvedValue({ data: {} })
    clientProfile.markLaunched.mockResolvedValue({ data: {} })
    computeCompletenessMock.mockResolvedValue({
      completeness_score: 0.4, // below typical 0.7 threshold
      completeness_reasoning: 'partial',
      soft_gaps: [{ field: 'service_area', reason: 'unknown' }],
    })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({ action: 'launch', client_id: 'c', target_keywords: ['kw'] }) as never,
    )
    const json = await res.json()
    expect(json.run_id).toBe('run-123')
    expect(runFullPipelineMock).toHaveBeenCalled()
    expect(clientProfile.markLaunched).toHaveBeenCalledWith('p1', 'run-123')
  })

  it('forward_to_client returns 429 when SMS forwarder reports rate limit', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    clarifications.get.mockResolvedValue({
      data: { id: 'x', client_id: 'c', question: 'q' },
    })
    dbFrom.mockImplementation((t: string) =>
      t === 'clients'
        ? {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'c', name: 'Acme', email: 'a@b.co', phone: '+15551234567' },
                    }),
                  }),
                }),
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { name: 'Agency' } }) }),
            }),
          },
    )
    forwardViaSMSMock.mockResolvedValue({
      ok: false,
      error: 'SMS rate limit exceeded (3/hour)',
    })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({ action: 'forward_to_client', clarification_id: 'x', channel: 'sms' }) as never,
    )
    expect(res.status).toBe(429)
  })

  it('answer_clarification calls markAnswered AND updateField when target_field_path set (PROF-05)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'op-1' })
    clarifications.get.mockResolvedValue({
      data: { id: 'x', client_id: 'c', target_field_path: 'service_area' },
    })
    clarifications.markAnswered.mockResolvedValue({ data: {} })
    clientProfile.get.mockResolvedValue({ data: { id: 'p1', client_id: 'c' } })
    clientProfile.updateField.mockResolvedValue({ data: {} })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({
        action: 'answer_clarification',
        clarification_id: 'x',
        answer_text: 'South Florida',
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(clarifications.markAnswered).toHaveBeenCalledWith(
      'x',
      'South Florida',
      'op-1',
    )
    expect(clientProfile.updateField).toHaveBeenCalledWith(
      'p1',
      'service_area',
      expect.objectContaining({ source_type: 'operator_edit', confidence: 1.0 }),
    )
  })

  it('answer_clarification skips updateField when update_field=false', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'op-1' })
    clarifications.get.mockResolvedValue({
      data: { id: 'x', client_id: 'c', target_field_path: 'service_area' },
    })
    clarifications.markAnswered.mockResolvedValue({ data: {} })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    await POST(
      mkReq({
        action: 'answer_clarification',
        clarification_id: 'x',
        answer_text: 'South Florida',
        update_field: false,
      }) as never,
    )
    expect(clarifications.markAnswered).toHaveBeenCalled()
    expect(clientProfile.updateField).not.toHaveBeenCalled()
  })

  it('add_question rejects ≥2000 char question', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    clientProfile.get.mockResolvedValue({ data: { id: 'p1' } })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({
        action: 'add_question',
        client_id: 'c',
        question: 'x'.repeat(2001),
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('add_field rejects canonical field names (D-05 — use update_field instead)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({
        action: 'add_field',
        client_id: 'c',
        field_name: 'business_name',
        value: 'Acme',
      }) as never,
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/canonical/i)
  })

  it('list_profile returns the helper output', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    clientProfile.list.mockResolvedValue({
      data: [{ id: 'p1', client_id: 'c1' }, { id: 'p2', client_id: 'c2' }],
    })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'list_profile' }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profiles).toHaveLength(2)
  })

  it('paste_text without commit returns extracted records without seeding', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'u' })
    extractFromPastedTextMock.mockResolvedValue([
      {
        field_name: 'service_area',
        record: {
          value: 'South Florida',
          source_type: 'claude_inference',
          captured_at: '2026-04-19',
          confidence: 0.85,
        },
      },
    ])
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({ action: 'paste_text', client_id: 'c', pasted_text: 'we serve south florida' }) as never,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.extracted).toHaveLength(1)
    expect(seedProfileMock).not.toHaveBeenCalled()
  })

  it('add_source appends a source record and upserts profile', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'a', userId: 'op-1' })
    clientProfile.get.mockResolvedValue({
      data: { id: 'p1', client_id: 'c', sources: [{ source_type: 'voice_call' }] },
    })
    clientProfile.upsert.mockResolvedValue({ data: {} })
    const { POST } = await import('../src/app/api/kotoiq/profile/route')
    const res = await POST(
      mkReq({
        action: 'add_source',
        client_id: 'c',
        source_type: 'uploaded_doc',
        source_url: 'https://example.com/file.pdf',
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(clientProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'c',
        agency_id: 'a',
        sources: expect.arrayContaining([
          expect.objectContaining({ source_type: 'uploaded_doc', added_by: 'op-1' }),
        ]),
      }),
    )
  })
})
