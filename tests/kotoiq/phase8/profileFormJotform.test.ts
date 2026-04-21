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

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('pullFromJotform', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses APIKEY header (not querystring), concatenates submissions, returns ExtractedFieldRecord[]', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        responseCode: 200,
        content: [
          {
            answers: {
              '1': { text: 'What services do you need?', answer: 'SEO' },
              '2': { text: 'Company name', answer: 'Acme Inc' },
            },
          },
        ],
      }),
    })

    extractMock.mockResolvedValueOnce([
      {
        field_name: 'primary_service',
        record: {
          value: 'SEO',
          source_type: 'claude_inference',
          captured_at: '2026-01-01T00:00:00.000Z',
          confidence: 0.92,
        },
      },
    ])

    const { pullFromJotform } = await import('../../../src/lib/kotoiq/profileFormJotform')
    const result = await pullFromJotform({
      formId: '251234567890',
      apiKey: 'jf-key-secret',
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://form.jotform.com/251234567890',
    })

    // Verify APIKEY header is used
    const fetchCall = fetchMock.mock.calls[0]
    expect(fetchCall[1].headers.APIKEY).toBe('jf-key-secret')
    // Verify no Authorization header
    expect(fetchCall[1].headers.Authorization).toBeUndefined()
    // Verify URL does NOT contain apiKey in querystring
    expect(fetchCall[0]).not.toContain('apiKey=')
    expect(fetchCall[0]).not.toContain('APIKEY=')

    expect(result).toHaveLength(1)
    expect(result[0].record.source_type).toBe('jotform_api')
    expect(result[0].record.confidence).toBe(0.9) // clamped from 0.92
  })

  it('throws JOTFORM_AUTH_FAILED on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    const { pullFromJotform } = await import('../../../src/lib/kotoiq/profileFormJotform')
    await expect(
      pullFromJotform({ formId: 'x', apiKey: 'bad', agencyId: 'a', clientId: 'c', sourceUrl: '' })
    ).rejects.toThrow('JOTFORM_AUTH_FAILED')
  })

  it('throws on non-200 responseCode in body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ responseCode: 401, content: [] }),
    })
    const { pullFromJotform } = await import('../../../src/lib/kotoiq/profileFormJotform')
    await expect(
      pullFromJotform({ formId: 'x', apiKey: 'k', agencyId: 'a', clientId: 'c', sourceUrl: '' })
    ).rejects.toThrow('JOTFORM_RESPONSE_401')
  })
})
