import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// baselineSnapshot.test — WS2 day-1 immutable inventory (Phase 11 / Plan 11-02).
//
// Covers the THREE behaviors the plan calls out, all against the PURE helpers so
// no DB/network is required (mirrors pageContentExtractor.extractFromHtml +
// hubBuilder pure-fn style):
//
//   (1) shaping — given fixture ExtractedPage objects, the engine produces
//       correctly-shaped insert rows (url/title/h1/word_count/content_hash/
//       page_type + source_url/fetched_at data-integrity fields).
//   (2) diff — diffAgainstBaseline returns changed:true when hashes differ and
//       changed:false when equal, reading the LATEST baseline row per url.
//   (3) immutability — captureBaseline only ever INSERTs (the DB mock sees no
//       update/delete) and inserts one row per discovered URL.
//
// The DB is mocked via getKotoIQDb; discovery/extract are mocked so we drive
// the engine with deterministic fixtures.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mocks (declared before importing the module under test) ──────────────────

const insertMock = vi.fn().mockResolvedValue({ data: [], error: null })
const updateMock = vi.fn()
const deleteMock = vi.fn()
const fromMock = vi.fn((_table: string) => ({
    insert: (...a: unknown[]) => insertMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
}))

vi.mock('@/lib/kotoiqDb', () => ({
    getKotoIQDb: () => ({ from: (t: string) => fromMock(t) }),
}))

const discoverAllUrlsMock = vi.fn()
vi.mock('@/lib/kotoiq/pageDiscovery', () => ({
    discoverAllUrls: (...a: unknown[]) => discoverAllUrlsMock(...a),
    discoverPages: vi.fn(),
    fetchSitemapUrls: vi.fn(),
}))

const fetchAndExtractMock = vi.fn()
vi.mock('@/lib/kotoiq/pageContentExtractor', () => ({
    fetchAndExtract: (...a: unknown[]) => fetchAndExtractMock(...a),
    inferPageType: (url: string) => {
        try {
            const p = new URL(url).pathname.toLowerCase()
            if (p === '/' || p === '') return 'home'
            if (/services|service/.test(p)) return 'service'
            return 'other'
        } catch { return 'other' }
    },
    urlDomain: (url: string) => {
        try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
    },
}))

import {
    baselineRowFromExtracted,
    diffAgainstBaseline,
    captureBaseline,
    type BaselineRecord,
} from '@/lib/kotoiq/baselineSnapshot'

const extracted = (over: Record<string, unknown> = {}) => ({
    url: 'https://acme.test/services/roofing',
    http_status: 200,
    fetch_ms: 12,
    content_hash: 'hashA',
    h1: 'Roofing Services',
    h2_list: [],
    cta_list: [],
    hero_copy: '',
    body_text: 'we do roofing well across the region for homes and businesses',
    meta_title: 'Roofing | Acme',
    meta_description: '',
    schema_orgs: [],
    word_count: 11,
    raw_html_length: 100,
    ...over,
})

beforeEach(() => {
    insertMock.mockClear()
    updateMock.mockClear()
    deleteMock.mockClear()
    fromMock.mockClear()
    discoverAllUrlsMock.mockReset()
    fetchAndExtractMock.mockReset()
    insertMock.mockResolvedValue({ data: [], error: null })
})
afterEach(() => { vi.restoreAllMocks() })

