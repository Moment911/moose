// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 08 — sitemapPort — dashboard-side replacement of v3's
// modules/seo-sitemap.php (499 LOC of XML emission + image/video/FAQ heuristics).
//
// The dashboard now OWNS the sitemap composition algorithm. This module:
//   - Pages through wp/v2/posts + wp/v2/pages via wpFetchJson (Application
//     Password auth) — never via the shim — to read content.
//   - Composes a sitemap index + up to four sub-sitemaps (posts, images,
//     videos, faq) entirely in TypeScript.
//   - Pushes each composed XML file to the paired site via the generic
//     file.write verb, confined to wp-content/uploads/kotoiq/sitemap*.xml
//     (the path guard lives in verbs/index.ts assertWriteablePath).
//
// IP-protection win: the PHP shim source contains ZERO references to
// image regex, YouTube/Vimeo embed parsing, FAQPage schema detection,
// sitemap priority/changefreq heuristics — all of those live in this file.
//
// Per CONTEXT.md D-Sitemap-strategy (USER-LOCKED): WP-core /wp-sitemap.xml
// remains active as fallback when the pushed file is missing or stale. The
// freshness gate + WP-core 302 lives in wp-plugin-kotoiq-shim/includes/
// sitemap-server.php (Task 2).
//
// Per CLAUDE.md memory kotoiq_models: this module is purely rule-based —
// no Claude calls, no logTokenUsage needed.
// ─────────────────────────────────────────────────────────────────────────────

import { wpFetchJson } from '../wpFetch'
import type { WpCredentials } from '../wpFetch'
import { fileWrite } from '../verbs'
import { loadSiteCredentials } from '../credentialsVault'
// Reuse the canonical SitemapUrl shape from src/lib/sitemapCrawler.ts.
// NOTE: sitemapCrawler.ts is a CRAWLER (reads external XML to discover URLs
// for downstream engines like Content Refresh) — it has no XML-composition
// helpers. Plan 10-08's <read_first> guidance was to align to the actual API,
// not import compose* helpers that don't exist. Composition lives here in
// TypeScript instead (mirrors the v3 PHP shape line-for-line in spirit,
// not character-for-character). We import SitemapUrl as the canonical
// type definition to keep the dashboard's two sitemap modules type-aligned.
import type { SitemapUrl } from '../../sitemapCrawler'

// ── Canonical paths under wp-content/ ────────────────────────────────────────
// The shim's file.write verb confines all writes to wp-content/uploads/kotoiq/**
// (see src/lib/wp-shim/verbs/index.ts assertWriteablePath). The plugin's
// sitemap-server.php knows to serve files from this same directory.
export const SITEMAP_PATHS = {
    index: 'uploads/kotoiq/sitemap.xml',
    posts: 'uploads/kotoiq/sitemap-posts.xml',
    images: 'uploads/kotoiq/sitemap-images.xml',
    videos: 'uploads/kotoiq/sitemap-videos.xml',
    faq: 'uploads/kotoiq/sitemap-faq.xml',
} as const

const MAX_PAGES = 50 // hard cap: 50 pages × 100/page = 5000 posts per type
const PER_PAGE = 100

// ── Types ────────────────────────────────────────────────────────────────────

export interface ComposedSitemap {
    path: string
    xml: string
    entry_count: number
}

// Re-export the canonical SitemapUrl shape so consumers can typecheck
// downstream usage without importing two different crawler/composer modules.
export type { SitemapUrl }

export interface ComposeOptions {
    /** Override the default `['post', 'page']` post-type list. */
    postTypes?: Array<'post' | 'page' | string>
    /** Cap total URLs (per post-type) at this many. Default unlimited (cap = MAX_PAGES * PER_PAGE). */
    maxPosts?: number
    /** Override the canonical site URL used in <loc> entries (defaults to siteUrl arg). */
    canonicalSiteUrl?: string
}

export interface PushResult {
    ok: boolean
    pushed: number
    errors: Array<{ path: string; code: string; message: string }>
}

