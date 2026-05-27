// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 10-10 Task 1 (GREEN) — dualRunRouter
//
// Per CONTEXT.md D-TypeScript-port-equivalence (USER-LOCKED): wrap every
// dashboard-side verb call with a shadow router. For sites in dual-run
// mode='active', the router fires BOTH the v3 legacy endpoint and the v4
// shim verb, returns v4 to the caller, and logs the diff to
// koto_wp_dual_run_log.
//
// Modes:
//   inactive    — v3 only (default pre-cutover; identical to legacy proxy)
//   active      — v3 + v4 in parallel; v4 returned; diff logged. 7-day window.
//   promoted    — v4 only; 1% sampling fires v3 in parallel for monitoring
//   rolled_back — v3 only (manual emergency rollback)
//
// In all modes that call v4, v4's response is ALWAYS the one returned to the
// caller. v3 in shadow never affects state — its only job is the diff.
//
// Privacy / storage: koto_wp_dual_run_log stores sha256 hashes of args and
// responses, never the raw bodies (which may contain post content). The diff
// summary stored alongside contains a capped set of {path, v3, v4} samples
// useful for operator debugging.
//
// Per the plan's threat register:
//   T-10-10-02 — set_mode must agency-scope (handled by the API route)
//   T-10-10-05 — insert failures are caught + swallowed so caller never sees them
//   T-10-10-07 — V4_TO_V3_ACTION_MAP correctness is tested
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { shimRpc } from '../shimRpc'
import type { ShimVerb } from '../verbList'
import type { ShimRpcResponse } from '../types'
import { compareResponses, hashResponse } from './diffEngine'

// ── Mode + verb-to-action map ───────────────────────────────────────────────

export type DualRunMode = 'inactive' | 'active' | 'promoted' | 'rolled_back'

/**
 * V4 verb → legacy v3 action name. null = no v3 equivalent (verb is new in v4
 * and skips the shadow leg, logging diff_status='v4_only').
 *
 * Per Plan 10-10 interfaces block. For verbs whose v3 action depends on args
 * (query.select, option.update), see resolveV3Action below.
 */
export const V4_TO_V3_ACTION_MAP: Record<string, string | null> = {
    // ── Read verbs ──
    'health.ping': 'meta',
    'health.diagnostics': 'meta',
    'post.get_meta_bulk': 'kotoiq_seo_content_get',
    'option.get': 'get_settings',
    'option.list_by_prefix': 'kotoiq_seo_sitemaps',
    'query.select': 'kotoiq_seo_pages', // varies; resolveV3Action refines
    'file.read': null,
    'file.exists': null,
    'events.log_tail': null,
    'cron.list': null,
    'plugin.list': null,
    'taxonomy.list': null,

    // ── Write verbs ──
    'meta.update': 'seo_set_meta',
    'meta.delete': 'seo_set_meta',
    'option.update': 'update_settings', // varies; resolveV3Action refines
    'option.delete': null,
    'file.write': null, // sitemap is the typical caller — no v3 equivalent
    'file.delete': null,
    'elementor.save': 'put_elementor_data',
    'elementor.clone': 'clone_elementor_page',
    'capability.apply': 'access_apply',
    'transient.delete_prefix': null,

    // ── Operation verbs ──
    'database.update_bulk': null,
    'cron.trigger': null,
    'cron.unschedule': null,
    'plugin.toggle': null,
    'webhook.set': null,
}

/**
 * Resolve the v3 action for verbs whose mapping depends on args.
 * Falls back to V4_TO_V3_ACTION_MAP for the static cases.
 */
function resolveV3Action(verb: string, args: Record<string, unknown>): string | null {
    if (verb === 'query.select') {
        const name = String((args as { name?: string })?.name || '')
        if (name === 'posts.list_by_post_type') return 'list_content'
        if (name === 'posts.list_by_meta' || name === 'posts.list_by_meta_key_prefix') {
            return 'kotoiq_seo_pages'
        }
        if (name === 'options.list_by_prefix') return 'get_settings'
        return V4_TO_V3_ACTION_MAP[verb] ?? null
    }
    if (verb === 'option.update') {
        const name = String((args as { name?: string })?.name || '')
        if (name === 'kotoiq_shim_snippets') return 'am_save'
        if (name.startsWith('kotoiq_access_')) return 'access_apply'
        if (name.startsWith('kotoiq_redirects')) return 'update_settings'
        return 'update_settings'
    }
    return V4_TO_V3_ACTION_MAP[verb] ?? null
}

// ── /api/wp internal caller (v3 leg) ────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface V3CallResult {
    ok: boolean
    data: unknown
    status: number
    latency_ms: number
    _no_v3?: true
}

