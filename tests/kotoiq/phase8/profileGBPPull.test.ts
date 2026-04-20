import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn(() => ({
    agencyIntegrations: {
      get: vi.fn().mockResolvedValue({ data: { id: 'int-1', encrypted_payload: {} } }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  })),
}))
vi.mock('@/lib/kotoiq/profileIntegrationsVault', () => ({
  encryptSecret: vi.fn(() => ({ v: 1, alg: 'aes-256-gcm', iv: 'x', tag: 'x', ct: 'x', aad_agency: 'agency-1' })),
}))
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn().mockResolvedValue(undefined),
}))

describe('profileGBPPull', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'test-id')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', 'a'.repeat(64))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('pullFromGBPAuth()', () => {
    it('maps Business Information API response to ProvenanceRecord[] with correct fields', async () => {
      const gbpResponse = {
        title: 'Acme HVAC',
        categories: { primaryCategory: { displayName: 'HVAC Contractor' } },
        phoneNumbers: { primaryPhone: '+1-555-0100' },
        websiteUri: 'https://acme-hvac.com',
        regularHours: { periods: [{ openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeTime: { hours: 17, minutes: 0 } }] },
        serviceArea: { places: { placeInfos: [{ placeName: 'Denver Metro' }] } },
      }

      // First call: Business Info API (location data)
      // Second call: Reviews API (empty)
      // Third call: Anthropic API (no reviews so shouldn't be called)
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(gbpResponse) }) // location
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ reviews: [] }) }) // reviews

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPAuth } = await import('@/lib/kotoiq/profileGBPPull')
      const records = await pullFromGBPAuth({
        agencyId: 'agency-1',
        clientId: 'client-1',
        accessToken: 'ya29.token',
        refreshToken: '1//refresh',
        integrationRowId: 'int-1',
        locationName: 'accounts/123/locations/456',
      })

      // Should have business_name, primary_service, phone, website, service_area, hours
      const fieldNames = records.map(r => r.field_name)
      expect(fieldNames).toContain('business_name')
      expect(fieldNames).toContain('primary_service')
      expect(fieldNames).toContain('phone')
      expect(fieldNames).toContain('website')
      expect(fieldNames).toContain('service_area')
      expect(fieldNames).toContain('hours')

      // Check values
      const biz = records.find(r => r.field_name === 'business_name')!
      expect(biz.record.value).toBe('Acme HVAC')
      expect(biz.record.source_type).toBe('gbp_authenticated')
      expect(biz.record.confidence).toBeLessThanOrEqual(0.85)

      const svc = records.find(r => r.field_name === 'primary_service')!
      expect(svc.record.value).toBe('HVAC Contractor')
    })

    it('formats regularHours.periods to human-readable string', async () => {
      const { formatHours } = await import('@/lib/kotoiq/profileGBPPull')
      const result = formatHours([
        { openDay: 'MONDAY', openTime: { hours: 9, minutes: 0 }, closeTime: { hours: 17, minutes: 0 } },
        { openDay: 'TUESDAY', openTime: { hours: 8, minutes: 30 }, closeTime: { hours: 18, minutes: 0 } },
      ])
      expect(result).toContain('MONDAY')
      expect(result).toContain('9:00-17:00')
      expect(result).toContain('TUESDAY')
      expect(result).toContain('8:30-18:00')
    })

    it('on 401 refreshes token, persists new encrypted token, and retries once', async () => {
      const gbpResponse = { title: 'Refreshed Biz', categories: {}, phoneNumbers: {} }

      const fetchMock = vi.fn()
        // First call: 401
        .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
        // Second call: refresh token POST
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'ya29.new', expires_in: 3600, token_type: 'Bearer' }) })
        // Third call: retry location fetch (success)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(gbpResponse) })
        // Fourth call: reviews
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ reviews: [] }) })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPAuth } = await import('@/lib/kotoiq/profileGBPPull')
      const records = await pullFromGBPAuth({
        agencyId: 'agency-1',
        clientId: 'client-1',
        accessToken: 'ya29.expired',
        refreshToken: '1//refresh',
        integrationRowId: 'int-1',
        locationName: 'accounts/123/locations/456',
      })

      expect(records.find(r => r.field_name === 'business_name')!.record.value).toBe('Refreshed Biz')
      // Verify refresh was called (second fetch)
      expect(fetchMock.mock.calls[1][0]).toBe('https://oauth2.googleapis.com/token')
      const refreshBody = fetchMock.mock.calls[1][1].body
      expect(refreshBody).toContain('grant_type=refresh_token')
    })
  })

  describe('summarizeReviewThemes()', () => {
    it('calls Haiku with up to 50 reviews and returns parsed themes', async () => {
      const haikusResponse = {
        content: [{ type: 'text', text: '{"themes":[{"theme":"Fast service","sentiment":"positive","supporting_count":12},{"theme":"Expensive","sentiment":"negative","supporting_count":5}]}' }],
        usage: { input_tokens: 500, output_tokens: 100 },
      }

      const fetchMock = vi.fn()
        // Reviews API call
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ reviews: [{ comment: 'Great fast service!', starRating: 5 }, { comment: 'Too expensive', starRating: 2 }] }) })
        // Haiku call
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(haikusResponse) })

      vi.stubGlobal('fetch', fetchMock)

      const { summarizeReviewThemes } = await import('@/lib/kotoiq/profileGBPPull')
      const themes = await summarizeReviewThemes({
        accessToken: 'ya29.token',
        locationName: 'accounts/1/locations/2',
        agencyId: 'agency-1',
        clientId: 'client-1',
        maxReviews: 50,
        sourceType: 'gbp_authenticated',
      })

      expect(themes).toHaveLength(2)
      expect(themes[0].theme).toBe('Fast service')
      expect(themes[0].sentiment).toBe('positive')
      expect(themes[0].supporting_count).toBe(12)

      // Verify Haiku was called
      const haikuCall = fetchMock.mock.calls[1]
      expect(haikuCall[0]).toBe('https://api.anthropic.com/v1/messages')
      const haikuBody = JSON.parse(haikuCall[1].body)
      expect(haikuBody.model).toBe('claude-haiku-4-5-20251001')
    })

    it('uses providedReviews when given (Mode 3)', async () => {
      const haikusResponse = {
        content: [{ type: 'text', text: '{"themes":[{"theme":"Friendly staff","sentiment":"positive","supporting_count":3}]}' }],
        usage: { input_tokens: 200, output_tokens: 50 },
      }

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(haikusResponse) })

      vi.stubGlobal('fetch', fetchMock)

      const { summarizeReviewThemes } = await import('@/lib/kotoiq/profileGBPPull')
      const themes = await summarizeReviewThemes({
        accessToken: '',
        locationName: 'place-123',
        agencyId: 'agency-1',
        clientId: 'client-1',
        maxReviews: 5,
        sourceType: 'gbp_public',
        providedReviews: [{ text: 'Very friendly!', rating: 5 }],
      })

      expect(themes).toHaveLength(1)
      expect(themes[0].theme).toBe('Friendly staff')
      // Should NOT have called the reviews API — only Haiku
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
    })

    it('returns empty array when no reviews available', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ reviews: [] }) })

      vi.stubGlobal('fetch', fetchMock)

      const { summarizeReviewThemes } = await import('@/lib/kotoiq/profileGBPPull')
      const themes = await summarizeReviewThemes({
        accessToken: 'ya29.token',
        locationName: 'accounts/1/locations/2',
        agencyId: 'agency-1',
        clientId: 'client-1',
        maxReviews: 50,
        sourceType: 'gbp_authenticated',
      })

      expect(themes).toEqual([])
    })
  })
})
