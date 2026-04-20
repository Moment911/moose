import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 3 — POST /api/kotoiq/integrations route tests.
//
// Integration-style: verifySession + getKotoIQDb are mocked so no Supabase
// is contacted. profileIntegrationsVault is NOT mocked — we drive it with a
// deterministic test KEK so encrypt/decrypt actually run through the
// crypto-layer defenses. Assertions cover the 7 plan behaviors:
//   1. 401 when session not verified
//   2. 400 on unknown action
//   3. list_agency_integrations → strips encrypted_payload
//   4. save_agency_integration → encrypts + upserts + returns {ok,id}
//   5. test_agency_integration → decrypts + testConnection + markTested
//   6. delete_agency_integration → 404 cross-agency (not 403)
//   7. body.agency_id silently ignored; session.agencyId wins
//   8. plaintext never reaches console.log
// ─────────────────────────────────────────────────────────────────────────────

const TEST_KEK_HEX = '0'.repeat(64)

// Disable the server-only guard and stub @supabase/supabase-js (referenced
// transitively via kotoiqDb mock path) so nothing real is called.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({}) })),
}))

const mockVerify = vi.fn()
vi.mock('../../../src/lib/apiAuth', () => ({
  verifySession: (...a: unknown[]) => mockVerify(...a),
}))

const agencyIntegrations = {
  list: vi.fn(),
  get: vi.fn(),
  getByKind: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  markTested: vi.fn(),
}

vi.mock('../../../src/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn((agencyId: string) => ({
    agencyId,
    client: { from: () => ({}) },
    from: () => ({}),
    agencyIntegrations,
  })),
}))

function mkReq(body: Record<string, unknown>): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request
}

function resetAll() {
  mockVerify.mockReset()
  Object.values(agencyIntegrations).forEach((fn) =>
    (fn as ReturnType<typeof vi.fn>).mockReset(),
  )
}

