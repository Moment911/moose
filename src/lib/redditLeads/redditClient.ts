// ─────────────────────────────────────────────────────────────
// Reddit client — app-only OAuth + subreddit search
//
// Reddit Data API hard requirements (verified 2026-05):
//   - OAuth is mandatory. Unauthenticated = 10 QPM and Reddit blocks
//     unidentified clients. App-only (client_credentials) gives ~60-100 QPM.
//   - The User-Agent header is REQUIRED and must be descriptive
//     (`<platform>:<appid>:<version> (by /u/<username>)`). Reddit
//     aggressively throttles default/missing User-Agents — the #1 way
//     people get silently rate-limited.
//   - Tokens expire (~1h) so we cache + reuse, never re-auth per request.
//
// Raw fetch (no SDK) to match the in-repo Anthropic call pattern and avoid
// a heavyweight, unmaintained dependency for two endpoints.
//
//   getRedditToken() ──cache(55m)──> oauth/access_token (client_credentials)
//   searchReddit()   ──per subreddit──> oauth.reddit.com/r/{sub}/search
//        │
//        ├─ 401 ─> refresh token, retry once
//        └─ 429 ─> throw RedditRateLimitError (caller surfaces it)
// ─────────────────────────────────────────────────────────────

// Env is read lazily inside functions (not module-level consts) so the values
// are current at call time and stubbable in tests.
const creds = () => ({
  id: process.env.REDDIT_CLIENT_ID || '',
  secret: process.env.REDDIT_CLIENT_SECRET || '',
})
// Descriptive UA is mandatory. Override via env to set the real account name.
const userAgent = () => process.env.REDDIT_USER_AGENT || 'koto:reddit-leads:v0 (by /u/koto-bot)'

export interface RedditThread {
  id: string // reddit fullname-ish id (t3_xxx) or base36
  subreddit: string
  title: string
  selftext: string
  permalink: string // absolute https URL — canonical thread_url
  created_utc: number
  num_comments: number
  score: number
}

export class RedditRateLimitError extends Error {
  constructor(msg = 'Reddit rate limited (429)') {
    super(msg)
    this.name = 'RedditRateLimitError'
  }
}

// Module-level token cache. Reddit tokens live ~1h; we clamp to 55m so a
// request never races the expiry boundary. NOT the geoCache 'rankings'
// (24h) bucket — that TTL is wrong for an hourly token.
let _tokenCache: { token: string; expiresAt: number } | null = null

/** Reset the token cache. Test-only seam. */
export function _resetRedditTokenCache(): void {
  _tokenCache = null
}

export async function getRedditToken(forceRefresh = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && _tokenCache && _tokenCache.expiresAt > now) {
    return _tokenCache.token
  }
  const { id, secret } = creds()
  if (!id || !secret) {
    throw new Error('Reddit credentials missing (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)')
  }
  const basic = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent(),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Reddit OAuth failed (${res.status}): ${txt.slice(0, 160)}`)
  }
  const data = await res.json()
  const ttlMs = Math.min((data.expires_in || 3600), 3600) * 1000
  _tokenCache = {
    token: data.access_token,
    expiresAt: now + ttlMs - 60_000, // refresh 60s early
  }
  return _tokenCache.token
}

function normalizeThread(child: any): RedditThread {
  const d = child?.data || {}
  return {
    id: d.id || d.name || '',
    subreddit: d.subreddit || '',
    title: d.title || '',
    selftext: d.selftext || '',
    permalink: d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url || ''),
    created_utc: d.created_utc || 0,
    num_comments: d.num_comments || 0,
    score: d.score || 0,
  }
}

/** One authenticated search request against a single subreddit. */
async function searchOne(
  token: string,
  subreddit: string,
  query: string,
  limit: number,
): Promise<{ status: number; threads: RedditThread[] }> {
  const url =
    `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/search` +
    `?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limit}&type=link`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent(),
    },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 429) return { status: 429, threads: [] }
  if (res.status === 401) return { status: 401, threads: [] }
  if (!res.ok) return { status: res.status, threads: [] }
  const data = await res.json()
  const children = data?.data?.children || []
  return { status: 200, threads: children.map(normalizeThread).filter((t: RedditThread) => t.permalink) }
}

/**
 * Search the configured subreddits for the configured keywords.
 * Keywords are OR-joined into one query per subreddit. Concurrency is
 * capped so a 10-subreddit config doesn't burst the QPM budget.
 *
 * On 401 mid-batch: refresh the token once and retry that subreddit.
 * On 429: throw RedditRateLimitError so the caller surfaces a clear message.
 */
export async function searchReddit(opts: {
  subreddits: string[]
  keywords: string[]
  limitPerSub?: number
  concurrency?: number
}): Promise<RedditThread[]> {
  const { subreddits, keywords } = opts
  const limitPerSub = opts.limitPerSub ?? 10
  const concurrency = opts.concurrency ?? 3
  if (!subreddits.length || !keywords.length) return []

  // Reddit search query: OR the keywords, quoting multi-word phrases.
  const query = keywords.map((k) => (k.includes(' ') ? `"${k}"` : k)).join(' OR ')

  let token = await getRedditToken()
  const out: RedditThread[] = []
  const seen = new Set<string>()

  // Simple bounded-concurrency pool over the subreddit list.
  const queue = [...subreddits]
  async function worker(): Promise<void> {
    while (queue.length) {
      const sub = queue.shift()
      if (!sub) break
      let r = await searchOne(token, sub, query, limitPerSub)
      if (r.status === 401) {
        token = await getRedditToken(true) // refresh + retry once
        r = await searchOne(token, sub, query, limitPerSub)
      }
      if (r.status === 429) throw new RedditRateLimitError()
      for (const t of r.threads) {
        if (!seen.has(t.permalink)) {
          seen.add(t.permalink)
          out.push(t)
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, subreddits.length) }, worker))
  return out
}
