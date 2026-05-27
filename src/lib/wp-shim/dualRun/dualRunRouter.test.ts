// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 10-10 Task 1 (RED) — dualRunRouter tests
//
// Covers:
//   - mode='inactive' / 'rolled_back' → only v3 fetched, no shimRpc, no insert
//   - mode='active' + matching responses → both called, insert diff_status='match'
//   - mode='active' + diverging responses → insert diff_status='major_diff'
//   - mode='active' + no-v3-equivalent verb → only shimRpc, insert diff_status='v4_only'
//   - mode='promoted' + random > 0.01 → only shimRpc, no insert
//   - mode='promoted' + random < 0.01 → both called, insert
//   - v4 returned in ALL active/promoted cases
//   - Logging failure does not propagate
//   - Cross-agency scoping on insert payload
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock shimRpc BEFORE importing dualRunRouter (it imports shimRpc at module load).
vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import { createDualRunRouter, V4_TO_V3_ACTION_MAP } from './dualRunRouter'

const shimRpcMock = shimRpc as unknown as ReturnType<typeof vi.fn>

// ── Test fixtures ────────────────────────────────────────────────────────────
const AGENCY = '00000000-0000-0000-0000-000000000001'
const SITE = '00000000-0000-0000-0000-000000000002'
const SITE_URL = 'https://example.test'

// Build a chainable mock for supabase.from('...').insert({...}).
function makeMockSupabase() {
    const insert = vi.fn().mockResolvedValue({ error: null, data: null })
    const from = vi.fn().mockReturnValue({ insert })
    return { from, insert }
}

beforeEach(() => {
    vi.clearAllMocks()
    // Default global fetch mock — each test overrides as needed.
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ legacy: 'ok' }),
        text: async () => '',
    } as unknown as Response)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('createDualRunRouter — inactive mode', () => {
    it('calls only v3 (/api/wp) and does not call shimRpc or insert', async () => {
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'inactive')
        await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(shimRpcMock).not.toHaveBeenCalled()
        expect(globalThis.fetch).toHaveBeenCalled()
        expect(sb.insert).not.toHaveBeenCalled()
    })
})

describe('createDualRunRouter — rolled_back mode', () => {
    it('calls only v3 (/api/wp) and does not call shimRpc or insert', async () => {
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'rolled_back')
        await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(shimRpcMock).not.toHaveBeenCalled()
        expect(globalThis.fetch).toHaveBeenCalled()
        expect(sb.insert).not.toHaveBeenCalled()
    })
})

describe('createDualRunRouter — active mode', () => {
    it('fires both legs, returns v4, logs diff_status=match when responses match', async () => {
        shimRpcMock.mockResolvedValue({ ok: true, data: { result: 1 }, status: 200 })
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ result: 1 }),
            text: async () => '',
        } as unknown as Response)
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'active')
        const result = await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(shimRpcMock).toHaveBeenCalledTimes(1)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
        expect(sb.insert).toHaveBeenCalledTimes(1)
        const insertPayload = sb.insert.mock.calls[0][0]
        expect(insertPayload.diff_status).toBe('match')
        expect(insertPayload.agency_id).toBe(AGENCY)
        expect(insertPayload.site_id).toBe(SITE)
        expect((result as { ok: boolean; data: unknown }).ok).toBe(true)
        expect((result as { data: { result: number } }).data.result).toBe(1)
    })

    it('logs diff_status=major_diff when responses diverge', async () => {
        shimRpcMock.mockResolvedValue({ ok: true, data: { result: 'v4' }, status: 200 })
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ result: 'v3' }),
            text: async () => '',
        } as unknown as Response)
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'active')
        await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(sb.insert).toHaveBeenCalledTimes(1)
        const insertPayload = sb.insert.mock.calls[0][0]
        expect(insertPayload.diff_status).toBe('major_diff')
        expect(insertPayload.diff_summary).toBeTruthy()
    })

    it('logs v4_only and skips v3 leg for verbs with no v3 equivalent (file.write)', async () => {
        shimRpcMock.mockResolvedValue({ ok: true, data: { bytes: 100 }, status: 200 })
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'active')
        await router.runVerb('file.write', { path: 'uploads/kotoiq/x.txt', content_base64: 'aGk=' })
        expect(shimRpcMock).toHaveBeenCalledTimes(1)
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(sb.insert).toHaveBeenCalledTimes(1)
        expect(sb.insert.mock.calls[0][0].diff_status).toBe('v4_only')
    })

    it('returns v4 even when v3 errored, and logs v3_error', async () => {
        shimRpcMock.mockResolvedValue({ ok: true, data: { ok: true }, status: 200 })
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'boom' }),
            text: async () => 'boom',
        } as unknown as Response)
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'active')
        const res = await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect((res as { ok: boolean }).ok).toBe(true)
        expect(sb.insert.mock.calls[0][0].diff_status).toBe('v3_error')
    })

    it('does not propagate logging failures to the caller', async () => {
        shimRpcMock.mockResolvedValue({ ok: true, data: { result: 1 }, status: 200 })
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ result: 1 }),
            text: async () => '',
        } as unknown as Response)
        const sb = {
            from: vi.fn().mockReturnValue({
                insert: vi.fn().mockRejectedValue(new Error('db down')),
            }),
        }
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'active')
        // Should not throw.
        const res = await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect((res as { ok: boolean }).ok).toBe(true)
    })
})

describe('createDualRunRouter — promoted mode', () => {
    it('skips v3 leg + insert when Math.random > 0.01', async () => {
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5)
        shimRpcMock.mockResolvedValue({ ok: true, data: { result: 1 }, status: 200 })
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'promoted')
        await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(shimRpcMock).toHaveBeenCalledTimes(1)
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(sb.insert).not.toHaveBeenCalled()
        rand.mockRestore()
    })

    it('fires v3 sampling leg + insert when Math.random < 0.01', async () => {
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.005)
        shimRpcMock.mockResolvedValue({ ok: true, data: { result: 1 }, status: 200 })
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ result: 1 }),
            text: async () => '',
        } as unknown as Response)
        const sb = makeMockSupabase()
        const router = createDualRunRouter(sb as any, AGENCY, SITE, SITE_URL, 'promoted')
        await router.runVerb('meta.update', { post_id: 1, updates: [] })
        expect(shimRpcMock).toHaveBeenCalledTimes(1)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
        expect(sb.insert).toHaveBeenCalledTimes(1)
        rand.mockRestore()
    })
})

describe('V4_TO_V3_ACTION_MAP', () => {
    it('maps high-volume verbs to v3 action strings', () => {
        expect(V4_TO_V3_ACTION_MAP['meta.update']).toBe('seo_set_meta')
        expect(V4_TO_V3_ACTION_MAP['elementor.save']).toBe('put_elementor_data')
        expect(V4_TO_V3_ACTION_MAP['elementor.clone']).toBe('clone_elementor_page')
        expect(V4_TO_V3_ACTION_MAP['health.ping']).toBe('meta')
    })

    it('maps verbs with no v3 equivalent to null', () => {
        expect(V4_TO_V3_ACTION_MAP['file.write']).toBe(null)
        expect(V4_TO_V3_ACTION_MAP['file.delete']).toBe(null)
        expect(V4_TO_V3_ACTION_MAP['transient.delete_prefix']).toBe(null)
        expect(V4_TO_V3_ACTION_MAP['webhook.set']).toBe(null)
        expect(V4_TO_V3_ACTION_MAP['database.update_bulk']).toBe(null)
    })
})
