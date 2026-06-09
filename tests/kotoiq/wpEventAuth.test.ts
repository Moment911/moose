import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyWpEvent } from '@/lib/kotoiq/wpEventAuth'

// ─────────────────────────────────────────────────────────────────────────────
// wpEventAuth.test — proves the inbound webhook receiver authenticates the
// shim emitter's POST via the capability token embedded in the registered URL
// (the only auth surface available against the LOCKED, no-auth emitter).
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-abc123-deadbeef'
const RECEIVER = 'https://hellokoto.com/api/kotoiq/wp-event'

function emitterBody(siteUrl = 'https://client.example.com') {
    return JSON.stringify({
        event: 'save_post',
        payload: { post_id: 42, post_type: 'post', post_status: 'publish' },
        site_url: siteUrl,
        time: 1717800000,
    })
}

function makeReq(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Koto-Shim-Event': 'save_post', ...headers },
    })
}

beforeEach(() => {
    vi.stubEnv('KOTOIQ_WP_EVENT_SECRET', SECRET)
})
afterEach(() => {
    vi.unstubAllEnvs()
})

describe('verifyWpEvent', () => {
    it('accepts a POST whose URL carries the correct token and returns the parsed siteUrl', () => {
        const req = makeReq(`${RECEIVER}?token=${SECRET}`)
        const res = verifyWpEvent(req, emitterBody('https://client.example.com'))
        expect(res.ok).toBe(true)
        if (res.ok) expect(res.siteUrl).toBe('https://client.example.com')
    })

    it('accepts the token via the X-Koto-Webhook-Token header (forward-compat)', () => {
        const req = makeReq(RECEIVER, { 'X-Koto-Webhook-Token': SECRET })
        const res = verifyWpEvent(req, emitterBody())
        expect(res.ok).toBe(true)
    })

    it('rejects a POST with no token at all (missing auth)', () => {
        const req = makeReq(RECEIVER)
        const res = verifyWpEvent(req, emitterBody())
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toMatch(/missing token/)
    })

    it('rejects a POST with a tampered/invalid token', () => {
        const req = makeReq(`${RECEIVER}?token=${SECRET}-WRONG`)
        const res = verifyWpEvent(req, emitterBody())
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toMatch(/invalid token/)
    })

    it('fails closed when the server secret env var is not set', () => {
        vi.stubEnv('KOTOIQ_WP_EVENT_SECRET', '')
        const req = makeReq(`${RECEIVER}?token=${SECRET}`)
        const res = verifyWpEvent(req, emitterBody())
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toMatch(/misconfigured/)
    })

    it('rejects a valid-token POST whose body is not valid JSON', () => {
        const req = makeReq(`${RECEIVER}?token=${SECRET}`)
        const res = verifyWpEvent(req, 'not-json{{')
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toMatch(/invalid json/)
    })

    it('rejects a valid-token POST whose body omits site_url', () => {
        const req = makeReq(`${RECEIVER}?token=${SECRET}`)
        const res = verifyWpEvent(req, JSON.stringify({ event: 'save_post', payload: {} }))
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.reason).toMatch(/missing site_url/)
    })
})
