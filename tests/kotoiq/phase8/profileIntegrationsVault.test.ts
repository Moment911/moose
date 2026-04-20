import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 3 — profileIntegrationsVault unit suite.
//
// Covers the 7 behaviors from 08-03-PLAN.md Task 1:
//   1. encryptSecret returns a v1 AES-256-GCM payload with correct shape.
//   2. decryptSecret roundtrip returns the original plaintext.
//   3. Cross-agency decrypt throws DECRYPT_AAD_MISMATCH (agency-isolation
//      at the crypto layer — T-08-20).
//   4. Tampered ciphertext throws DECRYPT_AUTH_FAIL (GCM auth tag verify).
//   5. Missing KOTO_AGENCY_INTEGRATIONS_KEK env var throws at call time
//      (fail-closed — we lazy-load so tests can swap env per-run).
//   6. testConnection('typeform', …) against a mocked 401 returns ok=false
//      with the expected error message.
//   7. testConnection('typeform', …) against a mocked 200 returns ok=true.
//
// Tests use `vi.stubEnv` + `__resetKek()` so every case starts from a
// deterministic KEK. The KEK is 32 bytes of zeros (64 hex chars) — fine
// for deterministic test vectors; never used in production.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_KEK_HEX = '0'.repeat(64) // 32 bytes of 0x00

describe('profileIntegrationsVault — encryptSecret / decryptSecret', () => {
  beforeEach(async () => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', TEST_KEK_HEX)
    const mod = await import('../../../src/lib/kotoiq/profileIntegrationsVault')
    mod.__resetKek()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encryptSecret returns a v1 jsonb payload with iv/tag/ct as base64 + aad_agency', async () => {
    const { encryptSecret } = await import('../../../src/lib/kotoiq/profileIntegrationsVault')
    const payload = encryptSecret('sk-test-abc', 'agency-uuid-1')

    expect(payload.v).toBe(1)
    expect(payload.alg).toBe('aes-256-gcm')
    expect(typeof payload.iv).toBe('string')
    expect(typeof payload.tag).toBe('string')
    expect(typeof payload.ct).toBe('string')
    expect(payload.aad_agency).toBe('agency-uuid-1')

    // base64 sanity — non-empty + parses back to Buffer
    expect(payload.iv.length).toBeGreaterThan(0)
    expect(payload.tag.length).toBeGreaterThan(0)
    expect(payload.ct.length).toBeGreaterThan(0)
    expect(Buffer.from(payload.iv, 'base64').length).toBe(12) // 96-bit IV
    expect(Buffer.from(payload.tag, 'base64').length).toBe(16) // 128-bit GCM tag
  })

  it('decryptSecret roundtrip returns the exact original plaintext', async () => {
    const { encryptSecret, decryptSecret } = await import(
      '../../../src/lib/kotoiq/profileIntegrationsVault'
    )
    const plaintext = 'sk-test-abc-123-some-long-token-value-with-chars'
    const payload = encryptSecret(plaintext, 'agency-uuid-1')
    const recovered = decryptSecret(payload, 'agency-uuid-1')
    expect(recovered).toBe(plaintext)
  })

  it('decryptSecret throws DECRYPT_AAD_MISMATCH for wrong agency_id', async () => {
    const { encryptSecret, decryptSecret, VaultError } = await import(
      '../../../src/lib/kotoiq/profileIntegrationsVault'
    )
    const payload = encryptSecret('sk-test', 'agency-uuid-1')
    let caught: unknown
    try {
      decryptSecret(payload, 'agency-uuid-2')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(VaultError)
    expect((caught as InstanceType<typeof VaultError>).code).toBe('DECRYPT_AAD_MISMATCH')
  })

  it('decryptSecret throws DECRYPT_AUTH_FAIL when ciphertext is tampered', async () => {
    const { encryptSecret, decryptSecret, VaultError } = await import(
      '../../../src/lib/kotoiq/profileIntegrationsVault'
    )
    const payload = encryptSecret('sk-test-abc', 'agency-uuid-1')
    // Flip one base64 char in ct — 'A' <-> 'B' keeps it valid base64 but
    // corrupts the underlying bytes, which GCM auth will reject.
    const origCt = payload.ct
    const flipChar = origCt[0] === 'A' ? 'B' : 'A'
    const tamperedCt = flipChar + origCt.slice(1)
    const tampered = { ...payload, ct: tamperedCt }

    let caught: unknown
    try {
      decryptSecret(tampered, 'agency-uuid-1')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(VaultError)
    expect((caught as InstanceType<typeof VaultError>).code).toBe('DECRYPT_AUTH_FAIL')
  })

  it('missing KOTO_AGENCY_INTEGRATIONS_KEK throws at call time (fail-closed)', async () => {
    // Reset the cached KEK, then clear the env, then trigger a call that
    // forces a fresh load. Module is lazy-loaded so the missing-env branch
    // runs inside encryptSecret, not at import.
    const mod = await import('../../../src/lib/kotoiq/profileIntegrationsVault')
    mod.__resetKek()
    vi.unstubAllEnvs()
    // Make sure the env is actually absent
    const origKek = process.env.KOTO_AGENCY_INTEGRATIONS_KEK
    delete process.env.KOTO_AGENCY_INTEGRATIONS_KEK
    try {
      expect(() => mod.encryptSecret('x', 'a')).toThrow(/KOTO_AGENCY_INTEGRATIONS_KEK/)
    } finally {
      if (origKek !== undefined) process.env.KOTO_AGENCY_INTEGRATIONS_KEK = origKek
    }
  })
})

describe('profileIntegrationsVault — testConnection', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', TEST_KEK_HEX)
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.unstubAllEnvs()
  })

  it('typeform 401 → ok=false with rejected-key error', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 401 })) as typeof fetch
    const { testConnection } = await import(
      '../../../src/lib/kotoiq/profileIntegrationsVault'
    )
    const r = await testConnection('typeform', 'fake-token')
    expect(r.ok).toBe(false)
    expect(String(r.error || '')).toMatch(/Typeform rejected/i)
  })

  it('typeform 200 → ok=true', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ alias: 'me' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch
    const { testConnection } = await import(
      '../../../src/lib/kotoiq/profileIntegrationsVault'
    )
    const r = await testConnection('typeform', 'valid-token')
    expect(r.ok).toBe(true)
  })
})