export interface RefreshResult {
    site_id: string
    site_url: string
    ok: boolean
    files: number
    total_urls: number
    duration_ms: number
    error?: string
}

export interface RefreshAllResult {
    processed: number
    successes: number
    failures: number
    results: RefreshResult[]
    duration_ms: number
}

// ── Internal WP shape (matches /wp/v2/posts default schema) ──────────────────

interface WpPostShape {
    id: number
    slug: string
    link: string
    modified_gmt: string
    title: { rendered: string } | string
    content: { rendered: string } | string
    type: string
    status: string
}

interface ExtractedImage {
    src: string
    alt: string
}

interface ExtractedVideo {
    embed_url: string
    thumbnail: string
}

// ── XML escape helper (mirrors the v3 kiq_esc_xml ENT_XML1 | ENT_QUOTES) ─────

function escapeXml(text: string): string {
    if (!text) return ''
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function unwrapRendered(v: { rendered: string } | string | undefined): string {
    if (!v) return ''
    if (typeof v === 'string') return v
    return v.rendered ?? ''
}

// ── Extraction helpers (ported from v3 kotoiq_extract_images / videos) ───────

function extractImages(html: string, fallbackAlt: string): ExtractedImage[] {
    const found: ExtractedImage[] = []
    const seen = new Set<string>()
    const tagRe = /<img\b[^>]*>/gi
    for (const m of html.matchAll(tagRe)) {
        const tag = m[0]
        const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
        if (!srcMatch) continue
        const src = srcMatch[1].trim()
        if (!src || seen.has(src)) continue
        seen.add(src)
        const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)
        const alt = altMatch ? altMatch[1].trim() : fallbackAlt
        found.push({ src, alt })
    }
    return found
}

function extractVideos(html: string): ExtractedVideo[] {
    const found: ExtractedVideo[] = []
    const seen = new Set<string>()
    // YouTube
    const ytRe = /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]+)/gi
    for (const m of html.matchAll(ytRe)) {
        const id = m[1]
        if (!id || seen.has(`yt:${id}`)) continue
        seen.add(`yt:${id}`)
        found.push({
            embed_url: `https://www.youtube.com/embed/${id}`,
            thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        })
    }
    // Vimeo
    const vmRe = /vimeo\.com\/(?:video\/)?(\d+)/gi
    for (const m of html.matchAll(vmRe)) {
        const id = m[1]
        if (!id || seen.has(`vm:${id}`)) continue
        seen.add(`vm:${id}`)
        found.push({
            embed_url: `https://player.vimeo.com/video/${id}`,
            thumbnail: `https://vumbnail.com/${id}.jpg`,
        })
    }
    return found
}

