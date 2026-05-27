import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// sitemapPort.test — verifies the dashboard-side sitemap composer:
//   - composeSitemap returns the correct sub-sitemaps based on content
//   - pushSitemap calls fileWrite for each composed file with the canonical
//     wp-content/uploads/kotoiq/ paths
//   - refreshSitemap inserts a koto_wp_push_history audit row
//   - refreshAllSites only iterates v4 sites in active/promoted dual_run state
//   - Pagination: 250 posts → 3 wpFetchJson calls (100+100+50)
//
// Mocks: wpFetchJson (WP core REST list calls), shimRpc (fileWrite + everything
// the verbs proxy through), and a stub supabase client for the DB calls.
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
    SITEMAP_PATHS,
    composeSitemap,
    pushSitemap,
    refreshSitemap,
    refreshAllSites,
} from './sitemapPort'

const SITE = 'https://wp.example.com'
const CREDS = { username: 'koto_service', appPassword: 'abcd efgh ijkl mnop qrst uvwx' }

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
    ;(wpFetchJson as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Test fixtures ────────────────────────────────────────────────────────────

const richPost = {
    id: 1,
    slug: 'plumbing-services',
    link: 'https://wp.example.com/plumbing-services/',
    modified_gmt: '2026-05-25T12:00:00',
    title: { rendered: 'Plumbing Services' },
    content: {
        rendered: `
            <p>We fix pipes.</p>
            <img src="https://wp.example.com/hero.jpg" alt="Hero" />
            <img src="https://wp.example.com/team.jpg" alt="Team" />
            <iframe src="https://www.youtube.com/embed/abc123"></iframe>
            <div itemtype="https://schema.org/FAQPage">
                <h3>How fast?</h3><p>Same day.</p>
            </div>
        `,
    },
    type: 'post',
    status: 'publish',
}

const sparsePost = {
    id: 2,
    slug: 'about',
    link: 'https://wp.example.com/about/',
    modified_gmt: '2026-05-20T08:00:00',
    title: { rendered: 'About' },
    content: { rendered: '<p>Just text, no images, no video, no FAQ.</p>' },
    type: 'page',
    status: 'publish',
}

// ── SITEMAP_PATHS constant ────────────────────────────────────────────────────

describe('sitemapPort — canonical paths', () => {
    it('exports the 4 canonical sub-sitemap paths under wp-content/uploads/kotoiq/', () => {
        expect(SITEMAP_PATHS.index).toBe('uploads/kotoiq/sitemap.xml')
        expect(SITEMAP_PATHS.posts).toBe('uploads/kotoiq/sitemap-posts.xml')
        expect(SITEMAP_PATHS.images).toBe('uploads/kotoiq/sitemap-images.xml')
        expect(SITEMAP_PATHS.videos).toBe('uploads/kotoiq/sitemap-videos.xml')
        expect(SITEMAP_PATHS.faq).toBe('uploads/kotoiq/sitemap-faq.xml')
    })
})

// ── composeSitemap ───────────────────────────────────────────────────────────

describe('sitemapPort — composeSitemap', () => {
    it('returns 5 files (index + posts + images + videos + faq) when content has all media types', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockImplementation(async (_site: string, path: string) => {
            // posts list — single page of results
            if (path.includes('/wp/v2/posts')) {
                return { ok: true, data: [richPost], status: 200 }
            }
            // pages list — single page of results
            if (path.includes('/wp/v2/pages')) {
                return { ok: true, data: [], status: 200 }
            }
            return { ok: true, data: [], status: 200 }
        })

        const composed = await composeSitemap(SITE, CREDS)
        const paths = composed.map((c) => c.path)
        expect(paths).toContain(SITEMAP_PATHS.index)
        expect(paths).toContain(SITEMAP_PATHS.posts)
        expect(paths).toContain(SITEMAP_PATHS.images)
        expect(paths).toContain(SITEMAP_PATHS.videos)
        expect(paths).toContain(SITEMAP_PATHS.faq)
        expect(composed).toHaveLength(5)

        // Index references the other sub-sitemaps
        const indexFile = composed.find((c) => c.path === SITEMAP_PATHS.index)!
        expect(indexFile.xml).toContain('<sitemapindex')
        expect(indexFile.xml).toContain('sitemap-posts.xml')
        expect(indexFile.xml).toContain('sitemap-images.xml')
        expect(indexFile.xml).toContain('sitemap-videos.xml')
        expect(indexFile.xml).toContain('sitemap-faq.xml')

        // Posts sitemap has the URL and image entries
        const postsFile = composed.find((c) => c.path === SITEMAP_PATHS.posts)!
        expect(postsFile.xml).toContain('<urlset')
        expect(postsFile.xml).toContain('https://wp.example.com/plumbing-services/')
        expect(postsFile.entry_count).toBe(1)

        // Images sitemap
        const imagesFile = composed.find((c) => c.path === SITEMAP_PATHS.images)!
        expect(imagesFile.xml).toContain('image:image')
        expect(imagesFile.xml).toContain('https://wp.example.com/hero.jpg')

        // Videos sitemap
        const videosFile = composed.find((c) => c.path === SITEMAP_PATHS.videos)!
        expect(videosFile.xml).toContain('video:video')
        expect(videosFile.xml).toContain('youtube.com/embed/abc123')

        // FAQ sitemap
        const faqFile = composed.find((c) => c.path === SITEMAP_PATHS.faq)!
        expect(faqFile.xml).toContain('https://wp.example.com/plumbing-services/')
    })

    it('omits videos + faq when fixture has neither', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockImplementation(async (_site: string, path: string) => {
            if (path.includes('/wp/v2/posts')) return { ok: true, data: [], status: 200 }
            if (path.includes('/wp/v2/pages')) return { ok: true, data: [sparsePost], status: 200 }
            return { ok: true, data: [], status: 200 }
        })

        const composed = await composeSitemap(SITE, CREDS)
        const paths = composed.map((c) => c.path)
        // index + posts always present (posts file holds pages too — single urlset)
        expect(paths).toContain(SITEMAP_PATHS.index)
        expect(paths).toContain(SITEMAP_PATHS.posts)
        expect(paths).not.toContain(SITEMAP_PATHS.videos)
        expect(paths).not.toContain(SITEMAP_PATHS.faq)
        expect(paths).not.toContain(SITEMAP_PATHS.images)
    })

    it('paginates: 250 posts triggers 3 wpFetchJson calls for /wp/v2/posts (100+100+50)', async () => {
        const makeBatch = (start: number, count: number) =>
            Array.from({ length: count }, (_, i) => ({
                ...sparsePost,
                id: start + i,
                slug: `p-${start + i}`,
                link: `https://wp.example.com/p-${start + i}/`,
            }))

        const fetchSpy = wpFetchJson as ReturnType<typeof vi.fn>
        fetchSpy.mockImplementation(async (_site: string, path: string) => {
            if (path.includes('/wp/v2/posts')) {
                // Match `&page=N` exactly (avoid false-positive on `per_page=100`).
                if (/&page=1(&|$)/.test(path)) return { ok: true, data: makeBatch(1, 100), status: 200 }
                if (/&page=2(&|$)/.test(path)) return { ok: true, data: makeBatch(101, 100), status: 200 }
                if (/&page=3(&|$)/.test(path)) return { ok: true, data: makeBatch(201, 50), status: 200 }
                return { ok: true, data: [], status: 200 }
            }
            if (path.includes('/wp/v2/pages')) return { ok: true, data: [], status: 200 }
            return { ok: true, data: [], status: 200 }
        })

        await composeSitemap(SITE, CREDS)
        const postCalls = fetchSpy.mock.calls.filter((c) => String(c[1]).includes('/wp/v2/posts'))
        expect(postCalls).toHaveLength(3)
    })

    it('filters status=publish only — never includes drafts (mitigates T-10-08-01)', async () => {
        const fetchSpy = wpFetchJson as ReturnType<typeof vi.fn>
        fetchSpy.mockImplementation(async () => ({ ok: true, data: [], status: 200 }))
        await composeSitemap(SITE, CREDS)
        const allCalls = fetchSpy.mock.calls.map((c) => String(c[1]))
        for (const path of allCalls) {
            expect(path).toContain('status=publish')
        }
    })
})

