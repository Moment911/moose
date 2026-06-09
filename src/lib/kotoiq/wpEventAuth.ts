import 'server-only'
import { timingSafeEqual } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 Plan 11-01 — inbound WP-event auth (verifyWpEvent).
//
// AUTH SCHEME — capability token in the registered webhook URL.
//
// The shim's webhook emitter (wp-plugin-kotoiq-shim/runtime/webhook-emitter.php,
// LOCKED v4.2.5 — reference-only, NOT modified) sends NO authentication of its
// own. Read verbatim, every emitted POST is:
//
//   headers: { 'Content-Type': 'application/json', 'X-Koto-Shim-Event': <event> }
//   body:    { event, payload, site_url: home_url(), time }
//
// There is no shared secret, HMAC, or signature in the emitter. Because the
// plugin is locked we CANNOT add one plugin-side. The only authentication
// surface left to us is the URL we register via `webhook.set` — the emitter
// POSTs to whatever URL the dashboard stored (query string included, verbatim).
//
// So the dashboard registers a *capability URL* carrying a high-entropy bearer
// token, e.g.:
//
//   https://hellokoto.com/api/kotoiq/wp-event?token=<KOTOIQ_WP_EVENT_SECRET>
//
// Knowledge of that token == authorisation to post events (an OAuth-style
// bearer/capability token). verifyWpEvent accepts the token from EITHER the
// `token` query param (what the emitter actually sends, since it can only
// vary the URL) OR an `X-Koto-Webhook-Token` header (forward-compat if a
// future non-locked emitter sends a header). It compares against the env var
// in constant time and rejects anything missing/mismatched (ASVS V2 / V9; no
// open endpoint).
//
// REQUIRED ENV VAR (operator must add to Vercel — flagged in 11-01-SUMMARY):
//   KOTOIQ_WP_EVENT_SECRET  — high-entropy random string, e.g. `openssl rand -hex 32`.
//   The SAME value is embedded in the receiver URL registered via webhook.set
//   in orchestrateOnboarding(). Rotating it requires re-registering the webhooks.
//
// Threats mitigated (see 11-01-PLAN.md <threat_model>):
//   T-11-01  Spoofed open receiver  — reject any POST without the exact token.
//   T-11-02  Tampered payload       — site_url is parsed but only TRUSTED after
//                                      the route maps it to a known koto_wp_sites
//                                      row (defence in depth; done in the route).
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_ENV = 'KOTOIQ_WP_EVENT_SECRET'

export interface VerifyWpEventOk {
    ok: true
    /** site_url parsed from the body (home_url() of the WP site). UNTRUSTED until mapped to a site row. */
    siteUrl: string
}
export interface VerifyWpEventFail {
    ok: false
    reason: string
}
export type VerifyWpEventResult = VerifyWpEventOk | VerifyWpEventFail

/**
 * Constant-time string compare that never short-circuits on length.
 * Returns false (not throw) on any mismatch, including length mismatch.
 */
function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) {
        // timingSafeEqual throws on unequal lengths — compare a buffer against
        // itself to burn a near-constant amount of time, then return false.
        try {
            timingSafeEqual(ba, ba)
        } catch {
            /* unreachable */
        }
        return false
    }
    return timingSafeEqual(ba, bb)
}

/**
 * Authenticate an inbound save_post/publish_post webhook POST from the shim.
 *
 * @param req     the inbound Request (for the URL query token + optional header)
 * @param rawBody the raw request body text (already read once by the caller, so
 *                the route can both verify and parse without consuming the stream twice)
 */
export function verifyWpEvent(req: Request, rawBody: string): VerifyWpEventResult {
    const expected = process.env[SECRET_ENV]
    if (!expected) {
        // Fail CLOSED — a missing secret must never make the endpoint open.
        return { ok: false, reason: `server misconfigured: ${SECRET_ENV} not set` }
    }

    // Pull the presented token from the query string (primary, what the emitter
    // sends) or the header (forward-compat).
    let presented = ''
    try {
        presented = new URL(req.url).searchParams.get('token') || ''
    } catch {
        presented = ''
    }
    if (!presented) {
        presented = req.headers.get('x-koto-webhook-token') || ''
    }
    if (!presented) {
        return { ok: false, reason: 'missing token' }
    }

    if (!safeEqual(presented, expected)) {
        return { ok: false, reason: 'invalid token' }
    }

    // Token is valid → parse the body to surface site_url. Parsing failure after
    // a valid token is a malformed-but-authenticated call → still reject.
    let parsed: unknown
    try {
        parsed = JSON.parse(rawBody)
    } catch {
        return { ok: false, reason: 'invalid json body' }
    }
    const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
    const siteUrl = typeof body.site_url === 'string' ? body.site_url : ''
    if (!siteUrl) {
        return { ok: false, reason: 'missing site_url' }
    }

    return { ok: true, siteUrl }
}