function hasFaqSchema(html: string): boolean {
    if (!html) return false
    // Multiple signals — JSON-LD FAQPage, microdata, or shortcode marker
    if (/itemtype\s*=\s*["']https?:\/\/schema\.org\/FAQPage["']/i.test(html)) return true
    if (/"@type"\s*:\s*"FAQPage"/i.test(html)) return true
    if (/FAQPage/.test(html)) return true
    if (/kotoiq-faq/i.test(html)) return true
    return false
}

// ── Priority + changefreq heuristics (ported from v3 kotoiq_sitemap_posts) ───

function priorityFor(post: WpPostShape): string {
    if (post.type === 'page') {
        // Homepage hint: slug 'home' or empty path. We don't have page_on_front
        // server-side without an extra request, so use slug heuristic.
        if (post.slug === '' || post.slug === 'home' || post.slug === 'front-page') return '1.0'
        return '0.8'
    }
    return '0.5'
}

function changefreqFor(post: WpPostShape): string {
    return post.type === 'post' ? 'weekly' : 'monthly'
}

// ── Paginated fetch for a post type ──────────────────────────────────────────

async function fetchAllPostsOfType(
    siteUrl: string,
    creds: WpCredentials,
    postType: string,
    maxPosts: number,
): Promise<WpPostShape[]> {
    const collected: WpPostShape[] = []
    // wp/v2/ uses 'posts' for the post type and 'pages' for pages — the REST
    // base differs from the registered post_type slug. Special-case the two
    // builtins; for CPTs, the rest_base is usually the post_type name (which
    // dashboards already deal with via wp/v2/{rest_base}).
    const restBase = postType === 'post' ? 'posts' : postType === 'page' ? 'pages' : postType
    const maxPages = Math.min(MAX_PAGES, Math.ceil(maxPosts / PER_PAGE))
    for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
            per_page: String(PER_PAGE),
            page: String(page),
            status: 'publish',
            orderby: 'modified',
            order: 'desc',
            _fields: 'id,slug,link,modified_gmt,title,content,type,status',
        })
        const path = `/wp/v2/${restBase}?${params.toString()}`
        const res = await wpFetchJson<WpPostShape[]>(siteUrl, path, creds)
        if (!res.ok) {
            // Past the last page WP returns 400 with code rest_post_invalid_page_number.
            // That's our signal to stop, not an error.
            break
        }
        const rows = Array.isArray(res.data) ? res.data : []
        if (rows.length === 0) break
        for (const row of rows) {
            if (collected.length >= maxPosts) return collected
            collected.push(row)
        }
        if (rows.length < PER_PAGE) break // last page
    }
    return collected
}

// ── XML builders ─────────────────────────────────────────────────────────────

function buildIndexXml(siteUrl: string, present: Array<'posts' | 'images' | 'videos' | 'faq'>): string {
    const base = siteUrl.replace(/\/$/, '')
    const now = new Date().toISOString()
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
    out += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for (const slug of present) {
        out += '  <sitemap>\n'
        out += `    <loc>${escapeXml(`${base}/kotoiq-sitemap-${slug}.xml`)}</loc>\n`
        out += `    <lastmod>${now}</lastmod>\n`
        out += '  </sitemap>\n'
    }
    out += '</sitemapindex>\n'
    return out
}

function buildPostsUrlset(posts: WpPostShape[]): { xml: string; count: number } {
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
    out += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    out += 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    let count = 0
    for (const p of posts) {
        const link = p.link?.trim()
        if (!link) continue
        const modified = (p.modified_gmt ? `${p.modified_gmt}Z` : new Date().toISOString()).replace(
            /ZZ$/,
            'Z',
        )
        out += '  <url>\n'
        out += `    <loc>${escapeXml(link)}</loc>\n`
        out += `    <lastmod>${escapeXml(modified)}</lastmod>\n`
        out += `    <changefreq>${changefreqFor(p)}</changefreq>\n`
        out += `    <priority>${priorityFor(p)}</priority>\n`
        const html = unwrapRendered(p.content)
        const images = extractImages(html, unwrapRendered(p.title))
        for (const img of images) {
            out += '    <image:image>\n'
            out += `      <image:loc>${escapeXml(img.src)}</image:loc>\n`
            if (img.alt) out += `      <image:title>${escapeXml(img.alt)}</image:title>\n`
            out += '    </image:image>\n'
        }
        out += '  </url>\n'
        count++
    }
    out += '</urlset>\n'
    return { xml: out, count }
}

function buildImagesUrlset(posts: WpPostShape[]): { xml: string; count: number } {
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
    out += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    out += 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    let count = 0
    for (const p of posts) {
        const html = unwrapRendered(p.content)
        const images = extractImages(html, unwrapRendered(p.title))
        if (images.length === 0) continue
        const link = p.link?.trim()
        if (!link) continue
        out += '  <url>\n'
        out += `    <loc>${escapeXml(link)}</loc>\n`
        for (const img of images) {
            out += '    <image:image>\n'
            out += `      <image:loc>${escapeXml(img.src)}</image:loc>\n`
            if (img.alt) out += `      <image:title>${escapeXml(img.alt)}</image:title>\n`
            out += '    </image:image>\n'
            count++
        }
        out += '  </url>\n'
    }
    out += '</urlset>\n'
    return { xml: out, count }
}

