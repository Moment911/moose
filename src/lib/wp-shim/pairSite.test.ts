import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { extractRawEd25519Pubkey, openPairingWindow, pairSite } from './pairSite'

// ─────────────────────────────────────────────────────────────────────────────
// pairSite.test — proves the full pair-flow contract:
//   - Fingerprint mismatch refuses the pair
//   - health.ping failure does NOT leave credentials stored (rollback)
//   - Happy path writes both audit rows (pair_completed + health_verified)
//   - Missing env throws an explicit error
// ─────────────────────────────────────────────────────────────────────────────

let fixturePubPem: string
let fixturePrivPem: string
let fixtureRawPubkey: Buffer
let fixtureFingerprint: string

beforeAll(() => {
    const kp = generateKeyPairSync('ed25519')
    fixturePubPem = kp.publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8')
    fixturePrivPem = kp.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString('utf8')
    const spki = kp.publicKey.export({ format: 'der', type: 'spki' }) as Buffer
    fixtureRawPubkey = spki.subarray(spki.length - 32)
    fixtureFingerprint = createHash('sha256').update(fixtureRawPubkey).digest('hex')
})

beforeEach(() => {
    vi.stubEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY', Buffer.from(fixturePrivPem, 'utf8').toString('base64'))
    vi.stubEnv('KOTOIQ_SHIM_DASHBOARD_PUBKEY', Buffer.from(fixturePubPem, 'utf8').toString('base64'))
    vi.stubEnv('KOTO_AGENCY_INTEGRATIONS_KEK', '0'.repeat(64)) // 32-byte hex
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://hellokoto.com')
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

// ── Mock Supabase client ────────────────────────────────────────────────────

interface FakeSupabaseRecorder {
    inserts: Array<{ table: string; row: Record<string, unknown> }>
    updates: Array<{ table: string; patch: Record<string, unknown> }>
}

function makeFakeSupabase(opts?: { updateError?: { message: string } }) {
    const recorder: FakeSupabaseRecorder = { inserts: [], updates: [] }

    function chain(table: string) {
        return {
            insert: (row: Record<string, unknown>) => {
                recorder.inserts.push({ table, row })
                return Promise.resolve({ data: null, error: null })
            },
            update: (patch: Record<string, unknown>) => {
                recorder.updates.push({ table, patch })
                return {
                    eq: () => ({
                        eq: () => Promise.resolve({ data: null, error: opts?.updateError ?? null }),
                    }),
                }
            },
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                }),
            }),
        }
    }

    const fake = { from: (table: string) => chain(table) }
    return { fake: fake as never, recorder }
}

// ── Mock fetch — handles both /pair and shimRpc /rpc ────────────────────────

interface FetchScenario {
    pair?: { status: number; body?: unknown }
    health?: { status: number; body?: unknown }
}

function mockFetchScenarios(scenarios: FetchScenario) {
    const fn = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wp-json/kotoiq-shim/v1/pair')) {
            const s = scenarios.pair ?? { status: 200, body: { ok: true } }
            return {
                ok: s.status >= 200 && s.status < 300,
                status: s.status,
                statusText: '',
                text: async () => (s.body == null ? '' : JSON.stringify(s.body)),
            } as unknown as Response
        }
        if (url.includes('/wp-json/kotoiq-shim/v1/rpc')) {
            const s = scenarios.health ?? { status: 200, body: { ok: true, pong: 1 } }
            return {
                ok: s.status >= 200 && s.status < 300,
                status: s.status,
                statusText: '',
                text: async () => (s.body == null ? '' : JSON.stringify(s.body)),
            } as unknown as Response
        }
        throw new Error(`Unexpected URL ${url}`)
    })
    vi.stubGlobal('fetch', fn)
    return fn
}

// ─── extractRawEd25519Pubkey ─────────────────────────────────────────────────

