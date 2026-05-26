// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 03 — WordPress core REST helper.
//
// Application Passwords use Basic auth (per 10-RESEARCH.md Pitfall 1 —
// token-style auth is explicitly NOT used here).
// Header format: `Authorization: Basic <base64(username:appPassword)>`.
//
// This file is framework-agnostic — no Next.js imports, no Supabase imports.
// Plans 10-07/08/09 (dashboard ports) call wpFetch directly with credentials
// loaded via credentialsVault.loadSiteCredentials.
//
// Threats mitigated (see 10-03-PLAN.md <threat_model>):
//   T-10-03-01  App Password leakage in errors  — sanitized at the boundary
// ─────────────────────────────────────────────────────────────────────────────

export interface WpCredentials {
    username: string
    appPassword: string
}

export interface WpFetchInit extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>
    /** Request timeout in ms. Default 15_000. */
    timeoutMs?: number
}

function buildBasicHeader(creds: WpCredentials): string {
    // Application Password contains spaces ("abcd efgh ijkl mnop qrst uvwx").
    // WordPress accepts the spaces in the user:password segment per RFC 7617.
    const raw = `${creds.username}:${creds.appPassword}`
    return 'Basic ' + Buffer.from(raw, 'utf8').toString('base64')
}

function joinUrl(siteUrl: string, path: string): string {
    const base = siteUrl.replace(/\/$/, '')
    const suffix = path.startsWith('/') ? path : `/${path}`
    return `${base}/wp-json${suffix}`
}

/**
 * Sanitize a transport error message to ensure the App Password never appears
 * in a thrown error string. We do NOT log here — caller decides what to do
 * with the error.
 */
function sanitizeError(err: unknown, url: string, status: number | null): Error {
    const msg = err instanceof Error ? err.message : String(err)
    // Defense in depth: even if a debug logger captured the full request init,
    // strip any "Basic <b64>" pattern before it reaches the consumer.
    const sanitized = msg.replace(/Basic [A-Za-z0-9+/=]+/g, 'Basic <redacted>')
    const statusPart = status === null ? '' : ` (status ${status})`
    return new Error(`[wpFetch] ${url}${statusPart}: ${sanitized}`)
}

/**
 * Authenticated fetch to a site's wp/v2/* REST API.
 *
 * Returns the raw Response so callers can stream binary content (media uploads),
 * inspect headers (pagination), or parse JSON themselves. For typed JSON
 * responses prefer wpFetchJson<T>.
 *
 * Never includes the App Password in error messages — sanitizeError strips
 * any Basic header that leaks into thrown messages.
 */
export async function wpFetch(
    siteUrl: string,
    path: string,
    creds: WpCredentials,
    init: WpFetchInit = {},
): Promise<Response> {
    if (!creds.username || !creds.appPassword) {
        throw new Error('[wpFetch] credentials require both username and appPassword')
    }

    const url = joinUrl(siteUrl, path)
    const { timeoutMs = 15_000, headers: extraHeaders, ...rest } = init

    const headers: Record<string, string> = {
        Authorization: buildBasicHeader(creds),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(extraHeaders || {}),
    }

    try {
        const res = await fetch(url, {
            ...rest,
            headers,
            signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
        })
        return res
    } catch (err) {
        throw sanitizeError(err, url, null)
    }
}

/**
 * Typed JSON convenience — parses the response body and returns a
 * discriminated shape. Like shimRpc, does NOT throw on HTTP error.
 */
export async function wpFetchJson<T = unknown>(
    siteUrl: string,
    path: string,
    creds: WpCredentials,
    init: WpFetchInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; data: null; status: number; error: string }> {
    let res: Response
    try {
        res = await wpFetch(siteUrl, path, creds, init)
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'network error'
        return { ok: false, data: null, status: 0, error: msg }
    }

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
        const errObj = parsed && typeof parsed === 'object'
            ? (parsed as { message?: string; code?: string })
            : null
        return {
            ok: false,
            data: null,
            status: res.status,
            error: errObj?.message || res.statusText || `HTTP ${res.status}`,
        }
    }

    return { ok: true, data: (parsed ?? null) as T, status: res.status }
}
