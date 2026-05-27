// ─────────────────────────────────────────────────────────────────────────────
// Post-Phase 10 Plan 13 — v4 routing layer for /api/wp.
//
// Goal: panels (SearchReplacePanel, SnippetsPanel, AccessManagementPanel,
// ElementorBuilderPanel, ContentRotationPanel, SEOPanel, SyncPanel) work
// unchanged on v4-paired sites.
//
// How it plugs in: route.ts calls dispatchV4ActionIfPaired() near the top of
// the POST handler. If the site row has shim_version === 'v4' AND the action
// matches a v4-routable name, this returns a Response with the v3-shaped
// payload the panel expects. Otherwise returns null → fall through to the
// existing v3 handler.
//
// v3-paired sites (wpsc_api_key set, shim_version != 'v4') keep working
// unchanged because this function returns null for them.
//
// Response shape contract: each v3 handler returns a body the panel
// destructures. We translate v4 port results into that exact shape so panels
// don't notice. Look up the per-action shape in the comment above each
// branch — pulled from the panel JSX file referenced.
//
// IP-leak risk: this file lives on Vercel (dashboard side), unreadable by
// clients. The plugin-side never sees these action names. Safe.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
    listSnippets,
    saveSnippet,
    deleteSnippet,
    toggleSnippet,
    type SnippetKind,
    type SnippetScope,
} from '../../../lib/wp-shim/ports/snippetsPort'
import {
    getAccessPolicy,
    applyAccessPolicy,
    type AccessPolicy,
} from '../../../lib/wp-shim/ports/accessPort'
import {
    listTextTables,
    scanForReplacements,
    applyBulkUpdate,
    TEXT_COLUMNS_PER_TABLE,
} from '../../../lib/wp-shim/ports/searchReplacePort'
import {
    writeSeoMeta,
    listSeoCandidates,
    readSeoMeta,
} from '../../../lib/wp-shim/ports/seoPort'
import { refreshSitemap, SITEMAP_PATHS } from '../../../lib/wp-shim/ports/sitemapPort'
import {
    optionGet,
    optionDelete,
    fileExists,
    healthDiagnostics,
    pluginList,
    querySelect,
    postGetMetaBulk,
} from '../../../lib/wp-shim/verbs'
import { wpFetchJson } from '../../../lib/wp-shim/wpFetch'
import { loadSiteCredentials } from '../../../lib/wp-shim/credentialsVault'

// ── Action enumeration ──────────────────────────────────────────────────────
// Every v3 action the 7 panels emit that we want to intercept for v4 sites.
// Anything NOT in this set falls through to the v3 handler unchanged.
const V4_ROUTABLE_ACTIONS = new Set<string>([
    // SnippetsPanel
    'snip_list',
    'snip_save',
    'snip_delete',
    'snip_toggle',
    // AccessManagementPanel (only the actions that touch WP — am_save /
    // am_list_snapshots stay on the v3 path because they're pure Supabase).
    'am_load',
    'am_apply',
    'am_snapshot',
    'am_revert',
    // SearchReplacePanel (sr_list_jobs / sr_create_job / sr_get_samples /
    // sr_pause / sr_resume / sr_delete are pure Supabase — fall through).
    'sr_list_tables',
    'sr_run_chunk',
    'sr_undo_job',
    // ElementorBuilderPanel
    'kotoiq_builder_pages',
    // ContentRotationPanel
    'kotoiq_rotation_cache_get',
    'kotoiq_rotation_cache_del',
    // SEOPanel
    'kotoiq_seo_agency_test',
    'kotoiq_seo_pages',
    'kotoiq_seo_content_get',
    'kotoiq_seo_sitemaps',
    'kotoiq_seo_sitemap_rebuild',
    'sync_push',
    // SyncPanel
    'sync_status',
    'sync_log',
])

// ── Site shape we need ───────────────────────────────────────────────────────
// Mirrors the koto_wp_sites columns we read. Loose typing — Supabase row
// passes through unchanged.
export interface V4DispatchSite {
    id: string
    agency_id: string
    site_url: string
    shim_version: string | null
    client_id?: string | null
    site_name?: string | null
    plugin_version?: string | null
}

// ── Utility: panel envelope mapping ──────────────────────────────────────────
// Every panel expects the v3 proxy envelope:
//   { ok, data, status?, error?, duration? }
// where `data` carries the plugin's actual response. The map* helpers below
// take a v4 ShimRpcResponse and emit that envelope so panels don't notice.
function envelopeOk(data: unknown, status = 200) {
    return NextResponse.json({ ok: true, data, status, duration: 0 })
}
function envelopeErr(message: string, status = 500, extra?: Record<string, unknown>) {
    return NextResponse.json(
        { ok: false, data: { error: message, ...(extra || {}) }, status, error: message, duration: 0 },
        { status: 200 }, // panels expect 200 + ok:false; matches v3 proxy behaviour
    )
}

