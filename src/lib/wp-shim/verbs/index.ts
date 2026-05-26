// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 04 — typed TypeScript wrappers around shimRpc for the 20
// core verbs. Each wrapper is a thin signature-with-types layer over the
// underlying signed-envelope client; runtime guards on optionUpdate /
// optionDelete / fileWrite / fileDelete provide defense-in-depth fail-fast
// for inputs the PHP side would reject anyway, saving a round-trip.
//
// The response shapes mirror the PHP handlers in
// wp-plugin-kotoiq-shim/includes/rpc/verbs-*.php byte-for-byte.
//
// Downstream consumers (Plans 10-05 / 06 / 07 / 08 / 09) should import the
// wrappers via `from '@/lib/wp-shim'`, which re-exports this barrel.
// ─────────────────────────────────────────────────────────────────────────────

import { shimRpc } from '../shimRpc'
import type { ShimRpcResponse } from '../types'

// ─── Shared deny-list (mirrors KOTOIQ_SHIM_OPTION_DENY_LIST in PHP) ────────
// TypeScript cannot express "any string not in this set" natively, so we
// enforce the rule at runtime in optionUpdate / optionDelete. The PHP side
// re-checks — this is defense-in-depth.
const PROTECTED_OPTION_NAMES = new Set<string>([
    'siteurl',
    'home',
    'admin_email',
    'template',
    'stylesheet',
    'WPLANG',
    'blogname',
    'blogdescription',
])

function assertOptionWriteAllowed(name: string): void {
    if (typeof name !== 'string' || name === '') {
        throw new TypeError('[wp-shim] option name must be a non-empty string')
    }
    if (name.startsWith('_transient_') || name.startsWith('_site_transient_')) {
        throw new TypeError(
            `[wp-shim] option name "${name}" is a transient — use the transient verb group instead`,
        )
    }
    if (PROTECTED_OPTION_NAMES.has(name)) {
        throw new TypeError(`[wp-shim] option name "${name}" is on the protected deny-list`)
    }
}

// Path confinement (mirrors verbs-file.php kotoiq_shim_file_resolve_write).
// Returns the normalised relative path on success; throws on any violation.
function assertWriteablePath(path: string): void {
    if (typeof path !== 'string' || path === '') {
        throw new TypeError('[wp-shim] file path must be a non-empty string')
    }
    if (path.includes('\0') || path.includes('\\') || path.includes('://')) {
        throw new TypeError('[wp-shim] file path contains illegal characters')
    }
    // Any `..` segment is rejected — even if the literal prefix matches,
    // a traversal further down would escape the kotoiq root.
    for (const segment of path.split('/')) {
        if (segment === '..') {
            throw new TypeError('[wp-shim] file path contains traversal (..) segment')
        }
    }
    const clean = path.replace(/^\/+/, '')
    if (!clean.startsWith('uploads/kotoiq/')) {
        throw new TypeError(
            '[wp-shim] file writes/deletes are confined to wp-content/uploads/kotoiq/**',
        )
    }
}

// ─── health.* ──────────────────────────────────────────────────────────────

export interface HealthPingResponse {
    shim_version: string
    wp_version: string
    php_version: string
    site_url: string
    time: number
    elementor_version: string | null
}

export async function healthPing(
    siteUrl: string,
): Promise<ShimRpcResponse<HealthPingResponse>> {
    return shimRpc<HealthPingResponse>(siteUrl, 'health.ping', {})
}

export interface HealthDiagnosticsResponse extends HealthPingResponse {
    active_plugins: Array<{ file: string; name: string; version: string }>
    _truncated?: boolean
    app_passwords_available: boolean
    app_passwords_enabled_for_service_user: boolean
    timezone: string
    post_counts: { posts: number; pages: number; attachments: number }
    kotoiq_shim_state: {
        paired: boolean
        dashboard_url: string
        pairing_window_open: boolean
        features_enabled: Record<string, boolean>
        legacy_bearer_present: boolean
    }
}