describe('baselineRowFromExtracted (pure shaping)', () => {
    it('maps an ExtractedPage to a correctly-shaped insert row', () => {
        const row = baselineRowFromExtracted({
            agencyId: 'ag1',
            clientId: 'cl1',
            siteId: 'si1',
            extracted: extracted() as never,
            capturedAt: '2026-06-08T00:00:00.000Z',
        })
        expect(row.agency_id).toBe('ag1')
        expect(row.client_id).toBe('cl1')
        expect(row.site_id).toBe('si1')
        expect(row.url).toBe('https://acme.test/services/roofing')
        expect(row.title).toBe('Roofing | Acme')
        expect(row.h1).toBe('Roofing Services')
        expect(row.word_count).toBe(11)
        expect(row.content_hash).toBe('hashA')
        expect(row.page_type).toBe('service')
        // data-integrity: every captured fact carries source_url + fetched_at
        expect(row.source_url).toBe('https://acme.test/services/roofing')
        expect(typeof row.fetched_at).toBe('string')
        expect(row.captured_at).toBe('2026-06-08T00:00:00.000Z')
    })
})

describe('diffAgainstBaseline (pure compare)', () => {
    const base: BaselineRecord[] = [
        { url: 'https://acme.test/a', content_hash: 'old', captured_at: '2026-01-01T00:00:00Z' },
        { url: 'https://acme.test/a', content_hash: 'older', captured_at: '2025-06-01T00:00:00Z' },
    ]

    it('returns changed:true when the current hash differs from the latest baseline row', () => {
        const r = diffAgainstBaseline({ url: 'https://acme.test/a', currentHash: 'new', baselineRows: base })
        expect(r.changed).toBe(true)
        // compares against the LATEST row, not the older one
        expect(r.baseline_hash).toBe('old')
        expect(r.captured_at).toBe('2026-01-01T00:00:00Z')
    })

    it('returns changed:false when the current hash equals the latest baseline row', () => {
        const r = diffAgainstBaseline({ url: 'https://acme.test/a', currentHash: 'old', baselineRows: base })
        expect(r.changed).toBe(false)
        expect(r.baseline_hash).toBe('old')
    })

    it('treats a url with no baseline as changed (new page, no baseline_hash)', () => {
        const r = diffAgainstBaseline({ url: 'https://acme.test/never-seen', currentHash: 'x', baselineRows: base })
        expect(r.changed).toBe(true)
        expect(r.baseline_hash).toBeNull()
    })
})

describe('captureBaseline (immutable insert-only)', () => {
    beforeEach(() => {
        discoverAllUrlsMock.mockResolvedValue({
            urls: [
                'https://acme.test/',
                'https://acme.test/services/roofing',
            ],
            sitemap_url: 'https://acme.test/sitemap.xml',
        })
        fetchAndExtractMock.mockImplementation((url: string) =>
            Promise.resolve(extracted({ url, content_hash: `hash:${url}` })))
    })

    it('inserts one row per discovered URL and never updates or deletes', async () => {
        const res = await captureBaseline({
            agencyId: 'ag1', clientId: 'cl1', siteId: 'si1', siteUrl: 'https://acme.test',
        })

        expect(res.captured).toBe(2)
        expect(fromMock).toHaveBeenCalledWith('kotoiq_site_baseline')
        // immutability: ONLY inserts — no update / delete ever issued
        expect(insertMock).toHaveBeenCalled()
        expect(updateMock).not.toHaveBeenCalled()
        expect(deleteMock).not.toHaveBeenCalled()

        // all inserted rows together cover exactly the two discovered urls
        const insertedUrls = insertMock.mock.calls
            .flatMap(c => (Array.isArray(c[0]) ? c[0] : [c[0]]))
            .map((r: { url: string }) => r.url)
            .sort()
        expect(insertedUrls).toEqual([
            'https://acme.test/',
            'https://acme.test/services/roofing',
        ])
    })

    it('shares one captured_at across the whole snapshot (immutable dated batch)', async () => {
        await captureBaseline({ agencyId: 'ag1', clientId: 'cl1', siteId: 'si1', siteUrl: 'https://acme.test' })
        const capturedAts = new Set(
            insertMock.mock.calls
                .flatMap(c => (Array.isArray(c[0]) ? c[0] : [c[0]]))
                .map((r: { captured_at: string }) => r.captured_at),
        )
        expect(capturedAts.size).toBe(1)
    })
})
