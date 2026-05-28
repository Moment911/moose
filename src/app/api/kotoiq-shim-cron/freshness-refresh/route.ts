// ─────────────────────────────────────────────────────────────────────────────
// Auto-freshness cron — nightly re-deploy of opted-in topic campaigns whose
// underlying real-world data has gone stale.
//
// A campaign opts in via the panel (action=set_auto_refresh) which sets
// koto_topic_campaigns.auto_refresh = true and a refresh_threshold_key (a key
// in src/lib/dataIntegrity.ts STALE_THRESHOLDS_MS). This cron re-deploys any
// opted-in campaign whose last_deploy_at is older than that threshold.
//
// "Re-deploy" here = redeployCampaignCore: it re-pulls live Census data + live
// Google reviews and re-resolves + PATCHes each existing page in place. NO
// Claude tokens are spent — competitor-angle refresh still requires a manual
// "Regenerate" (deliberately kept off the cron to keep it token-free).
//
// Schedule: daily at 05:30 UTC (registered in vercel.json under crons[]).
// Auth: Vercel Cron sets `Authorization: Bearer <CRON_SECRET>` automatically.
// Runtime: re-deploys are slow (N WP REST calls each), so cap the batch and
// give the function the full 300s budget.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STALE_THRESHOLDS_MS, isStale, type StaleThresholdKey } from '@/lib/dataIntegrity'
import { redeployCampaignCore } from '@/app/api/kotoiq/topic-campaign/route'

export const maxDuration = 300

// Cap re-deploys per run so a large backlog can't blow the 300s budget. The
// query is ordered stalest-first, so the most overdue campaigns are always
// handled first; the rest roll over to the next nightly run.
const MAX_CAMPAIGNS_PER_RUN = 20

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
        if (!auth.includes(secret)) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
    }

    const startedAt = Date.now()
    const supabase = adminSupabase()

    // Pull opted-in campaigns, stalest-first. If the auto_refresh column doesn't
    // exist yet (migration not applied), report it clearly instead of a 500.
    let campaigns: any[] = []
    try {
        const { data, error } = await supabase
            .from('koto_topic_campaigns')
            .select('id, agency_id, topic, last_deploy_at, refresh_threshold_key, auto_refresh')
            .eq('auto_refresh', true)
            .not('last_deploy_at', 'is', null)
            .order('last_deploy_at', { ascending: true })
            .limit(200)
        if (error) throw error
        campaigns = data || []
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err)
        const notMigrated = /auto_refresh|column|schema cache|PGRST204|42703/i.test(msg)
        return NextResponse.json(
            {
                ok: false,
                error: notMigrated
                    ? 'auto-refresh columns not migrated — apply 20260528_koto_topic_campaigns_auto_refresh.sql'
                    : msg,
                duration_ms: Date.now() - startedAt,
            },
            { status: notMigrated ? 200 : 500 }, // 200 so Vercel doesn't alert before migration is applied
        )
    }

    // Filter to campaigns actually past their staleness threshold.
    const due = campaigns
        .filter((c) => {
            const key = (c.refresh_threshold_key in STALE_THRESHOLDS_MS
                ? c.refresh_threshold_key
                : 'business-listing') as StaleThresholdKey
            return isStale(c.last_deploy_at, key)
        })
        .slice(0, MAX_CAMPAIGNS_PER_RUN)

    const results: Array<{ campaign_id: string; topic: string; ok: boolean; updated?: number; failed?: number; error?: string }> = []
    for (const c of due) {
        try {
            const r = await redeployCampaignCore(supabase, c.agency_id, c.id)
            if (r.ok) {
                await supabase
                    .from('koto_topic_campaigns')
                    .update({ last_auto_refresh_at: new Date().toISOString() })
                    .eq('id', c.id)
                    .then(undefined, () => {}) // best-effort; column may not exist on older schemas
                console.log(`[freshness-refresh] campaign=${c.id} topic="${c.topic}" updated=${r.updated} failed=${r.failed}`)
                results.push({ campaign_id: c.id, topic: c.topic, ok: true, updated: r.updated, failed: r.failed })
            } else {
                console.error(`[freshness-refresh] campaign=${c.id} topic="${c.topic}" FAILED: ${r.error}`)
                results.push({ campaign_id: c.id, topic: c.topic, ok: false, error: r.error })
            }
        } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[freshness-refresh] campaign=${c.id} threw: ${msg}`)
            results.push({ campaign_id: c.id, topic: c.topic, ok: false, error: msg })
        }
    }

    return NextResponse.json({
        ok: true,
        opted_in: campaigns.length,
        due: due.length,
        processed: results.length,
        refreshed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        capped: due.length === MAX_CAMPAIGNS_PER_RUN,
        duration_ms: Date.now() - startedAt,
        results,
    })
}
