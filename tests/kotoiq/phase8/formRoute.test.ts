import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 04 — seed_form_url route action tests.
//
// Covers: auth, validation, cross-agency guard, rate limit, budget gate,
// budget override, provider dispatch, scrape fallback for missing key,
// and not_a_form_url rejection.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({}) })),
}))

const mockVerify = vi.fn()
vi.mock('../../../src/lib/apiAuth', () => ({
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
  markSkipped: vi.fn(),
}
const agencyIntegrations = {
  list: vi.fn(),
  get: vi.fn(),
  getByKind: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  markTested: vi.fn(),
}

const dbFrom = vi.fn()
const dbClient = { from: dbFrom }

vi.mock('../../../src/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn(() => ({
    agencyId: 'agency-1',
    client: dbClient,
    from: dbFrom,
    clientProfile,
    clarifications,
    agencyIntegrations,
  })),
}))

const seedProfileMock = vi.fn().mockResolvedValue({
  profile: { id: 'p1', client_id: 'c1', fields: {} },
  discrepancies: [],
  sourcesAdded: [],
})
vi.mock('../../../src/lib/kotoiq/profileSeeder', () => ({
  seedProfile: (...a: unknown[]) => seedProfileMock(...a),
}))

vi.mock('../../../src/lib/kotoiq/profileGate', () => ({
  computeCompleteness: vi.fn().mockResolvedValue({ completeness_score: 0.9, completeness_reasoning: 'ok', soft_gaps: [] }),
}))
vi.mock('../../../src/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../../src/lib/kotoiq/profileDiscrepancy', () => ({
  detectDiscrepancies: vi.fn().mockReturnValue([]),
}))
vi.mock('../../../src/lib/kotoiq/profileClarifications', () => ({
  recomputeClarifications: vi.fn().mockResolvedValue({ added: 0, retired: 0 }),
  generateClarifications: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../../src/lib/kotoiq/profileChannels', () => ({
  pickClarificationChannel: vi.fn().mockResolvedValue({ channel: 'portal', reason: 'test' }),
  forwardViaSMS: vi.fn().mockResolvedValue({ ok: true }),
  forwardViaEmail: vi.fn().mockResolvedValue({ ok: true }),
  forwardViaPortal: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('../../../src/lib/builder/pipelineOrchestrator', () => ({
  runFullPipeline: vi.fn().mockResolvedValue('run-1'),
}))
vi.mock('../../../src/lib/kotoiq/profileWebsiteCrawl', () => ({
  crawlWebsite: vi.fn().mockResolvedValue({ records: [], pages_crawled: 0, pages_skipped: 0, warnings: [], cost_spent_usd: 0, aborted: false }),
}))
vi.mock('../../../src/lib/kotoiq/profileGBPOAuth', () => ({
  generateConsentUrl: vi.fn(),
}))
vi.mock('../../../src/lib/kotoiq/profileGBPPull', () => ({
  pullFromGBPAuth: vi.fn(),
}))
vi.mock('../../../src/lib/kotoiq/profileGBPPlaces', () => ({
  pullFromGBPPlaces: vi.fn(),
}))
vi.mock('../../../src/lib/kotoiq/profileIntegrationsVault', () => ({
  decryptSecret: vi.fn().mockReturnValue('decrypted-key'),
}))
vi.mock('../../../src/lib/kotoiq/profileUploadSeeder', () => ({
  seedFromUpload: vi.fn().mockResolvedValue({ records: [], kind: 'pdf_text' }),
}))
vi.mock('../../../src/lib/kotoiq/profileUploadStorage', () => ({
  buildUploadPath: vi.fn().mockReturnValue('agency-1/c1/upload-1.pdf'),
  parseUploadPath: vi.fn().mockReturnValue({ agencyId: 'agency-1', clientId: 'c1', uploadId: 'upload-1', ext: 'pdf' }),
}))

const seedFromFormUrlMock = vi.fn()
vi.mock('../../../src/lib/kotoiq/profileFormSeeder', () => ({
  seedFromFormUrl: (...a: unknown[]) => seedFromFormUrlMock(...a),
}))

const checkBudgetMock = vi.fn()
const applyOverrideMock = vi.fn().mockResolvedValue({ logged: true })
const checkRateLimitMock = vi.fn()
vi.mock('../../../src/lib/kotoiq/profileCostBudget', () => ({
  checkBudget: (...a: unknown[]) => checkBudgetMock(...a),
  applyOverride: (...a: unknown[]) => applyOverrideMock(...a),
  checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a),
  __resetRateLimits: vi.fn(),
}))

vi.mock('../../../src/lib/kotoiq/profileCostEstimate', () => ({
  estimateCost: vi.fn().mockReturnValue(0.05),
}))

function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request
}

// Supabase chain mock helper
function mockClientFound() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
  }
  dbFrom.mockReturnValue(chain)
  // Make dbClient.from also return the chain
  dbClient.from = vi.fn().mockReturnValue(chain)
  return chain
}

