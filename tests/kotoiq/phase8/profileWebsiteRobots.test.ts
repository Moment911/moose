import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock dns for the SSRF guard (imported transitively by fetchRobots)
vi.mock('dns', () => {
  const lookup = vi.fn().mockResolvedValue({ address: '93.184.216.34', family: 4 })
  return { default: { promises: { lookup } }, promises: { lookup } }
})

import { parseRobots, isAllowedForCrawl, fetchRobots, type RobotsRules } from '@/lib/kotoiq/profileWebsiteRobots'

// ── parseRobots ──────────────────────────────────────────────────────────────

describe('parseRobots', () => {
  it('parses Disallow rules for default user-agent', () => {
    const body = `User-agent: *
Disallow: /admin
Disallow: /api`
    const result = parseRobots(body)
    expect(result).toEqual({
      allow_all: false,
      disallowed: ['/admin', '/api'],
      explicit_allows: [],
    })
  })

  it('returns allow_all when Disallow is empty (Allow: /)', () => {
    const body = `User-agent: *
Disallow:
Allow: /`
    const result = parseRobots(body)
    expect(result.allow_all).toBe(true)
    expect(result.disallowed).toEqual([])
    expect(result.explicit_allows).toEqual(['/'])
  })

  it('returns allow_all when no rules are present', () => {
    const body = `# nothing here`
    const result = parseRobots(body)
    expect(result.allow_all).toBe(true)
    expect(result.disallowed).toEqual([])
  })

  it('handles Allow overrides within Disallow groups', () => {
    const body = `User-agent: *
Disallow: /private
Allow: /private/public`
    const result = parseRobots(body)
    expect(result.disallowed).toEqual(['/private'])
    expect(result.explicit_allows).toEqual(['/private/public'])
  })

  it('ignores rules for non-default user agents', () => {
    const body = `User-agent: Googlebot
Disallow: /secret

User-agent: *
Disallow: /admin`
    const result = parseRobots(body)
    expect(result.disallowed).toEqual(['/admin'])
  })

  it('picks up kotobot user-agent rules', () => {
    const body = `User-agent: kotobot
Disallow: /hidden`
    const result = parseRobots(body)
    expect(result.disallowed).toEqual(['/hidden'])
  })

  it('strips inline comments', () => {
    const body = `User-agent: * # default
Disallow: /admin # restricted area`
    const result = parseRobots(body)
    expect(result.disallowed).toEqual(['/admin'])
  })
})

// ── isAllowedForCrawl ────────────────────────────────────────────────────────

describe('isAllowedForCrawl', () => {
  const rules: RobotsRules = {
    allow_all: false,
    disallowed: ['/admin', '/api', '/private'],
    explicit_allows: ['/private/public'],
  }

  describe('strict mode', () => {
    it('returns allowed=false for disallowed path', () => {
      const d = isAllowedForCrawl('https://example.com/admin/dashboard', rules, 'strict')
      expect(d.allowed).toBe(false)
      expect(d.warnings).toHaveLength(1)
      expect(d.warnings[0]).toContain('/admin')
    })

    it('returns allowed=true for non-disallowed path', () => {
      const d = isAllowedForCrawl('https://example.com/about', rules, 'strict')
      expect(d.allowed).toBe(true)
      expect(d.warnings).toHaveLength(0)
    })

    it('respects Allow override for more specific path', () => {
      const d = isAllowedForCrawl('https://example.com/private/public/page', rules, 'strict')
      expect(d.allowed).toBe(true)
    })
  })

  describe('ignore mode', () => {
    it('always returns allowed=true with no warnings', () => {
      const d = isAllowedForCrawl('https://example.com/admin', rules, 'ignore')
      expect(d.allowed).toBe(true)
      expect(d.warnings).toHaveLength(0)
    })
  })

  describe('warn_but_allow mode', () => {
    it('returns allowed=true but with warnings for disallowed path', () => {
      const d = isAllowedForCrawl('https://example.com/api/v1/data', rules, 'warn_but_allow')
      expect(d.allowed).toBe(true)
      expect(d.warnings).toHaveLength(1)
      expect(d.warnings[0]).toContain('/api')
      expect(d.warnings[0]).toContain('proceeding')
    })

    it('returns no warnings for allowed path', () => {
      const d = isAllowedForCrawl('https://example.com/about', rules, 'warn_but_allow')
      expect(d.allowed).toBe(true)
      expect(d.warnings).toHaveLength(0)
    })
  })

  describe('allow_all rules', () => {
    it('returns allowed=true regardless of mode', () => {
      const openRules: RobotsRules = { allow_all: true, disallowed: [], explicit_allows: [] }
      const d = isAllowedForCrawl('https://example.com/anything', openRules, 'strict')
      expect(d.allowed).toBe(true)
      expect(d.warnings).toHaveLength(0)
    })
  })
})

// ── fetchRobots (mocked fetch) ───────────────────────────────────────────────

describe('fetchRobots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns allow_all on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await fetchRobots('https://example.com/')
    expect(result.allow_all).toBe(true)
    vi.unstubAllGlobals()
  })

  it('parses a valid robots.txt response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nDisallow: /secret',
    }))
    const result = await fetchRobots('https://example.com/')
    expect(result.allow_all).toBe(false)
    expect(result.disallowed).toEqual(['/secret'])
    vi.unstubAllGlobals()
  })

  it('returns allow_all on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchRobots('https://example.com/')
    expect(result.allow_all).toBe(true)
    vi.unstubAllGlobals()
  })
})
