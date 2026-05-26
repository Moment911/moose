import { afterEach, describe, expect, it, vi } from 'vitest'
import { wpFetch, wpFetchJson } from './wpFetch'

// ─────────────────────────────────────────────────────────────────────────────
// wpFetch.test — proves Basic auth header construction byte-for-byte and
// verifies no Bearer token / no App Password ever appears in error messages.
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

const CREDS = { username: 'koto_service', appPassword: 'abcd efgh ijkl mnop qrst uvwx' }

describe('wpFetch — Basic auth header', () => {
    it('builds Basic auth header byte-for-byte (koto_service:abcd efgh)', async () => {
        const fn = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
        } as unknown as Response)
        vi.stubGlobal('fetch', fn)

        await wpFetch('https://example.com', '/wp/v2/users/me', {
            username: 'koto_service',
            appPassword: 'abcd efgh',
        })

        const headers = (fn.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
        // base64('koto_service:abcd efgh') == 'a290b19zZXJ2aWNlOmFiY2QgZWZnaA=='
        expect(headers.Authorization).toBe('Basic a290b19zZXJ2aWNlOmFiY2QgZWZnaA==')
    })

    it('does NOT use Bearer auth (per RESEARCH Pitfall 1)', async () => {
        const fn = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
        } as unknown as Response)
        vi.stubGlobal('fetch', fn)

        await wpFetch('https://example.com', '/wp/v2/posts', CREDS)
        const headers = (fn.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
        expect(headers.Authorization).toMatch(/^Basic /)
        expect(headers.Authorization).not.toMatch(/Bearer/)
    })

    it('prepends /wp-json to the path', async () => {
        const fn = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
        } as unknown as Response)
        vi.stubGlobal('fetch', fn)

        await wpFetch('https://example.com', '/wp/v2/posts/42', CREDS)
        expect(fn.mock.calls[0]![0]).toBe('https://example.com/wp-json/wp/v2/posts/42')
    })

    it('handles trailing slash in siteUrl correctly', async () => {
        const fn = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
        } as unknown as Response)
        vi.stubGlobal('fetch', fn)

        await wpFetch('https://example.com/', '/wp/v2/posts/42', CREDS)
        expect(fn.mock.calls[0]![0]).toBe('https://example.com/wp-json/wp/v2/posts/42')
    })

    it('handles path without leading slash', async () => {
        const fn = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
        } as unknown as Response)
        vi.stubGlobal('fetch', fn)

        await wpFetch('https://example.com', 'wp/v2/posts/42', CREDS)
        expect(fn.mock.calls[0]![0]).toBe('https://example.com/wp-json/wp/v2/posts/42')
    })

    it('returns the Response as-is for caller to decode', async () => {
        const mockRes = {
            ok: true,
            status: 200,
            text: async () => '{"id": 42}',
        } as unknown as Response
        const fn = vi.fn().mockResolvedValue(mockRes)
        vi.stubGlobal('fetch', fn)
        const res = await wpFetch('https://example.com', '/wp/v2/posts/42', CREDS)
        expect(res).toBe(mockRes)
    })

    it('throws if credentials missing username or appPassword', async () => {
        await expect(
            wpFetch('https://example.com', '/wp/v2/posts', { username: '', appPassword: 'x' }),
        ).rejects.toThrow(/username and appPassword/)
        await expect(
            wpFetch('https://example.com', '/wp/v2/posts', { username: 'x', appPassword: '' }),
        ).rejects.toThrow(/username and appPassword/)
    })
})

describe('wpFetch — error redaction', () => {
    it('NEVER includes the App Password in a thrown network error message', async () => {
        // Construct a fetch error message that maliciously contains the app password
        const fn = vi.fn().mockRejectedValue(
            new Error('connection failed; original headers had Authorization: Basic a290b19zZXJ2aWNlOmFiY2QgZWZnaA=='),
        )
        vi.stubGlobal('fetch', fn)

        let caught: unknown = null
        try {
            await wpFetch('https://example.com', '/wp/v2/posts', CREDS)
        } catch (err) {
            caught = err
        }
        expect(caught).toBeInstanceOf(Error)
        const msg = (caught as Error).message
        // The full Basic <b64> token must NOT be present
        expect(msg).not.toContain('a290b19zZXJ2aWNlOmFiY2QgZWZnaA==')
        // The redaction marker should appear
        expect(msg).toContain('Basic <redacted>')
    })
})

describe('wpFetchJson', () => {
    it('returns {ok: true, data, status} on success', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ id: 42, title: 'hi' }),
            } as unknown as Response),
        )

        const res = await wpFetchJson<{ id: number; title: string }>(
            'https://example.com',
            '/wp/v2/posts/42',
            CREDS,
        )
        expect(res.ok).toBe(true)
        if (res.ok) {
            expect(res.data).toEqual({ id: 42, title: 'hi' })
            expect(res.status).toBe(200)
        }
    })

    it('returns {ok: false, error, status: 401} on auth failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => JSON.stringify({ code: 'rest_not_logged_in', message: 'Not authenticated' }),
            } as unknown as Response),
        )

        const res = await wpFetchJson('https://example.com', '/wp/v2/users/me', CREDS)
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(401)
            expect(res.error).toBe('Not authenticated')
        }
    })

    it('returns {ok: false, error, status: 0} on network error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
        const res = await wpFetchJson('https://example.com', '/wp/v2/posts', CREDS)
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.status).toBe(0)
            expect(res.error).toContain('ECONNREFUSED')
        }
    })
})
