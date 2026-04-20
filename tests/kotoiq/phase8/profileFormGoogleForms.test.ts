import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: () => ({}) })),
}))

const extractMock = vi.fn()
vi.mock('../../../src/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: (...a: unknown[]) => extractMock(...a),
}))

vi.mock('../../../src/lib/kotoiq/profileConfig', async () => {
  const actual = await vi.importActual<any>('../../../src/lib/kotoiq/profileConfig')
  return actual
})

const agencyIntegrationsGet = vi.fn()
const agencyIntegrationsUpsert = vi.fn()
vi.mock('../../../src/lib/kotoiqDb', () => ({
  getKotoIQDb: vi.fn(() => ({
    agencyId: 'a1',
    agencyIntegrations: {
      get: (...a: unknown[]) => agencyIntegrationsGet(...a),
      upsert: (...a: unknown[]) => agencyIntegrationsUpsert(...a),
    },
  })),
}))

const encryptSecretMock = vi.fn().mockReturnValue({ v: 1, alg: 'aes-256-gcm', iv: '', tag: '', ct: '', aad_agency: 'a1' })
vi.mock('../../../src/lib/kotoiq/profileIntegrationsVault', () => ({
  encryptSecret: (...a: unknown[]) => encryptSecretMock(...a),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Set env vars needed by refreshGoogleToken
process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'

describe('pullFromGoogleForms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('on 401, refreshes token once, persists new access_token, retries', async () => {
    let fetchCallCount = 0
    fetchMock.mockImplementation(async (url: string) => {
      fetchCallCount++
      // First call: Google Forms API returns 401
      if (url.includes('forms.googleapis.com') && fetchCallCount === 1) {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      // Second call: OAuth token refresh
      if (url.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true, status: 200,
          json: async () => ({ access_token: 'new-token-xyz', expires_in: 3600 }),
        }
      }
      // Third call: Google Forms API retry with new token — success
      if (url.includes('forms.googleapis.com')) {
        return {
          ok: true, status: 200,
          json: async () => ({
            responses: [
              {
                answers: {
                  'q1': { textAnswers: { answers: [{ value: 'Acme Corp' }] } },
                },
              },
            ],
          }),
        }
      }
      return { ok: false, status: 500 }
    })

    agencyIntegrationsGet.mockResolvedValue({
      id: 'int-row-1',
      integration_kind: 'google_forms',
      encrypted_payload: {},
    })
    agencyIntegrationsUpsert.mockResolvedValue({ error: null })

    extractMock.mockResolvedValueOnce([
      {
        field_name: 'business_name',
        record: {
          value: 'Acme Corp',
          source_type: 'claude_inference',
          captured_at: '2026-01-01T00:00:00.000Z',
          confidence: 0.88,
        },
      },
    ])

    const { pullFromGoogleForms } = await import('../../../src/lib/kotoiq/profileFormGoogleForms')
    const result = await pullFromGoogleForms({
      formId: 'FORM_123',
      accessToken: 'old-token',
      refreshToken: 'refresh-tok',
      integrationRowId: 'int-row-1',
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://docs.google.com/forms/d/e/FORM_123/viewform',
    })

    // Verify refresh was called
    const refreshCall = fetchMock.mock.calls.find((c: any) => c[0].includes('oauth2.googleapis.com'))
    expect(refreshCall).toBeTruthy()

    // Verify encrypted_payload was upserted exactly once with new token
    expect(agencyIntegrationsUpsert).toHaveBeenCalledTimes(1)
    expect(encryptSecretMock).toHaveBeenCalledTimes(1)
    const encryptedJson = JSON.parse(encryptSecretMock.mock.calls[0][0])
    expect(encryptedJson.access_token).toBe('new-token-xyz')

    // Verify final result
    expect(result).toHaveLength(1)
    expect(result[0].record.source_type).toBe('google_forms_api')
    expect(result[0].record.confidence).toBe(0.88) // under 0.9 ceiling, stays
  })

  it('succeeds on first try (no refresh needed)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        responses: [
          {
            answers: {
              'q1': { textAnswers: { answers: [{ value: 'Test Co' }] } },
            },
          },
        ],
      }),
    })

    extractMock.mockResolvedValueOnce([
      {
        field_name: 'business_name',
        record: { value: 'Test Co', source_type: 'claude_inference', captured_at: '2026-01-01T00:00:00.000Z', confidence: 0.95 },
      },
    ])

    const { pullFromGoogleForms } = await import('../../../src/lib/kotoiq/profileFormGoogleForms')
    const result = await pullFromGoogleForms({
      formId: 'F1', accessToken: 'good-token', refreshToken: 'rt',
      integrationRowId: 'row1', agencyId: 'a1', clientId: 'c1',
      sourceUrl: 'https://docs.google.com/forms/d/e/F1/viewform',
    })

    // No refresh call
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(agencyIntegrationsUpsert).not.toHaveBeenCalled()
    expect(result[0].record.confidence).toBe(0.9) // clamped from 0.95
  })
})
