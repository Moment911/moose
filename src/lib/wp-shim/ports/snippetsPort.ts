// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 07 — snippetsPort — dashboard-side replacement of v3's
// modules/snippets.php (CRUD half only).
//
// What v3 did vs what we do here:
//
//   v3 (modules/snippets.php):
//     • REST routes (snippets/list, snippets/save, snippets/delete,
//       snippets/toggle) — all CRUD on wp_options key wpsc_snippets.
//     • Runtime: PHP file hooks `init`/`admin_init`/`wp_head`/`wp_footer` —
//       loops the option contents + eval()s PHP snippets / echoes HTML/JS/CSS.
//     • Cap gating in PHP (manage_snippets / execute_php_snippets /
//       create_text_snippets).
//
//   v4 (this file + Plan 10-05 runtime/snippets.php):
//     • CRUD lives HERE in TypeScript. The snippet shape, validation rules,
//       and ID generation move dashboard-side.
//     • Runtime is the SAME executor (eval / echo) — moved to Plan 10-05's
//       generic snippet-runtime PHP file, which reads `kotoiq_shim_snippets`
//       option and hooks WP at the same lifecycle points. The plugin source
//       reveals "a generic snippet runner" — but cannot reconstruct what the
//       snippet creator UI looked like, what kinds of snippets ship by
//       default, or any KotoIQ-specific snippet content.
//     • Cap-driven validation moves to accessPort + FEATURE_CAP_MAP — the
//       runtime/access-filter.php enforces; this CRUD layer surfaces friendly
//       errors when the operator tries to save a PHP snippet without
//       execute_php_snippets in the active access policy.
//
// Option storage shape (matches what runtime/snippets.php reads):
//
//   kotoiq_shim_snippets: Snippet[]
//
// where Snippet[] is an array of objects (NOT a map) — preserves v3's
// `array_values($snips)` shape so the runtime loop in PHP works unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { optionGet, optionUpdate } from '../verbs'
import type { OptionUpdateResponse } from '../verbs'
import type { ShimRpcResponse } from '../types'

export const SNIPPETS_OPTION = 'kotoiq_shim_snippets'

/**
 * Snippet kinds — extended from v3's {php, html, js, css} to surface
 * head-vs-footer location intent in the type itself (clearer dashboard UI).
 * Maps to v3's (type, location) two-field shape on disk via the
 * serializeSnippet/deserializeSnippet helpers below.
 */
export type SnippetKind = 'php' | 'html_head' | 'html_footer' | 'js_head' | 'js_footer' | 'css'

export type SnippetScope = 'frontend' | 'admin' | 'both'

export interface Snippet {
    id: string
    name: string
    kind: SnippetKind
    scope: SnippetScope
    code: string
    active: boolean
    created_at: string
    updated_at: string
    read_roles?: string[]
    execute_roles?: string[]
}

// ── v3 disk shape (what runtime/snippets.php loops over) ─────────────────────
// Kept compatible with what PHP runtime expects: top-level keys
// {type, location, code, active, read_roles, execute_roles}.
interface DiskSnippet {
    id: string
    name: string
    type: 'php' | 'html' | 'js' | 'css'
    code: string
    location: 'everywhere' | 'admin' | 'frontend' | 'head' | 'footer'
    active: boolean
    read_roles: string[]
    execute_roles: string[]
    created_at: string
    updated_at: string
}

function generateId(): string {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
        return globalThis.crypto.randomUUID()
    }
    return 'sn_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function deserializeSnippet(d: DiskSnippet): Snippet {
    let kind: SnippetKind
    if (d.type === 'php') kind = 'php'
    else if (d.type === 'css') kind = 'css'
    else if (d.type === 'js') kind = d.location === 'head' ? 'js_head' : 'js_footer'
    else kind = d.location === 'head' ? 'html_head' : 'html_footer'
    const scope: SnippetScope =
        d.location === 'admin' ? 'admin' : d.location === 'frontend' ? 'frontend' : 'both'
    return {
        id: d.id,
        name: d.name ?? '',
        kind,
        scope,
        code: d.code ?? '',
        active: d.active === true,
        created_at: d.created_at ?? '',
        updated_at: d.updated_at ?? '',
        read_roles: d.read_roles ?? [],
        execute_roles: d.execute_roles ?? [],
    }
}