function mockClientNotFound() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  dbFrom.mockReturnValue(chain)
  dbClient.from = vi.fn().mockReturnValue(chain)
  return chain
}

describe('seed_form_url action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'agency-1', userId: 'user-1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, retry_after_ms: 0 })
    checkBudgetMock.mockResolvedValue({
      allowed: true, warn: false, block: false, scope: null,
      today_spend_client: 0, today_spend_agency: 0,
      projected_client: 0.05, projected_agency: 0.05,
      remaining_client: 5, remaining_agency: 50,
      requires_override: false,
    })
    seedFromFormUrlMock.mockResolvedValue({
      via: 'typeform_api', provider: 'typeform', form_id: 'ABC',
      records: [{ field_name: 'business_name', record: { value: 'Acme', source_type: 'typeform_api', confidence: 0.9, captured_at: '2026-01-01T00:00:00.000Z' } }],
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockVerify.mockResolvedValue({ verified: false, agencyId: null, userId: null })
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed_form_url', client_id: 'c1', url: 'https://x.typeform.com/to/ABC' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 without url body', async () => {
    mockClientFound()
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed_form_url', client_id: 'c1' }) as never)
    const j = await res.json()
    expect(res.status).toBe(400)
    expect(j.error).toBe('not_a_form_url')
  })

  it('returns 400 not_a_form_url for generic URLs', async () => {
    mockClientFound()
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed_form_url', client_id: 'c1', url: 'https://example.com' }) as never)
    const j = await res.json()
    expect(res.status).toBe(400)
    expect(j.error).toBe('not_a_form_url')
  })

  it('returns 404 for cross-agency client_id', async () => {
    mockClientNotFound()
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({ action: 'seed_form_url', client_id: 'other-agency-client', url: 'https://x.typeform.com/to/ABC' }) as never)
    expect(res.status).toBe(404)
  })

  it('calls seedFromFormUrl on valid typeform URL with agency key', async () => {
    mockClientFound()
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({
      action: 'seed_form_url',
      client_id: 'c1',
      url: 'https://myco.typeform.com/to/ABC123',
    }) as never)
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(j.ok).toBe(true)
    expect(j.via).toBe('typeform_api')
    expect(j.extracted).toBe(1)
    expect(seedFromFormUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://myco.typeform.com/to/ABC123',
      agencyId: 'agency-1',
      clientId: 'c1',
    }))
  })

  it('returns 429 when rate limited', async () => {
    mockClientFound()
    checkRateLimitMock.mockReturnValue({ allowed: false, retry_after_ms: 45000 })
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({
      action: 'seed_form_url', client_id: 'c1',
      url: 'https://x.typeform.com/to/ABC',
    }) as never)
    const j = await res.json()
    expect(res.status).toBe(429)
    expect(j.error).toBe('rate_limited')
    expect(j.retry_after_ms).toBe(45000)
  })

  it('returns 402 budget_exceeded when budget blocks and no override', async () => {
    mockClientFound()
    checkBudgetMock.mockResolvedValue({
      allowed: false, warn: true, block: true, scope: 'client',
      today_spend_client: 5, today_spend_agency: 10,
      projected_client: 5.05, projected_agency: 10.05,
      remaining_client: 0, remaining_agency: 40,
      requires_override: true,
    })
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({
      action: 'seed_form_url', client_id: 'c1',
      url: 'https://x.typeform.com/to/ABC',
    }) as never)
    const j = await res.json()
    expect(res.status).toBe(402)
    expect(j.error).toBe('budget_exceeded')
  })

  it('calls applyOverride and proceeds when budget blocks but override=true', async () => {
    mockClientFound()
    checkBudgetMock.mockResolvedValue({
      allowed: false, warn: true, block: true, scope: 'client',
      today_spend_client: 5, today_spend_agency: 10,
      projected_client: 5.05, projected_agency: 10.05,
      remaining_client: 0, remaining_agency: 40,
      requires_override: true,
    })
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    const res = await POST(mkReq({
      action: 'seed_form_url', client_id: 'c1',
      url: 'https://x.typeform.com/to/ABC',
      override: true,
    }) as never)
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(applyOverrideMock).toHaveBeenCalledTimes(1)
    expect(j.ok).toBe(true)
  })

  it('persists extracted records via seedProfile when records returned', async () => {
    mockClientFound()
    const { POST } = await import('../../../src/app/api/kotoiq/profile/route')
    await POST(mkReq({
      action: 'seed_form_url', client_id: 'c1',
      url: 'https://x.typeform.com/to/ABC',
    }) as never)
    expect(seedProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'c1',
      agencyId: 'agency-1',
      externalRecords: expect.any(Array),
    }))
  })
})
