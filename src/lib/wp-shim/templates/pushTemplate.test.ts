import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// pushTemplate.test — Phase 10 Plan 09 Task 2.
//
// Mocks shimRpc (elementor.save + meta.update) AND credentialsVault so the
// push flow can be exercised end-to-end without hitting any real network.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

vi.mock('../credentialsVault', () => ({
    loadSiteCredentials: vi.fn(),
}))

import type { SupabaseClient } from '@supabase/supabase-js'

import { shimRpc } from '../shimRpc'
import { loadSiteCredentials } from '../credentialsVault'
import { pushTemplate, pushTemplateBatch, diffPushes } from './pushTemplate'

const AGENCY_A = '00000000-0000-0000-0000-00000000000A'
const SITE_TARGET = '00000000-0000-0000-0000-00000000000T'
const TEMPLATE_ID = '00000000-0000-0000-0000-00000000000C'

// Captured calls log for assertions across .from('koto_wp_push_history')
// inserts + updates.
interface HistoryLog {
    inserts: unknown[]
    updates: Array<{ patch: unknown; where: Record<string, unknown> }>
}

interface SupaOpts {
    template?: { data: unknown; error: unknown }
    site?: { data: unknown; error: unknown }
    historyLog?: HistoryLog
    historyInsertResult?: { data: unknown; error: unknown }
    historyTwo?: unknown[]
}

function makeSupabase(opts: SupaOpts): SupabaseClient {
    return ({
        from: (table: string) => {
            if (table === 'koto_wp_templates') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                maybeSingle: async () =>
                                    opts.template ?? { data: null, error: null },
                            }),
                        }),
                    }),
                }
            }
            if (table === 'koto_wp_sites') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                maybeSingle: async () =>
                                    opts.site ?? { data: null, error: null },
                            }),
                        }),
                    }),
                }
            }
            if (table === 'koto_wp_push_history') {
                return {
                    insert: (row: unknown) => {
                        opts.historyLog?.inserts.push(row)
                        return {
                            select: () => ({
                                single: async () =>
                                    opts.historyInsertResult ?? {
                                        data: { id: 'hist-1' },
                                        error: null,
                                    },
                            }),
                        }
                    },
                    update: (patch: unknown) => ({
                        eq: (c1: string, v1: unknown) => ({
                            eq: (c2: string, v2: unknown) => {
                                opts.historyLog?.updates.push({
                                    patch,
                                    where: { [c1]: v1, [c2]: v2 },
                                })
                                return Promise.resolve({ data: null, error: null })
                            },
                        }),
                    }),
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => ({
                                    order: () => ({
                                        limit: async () => ({
                                            data: opts.historyTwo ?? [],
                                            error: null,
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                }
            }
            return {} as never
        },
    }) as unknown as SupabaseClient
}

const STORED_TREE = [
    {
        id: 'sec1',
        elType: 'section',
        settings: {},
        elements: [
            {
                id: 'wid1',
                elType: 'widget',
                widgetType: 'heading',
                settings: { title: '{hero_headline}' },
            },
        ],
    },
]

const TEMPLATE_ROW = {
    id: TEMPLATE_ID,
    agency_id: AGENCY_A,
    source_site_id: 'src-site',
    source_post_id: 42,
    name: 'Hero',
    description: null,
    elementor_data: STORED_TREE,
    variable_schema: [
        { name: 'hero_headline', value: 'Welcome', path: '$[0].elements[0].settings.title', type: 'text' },
    ],
    seo_meta_template: { _kotoiq_title: '{hero_headline}', _kotoiq_description: 'Default desc' },
    taxonomy_template: null,
    archived_at: null,
}

const SITE_ROW = {
    id: SITE_TARGET,
    agency_id: AGENCY_A,
    site_url: 'https://target.example.com',
}

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
    ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockReset()
    ;(loadSiteCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        username: 'koto_service',
        appPassword: 'aaaa bbbb cccc dddd',
        fingerprint: 'fp',
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('pushTemplate — happy path', () => {
    it('inserts push_history pending → elementor.save → meta.update → updates to succeeded', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockImplementation(
            async (_site, verb: string) => {
                if (verb === 'elementor.save') {
                    return {
                        ok: true,
                        data: {
                            ok: true,
                            post_id: 1001,
                            url: 'https://target.example.com/?p=1001',
                            status: 'draft',
                            elementor_version: '4.0',
                            css_regenerated: true,
                            element_count: 2,
                        },
                        status: 200,
                    }
                }
                if (verb === 'meta.update') {
                    return { ok: true, data: { applied: 3, errors: [] }, status: 200 }
                }
                return { ok: false, error: { code: 'unknown', message: '?' }, status: 500 }
            },
        )
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {
            hero_headline: 'Acme Plumbing',
        })
        expect(result.ok).toBe(true)
        expect(result.pushedPostId).toBe(1001)
        // History was inserted with status=pending FIRST, then updated to succeeded.
        expect(log.inserts.length).toBe(1)
        expect((log.inserts[0] as Record<string, unknown>).status).toBe('pending')
        expect(log.updates.length).toBe(1)
        expect((log.updates[0].patch as Record<string, unknown>).status).toBe('succeeded')
        expect((log.updates[0].patch as Record<string, unknown>).pushed_post_id).toBe(1001)
        // Update was filtered by both id and agency_id (defense-in-depth).
        expect(log.updates[0].where.agency_id).toBe(AGENCY_A)
    })

    it('writes idempotent elementor.save result through as succeeded', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockImplementation(
            async (_site, verb: string) => {
                if (verb === 'elementor.save') {
                    return {
                        ok: true,
                        data: {
                            ok: true,
                            post_id: 1001,
                            url: 'https://target.example.com/?p=1001',
                            status: 'draft',
                            elementor_version: '4.0',
                            css_regenerated: false,
                            element_count: 2,
                            idempotent: true,
                        },
                        status: 200,
                    }
                }
                return { ok: true, data: { applied: 0, errors: [] }, status: 200 }
            },
        )
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {
            hero_headline: 'Acme',
        })
        expect(result.ok).toBe(true)
        expect((log.updates[0].patch as Record<string, unknown>).status).toBe('succeeded')
    })

    it('wraps Array variable values with [koto_rotate] in rendered_elementor_data', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockImplementation(
            async (_site, verb: string, args: unknown) => {
                if (verb === 'elementor.save') {
                    // Inspect the elementor_data passed to elementor.save.
                    const tree = (args as { elementor_data: unknown }).elementor_data
                    const flat = JSON.stringify(tree)
                    expect(flat).toContain('[koto_rotate')
                    expect(flat).toContain('|||KOTO_VARIANT|||')
                    return {
                        ok: true,
                        data: {
                            ok: true,
                            post_id: 1002,
                            url: '',
                            status: 'draft',
                            elementor_version: '4.0',
                            css_regenerated: true,
                            element_count: 2,
                        },
                        status: 200,
                    }
                }
                return { ok: true, data: { applied: 0, errors: [] }, status: 200 }
            },
        )
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {
            hero_headline: ['Try free for 14 days', 'No credit card', 'Cancel anytime'],
        })
        expect(result.ok).toBe(true)
        // The rendered tree in the push_history update must also carry the rotate.
        const patch = log.updates[0].patch as Record<string, unknown>
        expect(JSON.stringify(patch.rendered_elementor_data)).toContain('[koto_rotate')
    })
})