function buildVideosUrlset(posts: WpPostShape[]): { xml: string; count: number } {
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
    out += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    out += 'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'
    let count = 0
    for (const p of posts) {
        const html = unwrapRendered(p.content)
        const videos = extractVideos(html)
        if (videos.length === 0) continue
        const link = p.link?.trim()
        if (!link) continue
        out += '  <url>\n'
        out += `    <loc>${escapeXml(link)}</loc>\n`
        const title = unwrapRendered(p.title)
        const desc = html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 280)
        for (const v of videos) {
            out += '    <video:video>\n'
            out += `      <video:thumbnail_loc>${escapeXml(v.thumbnail)}</video:thumbnail_loc>\n`
            out += `      <video:title>${escapeXml(title)}</video:title>\n`
            if (desc) out += `      <video:description>${escapeXml(desc)}</video:description>\n`
            out += `      <video:player_loc>${escapeXml(v.embed_url)}</video:player_loc>\n`
            out += '    </video:video>\n'
            count++
        }
        out += '  </url>\n'
    }
    out += '</urlset>\n'
    return { xml: out, count }
}

function buildFaqUrlset(posts: WpPostShape[]): { xml: string; count: number } {
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
    out += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    let count = 0
    for (const p of posts) {
        const html = unwrapRendered(p.content)
        if (!hasFaqSchema(html)) continue
        const link = p.link?.trim()
        if (!link) continue
        const modified = p.modified_gmt ? `${p.modified_gmt}Z` : new Date().toISOString()
        out += '  <url>\n'
        out += `    <loc>${escapeXml(link)}</loc>\n`
        out += `    <lastmod>${escapeXml(modified)}</lastmod>\n`
        out += '    <changefreq>weekly</changefreq>\n'
        out += '    <priority>0.7</priority>\n'
        out += '  </url>\n'
        count++
    }
    out += '</urlset>\n'
    return { xml: out, count }
}

// ── composeSitemap ───────────────────────────────────────────────────────────

/**
 * Compose the sitemap files for a paired site. Reads posts/pages via WP core
 * REST (Application Password auth), extracts images/videos/FAQ entries,
 * builds 1-5 XML files, and returns them. Does NOT push anywhere — call
 * pushSitemap on the result.
 *
 * Returns an array of {path, xml, entry_count}. The index file is always
 * present when at least one sub-sitemap is non-empty. Sub-sitemaps with
 * zero entries are omitted.
 */
export async function composeSitemap(
    siteUrl: string,
    creds: WpCredentials,
    opts: ComposeOptions = {},
): Promise<ComposedSitemap[]> {
    const postTypes = opts.postTypes ?? ['post', 'page']
    const maxPosts = opts.maxPosts ?? MAX_PAGES * PER_PAGE
    const canonicalSite = opts.canonicalSiteUrl ?? siteUrl

    // Fetch every post type sequentially. v4 fleet is small; parallel WP REST
    // calls against one site sometimes hit shared rate limits — sequential is
    // safer and the cron has a 5-minute window per site (vercel.json maxDuration).
    const allPosts: WpPostShape[] = []
    for (const type of postTypes) {
        const rows = await fetchAllPostsOfType(siteUrl, creds, type, maxPosts)
        for (const r of rows) allPosts.push(r)
    }

    // Build each sub-sitemap; skip the empty ones.
    const result: ComposedSitemap[] = []
    const present: Array<'posts' | 'images' | 'videos' | 'faq'> = []

    const postsBuilt = buildPostsUrlset(allPosts)
    if (postsBuilt.count > 0) {
        result.push({ path: SITEMAP_PATHS.posts, xml: postsBuilt.xml, entry_count: postsBuilt.count })
        present.push('posts')
    }

    const imagesBuilt = buildImagesUrlset(allPosts)
    if (imagesBuilt.count > 0) {
        result.push({ path: SITEMAP_PATHS.images, xml: imagesBuilt.xml, entry_count: imagesBuilt.count })
        present.push('images')
    }

    const videosBuilt = buildVideosUrlset(allPosts)
    if (videosBuilt.count > 0) {
        result.push({ path: SITEMAP_PATHS.videos, xml: videosBuilt.xml, entry_count: videosBuilt.count })
        present.push('videos')
    }

    const faqBuilt = buildFaqUrlset(allPosts)
    if (faqBuilt.count > 0) {
        result.push({ path: SITEMAP_PATHS.faq, xml: faqBuilt.xml, entry_count: faqBuilt.count })
        present.push('faq')
    }

    // Always emit an index when at least one sub-sitemap is present.
    if (present.length > 0) {
        const indexXml = buildIndexXml(canonicalSite, present)
        result.unshift({
            path: SITEMAP_PATHS.index,
            xml: indexXml,
            entry_count: present.length,
        })
    }

    return result
}

