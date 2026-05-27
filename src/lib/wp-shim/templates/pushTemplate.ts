// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 09 Task 2 — pushTemplate + pushTemplateBatch + diffPushes.
//
// Composes a final Elementor JSON tree by substituting variable values into a
// stored template, then drives the verb sequence that lands the rendered page
// on a target WordPress site:
//
//   1. Insert koto_wp_push_history row with status='pending' BEFORE any RPC
//      so the operator can recover an in-flight push from a mid-flight crash.
//   2. substituteVariables(template.elementor_data, values) → renderedTree.
//   3. elementor.save (new page; idempotency_key per push) — gets pushed post id.
//   4. meta.update — writes the KotoIQ-native + Yoast/RankMath SEO meta keys
//      composed from template.seo_meta_template with variable substitution.
//   5. Update push_history to succeeded / failed with the rendered tree +
//      composed SEO meta on disk for diff/replay.
//
// Agency isolation: every read (template, site) AND every write (history
// insert + update) filters by .eq('agency_id', agencyId). Defense-in-depth
// atop Supabase RLS on koto_wp_templates + koto_wp_push_history.
//
// Idempotency: idempotency_key = sha1(templateId + targetSiteId +
// variableValues) + ms timestamp. The shim's elementor.save verb returns
// `{idempotent: true}` on duplicate keys without re-saving (Plan 06). We
// surface that in the history row but treat it as a successful push.
//
// Bulk batching: pushTemplateBatch runs SEQUENTIALLY (not parallel) — WP's
// concurrency tolerance is poor for back-to-back writes against the same
// installation. Capped at 500 rows per call; larger sets must chunk client-side.
//
// Diff: diffPushes loads the two most recent succeeded push_history rows and
// walks both rendered_elementor_data trees, returning a summary of changed
// JSON paths. Used by the UI before a re-push to preview impact.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadSiteCredentials } from '../credentialsVault'
import { elementorSave, metaUpdate } from '../verbs'
import type { PushHistoryRow, TemplateRow } from '../types'
import { substituteVariables } from './variableExtractor'

// ── Companion SEO key map: KotoIQ-native ↔ Yoast ↔ RankMath ──────────────────
// Matches ports/seoPort.ts. We write every key the dashboard composed for the
// template so the rendered page picks up SEO regardless of which plugin the
// target site has active.
const COMPANION_KEY_TUPLES: Array<[string, string, string]> = [
    ['_kotoiq_title', '_yoast_wpseo_title', 'rank_math_title'],
    ['_kotoiq_description', '_yoast_wpseo_metadesc', 'rank_math_description'],
    ['_kotoiq_focus_keyword', '_yoast_wpseo_focuskw', 'rank_math_focus_keyword'],
]

export interface PushTemplateOpts {
    /** Supabase auth.users.id (audit trail). */
    pushedBy?: string
    /** Override post title — defaults to the substituted template name. */
    titleField?: string
    /** Override the published status — defaults to 'draft'. */
    status?: 'draft' | 'publish' | 'private'
    /** Override rotation cache duration (default '7d'). */
    rotationCacheDuration?: string
    /**
     * Force a fixed idempotency key — useful for retry logic. When unset, the
     * key is derived from templateId + targetSiteId + sha1(values) + Date.now.
     */
    idempotencyKey?: string
}

export interface PushTemplateError {
    code:
        | 'template_not_found'
        | 'target_site_not_found'
        | 'missing_credentials'
        | 'history_insert_failed'
        | 'save_failed'
        | 'meta_update_failed'
        | 'unknown'
    message: string
}

export interface PushTemplateResult {
    ok: boolean
    pushHistoryId?: string
    pushedPostId?: number
    pushedPostUrl?: string
    idempotent?: boolean
    error?: PushTemplateError
}

interface TemplateRowMin {
    id: string
    agency_id: string
    name: string
    elementor_data: unknown
    variable_schema: Array<{ name: string; type?: string; value: unknown }>
    seo_meta_template: Record<string, string> | null
    archived_at?: string | null
}

interface SiteRowMin {
    id: string
    agency_id: string
    site_url: string
}

function sha1(s: string): string {
    return createHash('sha1').update(s).digest('hex')
}

function slugifyTitle(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `template-${Date.now()}`
}

