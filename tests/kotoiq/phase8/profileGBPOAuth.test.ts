import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// Stub env vars BEFORE importing module
const ENV_VARS = {
  GOOGLE_OAUTH_CLIENT_ID: 'test-client-id-123',
  GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret-abc',
}

describe('profileGBPOAuth', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', ENV_VARS.GOOGLE_OAUTH_CLIENT_ID)
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', ENV_VARS.GOOGLE_OAUTH_CLIENT_SECRET)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('generateConsentUrl()', () => {
    it('returns URL containing scope=business.manage, access_type=offline, prompt=consent, response_type=code', async () => {
      const { generateConsentUrl } = await import('@/lib/kotoiq/profileGBPOAuth')
      const result = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'agency',
        redirectUri: 'https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback',
        redirectAfter: '/kotoiq/launch',
      })

      expect(result.url).toContain('accounts.google.com/o/oauth2/v2/auth')
      expect(result.url).toContain('scope=' + encodeURIComponent('https://www.googleapis.com/auth/business.manage'))
      expect(result.url).toContain('access_type=offline')
      expect(result.url).toContain('prompt=consent')
      expect(result.url).toContain('response_type=code')
      expect(result.url).toContain('client_id=test-client-id-123')
      expect(result.url).toContain('state=')
    })

    it('returns state + stateCookieValue (HMAC-signed version of state bound to agencyId)', async () => {
      const { generateConsentUrl } = await import('@/lib/kotoiq/profileGBPOAuth')
      const result = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'agency',
        redirectUri: 'https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback',
      })

      expect(result.state).toBeTruthy()
      expect(result.stateCookieValue).toBeTruthy()
      expect(result.state).not.toEqual(result.stateCookieValue)
      // Cookie value should be a base64url HMAC
      expect(result.stateCookieValue).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe('validateState()', () => {
    it('returns true when receivedState + cookieValue + agencyId match', async () => {
      const { generateConsentUrl, validateState } = await import('@/lib/kotoiq/profileGBPOAuth')
      const { state, stateCookieValue } = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'agency',
        redirectUri: 'https://example.com/callback',
      })

      const valid = validateState({ receivedState: state, cookieValue: stateCookieValue, agencyId: 'agency-1' })
      expect(valid).toBe(true)
    })

    it('returns false on mismatched state', async () => {
      const { generateConsentUrl, validateState } = await import('@/lib/kotoiq/profileGBPOAuth')
      const { stateCookieValue } = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'agency',
        redirectUri: 'https://example.com/callback',
      })

      const valid = validateState({ receivedState: 'tampered-state', cookieValue: stateCookieValue, agencyId: 'agency-1' })
      expect(valid).toBe(false)
    })

    it('returns false when agencyId does not match', async () => {
      const { generateConsentUrl, validateState } = await import('@/lib/kotoiq/profileGBPOAuth')
      const { state, stateCookieValue } = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'agency',
        redirectUri: 'https://example.com/callback',
      })

      const valid = validateState({ receivedState: state, cookieValue: stateCookieValue, agencyId: 'agency-DIFFERENT' })
      expect(valid).toBe(false)
    })

    it('returns false when cookieValue is empty', async () => {
      const { validateState } = await import('@/lib/kotoiq/profileGBPOAuth')
      const valid = validateState({ receivedState: 'some-state', cookieValue: '', agencyId: 'agency-1' })
      expect(valid).toBe(false)
    })
  })

  describe('exchangeCode()', () => {
    it('POSTs to oauth2.googleapis.com/token with grant_type=authorization_code', async () => {
      const mockResponse = {
        access_token: 'ya29.access-token',
        refresh_token: '1//refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/business.manage',
      }
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { exchangeCode } = await import('@/lib/kotoiq/profileGBPOAuth')
      const result = await exchangeCode({
        code: 'auth-code-123',
        redirectUri: 'https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback',
      })

      expect(result.access_token).toBe('ya29.access-token')
      expect(result.refresh_token).toBe('1//refresh-token')
      expect(result.expires_in).toBe(3600)

      // Verify the fetch call
      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      )
      const callBody = fetchMock.mock.calls[0][1].body
      expect(callBody).toContain('grant_type=authorization_code')
      expect(callBody).toContain('code=auth-code-123')
      expect(callBody).toContain('client_id=test-client-id-123')
      expect(callBody).toContain('client_secret=test-client-secret-abc')
    })

    it('throws on non-OK response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      }))

      const { exchangeCode } = await import('@/lib/kotoiq/profileGBPOAuth')
      await expect(exchangeCode({ code: 'bad', redirectUri: 'x' }))
        .rejects.toThrow('GOOGLE_TOKEN_EXCHANGE_400')
    })
  })

  describe('refreshAccessToken()', () => {
    it('POSTs with grant_type=refresh_token and returns new access_token', async () => {
      const mockResponse = {
        access_token: 'ya29.new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { refreshAccessToken } = await import('@/lib/kotoiq/profileGBPOAuth')
      const result = await refreshAccessToken('1//my-refresh-token')

      expect(result.access_token).toBe('ya29.new-access-token')
      expect(result.expires_in).toBe(3600)

      const callBody = fetchMock.mock.calls[0][1].body
      expect(callBody).toContain('grant_type=refresh_token')
      expect(callBody).toContain('refresh_token=1%2F%2Fmy-refresh-token')
    })

    it('throws on non-OK response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_token'),
      }))

      const { refreshAccessToken } = await import('@/lib/kotoiq/profileGBPOAuth')
      await expect(refreshAccessToken('bad-token'))
        .rejects.toThrow('GOOGLE_TOKEN_REFRESH_401')
    })
  })

  describe('missing env vars', () => {
    it('throws when GOOGLE_OAUTH_CLIENT_ID is missing', async () => {
      vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '')
      vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'secret')

      const { generateConsentUrl } = await import('@/lib/kotoiq/profileGBPOAuth')
      expect(() => generateConsentUrl({
        agencyId: 'a', mode: 'agency', redirectUri: 'x',
      })).toThrow('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET')
    })
  })

  describe('decodeState()', () => {
    it('decodes a valid state back to its components', async () => {
      const { generateConsentUrl, decodeState } = await import('@/lib/kotoiq/profileGBPOAuth')
      const { state } = generateConsentUrl({
        agencyId: 'agency-1',
        mode: 'client',
        clientId: 'client-99',
        redirectUri: 'https://example.com/callback',
        redirectAfter: '/dashboard',
      })

      const decoded = decodeState(state)
      expect(decoded).not.toBeNull()
      expect(decoded!.agencyId).toBe('agency-1')
      expect(decoded!.mode).toBe('client')
      expect(decoded!.clientId).toBe('client-99')
      expect(decoded!.redirectAfter).toBe('/dashboard')
      expect(decoded!.nonce).toBeTruthy()
      expect(decoded!.issuedAt).toBeGreaterThan(0)
    })

    it('returns null on invalid base64url', async () => {
      const { decodeState } = await import('@/lib/kotoiq/profileGBPOAuth')
      expect(decodeState('!!!invalid!!!')).toBeNull()
    })
  })
})
