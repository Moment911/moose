// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 08 — sitemapServe — dashboard-side helper to verify the
// pushed sitemap is being served correctly by the WP shim.
//
// Used by Plan 10-10 (dual-run shadow) + Plan 10-11 (cutover) to assert that
// /kotoiq-sitemap.xml at the paired site returns a fresh XML body (not a
// fallback 302 to /wp-sitemap.xml). No auth required — sitemaps are public.
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchedSitemap {
    ok: boolean
    status: number
    xml?: string
    last_modified?: string
    content_type?: string
    /** True if the response was a 302 to the WP-core fallback. */
    is_fallback_redirect?: boolean
    /** True if the response body looks like XML (starts with <?xml or <sitemap/urlset). */
    looks_like_xml?: boolean
}

/**
 * Fetch the served sitemap from a paired site.
 *
 * Returns a structured result indicating whether the dashboard-pushed XML
 * is being served by the shim (200 + XML body) or whether the freshness
 * gate tripped and the request was redirected to WP-core (/wp-sitemap.xml).
 */
export async function fetchServedSitemap(
    siteUrl: string,
    subPath: '' | 'images' | 'videos' | 'faq' = '',
): Promise<FetchedSitemap> {
    const base = siteUrl.replace(/\/$/, '')
    const name = subPath ? `/kotoiq-sitemap-${subPath}.xml` : '/kotoiq-sitemap.xml'
    const url = `${base}${name}`

    let res: Response
    try {
        res = await fetch(url, {
            method: 'GET',
            redirect: 'manual', // we want to SEE the 302 instead of following it
            signal: AbortSignal.timeout(15_000),
            headers: { 'User-Agent': 'KotoIQ-Dashboard/1.0' },
        })
    } catch (err) {
        return {
            ok: false,
            status: 0,
            looks_like_xml: false,
            is_fallback_redirect: false,
        }
    }

    const status = res.status
    const isRedirect = status >= 300 && status < 400
    const location = res.headers.get('location') ?? ''
    const isFallback = isRedirect && /\/wp-sitemap\.xml/i.test(location)

    if (isRedirect) {
        return {
            ok: false,
            status,
            is_fallback_redirect: isFallback,
            looks_like_xml: false,
        }
    }

    const text = await res.text().catch(() => '')
    const looksLikeXml =
        text.startsWith('<?xml') || /<sitemapindex\b/i.test(text) || /<urlset\b/i.test(text)

    return {
        ok: res.ok && looksLikeXml,
        status,
        xml: text,
        last_modified: res.headers.get('last-modified') ?? undefined,
        content_type: res.headers.get('content-type') ?? undefined,
        is_fallback_redirect: false,
        looks_like_xml: looksLikeXml,
    }
}