function pickTitle(
    template: TemplateRowMin,
    values: Record<string, string | string[]>,
    opts: PushTemplateOpts,
): string {
    // Explicit title field wins.
    if (opts.titleField && typeof values[opts.titleField] === 'string') {
        return String(values[opts.titleField])
    }
    if (typeof values.page_title === 'string') return String(values.page_title)
    if (typeof values.title === 'string') return String(values.title)
    return template.name
}

function composeSeoMetaUpdates(
    pushedPostId: number,
    composedSeo: Record<string, string> | null,
): Array<{ post_id: number; key: string; value: unknown }> {
    if (!composedSeo) return []
    const out: Array<{ post_id: number; key: string; value: unknown }> = []
    // Write KotoIQ-native keys first.
    for (const [key, val] of Object.entries(composedSeo)) {
        if (val === undefined || val === null) continue
        if (val === '') continue
        out.push({ post_id: pushedPostId, key, value: val })
    }
    // Mirror title/desc/focus_kw onto Yoast + RankMath companions for cross-engine compat.
    for (const [kotoKey, yoastKey, rmKey] of COMPANION_KEY_TUPLES) {
        const v = composedSeo[kotoKey]
        if (v === undefined || v === null || v === '') continue
        out.push({ post_id: pushedPostId, key: yoastKey, value: v })
        out.push({ post_id: pushedPostId, key: rmKey, value: v })
    }
    return out
}

/**
 * Push one template to one target site with one variable value set.
 *
 * Returns ok=true with pushedPostId on success. On failure, returns ok=false
 * with the error code and ensures the push_history row reflects the failure
 * state (status='failed', error_code, error_message).
 */
