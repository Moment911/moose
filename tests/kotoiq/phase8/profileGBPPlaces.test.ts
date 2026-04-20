import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn().mockResolvedValue(undefined),
}))

describe('profileGBPPlaces', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key-xyz')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'test-id')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('pullFromGBPPlaces()', () => {
    it('maps Places API response to ProvenanceRecord[] with source_type=gbp_public and confidence <= 0.75', async () => {
      const placesResponse = {
        displayName: { text: 'Acme Plumbing' },
        primaryType: 'plumber',
        nationalPhoneNumber: '(555) 123-4567',
        websiteUri: 'https://acme-plumbing.com',
        formattedAddress: '123 Main St, Denver, CO 80202',
        reviews: [],
      }

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(placesResponse) })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      const records = await pullFromGBPPlaces({
        placeId: 'ChIJ12345',
        agencyId: 'agency-1',
        clientId: 'client-1',
      })

      const fieldNames = records.map(r => r.field_name)
      expect(fieldNames).toContain('business_name')
      expect(fieldNames).toContain('primary_service')
      expect(fieldNames).toContain('phone')
      expect(fieldNames).toContain('website')
      expect(fieldNames).toContain('city')

      const biz = records.find(r => r.field_name === 'business_name')!
      expect(biz.record.value).toBe('Acme Plumbing')
      expect(biz.record.source_type).toBe('gbp_public')
      expect(biz.record.confidence).toBeLessThanOrEqual(0.75)

      const phone = records.find(r => r.field_name === 'phone')!
      expect(phone.record.value).toBe('(555) 123-4567')
    })

    it('request headers include X-Goog-FieldMask AND X-Goog-Api-Key', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ displayName: { text: 'Test' } }) })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      await pullFromGBPPlaces({ placeId: 'ChIJ999', agencyId: 'a-1', clientId: 'c-1' })

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['X-Goog-Api-Key']).toBe('test-places-key-xyz')
      expect(headers['X-Goog-FieldMask']).toBeTruthy()
      expect(headers['X-Goog-FieldMask']).toContain('displayName')
      expect(headers['X-Goog-FieldMask']).toContain('websiteUri')
      expect(headers['X-Goog-FieldMask']).toContain('reviews')
    })

    it('throws helpful error on 400 (malformed FieldMask)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Invalid field mask: badField'),
        })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      await expect(pullFromGBPPlaces({ placeId: 'ChIJ000', agencyId: 'a-1', clientId: 'c-1' }))
        .rejects.toThrow('PLACES_BAD_FIELDMASK')
    })

    it('throws on other non-OK status codes', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve('forbidden') })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      await expect(pullFromGBPPlaces({ placeId: 'ChIJ000', agencyId: 'a-1', clientId: 'c-1' }))
        .rejects.toThrow('PLACES_HTTP_403')
    })

    it('throws when GOOGLE_PLACES_API_KEY is missing', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', '')

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      await expect(pullFromGBPPlaces({ placeId: 'ChIJ000', agencyId: 'a-1', clientId: 'c-1' }))
        .rejects.toThrow('GOOGLE_PLACES_API_KEY missing')
    })

    it('extracts review themes via Haiku when reviews are present', async () => {
      const placesResponse = {
        displayName: { text: 'Coffee Shop' },
        primaryType: 'cafe',
        reviews: [
          { text: { text: 'Amazing espresso!' }, rating: 5 },
          { text: { text: 'Cozy atmosphere' }, rating: 4 },
        ],
      }

      const haikusResponse = {
        content: [{ type: 'text', text: '{"themes":[{"theme":"Quality coffee","sentiment":"positive","supporting_count":2}]}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(placesResponse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(haikusResponse) })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      const records = await pullFromGBPPlaces({ placeId: 'ChIJ-cafe', agencyId: 'a-1', clientId: 'c-1' })

      const themeRecords = records.filter(r => r.field_name === 'pain_point_emphasis')
      expect(themeRecords).toHaveLength(1)
      expect(themeRecords[0].record.value).toBe('Quality coffee')
      expect(themeRecords[0].record.source_type).toBe('gbp_public')
      expect(themeRecords[0].record.confidence).toBeLessThanOrEqual(0.75)
    })

    it('uses correct Places API endpoint URL', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ displayName: { text: 'X' } }) })

      vi.stubGlobal('fetch', fetchMock)

      const { pullFromGBPPlaces } = await import('@/lib/kotoiq/profileGBPPlaces')
      await pullFromGBPPlaces({ placeId: 'ChIJtest', agencyId: 'a-1', clientId: 'c-1' })

      expect(fetchMock.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/ChIJtest')
    })
  })
})
