import 'server-only'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { AeoEngineResponse, CitedUrl, RunPromptOptions } from './types'
import { computeCost } from './types'

const MODEL = 'sonar'
const TIMEOUT_MS = 30_000
const MAX_OUTPUT = 800
const SEARCH_SURCHARGE_USD = 0.005  // Perplexity sonar adds ~$5/1000 web searches on top of token cost

/**
 * Run a prompt against Perplexity Sonar — the real "AI search"
 * experience, with live web access. Returns the answer plus the
 * search_results (citations) that Sonar exposes per response.
 */
export async function runPerplexity(
  prompt: string,
  opts: RunPromptOptions = {},
): Promise<AeoEngineResponse> {
  const start = Date.now()
  if (!process.env.PERPLEXITY_API_KEY) {
    return {
      engine: 'perplexity',
      text: '',
      cited_urls: [],
      response_ms: 0,
      cost_usd: 0,
      error: 'PERPLEXITY_API_KEY not set',
    }
  }

  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'Answer the user question directly. Cite the most authoritative sources.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: MAX_OUTPUT,
        }),
        signal: ctl.signal,
      })
    } finally {
      clearTimeout(t)
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return {
        engine: 'perplexity',
        text: '',
        cited_urls: [],
        response_ms: Date.now() - start,
        cost_usd: 0,
        error: `Perplexity HTTP ${resp.status}: ${errText.slice(0, 200)}`,
      }
    }

    const data: any = await resp.json()
    const text = data?.choices?.[0]?.message?.content || ''

    // Perplexity returns search_results as an array of { title, url, date }
    const cited_urls: CitedUrl[] = []
    const results = data?.search_results || data?.citations || []
    results.forEach((r: any, i: number) => {
      if (typeof r === 'string') {
        cited_urls.push({ url: r, position: i + 1 })
      } else if (r?.url) {
        cited_urls.push({ url: r.url, anchor: r.title, position: i + 1 })
      }
    })

    const inputTokens = data?.usage?.prompt_tokens || 0
    const outputTokens = data?.usage?.completion_tokens || 0
    const cost = computeCost('perplexity', inputTokens, outputTokens) + SEARCH_SURCHARGE_USD

    void logTokenUsage({
      feature: opts.feature || 'aeo_visibility',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { engine: 'perplexity', client_id: opts.clientId, search_results: cited_urls.length },
    })

    return {
      engine: 'perplexity',
      text,
      cited_urls,
      response_ms: Date.now() - start,
      cost_usd: cost,
      tokens: { input: inputTokens, output: outputTokens },
      model: MODEL,
    }
  } catch (e: any) {
    return {
      engine: 'perplexity',
      text: '',
      cited_urls: [],
      response_ms: Date.now() - start,
      cost_usd: 0,
      error: e?.message || String(e),
    }
  }
}
