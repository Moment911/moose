import 'server-only'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { AeoEngineResponse, CitedUrl, RunPromptOptions } from './types'
import { computeCost } from './types'

const MODEL = 'gemini-2.0-flash'
const TIMEOUT_MS = 25_000
const MAX_OUTPUT = 800

function getKey(): string {
  return process.env.GEMINI_API_KEY
      || process.env.GOOGLE_GEMINI_API_KEY
      || process.env.GOOGLE_GEMINI_KEY
      || ''
}

/**
 * Run a prompt against Google Gemini 2.0 Flash with Google Search
 * grounding enabled. Gemini returns groundingMetadata when it
 * pulls from web sources — we extract those as cited_urls.
 */
export async function runGemini(
  prompt: string,
  opts: RunPromptOptions = {},
): Promise<AeoEngineResponse> {
  const start = Date.now()
  const apiKey = getKey()
  if (!apiKey) {
    return {
      engine: 'gemini',
      text: '',
      cited_urls: [],
      response_ms: 0,
      cost_usd: 0,
      error: 'GEMINI_API_KEY not set',
    }
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT,
        temperature: 0.7,
      },
    }

    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      })
    } finally {
      clearTimeout(t)
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return {
        engine: 'gemini',
        text: '',
        cited_urls: [],
        response_ms: Date.now() - start,
        cost_usd: 0,
        error: `Gemini HTTP ${resp.status}: ${errText.slice(0, 200)}`,
      }
    }

    const data: any = await resp.json()
    const cand = data?.candidates?.[0]
    const text = cand?.content?.parts?.map((p: any) => p.text || '').join('') || ''

    // groundingMetadata.groundingChunks[].web.{uri,title}
    const cited_urls: CitedUrl[] = []
    const chunks = cand?.groundingMetadata?.groundingChunks || []
    chunks.forEach((c: any, i: number) => {
      const w = c?.web
      if (w?.uri) {
        cited_urls.push({ url: w.uri, anchor: w.title, position: i + 1 })
      }
    })

    const inputTokens = data?.usageMetadata?.promptTokenCount || 0
    const outputTokens = data?.usageMetadata?.candidatesTokenCount || 0
    const cost = computeCost('gemini', inputTokens, outputTokens)

    void logTokenUsage({
      feature: opts.feature || 'aeo_visibility',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { engine: 'gemini', client_id: opts.clientId, grounded: cited_urls.length > 0 },
    })

    return {
      engine: 'gemini',
      text,
      cited_urls,
      response_ms: Date.now() - start,
      cost_usd: cost,
      tokens: { input: inputTokens, output: outputTokens },
      model: MODEL,
    }
  } catch (e: any) {
    return {
      engine: 'gemini',
      text: '',
      cited_urls: [],
      response_ms: Date.now() - start,
      cost_usd: 0,
      error: e?.message || String(e),
    }
  }
}