// ── pushSitemap ──────────────────────────────────────────────────────────────

describe('sitemapPort — pushSitemap', () => {
    it('calls fileWrite once per composed file', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { ok: true, bytes_written: 100, mtime: 1700000000 },
            status: 200,
        })

        const composed = [
            { path: SITEMAP_PATHS.index, xml: '<?xml ?><sitemapindex/>', entry_count: 2 },
            { path: SITEMAP_PATHS.posts, xml: '<?xml ?><urlset/>', entry_count: 5 },
        ]
        const result = await pushSitemap(SITE, composed)
        expect(result.ok).toBe(true)
        expect(result.pushed).toBe(2)
        expect(result.errors).toHaveLength(0)

        const calls = (shimRpc as ReturnType<typeof vi.fn>).mock.calls
        const writeCalls = calls.filter((c) => c[1] === 'file.write')
        expect(writeCalls).toHaveLength(2)
        // Each call gets the canonical path under wp-content/uploads/kotoiq/
        for (const c of writeCalls) {
            expect(String(c[2].path)).toMatch(/^uploads\/kotoiq\/sitemap.*\.xml$/)
            expect(typeof c[2].content_base64).toBe('string')
        }
    })

    it('collects per-file errors without aborting the whole batch', async () => {
        let n = 0
        ;(shimRpc as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            n++
            if (n === 2) {
                return { ok: false, error: { code: 'file_write_failed', message: 'disk full' }, status: 500 }
            }
            return { ok: true, data: { ok: true, bytes_written: 100, mtime: 0 }, status: 200 }
        })

        const result = await pushSitemap(SITE, [
            { path: SITEMAP_PATHS.index, xml: '<x/>', entry_count: 0 },
            { path: SITEMAP_PATHS.posts, xml: '<x/>', entry_count: 0 },
            { path: SITEMAP_PATHS.images, xml: '<x/>', entry_count: 0 },
        ])
        expect(result.ok).toBe(false)
        expect(result.pushed).toBe(2)
        expect(result.errors).toHaveLength(1)
    })
})

