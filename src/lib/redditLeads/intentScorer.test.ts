import { describe, it, expect, beforeEach, vi } from 'vitest'
import { scoreThreads, buildScorePrompt, type ClientContext } from './intentScorer'
import type { RedditThread } from './redditClient'

const ctx: ClientContext = {
  businessName: 'Acme HVAC',
  primaryService: 'AC repair',
  targetCustomer: 'homeowners',
  usp: 'same-day service',
}

function thread(id: string, over: Partial<RedditThread> = {}): RedditThread {
  return {
    id,
    subreddit: 'hvacadvice',
    title: 'AC not cooling',
    selftext: 'help',
    permalink: `https://www.reddit.com/r/hvacadvice/${id}`,
    created_utc: 0,
    num_comments: 0,
    score: 0,
    ...over,
  }
}

// Claude messages-API response shape. Routes any non-anthropic url (token-usage
// logging) to a harmless OK so the fire-and-forget logger doesn't throw.
function claudeText(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 } }),
    text: async () => text,
  }
}
function mockClaude(text: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('anthropic')) return claudeText(text)
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    }) as any,
  )
}

beforeEach(() => { vi.restoreAllMocks() })

describe('buildScorePrompt', () => {
  it('includes business context and asks for the {"scores":[...]} shape', () => {
    const p = buildScorePrompt([thread('a')], ctx)
    expect(p).toContain('Acme HVAC')
    expect(p).toContain('"scores"')
  })
})

describe('scoreThreads', () => {
  it('maps valid scores back to threads by id', async () => {
    mockClaude(JSON.stringify({ scores: [
      { id: 'a', score: 90, reason: 'asking for a rec' },
      { id: 'b', score: 10, reason: 'just venting' },
    ] }))
    const out = await scoreThreads([thread('a'), thread('b')], ctx)
    expect(out.find((s) => s.id === 'a')!.intent_score).toBe(90)
    expect(out.find((s) => s.id === 'b')!.intent_score).toBe(10)
    expect(out.find((s) => s.id === 'a')!.intent_reason).toBe('asking for a rec')
  })

  it('recovers from fenced/prose-wrapped JSON via parseMasterJson', async () => {
    mockClaude('Here you go:\n```json\n' + JSON.stringify({ scores: [{ id: 'a', score: 55, reason: 'researching' }] }) + '\n```')
    const out = await scoreThreads([thread('a')], ctx)
    expect(out[0].intent_score).toBe(55)
  })

  it('defaults omitted threads to 0 (partial response, not dropped)', async () => {
    mockClaude(JSON.stringify({ scores: [{ id: 'a', score: 70, reason: 'x' }] }))
    const out = await scoreThreads([thread('a'), thread('b')], ctx)
    expect(out).toHaveLength(2)
    expect(out.find((s) => s.id === 'b')!.intent_score).toBe(0)
  })

  it('clamps scores to 0-100 and coerces garbage to 0', async () => {
    mockClaude(JSON.stringify({ scores: [
      { id: 'a', score: 150, reason: 'x' },
      { id: 'b', score: -20, reason: 'x' },
      { id: 'c', score: 'abc', reason: 'x' },
    ] }))
    const out = await scoreThreads([thread('a'), thread('b'), thread('c')], ctx)
    expect(out.find((s) => s.id === 'a')!.intent_score).toBe(100)
    expect(out.find((s) => s.id === 'b')!.intent_score).toBe(0)
    expect(out.find((s) => s.id === 'c')!.intent_score).toBe(0)
  })

  it('returns all-zero (not throw) on malformed JSON', async () => {
    mockClaude('I could not produce JSON for this request.')
    const out = await scoreThreads([thread('a')], ctx)
    expect(out[0].intent_score).toBe(0)
    expect(out[0].intent_reason).toBe('not scored')
  })

  it('returns all-zero on a non-OK Claude response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('anthropic')) return { ok: false, status: 500, json: async () => ({}), text: async () => '' }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    }) as any)
    const out = await scoreThreads([thread('a')], ctx)
    expect(out[0].intent_score).toBe(0)
  })

  it('returns [] for an empty thread list without calling Claude', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as any)
    expect(await scoreThreads([], ctx)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
