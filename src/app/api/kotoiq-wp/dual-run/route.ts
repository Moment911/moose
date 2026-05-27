import { NextRequest, NextResponse } from 'next/server'

import { verifySession } from '../../../../lib/apiAuth'
import { getKotoIQDb } from '../../../../lib/kotoiqDb'
import type { DualRunMode } from '../../../../lib/wp-shim/dualRun'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 10-10 Task 2 — /api/kotoiq-wp/dual-run
//
// Operator API for the 7-day shadow-mode dual-run window. Mirrors the Plan 09
// canonical route shape:
//   - verifySession FIRST → 401 on !verified || !agencyId
//   - body.action MUST be in ALLOWED_ACTIONS → 400 unknown_action otherwise
//   - agencyId read from session, NEVER trusted from body
//   - Every supabase query filters by .eq('agency_id', agencyId) — even reads
//
// Actions:
//   get_status         — per-site dual_run_state + 7d diff_status counts
//   list_recent_diffs  — recent koto_wp_dual_run_log rows for a site
//   list_diff_detail   — single log row by id (with agency check)
//   set_mode           — flip koto_wp_sites.dual_run_state (operator UI control)
//   list_sites         — all v4 sites with their current mode + 24h match%
//
// Threat register references (see 10-10-PLAN.md <threat_model>):
//   T-10-10-02 (cross-agency set_mode) — .eq('agency_id', agencyId) on UPDATE
//   T-10-10-05 (silent logging fail)   — read-only operator view surfaces hourly
//                                        log volume via list_sites
//   T-10-10-06 (samples leak content)  — diff_summary samples are operator-scope
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_ACTIONS = [
    'get_status',
    'list_recent_diffs',
    'list_diff_detail',
    'set_mode',
    'list_sites',
] as const

const VALID_MODES: DualRunMode[] = ['inactive', 'active', 'promoted', 'rolled_back']