// ── refreshSitemap (audit row insert) ────────────────────────────────────────

describe('sitemapPort — refreshSitemap', () => {
    function makeSupabaseStub(
        siteRow: any,
        insertCapture: { last?: any } = {},
    ) {
        return {
            from(table: string) {
                if (table === 'koto_wp_sites') {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    maybeSingle: async () => ({ data: siteRow, error: null }),
                                }),
                            }),
                        }),
                    }
                }
                if (table === 'koto_wp_push_history') {
                    return {
                        insert: (row: any) => {
                            insertCapture.last = row
                            return { error: null }
                        },
                    }
                }
                throw new Error(`unexpected table ${table}`)
            },
        } as any
    }

    it('inserts a koto_wp_push_history row with status=sitemap_refresh on success', async () => {
        // Stub the credentials load + the shim/fetch behavior to a successful refresh.
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockImplementation(async () =>
            ({ ok: true, data: [], status: 200 }),
        )
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { ok: true, bytes_written: 100, mtime: 0 },
            status: 200,
        })

        const insertCapture: { last?: any } = {}
        const supabase = makeSupabaseStub(
            {
                id: 'site-1',
                agency_id: 'agency-1',
                site_url: SITE,
                app_password_username: 'koto_service',
                app_password_encrypted: JSON.stringify({ ct: 'x', iv: 'x', tag: 'x', payload_version: 1 }),
                dashboard_pubkey_fingerprint: 'fp',
            },
            insertCapture,
        )

        // Pass credentials directly to bypass the vault decrypt for the unit test.
        await refreshSitemap(supabase, 'agency-1', 'site-1', { credsOverride: CREDS })

        expect(insertCapture.last).toBeTruthy()
        expect(insertCapture.last.status).toBe('sitemap_refresh')
        expect(insertCapture.last.agency_id).toBe('agency-1')
        expect(insertCapture.last.target_site_id).toBe('site-1')
        expect(insertCapture.last.idempotency_key).toMatch(/^sitemap_refresh_/)
    })
})

// ── refreshAllSites ──────────────────────────────────────────────────────────

describe('sitemapPort — refreshAllSites', () => {
    it('only iterates v4 sites in active/promoted dual_run state', async () => {
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockImplementation(async () =>
            ({ ok: true, data: [], status: 200 }),
        )
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { ok: true, bytes_written: 100, mtime: 0 },
            status: 200,
        })

        const filterCalls: Array<{ col: string; val: any }> = []
        const sites = [
            { id: 's-a', agency_id: 'a-1', site_url: 'https://a.example.com' },
            { id: 's-b', agency_id: 'a-1', site_url: 'https://b.example.com' },
        ]
        // refreshSitemap also reads koto_wp_sites by id+agency_id with maybeSingle.
        // We dual-purpose the chain: the .in() path returns the full list
        // (thenable), the .maybeSingle() path returns one matching row.
        const supabase = {
            from(table: string) {
                if (table === 'koto_wp_sites') {
                    let currentId: string | null = null
                    let currentAgency: string | null = null
                    const chain: any = {
                        select: () => chain,
                        eq: (col: string, val: any) => {
                            filterCalls.push({ col, val })
                            if (col === 'id') currentId = val
                            if (col === 'agency_id') currentAgency = val
                            return chain
                        },
                        in: (col: string, vals: any[]) => {
                            filterCalls.push({ col, val: vals })
                            return chain
                        },
                        maybeSingle: async () => {
                            const row = sites.find(
                                (s) => s.id === currentId && s.agency_id === currentAgency,
                            )
                            return { data: row ?? null, error: null }
                        },
                        then: (resolve: any) => resolve({ data: sites, error: null }),
                    }
                    return chain
                }
                if (table === 'koto_wp_push_history') {
                    return { insert: () => ({ error: null }) }
                }
                throw new Error(`unexpected ${table}`)
            },
        } as any

        const result = await refreshAllSites(supabase, { credsOverride: CREDS })
        expect(result.processed).toBe(2)

        // Verify the filters that were applied to the site listing.
        const shimVersionFilter = filterCalls.find((f) => f.col === 'shim_version')
        expect(shimVersionFilter?.val).toBe('v4')
        const dualRunFilter = filterCalls.find((f) => f.col === 'dual_run_state')
        expect(Array.isArray(dualRunFilter?.val)).toBe(true)
        expect(dualRunFilter?.val).toEqual(expect.arrayContaining(['active', 'promoted']))
    })
})