// ── pushSitemap ──────────────────────────────────────────────────────────────

/**
 * Push the composed XML files to the paired site via the generic file.write
 * verb. Each write goes to wp-content/uploads/kotoiq/sitemap*.xml. The path
 * guard at verbs/index.ts assertWriteablePath enforces confinement; the
 * sitemap-server.php (Task 2) serves these as static files.
 *
 * Does NOT abort on per-file failure — collects errors and returns aggregate.
 */
export async function pushSitemap(
    siteUrl: string,
    composed: ComposedSitemap[],
): Promise<PushResult> {
    const errors: Array<{ path: string; code: string; message: string }> = []
    let pushed = 0
    for (const c of composed) {
        try {
            const res = await fileWrite(siteUrl, {
                path: c.path,
                content_base64: Buffer.from(c.xml, 'utf8').toString('base64'),
                mode: 'overwrite',
            })
            if (res.ok) {
                pushed++
            } else {
                errors.push({
                    path: c.path,
                    code: res.error?.code ?? 'file_write_failed',
                    message: res.error?.message ?? 'unknown',
                })
            }
        } catch (err) {
            errors.push({
                path: c.path,
                code: 'file_write_threw',
                message: err instanceof Error ? err.message : 'unknown',
            })
        }
    }
    return { ok: errors.length === 0, pushed, errors }
}

// ── refreshSitemap (per-site) ────────────────────────────────────────────────

/**
 * Compose + push for a single site, plus log an audit row to
 * koto_wp_push_history (template_id is null, status='sitemap_refresh').
 *
 * Per Plan 10-08 <action>: no schema migration; reuses koto_wp_push_history
 * as the dashboard-side audit trail. WP-side last-pushed timestamp is not
 * stored separately — the file's filemtime serves as the WP-side staleness
 * source of truth (read by sitemap-server.php).
 */
export interface RefreshSitemapOptions {
    /** When provided, skip the credentialsVault decrypt path — used by tests. */
    credsOverride?: WpCredentials
}