export async function pushTemplate(
    supabase: SupabaseClient,
    agencyId: string,
    templateId: string,
    targetSiteId: string,
    variableValues: Record<string, string | string[]>,
    opts: PushTemplateOpts = {},
): Promise<PushTemplateResult> {
    // 1. Load template (agency-scoped).
    const tplRes = await supabase
        .from('koto_wp_templates')
        .select('*')
        .eq('id', templateId)
        .eq('agency_id', agencyId)
        .maybeSingle()
    if (tplRes.error) {
        return {
            ok: false,
            error: { code: 'template_not_found', message: `tpl lookup: ${tplRes.error.message}` },
        }
    }
    const template = (tplRes.data as TemplateRowMin | null) ?? null
    if (!template) {
        return {
            ok: false,
            error: {
                code: 'template_not_found',
                message: `template ${templateId} not found under agency ${agencyId}`,
            },
        }
    }

    // 2. Load target site (agency-scoped).
    const siteRes = await supabase
        .from('koto_wp_sites')
        .select('id, agency_id, site_url')
        .eq('id', targetSiteId)
        .eq('agency_id', agencyId)
        .maybeSingle()
    if (siteRes.error) {
        return {
            ok: false,
            error: {
                code: 'target_site_not_found',
                message: `site lookup: ${siteRes.error.message}`,
            },
        }
    }
    const site = (siteRes.data as SiteRowMin | null) ?? null
    if (!site) {
        return {
            ok: false,
            error: {
                code: 'target_site_not_found',
                message: `target site ${targetSiteId} not found under agency ${agencyId}`,
            },
        }
    }

    // 3. Compose idempotency key + insert pending push_history BEFORE any RPC.
    const valuesDigest = sha1(JSON.stringify(variableValues || {})).slice(0, 16)
    const idempotency_key =
        opts.idempotencyKey ??
        `${templateId.slice(0, 8)}-${targetSiteId.slice(0, 8)}-${valuesDigest}-${Date.now()}`
    const histIns = await supabase
        .from('koto_wp_push_history')
        .insert({
            agency_id: agencyId,
            template_id: templateId,
            target_site_id: targetSiteId,
            variable_values: variableValues || {},
            idempotency_key,
            status: 'pending',
            pushed_by: opts.pushedBy ?? null,
        })
        .select()
        .single()
    if (histIns.error || !histIns.data) {
        return {
            ok: false,
            error: {
                code: 'history_insert_failed',
                message: `push_history insert: ${histIns.error?.message ?? 'no row'}`,
            },
        }
    }
    const pushHistoryId = (histIns.data as { id: string }).id

    // 4. Credentials (target site).
    const creds = await loadSiteCredentials(supabase, agencyId, targetSiteId)
    if (!creds) {
        await supabase
            .from('koto_wp_push_history')
            .update({
                status: 'failed',
                error_code: 'missing_credentials',
                error_message: `no App Password for ${targetSiteId}`,
            })
            .eq('id', pushHistoryId)
            .eq('agency_id', agencyId)
        return {
            ok: false,
            pushHistoryId,
            error: { code: 'missing_credentials', message: `no creds for site ${targetSiteId}` },
        }
    }

    // 5. Substitute variables into the stored elementor_data tree.
    let renderedTree: unknown
    let composedSeoMeta: Record<string, string> | null = null
    try {
        renderedTree = substituteVariables(template.elementor_data, variableValues || {}, {
            rotationCacheDuration: opts.rotationCacheDuration,
        })
        if (template.seo_meta_template) {
            const composed: Record<string, string> = {}
            for (const [key, val] of Object.entries(template.seo_meta_template)) {
                if (typeof val !== 'string') continue
                const substituted = substituteVariables(
                    [{ id: 'seo', settings: { v: val } }],
                    variableValues || {},
                ) as Array<{ settings: { v: string } }>
                composed[key] = substituted[0].settings.v
            }
            composedSeoMeta = composed
        }
    } catch (e) {
        await supabase
            .from('koto_wp_push_history')
            .update({
                status: 'failed',
                error_code: 'substitution_failed',
                error_message: (e as Error).message,
            })
            .eq('id', pushHistoryId)
            .eq('agency_id', agencyId)
        return {
            ok: false,
            pushHistoryId,
            error: { code: 'unknown', message: `substitute failed: ${(e as Error).message}` },
        }
    }

    // 6. elementor.save — new post (post_id='new', requires title).
    const title = pickTitle(template, variableValues || {}, opts)
    const slug = slugifyTitle(title)
    const saveRes = await elementorSave(site.site_url, {
        post_id: 'new',
        title,
        slug,
        elementor_data: renderedTree as unknown[],
        post_type: 'page',
        status: opts.status ?? 'draft',
        idempotency_key: idempotency_key.slice(0, 64).replace(/[^A-Za-z0-9_-]/g, ''),
    })
    if (!saveRes.ok) {
        await supabase
            .from('koto_wp_push_history')
            .update({
                status: 'failed',
                error_code: saveRes.error.code || 'save_failed',
                error_message: saveRes.error.message,
                rendered_elementor_data: renderedTree,
                rendered_seo_meta: composedSeoMeta,
            })
            .eq('id', pushHistoryId)
            .eq('agency_id', agencyId)
        return {
            ok: false,
            pushHistoryId,
            error: { code: 'save_failed', message: saveRes.error.message },
        }
    }
    const pushedPostId = saveRes.data.post_id
    const pushedPostUrl = saveRes.data.url
    const idempotent = saveRes.data.idempotent === true

    // 7. meta.update — KotoIQ + Yoast + RankMath companion writes for SEO.
    const seoUpdates = composeSeoMetaUpdates(pushedPostId, composedSeoMeta)
    if (seoUpdates.length > 0) {
        const metaRes = await metaUpdate(site.site_url, { updates: seoUpdates })
        if (!metaRes.ok) {
            // SEO failure should NOT roll back the page — the page is live, just
            // its SEO meta isn't. Record a partial failure in history.
            await supabase
                .from('koto_wp_push_history')
                .update({
                    status: 'failed',
                    error_code: 'meta_update_failed',
                    error_message: metaRes.error.message,
                    pushed_post_id: pushedPostId,
                    pushed_post_url: pushedPostUrl,
                    rendered_elementor_data: renderedTree,
                    rendered_seo_meta: composedSeoMeta,
                    pushed_at: new Date().toISOString(),
                })
                .eq('id', pushHistoryId)
                .eq('agency_id', agencyId)
            return {
                ok: false,
                pushHistoryId,
                pushedPostId,
                pushedPostUrl,
                error: {
                    code: 'meta_update_failed',
                    message: `page created but SEO write failed: ${metaRes.error.message}`,
                },
            }
        }
    }

    // 8. Mark succeeded.
    await supabase
        .from('koto_wp_push_history')
        .update({
            status: 'succeeded',
            pushed_post_id: pushedPostId,
            pushed_post_url: pushedPostUrl,
            rendered_elementor_data: renderedTree,
            rendered_seo_meta: composedSeoMeta,
            pushed_at: new Date().toISOString(),
        })
        .eq('id', pushHistoryId)
        .eq('agency_id', agencyId)

    return {
        ok: true,
        pushHistoryId,
        pushedPostId,
        pushedPostUrl,
        idempotent,
    }
}

