import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mutable scenario the supabase + lib mocks read from ──────────────
const scenario: any = {}

// ── Mock the Reddit + Claude libs (the route is the unit under test) ──
vi.mock('@/lib/redditLeads/redditClient', async () => {
  const actual = await vi.importActual<any>('@/lib/redditLeads/redditClient')
  return {
    ...actual, // keep RedditRateLimitError class for instanceof
    searchReddit: vi.fn(async () => scenario.threads ?? []),
  }
})
vi.mock('@/lib/redditLeads/intentScorer', () => ({
  scoreThreads: vi.fn(async (threads: any[]) =>
    threads.map((t) => ({ id: t.id, intent_score: scenario.score ?? 88, intent_reason: 'canned' })),
  ),
}))
vi.mock('@/lib/redditLeads/draftGenerator', () => ({
  draftReply: vi.fn(async () => scenario.draft ?? { draft: 'Full disclosure, I work here. Helpful answer.', ok: true }),
}))

// ── Chainable supabase mock ──────────────────────────────────────────
function makeBuilder(table: string) {
  const b: any = { _table: table, _mode: 'select', _ordered: false }
  b.select = () => b
  b.insert = () => ((b._mode = 'insert'), b)
  b.upsert = (rows: any) => ((b._mode = 'upsert'), (b._rows = rows), b)
  b.update = (vals: any) => ((b._mode = 'update'), (b._vals = vals), b)
  b.eq = () => b
  b.is = () => b
  b.order = () => ((b._ordered = true), b)
  b.limit = () => b
  b.maybeSingle = () => Promise.resolve(resolve(b, 'single'))
  b.then = (res: any, rej: any) => Promise.resolve(resolve(b, 'many')).then(res, rej)
  return b
}
function resolve(b: any, card: 'single' | 'many') {
  const t = b._table
  if (t === 'koto_reddit_config') {
    if (b._mode === 'upsert') return { data: { id: 'cfg1' }, error: null }
    return { data: scenario.config ?? null, error: null }
  }
  if (t === 'clients') return { data: scenario.client ?? null, error: null }
  if (t === 'koto_reddit_leads') {
    if (b._mode === 'upsert') return { error: scenario.upsertError ?? null }
    if (b._mode === 'update') return { error: null }
    if (card === 'single') return { data: scenario.lead ?? null, error: null }
    if (b._ordered) return { data: scenario.leads ?? [], error: null }
    return { data: scenario.existing ?? [], error: null } // existing thread_url check
  }
  return { data: null, error: null }
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => makeBuilder(t) }),
}))

import { POST } from './route'

function req(body: any) {
  return { json: async () => body } as any
}
function thread(id: string, permalink: string) {
  return { id, subreddit: 'hvacadvice', title: 'AC dead', selftext: 'help', permalink, created_utc: 0, num_comments: 0, score: 0 }
}

beforeEach(() => {
  for (const k of Object.keys(scenario)) delete scenario[k]
  vi.clearAllMocks()
})

