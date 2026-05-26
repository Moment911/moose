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
