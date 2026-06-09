import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWpEvent } from '@/lib/kotoiq/wpEventAuth'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 Plan 11-01 (WS1) — inbound WP-event receiver.
//
// The shim webhook emitter (LOCKED v4.2.5, reference-only) POSTs save_post /
// publish_post events here. There is NO existing receiver for these events —
// this route is new. It is registered (with its capability token) by
// orchestrateOnboarding() at pair time.
//
// Flow:
//   1. Read the raw body ONCE (verifyWpEvent + JSON parse share it).
//   2. verifyWpEvent(req, raw) → reject 401 on missing/invalid token (T-11-01).
//   3. Validate the event is in our allowlist (ASVS V5; reject unknown — T-11-02).
//   4. Map the body's site_url to a known koto_wp_sites row and resolve
//      agency_id / client_id FROM THAT ROW, never from the request body (T-11-04
//      cross-agency isolation). Unknown site → 404 (authenticated but unmapped).
//   5. For save_post / publish_post, soft-invoke the WS2 baseline diff for the
//      changed post (guarded dynamic import — Plan 11-02 may not be landed yet).
//   6. Return 200 {ok:true}.
//
// This route is a thin trigger; the heavy diff work lives in the WS2 engine.
// ─────────────────────────────────────────────────────────────────────────────

// Read-handler runtime — Node (crypto for constant-time compare in verifyWpEvent).
export const runtime = 'nodejs'

const ACCEPTED_EVENTS = new Set(['save_post', 'publish_post'])

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    )
}

export async function POST(req: Request) {
    // 1. Read raw body once — verify + parse share it (stream is single-use).
    const rawBody = await req.text().catch(() => '')

    // 2. Authenticate the emitter's POST.
    const auth = verifyWpEvent(req, rawBody)
    if (!auth.ok) {
        return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 })
    }

    // Parse the (already-authenticated) payload.
    let parsed: Record<string, unknown> = {}
    try {
        parsed = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
        return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
    }

    const event = typeof parsed.event === 'string' ? parsed.event : ''
    const payload = (parsed.payload && typeof parsed.payload === 'object'
        ? (parsed.payload as Record<string, unknown>)
        : {})
    const postId = typeof payload.post_id === 'number' ? payload.post_id : Number(payload.post_id) || null

    // 3. Validate the event (ASVS V5) — reject anything outside our allowlist.
    if (!ACCEPTED_EVENTS.has(event)) {
        return NextResponse.json({ ok: false, error: `unhandled event: ${event}` }, { status: 422 })
    }

    // 4. Map site_url → known koto_wp_sites row; resolve agency/client from the
    //    row (defense in depth — T-11-04: never trust agency/client from body).
    const cleanUrl = String(auth.siteUrl).replace(/\/$/, '').toLowerCase()
    const s = sb()
    const { data: site } = await s
        .from('koto_wp_sites')
        .select('id, agency_id, client_id, site_url')
        .eq('site_url', cleanUrl)
        .maybeSingle()

    if (!site) {
        // Authenticated, but the site is not one we know — do not act.
        return NextResponse.json({ ok: false, error: 'unknown site' }, { status: 404 })
    }

    // 5. Soft-invoke the WS2 baseline diff for the changed post. Guarded dynamic
    //    import so this route lands before Plan 11-02 with no hard dependency and
    //    never 500s if the engine isn't present yet.
    try {
        // Variable specifier = runtime-only soft dep (Plan 11-02 ships the engine);
        // a static '@/...' specifier would fail tsc with TS2307 before 11-02 lands.
        const spec = '@/lib/kotoiq/baselineSnapshot'
        const mod = await import(/* @vite-ignore */ spec).catch(() => null)
        const diffFn = (mod as { diffChangedPost?: (o: unknown) => Promise<unknown> } | null)?.diffChangedPost
        if (typeof diffFn === 'function') {
            await diffFn({
                agencyId: site.agency_id,
                clientId: site.client_id,
                siteId: site.id,
                siteUrl: site.site_url,
                postId,
                event,
            })
        }
        // else: Plan 11-02 not landed yet — accept the event so the emitter does
        // not retry/log errors; inventory diffing activates once the engine ships.
    } catch (e) {
        // Never fail the webhook on diff error — log and 200 so WP does not retry.
        console.error('[wp-event] baseline diff error', e)
    }

    return NextResponse.json({ ok: true })
}
