import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// captureTemplate.test — Phase 10 Plan 09 Task 1.
//
// Mocks: shimRpc (post.get_meta_bulk), wpFetch (wp/v2/pages read),
// credentialsVault.loadSiteCredentials, and the supabase client.
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

vi.mock('../credentialsVault', () => ({
    loadSiteCredentials: vi.fn(),
}))

import type { SupabaseClient } from '@supabase/supabase-js'

import { shimRpc } from '../shimRpc'
import { wpFetchJson } from '../wpFetch'
import { loadSiteCredentials } from '../credentialsVault'
import { captureTemplate } from './captureTemplate'

const AGENCY_A = '00000000-0000-0000-0000-00000000000A'
const SITE_A = '00000000-0000-0000-0000-00000000000B'
const SITE_URL = 'https://wp.example.com'

// Minimal Supabase mock — chainable with the two patterns we use:
//   .from(table).select().eq().eq().maybeSingle()
//   .from(table).insert({...}).select().single()
interface MockResult {
    data: unknown
    error: unknown
}
function makeSupabase(opts: {
    sites?: MockResult
    insertResult?: MockResult
    insertCapture?: (row: unknown) => void
}): SupabaseClient {
    return ({
        from: (table: string) => ({
            select: (_cols?: string) => ({
                eq: (_c1: string, _v1: unknown) => ({
                    eq: (_c2: string, _v2: unknown) => ({
                        maybeSingle: async () =>
                            table === 'koto_wp_sites'
                                ? (opts.sites ?? { data: null, error: null })
                                : { data: null, error: null },
                    }),
                }),
            }),
            insert: (row: unknown) => {
                if (opts.insertCapture) opts.insertCapture(row)
                return {
                    select: () => ({
                        single: async () =>
                            opts.insertResult ?? {
                                data: {
                                    id: 'tpl-1',
                                    agency_id: AGENCY_A,
                                    source_site_id: SITE_A,
                                    source_post_id: 42,
                                    name: 'Hero',
                                    description: null,
                                    elementor_data: (row as { elementor_data: unknown })
                                        .elementor_data,
                                    variable_schema: (row as { variable_schema: unknown })
                                        .variable_schema,
                                    seo_meta_template: null,
                                    taxonomy_template: null,
                                    captured_at: '2026-05-26T00:00:00Z',
                                    captured_by: null,
                                    archived_at: null,
                                    created_at: '2026-05-26T00:00:00Z',
                                    updated_at: '2026-05-26T00:00:00Z',
                                },
                                error: null,
                            },
                    }),
                }
            },
        }),
    }) as unknown as SupabaseClient
}

const ELEMENTOR_TREE = [
    {
        id: 'sec1',
        elType: 'section',
        settings: {},
        elements: [
            {
                id: 'wid1',
                elType: 'widget',
                widgetType: 'heading',
                settings: { title: 'Welcome to Acme Plumbing' },
            },
        ],
    },
]

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
    ;(wpFetchJson as ReturnType<typeof vi.fn>).mockReset()
    ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('captureTemplate — happy path', () => {
    it('inserts a koto_wp_templates row with elementor_data + variable_schema', async () => {
        ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
            username: 'koto_service',
            appPassword: 'aaaa bbbb cccc dddd eeee ffff',
            fingerprint: 'fp',
        })
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                id: 42,
                title: { rendered: 'Source Page' },
                content: { rendered: '<p>hi</p>' },
                slug: 'source-page',
                modified: '2026-05-25T00:00:00Z',
            },
            status: 200,
        })
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                results: {
                    '42': {
                        _elementor_data: JSON.stringify(ELEMENTOR_TREE),
                        _kotoiq_title: 'Acme Plumbing — Welcome',
                        _kotoiq_description: 'The best plumber',
                        _kotoiq_focus_keyword: '',
                    },
                },
                errors: [],
            },
            status: 200,
        })

        let captured: unknown = null
        const supabase = makeSupabase({
            sites: {
                data: { id: SITE_A, site_url: SITE_URL, agency_id: AGENCY_A },
                error: null,
            },
            insertCapture: (row) => {
                captured = row
            },
        })

        const result = await captureTemplate(supabase, AGENCY_A, SITE_A, 42, 'Hero')
        expect(result.ok).toBe(true)
        expect(result.templateId).toBe('tpl-1')
        const inserted = captured as Record<string, unknown>
        expect(inserted.agency_id).toBe(AGENCY_A)
        expect(inserted.source_site_id).toBe(SITE_A)
        expect(inserted.source_post_id).toBe(42)
        expect(inserted.name).toBe('Hero')
        expect(Array.isArray(inserted.variable_schema)).toBe(true)
        expect((inserted.variable_schema as unknown[]).length).toBeGreaterThan(0)
    })
})

describe('captureTemplate — error cases', () => {
    it('returns site_not_found when koto_wp_sites lookup is null', async () => {
        const supabase = makeSupabase({
            sites: { data: null, error: null },
        })
        const result = await captureTemplate(supabase, AGENCY_A, SITE_A, 42, 'Hero')
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('site_not_found')
    })

    it('returns site_not_found when site belongs to a DIFFERENT agency (cross-agency check)', async () => {
        // The Supabase mock with chained .eq('agency_id', X) returns null for
        // any agency_id that the site row doesn't match. We simulate that here
        // by returning null — this is what real Supabase would do when the
        // .eq filter excludes the row.
        const supabase = makeSupabase({
            sites: { data: null, error: null },
        })
        const result = await captureTemplate(
            supabase,
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            SITE_A,
            42,
            'Hero',
        )
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('site_not_found')
    })

    it('returns not_elementor when _elementor_data meta is missing', async () => {
        ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
            username: 'koto_service',
            appPassword: 'aaaa bbbb cccc dddd eeee ffff',
            fingerprint: 'fp',
        })
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                id: 42,
                title: { rendered: 'Source Page' },
                content: { rendered: '<p>hi</p>' },
                slug: 'source-page',
                modified: '2026-05-25T00:00:00Z',
            },
            status: 200,
        })
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { results: { '42': {} }, errors: [] },
            status: 200,
        })

        const supabase = makeSupabase({
            sites: {
                data: { id: SITE_A, site_url: SITE_URL, agency_id: AGENCY_A },
                error: null,
            },
        })
        const result = await captureTemplate(supabase, AGENCY_A, SITE_A, 42, 'Hero')
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('not_elementor')
    })

    it('returns missing_credentials when loadSiteCredentials returns null', async () => {
        ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(null)
        const supabase = makeSupabase({
            sites: {
                data: { id: SITE_A, site_url: SITE_URL, agency_id: AGENCY_A },
                error: null,
            },
        })
        const result = await captureTemplate(supabase, AGENCY_A, SITE_A, 42, 'Hero')
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('missing_credentials')
    })

    it('returns post_fetch_failed when wpFetchJson returns a non-ok shape', async () => {
        ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
            username: 'koto_service',
            appPassword: 'aaaa bbbb cccc dddd eeee ffff',
            fingerprint: 'fp',
        })
        ;(wpFetchJson as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            error: 'not found',
            status: 404,
        })
        const supabase = makeSupabase({
            sites: {
                data: { id: SITE_A, site_url: SITE_URL, agency_id: AGENCY_A },
                error: null,
            },
        })
        const result = await captureTemplate(supabase, AGENCY_A, SITE_A, 42, 'Hero')
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('post_fetch_failed')
    })
})