describe('extractRawEd25519Pubkey', () => {
    it('extracts the 32-byte raw key from a base64-wrapped PEM', () => {
        const raw = extractRawEd25519Pubkey(Buffer.from(fixturePubPem, 'utf8').toString('base64'))
        expect(raw.length).toBe(32)
        expect(raw.equals(fixtureRawPubkey)).toBe(true)
    })

    it('accepts raw 32-byte base64 directly (operator-friendly)', () => {
        const raw = extractRawEd25519Pubkey(fixtureRawPubkey.toString('base64'))
        expect(raw.length).toBe(32)
        expect(raw.equals(fixtureRawPubkey)).toBe(true)
    })

    it('throws on empty input', () => {
        expect(() => extractRawEd25519Pubkey('')).toThrow(/Missing env/)
    })

    it('throws on input that is neither raw 32 bytes nor valid PEM', () => {
        expect(() => extractRawEd25519Pubkey(Buffer.from('not a pem').toString('base64'))).toThrow(
            /neither raw 32 bytes nor a valid PEM/,
        )
    })
})

// ─── openPairingWindow ────────────────────────────────────────────────────────

describe('openPairingWindow', () => {
    it('produces a wp-cli snippet referencing kotoiq_shim_pairing_ready', () => {
        const out = openPairingWindow('https://example.com')
        expect(out.wpCliSnippet).toContain('kotoiq_shim_pairing_ready')
        expect(out.wpCliSnippet).toContain('example.com')
        expect(out.ttlSeconds).toBe(600)
        expect(out.restInstructions.length).toBeGreaterThan(0)
    })
})

// ─── pairSite happy path ─────────────────────────────────────────────────────

describe('pairSite — happy path', () => {
    it('completes the full flow and writes both audit rows', async () => {
        mockFetchScenarios({
            pair: {
                status: 200,
                body: {
                    ok: true,
                    plugin: 'kotoiq-shim',
                    version: '4.0.0',
                    site_url: 'https://example.com',
                    site_name: 'Example',
                    fingerprint: fixtureFingerprint,
                    app_password_username: 'koto_service',
                    app_password: 'abcd efgh ijkl mnop qrst uvwx',
                    wp_version: '6.6',
                    php_version: '8.2.0',
                },
            },
            health: { status: 200, body: { ok: true, pong: 1 } },
        })

        const { fake, recorder } = makeFakeSupabase()
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')

        expect(res.ok).toBe(true)
        if (res.ok) {
            expect(res.data?.fingerprint).toBe(fixtureFingerprint)
            expect(res.data?.pairedAt).toBeTruthy()
        }

        // Audit rows: pair_completed + health_verified
        const events = recorder.inserts.map(i => i.row.event)
        expect(events).toContain('pair_completed')
        expect(events).toContain('health_verified')
        expect(recorder.inserts.length).toBeGreaterThanOrEqual(2)

        // Credentials stored after health verification
        const credUpdate = recorder.updates.find(u => u.table === 'koto_wp_sites')
        expect(credUpdate).toBeDefined()
        expect(credUpdate?.patch.shim_version).toBe('v4')
        expect(credUpdate?.patch.app_password_username).toBe('koto_service')
        expect(credUpdate?.patch.dashboard_pubkey_fingerprint).toBe(fixtureFingerprint)
        // The encrypted payload is JSON-encoded
        expect(typeof credUpdate?.patch.app_password_encrypted).toBe('string')
        // Plaintext App Password must NOT appear in the stored patch
        const patchStr = JSON.stringify(credUpdate?.patch)
        expect(patchStr).not.toContain('abcd efgh ijkl mnop qrst uvwx')
    })
})

// ─── pairSite error paths ────────────────────────────────────────────────────

