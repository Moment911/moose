import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// redirectsPort.test — verifies the dashboard-side redirects port issues the
// correct shim verb sequences (option.get → option.update read-then-write
// pattern) for CRUD on the kotoiq_shim_redirects + kotoiq_shim_404_log options.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import {
    REDIRECTS_OPTION,
    FOUR_OH_FOUR_OPTION,
    listRedirects,
    addRedirect,
    removeRedirect,
    updateRedirect,
    listFourOhFours,
    clearFourOhFourLog,
} from './redirectsPort'

const SITE = 'https://wp.example.com'

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('redirectsPort — option name constants', () => {
    it('uses kotoiq_shim_redirects (NOT v3 kotoiq_seo_redirects)', () => {
        expect(REDIRECTS_OPTION).toBe('kotoiq_shim_redirects')
    })

    it('uses kotoiq_shim_404_log (NOT v3 kotoiq_seo_404_log)', () => {
        expect(FOUR_OH_FOUR_OPTION).toBe('kotoiq_shim_404_log')
    })
})

describe('redirectsPort — listRedirects', () => {
    it('calls option.get with name=kotoiq_shim_redirects', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { value: [], exists: false },
            status: 200,
        })
        await listRedirects(SITE)
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('option.get')
        expect(call[2].name).toBe('kotoiq_shim_redirects')
    })

    it('returns empty array when option has never been written', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { value: null, exists: false },
            status: 200,
        })
        const res = await listRedirects(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data).toEqual([])
    })

    it('normalizes raw rule data + drops malformed entries', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                value: [
                    { id: 'r1', from: '/old', to: '/new', type: 'exact', status_code: 301, created_at: '2026-05-01' },
                    { from: '', to: '/x' }, // malformed — empty from → dropped
                    { from: '/regex.*', to: '/y', type: 'regex', status_code: 302, created_at: '2026-05-02' },
                ],
                exists: true,
            },
            status: 200,
        })
        const res = await listRedirects(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data).toHaveLength(2)
        expect(res.data[0].id).toBe('r1')
        expect(res.data[1].type).toBe('regex')
        expect(res.data[1].status_code).toBe(302)
    })
})

describe('redirectsPort — addRedirect', () => {
    it('reads existing rules, appends new rule with id + timestamp, writes back', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        {
                            id: 'r_existing',
                            from: '/a',
                            to: '/b',
                            type: 'exact',
                            status_code: 301,
                            created_at: '2026-01-01',
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
        const res = await addRedirect(SITE, {
            from: '/x',
            to: '/y',
            type: 'exact',
            status_code: 301,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.from).toBe('/x')
        expect(res.data.to).toBe('/y')
        expect(res.data.id).toMatch(/^r_/)
        expect(typeof res.data.created_at).toBe('string')

        // Verb 1: option.get
        const c1 = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(c1[1]).toBe('option.get')
        // Verb 2: option.update with both old + new rule
        const c2 = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[1]
        expect(c2[1]).toBe('option.update')
        expect(c2[2].name).toBe('kotoiq_shim_redirects')
        const written = c2[2].value as Array<{ id: string }>
        expect(written).toHaveLength(2)
        expect(written[0].id).toBe('r_existing')
        expect(written[1].id).toMatch(/^r_/)
    })
})

describe('redirectsPort — removeRedirect', () => {
    it('reads → filters out target id → writes back', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        { id: 'r1', from: '/a', to: '/b', type: 'exact', status_code: 301, created_at: 'x' },
                        { id: 'r2', from: '/c', to: '/d', type: 'exact', status_code: 301, created_at: 'y' },
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
        await removeRedirect(SITE, 'r1')
        const c2 = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[1]
        expect(c2[1]).toBe('option.update')
        const written = c2[2].value as Array<{ id: string }>
        expect(written).toHaveLength(1)
        expect(written[0].id).toBe('r2')
    })

    it('non-existent id is a no-op (writes the unchanged list)', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        { id: 'r1', from: '/a', to: '/b', type: 'exact', status_code: 301, created_at: 'x' },
                    ],
                    exists: true,
                },
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: false },
                status: 200,
            })
        const res = await removeRedirect(SITE, 'r_nonexistent')
        expect(res.ok).toBe(true)
        const c2 = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[1]
        const written = c2[2].value as Array<{ id: string }>
        expect(written).toHaveLength(1) // unchanged
    })
})

describe('redirectsPort — updateRedirect', () => {
    it('updates an existing rule, sets updated_at, preserves id + created_at', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: [
                        {
                            id: 'r1',
                            from: '/a',
                            to: '/b',
                            type: 'exact',
                            status_code: 301,
                            created_at: '2026-01-01',
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
        const res = await updateRedirect(SITE, 'r1', { to: '/new', status_code: 302 })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.id).toBe('r1')
        expect(res.data.created_at).toBe('2026-01-01')
        expect(res.data.to).toBe('/new')
        expect(res.data.status_code).toBe(302)
        expect(res.data.updated_at).toBeDefined()
    })

    it('returns rule_not_found when id absent', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: { value: [], exists: false },
            status: 200,
        })
        const res = await updateRedirect(SITE, 'r_nope', { to: '/x' })
        expect(res.ok).toBe(false)
        if (res.ok) return
        expect(res.error.code).toBe('rule_not_found')
    })
})

describe('redirectsPort — listFourOhFours', () => {
    it('calls option.get with name=kotoiq_shim_404_log + normalizes entries', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                value: [
                    { url: '/missing', referrer: '/from', ua: 'Mozilla', ip: '1.2.3.4', time: '2026-05-01' },
                    { url: '', time: 'should-be-dropped' }, // malformed
                    { url: '/another', time: '2026-05-02' },
                ],
                exists: true,
            },
            status: 200,
        })
        const res = await listFourOhFours(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data).toHaveLength(2)
        expect(res.data[0].url).toBe('/missing')
        expect(res.data[0].ua).toBe('Mozilla')

        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[2].name).toBe('kotoiq_shim_404_log')
    })
})

describe('redirectsPort — clearFourOhFourLog', () => {
    it('calls option.delete with name=kotoiq_shim_404_log', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { ok: true, deleted: true },
            status: 200,
        })
        await clearFourOhFourLog(SITE)
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('option.delete')
        expect(call[2].name).toBe('kotoiq_shim_404_log')
    })
})