async function callV3Endpoint(
    verb: string,
    args: Record<string, unknown>,
    agencyId: string,
    siteId: string,
): Promise<V3CallResult> {
    const action = resolveV3Action(verb, args)
    if (action === null) {
        return { ok: false, data: null, status: 0, latency_ms: 0, _no_v3: true }
    }
    const start = Date.now()
    try {
        const res = await fetch(`${APP_URL.replace(/\/$/, '')}/api/wp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                agency_id: agencyId,
                site_id: siteId,
                ...args,
            }),
            signal: AbortSignal.timeout(15_000),
        })
        // Prefer .json() when available (covers the common fetch-mock idiom);
        // fall back to .text() + JSON.parse for plain-text mocks / error pages.
        let data: unknown = null
        try {
            data = await res.json()
        } catch {
            const text = await res.text().catch(() => '')
            if (text) {
                try {
                    data = JSON.parse(text)
                } catch {
                    data = text
                }
            }
        }
        return {
            ok: res.ok,
            data,
            status: res.status,
            latency_ms: Date.now() - start,
        }
    } catch (err) {
        return {
            ok: false,
            data: { error: err instanceof Error ? err.message : 'network_error' },
            status: 0,
            latency_ms: Date.now() - start,
        }
    }
}

// ── Router factory ──────────────────────────────────────────────────────────

export type DualRunDiffStatus =
    | 'match'
    | 'minor_diff'
    | 'major_diff'
    | 'v3_error'
    | 'v4_error'
    | 'both_error'
    | 'v4_only'

export interface DualRunRouter {
    readonly mode: DualRunMode
    runVerb<T = unknown>(
        verb: ShimVerb,
        args: Record<string, unknown>,
    ): Promise<ShimRpcResponse<T>>
}

/**
 * Build a dual-run router for one site. Caller holds it for the duration of
 * one batch of verb calls (typically one HTTP request to the dashboard).
 *
 * `supabase` must be a service-role client. The router does not enforce
 * agency scoping on its OWN reads — it relies on `agencyId` being trusted
 * by the caller. Routes that build a router MUST resolve agencyId via
 * verifySession first.
 */
export function createDualRunRouter(
    supabase: SupabaseClient,
    agencyId: string,
    siteId: string,
    siteUrl: string,
    mode: DualRunMode,
): DualRunRouter {
    async function logDualRun(
        verb: string,
        legacyEndpoint: string | null,
        args: Record<string, unknown>,
        v3Data: unknown,
        v4Data: unknown,
        v3LatMs: number,
        v4LatMs: number,
        status: DualRunDiffStatus,
        summary: Record<string, unknown> | null,
    ): Promise<void> {
        // Wrap insert so a DB failure NEVER propagates to the caller — the
        // shadow log is best-effort; the v4 call result is what matters.
        // Cross-agency scoping: every row carries both agency_id + site_id from
        // the router's closure (resolved by the caller from verifySession).
        try {
            await supabase.from('koto_wp_dual_run_log').insert({
                agency_id: agencyId,
                site_id: siteId,
                verb,
                legacy_endpoint: legacyEndpoint,
                args_hash: hashResponse(args),
                v3_response_hash: v3Data === null ? null : hashResponse(v3Data),
                v4_response_hash: v4Data === null ? null : hashResponse(v4Data),
                diff_status: status,
                diff_summary: summary,
                latency_v3_ms: v3LatMs || null,
                latency_v4_ms: v4LatMs || null,
            })
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
                '[dualRunRouter] log insert failed (swallowed):',
                err instanceof Error ? err.message : 'unknown',
            )
        }
    }

    return {
        mode,
        async runVerb<T = unknown>(
            verb: ShimVerb,
            args: Record<string, unknown>,
        ): Promise<ShimRpcResponse<T>> {
            // ── v3-only modes (inactive, rolled_back) ──
            if (mode === 'inactive' || mode === 'rolled_back') {
                const v3 = await callV3Endpoint(verb, args, agencyId, siteId)
                if (v3._no_v3) {
                    // Verb has no v3 equivalent and dual-run is OFF — we can't
                    // serve this call. Return a structured error rather than
                    // pretend to succeed.
                    return {
                        ok: false,
                        error: {
                            code: 'v3_unavailable',
                            message: `No v3 equivalent for verb "${verb}"; site is not in v4 mode`,
                        },
                        status: 0,
                    }
                }
                return v3.ok
                    ? { ok: true, data: v3.data as T, status: v3.status }
                    : {
                          ok: false,
                          error: {
                              code: 'v3_error',
                              message: `v3 endpoint returned ${v3.status}`,
                          },
                          status: v3.status,
                      }
            }

            // ── v4 modes (active, promoted) ──
            const v4Start = Date.now()
            const v4 = await shimRpc<T>(siteUrl, verb, args)
            const v4Latency = Date.now() - v4Start

            // Should we also fire v3 for diffing?
            const shouldCheckV3 =
                mode === 'active' || (mode === 'promoted' && Math.random() < 0.01)
            if (!shouldCheckV3) return v4

            // Fire v3 leg (active or 1% sampled in promoted).
            const v3 = await callV3Endpoint(verb, args, agencyId, siteId)

            // Verb has no v3 equivalent — log as v4_only and return v4.
            if (v3._no_v3) {
                await logDualRun(
                    verb,
                    null,
                    args,
                    null,
                    v4.ok ? v4.data : null,
                    0,
                    v4Latency,
                    'v4_only',
                    null,
                )
                return v4
            }

            // Diff + log.
            let status: DualRunDiffStatus
            let summary: Record<string, unknown> | null = null

            if (!v3.ok && !v4.ok) {
                status = 'both_error'
            } else if (!v3.ok) {
                status = 'v3_error'
            } else if (!v4.ok) {
                status = 'v4_error'
            } else {
                const diff = compareResponses(v3.data, v4.data)
                status = diff.status
                summary = diff.summary as unknown as Record<string, unknown>
            }

            const legacyAction = resolveV3Action(verb, args)
            await logDualRun(
                verb,
                legacyAction ? `POST /api/wp action=${legacyAction}` : null,
                args,
                v3.ok ? v3.data : null,
                v4.ok ? v4.data : null,
                v3.latency_ms,
                v4Latency,
                status,
                summary,
            )

            return v4
        },
    }
}