describe('pairSite — error paths', () => {
    it('returns not_ready when pair endpoint returns 403 not_ready', async () => {
        mockFetchScenarios({
            pair: { status: 403, body: { code: 'not_ready', message: 'Site is not ready to pair' } },
        })
        const { fake, recorder } = makeFakeSupabase()
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')

        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error?.code).toBe('not_ready')
        // No audit rows on pre-pair failure
        expect(recorder.inserts.length).toBe(0)
    })

    it('returns fingerprint_mismatch when pair returns a different fingerprint', async () => {
        const wrongFingerprint = 'a'.repeat(64)
        mockFetchScenarios({
            pair: {
                status: 200,
                body: {
                    ok: true,
                    plugin: 'kotoiq-shim',
                    version: '4.0.0',
                    site_url: 'https://example.com',
                    site_name: 'Example',
                    fingerprint: wrongFingerprint,
                    app_password_username: 'koto_service',
                    app_password: 'xxx yyy zzz',
                    wp_version: '6.6',
                    php_version: '8.2.0',
                },
            },
        })
        const { fake, recorder } = makeFakeSupabase()
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')

        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error?.code).toBe('fingerprint_mismatch')
        // No credentials stored
        expect(recorder.updates.find(u => u.table === 'koto_wp_sites')).toBeUndefined()
    })

    it('returns health_verification_failed and does NOT store credentials when health.ping returns 401', async () => {
        mockFetchScenarios({
            pair: {
                status: 200,
                body: {
                    ok: true,
                    plugin: 'kotoiq-shim',
                    version: '4.0.0',
                    site_url: 'https://example.com',
                    site_name: 'Example',
                    fingerprint: fixtureFingerprint,
                    app_password_username: 'koto_service',
                    app_password: 'plaintext-must-not-persist',
                    wp_version: '6.6',
                    php_version: '8.2.0',
                },
            },
            health: { status: 401, body: { code: 'bad_sig', message: 'Invalid signature' } },
        })
        const { fake, recorder } = makeFakeSupabase()
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')

        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error?.code).toBe('health_verification_failed')

        // No credentials stored — the half-paired-site guard
        expect(recorder.updates.find(u => u.table === 'koto_wp_sites')).toBeUndefined()

        // Audit trail records pair_completed (from /pair success) then pair_failed
        const events = recorder.inserts.map(i => i.row.event)
        expect(events).toContain('pair_completed')
        expect(events).toContain('pair_failed')
        expect(events).not.toContain('health_verified')
    })

    it('throws explicit error when KOTOIQ_SHIM_DASHBOARD_PUBKEY is unset', async () => {
        vi.unstubAllEnvs()
        vi.stubEnv('KOTOIQ_SHIM_DASHBOARD_PRIVKEY', 'x') // present so loadPrivateKey doesn't blow first
        // PUBKEY env intentionally absent
        const { fake } = makeFakeSupabase()
        await expect(pairSite(fake, 'agency-A', 'site-1', 'https://example.com')).rejects.toThrow(
            /KOTOIQ_SHIM_DASHBOARD_PUBKEY/,
        )
    })

    it('returns store_credentials_failed when storeSiteCredentials throws', async () => {
        mockFetchScenarios({
            pair: {
                status: 200,
                body: {
                    ok: true,
                    plugin: 'kotoiq-shim',
                    version: '4.0.0',
                    site_url: 'https://example.com',
                    site_name: 'Example',
                    fingerprint: fixtureFingerprint,
                    app_password_username: 'koto_service',
                    app_password: 'pass',
                    wp_version: '6.6',
                    php_version: '8.2.0',
                },
            },
            health: { status: 200, body: { ok: true } },
        })
        const { fake } = makeFakeSupabase({ updateError: { message: 'permission denied' } })
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')
        expect(res.ok).toBe(false)
        if (!res.ok) expect(res.error?.code).toBe('store_credentials_failed')
    })

    it('returns network_error when /pair throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
        const { fake } = makeFakeSupabase()
        const res = await pairSite(fake, 'agency-A', 'site-1', 'https://example.com')
        expect(res.ok).toBe(false)
        if (!res.ok) {
            expect(res.error?.code).toBe('network_error')
            expect(res.error?.message).toContain('ECONNREFUSED')
        }
    })
})