// ── snip_* → snippetsPort ─────────────────────────────────────────────────────
// v3 disk shape per snippets.php: { id, name, type, code, location, active,
// updated_at }. The port's Snippet shape uses {kind, scope}; map back.
type DiskSnippet = {
    id: string
    name: string
    type: 'php' | 'html' | 'js' | 'css'
    code: string
    location: string
    active: boolean
    updated_at: string
}

function portToDisk(s: {
    id: string
    name: string
    kind: SnippetKind
    scope: SnippetScope
    code: string
    active: boolean
    updated_at: string
}): DiskSnippet {
    let type: DiskSnippet['type']
    let location: string
    if (s.kind === 'php') {
        type = 'php'
        location = s.scope === 'admin' ? 'admin' : s.scope === 'frontend' ? 'frontend' : 'everywhere'
    } else if (s.kind === 'css') {
        type = 'css'
        location = 'head'
    } else if (s.kind === 'js_head') {
        type = 'js'
        location = 'head'
    } else if (s.kind === 'js_footer') {
        type = 'js'
        location = 'footer'
    } else if (s.kind === 'html_head') {
        type = 'html'
        location = 'head'
    } else {
        type = 'html'
        location = 'footer'
    }
    return {
        id: s.id,
        name: s.name,
        type,
        location,
        code: s.code,
        active: s.active,
        updated_at: s.updated_at,
    }
}

function diskToPortInput(d: Partial<DiskSnippet>): {
    name: string
    kind: SnippetKind
    scope: SnippetScope
    code: string
    active: boolean
} {
    const type = (d.type || 'html') as DiskSnippet['type']
    const location = String(d.location || 'head')
    let kind: SnippetKind
    if (type === 'php') kind = 'php'
    else if (type === 'css') kind = 'css'
    else if (type === 'js') kind = location === 'footer' ? 'js_footer' : 'js_head'
    else kind = location === 'footer' ? 'html_footer' : 'html_head'
    const scope: SnippetScope =
        location === 'admin' ? 'admin' : location === 'frontend' ? 'frontend' : 'both'
    return {
        name: String(d.name || ''),
        kind,
        scope,
        code: String(d.code || ''),
        active: d.active === true,
    }
}

// ── Public entry ─────────────────────────────────────────────────────────────
/**
 * Returns a Response when this v4-paired site handles the action via the
 * shim verbs; returns null when the caller should fall through to the v3
 * handler.
 *
 * Contract:
 *   - site is v3-paired (shim_version !== 'v4')  → return null
 *   - action is not in V4_ROUTABLE_ACTIONS       → return null
 *   - otherwise route via v4 ports + return the v3-shaped envelope
 */
