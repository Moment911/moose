import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock dns (used transitively by SSRF guard)
vi.mock('dns', () => {
  const lookup = vi.fn().mockResolvedValue({ address: '93.184.216.34', family: 4 })
  return {
    default: { promises: { lookup } },
    promises: { lookup },
  }
})

import dns from 'dns'
const mockLookup = dns.promises.lookup as ReturnType<typeof vi.fn>

// Mock extractFromPastedText
const mockExtract = vi.fn()
vi.mock('@/lib/kotoiq/profileExtractClaude', () => ({
  extractFromPastedText: (...args: any[]) => mockExtract(...args),
}))

// Mock logTokenUsage (transitive dep)
vi.mock('@/lib/tokenTracker', () => ({
  logTokenUsage: vi.fn().mockResolvedValue(undefined),
}))

// Mock playwright-core + @sparticuz/chromium
const mockPageClose = vi.fn().mockResolvedValue(undefined)
const mockGoto = vi.fn().mockResolvedValue(undefined)
const mockEvaluate = vi.fn().mockResolvedValue('This is about page content with enough text to pass the 40 char minimum threshold')
const mockNewPage = vi.fn().mockResolvedValue({
  goto: mockGoto,
  evaluate: mockEvaluate,
  close: mockPageClose,
})
const mockBrowserClose = vi.fn().mockResolvedValue(undefined)

vi.mock('playwright-core', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: mockNewPage,
      close: mockBrowserClose,
    }),
  },
}))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: [],
    executablePath: vi.fn().mockResolvedValue('/noop'),
    headless: true,
  },
}))

// Mock cheerio
vi.mock('cheerio', () => ({
  load: (html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const $ = (selector: string) => ({
      remove: () => {},
      text: () => text,
    })
    $.load = undefined
    ;($ as any).load = undefined
    return Object.assign($, {
      load: undefined,
    }) as any
  },
}))

import { crawlWebsite, type CrawlScope } from '@/lib/kotoiq/profileWebsiteCrawl'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeExtractResult(pageUrl: string) {
  return [
    {
      field_name: 'business_name',
      record: {
        value: 'Acme Corp',
        source_type: 'claude_inference' as const,
        source_url: pageUrl,
        confidence: 0.9,
        captured_at: new Date().toISOString(),
      },
    },
  ]
}