export async function refreshSitemap(
    supabase: any,
    agencyId: string,
    siteId: string,
    opts: RefreshSitemapOptions = {},
): Promise<RefreshResult> {
    const start = Date.now()

    // Load site row to get the URL.
    const { data: siteRow, error: siteErr } = await supabase
        .from('koto_wp_sites')
        .select('id, agency_id, site_url, app_password_username, app_password_encrypted, dashboard_pubkey_fingerprint')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .maybeSingle()

    if (siteErr || !siteRow) {
        return {
            site_id: siteId,
            site_url: '',
            ok: false,
            files: 0,
            total_urls: 0,
            duration_ms: Date.now() - start,
            error: siteErr?.message ?? 'site not found',
        }
    }

    const siteUrl = String(siteRow.site_url)
    const creds: WpCredentials | null = opts.credsOverride
        ? opts.credsOverride
        : await loadSiteCredentials(supabase, agencyId, siteId)

    if (!creds) {
        return {
            site_id: siteId,
            site_url: siteUrl,
            ok: false,
            files: 0,
            total_urls: 0,
            duration_ms: Date.now() - start,
            error: 'site has no paired App Password credentials',
        }
    }

    let composed: ComposedSitemap[] = []
    let pushResult: PushResult = { ok: true, pushed: 0, errors: [] }
    let topError: string | undefined

    try {
        composed = await composeSitemap(siteUrl, creds)
        pushResult = await pushSitemap(siteUrl, composed)
    } catch (err) {
        topError = err instanceof Error ? err.message : 'unknown'
    }

    const totalUrls = composed.reduce((sum, c) => sum + (c.entry_count || 0), 0)
    const ok = pushResult.ok && !topError && composed.length > 0

    // Audit row — template_id is null (this isn't a template push) and the
    // status field encodes the refresh outcome. variable_values doubles as
    // the per-file size/url metadata so downstream UIs can render a summary
    // without a second query.
    try {
        await supabase.from('koto_wp_push_history').insert({
            agency_id: agencyId,
            template_id: null,
            target_site_id: siteId,
            pushed_post_id: null,
            pushed_post_url: null,
            variable_values: {
                kind: 'sitemap_refresh',
                files: composed.map((c) => ({ path: c.path, bytes: c.xml.length, entries: c.entry_count })),
                push_errors: pushResult.errors,
                top_error: topError ?? null,
            },
            rendered_elementor_data: null,
            rendered_seo_meta: null,
            idempotency_key: `sitemap_refresh_${siteId}_${new Date().toISOString().slice(0, 10)}`,
            status: 'sitemap_refresh',
            error_code: ok ? null : 'partial_or_failed',
            error_message: topError ?? (pushResult.errors[0]?.message ?? null),
            pushed_at: new Date().toISOString(),
        })
    } catch {
        // Audit log failure must NOT mask the actual refresh result.
    }

    return {
        site_id: siteId,
        site_url: siteUrl,
        ok,
        files: composed.length,
        total_urls: totalUrls,
        duration_ms: Date.now() - start,
        error: topError ?? (pushResult.errors[0]?.message),
    }
}

// ── refreshAllSites (cron entry point) ───────────────────────────────────────

export interface RefreshAllOptions {
    /** When provided, skip the credentialsVault decrypt path — used by tests. */
    credsOverride?: WpCredentials
}

/**
 * Walk every paired v4 site that's in 'active' or 'promoted' dual-run state
 * and refresh its sitemap sequentially. Sequential by design: v4 fleet is
 * small (<30 sites at v1) and parallel WP REST calls against the same
 * agency's sites can trip shared host rate limits. Beyond ~30 sites, the
 * cron should be moved to a queue (Inngest/QStash) — see threat T-10-08-04.
 */
export async function refreshAllSites(
    supabase: any,
    opts: RefreshAllOptions = {},
): Promise<RefreshAllResult> {
    const start = Date.now()

    const { data, error } = await supabase
        .from('koto_wp_sites')
        .select('id, agency_id, site_url')
        .eq('shim_version', 'v4')
        .in('dual_run_state', ['active', 'promoted'])

    if (error) {
        return {
            processed: 0,
            successes: 0,
            failures: 0,
            results: [],
            duration_ms: Date.now() - start,
        }
    }

    const sites: Array<{ id: string; agency_id: string; site_url: string }> = Array.isArray(data)
        ? (data as any[])
        : []

    const results: RefreshResult[] = []
    let successes = 0
    let failures = 0

    for (const site of sites) {
        const r = await refreshSitemap(supabase, site.agency_id, site.id, {
            credsOverride: opts.credsOverride,
        })
        results.push(r)
        if (r.ok) successes++
        else failures++
    }

    return {
        processed: results.length,
        successes,
        failures,
        results,
        duration_ms: Date.now() - start,
    }
}
