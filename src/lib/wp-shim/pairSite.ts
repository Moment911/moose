import 'server-only'
import { createHash, createPublicKey } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { shimRpc } from './shimRpc'
import { storeSiteCredentials } from './credentialsVault'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 03 — end-to-end site pairing flow.
//
// Steps performed:
//   1. Extract the raw 32-byte Ed25519 pubkey from the PEM stored in env
//   2. POST {dashboard_pubkey, dashboard_url} to /wp-json/kotoiq-shim/v1/pair
//   3. Verify the returned fingerprint matches sha256(raw pubkey we sent)
//   4. Audit-log pair_completed to koto_wp_shim_pairings
//   5. Run shimRpc('health.ping') to verify the freshly stored pubkey works
//   6. Only after health.ping succeeds — encrypt + store the App Password
//      (deferred so a broken pair never leaves a half-paired row)
//   7. Audit-log health_verified to koto_wp_shim_pairings
//
// Threats mitigated (see 10-03-PLAN.md <threat_model>):
//   T-10-03-03  Per-site fingerprint mismatch (DNS hijack)  — sha256 compare
//   T-10-03-04  No audit trail of pair attempts              — 2 rows logged
//   T-10-03-07  Half-paired site after health failure        — defer store_creds
// ─────────────────────────────────────────────────────────────────────────────

const PUBKEY_ENV = 'KOTOIQ_SHIM_DASHBOARD_PUBKEY'

/**
 * Extract the raw 32-byte Ed25519 public key from a PEM blob.
 *
 * Ed25519 public keys ship as 44-byte SPKI DER (12-byte prefix + 32-byte
 * raw key). The PHP verifier expects only the trailing 32 bytes.
 *
 * Accepts the env shape from Plan 01: base64-encoded PEM. If decoding the
 * base64 yields PEM text, parse it; if it yields raw 32-byte bytes, return
 * them directly (operator may have pasted raw base64 by mistake — be lenient).
 */
export function extractRawEd25519Pubkey(pemBase64: string): Buffer {
    if (!pemBase64) {
        throw new Error(`[pairSite] Missing env ${PUBKEY_ENV} — set base64(PEM body) in Vercel Dashboard`)
    }

    // First: try base64-decoding to PEM text
    const decoded = Buffer.from(pemBase64, 'base64')

    // Already raw 32 bytes? (operator pasted base64 of raw pubkey, not PEM)
    if (decoded.length === 32) {
        return decoded
    }

    // Otherwise treat as PEM and ask Node to derive the SPKI DER
    let pubKeyObj
    try {
        pubKeyObj = createPublicKey({ key: decoded, format: 'pem' })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'parse failed'
        throw new Error(`[pairSite] ${PUBKEY_ENV} is neither raw 32 bytes nor a valid PEM: ${msg}`)
    }

    const spkiDer = pubKeyObj.export({ format: 'der', type: 'spki' }) as Buffer
    // Ed25519 SPKI DER is 44 bytes — the last 32 bytes are the raw key.
    if (spkiDer.length < 32) {
        throw new Error(`[pairSite] Unexpected SPKI length ${spkiDer.length} — not an Ed25519 key`)
    }
    return spkiDer.subarray(spkiDer.length - 32)
}

export interface OpenPairingWindowResult {
    /** wp-cli one-liner the operator runs ON the WP host */
    wpCliSnippet: string
    /** Plain-English steps for the dashboard UI to surface */
    restInstructions: string[]
    /** Window length in seconds (matches plugin's KOTOIQ_SHIM_PAIRING_READY_TTL) */
    ttlSeconds: number
}

/**
 * Generate the operator instructions for opening a 10-minute pairing window.
 *
 * The shim plugin gates /pair on a server-side `kotoiq_shim_pairing_ready`
 * option. To open the window, the operator runs wp-cli on the WP host (or,
 * if SSH is unavailable, toggles the option manually in WP admin → Tools →
 * KotoIQ Shim Settings, once Plan 11 ships that UI).
 */
export function openPairingWindow(siteUrl: string): OpenPairingWindowResult {
    const ttlSeconds = 600
    const wpCliSnippet =
        `ssh user@${new URL(siteUrl).hostname} ` +
        `'wp option update kotoiq_shim_pairing_ready $(( $(date +%s) + ${ttlSeconds} ))'`

    const restInstructions = [
        `Run on the WP host (10-minute window opens immediately):`,
        wpCliSnippet,
        `Then click "Pair site" within ${Math.floor(ttlSeconds / 60)} minutes.`,
        `If SSH is unavailable, ask the site administrator to open the window manually via WP admin → Tools → KotoIQ Shim → Settings (Plan 11 admin UI).`,
    ]

    return { wpCliSnippet, restInstructions, ttlSeconds }
}

export interface PairData {
    fingerprint: string
    healthPing: unknown
    pairedAt: string
}

export interface PairSiteResult {
    ok: boolean
    data?: PairData
    error?: { code: string; message: string }
}

interface PairResponse {
    ok: boolean
    plugin: string
    version: string
    site_url: string
    site_name: string
    fingerprint: string
    app_password_username: string
    app_password: string
    wp_version: string
    php_version: string
}