describe('POST /api/kotoiq/integrations', () => {
  beforeEach(() => {
    resetAll()
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', TEST_KEK_HEX)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when session not verified', async () => {
    mockVerify.mockResolvedValue({ verified: false, agencyId: null, userId: null })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(mkReq({ action: 'list_agency_integrations' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 401 when verified but agencyId missing', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: null, userId: 'u' })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(mkReq({ action: 'list_agency_integrations' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 on unknown action', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(mkReq({ action: 'nope' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('unknown_action')
  })

  it('list_agency_integrations never surfaces encrypted_payload in response', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    agencyIntegrations.list.mockResolvedValue([
      {
        id: 'i1',
        integration_kind: 'typeform',
        scope_client_id: null,
        label: 'Main Typeform',
        last_tested_at: '2026-04-20T00:00:00Z',
        last_tested_ok: true,
        last_test_error: null,
        created_at: '2026-04-19T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
        encrypted_payload: { ct: 'SECRET_CIPHERTEXT' },
        payload_version: 1,
      },
    ])
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(mkReq({ action: 'list_agency_integrations' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.integrations).toHaveLength(1)
    expect(body.integrations[0].id).toBe('i1')
    expect(body.integrations[0].integration_kind).toBe('typeform')
    expect(Object.keys(body.integrations[0])).not.toContain('encrypted_payload')
    // Defense in depth — no stringified ciphertext leaked anywhere.
    expect(JSON.stringify(body)).not.toContain('SECRET_CIPHERTEXT')
  })

  it('save_agency_integration encrypts plaintext + upserts + ignores body.agency_id', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    agencyIntegrations.upsert.mockResolvedValue({ data: { id: 'new-row-id' } })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const plaintext = 'sk-super-secret-token-DO-NOT-LEAK'
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({
        action: 'save_agency_integration',
        kind: 'typeform',
        plaintext,
        label: 'Main',
        agency_id: 'ATTACKER-AGENCY', // MUST be ignored
      }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.id).toBe('new-row-id')

    // Verify upsert got encrypted payload (not plaintext), and NO agency_id
    // from caller body leaked into the row passed to the helper.
    expect(agencyIntegrations.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = agencyIntegrations.upsert.mock.calls[0][0]
    expect(upsertArg.integration_kind).toBe('typeform')
    expect(upsertArg.label).toBe('Main')
    expect(upsertArg.encrypted_payload).toBeDefined()
    expect(upsertArg.encrypted_payload.v).toBe(1)
    expect(upsertArg.encrypted_payload.alg).toBe('aes-256-gcm')
    expect(upsertArg.encrypted_payload.aad_agency).toBe('A1') // session, not body
    // Defense in depth: plaintext must not sit anywhere in the row passed through
    expect(JSON.stringify(upsertArg)).not.toContain(plaintext)

    // Plaintext must NEVER reach console.log / console.error
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(plaintext)
    }
    for (const call of errSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(plaintext)
    }
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('save_agency_integration rejects unsupported kind with 400', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({
        action: 'save_agency_integration',
        kind: 'made_up_vendor',
        plaintext: 'x',
      }) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('unsupported_kind')
  })

  it('test_agency_integration decrypts + probes + persists result', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    // Pre-encrypt a known plaintext using the real vault so the route decrypts it.
    const vault = await import('../../../src/lib/kotoiq/profileIntegrationsVault')
    const encrypted_payload = vault.encryptSecret('typeform-valid-token', 'A1')
    agencyIntegrations.get.mockResolvedValue({
      id: 'i1',
      integration_kind: 'typeform',
      encrypted_payload,
    })
    agencyIntegrations.markTested.mockResolvedValue({ data: {} })

    // Mock fetch for typeform probe
    const realFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => new Response('', { status: 200 })) as typeof fetch

    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({ action: 'test_agency_integration', id: 'i1' }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(agencyIntegrations.markTested).toHaveBeenCalledWith('i1', true, null)
    globalThis.fetch = realFetch
  })

  it('delete_agency_integration returns 404 for cross-agency id (not 403)', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    // db.agencyIntegrations.get auto-scopes to agencyId, so a cross-agency id
    // resolves to null → route responds 404 per link-enumeration mitigation.
    agencyIntegrations.get.mockResolvedValue(null)
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({ action: 'delete_agency_integration', id: 'belongs-to-other-agency' }) as never,
    )
    expect(res.status).toBe(404) // NOT 403
    expect(agencyIntegrations.delete).not.toHaveBeenCalled()
  })

  it('delete_agency_integration happy path returns ok:true', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    agencyIntegrations.get.mockResolvedValue({ id: 'i1', integration_kind: 'typeform' })
    agencyIntegrations.delete.mockResolvedValue({ data: {} })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({ action: 'delete_agency_integration', id: 'i1' }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(agencyIntegrations.delete).toHaveBeenCalledWith('i1')
  })

  it('get_agency_integration strips encrypted_payload from response', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    agencyIntegrations.get.mockResolvedValue({
      id: 'i1',
      integration_kind: 'typeform',
      scope_client_id: null,
      label: 'Main',
      last_tested_at: null,
      last_tested_ok: null,
      last_test_error: null,
      encrypted_payload: { ct: 'SECRET_CIPHERTEXT' },
    })
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({ action: 'get_agency_integration', id: 'i1' }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('i1')
    expect(Object.keys(body)).not.toContain('encrypted_payload')
    expect(JSON.stringify(body)).not.toContain('SECRET_CIPHERTEXT')
  })

  it('get_agency_integration cross-agency returns 404', async () => {
    mockVerify.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'u' })
    agencyIntegrations.get.mockResolvedValue(null)
    const { POST } = await import('../../../src/app/api/kotoiq/integrations/route')
    const res = await POST(
      mkReq({ action: 'get_agency_integration', id: 'belongs-to-other-agency' }) as never,
    )
    expect(res.status).toBe(404)
  })
})
