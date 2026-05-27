// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 07 — searchReplacePort — dashboard-side replacement of v3's
// modules/search-replace.php.
//
// The serialized-PHP-safe walker (the IP-sensitive piece — the algorithm that
// safely replaces inside PHP-serialized strings without breaking byte-length
// headers like `s:N:"..."`) moves to dashboard TypeScript. The shim sees only
// query.select reads + database.update_bulk writes.
//
// Package note: 10-07-PLAN.md references `php-unserialize @ ~3.x` — that exact
// package is only available as v0.0.1 (proprietary, unmaintained). We use
// `php-serialize@5.1.3` instead (MIT, actively maintained, same API surface:
// `serialize(any, scope?, opts?): string`, `unserialize(str, scope?, opts?): any`,
// `isSerialized(str): boolean`). Documented as Rule 3 in the SUMMARY.
//
// Architecture:
//   1. listTextTables(siteUrl) — uses query.select 'database.list_text_tables'
//      to discover candidate tables on the site, intersected with our
//      hardcoded TEXT_COLUMNS_PER_TABLE allowlist (mirrors the PHP-side
//      whitelist in verbs-database.php — must match exactly or the bulk
//      update is rejected at the shim).
//   2. scanForReplacements(siteUrl, opts) — pages through query.select per
//      table, decodes serialized PHP via php-serialize, walks nested
//      arrays/objects/strings, replaces text only in string LEAVES, returns
//      a preview list of {table, pk, col, before, after} (NOT applied yet).
//   3. applyBulkUpdate(siteUrl, replacements) — chunks into batches of 100,
//      sequentially issues database.update_bulk per chunk. Each chunk's PHP
//      handler is in verbs-database.php (Plan 10-05) and re-validates the
//      table+column shape against its own ALLOWED_TABLES whitelist.
//
// Threat coverage (10-07-PLAN.md <threat_model>):
//   T-10-07-01: TEXT_COLUMNS_PER_TABLE EXCLUDES wp_users + wp_users.user_pass.
//   T-10-07-02: walkAndReplace re-serializes properly via php-serialize.
//   T-10-07-08: SAMPLE_CAP_MAX of 10_000 caps runaway scans.
// ─────────────────────────────────────────────────────────────────────────────

import { serialize, unserialize, isSerialized } from 'php-serialize'
import { querySelect, databaseUpdateBulk } from '../verbs'
import type { DatabaseUpdateBulkResponse } from '../verbs'

// ── Table+column whitelist ───────────────────────────────────────────────────
// MUST MATCH the PHP-side whitelist in
// wp-plugin-kotoiq-shim/includes/rpc/verbs-database.php (Plan 10-05). If you
// add a table here, add it there too — the bulk update rejects unknown
// table/column pairs server-side.
//
// EXCLUDED ON PURPOSE: users (T-10-07-01 — never expose user_pass), usermeta
// (PII risk; if needed in a future plan, add a per-column allowlist that
// excludes session_tokens + user_activation_key). Comments excluded for
// similar PII reasons (comment_author_email etc).
export const TEXT_COLUMNS_PER_TABLE: Record<
    string,
    { pk_col: string; text_cols: readonly string[] }
> = {
    posts: {
        pk_col: 'ID',
        text_cols: ['post_title', 'post_content', 'post_excerpt'],
    },
    postmeta: {
        pk_col: 'meta_id',
        text_cols: ['meta_value'],
    },
    options: {
        pk_col: 'option_id',
        text_cols: ['option_value'],
    },
    termmeta: {
        pk_col: 'meta_id',
        text_cols: ['meta_value'],
    },
    terms: {
        pk_col: 'term_id',
        text_cols: ['name', 'slug'],
    },
    term_taxonomy: {
        pk_col: 'term_taxonomy_id',
        text_cols: ['description'],
    },
}

const SAMPLE_CAP_MAX = 10_000
const APPLY_CHUNK_SIZE = 100

