import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { AeoEngineResponse, RunPromptOptions } from './types'
import { computeCost } from './types'

const MODEL = 'claude-haiku-4-5-20251001'
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
 * Run a prompt against Claude (Haiku 4.5) and return the answer
 * plus any URLs the model surfaced. No web access — measures
 * what Claude says from training alone.
 */
export async function runClaude(
  prompt: string,
  opts: RunPromptOptions = {},
): Promise<AeoEngineResponse> {
  const start = Date.now()
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      engine: 'claude',
      text: '',
      cited_urls: [],
      response_ms: 0,
      cost_usd: 0,
      error: 'ANTHROPIC_API_KEY not set',
    }
  }

  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await withTimeout(
      ai.messages.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT,
        system: 'Answer the user question directly and concretely. If you reference specific companies or sources, include the URL where possible.',
        messages: [{ role: 'user', content: prompt }],
      }),
      TIMEOUT_MS,
      'claude',
    )

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const inputTokens = msg.usage?.input_tokens || 0
    const outputTokens = msg.usage?.output_tokens || 0
    const cost = computeCost('claude', inputTokens, outputTokens)

    void logTokenUsage({
      feature: opts.feature || 'aeo_visibility',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { engine: 'claude', client_id: opts.clientId },
    })

    return {
      engine: 'claude',
      text,
      cited_urls: extractUrlsFromText(text),
      response_ms: Date.now() - start,
      cost_usd: cost,
      tokens: { input: inputTokens, output: outputTokens },
      model: MODEL,
    }
  } catch (e: any) {
    return {
      engine: 'claude',
      text: '',
      cited_urls: [],
      response_ms: Date.now() - start,
      cost_usd: 0,
      error: e?.message || String(e),
    }
  }
}

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
