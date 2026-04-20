import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Stub server-only before any imports that pull it
vi.mock('server-only', () => ({}))

import {
  encryptSecret,
  decryptSecret,
  testConnection,
  VaultError,
  __resetKek,
  type EncryptedPayload,
} from '@/lib/kotoiq/profileIntegrationsVault'

const TEST_KEK = '0'.repeat(64)

describe('profileIntegrationsVault — encryption', () => {
  beforeEach(() => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', TEST_KEK)
    __resetKek()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    __resetKek()
  })

  it('encrypt → decrypt roundtrip returns original plaintext', () => {
    const plaintext = 'sk-test-abc-123-secret'
    const agencyId = 'agency-uuid-1'
    const encrypted = encryptSecret(plaintext, agencyId)

    expect(encrypted.v).toBe(1)
    expect(encrypted.alg).toBe('aes-256-gcm')
    expect(encrypted.aad_agency).toBe(agencyId)
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.tag).toBeTruthy()
    expect(encrypted.ct).toBeTruthy()

    const decrypted = decryptSecret(encrypted, agencyId)
    expect(decrypted).toBe(plaintext)
  })

  it('cross-agency decrypt throws DECRYPT_AAD_MISMATCH', () => {
    const encrypted = encryptSecret('secret-key', 'agency-uuid-1')
    expect(() => decryptSecret(encrypted, 'agency-uuid-2')).toThrow(VaultError)
    try {
      decryptSecret(encrypted, 'agency-uuid-2')
    } catch (err: any) {
      expect(err.code).toBe('DECRYPT_AAD_MISMATCH')
    }
  })

  it('tampered ciphertext causes DECRYPT_AUTH_FAIL', () => {
    const encrypted = encryptSecret('my-secret', 'agency-1')
    // Flip one character in ct
    const chars = encrypted.ct.split('')
    chars[0] = chars[0] === 'A' ? 'B' : 'A'
    const tampered: EncryptedPayload = { ...encrypted, ct: chars.join('') }
    expect(() => decryptSecret(tampered, 'agency-1')).toThrow(VaultError)
    try {
      decryptSecret(tampered, 'agency-1')
    } catch (err: any) {
      expect(err.code).toBe('DECRYPT_AUTH_FAIL')
    }
  })

  it('missing KEK env throws at encrypt time', () => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', '')
    __resetKek()
    expect(() => encryptSecret('test', 'a1')).toThrow(/Missing env/)
  })

  it('malformed KEK (not 32 bytes) throws', () => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', 'abcdef')
    __resetKek()
    expect(() => encryptSecret('test', 'a1')).toThrow(/must decode to 32 bytes/)
  })

  it('unsupported payload format throws DECRYPT_FORMAT', () => {
    const bad = { v: 2, alg: 'aes-256-gcm', iv: '', tag: '', ct: '', aad_agency: 'x' } as any
    expect(() => decryptSecret(bad, 'x')).toThrow(VaultError)
    try {
      decryptSecret(bad, 'x')
    } catch (err: any) {
      expect(err.code).toBe('DECRYPT_FORMAT')
    }
  })
})

describe('profileIntegrationsVault — testConnection', () => {
  beforeEach(() => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', TEST_KEK)
    __resetKek()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('typeform 401 returns ok:false with rejection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }))
    const result = await testConnection('typeform', 'fake-token')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Typeform rejected/i)
  })

  it('typeform 200 returns ok:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }))
    const result = await testConnection('typeform', 'valid-token')
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('jotform 200 with responseCode 200 returns ok:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ responseCode: 200 }),
    }))
    const result = await testConnection('jotform', 'valid-key')
    expect(result.ok).toBe(true)
  })

  it('google_forms valid service account JSON returns ok:true', async () => {
    const sa = JSON.stringify({ type: 'service_account', client_email: 'test@proj.iam.gserviceaccount.com' })
    const result = await testConnection('google_forms', sa)
    expect(result.ok).toBe(true)
  })

  it('google_forms invalid JSON returns ok:false', async () => {
    const result = await testConnection('google_forms', 'not-json')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Invalid JSON/)
  })

  it('network error returns ok:false with message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')))
    const result = await testConnection('typeform', 'token')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/ENOTFOUND/)
  })
})