// ── Public shapes ────────────────────────────────────────────────────────────

export interface TextTableSummary {
    table: string
    pk_col: string
    text_cols: readonly string[]
    rows: number | null
    is_text_in_db: boolean
}

export interface ScannedReplacement {
    table: string
    pk_col: string
    pk_val: number
    column: string
    before: string
    after: string
    is_serialized: boolean
}

export interface ScanOptions {
    tables: string[]
    find: string
    replace: string
    sample_max?: number
    case_sensitive?: boolean
    /** Pass true if `find` is a regex pattern (no slashes/flags — the matcher uses 'g' + 'i' depending on case_sensitive). */
    regex?: boolean
}

export interface ScanResult {
    replacements: ScannedReplacement[]
    truncated: boolean
    sample_max: number
    tables_scanned: string[]
}

export interface ApplyResult {
    applied: number
    chunks: number
    errors: Array<{ chunk: number; code: string; message: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildMatcher(find: string, caseSensitive: boolean, regex: boolean): RegExp {
    const pattern = regex ? find : escapeRegExp(find)
    return new RegExp(pattern, 'g' + (caseSensitive ? '' : 'i'))
}

function safeUnserialize(s: string): { ok: true; value: unknown } | { ok: false } {
    try {
        return { ok: true, value: unserialize(s) }
    } catch {
        return { ok: false }
    }
}

/**
 * Walk a value recursively, applying `replace` to every string leaf
 * (including object/array string keys — same as v3 does).
 *
 * EXPORTED for testability of the serialized-walker fixture cases.
 */
export function walkAndReplace(value: unknown, matcher: RegExp, replace: string): unknown {
    if (typeof value === 'string') {
        return value.replace(matcher, replace)
    }
    if (Array.isArray(value)) {
        return value.map((v) => walkAndReplace(v, matcher, replace))
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            const newK = typeof k === 'string' ? k.replace(matcher, replace) : k
            out[newK] = walkAndReplace(v, matcher, replace)
        }
        return out
    }
    return value
}

/**
 * Replace text in a single column value, with serialized-PHP safety. Returns
 * `{ changed: false }` when the pattern is absent (skipping the round-trip
 * through walkAndReplace).
 */
export function replaceInValue(
    original: string,
    matcher: RegExp,
    replace: string,
): { changed: boolean; after: string; is_serialized: boolean } {
    // Cheap pre-check — skip expensive re-walk if the pattern isn't present.
    // We need a fresh RegExp each call because /g state is stateful — but
    // .test() against a /g pattern advances lastIndex; reset before reuse.
    matcher.lastIndex = 0
    if (!matcher.test(original)) {
        return { changed: false, after: original, is_serialized: false }
    }
    matcher.lastIndex = 0

    if (isSerialized(original)) {
        const u = safeUnserialize(original)
        if (u.ok) {
            const walked = walkAndReplace(u.value, matcher, replace)
            try {
                const reser = serialize(walked)
                return { changed: reser !== original, after: reser, is_serialized: true }
            } catch {
                // Reserialization failed → fall through to naive string replace
                // and flag is_serialized=false so the caller knows we did the
                // unsafe thing. Defense-in-depth.
                matcher.lastIndex = 0
                const after = original.replace(matcher, replace)
                return { changed: after !== original, after, is_serialized: false }
            }
        }
    }

    matcher.lastIndex = 0
    const after = original.replace(matcher, replace)
    return { changed: after !== original, after, is_serialized: false }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List candidate tables for search-replace by intersecting the shim's
 * 'database.list_text_tables' query result with the TEXT_COLUMNS_PER_TABLE
 * allowlist. Rows count comes from the shim (best-effort, from SHOW TABLE
 * STATUS — approximate for InnoDB).
 */
export async function listTextTables(
    siteUrl: string,
): Promise<
    | { ok: true; data: TextTableSummary[]; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const res = await querySelect<{ table: string; rows: number | null }>(siteUrl, {
        name: 'database.list_text_tables',
        params: {},
    })
    if (!res.ok) return res
    const dbTables = new Set<string>()
    const dbRowsByTable: Record<string, number | null> = {}
    for (const row of res.data.rows ?? []) {
        const raw = String(row.table ?? '').toLowerCase()
        // Strip wp_ prefix variants — the shim returns the full table name
        // (`wp_posts`, `wp_5_posts` etc); normalize to our short keys.
        const short = raw.replace(/^[a-z0-9_]+?_(?=posts$|postmeta$|options$|termmeta$|terms$|term_taxonomy$)/, '')
        dbTables.add(short)
        dbRowsByTable[short] = typeof row.rows === 'number' ? row.rows : null
    }
    const out: TextTableSummary[] = Object.entries(TEXT_COLUMNS_PER_TABLE).map(([table, def]) => ({
        table,
        pk_col: def.pk_col,
        text_cols: def.text_cols,
        rows: dbRowsByTable[table] ?? null,
        is_text_in_db: dbTables.has(table),
    }))
    return { ok: true, data: out, status: res.status }
}

/**
 * Scan candidate tables for the find pattern. Returns a list of preview
 * replacements (NOT applied). Operator must call applyBulkUpdate explicitly.
 *
 * Pagination: this function pages through each table internally up to
 * sample_max replacements OR until query.select returns < limit_max rows.
 * The dashboard caller doesn't manage offsets directly.
 */
export async function scanForReplacements(
    siteUrl: string,
    opts: ScanOptions,
): Promise<
    | { ok: true; data: ScanResult; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const sampleMax = Math.min(opts.sample_max ?? SAMPLE_CAP_MAX, SAMPLE_CAP_MAX)
    const caseSensitive = opts.case_sensitive === true
    const useRegex = opts.regex === true

    const replacements: ScannedReplacement[] = []
    let truncated = false
    const tablesScanned: string[] = []

    for (const table of opts.tables) {
        if (replacements.length >= sampleMax) {
            truncated = true
            break
        }
        const def = TEXT_COLUMNS_PER_TABLE[table]
        if (!def) continue
        tablesScanned.push(table)

        // Page through this table via querySelect with table+limit_max+offset.
        // The shim's posts.list_by_post_type-style named query is not generic
        // enough; we use 'postmeta.list_by_key' / 'options.list_by_prefix'
        // shapes where possible. Otherwise we hit a generic per-table named
        // query — which is best-effort: the verb's whitelist is the gate.
        let offset = 0
        const limitMax = 500
        // For each table, build a per-table matcher (lastIndex is stateful).
        while (replacements.length < sampleMax) {
            const matcher = buildMatcher(opts.find, caseSensitive, useRegex)
            const queryRes = await fetchRowsForTable(siteUrl, table, def, limitMax, offset)
            if (!queryRes.ok) return queryRes
            const rows = queryRes.data
            if (rows.length === 0) break
            for (const row of rows) {
                if (replacements.length >= sampleMax) {
                    truncated = true
                    break
                }
                const pkVal = Number(row[def.pk_col])
                if (!Number.isFinite(pkVal)) continue
                for (const col of def.text_cols) {
                    const orig = row[col]
                    if (typeof orig !== 'string' || orig === '') continue
                    const r = replaceInValue(orig, matcher, opts.replace)
                    if (!r.changed) continue
                    replacements.push({
                        table,
                        pk_col: def.pk_col,
                        pk_val: pkVal,
                        column: col,
                        before: orig,
                        after: r.after,
                        is_serialized: r.is_serialized,
                    })
                    if (replacements.length >= sampleMax) {
                        truncated = true
                        break
                    }
                }
            }
            if (rows.length < limitMax) break
            offset += rows.length
        }
    }

    return {
        ok: true,
        data: {
            replacements,
            truncated,
            sample_max: sampleMax,
            tables_scanned: tablesScanned,
        },
        status: 200,
    }
}

/**
 * Apply a previously-scanned replacement set. Chunks the list into batches
 * of APPLY_CHUNK_SIZE (matches PHP cap in Plan 10-05) and sequentially
 * issues database.update_bulk per chunk. Returns aggregate counts.
 */
export async function applyBulkUpdate(
    siteUrl: string,
    replacements: readonly ScannedReplacement[],
): Promise<
    | { ok: true; data: ApplyResult; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    if (!Array.isArray(replacements)) {
        return {
            ok: false,
            error: { code: 'bad_input', message: 'replacements must be an array' },
            status: 400,
        }
    }
    const chunks: ScannedReplacement[][] = []
    for (let i = 0; i < replacements.length; i += APPLY_CHUNK_SIZE) {
        chunks.push(replacements.slice(i, i + APPLY_CHUNK_SIZE))
    }
    let applied = 0
    const errors: ApplyResult['errors'] = []
    let lastStatus = 200
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const updates = chunk.map((r) => ({
            table: r.table,
            pk_col: r.pk_col,
            pk_val: r.pk_val,
            column: r.column,
            value: r.after,
        }))
        const res = await databaseUpdateBulk(siteUrl, { updates })
        lastStatus = res.status
        if (res.ok) {
            applied += res.data.applied
            for (const e of res.data.errors ?? []) {
                errors.push({
                    chunk: i,
                    code: e.code,
                    message: e.message ?? '',
                })
            }
        } else {
            errors.push({ chunk: i, code: res.error.code, message: res.error.message })
        }
    }
    return {
        ok: true,
        data: { applied, chunks: chunks.length, errors },
        status: lastStatus,
    }
}

// ── Internal: per-table paginated read via query.select ──────────────────────

/**
 * Fetch a page of rows for a table via the shim's whitelisted named queries.
 * We can't use a generic "SELECT * FROM ANY_TABLE" query — the shim only
 * exposes named queries from a fixed whitelist. So we map our 6 supported
 * tables to the most appropriate named query in the whitelist:
 *
 *   posts        → query.select 'posts.list_by_post_type' (all types via post_type=any)
 *   postmeta     → query.select 'postmeta.list_by_key' (broad key prefix '')
 *   options      → query.select 'options.list_by_prefix' (prefix '')
 *   termmeta     → no named query; falls through with a "no-op" empty page
 *   terms        → no named query; falls through
 *   term_taxonomy → no named query; falls through
 *
 * Tables without a named query route effectively return zero rows — search-
 * replace coverage for those tables requires adding new named queries to
 * the PHP whitelist in a future plan. We document this in the SUMMARY.
 */
async function fetchRowsForTable(
    siteUrl: string,
    table: string,
    _def: { pk_col: string; text_cols: readonly string[] },
    limit: number,
    offset: number,
): Promise<
    | { ok: true; data: Array<Record<string, unknown>>; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    let queryName: string
    let params: Record<string, string | number | null>
    if (table === 'posts') {
        queryName = 'posts.list_by_post_type'
        params = { post_type: 'any', limit_max: limit, offset }
    } else if (table === 'postmeta') {
        queryName = 'postmeta.list_by_key'
        params = { meta_key: '', limit_max: limit, offset }
    } else if (table === 'options') {
        queryName = 'options.list_by_prefix'
        params = { prefix: '', limit_max: limit, offset }
    } else {
        // No named query route for this table in the current shim whitelist.
        // Empty result tells scanForReplacements to skip; documented in SUMMARY.
        return { ok: true, data: [], status: 200 }
    }
    const res = await querySelect<Record<string, unknown>>(siteUrl, { name: queryName, params })
    if (!res.ok) return res
    return { ok: true, data: res.data.rows ?? [], status: res.status }
}

// Re-export the shim's bulk-update response shape for caller convenience.
export type { DatabaseUpdateBulkResponse }