export async function healthDiagnostics(
    siteUrl: string,
): Promise<ShimRpcResponse<HealthDiagnosticsResponse>> {
    return shimRpc<HealthDiagnosticsResponse>(siteUrl, 'health.diagnostics', {})
}

// ─── post.* + meta.* ───────────────────────────────────────────────────────

export interface PostGetMetaBulkArgs {
    posts: Array<{ post_id: number; keys: string[] }>
}
export interface PostGetMetaBulkResponse {
    results: Record<string, Record<string, unknown>>
    errors: Array<{ post_id: number; code: string; message: string }>
}
export async function postGetMetaBulk(
    siteUrl: string,
    args: PostGetMetaBulkArgs,
): Promise<ShimRpcResponse<PostGetMetaBulkResponse>> {
    return shimRpc<PostGetMetaBulkResponse>(siteUrl, 'post.get_meta_bulk', { ...args })
}

export interface MetaUpdateEntry {
    post_id: number
    key: string
    value: unknown
}
export interface MetaUpdateArgs {
    updates: MetaUpdateEntry[]
}
export interface MetaUpdateResponse {
    applied: number
    errors: Array<{ post_id: number; key: string; code: string; message: string }>
}
export async function metaUpdate(
    siteUrl: string,
    args: MetaUpdateArgs,
): Promise<ShimRpcResponse<MetaUpdateResponse>> {
    return shimRpc<MetaUpdateResponse>(siteUrl, 'meta.update', { ...args })
}

export interface MetaDeleteArgs {
    post_id: number
    key: string
}
export interface MetaDeleteResponse {
    ok: true
    deleted: boolean
}
export async function metaDelete(
    siteUrl: string,
    args: MetaDeleteArgs,
): Promise<ShimRpcResponse<MetaDeleteResponse>> {
    return shimRpc<MetaDeleteResponse>(siteUrl, 'meta.delete', { ...args })
}

// ─── option.* ──────────────────────────────────────────────────────────────

export interface OptionGetArgs {
    name: string
}
export interface OptionGetResponse {
    value: unknown
    exists: boolean
}
export async function optionGet(
    siteUrl: string,
    args: OptionGetArgs,
): Promise<ShimRpcResponse<OptionGetResponse>> {
    return shimRpc<OptionGetResponse>(siteUrl, 'option.get', { ...args })
}

export interface OptionUpdateArgs {
    name: string
    value: unknown
    autoload?: boolean
}
export interface OptionUpdateResponse {
    ok: true
    changed: boolean
}
export async function optionUpdate(
    siteUrl: string,
    args: OptionUpdateArgs,
): Promise<ShimRpcResponse<OptionUpdateResponse>> {
    assertOptionWriteAllowed(args.name)
    return shimRpc<OptionUpdateResponse>(siteUrl, 'option.update', { ...args })
}

export interface OptionDeleteArgs {
    name: string
}
export interface OptionDeleteResponse {
    ok: true
    deleted: boolean
}
export async function optionDelete(
    siteUrl: string,
    args: OptionDeleteArgs,
): Promise<ShimRpcResponse<OptionDeleteResponse>> {
    assertOptionWriteAllowed(args.name)
    return shimRpc<OptionDeleteResponse>(siteUrl, 'option.delete', { ...args })
}

export interface OptionListByPrefixArgs {
    prefix: string
    limit?: number
}
export interface OptionListByPrefixResponse {
    options: Array<{ name: string; value: string }>
    count: number
}
export async function optionListByPrefix(
    siteUrl: string,
    args: OptionListByPrefixArgs,
): Promise<ShimRpcResponse<OptionListByPrefixResponse>> {
    return shimRpc<OptionListByPrefixResponse>(siteUrl, 'option.list_by_prefix', { ...args })
}

// ─── file.* ────────────────────────────────────────────────────────────────