function err(status: number, error: string, extra?: Record<string, unknown>): NextResponse {
    return NextResponse.json({ error, ...(extra || {}) }, { status })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // 1. Auth gate.
    const session = await verifySession(req)
    if (!session.verified || !session.agencyId) {
        return err(401, 'unauthorized')
    }
    const agencyId = session.agencyId

    // 2. Body parse.
    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return err(400, 'invalid_json')
    }

    const action = String(body?.action || '')
    if (!(ALLOWED_ACTIONS as readonly string[]).includes(action)) {
        return err(400, 'unknown_action', { allowed_actions: ALLOWED_ACTIONS })
    }

    // 3. Supabase client (service-role; queries below MUST filter on agency_id).
    const db = getKotoIQDb(agencyId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = db.client

    try {
        switch (action) {
            case 'get_status': {
                const siteId = String(body.site_id || '')
                if (!siteId) return err(400, 'site_id required')

                // Confirm the site belongs to the agency (T-10-10-02 read mirror).
                const siteRes = await sb
                    .from('koto_wp_sites')
                    .select('id, site_url, shim_version, dual_run_state, dual_run_started_at, v4_promoted_at, paired_at_v4')
                    .eq('id', siteId)
                    .eq('agency_id', agencyId)
                    .maybeSingle()
                if (siteRes.error) return err(500, 'site_lookup_failed', { detail: siteRes.error.message })
                if (!siteRes.data) return err(404, 'site_not_found')

                // 7-day diff counts grouped by diff_status.
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                const logsRes = await sb
                    .from('koto_wp_dual_run_log')
                    .select('diff_status, latency_v3_ms, latency_v4_ms')
                    .eq('agency_id', agencyId)
                    .eq('site_id', siteId)
                    .gte('called_at', sevenDaysAgo)
                    .limit(5000) // cap to bound memory; 5k = ~700/day fleet ceiling
                if (logsRes.error) return err(500, 'logs_lookup_failed', { detail: logsRes.error.message })

                const rows: Array<{
                    diff_status: string
                    latency_v3_ms: number | null
                    latency_v4_ms: number | null
                }> = logsRes.data || []
                const counts: Record<string, number> = {}
                const v3Lats: number[] = []
                const v4Lats: number[] = []
                for (const r of rows) {
                    counts[r.diff_status] = (counts[r.diff_status] || 0) + 1
                    if (typeof r.latency_v3_ms === 'number') v3Lats.push(r.latency_v3_ms)
                    if (typeof r.latency_v4_ms === 'number') v4Lats.push(r.latency_v4_ms)
                }
                const total = rows.length
                const matchPct = total === 0 ? null : Math.round(((counts.match || 0) + (counts.v4_only || 0)) * 1000 / total) / 10

                const median = (arr: number[]) => {
                    if (!arr.length) return null
                    const sorted = [...arr].sort((a, b) => a - b)
                    const mid = Math.floor(sorted.length / 2)
                    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
                }

                return NextResponse.json({
                    site: siteRes.data,
                    window: {
                        from: sevenDaysAgo,
                        to: new Date().toISOString(),
                        total,
                        match_pct: matchPct,
                        counts,
                        latency_v3_median_ms: median(v3Lats),
                        latency_v4_median_ms: median(v4Lats),
                    },
                })
            }

            case 'list_recent_diffs': {
                const siteId = String(body.site_id || '')
                if (!siteId) return err(400, 'site_id required')
                const limit = Math.min(Number(body.limit) || 50, 200)
                const statusFilter = body.status_filter ? String(body.status_filter) : null

                let q = sb
                    .from('koto_wp_dual_run_log')
                    .select(
                        'id, verb, legacy_endpoint, diff_status, latency_v3_ms, latency_v4_ms, called_at',
                    )
                    .eq('agency_id', agencyId)
                    .eq('site_id', siteId)
                if (statusFilter) q = q.eq('diff_status', statusFilter)
                q = q.order('called_at', { ascending: false }).limit(limit)
                const res = await q
                if (res.error) return err(500, 'list_failed', { detail: res.error.message })
                return NextResponse.json({ diffs: res.data || [] })
            }

            case 'list_diff_detail': {
                const logId = String(body.log_id || '')
                if (!logId) return err(400, 'log_id required')
                const res = await sb
                    .from('koto_wp_dual_run_log')
                    .select('*')
                    .eq('id', logId)
                    .eq('agency_id', agencyId)
                    .maybeSingle()
                if (res.error) return err(500, 'get_failed', { detail: res.error.message })
                if (!res.data) return err(404, 'log_not_found')
                return NextResponse.json({ log: res.data })
            }

            case 'set_mode': {
                const siteId = String(body.site_id || '')
                const mode = String(body.mode || '') as DualRunMode
                if (!siteId) return err(400, 'site_id required')
                if (!VALID_MODES.includes(mode)) {
                    return err(400, 'invalid_mode', { valid_modes: VALID_MODES })
                }
                // Pre-check the site is in this agency (defense in depth — the
                // .eq('agency_id') on the UPDATE handles cross-agency tampering
                // (T-10-10-02), but a missing row should 404 cleanly rather
                // than silently affect 0 rows with a 200 OK.
                const siteRes = await sb
                    .from('koto_wp_sites')
                    .select('id, dual_run_state, shim_version')
                    .eq('id', siteId)
                    .eq('agency_id', agencyId)
                    .maybeSingle()
                if (siteRes.error) return err(500, 'site_lookup_failed', { detail: siteRes.error.message })
                if (!siteRes.data) return err(404, 'site_not_found')

                const patch: Record<string, unknown> = { dual_run_state: mode }
                if (mode === 'active' && !siteRes.data.dual_run_state?.includes('active')) {
                    patch.dual_run_started_at = new Date().toISOString()
                }
                if (mode === 'promoted') {
                    patch.v4_promoted_at = new Date().toISOString()
                    patch.shim_version = 'v4'
                }

                const upd = await sb
                    .from('koto_wp_sites')
                    .update(patch)
                    .eq('id', siteId)
                    .eq('agency_id', agencyId)
                if (upd.error) return err(500, 'set_mode_failed', { detail: upd.error.message })

                // Append audit row to koto_wp_shim_pairings (best-effort).
                try {
                    await sb.from('koto_wp_shim_pairings').insert({
                        agency_id: agencyId,
                        site_id: siteId,
                        event:
                            mode === 'promoted'
                                ? 'promoted_to_v4'
                                : mode === 'rolled_back'
                                  ? 'rolled_back'
                                  : 'pair_completed',
                        notes: { transitioned_to: mode },
                    })
                } catch {
                    // Audit insert is best-effort.
                }

                return NextResponse.json({ ok: true, site_id: siteId, mode })
            }

            case 'list_sites': {
                // All v4 sites in agency + their current dual_run_state.
                const sitesRes = await sb
                    .from('koto_wp_sites')
                    .select('id, site_url, site_name, shim_version, dual_run_state, dual_run_started_at, v4_promoted_at, paired_at_v4')
                    .eq('agency_id', agencyId)
                    .eq('shim_version', 'v4')
                    .order('paired_at_v4', { ascending: false })
                if (sitesRes.error) return err(500, 'list_sites_failed', { detail: sitesRes.error.message })

                const sites: Array<{
                    id: string
                    site_url: string
                    dual_run_state: string | null
                    shim_version: string | null
                }> = sitesRes.data || []

                // 24h match% per site via batched grouped count.
                const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                const logsRes = await sb
                    .from('koto_wp_dual_run_log')
                    .select('site_id, diff_status')
                    .eq('agency_id', agencyId)
                    .gte('called_at', since24h)
                    .limit(20000)
                if (logsRes.error) return err(500, 'list_sites_logs_failed', { detail: logsRes.error.message })

                const perSite: Record<string, { total: number; match: number; major: number }> = {}
                for (const r of (logsRes.data || []) as Array<{
                    site_id: string
                    diff_status: string
                }>) {
                    const s = (perSite[r.site_id] ||= { total: 0, match: 0, major: 0 })
                    s.total += 1
                    if (r.diff_status === 'match' || r.diff_status === 'v4_only') s.match += 1
                    if (r.diff_status === 'major_diff') s.major += 1
                }

                const rows = sites.map((s) => {
                    const m = perSite[s.id] || { total: 0, match: 0, major: 0 }
                    return {
                        ...s,
                        match_pct_24h: m.total
                            ? Math.round((m.match / m.total) * 1000) / 10
                            : null,
                        major_diff_count_24h: m.major,
                        sample_count_24h: m.total,
                    }
                })

                return NextResponse.json({ sites: rows })
            }
        }
        return err(400, 'unknown_action')
    } catch (e) {
        return err(500, 'server_error', { detail: (e as Error).message })
    }
}
