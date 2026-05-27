import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// seoPort.test — verifies the dashboard-side SEO port issues the correct
// shim verb sequences and applies the KotoIQ-wins fallback chain to readSeoMeta.
//
// Mocks: shimRpc (for postGetMetaBulk + metaUpdate + querySelect) AND wpFetch
// (for scoreSeoForPost + listSeoCandidates which use WP core REST).
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

vi.mock('../wpFetch', async () => {
    const actual = await vi.importActual<typeof import('../wpFetch')>('../wpFetch')
    return {
        ...actual,
        wpFetch: vi.fn(),
        wpFetchJson: vi.fn(),
    }
})

import { shimRpc } from '../shimRpc'
import { wpFetchJson } from '../wpFetch'
import {
    KOTOIQ_SEO_META_KEYS,
    COMPANION_SEO_KEYS,
    readSeoMeta,
    writeSeoMeta,
    scoreSeoForPost,
    listSeoCandidates,
    listSeoForPostType,
} from './seoPort'

const SITE = 'https://wp.example.com'
const CREDS = { username: 'koto_service', appPassword: 'abcd efgh ijkl mnop qrst uvwx' }

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
    ;(wpFetchJson as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('seoPort — meta key constants', () => {
    it('exports the 7 canonical KotoIQ SEO meta keys', () => {
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_title')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_description')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_focus_keyword')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_canonical')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_robots')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_schema_type')
        expect(KOTOIQ_SEO_META_KEYS).toContain('_kotoiq_schema_custom')
        expect(KOTOIQ_SEO_META_KEYS).toHaveLength(7)
    })

    it('exports the 6 companion SEO keys (3 Yoast + 3 RankMath)', () => {
        expect(COMPANION_SEO_KEYS).toEqual([
            '_yoast_wpseo_title',
            '_yoast_wpseo_metadesc',
            '_yoast_wpseo_focuskw',
            'rank_math_title',
            'rank_math_description',
            'rank_math_focus_keyword',
        ])
    })
})

describe('seoPort — readSeoMeta', () => {
    it('passes verb=post.get_meta_bulk with the 13 keys for the post', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { results: { '7': {} }, errors: [] },
            status: 200,
        })
        await readSeoMeta(SITE, 7)
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('post.get_meta_bulk')
        expect(call[2].posts[0].post_id).toBe(7)
        const keys = call[2].posts[0].keys as string[]
        expect(keys).toContain('_kotoiq_title')
        expect(keys).toContain('_yoast_wpseo_title')
        expect(keys).toContain('rank_math_title')
        expect(keys.length).toBe(13)
    })

    it('returns KotoIQ keys when present, even if Yoast key is also set', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                results: {
                    '7': {
                        _kotoiq_title: 'KotoIQ wins',
                        _yoast_wpseo_title: 'Yoast loses',
                    },
                },
                errors: [],
            },
            status: 200,
        })
        const res = await readSeoMeta(SITE, 7)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data._kotoiq_title).toBe('KotoIQ wins')
        expect(res.data._companion._yoast_wpseo_title).toBe('Yoast loses')
    })

    it('falls back to Yoast when KotoIQ keys are empty', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                results: {
                    '7': {
                        _yoast_wpseo_title: 'Yoast title',
                        _yoast_wpseo_metadesc: 'Yoast desc',
                        _yoast_wpseo_focuskw: 'yoast kw',
                    },
                },
                errors: [],
            },
            status: 200,
        })
        const res = await readSeoMeta(SITE, 7)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        // Fallback chain: KotoIQ empty → Yoast picked up.
        expect(res.data._kotoiq_title).toBe('Yoast title')
        expect(res.data._kotoiq_description).toBe('Yoast desc')
        expect(res.data._kotoiq_focus_keyword).toBe('yoast kw')
    })

    it('falls back to RankMath when both KotoIQ and Yoast keys are empty', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                results: {
                    '7': {
                        rank_math_title: 'RM title',
                        rank_math_description: 'RM desc',
                        rank_math_focus_keyword: 'rm kw',
                    },
                },
                errors: [],
            },
            status: 200,
        })
        const res = await readSeoMeta(SITE, 7)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data._kotoiq_title).toBe('RM title')
        expect(res.data._kotoiq_description).toBe('RM desc')
        expect(res.data._kotoiq_focus_keyword).toBe('rm kw')
    })

    it('surfaces shim error responses unchanged', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            error: { code: 'fetch_failed', message: 'boom' },
            status: 500,
        })
        const res = await readSeoMeta(SITE, 7)
        expect(res.ok).toBe(false)
        if (res.ok) return
        expect(res.error.code).toBe('fetch_failed')
    })
})