describe('pushTemplate — error paths', () => {
    it('updates history to failed on elementor.save error', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            error: { code: 'save_failed', message: 'Document::save threw' },
            status: 500,
        })
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {
            hero_headline: 'X',
        })
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('save_failed')
        expect((log.updates[0].patch as Record<string, unknown>).status).toBe('failed')
        expect((log.updates[0].patch as Record<string, unknown>).error_code).toBe('save_failed')
    })

    it('cross-agency: returns template_not_found before any RPC fires', async () => {
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: null, error: null }, // simulates .eq(agency_id, A) filter excluding the row
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {})
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('template_not_found')
        expect((shimRpc as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
        // No push_history row should have been inserted — pre-RPC failure.
        expect(log.inserts.length).toBe(0)
    })

    it('cross-agency: site belongs to another agency → target_site_not_found', async () => {
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: null, error: null }, // .eq(agency_id, A) excludes
            historyLog: log,
        })
        const result = await pushTemplate(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, {})
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('target_site_not_found')
        expect(log.inserts.length).toBe(0)
    })
})

describe('pushTemplateBatch', () => {
    it('runs pushes sequentially and aggregates results', async () => {
        let saveCount = 0
        ;(shimRpc as ReturnType<typeof vi.fn>).mockImplementation(
            async (_s, verb: string) => {
                if (verb === 'elementor.save') {
                    saveCount++
                    return {
                        ok: true,
                        data: {
                            ok: true,
                            post_id: 2000 + saveCount,
                            url: '',
                            status: 'draft',
                            elementor_version: '4',
                            css_regenerated: true,
                            element_count: 1,
                        },
                        status: 200,
                    }
                }
                return { ok: true, data: { applied: 0, errors: [] }, status: 200 }
            },
        )
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const result = await pushTemplateBatch(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, [
            { hero_headline: 'A' },
            { hero_headline: 'B' },
            { hero_headline: 'C' },
        ])
        expect(result.ok_count).toBe(3)
        expect(result.failed_count).toBe(0)
        expect(result.results.length).toBe(3)
        expect(saveCount).toBe(3)
        // Each row inserted a pending row first.
        expect(log.inserts.length).toBe(3)
    })

    it('rejects batches larger than 500', async () => {
        const log: HistoryLog = { inserts: [], updates: [] }
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyLog: log,
        })
        const rows = Array.from({ length: 501 }, () => ({ hero_headline: 'x' }))
        await expect(
            pushTemplateBatch(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET, rows),
        ).rejects.toThrow(/capped at 500/)
    })
})

describe('diffPushes', () => {
    it('returns null on first push (less than 2 history rows)', async () => {
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyTwo: [
                { rendered_elementor_data: STORED_TREE, pushed_at: '2026-05-26T00:00:00Z' },
            ],
        })
        const result = await diffPushes(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET)
        expect(result).toBeNull()
    })

    it('returns diffSummary on second push with changed paths', async () => {
        const newer = JSON.parse(JSON.stringify(STORED_TREE))
        newer[0].elements[0].settings.title = 'CHANGED'
        const supabase = makeSupabase({
            template: { data: TEMPLATE_ROW, error: null },
            site: { data: SITE_ROW, error: null },
            historyTwo: [
                { rendered_elementor_data: newer, pushed_at: '2026-05-27T00:00:00Z' },
                { rendered_elementor_data: STORED_TREE, pushed_at: '2026-05-26T00:00:00Z' },
            ],
        })
        const result = await diffPushes(supabase, AGENCY_A, TEMPLATE_ID, SITE_TARGET)
        expect(result).not.toBeNull()
        expect(Array.isArray(result?.diffSummary)).toBe(true)
        expect(result?.diffSummary.length).toBeGreaterThan(0)
        expect(result?.diffSummary.join('|')).toContain('title')
    })
})
