// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 07 — seoPort — dashboard-side replacement of v3's
// modules/seo.php + modules/seo-metabox.php.
//
// The dashboard now OWNS the SEO algorithm. analyzeSEO (src/lib/seoAnalyzer.ts,
// 359 LOC) does all the rule-based scoring locally on Vercel. The shim plugin
// exposes only generic primitives — post.get_meta_bulk (read 7 _kotoiq_* +
// 6 Yoast/RankMath companion keys at once) + meta.update (write them back).
//
// Cross-engine SEO key writes (Yoast / RankMath) happen via dashboard
// composition. The v4 plugin source NEVER mentions Yoast or RankMath plugin
// names — the dashboard composes a single updates[] array spanning the
// KotoIQ-native keys AND the companion keys, and the shim writes whatever
// keys it's told to write (via the generic meta.update verb).
//
// What v3's seo.php did vs what we do here:
//   v3:  POST /wp-json/kotoiq/v1/agency/test
//        → builds a custom payload with active_plugins, theme, GSC, last_sync.
//        → the action of detecting "Yoast or RankMath is active" lives in PHP
//   v4:  shim → health.diagnostics + plugin.list (generic primitives)
//        → "is Yoast active?" decision made dashboard-side from plugin.list
//
//   v3:  POST /wp-json/kotoiq/v1/pages
//        → /wp/v2/posts (core REST) + per-post kotoiq_seo_get_seo_meta call
//   v4:  wpFetchJson + /wp/v2/posts + postGetMetaBulk for the 13 keys
//
//   v3:  POST /wp-json/kotoiq/v1/blog/generate (with embedded sanitization)
//        → uses wp_insert_post + sets KotoIQ + Yoast + RankMath meta in PHP
//   v4:  dashboard creates post via WP core REST (wpFetch POST /wp/v2/posts)
//        → metaUpdate via shim to set 7 _kotoiq_* + 6 companion keys
//
// Per CLAUDE.md memory kotoiq_models: analyzeSEO is rule-based (NO LLM call),
// so NO logTokenUsage is needed here. If we add AI-driven suggestion later,
// gate that on haiku-4-5 and call logTokenUsage with feature='shim_seo_suggest'.
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeSEO } from '../../seoAnalyzer'
import type { SEOAnalysis } from '../../seoAnalyzer'
import { postGetMetaBulk, metaUpdate, querySelect } from '../verbs'
import { wpFetchJson } from '../wpFetch'
import type { WpCredentials } from '../wpFetch'
import type { ShimRpcResponse } from '../types'
import type { MetaUpdateResponse, PostGetMetaBulkResponse, QuerySelectResponse } from '../verbs'

// ── KotoIQ-native SEO meta keys (the canonical 7 — what v3's seo.php wrote) ──
export const KOTOIQ_SEO_META_KEYS = [
    '_kotoiq_title',
    '_kotoiq_description',
    '_kotoiq_focus_keyword',
    '_kotoiq_canonical',
    '_kotoiq_robots',
    '_kotoiq_schema_type',
    '_kotoiq_schema_custom',
] as const

// ── Yoast + RankMath companion keys for cross-engine compat ──────────────────
// v3 wrote these in PHP via update_post_meta(); v4 writes them dashboard-side
// via the generic meta.update verb. The plugin source contains zero references
// to Yoast or RankMath strings — verified by IP-clean grep across plugin.
export const COMPANION_SEO_KEYS = [
    '_yoast_wpseo_title',
    '_yoast_wpseo_metadesc',
    '_yoast_wpseo_focuskw',
    'rank_math_title',
    'rank_math_description',
    'rank_math_focus_keyword',
] as const

export type KotoIqSeoMetaKey = (typeof KOTOIQ_SEO_META_KEYS)[number]
export type CompanionSeoMetaKey = (typeof COMPANION_SEO_KEYS)[number]

/** Merged SEO meta view — KotoIQ values take precedence over companion values. */
export interface SeoMeta {
    _kotoiq_title: string
    _kotoiq_description: string
    _kotoiq_focus_keyword: string
    _kotoiq_canonical: string
    _kotoiq_robots: string
    _kotoiq_schema_type: string
    _kotoiq_schema_custom: string
    // Raw companion values exposed for migration debugging / display only.
    _companion: {
        _yoast_wpseo_title: string
        _yoast_wpseo_metadesc: string
        _yoast_wpseo_focuskw: string
        rank_math_title: string
        rank_math_description: string
        rank_math_focus_keyword: string
    }
}

