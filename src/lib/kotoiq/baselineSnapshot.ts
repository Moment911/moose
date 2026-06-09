import 'server-only'
import { getKotoIQDb } from '@/lib/kotoiqDb'
import { discoverAllUrls } from '@/lib/kotoiq/pageDiscovery'
import { fetchAndExtract, inferPageType, urlDomain, type ExtractedPage } from '@/lib/kotoiq/pageContentExtractor'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 Plan 11-02 (WS2) — day-1 site baseline snapshot.
//
// An IMMUTABLE, insert-only inventory of the client's OWN pages, captured once
// at onboarding. Later scans DIFF a current content_hash against the latest
// baseline row per URL — they never mutate a baseline row.
//
// Reuses the existing engines (NO new crawler):
//   - discoverAllUrls()  — full same-domain sitemap inventory (NOT the 5-page
//     competitor quick-look cap; see pageDiscovery.discoverAllUrls).
//   - fetchAndExtract()  — per-page {h1, meta_title, word_count, content_hash}.
//
// Soft-dependency contract with Plan 11-01 (orchestrateOnboarding + the wp-event
// receiver guard-import these by name — DO NOT rename):
//   - captureBaseline({ agencyId, clientId, siteId, siteUrl })
//   - diffChangedPost({ agencyId, clientId, siteId, siteUrl, postId, event })
//
// Security (T-11-05 SSRF): every fetch is constrained to the client's own paired
// origin (siteUrl's host). discoverAllUrls already filters to same-domain; the
// per-post diff resolves the post URL on the paired origin only.
//
// Persistence: kotoiq_site_baseline is NOT in DIRECT_AGENCY_TABLES, so agency_id
// is passed explicitly on every insert (mirrors pageGapEngine.saveSuggestions).
// The engine ONLY ever INSERTs — never UPDATE/DELETE (T-11-07 immutability).
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_TABLE = 'kotoiq_site_baseline'
const EXTRACT_CONCURRENCY = 4
const INSERT_BATCH = 50

export interface CaptureBaselineOpts {
    agencyId: string
    clientId: string | null
    siteId: string | null
    siteUrl: string
}

export interface DiffChangedPostOpts {
    agencyId: string
    clientId: string | null
    siteId: string | null
    siteUrl: string
    postId: number | null
    event: string
}

/** One immutable baseline row, as inserted into kotoiq_site_baseline. */
export interface BaselineInsertRow {
    agency_id: string
    client_id: string
    site_id: string | null
    url: string
    page_type: string | null
    title: string | null
    h1: string | null
    word_count: number | null
    content_hash: string
    source_url: string
    fetched_at: string
    captured_at: string
}

/** Minimal shape needed to diff against a stored baseline (subset of a row). */
export interface BaselineRecord {
    url: string
    content_hash: string
    captured_at: string
}

export interface DiffResult {
    changed: boolean
    baseline_hash: string | null
    captured_at: string | null
}

export interface CaptureBaselineResult {
    ok: boolean
    captured: number
    discovered: number
    captured_at: string
    detail?: string
}

// ── Pure helpers (no DB / no network — unit-tested directly) ─────────────────

/**
 * Shape one ExtractedPage into an immutable baseline insert row. Pure.
 * Carries source_url + fetched_at per the data-integrity standard.
 */
export function baselineRowFromExtracted(args: {
    agencyId: string
    clientId: string
    siteId: string | null
    extracted: ExtractedPage
    capturedAt: string
}): BaselineInsertRow {
    const { agencyId, clientId, siteId, extracted, capturedAt } = args
    return {
        agency_id: agencyId,
        client_id: clientId,
        site_id: siteId ?? null,
        url: extracted.url,
        page_type: inferPageType(extracted.url),
        title: extracted.meta_title || null,
        h1: extracted.h1 || null,
        word_count: typeof extracted.word_count === 'number' ? extracted.word_count : null,
        content_hash: extracted.content_hash,
        // data-integrity: the page is its own source; stamp when we fetched it.
        source_url: extracted.url,
        fetched_at: new Date().toISOString(),
        captured_at: capturedAt,
    }
}

/**
 * Compare a current content_hash against the LATEST baseline row for a url. Pure.
 * `baselineRows` may contain multiple captures per url (history) — we pick the
 * most recent by captured_at. No baseline for the url ⇒ treated as changed
 * (a new page) with a null baseline_hash.
 */
export function diffAgainstBaseline(args: {
    url: string
    currentHash: string
    baselineRows: BaselineRecord[]
}): DiffResult {
    const { url, currentHash, baselineRows } = args
    const forUrl = baselineRows
        .filter(r => r.url === url)
        .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))
    const latest = forUrl[0]
    if (!latest) {
        return { changed: true, baseline_hash: null, captured_at: null }
    }
    return {
        changed: latest.content_hash !== currentHash,
        baseline_hash: latest.content_hash,
        captured_at: latest.captured_at,
    }
}

// ── Internal: bounded-concurrency extract over a URL list ────────────────────

async function extractAll(urls: string[]): Promise<ExtractedPage[]> {
    const out: ExtractedPage[] = []
    for (let i = 0; i < urls.length; i += EXTRACT_CONCURRENCY) {
        const slice = urls.slice(i, i + EXTRACT_CONCURRENCY)
        const results = await Promise.all(slice.map(u => fetchAndExtract(u).catch(() => null)))
        for (const r of results) {
            // Only keep pages we actually fetched (non-empty hash, no error).
            if (r && !r.error && r.content_hash) out.push(r)
        }
    }
    return out
}

