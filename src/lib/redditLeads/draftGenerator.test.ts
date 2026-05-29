import { describe, it, expect, beforeEach, vi } from 'vitest'
import { draftReply, buildDraftPrompt, stripUrls } from './draftGenerator'
import type { RedditThread } from './redditClient'
import type { ClientContext } from './intentScorer'

const ctx: ClientContext = {
  businessName: 'Acme HVAC',
  primaryService: 'AC repair',
  targetCustomer: 'homeowners',
  usp: 'same-day service',
}
const thread: RedditThread = {
  id: 't1',
  subreddit: 'hvacadvice',
  title: 'AC not cooling',
  selftext: 'my unit is broken',
  permalink: 'https://www.reddit.com/r/hvacadvice/t1',
  created_utc: 0,
  num_comments: 0,
  score: 0,
}

function mockClaude(text: string, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('anthropic')) {
      return { ok, status: ok ? 200 : 500, json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 5, output_tokens: 5 } }), text: async () => text }
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
  }) as any)
}

beforeEach(() => { vi.restoreAllMocks() })

describe('stripUrls (defense-in-depth)', () => {
  it('removes http(s) URLs', () => {
    expect(stripUrls('check https://acme.com/repair now')).not.toMatch(/https?:\/\//)
  })
  it('removes www and bare-domain forms', () => {
    expect(stripUrls('see www.acme.com or acme.io/x')).not.toMatch(/acme\.(com|io)/)
  })
  it('leaves normal prose intact', () => {
    expect(stripUrls('Full disclosure, I work at Acme. Here is the fix.')).toContain('Full disclosure')
  })
})

describe('buildDraftPrompt — compliance instructions present', () => {
  const p = buildDraftPrompt(thread, ctx)
  it('instructs FTC disclosure of the material connection', () => {
    expect(p).toMatch(/disclose/i)
    expect(p).toContain('Acme HVAC')
  })
  it('forbids links / URLs / CTAs', () => {
    expect(p).toMatch(/do NOT include any link/i)
  })
})

describe('draftReply', () => {
  it('CRITICAL: the returned draft never contains a URL, even if the model emits one', async () => {
    mockClaude('Full disclosure, I work at Acme HVAC. First check your filter. More at https://acme.com/help and www.acme.io.')
    const r = await draftReply(thread, ctx)
    expect(r.ok).toBe(true)
    expect(r.draft).not.toMatch(/https?:\/\//)
    expect(r.draft).not.toMatch(/www\./)
    expect(r.draft).not.toMatch(/acme\.(com|io)/)
    expect(r.draft).toContain('Full disclosure') // helpful content preserved
  })

  it('returns ok:false when the model returns nothing usable', async () => {
    mockClaude('')
    const r = await draftReply(thread, ctx)
    expect(r.ok).toBe(false)
    expect(r.draft).toBe('')
  })

  it('returns ok:false on a non-OK Claude response (no throw)', async () => {
    mockClaude('whatever', false)
    const r = await draftReply(thread, ctx)
    expect(r.ok).toBe(false)
  })
})
