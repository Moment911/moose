import { createPrivateKey, randomUUID, sign as cryptoSign, type KeyObject } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard-side helper to call the shim's /destruct REST route.
//
// /destruct lives outside the verb dispatcher (it's a one-off REST route at
// /wp-json/kotoiq-shim/v1/destruct) but uses the same kotoiq_shim_auth_check
// permission callback — meaning the same signed envelope shape is required.
//
// Why a separate helper instead of extending shimRpc:
//   - shimRpc hardcodes the path to /rpc and validates verb ∈ SHIM_VERBS.
//   - /destruct doesn't have a "verb" in the dispatcher sense; we just need
//     the payload to satisfy auth.php's `isset($decoded['verb'])` check.
// ─────────────────────────────────────────────────────────────────────────────

const PRIVKEY_ENV = 'KOTOIQ_SHIM_DASHBOARD_PRIVKEY'

function loadPrivateKey(): KeyObject {
    const b64 = process.env[PRIVKEY_ENV]
    if (!b64) {
        throw new Error(`[shimDestruct] Missing env ${PRIVKEY_ENV}`)
    }
    const pemBuf = Buffer.from(b64, 'base64')
    return createPrivateKey({ key: pemBuf, format: 'pem' })
}

export interface ShimDestructResult {
    ok: boolean
    /** Plugin reported it cleared the pubkey + App Password */
    keyCleared?: boolean
    /** Plugin scheduled deactivation (only when deactivate:true was sent) */
    deactivateScheduled?: boolean
    httpStatus: number
    error?: { code: string; message: string }
}

/**
 * Sign + POST a destruct envelope to the shim.
 *
 * On success the WP plugin:
 *   - deletes the stored dashboard pubkey
 *   - deletes the pairing-ready flag, dashboard URL, features list
 *   - revokes the "kotoiq-shim-rpc" App Password on the koto_service user
 *   - optionally schedules plugin self-deactivation (when deactivate:true)
 *
 * Never throws. Always returns a structured result. Callers should clear the
 * DB fields regardless of result.ok — the dashboard's source of truth can
 * still be cleaned even if the WP site is offline or the envelope rejected.
 */
export async function shimDestruct(
    siteUrl: string,
    options: { deactivate?: boolean; timeoutMs?: number } = {},
): Promise<ShimDestructResult> {
    const timeoutMs = options.timeoutMs ?? 15_000

    const iat = Math.floor(Date.now() / 1000)
    const claims = {
        verb: 'plugin.destruct',
        args: { deactivate: !!options.deactivate },
        iat,
        exp: iat + 60,
        nonce: randomUUID(),
    }
    const payloadBytes = Buffer.from(JSON.stringify(claims), 'utf8')

    let signatureBytes: Buffer
    try {
        const privKey = loadPrivateKey()
        signatureBytes = cryptoSign(null, payloadBytes, privKey)
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'sign failed'
        return { ok: false, httpStatus: 0, error: { code: 'sign_error', message: msg } }
    }

    const envelope = {
        payload: payloadBytes.toString('base64url'),
        signature: signatureBytes.toString('base64url'),
    }

    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/kotoiq-shim/v1/destruct`
    let res: Response
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(envelope),
            signal: AbortSignal.timeout(timeoutMs),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'network error'
        return { ok: false, httpStatus: 0, error: { code: 'network_error', message: msg } }
    }

    const text = await res.text().catch(() => '')
    let parsed: { ok?: boolean; key_cleared?: boolean; deactivate?: string | boolean; code?: string; message?: string } | null = null
    if (text) {
        try {
            parsed = JSON.parse(text)
        } catch {
            parsed = null
        }
    }

    if (!res.ok) {
        return {
            ok: false,
            httpStatus: res.status,
            error: {
                code: parsed?.code || 'http_error',
                message: parsed?.message || res.statusText || `HTTP ${res.status}`,
            },
        }
    }

    return {
        ok: true,
        keyCleared: !!parsed?.key_cleared,
        deactivateScheduled: parsed?.deactivate === 'scheduled' || parsed?.deactivate === true,
        httpStatus: res.status,
    }
}
