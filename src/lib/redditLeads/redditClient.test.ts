import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRedditToken,
  searchReddit,
  RedditRateLimitError,
  _resetRedditTokenCache,
} from './redditClient'

// Build a minimal Response-like object for the fetch mock.
function mkRes(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const TOKEN_BODY = { access_token: 'tok_abc', expires_in: 3600 }
function searchBody(children: any[]) {
  return { data: { children } }
}
function child(over: Partial<any> = {}) {
  return {
    data: {
      id: over.id || 't3_1',
      subreddit: over.subreddit || 'hvacadvice',
      title: over.title || 'AC not cooling, who to call?',
      selftext: over.selftext || 'My AC died.',
      permalink: over.permalink ?? '/r/hvacadvice/comments/1/x/',
      ...over,
    },
  }
}

beforeEach(() => {
  _resetRedditTokenCache()
  process.env.REDDIT_CLIENT_ID = 'cid'
  process.env.REDDIT_CLIENT_SECRET = 'csecret'
  process.env.REDDIT_USER_AGENT = 'koto:test:1 (by /u/test)'
  vi.restoreAllMocks()
})

describe('getRedditToken — caching', () => {
  it('throws if credentials are missing', async () => {
    process.env.REDDIT_CLIENT_ID = ''
    await expect(getRedditToken()).rejects.toThrow(/credentials missing/)
  })

  it('fetches a token on cache miss, reuses it on cache hit (no 2nd auth call)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mkRes(200, TOKEN_BODY))
    vi.stubGlobal('fetch', fetchMock)

    const t1 = await getRedditToken()
    const t2 = await getRedditToken()

    expect(t1).toBe('tok_abc')
    expect(t2).toBe('tok_abc')
    expect(fetchMock).toHaveBeenCalledTimes(1) // cache hit on 2nd
    expect(fetchMock.mock.calls[0][0]).toContain('access_token')
  })

  it('sends Basic auth and a descriptive User-Agent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mkRes(200, TOKEN_BODY))
    vi.stubGlobal('fetch', fetchMock)
    await getRedditToken()
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.Authorization).toMatch(/^Basic /)
    expect(headers['User-Agent']).toBe('koto:test:1 (by /u/test)')
  })

  it('forceRefresh bypasses the cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mkRes(200, TOKEN_BODY))
    vi.stubGlobal('fetch', fetchMock)
    await getRedditToken()
    await getRedditToken(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws on a non-OK token response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mkRes(403, { error: 'nope' })))
    await expect(getRedditToken()).rejects.toThrow(/OAuth failed \(403\)/)
  })
})

describe('searchReddit', () => {
  it('returns normalized threads with absolute permalinks (happy path)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('access_token')) return mkRes(200, TOKEN_BODY)
      return mkRes(200, searchBody([child({ id: 't3_1' }), child({ id: 't3_2', permalink: '/r/hvacadvice/comments/2/y/' })]))
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const threads = await searchReddit({ subreddits: ['hvacadvice'], keywords: ['AC not cooling'] })
    expect(threads).toHaveLength(2)
    expect(threads[0].permalink).toBe('https://www.reddit.com/r/hvacadvice/comments/1/x/')
    expect(threads[0].subreddit).toBe('hvacadvice')
  })

  it('refreshes the token and retries once on a 401 from search', async () => {
    let searchCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('access_token')) return mkRes(200, TOKEN_BODY)
      searchCalls++
      if (searchCalls === 1) return mkRes(401, {}) // expired token
      return mkRes(200, searchBody([child()]))
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const threads = await searchReddit({ subreddits: ['hvacadvice'], keywords: ['k'] })
    expect(threads).toHaveLength(1)
    expect(searchCalls).toBe(2) // retried once after refresh
  })

  it('throws RedditRateLimitError on a 429', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('access_token')) return mkRes(200, TOKEN_BODY)
      return mkRes(429, {})
    })
    vi.stubGlobal('fetch', fetchMock as any)
    await expect(searchReddit({ subreddits: ['x'], keywords: ['k'] })).rejects.toBeInstanceOf(RedditRateLimitError)
  })

  it('returns [] when there are no results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('access_token')) return mkRes(200, TOKEN_BODY)
      return mkRes(200, searchBody([]))
    })
    vi.stubGlobal('fetch', fetchMock as any)
    expect(await searchReddit({ subreddits: ['x'], keywords: ['k'] })).toEqual([])
  })

  it('returns [] without any network call when config is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as any)
    expect(await searchReddit({ subreddits: [], keywords: [] })).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dedups identical permalinks across subreddits', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('access_token')) return mkRes(200, TOKEN_BODY)
      return mkRes(200, searchBody([child({ permalink: '/r/x/comments/dup/z/' })]))
    })
    vi.stubGlobal('fetch', fetchMock as any)
    const threads = await searchReddit({ subreddits: ['a', 'b'], keywords: ['k'] })
    expect(threads).toHaveLength(1) // same permalink from both subs collapses
  })
})