describe('POST /api/reddit-leads', () => {
  it('refresh_feed: search → score → upsert → ranked return (agency-scoped)', async () => {
    scenario.config = { subreddits: ['hvacadvice'], keywords: ['ac'] }
    scenario.client = { id: 'c1', agency_id: 'a1', name: 'Momenta', primary_service: 'AC repair' }
    scenario.threads = [thread('t1', 'https://reddit.com/t1'), thread('t2', 'https://reddit.com/t2')]
    scenario.existing = [] // nothing stored yet → both are fresh
    scenario.leads = [
      { id: 'L1', intent_score: 88, title: 'AC dead', status: 'new', thread_url: 'https://reddit.com/t1' },
    ]

    const { searchReddit } = await import('@/lib/redditLeads/redditClient')
    const { scoreThreads } = await import('@/lib/redditLeads/intentScorer')

    const res = await POST(req({ action: 'refresh_feed', agency_id: 'a1', client_id: 'c1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(searchReddit).toHaveBeenCalledOnce()
    expect(scoreThreads).toHaveBeenCalledOnce() // batch, one call
    expect(data.new_count).toBe(2)
    expect(data.leads).toHaveLength(1)
  })

  it('refresh_feed: only scores threads not already stored', async () => {
    scenario.config = { subreddits: ['x'], keywords: ['k'] }
    scenario.client = { id: 'c1', agency_id: 'a1', name: 'Momenta' }
    scenario.threads = [thread('t1', 'https://reddit.com/t1'), thread('t2', 'https://reddit.com/t2')]
    scenario.existing = [{ thread_url: 'https://reddit.com/t1' }] // t1 already known
    scenario.leads = []

    const { scoreThreads } = await import('@/lib/redditLeads/intentScorer')
    const res = await POST(req({ action: 'refresh_feed', agency_id: 'a1', client_id: 'c1' }))
    const data = await res.json()

    expect(data.new_count).toBe(1) // only t2 is fresh
    const scoredArg = (scoreThreads as any).mock.calls[0][0]
    expect(scoredArg).toHaveLength(1)
    expect(scoredArg[0].id).toBe('t2')
  })

  it('refresh_feed: 400 when no config', async () => {
    scenario.config = null
    const res = await POST(req({ action: 'refresh_feed', agency_id: 'a1', client_id: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('refresh_feed: 404 when client missing for this agency', async () => {
    scenario.config = { subreddits: ['x'], keywords: ['k'] }
    scenario.client = null
    const res = await POST(req({ action: 'refresh_feed', agency_id: 'a1', client_id: 'c1' }))
    expect(res.status).toBe(404)
  })

  it('refresh_feed: 429 when Reddit rate limits', async () => {
    scenario.config = { subreddits: ['x'], keywords: ['k'] }
    scenario.client = { id: 'c1', agency_id: 'a1', name: 'M' }
    const { searchReddit, RedditRateLimitError } = await import('@/lib/redditLeads/redditClient')
    ;(searchReddit as any).mockRejectedValueOnce(new RedditRateLimitError())
    const res = await POST(req({ action: 'refresh_feed', agency_id: 'a1', client_id: 'c1' }))
    expect(res.status).toBe(429)
  })

  it('draft: reuses a stored draft without a new Claude call', async () => {
    scenario.lead = { id: 'L1', client_id: 'c1', draft_reply: 'already drafted', status: 'drafted' }
    const { draftReply } = await import('@/lib/redditLeads/draftGenerator')
    const res = await POST(req({ action: 'draft', agency_id: 'a1', id: 'L1' }))
    const data = await res.json()
    expect(data.reused).toBe(true)
    expect(data.draft).toBe('already drafted')
    expect(draftReply).not.toHaveBeenCalled()
  })

  it('draft: generates + stores when no draft exists', async () => {
    scenario.lead = { id: 'L1', client_id: 'c1', draft_reply: null, status: 'new', thread_url: 'https://r/t1', subreddit: 'x', title: 'T' }
    scenario.client = { id: 'c1', agency_id: 'a1', name: 'M' }
    const { draftReply } = await import('@/lib/redditLeads/draftGenerator')
    const res = await POST(req({ action: 'draft', agency_id: 'a1', id: 'L1' }))
    const data = await res.json()
    expect(data.reused).toBe(false)
    expect(draftReply).toHaveBeenCalledOnce()
    expect(data.draft).toContain('Full disclosure')
  })

  it('draft: 404 when lead not found (wrong agency)', async () => {
    scenario.lead = null
    const res = await POST(req({ action: 'draft', agency_id: 'a1', id: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('update_status: rejects an invalid status', async () => {
    const res = await POST(req({ action: 'update_status', agency_id: 'a1', id: 'L1', status: 'spammed' }))
    expect(res.status).toBe(400)
  })

  it('update_status: accepts a valid status', async () => {
    const res = await POST(req({ action: 'update_status', agency_id: 'a1', id: 'L1', status: 'posted' }))
    expect(res.status).toBe(200)
  })

  it('save_config: strips r/ prefixes and trims', async () => {
    const res = await POST(req({ action: 'save_config', agency_id: 'a1', client_id: 'c1', subreddits: ['/r/hvacadvice', ' phoenix '], keywords: [' ac ', ''] }))
    expect(res.status).toBe(200)
  })

  it('unknown action → 400', async () => {
    const res = await POST(req({ action: 'bogus' }))
    expect(res.status).toBe(400)
  })

  it('missing agency_id → 400', async () => {
    const res = await POST(req({ action: 'list', client_id: 'c1' }))
    expect(res.status).toBe(400)
  })
})