/** Writable shape — partial; only provided keys are written. */
export interface SeoMetaWrite {
    seo_title?: string
    meta_description?: string
    focus_keyword?: string
    canonical?: string
    robots?: string
    schema_type?: string
    schema_custom?: string
}

function emptyMeta(): SeoMeta {
    return {
        _kotoiq_title: '',
        _kotoiq_description: '',
        _kotoiq_focus_keyword: '',
        _kotoiq_canonical: '',
        _kotoiq_robots: '',
        _kotoiq_schema_type: '',
        _kotoiq_schema_custom: '',
        _companion: {
            _yoast_wpseo_title: '',
            _yoast_wpseo_metadesc: '',
            _yoast_wpseo_focuskw: '',
            rank_math_title: '',
            rank_math_description: '',
            rank_math_focus_keyword: '',
        },
    }
}

function asString(v: unknown): string {
    if (typeof v === 'string') return v
    if (v == null) return ''
    return String(v)
}

/**
 * Read the 7 KotoIQ-native SEO meta keys + 6 companion keys for one post.
 *
 * Fallback chain (v3 kotoiq_seo_get_seo_meta exact logic ported to TS):
 *   _kotoiq_title || _yoast_wpseo_title || rank_math_title
 *   _kotoiq_description || _yoast_wpseo_metadesc || rank_math_description
 *   _kotoiq_focus_keyword || _yoast_wpseo_focuskw || rank_math_focus_keyword
 *
 * The other 4 KotoIQ-native keys (_kotoiq_canonical, _kotoiq_robots,
 * _kotoiq_schema_type, _kotoiq_schema_custom) have no companion equivalent.
 */
export async function readSeoMeta(
    siteUrl: string,
    postId: number,
): Promise<ShimRpcResponse<SeoMeta>> {
    const allKeys: string[] = [...KOTOIQ_SEO_META_KEYS, ...COMPANION_SEO_KEYS]
    const res = await postGetMetaBulk(siteUrl, {
        posts: [{ post_id: postId, keys: allKeys }],
    })
    if (!res.ok) return { ok: false, error: res.error, status: res.status }
    const meta = emptyMeta()
    const rec = res.data?.results?.[String(postId)] ?? {}
    // KotoIQ-native first (these always win when present).
    meta._kotoiq_title = asString(rec._kotoiq_title)
    meta._kotoiq_description = asString(rec._kotoiq_description)
    meta._kotoiq_focus_keyword = asString(rec._kotoiq_focus_keyword)
    meta._kotoiq_canonical = asString(rec._kotoiq_canonical)
    meta._kotoiq_robots = asString(rec._kotoiq_robots)
    meta._kotoiq_schema_type = asString(rec._kotoiq_schema_type)
    meta._kotoiq_schema_custom = asString(rec._kotoiq_schema_custom)
    // Companion raw values.
    meta._companion._yoast_wpseo_title = asString(rec._yoast_wpseo_title)
    meta._companion._yoast_wpseo_metadesc = asString(rec._yoast_wpseo_metadesc)
    meta._companion._yoast_wpseo_focuskw = asString(rec._yoast_wpseo_focuskw)
    meta._companion.rank_math_title = asString(rec.rank_math_title)
    meta._companion.rank_math_description = asString(rec.rank_math_description)
    meta._companion.rank_math_focus_keyword = asString(rec.rank_math_focus_keyword)
    // Fallback chain: if KotoIQ empty, fall back to Yoast then RankMath.
    if (!meta._kotoiq_title) {
        meta._kotoiq_title = meta._companion._yoast_wpseo_title || meta._companion.rank_math_title
    }
    if (!meta._kotoiq_description) {
        meta._kotoiq_description =
            meta._companion._yoast_wpseo_metadesc || meta._companion.rank_math_description
    }
    if (!meta._kotoiq_focus_keyword) {
        meta._kotoiq_focus_keyword =
            meta._companion._yoast_wpseo_focuskw || meta._companion.rank_math_focus_keyword
    }
    return { ok: true, data: meta, status: res.status }
}