function serializeSnippet(s: Snippet): DiskSnippet {
    let type: DiskSnippet['type']
    let location: DiskSnippet['location']
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
        code: s.code,
        location,
        active: s.active,
        read_roles: s.read_roles ?? [],
        execute_roles: s.execute_roles ?? [],
        created_at: s.created_at,
        updated_at: s.updated_at,
    }
}

function isDiskSnippet(v: unknown): v is DiskSnippet {
    return !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string'
}

/**
 * List all snippets for a site, deserialized into the dashboard-friendly
 * {kind, scope, ...} shape.
 */
export async function listSnippets(
    siteUrl: string,
): Promise<
    | { ok: true; data: Snippet[]; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const res = await optionGet(siteUrl, { name: SNIPPETS_OPTION })
    if (!res.ok) return res
    const raw = res.data?.value
    const list: DiskSnippet[] = Array.isArray(raw) ? (raw.filter(isDiskSnippet) as DiskSnippet[]) : []
    return { ok: true, data: list.map(deserializeSnippet), status: res.status }
}

/**
 * Save or upsert a snippet. ID + timestamps are dashboard-managed. Returns
 * the persisted snippet on success.
 *
 * When `snippet.id` is empty, a new UUID is assigned. When the id already
 * exists, it's updated in place (preserving created_at).
 */
export async function saveSnippet(
    siteUrl: string,
    snippet: Omit<Snippet, 'id' | 'created_at' | 'updated_at'> & {
        id?: string
        created_at?: string
        updated_at?: string
    },
): Promise<
    | { ok: true; data: Snippet; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const listed = await listSnippets(siteUrl)
    if (!listed.ok) return listed
    const now = new Date().toISOString()
    const id = snippet.id && snippet.id !== '' ? snippet.id : generateId()
    const existingIdx = listed.data.findIndex((s) => s.id === id)
    const merged: Snippet = {
        id,
        name: snippet.name,
        kind: snippet.kind,
        scope: snippet.scope,
        code: snippet.code,
        active: snippet.active === true,
        created_at: existingIdx >= 0 ? listed.data[existingIdx].created_at : now,
        updated_at: now,
        read_roles: snippet.read_roles ?? [],
        execute_roles: snippet.execute_roles ?? [],
    }
    const next = [...listed.data]
    if (existingIdx >= 0) next[existingIdx] = merged
    else next.push(merged)
    const diskRows = next.map(serializeSnippet)
    const writeRes = await optionUpdate(siteUrl, {
        name: SNIPPETS_OPTION,
        value: diskRows,
        autoload: true,
    })
    if (!writeRes.ok) return writeRes
    return { ok: true, data: merged, status: writeRes.status }
}

/**
 * Delete a snippet by id. Idempotent — non-existent id is a no-op write.
 */
export async function deleteSnippet(
    siteUrl: string,
    id: string,
): Promise<ShimRpcResponse<OptionUpdateResponse>> {
    const listed = await listSnippets(siteUrl)
    if (!listed.ok) return listed
    const next = listed.data.filter((s) => s.id !== id).map(serializeSnippet)
    return optionUpdate(siteUrl, {
        name: SNIPPETS_OPTION,
        value: next,
        autoload: true,
    })
}

/**
 * Toggle a snippet's active flag without rewriting the whole record.
 * Returns the updated Snippet on success.
 */
export async function toggleSnippet(
    siteUrl: string,
    id: string,
    active: boolean,
): Promise<
    | { ok: true; data: Snippet; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const listed = await listSnippets(siteUrl)
    if (!listed.ok) return listed
    const idx = listed.data.findIndex((s) => s.id === id)
    if (idx === -1) {
        return { ok: false, error: { code: 'snippet_not_found', message: id }, status: 404 }
    }
    const merged: Snippet = {
        ...listed.data[idx],
        active,
        updated_at: new Date().toISOString(),
    }
    const next = [...listed.data]
    next[idx] = merged
    const writeRes = await optionUpdate(siteUrl, {
        name: SNIPPETS_OPTION,
        value: next.map(serializeSnippet),
        autoload: true,
    })
    if (!writeRes.ok) return writeRes
    return { ok: true, data: merged, status: writeRes.status }
}