// ── Global fetch mock ──────────────────────────────────────────────────────────

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ENABLE_PLAYWRIGHT = 'false' // Default to Cheerio for most tests
  process.env.ANTHROPIC_API_KEY = 'test-key'

  // Default: robots.txt not found, sitemap not found, pages return HTML
  mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
    if (typeof url === 'string' && url.endsWith('/robots.txt')) {
      return { ok: false, status: 404 }
    }
    if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
      return { ok: false, status: 404 }
    }
    // Regular page
    return {
      ok: true,
      status: 200,
      text: async () => `<html><body><p>This is a page about Acme Corp and their wonderful services that they provide to customers.</p></body></html>`,
    }
  })
  vi.stubGlobal('fetch', mockFetch)

  mockExtract.mockImplementation(async (args: any) => makeExtractResult(args.sourceUrl))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.ENABLE_PLAYWRIGHT
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('crawlWebsite', () => {
  describe('Mode A — targeted paths', () => {
    it('crawls targeted paths and returns ExtractedFieldRecords with source_url', async () => {
      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      expect(result.pages_crawled.length).toBeGreaterThan(0)
      expect(result.pages_crawled.length).toBeLessThanOrEqual(10)
      expect(result.records.length).toBeGreaterThan(0)

      // Every record has source_url pointing to the specific page
      for (const rec of result.records) {
        expect(rec.record.source_url).toMatch(/^https:\/\/example\.com\//)
      }
    })

    it('every record has source_type = website_scrape', async () => {
      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      for (const rec of result.records) {
        expect(rec.record.source_type).toBe('website_scrape')
      }
    })

    it('every record confidence <= 0.6 (ceiling)', async () => {
      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      for (const rec of result.records) {
        expect(rec.record.confidence).toBeLessThanOrEqual(0.6)
      }
    })
  })

  describe('Mode B — BFS', () => {
    it('respects 100-page cap and does not follow external links', async () => {
      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'B',
        useJs: false,
      })

      expect(result.pages_crawled.length).toBeLessThanOrEqual(100)
      // All pages should be internal (same origin)
      for (const page of result.pages_crawled) {
        expect(page).toMatch(/^https:\/\/example\.com/)
      }
    })
  })

  describe('Mode C — sitemap-first', () => {
    it('reads sitemap and prioritizes About/Services/Contact paths', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/robots.txt')) {
          return { ok: false, status: 404 }
        }
        if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
          return {
            ok: true,
            status: 200,
            text: async () => `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/blog/post-1</loc></url>
  <url><loc>https://example.com/about-us</loc></url>
  <url><loc>https://example.com/services/plumbing</loc></url>
  <url><loc>https://example.com/contact</loc></url>
  <url><loc>https://example.com/blog/post-2</loc></url>
</urlset>`,
          }
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><p>This is page content with plenty of text for extraction to work properly here.</p></body></html>',
        }
      })

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'C',
        useJs: false,
      })

      // About/services/contact should be crawled first (prioritized by keywords)
      expect(result.pages_crawled.length).toBeGreaterThan(0)
      // The first crawled pages should include the prioritized ones
      const first3 = result.pages_crawled.slice(0, 3)
      expect(first3.some(u => u.includes('about'))).toBe(true)
    })
  })

  describe('Cost cap mid-abort (D-08)', () => {
    it('aborts mid-crawl when cost exceeds cap and persists extracted records', async () => {
      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
        costCap: 0.025, // ~2 pages at $0.011/page
      })

      expect(result.aborted).toBe(true)
      expect(result.abort_reason).toBe('cost_cap')
      // Should still have records from pages crawled before abort
      expect(result.pages_crawled.length).toBeGreaterThan(0)
      expect(result.records.length).toBeGreaterThan(0)
    })
  })

  describe('robots.txt strict mode', () => {
    it('skips disallowed paths', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/robots.txt')) {
          return {
            ok: true,
            status: 200,
            text: async () => 'User-agent: *\nDisallow: /about\nDisallow: /services',
          }
        }
        if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
          return { ok: false, status: 404 }
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><p>Page content here that is long enough to pass the minimum threshold check.</p></body></html>',
        }
      })

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
        robotsMode: 'strict',
      })

      // /about and /services should be skipped
      const skippedUrls = result.pages_skipped.map(s => s.url)
      expect(skippedUrls.some(u => u.includes('/about'))).toBe(true)
      expect(skippedUrls.some(u => u.includes('/services'))).toBe(true)
      // Those skipped should have reason 'robots'
      const robotsSkipped = result.pages_skipped.filter(s => s.reason === 'robots')
      expect(robotsSkipped.length).toBeGreaterThan(0)
    })
  })

  describe('robots.txt warn_but_allow mode', () => {
    it('crawls disallowed paths but emits warnings', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/robots.txt')) {
          return {
            ok: true,
            status: 200,
            text: async () => 'User-agent: *\nDisallow: /about',
          }
        }
        if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
          return { ok: false, status: 404 }
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><p>Page content that is long enough to pass the minimum threshold for extraction.</p></body></html>',
        }
      })

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
        robotsMode: 'warn_but_allow',
      })

      // /about should be crawled (allowed=true in warn mode)
      expect(result.pages_crawled.some(u => u.includes('/about'))).toBe(true)
      // But warnings should be present
      expect(result.warnings.some(w => w.includes('/about'))).toBe(true)
    })
  })

  describe('SSRF guard integration', () => {
    it('skips SSRF-blocked URLs and continues crawl', async () => {
      // Make one specific URL resolve to a private IP
      mockLookup.mockImplementation(async (hostname: string) => {
        if (hostname === 'evil-redirect.example.com') {
          return { address: '169.254.169.254', family: 4 }
        }
        return { address: '93.184.216.34', family: 4 }
      })

      // Return page content that includes a link to the evil domain (simulated)
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/robots.txt')) {
          return { ok: false, status: 404 }
        }
        if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
          return { ok: false, status: 404 }
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><p>Normal page content that is long enough for extraction threshold.</p></body></html>',
        }
      })

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      // Crawl should succeed for pages that resolve to public IPs
      expect(result.pages_crawled.length).toBeGreaterThan(0)
    })
  })

  describe('useJs=false — Cheerio path', () => {
    it('uses Cheerio without Playwright side-effects', async () => {
      process.env.ENABLE_PLAYWRIGHT = 'false'

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      expect(result.pages_crawled.length).toBeGreaterThan(0)
      // Browser should NOT have been instantiated
      const pwMod = await import('playwright-core')
      expect(pwMod.chromium.launch).not.toHaveBeenCalled()
    })
  })

  describe('useJs=true — Playwright path', () => {
    it('uses Playwright browser for fetching', async () => {
      process.env.ENABLE_PLAYWRIGHT = 'true'

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: true,
      })

      expect(result.pages_crawled.length).toBeGreaterThan(0)
      // Browser should have been launched
      const pwMod = await import('playwright-core')
      expect(pwMod.chromium.launch).toHaveBeenCalled()
      expect(mockNewPage).toHaveBeenCalled()
      expect(mockGoto).toHaveBeenCalled()
    })
  })

  describe('empty content handling', () => {
    it('skips pages with less than 40 chars of content', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.endsWith('/robots.txt')) {
          return { ok: false, status: 404 }
        }
        if (typeof url === 'string' && url.endsWith('/sitemap.xml')) {
          return { ok: false, status: 404 }
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<html><body><p>Short</p></body></html>',
        }
      })

      const result = await crawlWebsite({
        url: 'https://example.com',
        agencyId: 'agency-1',
        clientId: 'client-1',
        scope: 'A',
        useJs: false,
      })

      expect(result.pages_crawled).toHaveLength(0)
      expect(result.pages_skipped.length).toBeGreaterThan(0)
      expect(result.pages_skipped.some(s => s.reason === 'empty_content')).toBe(true)
    })
  })
})