/**
 * Write SEO meta — composes a single updates[] array spanning all 7 KotoIQ
 * keys + the 3 cross-engine companion keys (title/desc/focus_kw for both
 * Yoast and RankMath). The remaining 4 KotoIQ-native keys (canonical, robots,
 * schema_type, schema_custom) have no cross-engine companion.
 *
 * v3 wrote these in PHP with `if (defined('WPSEO_VERSION'))` and
 * `if (defined('RANK_MATH_VERSION'))` guards — branching on whether the
 * SEO plugin was active. We don't branch on dashboard side: write the
 * companion keys unconditionally. If neither Yoast nor RankMath is active,
 * the meta sits unused. If one or both are active, they pick it up.
 * The PHP shim source never mentions these plugins.
 */
export async function writeSeoMeta(
    siteUrl: string,
    postId: number,
    meta: SeoMetaWrite,
): Promise<ShimRpcResponse<MetaUpdateResponse>> {
    const updates: Array<{ post_id: number; key: string; value: unknown }> = []
    if (meta.seo_title !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_title', value: meta.seo_title })
        updates.push({ post_id: postId, key: '_yoast_wpseo_title', value: meta.seo_title })
        updates.push({ post_id: postId, key: 'rank_math_title', value: meta.seo_title })
    }
    if (meta.meta_description !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_description', value: meta.meta_description })
        updates.push({
            post_id: postId,
            key: '_yoast_wpseo_metadesc',
            value: meta.meta_description,
        })
        updates.push({
            post_id: postId,
            key: 'rank_math_description',
            value: meta.meta_description,
        })
    }
    if (meta.focus_keyword !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_focus_keyword', value: meta.focus_keyword })
        updates.push({ post_id: postId, key: '_yoast_wpseo_focuskw', value: meta.focus_keyword })
        updates.push({
            post_id: postId,
            key: 'rank_math_focus_keyword',
            value: meta.focus_keyword,
        })
    }
    if (meta.canonical !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_canonical', value: meta.canonical })
    }
    if (meta.robots !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_robots', value: meta.robots })
    }
    if (meta.schema_type !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_schema_type', value: meta.schema_type })
    }
    if (meta.schema_custom !== undefined) {
        updates.push({ post_id: postId, key: '_kotoiq_schema_custom', value: meta.schema_custom })
    }
    return metaUpdate(siteUrl, { updates })
}

// ── SEO scoring ──────────────────────────────────────────────────────────────

export interface SeoScoreResult {
    analysis: SEOAnalysis
    meta: SeoMeta
    post: {
        id: number
        title: string
        slug: string
        content: string
        url: string
        modified: string
    }
}

interface WpPostShape {
    id: number
    title: { rendered: string } | string
    content: { rendered: string } | string
    slug: string
    link: string
    modified: string
}

function unwrapRendered(v: { rendered: string } | string | undefined): string {
    if (!v) return ''
    if (typeof v === 'string') return v
    return v.rendered ?? ''
}

/**
 * Score one post for SEO. Reads the post body via wpFetchJson (core REST,
 * Basic auth Application Password), reads SEO meta via the shim, then runs
 * analyzeSEO locally on Vercel.
 *
 * focusKwOverride lets the caller score against a candidate keyword that
 * isn't yet stored as the post's focus_keyword (the "what would happen if I
 * changed the focus keyword?" UI case).
 */
