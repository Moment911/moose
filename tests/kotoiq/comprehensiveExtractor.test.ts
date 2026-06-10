import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// comprehensiveExtractor.test — WS1 four-category extraction (Phase 12 / Plan 12-01).
//
// One unified Haiku pass over the client's OWN baseline pages produces four
// categories — keywords / phrases / services / offerings — each flagged
// ai_inferred (data-integrity: the user verifies AI output before it drives
// builds). When ANTHROPIC_API_KEY is absent/unfunded, each category falls back
// to a pure heuristic; the extractor returns {ok:false, reason:'ai_unavailable'}
// WITHOUT throwing and WITHOUT a silent catch.
//
// Tests (all on the pure helpers or a mocked Claude — no network):
//   (1) keywords/phrases/offerings heuristics return non-empty deduped arrays
//       from a fixture pages[].
//   (2) extractComprehensive returns {ok:false, reason:'ai_unavailable'} when
//       ANTHROPIC_API_KEY is unset AND still returns all four heuristic
//       categories (never throws).
//   (3) safeParse handles a fenced ```json block and a bare object; garbage
//       falls back to heuristics.
//   (4) on the Haiku path, logTokenUsage is called exactly once with the
//       comprehensive-extraction feature.
// ─────────────────────────────────────────────────────────────────────────────

const logTokenUsageMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/tokenTracker', () => ({
    logTokenUsage: (...a: unknown[]) => logTokenUsageMock(...a),
}))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = { create: (...a: unknown[]) => createMock(...a) }
    },
}))

import {
    extractComprehensive,
    keywordsFromHeuristic,
    phrasesFromHeuristic,
    offeringsFromHeuristic,
    safeParseComprehensive,
    type ExtractorPageInput,
} from '@/lib/kotoiq/comprehensiveExtractor'

const page = (over: Partial<ExtractorPageInput> = {}): ExtractorPageInput => ({
    url: 'https://acme.test/services/roof-repair',
    h1: 'Emergency Roof Repair',
    meta_title: 'Roof Repair Services | Acme Roofing',
    meta_description: 'Fast emergency roof repair and storm damage restoration in Denver.',
    h2_list: ['Storm Damage Restoration', 'Free Roof Inspection', 'Insurance Claim Help'],
    hero_copy: 'We provide fast emergency roof repair and storm damage restoration across Denver.',
    cta_list: ['Get a Free Estimate', 'Book a Roof Inspection'],
    page_type: 'service',
    word_count: 320,
    ...over,
})

const fixturePages = (): ExtractorPageInput[] => [
    page({ url: 'https://acme.test/services/roof-repair', h1: 'Emergency Roof Repair' }),
    page({
        url: 'https://acme.test/services/gutter-cleaning',
        h1: 'Gutter Cleaning',
        meta_title: 'Gutter Cleaning | Acme Roofing',
        meta_description: 'Professional gutter cleaning services in Denver Colorado.',
        h2_list: ['Seamless Gutter Installation', 'Gutter Guard Systems'],
        hero_copy: 'Keep your gutters flowing with professional gutter cleaning and installation.',
        cta_list: ['Schedule Gutter Cleaning'],
    }),
    page({
        url: 'https://acme.test/',
        h1: 'Denver Roofing Experts',
        meta_title: 'Acme Roofing | Denver Roofing Contractor',
        meta_description: 'Trusted Denver roofing contractor for repair, replacement, and installation.',
        h2_list: ['Residential Roofing', 'Commercial Roofing', 'Roof Replacement'],
        hero_copy: 'Acme Roofing is the trusted Denver roofing contractor for repair and replacement.',
        cta_list: ['Request a Quote'],
        page_type: 'home',
    }),
]

beforeEach(() => {
    logTokenUsageMock.mockClear()
    createMock.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
})
afterEach(() => { vi.restoreAllMocks() })

describe('keywordsFromHeuristic (pure)', () => {
    it('returns a non-empty deduped, lowercased, stopword-stripped list', () => {
        const out = keywordsFromHeuristic(fixturePages())
        expect(out.length).toBeGreaterThan(0)
        // deduped
        expect(out.length).toBe(new Set(out).size)
        // lowercased
        expect(out.every(k => k === k.toLowerCase())).toBe(true)
        // common stopwords stripped
        expect(out).not.toContain('the')
        expect(out).not.toContain('and')
        // a real token survives
        expect(out).toContain('roofing')
    })
})

describe('phrasesFromHeuristic (pure)', () => {
    it('returns non-empty deduped multi-word n-grams from h2/hero', () => {
        const out = phrasesFromHeuristic(fixturePages())
        expect(out.length).toBeGreaterThan(0)
        expect(out.length).toBe(new Set(out).size)
        // n-grams are multi-word
        expect(out.every(p => p.split(' ').length >= 2)).toBe(true)
        expect(out.some(p => p.includes('storm damage'))).toBe(true)
    })
})

