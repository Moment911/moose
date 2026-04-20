import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Stub server-only before any imports
vi.mock('server-only', () => ({}))

// Mock verifySession
const mockVerifySession = vi.fn()
vi.mock('@/lib/apiAuth', () => ({
  verifySession: (...args: any[]) => mockVerifySession(...args),
}))

// Mock getKotoIQDb
const mockList = vi.fn()
const mockGet = vi.fn()
const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockMarkTested = vi.fn()

vi.mock('@/lib/kotoiqDb', () => ({
  getKotoIQDb: () => ({
    agencyIntegrations: {
      list: mockList,
      get: mockGet,
      upsert: mockUpsert,
      delete: mockDelete,
      markTested: mockMarkTested,
    },
  }),
}))

// Mock vault — encryptSecret, decryptSecret, testConnection
const mockEncrypt = vi.fn()
const mockDecrypt = vi.fn()
const mockTestConnection = vi.fn()

vi.mock('@/lib/kotoiq/profileIntegrationsVault', () => ({
  encryptSecret: (...args: any[]) => mockEncrypt(...args),
  decryptSecret: (...args: any[]) => mockDecrypt(...args),
  testConnection: (...args: any[]) => mockTestConnection(...args),
  VaultError: class VaultError extends Error {
    constructor(public code: string, msg: string) { super(msg); this.name = 'VaultError' }
  },
}))

import { POST } from '@/app/api/kotoiq/integrations/route'
import { NextRequest } from 'next/server'

function makeReq(body: any): NextRequest {
  return new NextRequest('http://localhost/api/kotoiq/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/kotoiq/integrations route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 when session is not verified', async () => {
    mockVerifySession.mockResolvedValue({ verified: false, agencyId: null })
    const res = await POST(makeReq({ action: 'list_agency_integrations' }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('unauthenticated')
  })

  it('returns 400 for unknown action', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    const res = await POST(makeReq({ action: 'hack_the_planet' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('unknown_action')
  })

  it('list_agency_integrations returns integrations without encrypted_payload', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockList.mockResolvedValue({
      data: [
        {
          id: 'int-1',
          integration_kind: 'typeform',
          scope_client_id: null,
          label: 'My Typeform',
          last_tested_at: '2026-01-01',
          last_tested_ok: true,
          last_test_error: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          encrypted_payload: { v: 1, ct: 'SHOULD_NOT_APPEAR' },
        },
      ],
    })
    const res = await POST(makeReq({ action: 'list_agency_integrations' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.integrations).toHaveLength(1)
    expect(data.integrations[0].id).toBe('int-1')
    expect(data.integrations[0].encrypted_payload).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain('SHOULD_NOT_APPEAR')
  })

  it('save_agency_integration encrypts and upserts', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockEncrypt.mockReturnValue({ v: 1, alg: 'aes-256-gcm', ct: 'x', iv: 'y', tag: 'z', aad_agency: 'A1' })
    mockUpsert.mockResolvedValue({ data: { id: 'new-id' } })

    const res = await POST(makeReq({
      action: 'save_agency_integration',
      kind: 'typeform',
      plaintext: 'sk-test-token',
      label: 'Primary',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.id).toBe('new-id')
    expect(mockEncrypt).toHaveBeenCalledWith('sk-test-token', 'A1')
  })

  it('save_agency_integration rejects unsupported kind', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    const res = await POST(makeReq({
      action: 'save_agency_integration',
      kind: 'unknown_vendor',
      plaintext: 'token',
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('unsupported_kind')
  })

  it('test_agency_integration decrypts + tests + marks result', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockGet.mockResolvedValue({
      data: {
        id: 'int-1',
        integration_kind: 'typeform',
        encrypted_payload: { v: 1, ct: 'enc' },
      },
    })
    mockDecrypt.mockReturnValue('my-plaintext-token')
    mockTestConnection.mockResolvedValue({ ok: true })

    const res = await POST(makeReq({ action: 'test_agency_integration', id: 'int-1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockDecrypt).toHaveBeenCalledWith({ v: 1, ct: 'enc' }, 'A1')
    expect(mockTestConnection).toHaveBeenCalledWith('typeform', 'my-plaintext-token')
    expect(mockMarkTested).toHaveBeenCalledWith('int-1', true, null)
  })

  it('test_agency_integration returns 404 for non-existent (cross-agency) id', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockGet.mockResolvedValue({ data: null })
    const res = await POST(makeReq({ action: 'test_agency_integration', id: 'other-agency-id' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('not_found')
  })

  it('delete_agency_integration returns ok:true', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockGet.mockResolvedValue({ data: { id: 'int-1' } })
    mockDelete.mockResolvedValue({})
    const res = await POST(makeReq({ action: 'delete_agency_integration', id: 'int-1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('delete_agency_integration returns 404 for cross-agency id', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockGet.mockResolvedValue({ data: null })
    const res = await POST(makeReq({ action: 'delete_agency_integration', id: 'foreign-id' }))
    expect(res.status).toBe(404)
  })

  it('get_agency_integration returns metadata without encrypted_payload', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockGet.mockResolvedValue({
      data: {
        id: 'int-1',
        integration_kind: 'jotform',
        scope_client_id: null,
        label: 'Test',
        last_tested_at: null,
        last_tested_ok: null,
        last_test_error: null,
        encrypted_payload: { v: 1, ct: 'SECRET' },
      },
    })
    const res = await POST(makeReq({ action: 'get_agency_integration', id: 'int-1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('int-1')
    expect(data.encrypted_payload).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain('SECRET')
  })

  it('body.agency_id is ignored — always uses session agencyId', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, agencyId: 'A1', userId: 'U1' })
    mockEncrypt.mockReturnValue({ v: 1, ct: 'x' })
    mockUpsert.mockResolvedValue({ data: { id: 'id-1' } })

    // Body has a different agency_id — should be ignored
    const res = await POST(makeReq({
      action: 'save_agency_integration',
      kind: 'typeform',
      plaintext: 'token',
      agency_id: 'EVIL-AGENCY',
    }))
    expect(res.status).toBe(200)
    // encryptSecret must have been called with session agencyId, not body's
    expect(mockEncrypt).toHaveBeenCalledWith('token', 'A1')
  })
})
