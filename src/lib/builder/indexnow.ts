import 'server-only'

/**
 * IndexNow + GSC Sitemap Ping (ATTR-05, ATTR-06)
 *
 * Submits newly published URLs to IndexNow and pings Google's sitemap endpoint.
 * Rate-limited: skips if the same URL was submitted within 24 hours.
 *
 * Google Indexing API is EXCLUDED per project rules — only IndexNow + GSC ping.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface IndexNowSubmissionRecord {
  publish_id: string
  engine: 'indexnow' | 'google_sitemap_ping'
  url: string
  status_code: number
  response: string
  submitted_at: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const INDEXNOW_API = 'https://api.indexnow.org/indexnow'
const GOOGLE_PING = 'https://www.google.com/ping'
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── IndexNow ────────────────────────────────────────────────────────────────

/**
 * Submit URLs to IndexNow.
 *
 * @param urls          URLs to submit
 * @param indexnowKey   Site's IndexNow key
 * @param siteHost      Hostname (e.g., "example.com")
 * @param publishId     The publish record ID for FK linking
 * @param lastSubmitted Optional map of url -> last submitted_at ISO string (for rate limiting)
 * @returns Array of submission records ready for kotoiq_indexnow_submissions
 */
export async function submitIndexNow(
  urls: string[],
  indexnowKey: string,
  siteHost: string,
  publishId: string,
  lastSubmitted?: Map<string, string>
): Promise<IndexNowSubmissionRecord[]> {
  // Rate-limit: filter out URLs submitted within 24h
  const eligible = filterByRateLimit(urls, lastSubmitted)
  if (eligible.length === 0) return []

  const submittedAt = new Date().toISOString()
  const payload = {
    host: siteHost,
    key: indexnowKey,
    keyLocation: `https://${siteHost}/${indexnowKey}.txt`,
    urlList: eligible,
  }

  try {
    const res = await fetch(INDEXNOW_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })

    const responseText = await res.text()

    return eligible.map(url => ({
      publish_id: publishId,
      engine: 'indexnow' as const,
      url,
      status_code: res.status,
      response: responseText.slice(0, 2000),
      submitted_at: submittedAt,
    }))
  } catch (err: any) {
    console.error('[indexnow] IndexNow submission error:', err)
    return eligible.map(url => ({
      publish_id: publishId,
      engine: 'indexnow' as const,
      url,
      status_code: 0,
      response: err?.message ?? 'Network error',
      submitted_at: submittedAt,
    }))
  }
}

// ── Google Sitemap Ping ─────────────────────────────────────────────────────

/**
 * Ping Google with a sitemap URL.
 *
 * @param siteUrl    The site base URL (e.g., "https://example.com")
 * @param publishId  The publish record ID for FK linking
 * @param lastSubmitted Optional map of url -> last submitted_at ISO string
 * @returns A submission record ready for kotoiq_indexnow_submissions
 */
export async function pingGSCSitemap(
  siteUrl: string,
  publishId: string,
  lastSubmitted?: Map<string, string>
): Promise<IndexNowSubmissionRecord | null> {
  const sitemapUrl = `${siteUrl.replace(/\/$/, '')}/sitemap.xml`

  // Rate-limit check
  const eligible = filterByRateLimit([sitemapUrl], lastSubmitted)
  if (eligible.length === 0) return null

  const submittedAt = new Date().toISOString()
  const pingUrl = `${GOOGLE_PING}?sitemap=${encodeURIComponent(sitemapUrl)}`

  try {
    const res = await fetch(pingUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })

    const responseText = await res.text()

    return {
      publish_id: publishId,
      engine: 'google_sitemap_ping',
      url: sitemapUrl,
      status_code: res.status,
      response: responseText.slice(0, 2000),
      submitted_at: submittedAt,
    }
  } catch (err: any) {
    console.error('[indexnow] GSC sitemap ping error:', err)
    return {
      publish_id: publishId,
      engine: 'google_sitemap_ping',
      url: sitemapUrl,
      status_code: 0,
      response: err?.message ?? 'Network error',
      submitted_at: submittedAt,
    }
  }
}

// ── Rate limiting helper ────────────────────────────────────────────────────

function filterByRateLimit(
  urls: string[],
  lastSubmitted?: Map<string, string>
): string[] {
  if (!lastSubmitted || lastSubmitted.size === 0) return urls

  const now = Date.now()
  return urls.filter(url => {
    const last = lastSubmitted.get(url)
    if (!last) return true
    return now - new Date(last).getTime() > RATE_LIMIT_MS
  })
}