export interface FileReadArgs {
    path: string
}
export interface FileReadResponse {
    content_base64: string
    size: number
    mtime: number
    mime: string
}
export async function fileRead(
    siteUrl: string,
    args: FileReadArgs,
): Promise<ShimRpcResponse<FileReadResponse>> {
    return shimRpc<FileReadResponse>(siteUrl, 'file.read', { ...args })
}

export interface FileExistsArgs {
    path: string
}
export interface FileExistsResponse {
    exists: boolean
    size?: number
    mtime?: number
}
export async function fileExists(
    siteUrl: string,
    args: FileExistsArgs,
): Promise<ShimRpcResponse<FileExistsResponse>> {
    return shimRpc<FileExistsResponse>(siteUrl, 'file.exists', { ...args })
}

export interface FileWriteArgs {
    path: string
    content_base64: string
    mode?: 'overwrite' | 'append'
}
export interface FileWriteResponse {
    ok: true
    bytes_written: number
    mtime: number
}
export async function fileWrite(
    siteUrl: string,
    args: FileWriteArgs,
): Promise<ShimRpcResponse<FileWriteResponse>> {
    assertWriteablePath(args.path)
    return shimRpc<FileWriteResponse>(siteUrl, 'file.write', { ...args })
}

export interface FileDeleteArgs {
    path: string
}
export interface FileDeleteResponse {
    ok: true
    deleted: boolean
}
export async function fileDelete(
    siteUrl: string,
    args: FileDeleteArgs,
): Promise<ShimRpcResponse<FileDeleteResponse>> {
    assertWriteablePath(args.path)
    return shimRpc<FileDeleteResponse>(siteUrl, 'file.delete', { ...args })
}

// ─── cron.* ────────────────────────────────────────────────────────────────

export interface CronEvent {
    hook: string
    next_run: number
    args: unknown[]
    schedule: string | null
}
export interface CronListResponse {
    events: CronEvent[]
}
export async function cronList(siteUrl: string): Promise<ShimRpcResponse<CronListResponse>> {
    return shimRpc<CronListResponse>(siteUrl, 'cron.list', {})
}

export interface CronTriggerArgs {
    hook: string
    args?: Array<string | number | boolean | null>
}
export interface CronTriggerResponse {
    ok: true
    scheduled_at: number
    hook: string
    args: unknown[]
}
export async function cronTrigger(
    siteUrl: string,
    args: CronTriggerArgs,
): Promise<ShimRpcResponse<CronTriggerResponse>> {
    return shimRpc<CronTriggerResponse>(siteUrl, 'cron.trigger', { ...args })
}

export interface CronUnscheduleArgs {
    hook: string
}
export interface CronUnscheduleResponse {
    ok: true
    removed_count: number
}
export async function cronUnschedule(
    siteUrl: string,
    args: CronUnscheduleArgs,
): Promise<ShimRpcResponse<CronUnscheduleResponse>> {
    return shimRpc<CronUnscheduleResponse>(siteUrl, 'cron.unschedule', { ...args })
}

// ─── plugin.* ──────────────────────────────────────────────────────────────

export interface PluginEntry {
    file: string
    name: string
    version: string
    active: boolean
}
export interface PluginListResponse {
    plugins: PluginEntry[]
}
export async function pluginList(siteUrl: string): Promise<ShimRpcResponse<PluginListResponse>> {
    return shimRpc<PluginListResponse>(siteUrl, 'plugin.list', {})
}

export interface PluginToggleArgs {
    plugin_file: string
    enable: boolean
}
export interface PluginToggleResponse {
    ok: true
    was_active: boolean
    is_active: boolean
}
export async function pluginToggle(
    siteUrl: string,
    args: PluginToggleArgs,
): Promise<ShimRpcResponse<PluginToggleResponse>> {
    return shimRpc<PluginToggleResponse>(siteUrl, 'plugin.toggle', { ...args })
}

// ─── taxonomy.* ────────────────────────────────────────────────────────────

