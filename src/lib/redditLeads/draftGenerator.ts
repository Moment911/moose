// ─────────────────────────────────────────────────────────────
// Draft generator — lazy, one Claude call per thread on user click.
//
// Two NON-NEGOTIABLE constraints (asserted in tests):
//   1. FTC: the reply must disclose the material connection (the writer is
//      affiliated with the business). An undisclosed brand recommendation is
//      both an FTC endorsement-rule problem and an instant Reddit-removal
//      signal.
//   2. NO links / URLs / promotional CTAs. Auto-dropping a link is the exact
//      spam signature that gets accounts shadowbanned and domains blacklisted.
//      A human posts manually and adds context themselves.
//
// stripUrls() is a defense-in-depth net: even if the model ignores the
// instruction, we remove URLs before the draft is ever stored/shown.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'
import type { RedditThread } from './redditClient'
import type { ClientContext } from './intentScorer'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-5-20250929'

// Matches http(s):// URLs, www. URLs, and bare domain.tld/path forms.
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|ai|dev|biz)\b\S*/gi

/** Remove any URL/domain the model may have slipped in. Defense in depth. */
export function stripUrls(text: string): string {
  return text.replace(URL_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildDraftPrompt(thread: RedditThread, ctx: ClientContext): string {
  return `Write a genuinely helpful Reddit reply to the thread below, on behalf of someone who works at "${ctx.businessName}".

THREAD (r/${thread.subreddit})
  title: ${thread.title}
  body: ${(thread.selftext || '').slice(0, 800).replace(/\s+/g, ' ')}

BUSINESS CONTEXT (for relevance only)
  service: ${ctx.primaryService}
  what makes it different: ${ctx.usp}

HARD RULES — follow all:
  - Lead with real, specific help that answers their actual question. Be useful first.
  - DISCLOSE the connection naturally and early, e.g. "Full disclosure, I work at ${ctx.businessName}, but..." (FTC requires disclosing the material connection).
  - Do NOT include any link, URL, website, or "DM me / check us out" call to action.
  - No marketing fluff, no hype, no hard sell. Sound like a knowledgeable human, not an ad.
  - 60-120 words. Plain text only.

Return ONLY the reply text.`
}

export interface DraftResult {
  draft: string
  ok: boolean // false if the model returned nothing usable
}

/**
 * Generate a draft reply for one thread. Never throws — returns ok:false on
 * failure so the UI can show a graceful "couldn't draft, try again".
 * Output is always run through stripUrls() before returning.
 */
export async function draftReply(
  thread: RedditThread,
  ctx: ClientContext,
  opts: { agencyId?: string | null; clientId?: string } = {},
): Promise<DraftResult> {
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
        max_tokens: 600,
        temperature: 0.6,
        system:
          'You write helpful, human Reddit replies that disclose affiliation and never include links or promotional CTAs.',
        messages: [{ role: 'user', content: buildDraftPrompt(thread, ctx) }],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      console.warn('[draftGenerator] Claude error', res.status)
      return { draft: '', ok: false }
    }
    const data = await res.json()
    const raw = (data.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()
    void logTokenUsage({
      feature: 'reddit_lead_draft',
      model: MODEL,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      agencyId: opts.agencyId,
      metadata: { client_id: opts.clientId, thread_url: thread.permalink },
    })
    const clean = stripUrls(raw)
    return { draft: clean, ok: clean.length > 0 }
  } catch (e: any) {
    console.warn('[draftGenerator] failed:', e?.message)
    return { draft: '', ok: false }
  }
}