/**
 * Orchestrate the full pairing handshake.
 *
 * On success: koto_wp_sites is updated with shim_version='v4', the encrypted
 * App Password, the dashboard_pubkey_fingerprint, and paired_at_v4; two audit
 * rows are inserted (pair_completed + health_verified).
 *
 * On failure: never leaves a half-paired site (storeSiteCredentials runs ONLY
 * after health.ping succeeds), and writes a pair_failed audit row.
 */
export async function pairSite(
    supabase: SupabaseClient,
    agencyId: string,
    siteId: string,
    siteUrl: string,
): Promise<PairSiteResult> {
    if (!agencyId) {
        return { ok: false, error: { code: 'missing_args', message: 'agencyId required' } }
    }
    if (!siteId) {
        return { ok: false, error: { code: 'missing_args', message: 'siteId required' } }
    }
    if (!siteUrl) {
        return { ok: false, error: { code: 'missing_args', message: 'siteUrl required' } }
    }

    // ── Step 1: extract raw pubkey from env ─────────────────────────────────
    const pubkeyEnv = process.env[PUBKEY_ENV]
    if (!pubkeyEnv) {
        throw new Error(`[pairSite] Missing env ${PUBKEY_ENV} — set in Vercel Dashboard`)
    }
    const rawPubkey = extractRawEd25519Pubkey(pubkeyEnv)
    const localFingerprint = createHash('sha256').update(rawPubkey).digest('hex')
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

    // ── Step 2: POST to /pair ───────────────────────────────────────────────
    const pairUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/kotoiq-shim/v1/pair`
    let pairRes: Response
    try {
        pairRes = await fetch(pairUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                dashboard_pubkey: rawPubkey.toString('base64'),
                dashboard_url: dashboardUrl,
            }),
            signal: AbortSignal.timeout(15_000),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'network error'
        return { ok: false, error: { code: 'network_error', message: msg } }
    }

    const pairText = await pairRes.text().catch(() => '')
    let pairBody: unknown = null
    if (pairText) {
        try {
            pairBody = JSON.parse(pairText)
        } catch {
            pairBody = null
        }
    }

    if (!pairRes.ok) {
        const errObj = pairBody && typeof pairBody === 'object' ? (pairBody as { code?: string; message?: string }) : {}
        return {
            ok: false,
            error: {
                code: errObj.code || 'pair_failed',
                message: errObj.message || `Pair endpoint returned ${pairRes.status}`,
            },
        }
    }

    const pair = pairBody as PairResponse
    if (!pair || !pair.fingerprint || !pair.app_password || !pair.app_password_username) {
        return { ok: false, error: { code: 'bad_pair_response', message: 'Pair response missing required fields' } }
    }

    // ── Step 3: verify fingerprint ──────────────────────────────────────────
    if (pair.fingerprint !== localFingerprint) {
        return {
            ok: false,
            error: {
                code: 'fingerprint_mismatch',
                message: `Pair returned fingerprint ${pair.fingerprint} but local computes ${localFingerprint} — possible DNS hijack or wrong key pair`,
            },
        }
    }

    // ── Step 4: audit pair_completed ───────────────────────────────────────
    await supabase.from('koto_wp_shim_pairings').insert({
        agency_id: agencyId,
        site_id: siteId,
        event: 'pair_completed',
        dashboard_pubkey_fingerprint: localFingerprint,
        notes: {
            wp_version: pair.wp_version,
            php_version: pair.php_version,
            plugin_version: pair.version,
            app_password_issued: true,
        },
    })

    // ── Step 5: verify the pair actually works via health.ping ─────────────
    // Done BEFORE storing the App Password so a broken pair never persists.
    const healthRes = await shimRpc<unknown>(siteUrl, 'health.ping', {})
    if (!healthRes.ok) {
        // Log the failure so on-call can diagnose
        await supabase.from('koto_wp_shim_pairings').insert({
            agency_id: agencyId,
            site_id: siteId,
            event: 'pair_failed',
            dashboard_pubkey_fingerprint: localFingerprint,
            notes: {
                stage: 'health_verification',
                error_code: healthRes.error.code,
                error_message: healthRes.error.message,
                http_status: healthRes.status,
            },
        })
        return {
            ok: false,
            error: {
                code: 'health_verification_failed',
                message: `Pair succeeded but health.ping failed: ${healthRes.error.message}`,
            },
        }
    }

    // ── Step 6: encrypt + store App Password ───────────────────────────────
    try {
        await storeSiteCredentials(supabase, agencyId, siteId, {
            username: pair.app_password_username,
            appPassword: pair.app_password,
            fingerprint: localFingerprint,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        await supabase.from('koto_wp_shim_pairings').insert({
            agency_id: agencyId,
            site_id: siteId,
            event: 'pair_failed',
            dashboard_pubkey_fingerprint: localFingerprint,
            notes: { stage: 'store_credentials', error_message: msg },
        })
        return { ok: false, error: { code: 'store_credentials_failed', message: msg } }
    }

    // ── Step 7: audit health_verified ──────────────────────────────────────
    const pairedAt = new Date().toISOString()
    await supabase.from('koto_wp_shim_pairings').insert({
        agency_id: agencyId,
        site_id: siteId,
        event: 'health_verified',
        dashboard_pubkey_fingerprint: localFingerprint,
        notes: { paired_at: pairedAt },
    })

    return {
        ok: true,
        data: {
            fingerprint: localFingerprint,
            healthPing: healthRes.data,
            pairedAt,
        },
    }
}
