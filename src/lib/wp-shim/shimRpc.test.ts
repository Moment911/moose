import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    generateKeyPairSync,
    verify as cryptoVerify,
    type KeyObject,
} from 'node:crypto'
import { shimRpc, shimRpcBatch } from './shimRpc'
import type { ShimVerb } from './verbList'

// ─────────────────────────────────────────────────────────────────────────────
// shimRpc.test — proves the dashboard signer produces envelopes that match
// the PHP verifier's expectations byte-for-byte:
//
//   payload   = base64url(JSON({verb, args, iat, exp, nonce}))
//   signature = base64url(Ed25519(payload_bytes))
//
// The "signature round-trip" test is the canonical contract check: it
// generates a fresh Ed25519 keypair, signs via shimRpc, and verifies via
// crypto.verify(null, payloadBytes, pubKey, sigBytes) — the exact algorithm
// PHP's sodium_crypto_sign_verify_detached performs server-side.
// ─────────────────────────────────────────────────────────────────────────────

let fixturePrivPem: string
let fixturePubKey: KeyObject

beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    fixturePubKey = publicKey
    fixturePrivPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString('utf8')
})

beforeEach(() => {
    vi.stubEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY', Buffer.from(fixturePrivPem, 'utf8').toString('base64'))
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

function mockFetch(response: {
    status: number
    body?: unknown
    statusText?: string
}): ReturnType<typeof vi.fn> {
    const fn = vi.fn().mockResolvedValue({
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText ?? '',
        text: async () => (response.body == null ? '' : JSON.stringify(response.body)),
    } as unknown as Response)
    vi.stubGlobal('fetch', fn)
    return fn
}

describe('shimRpc — Ed25519 signed envelope', () => {
    it('produces a signature that verifies against the matching public key (round-trip)', async () => {
        const fetchMock = mockFetch({ status: 200, body: { ok: true, pong: 1 } })

        await shimRpc('https://example.com', 'health.ping', { foo: 'bar' })

        expect(fetchMock).toHaveBeenCalledOnce()
        const [, init] = fetchMock.mock.calls[0]!
        const body = JSON.parse((init as RequestInit).body as string) as {
            payload: string
            signature: string
        }

        const payloadBytes = Buffer.from(body.payload, 'base64url')
        const signatureBytes = Buffer.from(body.signature, 'base64url')

        const verified = cryptoVerify(null, payloadBytes, fixturePubKey, signatureBytes)
        expect(verified).toBe(true)

        // Decode and assert the claim shape
        const claims = JSON.parse(payloadBytes.toString('utf8')) as Record<string, unknown>
        expect(claims.verb).toBe('health.ping')
        expect(claims.args).toEqual({ foo: 'bar' })
        expect(typeof claims.iat).toBe('number')
        expect(typeof claims.exp).toBe('number')
        expect(typeof claims.nonce).toBe('string')
        expect(claims.exp).toBe((claims.iat as number) + 60)
        // uuid v4 shape
        expect(claims.nonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('POSTs to the /wp-json/kotoiq-shim/v1/rpc endpoint on the given site', async () => {
        const fetchMock = mockFetch({ status: 200, body: { ok: true } })
        await shimRpc('https://example.com/', 'health.ping')
        const [url, init] = fetchMock.mock.calls[0]!
        expect(url).toBe('https://example.com/wp-json/kotoiq-shim/v1/rpc')
        expect((init as RequestInit).method).toBe('POST')
        const headers = (init as RequestInit).headers as Record<string, string>
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('passes Idempotency-Key header when provided', async () => {
        const fetchMock = mockFetch({ status: 200, body: { ok: true } })
        await shimRpc('https://example.com', 'elementor.save', {}, { idempotencyKey: 'abc-123' })
        const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
        expect(headers['Idempotency-Key']).toBe('abc-123')
    })

    it('omits Idempotency-Key when not provided', async () => {
        const fetchMock = mockFetch({ status: 200, body: { ok: true } })
        await shimRpc('https://example.com', 'health.ping')
        const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
        expect(headers['Idempotency-Key']).toBeUndefined()
    })
})

describe('shimRpc — discriminated response', () => {
    it('returns {ok: true, data, status: 200} on 200', async () => {
        mockFetch({ status: 200, body: { result: 42 } })
        const res = await shimRpc<{ result: number }>('https://example.com', 'health.ping')
        expect(res.ok).toBe(true)
        if (res.ok) {
            expect(res.data).toEqual({ result: 42 })
            expect(res.status).toBe(200)
        }
    })

    it('returns {ok: false, error: http_error, status: 401} on 401 with WP-style error body', async () => {
        mockFetch({
            status: 401,
            statusText: 'Unauthorized',
            body: { code: 'bad_sig', message: 'Invalid signature' },
        })
        const res = await shimRpc('https://example.com', 'health.ping')
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(401)
            expect(res.error.code).toBe('bad_sig')
            expect(res.error.message).toBe('Invalid signature')
        }
    })

    it('returns {ok: false, error: http_error} when WP returns non-JSON 500', async () => {
        mockFetch({ status: 500, statusText: 'Internal Server Error', body: undefined })
        const res = await shimRpc('https://example.com', 'health.ping')
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(500)
            expect(res.error.code).toBe('http_error')
            expect(res.error.message).toContain('Internal Server Error')
        }
    })

    it('returns {ok: false, error: network_error, status: 0} when fetch throws', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
        vi.stubGlobal('fetch', fn)
        const res = await shimRpc('https://example.com', 'health.ping')
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(0)
            expect(res.error.code).toBe('network_error')
            expect(res.error.message).toBe('ECONNREFUSED')
        }
    })

    it('returns {ok: false, error: sign_error, status: 0} when env key is missing', async () => {
        vi.unstubAllEnvs()
        vi.stubEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY', '')
        mockFetch({ status: 200, body: { ok: true } })
        const res = await shimRpc('https://example.com', 'health.ping')
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(0)
            expect(res.error.code).toBe('sign_error')
        }
    })
})

describe('shimRpc — verb guard', () => {
    it('throws TypeError when called with a verb not in SHIM_VERBS', async () => {
        mockFetch({ status: 200, body: { ok: true } })
        await expect(
            shimRpc('https://example.com', 'evil.delete_all' as unknown as ShimVerb),
        ).rejects.toThrow(/Unknown verb/)
    })

    it('accepts every verb in the canonical whitelist', async () => {
        mockFetch({ status: 200, body: { ok: true } })
        // Sample a few across all three categories
        await expect(shimRpc('https://example.com', 'health.ping')).resolves.toBeDefined()
        await expect(shimRpc('https://example.com', 'meta.update')).resolves.toBeDefined()
        await expect(shimRpc('https://example.com', 'database.update_bulk')).resolves.toBeDefined()
    })
})

describe('shimRpc — silence (no payload/signature logging)', () => {
    it('never logs the envelope to console.* during a successful call', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
        mockFetch({ status: 200, body: { ok: true } })
        await shimRpc('https://example.com', 'health.ping', { sensitive: 'data' })
        expect(logSpy).not.toHaveBeenCalled()
        expect(errSpy).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
        expect(infoSpy).not.toHaveBeenCalled()
    })
})

describe('shimRpcBatch', () => {
    it('issues all calls in parallel and returns one response per call', async () => {
        let n = 0
        const fn = vi.fn().mockImplementation(async () => {
            n++
            return {
                ok: true,
                status: 200,
                statusText: '',
                text: async () => JSON.stringify({ index: n }),
            } as unknown as Response
        })
        vi.stubGlobal('fetch', fn)

        const results = await shimRpcBatch('https://example.com', [
            { verb: 'health.ping' },
            { verb: 'health.diagnostics' },
            { verb: 'plugin.list' },
        ])

        expect(results).toHaveLength(3)
        expect(fn).toHaveBeenCalledTimes(3)
        for (const r of results) expect(r.ok).toBe(true)
    })
})
