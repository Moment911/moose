import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// orchestrateOnboarding.test — proves the fire-and-forget post-pair chain:
//   (1) all three legs fire with correct args (run_all_audits + both webhooks)
//   (2) a thrown webhookSet for save_post does NOT abort publish_post or audits
//   (3) the function resolves (never rejects) even when the audits POST 500s
//
// We mock the wp-shim webhookSet verb and global fetch. The baseline-snapshot
// leg (WS2 / Plan 11-02) is a soft dynamic import guarded by try/catch, so it
// is allowed to be absent in this plan — the chain must not hard-fail on it.
// ─────────────────────────────────────────────────────────────────────────────

const webhookSetMock = vi.fn()

vi.mock('@/lib/wp-shim/verbs/index', () => ({
    webhookSet: (...args: unknown[]) => webhookSetMock(...args),
}))

import { orchestrateOnboarding } from '@/lib/kotoiq/orchestrateOnboarding'

const OPTS = {
    agencyId: 'agency-1',
    clientId: 'client-1',
    siteId: 'site-1',
    siteUrl: 'https://client.example.com',
    baseUrl: 'https://hellokoto.com',
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-xyz')
    vi.stubEnv('KOTOIQ_WP_EVENT_SECRET', 'wp-event-secret-abc')
    webhookSetMock.mockReset()
    webhookSetMock.mockResolvedValue({ ok: true, data: { ok: true } })
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, run_id: 'r1' }) })
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('orchestrateOnboarding', () => {
    it('fires run_all_audits + save_post + publish_post webhooks with correct args', async () => {
        const result = await orchestrateOnboarding(OPTS)

        // run_all_audits POST to /api/kotoiq with CRON_SECRET + client/agency
        expect(fetchMock).toHaveBeenCalled()
        const auditCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/kotoiq'))
        expect(auditCall).toBeDefined()
        const init = auditCall![1] as RequestInit
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer cron-secret-xyz')
        const sentBody = JSON.parse(init.body as string)
        expect(sentBody.action).toBe('run_all_audits')
        expect(sentBody.client_id).toBe('client-1')
        expect(sentBody.agency_id).toBe('agency-1')

        // both webhooks registered pointing at the https receiver
        const events = webhookSetMock.mock.calls.map(c => (c[1] as { event: string }).event).sort()
        expect(events).toEqual(['publish_post', 'save_post'])
        for (const call of webhookSetMock.mock.calls) {
            expect(call[0]).toBe('https://client.example.com')
            const arg = call[1] as { event: string; url: string }
            expect(arg.url.startsWith('https://hellokoto.com/api/kotoiq/wp-event')).toBe(true)
        }

        // structured, non-throwing result
        expect(result).toBeDefined()
        expect(result.audits.ok).toBe(true)
        expect(result.webhooks.save_post.ok).toBe(true)
        expect(result.webhooks.publish_post.ok).toBe(true)
    })

    it('a thrown webhookSet(save_post) does NOT prevent publish_post or the audits POST', async () => {
        webhookSetMock.mockImplementation((_url: string, args: { event: string }) => {
            if (args.event === 'save_post') throw new TypeError('disallowed event')
            return Promise.resolve({ ok: true, data: { ok: true } })
        })

        const result = await orchestrateOnboarding(OPTS)

        // audits still fired
        const auditCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/kotoiq'))
        expect(auditCall).toBeDefined()
        // publish_post still registered
        const events = webhookSetMock.mock.calls.map(c => (c[1] as { event: string }).event)
        expect(events).toContain('publish_post')
        // save_post leg recorded as failed, but function did not throw
        expect(result.webhooks.save_post.ok).toBe(false)
        expect(result.webhooks.publish_post.ok).toBe(true)
    })

    it('resolves (never rejects) even when the audits POST 500s', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

        const result = await orchestrateOnboarding(OPTS)
        expect(result.audits.ok).toBe(false)
        // webhooks still attempted
        expect(webhookSetMock).toHaveBeenCalledTimes(2)
    })

    it('resolves even when fetch itself throws (network error)', async () => {
        fetchMock.mockRejectedValue(new Error('network down'))
        const result = await orchestrateOnboarding(OPTS)
        expect(result.audits.ok).toBe(false)
    })
})
