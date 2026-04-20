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

// Global fetch mock
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('pullFromTypeform', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches Typeform responses, concatenates Q&A, calls extractFromPastedText, clamps confidence to 0.9', async () => {
    // Mock Typeform API response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            answers: [
              { field: { ref: 'company_name' }, text: 'Acme Co' },
              { field: { ref: 'service' }, text: 'SEO' },
            ],
          },
        ],
      }),
    })

    // Mock Claude extraction
    extractMock.mockResolvedValueOnce([
      {
        field_name: 'business_name',
        record: {
          value: 'Acme Co',
          source_type: 'claude_inference',
          captured_at: '2026-01-01T00:00:00.000Z',
          confidence: 0.95,
        },
      },
    ])

    const { pullFromTypeform } = await import('../../../src/lib/kotoiq/profileFormTypeform')
    const result = await pullFromTypeform({
      formId: 'ABC123',
      apiKey: 'tf-key-xxx',
      agencyId: 'a1',
      clientId: 'c1',
      sourceUrl: 'https://example.typeform.com/to/ABC123',
    })

    // Verify fetch was called with correct URL + Bearer auth
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.typeform.com/forms/ABC123/responses?page_size=25',
      { headers: { Authorization: 'Bearer tf-key-xxx' } }
    )

    // Verify extractFromPastedText was called with concatenated text
    expect(extractMock).toHaveBeenCalledTimes(1)
    const callArgs = extractMock.mock.calls[0][0]
    expect(callArgs.text).toContain('Q: company_name\nA: Acme Co')
    expect(callArgs.text).toContain('Q: service\nA: SEO')
    expect(callArgs.agencyId).toBe('a1')
    expect(callArgs.clientId).toBe('c1')
    expect(callArgs.sourceUrl).toBe('https://example.typeform.com/to/ABC123')

    // Verify output: source_type overridden, confidence clamped
    expect(result).toHaveLength(1)
    expect(result[0].record.source_type).toBe('typeform_api')
    expect(result[0].record.confidence).toBe(0.9) // clamped from 0.95
  })

  it('throws TYPEFORM_AUTH_FAILED on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    const { pullFromTypeform } = await import('../../../src/lib/kotoiq/profileFormTypeform')
    await expect(
      pullFromTypeform({ formId: 'x', apiKey: 'bad', agencyId: 'a', clientId: 'c', sourceUrl: '' })
    ).rejects.toThrow('TYPEFORM_AUTH_FAILED')
  })

  it('returns empty array when no answers present', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ items: [] }),
    })
    const { pullFromTypeform } = await import('../../../src/lib/kotoiq/profileFormTypeform')
    const result = await pullFromTypeform({
      formId: 'x', apiKey: 'k', agencyId: 'a', clientId: 'c', sourceUrl: '',
    })
    expect(result).toEqual([])
    expect(extractMock).not.toHaveBeenCalled()
  })
})
