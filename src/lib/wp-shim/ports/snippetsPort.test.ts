import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// snippetsPort.test — verifies CRUD on kotoiq_shim_snippets via option.get +
// option.update, and that the disk shape (type/location) round-trips through
// the (kind/scope) dashboard shape correctly.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import {
    SNIPPETS_OPTION,
    listSnippets,
    saveSnippet,
    deleteSnippet,
    toggleSnippet,
} from './snippetsPort'

const SITE = 'https://wp.example.com'

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('snippetsPort — option name + listSnippets', () => {
    it('uses kotoiq_shim_snippets option name', () => {
        expect(SNIPPETS_OPTION).toBe('kotoiq_shim_snippets')
    })

    it('calls option.get + deserializes type/location to kind/scope', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                value: [
                    {
                        id: 's1',
                        name: 'GA',
                        type: 'js',
                        location: 'head',
                        code: '/*ga*/',
                        active: true,
                        read_roles: [],
                        execute_roles: [],
                        created_at: '2026-05-01',
                        updated_at: '2026-05-02',
                    },
                    {
                        id: 's2',
                        name: 'PHP hello',
                        type: 'php',
                        location: 'admin',
                        code: 'echo "hi";',
                        active: false,
                        read_roles: ['editor'],
                        execute_roles: ['administrator'],
                        created_at: '2026-05-01',
                        updated_at: '2026-05-02',
                    },
                ],
                exists: true,
            },
            status: 200,
        })
        const res = await listSnippets(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data).toHaveLength(2)
        expect(res.data[0].kind).toBe('js_head')
        expect(res.data[1].kind).toBe('php')
        expect(res.data[1].scope).toBe('admin')

        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('option.get')
        expect(call[2].name).toBe('kotoiq_shim_snippets')
    })
})

describe('snippetsPort — saveSnippet', () => {
    it('upserts by id, preserves created_at on update', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        {
                            id: 's1',
                            name: 'old',
                            type: 'html',
                            location: 'head',
                            code: 'old',
                            active: true,
                            read_roles: [],
                            execute_roles: [],
                            created_at: '2026-01-01',
                            updated_at: '2026-01-01',
                        },
                    ],
                    exists: true,
                },
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: true },
                status: 200,
            })
        const res = await saveSnippet(SITE, {
            id: 's1',
            name: 'new',
            kind: 'html_head',
            scope: 'frontend',
            code: 'new',
            active: false,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.id).toBe('s1')
        expect(res.data.created_at).toBe('2026-01-01')
        expect(res.data.name).toBe('new')

        const writeCall = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[1]
        expect(writeCall[1]).toBe('option.update')
        const written = writeCall[2].value as Array<{ id: string; name: string; type: string; location: string }>
        expect(written).toHaveLength(1)
        expect(written[0].type).toBe('html')
        // html_head kind → disk location='head' (wp_head hook target). The
        // `scope` field is preserved separately in the dashboard shape; v3's
        // 'location' enum doesn't independently encode head + frontend, so
        // the wp_head hook wins and the runtime fires only on frontend pages
        // because the kind is html (not php).
        expect(written[0].location).toBe('head')
    })

    it('assigns new id when none provided', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: { value: [], exists: false },
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: true },
                status: 200,
            })
        const res = await saveSnippet(SITE, {
            name: 'fresh',
            kind: 'css',
            scope: 'frontend',
            code: 'a {color:red;}',
            active: true,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(typeof res.data.id).toBe('string')
        expect(res.data.id.length).toBeGreaterThan(0)
        expect(res.data.created_at).toBeDefined()
    })
})

describe('snippetsPort — deleteSnippet', () => {
    it('reads → filters out target id → writes the remainder', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        {
                            id: 's1',
                            name: 'a',
                            type: 'js',
                            location: 'head',
                            code: '',
                            active: true,
                            read_roles: [],
                            execute_roles: [],
                            created_at: 'x',
                            updated_at: 'x',
                        },
                        {
                            id: 's2',
                            name: 'b',
                            type: 'js',
                            location: 'footer',
                            code: '',
                            active: true,
                            read_roles: [],
                            execute_roles: [],
                            created_at: 'x',
                            updated_at: 'x',
                        },
                    ],
                    exists: true,
                },
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: true },
                status: 200,
            })
        await deleteSnippet(SITE, 's1')
        const writeCall = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[1]
        const written = writeCall[2].value as Array<{ id: string }>
        expect(written).toHaveLength(1)
        expect(written[0].id).toBe('s2')
    })
})

describe('snippetsPort — toggleSnippet', () => {
    it('flips active flag + returns updated snippet', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        {
                            id: 's1',
                            name: 'a',
                            type: 'js',
                            location: 'footer',
                            code: '',
                            active: true,
                            read_roles: [],
                            execute_roles: [],
                            created_at: '2026-01-01',
                            updated_at: '2026-01-02',
                        },
                    ],
                    exists: true,
                },
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: true },
                status: 200,
            })
        const res = await toggleSnippet(SITE, 's1', false)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.active).toBe(false)
        expect(res.data.id).toBe('s1')
        expect(res.data.updated_at).not.toBe('2026-01-02')
    })

    it('returns snippet_not_found when id missing', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: { value: [], exists: false },
            status: 200,
        })
        const res = await toggleSnippet(SITE, 'missing', true)
        expect(res.ok).toBe(false)
        if (res.ok) return
        expect(res.error.code).toBe('snippet_not_found')
    })
})