export interface TaxonomyEntry {
    slug: string
    label: string
    public: boolean
    hierarchical: boolean
    rest_base: string
}
export interface TaxonomyListResponse {
    taxonomies: TaxonomyEntry[]
}
export async function taxonomyList(
    siteUrl: string,
): Promise<ShimRpcResponse<TaxonomyListResponse>> {
    return shimRpc<TaxonomyListResponse>(siteUrl, 'taxonomy.list', {})
}

// ─── events.* ──────────────────────────────────────────────────────────────

export interface EventsLogTailArgs {
    count?: number
}
export interface EventsLogEntry {
    ts: number
    type: string
    payload: unknown
}
export interface EventsLogTailResponse {
    events: EventsLogEntry[]
    total: number
}
export async function eventsLogTail(
    siteUrl: string,
    args: EventsLogTailArgs = {},
): Promise<ShimRpcResponse<EventsLogTailResponse>> {
    return shimRpc<EventsLogTailResponse>(siteUrl, 'events.log_tail', { ...args })
}

// ─── Phase 10 Plan 10-05 — hardened verbs ──────────────────────────────────
// Each wrapper adds defense-in-depth runtime guards that fail fast BEFORE
// shimRpc fires (the PHP side re-validates). Misuse never round-trips.

// query.select named-query whitelist (mirrors verbs-query.php).
// Adding a name here without a matching PHP whitelist entry will surface as
// `unknown_query` at the server — the dashboard guard catches typos locally.
const NAMED_QUERIES = new Set<string>([
    'posts.list_by_meta',
    'posts.list_by_meta_key_prefix',
    'options.list_by_prefix',
    'transients.list_by_prefix',
    'database.list_text_tables',
    'postmeta.list_by_key',
    'posts.list_by_post_type',
])

export interface QuerySelectArgs {
    name: string
    params?: Record<string, string | number | null>
}
export interface QuerySelectResponse<T = Record<string, unknown>> {
    rows: T[]
    count: number
}
export async function querySelect<T = Record<string, unknown>>(
    siteUrl: string,
    args: QuerySelectArgs,
): Promise<ShimRpcResponse<QuerySelectResponse<T>>> {
    if (typeof args.name !== 'string' || args.name === '') {
        throw new TypeError('[wp-shim] query.select: name must be a non-empty string')
    }
    if (args.name !== '__list_queries__' && !NAMED_QUERIES.has(args.name)) {
        throw new TypeError(
            `[wp-shim] query.select: unknown named query "${args.name}" (not in whitelist)`,
        )
    }
    return shimRpc<QuerySelectResponse<T>>(siteUrl, 'query.select', { ...args })
}

// capability.apply — administrator role is locked, manage_options/
// install_plugins/edit_files/etc. cannot be granted.
const PROTECTED_ROLES = new Set<string>(['administrator'])
const ALWAYS_DENIED_CAPS = new Set<string>([
    'manage_options',
    'install_plugins',
    'edit_themes',
    'edit_plugins',
    'edit_files',
    'unfiltered_html',
    'create_users',
])
export interface CapabilityApplyArgs {
    role_slug: string
    add_caps?: string[]
    remove_caps?: string[]
}
export interface CapabilityApplyResponse {
    ok: true
    role: string
    added: string[]
    removed: string[]
    errors: Array<{ cap: string; code: string; message?: string }>
}
export async function capabilityApply(
    siteUrl: string,
    args: CapabilityApplyArgs,
): Promise<ShimRpcResponse<CapabilityApplyResponse>> {
    if (typeof args.role_slug !== 'string' || args.role_slug === '') {
        throw new TypeError('[wp-shim] capability.apply: role_slug required')
    }
    if (PROTECTED_ROLES.has(args.role_slug)) {
        throw new TypeError(
            `[wp-shim] capability.apply: role "${args.role_slug}" is protected — administrator cannot be modified via this verb`,
        )
    }
    if (Array.isArray(args.add_caps)) {
        for (const c of args.add_caps) {
            if (ALWAYS_DENIED_CAPS.has(c)) {
                throw new TypeError(
                    `[wp-shim] capability.apply: cap "${c}" is in ALWAYS_DENIED_CAPS (administrator-only)`,
                )
            }
        }
    }
    return shimRpc<CapabilityApplyResponse>(siteUrl, 'capability.apply', { ...args })
}

