import { createPrivateKey, randomUUID, sign as cryptoSign, type KeyObject } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard-side helper to call the shim's /self-update REST route.
//
// /self-update lives outside the verb dispatcher (it's at
// /wp-json/kotoiq-shim/v1/self-update) but uses the same
// kotoiq_shim_auth_check permission callback — same signed envelope shape.
//
// Mirrors shimDestruct.ts. Separate file because:
//   - shimRpc hardcodes the path to /rpc and validates verb ∈ SHIM_VERBS.
//   - /self-update doesn't have a "verb" in the dispatcher sense — the
//     plugin handler reads args from the verified payload directly.
//
// The wp-plugin-kotoiq-shim/includes/self-update.php handler:
//   - download_url (HTTPS only)
//   - sha256 (64 hex chars — verifies the downloaded file)
//   - version (string, target version label)
// It downloads the zip, verifies the checksum, then runs WP's
// Plugin_Upgrader to install it on top of the running plugin.
// ─────────────────────────────────────────────────────────────────────────────

const PRIVKEY_ENV = 'KOTOIQ_SHIM_DASHBOARD_PRIVKEY'

function loadPrivateKey(): KeyObject {
    const b64 = process.env[PRIVKEY_ENV]
    if (!b64) throw new Error(`[shimSelfUpdate] Missing env ${PRIVKEY_ENV}`)
    const pemBuf = Buffer.from(b64, 'base64')
    return createPrivateKey({ key: pemBuf, format: 'pem' })
}

export interface ShimSelfUpdateArgs {
    download_url: string
    sha256: string
    version: string
}

export interface ShimSelfUpdateResult {
    ok: boolean
    httpStatus: number
    /** Plugin's reported result after upgrade (free-form, set by WP_Upgrader) */
    data?: unknown
    error?: { code: string; message: string }
}

/**
 * Sign + POST a self-update envelope. The shim downloads the zip, verifies
 * sha256, and installs it via WP's Plugin_Upgrader.
 *
 * Never throws. Returns a structured result. Caller usually re-checks the
 * site's reported plugin version afterward to confirm the upgrade landed.
 */
export async function shimSelfUpdate(
    siteUrl: string,
    args: ShimSelfUpdateArgs,
    options: { timeoutMs?: number } = {},
): Promise<ShimSelfUpdateResult> {
    // The shim's download_url() helper itself can take a beat for big plugins
    // plus Plugin_Upgrader runs synchronously — default 60s to be safe.
    const timeoutMs = options.timeoutMs ?? 60_000

    const iat = Math.floor(Date.now() / 1000)
    const claims = {
        verb: 'plugin.self_update', // synthetic — handler reads args, ignores verb
        args,
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

    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/kotoiq-shim/v1/self-update`
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
    let parsed: any = null
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

    return { ok: true, httpStatus: res.status, data: parsed }
}
