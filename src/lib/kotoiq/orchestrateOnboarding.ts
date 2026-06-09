import 'server-only'
import { webhookSet } from '@/lib/wp-shim/verbs/index'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 Plan 11-01 (WS1) — post-pair orchestration spine.
//
// Fired fire-and-forget from src/app/api/wp/route.ts `shim_pair_new_site` after
// pairSite() succeeds (CONTEXT WS1 + RESEARCH A1 — the real pair-completion point,
// NOT seo/wp-register). When a WP site finishes v4 pairing this:
//
//   1. kicks the existing run_all_audits chain for the client (re-POSTs /api/kotoiq
//      with Authorization: Bearer ${CRON_SECRET} — mirrors run_all_audits' own
//      detached runner; RESEARCH WS1 / pitfall 5),
//   2. soft-invokes the WS2 baseline snapshot (Plan 11-02) via a guarded dynamic
//      import so 11-01 lands before 11-02 with no hard build/runtime dependency,
//   3. registers save_post + publish_post webhooks on the WP site (webhook.set verb)
//      pointing at the authenticated dashboard receiver
//      `${baseUrl}/api/kotoiq/wp-event?token=${KOTOIQ_WP_EVENT_SECRET}` so inventory
//      stays live without polling.
//
// Resilience contract (RESEARCH pitfall 4 + WS7 status requirement):
//   - webhookSet THROWS (TypeError) on a disallowed event or non-https url — each
//     call is wrapped in its own try/catch so one failing leg never aborts the others.
//   - Every leg's outcome is captured in the returned OrchestrationResult so a
//     half-run is visible to the caller (which logs it), not silently broken.
//   - The function NEVER throws to its caller (the pair response must not be affected).
//
// NOTE on the receiver URL token: the LOCKED shim emitter sends no auth of its own
// (see wpEventAuth.ts header), so the token rides in the registered webhook URL.
// The token value is process.env.KOTOIQ_WP_EVENT_SECRET — the SAME secret
// verifyWpEvent() checks. If that env var is unset we still register a tokenless
// URL (so wiring works in dev) but the receiver will reject events until the
// operator sets the secret in Vercel.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestrateOnboardingOpts {
    agencyId: string
    clientId: string | null
    siteId: string
    siteUrl: string
    /** Origin to build the receiver URL + reach the dashboard API. Pass new URL(req.url).origin — never hardcode. */
    baseUrl: string
}

export interface LegResult {
    ok: boolean
    detail?: string
}

export interface OrchestrationResult {
    audits: LegResult
    baseline: LegResult
    webhooks: {
        save_post: LegResult
        publish_post: LegResult
    }
}

const WEBHOOK_EVENTS = ['save_post', 'publish_post'] as const
type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/**
 * Build the authenticated receiver URL the shim webhooks point at.
 * Token rides in the query string (the only auth surface — see wpEventAuth.ts).
 */
function receiverUrl(baseUrl: string): string {
    const base = `${baseUrl.replace(/\/$/, '')}/api/kotoiq/wp-event`
    const secret = process.env.KOTOIQ_WP_EVENT_SECRET
    return secret ? `${base}?token=${encodeURIComponent(secret)}` : base
}

/** Kick the existing run_all_audits chain for the just-paired client. Never throws. */
async function kickAudits(opts: OrchestrateOnboardingOpts): Promise<LegResult> {
    if (!opts.clientId) {
        // A client-less pair skips audits gracefully (run_all_audits requires client_id).
        return { ok: false, detail: 'skipped: no client_id' }
    }
    const internalAuth: Record<string, string> = process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {}
    try {
        const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/api/kotoiq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...internalAuth },
            body: JSON.stringify({
                action: 'run_all_audits',
                client_id: opts.clientId,
                agency_id: opts.agencyId,
            }),
            signal: AbortSignal.timeout(120000),
        })
        return res.ok ? { ok: true } : { ok: false, detail: `audits HTTP ${res.status}` }
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : 'audits fetch error' }
    }
}

/**
 * Soft-invoke the WS2 baseline snapshot (Plan 11-02). Guarded dynamic import so
 * this plan does not hard-depend on 11-02 at build OR runtime. Never throws.
 */
async function kickBaseline(opts: OrchestrateOnboardingOpts): Promise<LegResult> {
    try {
        const mod = await import('@/lib/kotoiq/baselineSnapshot').catch(() => null)
        const fn = (mod as { captureBaseline?: (o: unknown) => Promise<unknown> } | null)?.captureBaseline
        if (typeof fn !== 'function') {
            return { ok: false, detail: 'baselineSnapshot not available yet (Plan 11-02)' }
        }
        await fn({
            agencyId: opts.agencyId,
            clientId: opts.clientId,
            siteId: opts.siteId,
            siteUrl: opts.siteUrl,
        })
        return { ok: true }
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : 'baseline error' }
    }
}

/** Register one webhook event. webhookSet THROWS on bad input → caught here. Never throws. */
async function registerWebhook(siteUrl: string, event: WebhookEvent, url: string): Promise<LegResult> {
    try {
        const res = await webhookSet(siteUrl, { event, url })
        return res?.ok
            ? { ok: true }
            : { ok: false, detail: res?.error?.message || 'webhookSet returned not-ok' }
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : 'webhookSet threw' }
    }
}

/**
 * Orchestrate the post-pair onboarding chain. Fire-and-forget from the caller;
 * resolves to a structured per-leg result and NEVER throws.
 */
export async function orchestrateOnboarding(
    opts: OrchestrateOnboardingOpts,
): Promise<OrchestrationResult> {
    const url = receiverUrl(opts.baseUrl)

    // Run the legs concurrently but isolate each — one failing leg never aborts another.
    const [audits, baseline, savePost, publishPost] = await Promise.all([
        kickAudits(opts),
        kickBaseline(opts),
        registerWebhook(opts.siteUrl, 'save_post', url),
        registerWebhook(opts.siteUrl, 'publish_post', url),
    ])

    return {
        audits,
        baseline,
        webhooks: { save_post: savePost, publish_post: publishPost },
    }
}