// transient.delete_prefix — empty prefix is rejected (would wipe all transients).
export interface TransientDeletePrefixArgs {
    prefix: string
}
export interface TransientDeletePrefixResponse {
    ok: true
    removed_count: number
}
export async function transientDeletePrefix(
    siteUrl: string,
    args: TransientDeletePrefixArgs,
): Promise<ShimRpcResponse<TransientDeletePrefixResponse>> {
    if (typeof args.prefix !== 'string' || args.prefix === '') {
        throw new TypeError(
            '[wp-shim] transient.delete_prefix: empty prefix would delete every transient',
        )
    }
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(args.prefix)) {
        throw new TypeError(
            '[wp-shim] transient.delete_prefix: prefix must match /^[A-Za-z0-9_-]{1,100}$/',
        )
    }
    return shimRpc<TransientDeletePrefixResponse>(siteUrl, 'transient.delete_prefix', { ...args })
}

// database.update_bulk — capped at 200 updates per call.
export interface DatabaseUpdateBulkEntry {
    table: string
    pk_col: string
    pk_val: number
    column: string
    value: string
}
export interface DatabaseUpdateBulkArgs {
    updates: DatabaseUpdateBulkEntry[]
}
export interface DatabaseUpdateBulkResponse {
    applied: number
    errors: Array<{ table?: string; code: string; message?: string }>
}
export async function databaseUpdateBulk(
    siteUrl: string,
    args: DatabaseUpdateBulkArgs,
): Promise<ShimRpcResponse<DatabaseUpdateBulkResponse>> {
    if (!Array.isArray(args.updates)) {
        throw new TypeError('[wp-shim] database.update_bulk: updates must be an array')
    }
    if (args.updates.length > 200) {
        throw new TypeError(
            '[wp-shim] database.update_bulk: updates capped at 200 per call (got ' +
                args.updates.length +
                ')',
        )
    }
    return shimRpc<DatabaseUpdateBulkResponse>(siteUrl, 'database.update_bulk', { ...args })
}

// webhook.set — event must be in allowed list, url must be https:// or null.
const WEBHOOK_ALLOWED_EVENTS = new Set<string>([
    'save_post',
    'publish_post',
    'delete_post',
    'trashed_post',
    'wp_login',
    'wp_logout',
    'shim_health_check_failed',
])
export interface WebhookSetArgs {
    event: string
    url: string | null
}
export interface WebhookSetResponse {
    ok: true
    event: string
    url: string | null
    all_webhooks: Record<string, string>
}
export async function webhookSet(
    siteUrl: string,
    args: WebhookSetArgs,
): Promise<ShimRpcResponse<WebhookSetResponse>> {
    if (!WEBHOOK_ALLOWED_EVENTS.has(args.event)) {
        throw new TypeError(
            `[wp-shim] webhook.set: event "${args.event}" is not in the allowed-events list`,
        )
    }
    if (args.url !== null && (typeof args.url !== 'string' || !args.url.startsWith('https://'))) {
        throw new TypeError('[wp-shim] webhook.set: url must start with https:// (or be null)')
    }
    return shimRpc<WebhookSetResponse>(siteUrl, 'webhook.set', { ...args })
}

// ─── Phase 10 Plan 10-06 — elementor.* host-bound verbs ────────────────────

