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

const refuseIfInternalIpMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../src/lib/kotoiq/profileWebsiteSSRFGuard', () => ({
  refuseIfInternalIp: (...a: unknown[]) => refuseIfInternalIpMock(...a),
}))

// Mock playwright-core
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue('Extracted form text here'),
}
const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
}
vi.mock('playwright-core', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: vi.fn().mockResolvedValue('/usr/bin/chromium'),
    headless: true,
  },
}))

// Mock cheerio
vi.mock('cheerio', () => ({
  load: vi.fn().mockImplementation((html: string) => {
    const $ = (sel: string) => {
      if (sel === 'body') {
        return {
          text: () => 'Cheerio extracted text content',
        }
      }
      return { remove: () => {} }
    }
    $ .load = undefined as any
    return $ as any
  }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('scrapeFormUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    extractMock.mockResolvedValue([
      {
        field_name: 'business_name',
        record: {
          value: 'Test Biz',
          source_type: 'claude_inference',
          captured_at: '2026-01-01T00:00:00.000Z',
          confidence: 0.8,
        },
      },
    ])
  })

  it('calls SSRF guard before any fetch', async () => {
    // Using useJs=true (Playwright path)
    const { scrapeFormUrl } = await import('../../../src/lib/kotoiq/profileFormScrape')
    await scrapeFormUrl({
      url: 'https://example.com/form',
      agencyId: 'a1',
      clientId: 'c1',
      useJs: true,
    })

    expect(refuseIfInternalIpMock).toHaveBeenCalledWith('https://example.com/form')
    // SSRF must be called before any other fetch/launch
    expect(refuseIfInternalIpMock.mock.invocationCallOrder[0])
      .toBeLessThan(mockBrowser.newPage.mock.invocationCallOrder[0] ?? Infinity)
  })

  it('Playwright path: launches browser, extracts text, returns records with source_type=form_scrape + confidence clamped to 0.7', async () => {
    const { scrapeFormUrl } = await import('../../../src/lib/kotoiq/profileFormScrape')
    const result = await scrapeFormUrl({
      url: 'https://example.com/form',
      agencyId: 'a1',
      clientId: 'c1',
      useJs: true,
    })

    expect(mockBrowser.newPage).toHaveBeenCalled()
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/form', { waitUntil: 'networkidle', timeout: 15_000 })
    expect(mockBrowser.close).toHaveBeenCalled()

    expect(result).toHaveLength(1)
    expect(result[0].record.source_type).toBe('form_scrape')
    expect(result[0].record.confidence).toBe(0.7) // clamped from 0.8
  })

  it('Cheerio path: fetches HTML, extracts text, clamps confidence to 0.7', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => '<html><body><p>Form content</p></body></html>',
    })

    const { scrapeFormUrl } = await import('../../../src/lib/kotoiq/profileFormScrape')
    const result = await scrapeFormUrl({
      url: 'https://example.com/form',
      agencyId: 'a1',
      clientId: 'c1',
      useJs: false,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/form', { redirect: 'manual' })
    expect(result).toHaveLength(1)
    expect(result[0].record.source_type).toBe('form_scrape')
    expect(result[0].record.confidence).toBe(0.7)
  })

  it('rejects internal IPs via SSRF guard', async () => {
    refuseIfInternalIpMock.mockRejectedValueOnce(
      Object.assign(new Error('SSRF blocked'), { code: 'SSRF_BLOCKED' })
    )

    const { scrapeFormUrl } = await import('../../../src/lib/kotoiq/profileFormScrape')
    await expect(
      scrapeFormUrl({ url: 'http://127.0.0.1/form', agencyId: 'a', clientId: 'c' })
    ).rejects.toThrow('SSRF blocked')
  })
})