describe('seoPort — writeSeoMeta', () => {
    it('writes the 3 cross-engine keys (KotoIQ + Yoast + RankMath) per field', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { applied: 9, errors: [] },
            status: 200,
        })
        await writeSeoMeta(SITE, 7, {
            seo_title: 'Hello',
            meta_description: 'World',
            focus_keyword: 'kw',
        })
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('meta.update')
        const updates = call[2].updates as Array<{ post_id: number; key: string; value: unknown }>
        const keys = updates.map((u) => u.key)
        // KotoIQ-native
        expect(keys).toContain('_kotoiq_title')
        expect(keys).toContain('_kotoiq_description')
        expect(keys).toContain('_kotoiq_focus_keyword')
        // Yoast companion
        expect(keys).toContain('_yoast_wpseo_title')
        expect(keys).toContain('_yoast_wpseo_metadesc')
        expect(keys).toContain('_yoast_wpseo_focuskw')
        // RankMath companion
        expect(keys).toContain('rank_math_title')
        expect(keys).toContain('rank_math_description')
        expect(keys).toContain('rank_math_focus_keyword')
        // 9 keys total for the 3 fields
        expect(updates.length).toBe(9)
    })

    it('skips fields not provided (no _kotoiq_canonical update when canonical omitted)', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { applied: 1, errors: [] },
            status: 200,
        })
        await writeSeoMeta(SITE, 7, { robots: 'noindex,nofollow' })
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        const updates = call[2].updates as Array<{ key: string }>
        expect(updates).toEqual([{ post_id: 7, key: '_kotoiq_robots', value: 'noindex,nofollow' }])
    })

    it('writes the 4 KotoIQ-native-only keys (no companion for canonical/robots/schema)', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { applied: 4, errors: [] },
            status: 200,
        })
        await writeSeoMeta(SITE, 7, {
            canonical: 'https://x.com/y',
            robots: 'index,follow',
            schema_type: 'Article',
            schema_custom: '{"@type":"FAQPage"}',
        })
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        const updates = call[2].updates as Array<{ key: string }>
        expect(updates.length).toBe(4)
        expect(updates.every((u) => u.key.startsWith('_kotoiq_'))).toBe(true)
    })
})

describe('seoPort — scoreSeoForPost', () => {
    it('fetches the post via wpFetch + reads meta via shim + runs analyzeSEO', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                id: 7,
                title: { rendered: 'Best HVAC Services in Houston' },
                content: { rendered: '<p>We are the best HVAC team in Houston, Texas.</p>'.repeat(50) },
                slug: 'best-hvac-houston',
                link: 'https://wp.example.com/best-hvac-houston',
                modified: '2026-05-26T12:00:00',
            },
            status: 200,
        })
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                results: {
                    '7': {
                        _kotoiq_title: 'Best HVAC Services in Houston',
                        _kotoiq_description: 'Top-rated HVAC contractors serving Houston.',
                        _kotoiq_focus_keyword: 'HVAC Houston',
                    },
                },
                errors: [],
            },
            status: 200,
        })
        const res = await scoreSeoForPost(SITE, CREDS, 7)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.analysis.focusKeyword).toBe('HVAC Houston')
        expect(typeof res.data.analysis.score).toBe('number')
        expect(res.data.post.id).toBe(7)
        expect(res.data.post.title).toBe('Best HVAC Services in Houston')
        expect(res.data.meta._kotoiq_focus_keyword).toBe('HVAC Houston')
    })

    it('uses focusKwOverride when supplied', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                id: 7,
                title: { rendered: 'Title' },
                content: { rendered: '<p>Body</p>' },
                slug: 't',
                link: SITE + '/t',
                modified: '2026-05-26T12:00:00',
            },
            status: 200,
        })
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { results: { '7': { _kotoiq_focus_keyword: 'original' } }, errors: [] },
            status: 200,
        })
        const res = await scoreSeoForPost(SITE, CREDS, 7, 'override-kw')
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.analysis.focusKeyword).toBe('override-kw')
    })

    it('surfaces post-fetch failures with code=post_fetch_failed', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            data: null,
            status: 404,
            error: 'Not Found',
        })
        const res = await scoreSeoForPost(SITE, CREDS, 9999)
        expect(res.ok).toBe(false)
        if (res.ok) return
        expect(res.error.code).toBe('post_fetch_failed')
        expect(res.status).toBe(404)
    })
})

describe('seoPort — listSeoCandidates', () => {
    it('calls wp/v2/posts with paging + _fields filter', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 1,
                    title: { rendered: 'Post 1' },
                    slug: 'p1',
                    link: SITE + '/p1',
                    modified: '2026-05-01T00:00:00',
                    status: 'publish',
                },
            ],
            status: 200,
        })
        const res = await listSeoCandidates(SITE, CREDS, { perPage: 10, page: 2 })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.posts).toHaveLength(1)
        expect(res.data.posts[0].title).toBe('Post 1')
        const fetchCall = (wpFetchJson as ReturnType<typeof vi.fn>).mock.calls[0]
        const path = fetchCall[1] as string
        expect(path).toContain('per_page=10')
        expect(path).toContain('page=2')
        expect(path).toContain('_fields=')
    })
})

describe('seoPort — listSeoForPostType', () => {
    it("calls query.select with name='posts.list_by_post_type' + post_type param", async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { rows: [], count: 0 },
            status: 200,
        })
        await listSeoForPostType(SITE, 'page', { limit: 25, offset: 50 })
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('query.select')
        expect(call[2].name).toBe('posts.list_by_post_type')
        expect(call[2].params.post_type).toBe('page')
        expect(call[2].params.limit_max).toBe(25)
        expect(call[2].params.offset).toBe(50)
    })
})
