import { createPrivateKey, randomUUID, sign as cryptoSign, type KeyObject } from 'node:crypto'
import { SHIM_VERBS, type ShimVerb } from './verbList'
import type { ShimRpcResponse } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 03 — dashboard signing client.
//
// Wire shape (matches wp-plugin-kotoiq-shim/includes/auth.php verbatim):
//   POST /wp-json/kotoiq-shim/v1/rpc
//   { payload:   base64url(JSON({verb, args, iat, exp, nonce}))
//   , signature: base64url(Ed25519 detached signature over payload bytes) }
//
// Trust model (per CONTEXT.md D-Authentication, USER-LOCKED):
//   - Private key lives only in process.env.KOTOIQ_SHIM_DASHBOARD_PRIVKEY
//     (base64-encoded PEM, set in Vercel env)
//   - Key is read at call time (lazy) so tests can swap via vi.stubEnv
//   - 60s expiry + uuid v4 nonce — replay protection enforced server-side
//   - Discriminated-union return: never throws on HTTP/transport error,
//     callers must `if (!res.ok) ...` explicitly
//
// Threats mitigated (see 10-03-PLAN.md <threat_model>):
//   T-10-03-01  Payload + signature leakage in logs  — NO console.* calls
//   T-10-03-02  Wrong verb sent                       — SHIM_VERBS.includes guard
//   T-10-03-08  Replay attack                         — fresh uuid + iat/exp per call
// ─────────────────────────────────────────────────────────────────────────────

const PRIVKEY_ENV = 'KOTOIQ_SHIM_DASHBOARD_PRIVKEY'

export interface ShimRpcOptions {
    /** Request timeout in ms. Default 15_000. */
    timeoutMs?: number
    /** Envelope expiry seconds-from-now. Default 60 (matches PHP verifier). */
    expSeconds?: number
    /** Optional Idempotency-Key passthrough. Used by verbs like elementor.save. */
    idempotencyKey?: string
}

/**
 * Lazily load and parse the dashboard's Ed25519 private key from env.
 * Reads on every call so tests can swap via vi.stubEnv without module reset.
 */
function loadPrivateKey(): KeyObject {
    const b64 = process.env[PRIVKEY_ENV]
    if (!b64) {
        throw new Error(
            `[shimRpc] Missing env ${PRIVKEY_ENV} — set base64(PEM body) in Vercel Dashboard`,
        )
    }
    // The env value is base64-encoded PEM per Plan 01's checkpoint.
    // Buffer.from('...', 'base64') is tolerant of stray newlines so this
    // works whether the operator pasted with or without line breaks.
    const pemBuf = Buffer.from(b64, 'base64')
    try {
        return createPrivateKey({ key: pemBuf, format: 'pem' })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        throw new Error(`[shimRpc] Could not parse ${PRIVKEY_ENV} as PEM: ${msg}`)
    }
}

/**
 * Sign an envelope and POST it to the shim.
 *
 * Returns a discriminated-union ShimRpcResponse — never throws. Callers must
 * inspect `.ok` before reading `.data`.
 */
export async function shimRpc<T = unknown>(
    siteUrl: string,
    verb: ShimVerb,
    args: Record<string, unknown> = {},
    options: ShimRpcOptions = {},
): Promise<ShimRpcResponse<T>> {
    // Runtime verb guard — TypeScript catches at compile time, but callers
    // may funnel through `as ShimVerb` casts; this protects the dispatcher.
    if (!(SHIM_VERBS as readonly string[]).includes(verb)) {
        throw new TypeError(`[shimRpc] Unknown verb: ${String(verb)}`)
    }

    const timeoutMs = options.timeoutMs ?? 15_000
    const expSeconds = options.expSeconds ?? 60

    // Build the inner payload. iat/exp/nonce structure matches the PHP
    // verifier in wp-plugin-kotoiq-shim/includes/auth.php.
    const iat = Math.floor(Date.now() / 1000)
    const claims = {
        verb,
        args,
        iat,
        exp: iat + expSeconds,
        nonce: randomUUID(),
    }
    const payloadBytes = Buffer.from(JSON.stringify(claims), 'utf8')

    // Sign with Ed25519: algorithm arg is null per Node crypto.d.ts
    // (algorithm is dependent on key type for Ed25519 / Ed448).
    let signatureBytes: Buffer
    try {
        const privKey = loadPrivateKey()
        signatureBytes = cryptoSign(null, payloadBytes, privKey)
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'sign failed'
        return {
            ok: false,
            error: { code: 'sign_error', message: msg },
            status: 0,
        }
    }

    const envelope = {
        payload: payloadBytes.toString('base64url'),
        signature: signatureBytes.toString('base64url'),
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    }
    if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey
    }

    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/kotoiq-shim/v1/rpc`

    let res: Response
    try {
        res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(envelope),
            signal: AbortSignal.timeout(timeoutMs),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'network error'
        return {
            ok: false,
            error: { code: 'network_error', message: msg },
            status: 0,
        }
    }

    // Try to parse the body as JSON — fall back to text for non-JSON
    // error pages (e.g. host hard-blocked the request).
    const text = await res.text().catch(() => '')
    let parsed: unknown = null
    if (text) {
        try {
            parsed = JSON.parse(text)
        } catch {
            parsed = null
        }
    }

    if (!res.ok) {
        const errData = parsed && typeof parsed === 'object'
            ? (parsed as { code?: string; message?: string })
            : {}
        return {
            ok: false,
            error: {
                code: errData.code || 'http_error',
                message: errData.message || res.statusText || `HTTP ${res.status}`,
            },
            status: res.status,
        }
    }

    return {
        ok: true,
        data: (parsed ?? null) as T,
        status: res.status,
    }
}

/**
 * Batch convenience — issue N parallel shimRpc calls. v1 is a thin
 * Promise.all wrapper; Plan 04 may upgrade this to use WP REST's native
 * batch framework (per CONTEXT.md, meta.update is the first call site).
 */
export async function shimRpcBatch<T = unknown>(
    siteUrl: string,
    calls: Array<{ verb: ShimVerb; args?: Record<string, unknown>; idempotencyKey?: string }>,
    options: ShimRpcOptions = {},
): Promise<Array<ShimRpcResponse<T>>> {
    return Promise.all(
        calls.map(call =>
            shimRpc<T>(siteUrl, call.verb, call.args ?? {}, {
                ...options,
                idempotencyKey: call.idempotencyKey ?? options.idempotencyKey,
            }),
        ),
    )
}