// ── captureBaseline — the WS2 entry called by orchestrateOnboarding ──────────

/**
 * Discover the client's OWN pages, extract each, and INSERT one immutable row
 * per URL into kotoiq_site_baseline. Insert-only — never UPDATE/DELETE.
 * Constrains all fetches to the client's paired origin (SSRF guard).
 * Never throws (the orchestration leg swallows + records the outcome).
 */
export async function captureBaseline(opts: CaptureBaselineOpts): Promise<CaptureBaselineResult> {
    const capturedAt = new Date().toISOString()
    try {
        if (!opts.agencyId || !opts.clientId) {
            return { ok: false, captured: 0, discovered: 0, captured_at: capturedAt, detail: 'missing agency_id or client_id' }
        }

        // 1) Full same-domain inventory (NOT the 5-page competitor cap).
        const { urls, error } = await discoverAllUrls(opts.siteUrl)
        if (error || urls.length === 0) {
            return { ok: false, captured: 0, discovered: 0, captured_at: capturedAt, detail: error || 'no urls discovered' }
        }

        // SSRF guard (T-11-05): keep only URLs on the paired origin's host.
        const ownHost = urlDomain(opts.siteUrl) || opts.siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
        const ownUrls = urls.filter(u => urlDomain(u) === ownHost)

        // 2) Extract each page (bounded concurrency).
        const pages = await extractAll(ownUrls)

        // 3) Shape immutable rows (shared captured_at = one dated snapshot).
        const rows = pages.map(extracted =>
            baselineRowFromExtracted({
                agencyId: opts.agencyId,
                clientId: opts.clientId as string,
                siteId: opts.siteId,
                extracted,
                capturedAt,
            }))

        if (rows.length === 0) {
            return { ok: false, captured: 0, discovered: ownUrls.length, captured_at: capturedAt, detail: 'no pages extracted' }
        }

        // 4) INSERT only (immutable). kotoiq_site_baseline is not in
        //    DIRECT_AGENCY_TABLES, so agency_id is already on every row.
        const db = getKotoIQDb(opts.agencyId)
        let captured = 0
        for (let i = 0; i < rows.length; i += INSERT_BATCH) {
            const batch = rows.slice(i, i + INSERT_BATCH)
            const { error: insErr } = await db.from(BASELINE_TABLE).insert(batch)
            if (!insErr) captured += batch.length
        }

        return { ok: captured > 0, captured, discovered: ownUrls.length, captured_at: capturedAt }
    } catch (e) {
        return {
            ok: false, captured: 0, discovered: 0, captured_at: capturedAt,
            detail: e instanceof Error ? e.message : 'captureBaseline error',
        }
    }
}

// ── diffChangedPost — the live entry called by the wp-event receiver ─────────

/**
 * Resolve the changed post's permalink on the paired origin (WP's `?p={id}`
 * redirects to the canonical permalink — fetchAndExtract follows redirects),
 * staying within the client's own domain (SSRF guard).
 */
function postUrlFor(siteUrl: string, postId: number): string {
    const base = siteUrl.replace(/\/$/, '')
    return `${base}/?p=${postId}`
}

/**
 * For a webhook-reported changed post: re-fetch the post, compute its current
 * content_hash, and diff it against the latest baseline row for that URL.
 * Pure comparison after the fetch — performs NO writes (the baseline stays
 * immutable; ongoing change state is tracked elsewhere). Never throws.
 *
 * Returns the diff plus the resolved URL so callers can log/act on a change.
 */
export async function diffChangedPost(
    opts: DiffChangedPostOpts,
): Promise<DiffResult & { url: string | null }> {
    try {
        if (!opts.clientId || !opts.postId) {
            return { changed: false, baseline_hash: null, captured_at: null, url: null }
        }

        // Resolve + fetch the post on the paired origin only (SSRF guard).
        const url = postUrlFor(opts.siteUrl, opts.postId)
        const ownHost = urlDomain(opts.siteUrl)
        const extracted = await fetchAndExtract(url).catch(() => null)
        if (!extracted || extracted.error || !extracted.content_hash) {
            return { changed: false, baseline_hash: null, captured_at: null, url }
        }
        // Defense in depth: if a redirect left the client's domain, bail.
        const resolvedHost = urlDomain(extracted.url)
        if (ownHost && resolvedHost && resolvedHost !== ownHost) {
            return { changed: false, baseline_hash: null, captured_at: null, url: extracted.url }
        }

        // Load this client's baseline rows for the resolved URL, newest first.
        const db = getKotoIQDb(opts.agencyId)
        const { data } = await db.from(BASELINE_TABLE)
            .select('url, content_hash, captured_at')
            .eq('client_id', opts.clientId)
            .eq('url', extracted.url)
            .order('captured_at', { ascending: false })
            .limit(5)

        const baselineRows: BaselineRecord[] = Array.isArray(data) ? (data as BaselineRecord[]) : []
        const result = diffAgainstBaseline({ url: extracted.url, currentHash: extracted.content_hash, baselineRows })
        return { ...result, url: extracted.url }
    } catch (e) {
        // Never throw to the receiver — a diff error must not 500 the webhook.
        return {
            changed: false, baseline_hash: null, captured_at: null,
            url: null,
        }
    }
}
