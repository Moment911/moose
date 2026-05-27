// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 08 — Vercel Cron endpoint for nightly sitemap refresh.
//
// Schedule: daily at 04:00 UTC (registered in vercel.json under crons[]).
// Auth: Vercel Cron sets `Authorization: Bearer <CRON_SECRET>` automatically
//       when the env var is configured (https://vercel.com/docs/cron-jobs/manage-cron-jobs).
//
// Per AGENTS.md: this is Next.js v16; route handler signature follows
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// — export GET(request: NextRequest) returning a Response/NextResponse.
//
// Per Plan 10-08 <action> 5: GET only (Vercel Cron is GET). Skips composeSitemap
// if CRON_SECRET is set and the request didn't supply a matching Bearer token.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAllSites } from '../../../../lib/wp-shim/ports/sitemapPort'

function adminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } },
    )
}

export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET
    if (secret) {
        const auth = req.headers.get('authorization') || ''
        // Match either `Bearer <secret>` or a raw `<secret>` (some proxies strip Bearer)
        if (!auth.includes(secret)) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
    }

    const startedAt = Date.now()
    const supabase = adminSupabase()

    let report: Awaited<ReturnType<typeof refreshAllSites>>
    try {
        report = await refreshAllSites(supabase)
    } catch (err) {
        // Vercel Cron will surface a non-2xx as an alert in the Logs UI.
        console.error('[kotoiq-shim-cron/sitemap-refresh] fatal:', err)
        return NextResponse.json(
            {
                ok: false,
                error: err instanceof Error ? err.message : 'unknown',
                duration_ms: Date.now() - startedAt,
            },
            { status: 500 },
        )
    }

    // Per-site logs go to Vercel Logs so cron monitoring can spot failing sites.
    for (const r of report.results) {
        if (r.ok) {
            console.log(
                `[kotoiq-shim-cron/sitemap-refresh] site=${r.site_id} url=${r.site_url} ` +
                    `files=${r.files} total_urls=${r.total_urls} duration_ms=${r.duration_ms}`,
            )
        } else {
            console.error(
                `[kotoiq-shim-cron/sitemap-refresh] site=${r.site_id} url=${r.site_url} ` +
                    `FAILED files=${r.files} error=${r.error}`,
            )
        }
    }

    return NextResponse.json({
        ok: report.failures === 0,
        processed: report.processed,
        successes: report.successes,
        failures: report.failures,
        duration_ms: report.duration_ms,
        results: report.results,
    })
}