describe('offeringsFromHeuristic (pure)', () => {
    it('returns non-empty deduped offering candidates from cta/h2', () => {
        const out = offeringsFromHeuristic(fixturePages())
        expect(out.length).toBeGreaterThan(0)
        expect(out.length).toBe(new Set(out).size)
    })
})

describe('safeParseComprehensive (pure)', () => {
    it('parses a fenced ```json block', () => {
        const raw = '```json\n{"keywords":["roofing"],"phrases":["roof repair"],"services":["Roof Repair"],"offerings":["Free Inspection"]}\n```'
        const out = safeParseComprehensive(raw)
        expect(out).not.toBeNull()
        expect(out!.keywords).toEqual(['roofing'])
        expect(out!.services).toEqual(['Roof Repair'])
    })
    it('parses a bare object', () => {
        const raw = 'sure, here you go {"keywords":["a"],"phrases":["b c"],"services":["D"],"offerings":["E"]} done'
        const out = safeParseComprehensive(raw)
        expect(out).not.toBeNull()
        expect(out!.phrases).toEqual(['b c'])
    })
    it('rejects garbage → null', () => {
        expect(safeParseComprehensive('not json at all')).toBeNull()
        expect(safeParseComprehensive('{"keywords": "not-an-array"}')).toBeNull()
    })
})

describe('extractComprehensive — graceful degrade (no key)', () => {
    it('returns {ok:false, reason:ai_unavailable} + all four heuristic categories, never throws', async () => {
        delete process.env.ANTHROPIC_API_KEY
        const res = await extractComprehensive({ agencyId: 'ag1', clientId: 'cl1', pages: fixturePages() })
        expect(res.ok).toBe(false)
        expect(res.reason).toBe('ai_unavailable')
        // all four categories present + non-empty (heuristic fill)
        expect(res.keywords.length).toBeGreaterThan(0)
        expect(res.phrases.length).toBeGreaterThan(0)
        expect(res.services.length).toBeGreaterThan(0)
        expect(res.offerings.length).toBeGreaterThan(0)
        // every item carries ai_inferred provenance shape
        for (const cat of [res.keywords, res.phrases, res.services, res.offerings]) {
            for (const item of cat) {
                expect(item.source_type).toBe('ai_inferred')
                expect(typeof item.value).toBe('string')
                expect(typeof item.confidence).toBe('number')
                expect(typeof item.captured_at).toBe('string')
            }
        }
        // graceful: no Claude call attempted
        expect(createMock).not.toHaveBeenCalled()
        expect(logTokenUsageMock).not.toHaveBeenCalled()
    })

    it('returns empty categories (ok:false) without throwing when given no pages and no key', async () => {
        delete process.env.ANTHROPIC_API_KEY
        const res = await extractComprehensive({ agencyId: 'ag1', clientId: 'cl1', pages: [] })
        expect(res.ok).toBe(false)
        expect(res.reason).toBe('ai_unavailable')
        expect(res.keywords).toEqual([])
        expect(res.services).toEqual([])
    })
})

describe('extractComprehensive — Haiku path', () => {
    it('logs token usage exactly once with the comprehensive-extraction feature', async () => {
        createMock.mockResolvedValue({
            content: [{ type: 'text', text: '```json\n{"keywords":["roofing","denver"],"phrases":["roof repair","storm damage"],"services":["Roof Repair","Gutter Cleaning"],"offerings":["Free Roof Inspection"]}\n```' }],
            usage: { input_tokens: 200, output_tokens: 60 },
        })
        const res = await extractComprehensive({ agencyId: 'ag1', clientId: 'cl1', pages: fixturePages() })
        expect(createMock).toHaveBeenCalledTimes(1)
        expect(logTokenUsageMock).toHaveBeenCalledTimes(1)
        const arg = logTokenUsageMock.mock.calls[0][0] as { feature: string; model: string }
        expect(arg.feature).toBe('kotoiq_comprehensive_extraction')
        expect(arg.model).toBe('claude-haiku-4-5-20251001')
        expect(res.ok).toBe(true)
        expect(res.ai_available).toBe(true)
        expect(res.services.map(s => s.value)).toContain('Roof Repair')
        expect(res.keywords.map(k => k.value)).toContain('roofing')
    })

    it('falls back to heuristics per category when Haiku returns garbage', async () => {
        createMock.mockResolvedValue({
            content: [{ type: 'text', text: 'I cannot help with that.' }],
            usage: { input_tokens: 10, output_tokens: 5 },
        })
        const res = await extractComprehensive({ agencyId: 'ag1', clientId: 'cl1', pages: fixturePages() })
        // still logs the one call
        expect(logTokenUsageMock).toHaveBeenCalledTimes(1)
        // ok true (Claude reachable) but categories filled from heuristics
        expect(res.ok).toBe(true)
        expect(res.keywords.length).toBeGreaterThan(0)
        expect(res.services.length).toBeGreaterThan(0)
    })
})
