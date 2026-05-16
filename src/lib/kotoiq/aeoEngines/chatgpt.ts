import 'server-only'
import OpenAI from 'openai'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { AeoEngineResponse, RunPromptOptions } from './types'
import { computeCost } from './types'

const MODEL = 'gpt-4o-mini'
const TIMEOUT_MS = 25_000
const MAX_OUTPUT = 800

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      v => { clearTimeout(t); resolve(v) },
      e => { clearTimeout(t); reject(e) },
    )
  })
}

/**
 * Run a prompt against ChatGPT (gpt-4o-mini) and return the answer
 * with any URLs the model cited in its response. The model is not
 * given web access — we measure what it says from training alone.
 */
export async function runChatGPT(
  prompt: string,
  opts: RunPromptOptions = {},
): Promise<AeoEngineResponse> {
  const start = Date.now()
  if (!process.env.OPENAI_API_KEY) {
    return {
      engine: 'chatgpt',
      text: '',
      cited_urls: [],
      response_ms: 0,
      cost_usd: 0,
      error: 'OPENAI_API_KEY not set',
    }
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const resp = await withTimeout(
      client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT,
        messages: [
          { role: 'system', content: 'Answer the user question directly and concretely. If you reference specific companies or sources, include the URL where possible.' },
          { role: 'user', content: prompt },
        ],
      }),
      TIMEOUT_MS,
      'chatgpt',
    )

    const text = resp.choices?.[0]?.message?.content || ''
    const inputTokens = resp.usage?.prompt_tokens || 0
    const outputTokens = resp.usage?.completion_tokens || 0
    const cost = computeCost('chatgpt', inputTokens, outputTokens)

    void logTokenUsage({
      feature: opts.feature || 'aeo_visibility',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { engine: 'chatgpt', client_id: opts.clientId },
    })

    return {
      engine: 'chatgpt',
      text,
      cited_urls: extractUrlsFromText(text),
      response_ms: Date.now() - start,
      cost_usd: cost,
      tokens: { input: inputTokens, output: outputTokens },
      model: MODEL,
    }
  } catch (e: any) {
    return {
      engine: 'chatgpt',
      text: '',
      cited_urls: [],
      response_ms: Date.now() - start,
      cost_usd: 0,
      error: e?.message || String(e),
    }
  }
}

// Pull bare URLs out of the response — used when the model doesn't
// return structured citations. The mention parser does deeper work
// downstream; this is a cheap first pass.
function extractUrlsFromText(text: string): { url: string }[] {
  if (!text) return []
  const re = /https?:\/\/[^\s)"'\]]+/g
  const seen = new Set<string>()
  const out: { url: string }[] = []
  for (const m of text.matchAll(re)) {
    const url = m[0].replace(/[.,;:!?]+$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url })
  }
  return out
}