export async function scoreSeoForPost(
    siteUrl: string,
    creds: WpCredentials,
    postId: number,
    focusKwOverride?: string,
): Promise<
    | { ok: true; data: SeoScoreResult; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    // Fetch the post body via WP core REST.
    const postRes = await wpFetchJson<WpPostShape>(
        siteUrl,
        `/wp/v2/posts/${postId}?_fields=id,title,content,slug,link,modified`,
        creds,
    )
    if (!postRes.ok) {
        return {
            ok: false,
            error: { code: 'post_fetch_failed', message: postRes.error },
            status: postRes.status,
        }
    }
    const post: WpPostShape | null = postRes.data
    if (!post) {
        return {
            ok: false,
            error: { code: 'post_empty', message: 'WP returned empty post body' },
            status: 500,
        }
    }
    // Read SEO meta via the shim.
    const metaRes = await readSeoMeta(siteUrl, postId)
    if (!metaRes.ok) return metaRes
    const meta = metaRes.data
    const title = unwrapRendered(post.title)
    const content = unwrapRendered(post.content)
    const focusKw = focusKwOverride ?? meta._kotoiq_focus_keyword
    const wordCount = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    const analysis = analyzeSEO(
        {
            title,
            url: post.link,
            slug: post.slug,
            content,
            seo_title: meta._kotoiq_title,
            meta_desc: meta._kotoiq_description,
            focus_kw: focusKw,
            word_count: wordCount,
            type: 'post',
        },
        siteUrl,
    )
    return {
        ok: true,
        data: {
            analysis,
            meta,
            post: {
                id: post.id,
                title,
                slug: post.slug,
                content,
                url: post.link,
                modified: post.modified,
            },
        },
        status: 200,
    }
}

// ── Listings ─────────────────────────────────────────────────────────────────

export interface SeoCandidate {
    id: number
    title: string
    slug: string
    url: string
    modified: string
    status: string
}

export interface ListSeoCandidatesOpts {
    perPage?: number
    page?: number
    postType?: string
    status?: 'publish' | 'draft' | 'pending' | 'any'
    search?: string
}

interface WpListItem {
    id: number
    title: { rendered: string } | string
    slug: string
    link: string
    modified: string
    status: string
}

/**
 * List candidate posts for SEO scoring via WP core REST.
 *
 * Wraps wp/v2/posts (or wp/v2/{type}). Returns one page at a time —
 * dashboard caller paginates by incrementing `page`.
 */
export async function listSeoCandidates(
    siteUrl: string,
    creds: WpCredentials,
    opts: ListSeoCandidatesOpts = {},
): Promise<
    | { ok: true; data: { posts: SeoCandidate[]; total: number; totalPages: number }; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const perPage = opts.perPage ?? 50
    const page = opts.page ?? 1
    const postType = opts.postType ?? 'posts'
    const status = opts.status ?? 'publish'
    const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
        status,
        _fields: 'id,title,slug,link,modified,status',
    })
    if (opts.search) params.set('search', opts.search)
    const path = `/wp/v2/${postType}?${params.toString()}`
    const res = await wpFetchJson<WpListItem[]>(siteUrl, path, creds)
    if (!res.ok) {
        return {
            ok: false,
            error: { code: 'list_fetch_failed', message: res.error },
            status: res.status,
        }
    }
    const rows = Array.isArray(res.data) ? res.data : []
    const candidates: SeoCandidate[] = rows.map((p) => ({
        id: p.id,
        title: unwrapRendered(p.title),
        slug: p.slug,
        url: p.link,
        modified: p.modified,
        status: p.status,
    }))
    return {
        ok: true,
        data: { posts: candidates, total: candidates.length, totalPages: 1 },
        status: res.status,
    }
}

/**
 * List posts by post_type via the shim's query.select 'posts.list_by_post_type'.
 *
 * Use this when the operator wants a fast count/listing without paging through
 * core REST — query.select hits the DB directly via a whitelisted named query.
 * Use listSeoCandidates when you need core-REST features (search, filtering by
 * status, _fields shape).
 */
export interface ListSeoForPostTypeOpts {
    limit?: number
    offset?: number
}

export interface SeoPostTypeRow {
    ID: number
    post_title: string
    post_name: string
    post_status: string
    post_modified: string
}

export async function listSeoForPostType(
    siteUrl: string,
    postType: string,
    opts: ListSeoForPostTypeOpts = {},
): Promise<ShimRpcResponse<QuerySelectResponse<SeoPostTypeRow>>> {
    return querySelect<SeoPostTypeRow>(siteUrl, {
        name: 'posts.list_by_post_type',
        params: {
            post_type: postType,
            limit_max: opts.limit ?? 100,
            offset: opts.offset ?? 0,
        },
    })
}

// ── Re-export ────────────────────────────────────────────────────────────────
export type { PostGetMetaBulkResponse }