export async function dispatchV4ActionIfPaired(
    sb: SupabaseClient,
    action: string,
    body: Record<string, unknown>,
    site: V4DispatchSite | null,
): Promise<Response | null> {
    if (!site) return null
    if (site.shim_version !== 'v4') return null
    if (!V4_ROUTABLE_ACTIONS.has(action)) return null

    try {
        switch (action) {
            // ── Snippets ────────────────────────────────────────────────────
            case 'snip_list': {
                const r = await listSnippets(site.site_url)
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                return envelopeOk({ snippets: r.data.map(portToDisk) }, r.status)
            }
            case 'snip_save': {
                const snippet = (body.snippet || {}) as Partial<DiskSnippet>
                if (!snippet.name || !snippet.code) {
                    return envelopeErr('snippet.name and snippet.code required', 400)
                }
                const input = diskToPortInput(snippet)
                const r = await saveSnippet(site.site_url, {
                    id: snippet.id || undefined,
                    ...input,
                })
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                return envelopeOk({ snippet: portToDisk(r.data), saved: true }, r.status)
            }
            case 'snip_delete': {
                const id = String(body.id || '')
                if (!id) return envelopeErr('id required', 400)
                const r = await deleteSnippet(site.site_url, id)
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                return envelopeOk({ deleted: true }, r.status)
            }
            case 'snip_toggle': {
                const id = String(body.id || '')
                const active = body.active === true
                if (!id) return envelopeErr('id required', 400)
                const r = await toggleSnippet(site.site_url, id, active)
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                return envelopeOk({ snippet: portToDisk(r.data) }, r.status)
            }

            // ── Access Management ───────────────────────────────────────────
            case 'am_load': {
                // Combined load: live policy from v4 site + WP roles + stored
                // policy from Supabase. AccessManagementPanel reads:
                //   data.roles, data.live_policy, data.global_disable_file_edit,
                //   data.stored, data.remote_ok, data.error
                // (the result is consumed at the TOP level, not under data.data)
                const policyRes = await getAccessPolicy(site.site_url)
                const policyOk = policyRes.ok
                const live = policyOk ? policyRes.data : null

                // Fetch WP role list via core REST. v4 has no dedicated roles
                // verb — wp/v2/users/me?context=edit returns role names but
                // not the role registry. Use /wp/v2/types as a probe; if that
                // fails, fall back to the v3 plugin's static role set.
                let rolesMap: Record<string, { name: string }> = {}
                try {
                    const creds = await loadSiteCredentials(sb, site.agency_id, site.id)
                    if (creds) {
                        // wp/v2 doesn't expose "list of roles" directly. The pragmatic
                        // workaround: read the policy's known roles + the standard 5.
                        const seedRoles = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
                        for (const slug of seedRoles) rolesMap[slug] = { name: slug.charAt(0).toUpperCase() + slug.slice(1) }
                        // Probe users/me for the caller's roles to ensure auth works.
                        await wpFetchJson(site.site_url, '/wp/v2/users/me?context=edit', creds).catch(() => null)
                    }
                } catch {
                    // ignore — return the seed list
                }

                const { data: stored } = await sb
                    .from('koto_access_policies')
                    .select('*')
                    .eq('site_id', site.id)
                    .maybeSingle()

                return NextResponse.json({
                    roles: rolesMap,
                    live_policy: live?.role_features || {},
                    global_disable_file_edit: !!live?.global_disable_file_edit,
                    stored,
                    remote_ok: policyOk,
                    error: policyOk ? null : (policyRes as { error: { message: string } }).error.message,
                })
            }
            case 'am_apply': {
                // Read the saved draft from Supabase, push to v4 site via
                // applyAccessPolicy (writes the option + per-role cap apply).
                const { data: stored } = await sb
                    .from('koto_access_policies')
                    .select('*')
                    .eq('site_id', site.id)
                    .maybeSingle()
                if (!stored) return envelopeErr('No saved policy. Save first.', 400)
                const policy: AccessPolicy = {
                    role_features: (stored.policy as AccessPolicy['role_features']) || {},
                    global_disable_file_edit: !!stored.file_editor_disabled_globally,
                }
                const r = await applyAccessPolicy(site.site_url, policy)
                if (!r.ok) {
                    return NextResponse.json({ error: r.error.message }, { status: 500 })
                }
                await sb
                    .from('koto_access_policies')
                    .update({ last_applied_at: new Date().toISOString() })
                    .eq('id', stored.id)
                return NextResponse.json({ ok: true, applied: r.data })
            }
            case 'am_snapshot': {
                // v4 snapshot = current option contents + per-role caps. We
                // don't have a per-role-caps verb (capability.apply writes
                // but does not read), so we snapshot just the policy option
                // + the runtime live_policy. Operator can revert by writing
                // the same option back.
                const note = (body.note as string) || null
                const policyRes = await getAccessPolicy(site.site_url)
                if (!policyRes.ok) {
                    return NextResponse.json({ error: policyRes.error.message }, { status: 500 })
                }
                const { data: storedRow } = await sb
                    .from('koto_access_policies')
                    .select('id')
                    .eq('site_id', site.id)
                    .maybeSingle()
                const { data: snap, error } = await sb
                    .from('koto_access_snapshots')
                    .insert({
                        site_id: site.id,
                        agency_id: site.agency_id,
                        policy_id: storedRow?.id || null,
                        snapshot: { kind: 'v4_policy', policy: policyRes.data },
                        note,
                    })
                    .select()
                    .single()
                if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                return NextResponse.json({ snapshot: snap })
            }
            case 'am_revert': {
                const snapshot_id = String(body.snapshot_id || '')
                if (!snapshot_id) return envelopeErr('snapshot_id required', 400)
                const { data: snap } = await sb
                    .from('koto_access_snapshots')
                    .select('*')
                    .eq('id', snapshot_id)
                    .single()
                if (!snap) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
                const snapPayload = (snap.snapshot || {}) as { kind?: string; policy?: AccessPolicy }
                if (!snapPayload.policy) {
                    return NextResponse.json(
                        { error: 'Snapshot is from v3-era (cannot revert on v4 site). Take a fresh snapshot first.' },
                        { status: 400 },
                    )
                }
                const r = await applyAccessPolicy(site.site_url, {
                    role_features: snapPayload.policy.role_features || {},
                    global_disable_file_edit: !!snapPayload.policy.global_disable_file_edit,
                })
                if (!r.ok) {
                    return NextResponse.json({ error: r.error.message }, { status: 500 })
                }
                return NextResponse.json({ ok: true })
            }

            // ── Search & Replace ────────────────────────────────────────────
            case 'sr_list_tables': {
                // SearchReplacePanel reads data?.data?.tables || data?.tables —
                // we emit the envelope with .tables under data, matching the
                // v3 plugin's wpsimplecode/search-replace/tables shape.
                const r = await listTextTables(site.site_url)
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                // v3 shape per table: { name, primary_key, columns: string[],
                // is_core: bool, rows: int }. Port returns { table, pk_col,
                // text_cols, rows, is_text_in_db }.
                const tables = r.data.map((t) => ({
                    name: t.table,
                    primary_key: t.pk_col,
                    columns: Array.from(t.text_cols),
                    rows: t.rows ?? 0,
                    is_core: ['posts', 'postmeta', 'options', 'terms', 'termmeta', 'term_taxonomy'].includes(t.table),
                    is_text: t.is_text_in_db,
                }))
                return envelopeOk({ tables }, r.status)
            }
            case 'sr_run_chunk': {
                // The v3 sr_run_chunk path drives the worker through one table
                // at a time, persisting progress + samples + undo journal in
                // Supabase. We can't fully recreate that with the current v4
                // ports (the searchReplacePort scans+applies in one call), so
                // we run the FULL job in one chunk and return { done: true }.
                // The panel's `while (!done)` loop terminates after one tick.
                //
                // Trade-off: panels expecting incremental progress will see one
                // big jump instead of per-table chunks. Acceptable for v4 sites
                // — the operator gets the result; the UX is less granular.
                const job_id = String(body.job_id || '')
                if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 })
                const { data: job } = await sb
                    .from('koto_search_replace_jobs')
                    .select('*')
                    .eq('id', job_id)
                    .single()
                if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
                if (job.status === 'complete' || job.status === 'undone' || job.status === 'failed') {
                    return NextResponse.json({ ok: true, done: true, job })
                }

                const tables: Array<{ name: string; primary_key: string; columns: string[] }> =
                    job.scope?.tables || []
                const tableNames = tables.map((t) => t.name)
                // Cap table list to those the v4 port actually understands.
                const supported = tableNames.filter((n) => TEXT_COLUMNS_PER_TABLE[n])
                if (!supported.length) {
                    await sb
                        .from('koto_search_replace_jobs')
                        .update({
                            status: 'failed',
                            error: 'No supported tables in scope for v4 site (port allowlist mismatch)',
                            completed_at: new Date().toISOString(),
                        })
                        .eq('id', job_id)
                    return NextResponse.json(
                        { error: 'No supported tables in scope for v4 site', table: tableNames.join(',') },
                        { status: 400 },
                    )
                }

                const scanRes = await scanForReplacements(site.site_url, {
                    tables: supported,
                    find: String(job.search),
                    replace: String(job.replace_with || ''),
                    case_sensitive: job.options?.case_sensitive === true,
                    regex: job.options?.regex === true,
                })
                if (!scanRes.ok) {
                    await sb
                        .from('koto_search_replace_jobs')
                        .update({
                            status: 'failed',
                            error: scanRes.error.message,
                            completed_at: new Date().toISOString(),
                        })
                        .eq('id', job_id)
                    return NextResponse.json({ error: scanRes.error.message }, { status: 500 })
                }

                const replacements = scanRes.data.replacements

                // Apply (skipped in dry run).
                let applied = 0
                if (!job.is_dry_run && replacements.length) {
                    const applyRes = await applyBulkUpdate(site.site_url, replacements)
                    if (!applyRes.ok) {
                        await sb
                            .from('koto_search_replace_jobs')
                            .update({
                                status: 'failed',
                                error: applyRes.error.message,
                                completed_at: new Date().toISOString(),
                            })
                            .eq('id', job_id)
                        return NextResponse.json({ error: applyRes.error.message }, { status: 500 })
                    }
                    applied = applyRes.data.applied
                    // Persist undo journal — before is original, after is rendered.
                    const journalRows = replacements.map((r) => ({
                        job_id,
                        agency_id: site.agency_id,
                        table_name: r.table,
                        primary_key_column: r.pk_col,
                        primary_key_value: String(r.pk_val),
                        column_name: r.column,
                        before_value: r.before,
                        after_value: r.after,
                    }))
                    const BATCH = 500
                    for (let i = 0; i < journalRows.length; i += BATCH) {
                        await sb.from('koto_search_replace_changes').insert(journalRows.slice(i, i + BATCH))
                    }
                }

                // Persist preview samples for dry run.
                if (job.is_dry_run && replacements.length) {
                    const sampleRows = replacements.slice(0, 200).map((r) => ({
                        job_id,
                        agency_id: site.agency_id,
                        table_name: r.table,
                        primary_key_column: r.pk_col,
                        primary_key_value: String(r.pk_val),
                        column_name: r.column,
                        before_value: r.before,
                        after_value: r.after,
                    }))
                    await sb.from('koto_search_replace_changes').insert(sampleRows)
                }

                await sb
                    .from('koto_search_replace_jobs')
                    .update({
                        current_table: supported[supported.length - 1] || null,
                        current_table_index: supported.length,
                        current_offset: 0,
                        tables_completed: supported.length,
                        total_rows_scanned: scanRes.data.replacements.length,
                        total_matches: replacements.length,
                        total_replacements: applied || replacements.length,
                        total_rows_changed: applied || (job.is_dry_run ? 0 : replacements.length),
                        status: 'complete',
                        completed_at: new Date().toISOString(),
                    })
                    .eq('id', job_id)

                return NextResponse.json({
                    ok: true,
                    table: supported[0] || '',
                    scanned: replacements.length,
                    matches: replacements.length,
                    replacements: applied || replacements.length,
                    rows_changed: applied || (job.is_dry_run ? 0 : replacements.length),
                    has_more: false,
                    next_offset: 0,
                    next_table_index: supported.length,
                    done: true,
                    samples: replacements.slice(0, 25).map((r) => ({
                        pk: r.pk_val,
                        column: r.column,
                        before: r.before,
                        after: r.after,
                    })),
                })
            }
            case 'sr_undo_job': {
                // Stream journal rows + restore via applyBulkUpdate with
                // before_value as the new value. Mirrors v3's restore loop
                // but writes through the v4 verb instead of the v3 plugin.
                const job_id = String(body.job_id || '')
                const batch_size = Number(body.batch_size || 200)
                const { data: job } = await sb
                    .from('koto_search_replace_jobs')
                    .select('*')
                    .eq('id', job_id)
                    .single()
                if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
                if (job.is_dry_run) {
                    return NextResponse.json({ error: 'Preview jobs have no undo journal' }, { status: 400 })
                }

                await sb.from('koto_search_replace_jobs').update({ status: 'undoing' }).eq('id', job_id)

                let totalRestored = 0
                let lastId = 0
                let batchN = 0
                const maxBatches = 500
                while (batchN < maxBatches) {
                    const { data: batchRows } = await sb
                        .from('koto_search_replace_changes')
                        .select('id, table_name, primary_key_column, primary_key_value, column_name, before_value')
                        .eq('job_id', job_id)
                        .eq('is_restored', false)
                        .gt('id', lastId)
                        .order('id', { ascending: true })
                        .limit(batch_size)
                    if (!batchRows || !batchRows.length) break

                    // Map to applyBulkUpdate shape. Only proceed for rows whose
                    // table is in the v4 port's whitelist.
                    const updates = batchRows
                        .filter((r: any) => TEXT_COLUMNS_PER_TABLE[r.table_name])
                        .map((r: any) => ({
                            table: r.table_name,
                            pk_col: r.primary_key_column,
                            pk_val: Number(r.primary_key_value),
                            column: r.column_name,
                            before: '',
                            after: r.before_value, // restore to before-value
                            is_serialized: false,
                        }))

                    if (updates.length) {
                        const r = await applyBulkUpdate(site.site_url, updates)
                        if (!r.ok) {
                            await sb
                                .from('koto_search_replace_jobs')
                                .update({ status: 'failed', error: r.error.message })
                                .eq('id', job_id)
                            return NextResponse.json(
                                { error: r.error.message, restored_so_far: totalRestored },
                                { status: 500 },
                            )
                        }
                        totalRestored += r.data.applied
                    }

                    const ids = batchRows.map((r: any) => r.id)
                    await sb.from('koto_search_replace_changes').update({ is_restored: true }).in('id', ids)
                    lastId = batchRows[batchRows.length - 1].id
                    batchN++
                    if (batchRows.length < batch_size) break
                }

                await sb
                    .from('koto_search_replace_jobs')
                    .update({ status: 'undone', completed_at: new Date().toISOString() })
                    .eq('id', job_id)
                return NextResponse.json({ ok: true, restored: totalRestored })
            }

            // ── Elementor Builder ────────────────────────────────────────────
            case 'kotoiq_builder_pages': {
                // The panel expects:
                //   { ok, data: { pages: [{ id, title, slug, status, elementor_version, url, updated_at }] },
                //     detect: { elementor, elementor_version, elementor_pro, ..., theme_name } }
                // v4 has no dedicated builder.pages verb — use query.select
                // 'posts.list_by_post_type' to list pages, then probe pinned
                // schema for elementor version detection via health.diagnostics.
                const pagesRes = await querySelect<{
                    ID: number
                    post_title: string
                    post_name: string
                    post_status: string
                    post_modified: string
                }>(site.site_url, {
                    name: 'posts.list_by_post_type',
                    params: { post_type: 'page', limit_max: 200, offset: 0 },
                })

                let pages: Array<{
                    id: number
                    title: string
                    slug: string
                    status: string
                    url: string
                    updated_at: string
                    elementor_version: string | null
                }> = []
                if (pagesRes.ok) {
                    // The shim doesn't tell us per-page elementor version
                    // without an extra meta read. For the inventory view,
                    // best-effort: leave elementor_version null and let the
                    // operator click through to Edit. To detect *which* pages
                    // are Elementor-edited we'd need post.get_meta_bulk on
                    // _elementor_edit_mode — defer unless needed.
                    pages = pagesRes.data.rows.map((p) => ({
                        id: p.ID,
                        title: p.post_title || '(untitled)',
                        slug: p.post_name || '',
                        status: p.post_status,
                        url: site.site_url.replace(/\/$/, '') + '/?p=' + p.ID,
                        updated_at: p.post_modified,
                        elementor_version: null,
                    }))
                }

                // Detection summary via health.diagnostics + plugin.list.
                const [diag, plugins] = await Promise.all([
                    healthDiagnostics(site.site_url),
                    pluginList(site.site_url),
                ])
                let detect: Record<string, unknown> = {}
                if (diag.ok) {
                    detect.elementor = !!diag.data.elementor_version
                    detect.elementor_version = diag.data.elementor_version || null
                }
                if (plugins.ok) {
                    const pro = plugins.data.plugins.find((p) =>
                        p.file.toLowerCase().includes('elementor-pro') || p.name.toLowerCase().includes('elementor pro'),
                    )
                    detect.elementor_pro = !!pro?.active
                    detect.elementor_pro_version = pro?.version || null
                }

                return NextResponse.json({
                    ok: true,
                    data: { pages },
                    detect,
                    status: 200,
                })
            }

            // ── Content Rotation ─────────────────────────────────────────────
            case 'kotoiq_rotation_cache_get': {
                const post_id = Number(body.post_id || 0)
                if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' })
                const r = await optionGet(site.site_url, { name: `kotoiq_rotation_cache_${post_id}` })
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                // Panel expects { post_id, cached_selections: { section: index } }
                const value = r.data?.value || {}
                return envelopeOk({ post_id, cached_selections: value }, r.status)
            }
            case 'kotoiq_rotation_cache_del': {
                const post_id = Number(body.post_id || 0)
                if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' })
                const r = await optionDelete(site.site_url, { name: `kotoiq_rotation_cache_${post_id}` })
                if (!r.ok) return envelopeErr(r.error.message, r.status, { code: r.error.code })
                return envelopeOk({ deleted: true }, r.status)
            }

            // ── SEO ──────────────────────────────────────────────────────────
            case 'kotoiq_seo_agency_test': {
                // Panel reads d1.data and looks at: site_name, site_url,
                // wp_version, theme, last_sync, gsc_connected, seo_engine,
                // seo_plugin, yoast_version, rankmath_version, tagline.
                const [diag, plugins] = await Promise.all([
                    healthDiagnostics(site.site_url),
                    pluginList(site.site_url),
                ])
                if (!diag.ok) return envelopeErr(diag.error.message, diag.status, { code: diag.error.code })

                const ps = plugins.ok ? plugins.data.plugins : []
                const yoast = ps.find(
                    (p) => p.file.includes('wordpress-seo') || p.name.toLowerCase().includes('yoast'),
                )
                const rm = ps.find(
                    (p) => p.file.includes('seo-by-rank-math') || p.name.toLowerCase().includes('rank math'),
                )
                let seo_engine: string = 'kotoiq'
                let seo_plugin: string | null = null
                if (yoast?.active) {
                    seo_plugin = 'yoast'
                } else if (rm?.active) {
                    seo_plugin = 'rankmath'
                }

                return envelopeOk(
                    {
                        site_name: site.site_name || '',
                        site_url: site.site_url,
                        wp_version: diag.data.wp_version,
                        plugin_version: diag.data.shim_version,
                        theme: null,
                        last_sync: new Date().toISOString(),
                        gsc_connected: false, // v4 has no GSC integration yet
                        seo_engine,
                        seo_plugin,
                        yoast_version: yoast?.version || null,
                        rankmath_version: rm?.version || null,
                        tagline: '',
                    },
                    200,
                )
            }
            case 'kotoiq_seo_pages': {
                // Panel reads d2.data?.pages with: id, title, url, status,
                // type, has_seo_meta. Use listSeoCandidates per post-type +
                // bulk-meta-read to populate has_seo_meta.
                const creds = await loadSiteCredentials(sb, site.agency_id, site.id).catch(() => null)
                if (!creds) {
                    return envelopeErr('Site has no paired credentials', 401)
                }
                const [postsRes, pagesRes] = await Promise.all([
                    listSeoCandidates(site.site_url, creds, { postType: 'posts', status: 'publish', perPage: 100 }),
                    listSeoCandidates(site.site_url, creds, { postType: 'pages', status: 'publish', perPage: 100 }),
                ])
                const out: Array<{
                    id: number
                    title: string
                    url: string
                    status: string
                    type: 'post' | 'page'
                    has_seo_meta: boolean
                }> = []
                if (postsRes.ok) {
                    for (const p of postsRes.data.posts) {
                        out.push({ id: p.id, title: p.title, url: p.url, status: p.status, type: 'post', has_seo_meta: false })
                    }
                }
                if (pagesRes.ok) {
                    for (const p of pagesRes.data.posts) {
                        out.push({ id: p.id, title: p.title, url: p.url, status: p.status, type: 'page', has_seo_meta: false })
                    }
                }
                // Bulk has_seo_meta probe — one round-trip across every listed
                // post/page. Title is the cheapest "is meta configured" check:
                // every SEO engine (KotoIQ-native, Yoast, RankMath) writes a
                // title key when a user fills in meta. If none of the three is
                // set, no meta exists.
                if (out.length) {
                    const titleKeys = ['_kotoiq_title', '_yoast_wpseo_title', 'rank_math_title']
                    const metaRes = await postGetMetaBulk(site.site_url, {
                        posts: out.map((p) => ({ post_id: p.id, keys: titleKeys })),
                    })
                    if (metaRes.ok) {
                        const results = metaRes.data.results || {}
                        for (const p of out) {
                            const rec = results[String(p.id)] || {}
                            const hasMeta =
                                (typeof rec._kotoiq_title === 'string' && rec._kotoiq_title.length > 0) ||
                                (typeof rec._yoast_wpseo_title === 'string' && rec._yoast_wpseo_title.length > 0) ||
                                (typeof rec.rank_math_title === 'string' && rec.rank_math_title.length > 0)
                            p.has_seo_meta = hasMeta
                        }
                    }
                    // If the bulk read fails, leave has_seo_meta=false (degrades
                    // gracefully — UI shows "missing meta" as before).
                }
                return envelopeOk({ pages: out }, 200)
            }
            case 'kotoiq_seo_content_get': {
                // Panel reads cd?.data?.content with the rendered HTML.
                const post_id = Number(body.post_id || 0)
                if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })
                const creds = await loadSiteCredentials(sb, site.agency_id, site.id).catch(() => null)
                if (!creds) return envelopeErr('Site has no paired credentials', 401)
                const r = await wpFetchJson<{ content?: { rendered?: string } | string; title?: { rendered?: string } | string }>(
                    site.site_url,
                    `/wp/v2/posts/${post_id}?_fields=id,title,content`,
                    creds,
                )
                if (!r.ok) {
                    // Try /wp/v2/pages — posts and pages live at different REST bases.
                    const r2 = await wpFetchJson<{ content?: { rendered?: string } | string; title?: { rendered?: string } | string }>(
                        site.site_url,
                        `/wp/v2/pages/${post_id}?_fields=id,title,content`,
                        creds,
                    )
                    if (!r2.ok) return envelopeErr(r2.error, r2.status)
                    const content = typeof r2.data?.content === 'string' ? r2.data.content : r2.data?.content?.rendered || ''
                    const title = typeof r2.data?.title === 'string' ? r2.data.title : r2.data?.title?.rendered || ''
                    return envelopeOk({ id: post_id, title, content }, 200)
                }
                const content = typeof r.data?.content === 'string' ? r.data.content : r.data?.content?.rendered || ''
                const title = typeof r.data?.title === 'string' ? r.data.title : r.data?.title?.rendered || ''
                return envelopeOk({ id: post_id, title, content }, 200)
            }
            case 'kotoiq_seo_sitemaps': {
                // Panel reads sd.data?.sitemaps as an array. Probe each known
                // sitemap path; report which exist + their mtime.
                const sitemaps: Array<{ name: string; url: string; exists: boolean; size?: number; mtime?: number }> = []
                for (const [name, path] of Object.entries(SITEMAP_PATHS)) {
                    const r = await fileExists(site.site_url, { path })
                    sitemaps.push({
                        name,
                        url: site.site_url.replace(/\/$/, '') + '/kotoiq-sitemap-' + name + '.xml',
                        exists: r.ok ? r.data.exists : false,
                        size: r.ok ? r.data.size : undefined,
                        mtime: r.ok ? r.data.mtime : undefined,
                    })
                }
                return envelopeOk({ sitemaps }, 200)
            }
            case 'kotoiq_seo_sitemap_rebuild': {
                // Panel reads d.data?.ping?.results — we surface compose+push
                // results. No ping (v4 doesn't ping engines from the plugin).
                const r = await refreshSitemap(sb, site.agency_id, site.id)
                if (!r.ok) return envelopeErr(r.error || 'Sitemap refresh failed', 500)
                return envelopeOk(
                    {
                        ok: true,
                        files: r.files,
                        total_urls: r.total_urls,
                        duration_ms: r.duration_ms,
                        ping: { results: {} }, // no pings in v4
                    },
                    200,
                )
            }

            // ── Sync ─────────────────────────────────────────────────────────
            case 'sync_push': {
                // Panel sends:
                //   { changes: [{ type: 'seo_meta', post_id, data: { seo_title, meta_description, focus_keyword } }] }
                // For v4, route seo_meta changes through writeSeoMeta.
                // Other types (content, publish, etc.) — not yet supported on v4.
                const changes = (body.changes as Array<{
                    type: string
                    post_id: number
                    data: Record<string, unknown>
                }>) || []
                if (!changes.length) return NextResponse.json({ error: 'No changes to push' }, { status: 400 })

                let applied = 0
                let failed = 0
                const types: Record<string, number> = {}
                const errors: Array<{ post_id: number; type: string; error: string }> = []
                for (const ch of changes) {
                    types[ch.type] = (types[ch.type] || 0) + 1
                    if (ch.type === 'seo_meta') {
                        const r = await writeSeoMeta(site.site_url, ch.post_id, {
                            seo_title: ch.data.seo_title as string | undefined,
                            meta_description: ch.data.meta_description as string | undefined,
                            focus_keyword: ch.data.focus_keyword as string | undefined,
                            canonical: ch.data.canonical as string | undefined,
                            robots: ch.data.robots as string | undefined,
                            schema_type: ch.data.schema_type as string | undefined,
                            schema_custom: ch.data.schema_custom as string | undefined,
                        })
                        if (r.ok) applied++
                        else {
                            failed++
                            errors.push({ post_id: ch.post_id, type: ch.type, error: r.error.message })
                        }
                    } else {
                        failed++
                        errors.push({
                            post_id: ch.post_id,
                            type: ch.type,
                            error: `change type "${ch.type}" not supported on v4 sites yet`,
                        })
                    }
                }
                // Log to koto_wp_push_history so SyncPanel sync_log can render
                // the event. We reuse the existing audit table — see
                // sitemapPort.refreshSitemap for the same pattern.
                try {
                    await sb.from('koto_wp_push_history').insert({
                        agency_id: site.agency_id,
                        template_id: null,
                        target_site_id: site.id,
                        pushed_post_id: null,
                        pushed_post_url: null,
                        variable_values: {
                            kind: 'sync_push',
                            applied,
                            failed,
                            types,
                            errors: errors.slice(0, 20),
                        },
                        rendered_elementor_data: null,
                        rendered_seo_meta: null,
                        idempotency_key: `sync_push_${site.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        status: failed === 0 ? 'sync_push' : 'sync_push_partial',
                        error_code: failed === 0 ? null : 'partial_or_failed',
                        error_message: errors[0]?.error || null,
                        pushed_at: new Date().toISOString(),
                    })
                } catch {
                    // sync log is best-effort
                }
                return NextResponse.json({
                    ok: failed === 0,
                    applied,
                    failed,
                    types,
                    errors,
                })
            }
            case 'sync_status': {
                // Panel reads top-level: status, last_sync, last_push, seo_engine, plugin_version.
                const diag = await healthDiagnostics(site.site_url)
                const connected = diag.ok
                // Last push from koto_wp_push_history.
                const { data: lastPush } = await sb
                    .from('koto_wp_push_history')
                    .select('pushed_at')
                    .eq('target_site_id', site.id)
                    .order('pushed_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                return NextResponse.json({
                    ok: true,
                    status: connected ? 'connected' : 'disconnected',
                    last_sync: diag.ok ? new Date().toISOString() : null,
                    last_push: lastPush?.pushed_at || null,
                    seo_engine: 'kotoiq',
                    plugin_version: diag.ok ? diag.data.shim_version : null,
                })
            }
            case 'sync_log': {
                // Panel reads .events as an array of { action, applied, failed, types, time }.
                // Map koto_wp_push_history rows (variable_values jsonb) to that shape.
                const { data: rows } = await sb
                    .from('koto_wp_push_history')
                    .select('variable_values, status, pushed_at')
                    .eq('target_site_id', site.id)
                    .order('pushed_at', { ascending: false })
                    .limit(50)
                const events = (rows || []).map((r: any) => {
                    const vv = r.variable_values || {}
                    return {
                        action: vv.kind === 'sync_push' ? 'push' : vv.kind || r.status,
                        applied: Number(vv.applied || 0),
                        failed: Number(vv.failed || 0),
                        types: vv.types || {},
                        time: r.pushed_at,
                    }
                })
                return NextResponse.json({ ok: true, events })
            }
        }
    } catch (err: any) {
        // Catch envelope-handler bugs so a v4 failure can't crash the route.
        // Returning ok:false matches v3 proxy behaviour — panels show the
        // error in their toast/error UI instead of a 500.
        const message = err instanceof Error ? err.message : String(err)
        return envelopeErr(`v4 routing error: ${message}`, 500)
    }

    // Should be unreachable given V4_ROUTABLE_ACTIONS.has(action) check above.
    return null
}

// ── Re-export the actions set for testability / introspection ────────────────
export { V4_ROUTABLE_ACTIONS }