// ── Bulk push ────────────────────────────────────────────────────────────────

export interface BatchPushResult {
    results: PushTemplateResult[]
    ok_count: number
    failed_count: number
}

/** Hard cap per single batch call. Larger sets must chunk client-side. */
const MAX_BATCH_ROWS = 500

/**
 * Sequential per-row push. Runs strictly in order so a target WP installation
 * never receives concurrent Elementor saves (which can corrupt revisions).
 *
 * Each row gets its own idempotency_key derived from row index + values
 * digest, so the same batch can be safely retried partial-failure.
 */
export async function pushTemplateBatch(
    supabase: SupabaseClient,
    agencyId: string,
    templateId: string,
    targetSiteId: string,
    rows: Array<Record<string, string | string[]>>,
    opts: PushTemplateOpts = {},
): Promise<BatchPushResult> {
    if (!Array.isArray(rows)) {
        throw new TypeError('[pushTemplate] pushTemplateBatch: rows must be an array')
    }
    if (rows.length > MAX_BATCH_ROWS) {
        throw new TypeError(
            `[pushTemplate] pushTemplateBatch: rows length ${rows.length} capped at 500 per call`,
        )
    }
    const results: PushTemplateResult[] = []
    let ok = 0
    let failed = 0
    for (let i = 0; i < rows.length; i++) {
        const valuesDigest = sha1(JSON.stringify(rows[i] || {})).slice(0, 16)
        const r = await pushTemplate(supabase, agencyId, templateId, targetSiteId, rows[i], {
            ...opts,
            idempotencyKey:
                opts.idempotencyKey ??
                `${templateId.slice(0, 8)}-${targetSiteId.slice(0, 8)}-${valuesDigest}-${i}-${Date.now()}`,
        })
        results.push(r)
        if (r.ok) ok++
        else failed++
    }
    return { results, ok_count: ok, failed_count: failed }
}

// ── Diff (last two successful pushes) ────────────────────────────────────────

export interface DiffPushesResult {
    previous?: PushHistoryRow
    current?: PushHistoryRow
    diffSummary: string[]
}

/**
 * Compare the two most recent succeeded push_history rows for a given
 * (template, target_site) pair. Returns a flat list of changed JSON paths
 * (e.g., "$.elements[0].settings.title"). Returns null if fewer than 2
 * successful pushes exist.
 */
export async function diffPushes(
    supabase: SupabaseClient,
    agencyId: string,
    templateId: string,
    targetSiteId: string,
): Promise<DiffPushesResult | null> {
    const res = await supabase
        .from('koto_wp_push_history')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('template_id', templateId)
        .eq('target_site_id', targetSiteId)
        .order('pushed_at', { ascending: false })
        .limit(2)
    if ((res as { error?: unknown }).error) return null
    const rows = ((res as { data?: PushHistoryRow[] }).data ?? []) as PushHistoryRow[]
    if (rows.length < 2) return null
    const [current, previous] = rows
    const diffSummary: string[] = []
    diffTrees(current.rendered_elementor_data, previous.rendered_elementor_data, '$', diffSummary)
    return { previous, current, diffSummary }
}

function diffTrees(a: unknown, b: unknown, path: string, out: string[]): void {
    if (out.length > 200) return // cap output size
    if (a === b) return
    if (Array.isArray(a) && Array.isArray(b)) {
        const maxLen = Math.max(a.length, b.length)
        for (let i = 0; i < maxLen; i++) {
            diffTrees(a[i], b[i], `${path}[${i}]`, out)
        }
        return
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        const aObj = a as Record<string, unknown>
        const bObj = b as Record<string, unknown>
        const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
        for (const k of keys) {
            diffTrees(aObj[k], bObj[k], `${path}.${k}`, out)
        }
        return
    }
    out.push(path)
}