export interface ElementorSaveArgs {
    post_id: number | 'new'
    elementor_data: Array<unknown> // Elementor element tree — array (NOT a JSON string)
    page_settings?: Record<string, unknown>
    status?: 'draft' | 'publish' | 'private'
    title?: string // required if post_id === 'new'
    slug?: string
    post_type?: 'page' | 'post' | string
    idempotency_key?: string
}
export interface ElementorSaveResponse {
    ok: true
    post_id: number
    url: string
    status: string
    elementor_version: string | null
    css_regenerated: boolean
    idempotent?: boolean
    element_count: number
}
export async function elementorSave(
    siteUrl: string,
    args: ElementorSaveArgs,
): Promise<ShimRpcResponse<ElementorSaveResponse>> {
    if (args.post_id === 'new' && (!args.title || args.title === '')) {
        throw new TypeError('[wp-shim] elementor.save: title is required when post_id === "new"')
    }
    if (!Array.isArray(args.elementor_data)) {
        throw new TypeError(
            '[wp-shim] elementor.save: elementor_data must be an array (not a JSON string)',
        )
    }
    if (args.idempotency_key && !/^[A-Za-z0-9_-]{1,64}$/.test(args.idempotency_key)) {
        throw new TypeError(
            '[wp-shim] elementor.save: idempotency_key must match /^[A-Za-z0-9_-]{1,64}$/',
        )
    }
    return shimRpc<ElementorSaveResponse>(siteUrl, 'elementor.save', { ...args })
}

export interface ElementorCloneArgs {
    source_post_id: number
    title?: string
    slug?: string
    status?: 'draft' | 'publish' | 'private'
    elementor_data?: Array<unknown>
    page_settings?: Record<string, unknown>
    body_html?: string
    post_meta?: Record<string, string>
    meta_prefix_allowlist?: string[] // REQUIRED if post_meta is non-empty
    idempotency_key?: string
}
export interface ElementorCloneResponse {
    ok: true
    post_id: number
    source_id: number
    url: string
    status: string
}
export async function elementorClone(
    siteUrl: string,
    args: ElementorCloneArgs,
): Promise<ShimRpcResponse<ElementorCloneResponse>> {
    if (args.post_meta && Object.keys(args.post_meta).length > 0) {
        if (!args.meta_prefix_allowlist || args.meta_prefix_allowlist.length === 0) {
            throw new TypeError(
                '[wp-shim] elementor.clone: meta_prefix_allowlist is required when post_meta is non-empty',
            )
        }
        const allowed = args.meta_prefix_allowlist
        for (const k of Object.keys(args.post_meta)) {
            if (!allowed.some((p) => k.startsWith(p))) {
                throw new TypeError(
                    `[wp-shim] elementor.clone: meta key "${k}" does not match any allowed prefix`,
                )
            }
        }
    }
    if (args.idempotency_key && !/^[A-Za-z0-9_-]{1,64}$/.test(args.idempotency_key)) {
        throw new TypeError(
            '[wp-shim] elementor.clone: idempotency_key must match /^[A-Za-z0-9_-]{1,64}$/',
        )
    }
    return shimRpc<ElementorCloneResponse>(siteUrl, 'elementor.clone', { ...args })
}

// ─── snippet convenience wrappers (option.get/update under the hood) ──────
// Snippet CRUD goes through option.get/option.update against the
// 'kotoiq_shim_snippets' option — there's no dedicated verb because the
// shim already supports generic option r/w. These wrappers add types.
export interface Snippet {
    id: string
    kind: 'php' | 'html_head' | 'html_footer' | 'js_head' | 'js_footer' | 'css'
    scope: 'frontend' | 'admin' | 'both'
    code: string
    active: boolean
}
const SNIPPETS_OPTION_NAME = 'kotoiq_shim_snippets'
export async function snippetsList(
    siteUrl: string,
): Promise<ShimRpcResponse<OptionGetResponse>> {
    return shimRpc<OptionGetResponse>(siteUrl, 'option.get', { name: SNIPPETS_OPTION_NAME })
}
export async function snippetsSave(
    siteUrl: string,
    snippets: Snippet[],
): Promise<ShimRpcResponse<OptionUpdateResponse>> {
    // Option name is NOT on the deny-list — skip the assertOptionWriteAllowed
    // path to allow the kotoiq_shim_snippets write to flow without a guard.
    return shimRpc<OptionUpdateResponse>(siteUrl, 'option.update', {
        name: SNIPPETS_OPTION_NAME,
        value: snippets,
        autoload: false,
    })
}
