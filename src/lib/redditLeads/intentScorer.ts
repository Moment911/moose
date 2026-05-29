// ─────────────────────────────────────────────────────────────
// Intent scorer — ONE Claude call scores ALL threads in a batch.
//
// Scoring every thread individually would be N calls per feed load (slow +
// real cost in koto_token_usage). Instead we batch: one prompt in, an array
// of {id, score, reason} out. Cost scales with feed loads, not thread count.
//
// The model is asked to return an OBJECT ({"scores":[...]}) not a bare array,
// so parseMasterJson() (which recovers the outermost {...}) works cleanly.
//
//   threads ─┐
//            ├─> buildScorePrompt ─> Claude (1 call) ─> parseMasterJson
//   client ──┘                                              │
//                                          clamp 0-100, map back by id
// ─────────────────────────────────────────────────────────────

import { parseMasterJson } from '@/lib/wp-shim/topicCampaignGenerator'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { RedditThread } from './redditClient'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-5-20250929'

export interface ClientContext {
  businessName: string
  primaryService: string
  targetCustomer: string
  usp: string
}

export interface ScoredThread {
  id: string
  intent_score: number // 0-100
  intent_reason: string
}

const SNIPPET = 400

export function buildScorePrompt(threads: RedditThread[], ctx: ClientContext): string {
  const list = threads
    .map(
      (t, i) =>
        `[${i}] id=${t.id} r/${t.subreddit}\n  title: ${t.title}\n  body: ${(t.selftext || '').slice(0, SNIPPET).replace(/\s+/g, ' ')}`,
    )
    .join('\n\n')
  return `A business wants to find Reddit threads where someone is a potential buyer it could genuinely help.

BUSINESS
  name: ${ctx.businessName}
  service: ${ctx.primaryService}
  ideal customer: ${ctx.targetCustomer}
  what makes it different: ${ctx.usp}

For EACH thread below, rate buyer intent 0-100:
  0-20   = not relevant / not a buyer
  21-50  = problem-aware, early, not asking for a solution
  51-79  = actively researching / comparing options
  80-100 = ready to buy / explicitly asking for a recommendation

THREADS
${list}

Return ONLY valid JSON, no markdown, in exactly this shape:
{"scores":[{"id":"<the id from above>","score":<0-100 integer>,"reason":"<one short sentence>"}]}
Include every thread's id exactly once.`
}

function clampScore(n: any): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

/**
 * Score a batch of threads in one Claude call. Returns one ScoredThread per
 * input thread; threads the model omits default to score 0 (surfaced last, not
 * dropped). Never throws on a bad model response — returns zeros so the feed
 * still loads.
 */
export async function scoreThreads(
  threads: RedditThread[],
  ctx: ClientContext,
  opts: { agencyId?: string | null; clientId?: string } = {},
): Promise<ScoredThread[]> {
  if (!threads.length) return []
  const zero = (): ScoredThread[] =>
    threads.map((t) => ({ id: t.id, intent_score: 0, intent_reason: 'not scored' }))

  let parsed: any = null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.2,
        system:
          'You score Reddit threads for buyer intent. Be skeptical: most threads are not buyers. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: buildScorePrompt(threads, ctx) }],
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) {
      console.warn('[intentScorer] Claude error', res.status)
      return zero()
    }
    const data = await res.json()
    const text = (data.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
    parsed = parseMasterJson(text)
    void logTokenUsage({
      feature: 'reddit_lead_scoring',
      model: MODEL,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      agencyId: opts.agencyId,
      metadata: { client_id: opts.clientId, thread_count: threads.length },
    })
  } catch (e: any) {
    console.warn('[intentScorer] failed:', e?.message)
    return zero()
  }

  const scores: any[] = Array.isArray(parsed?.scores) ? parsed.scores : []
  const byId = new Map<string, any>(scores.map((s) => [String(s.id), s]))
  return threads.map((t) => {
    const s = byId.get(String(t.id))
    return {
      id: t.id,
      intent_score: s ? clampScore(s.score) : 0,
      intent_reason: s?.reason ? String(s.reason).slice(0, 240) : 'not scored',
    }
  })
}
