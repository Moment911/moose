import 'server-only'
import { getSERPResults } from '@/lib/dataforseo'
import type { AeoEngineResponse, CitedUrl, RunPromptOptions } from './types'

// DataForSEO Google SERP advanced endpoint with AI Overview parsing
// already wired in `getSERPResults`. We pass the prompt as the keyword
// and pull out the ai_overview.text + sources.

const COST_USD_PER_CALL = 0.005   // DataForSEO Google organic advanced ~ $0.005/serp

/**
 * Run a prompt against Google AI Overviews via DataForSEO. Returns
 * the AI Overview text and source URLs as they appear on the real
 * Google SERP. If no AI Overview is present for the query, returns
 * empty text with `client_position` indicating absence.
 */
export async function runGoogleAIO(
  prompt: string,
  opts: RunPromptOptions = {},
): Promise<AeoEngineResponse> {
  const start = Date.now()

  if (!process.env.DATAFORSEO_AUTH) {
    return {
      engine: 'google_aio',
      text: '',
      cited_urls: [],
      response_ms: 0,
      cost_usd: 0,
      error: 'DATAFORSEO_AUTH not set',
    }
  }

  try {
    const serp = await getSERPResults(prompt)
    const aio = serp.ai_overview

    if (!aio || !aio.present) {
      // No AI Overview shown for this query — record absence, no cost saved
      return {
        engine: 'google_aio',
        text: '',
        cited_urls: [],
        response_ms: Date.now() - start,
        cost_usd: COST_USD_PER_CALL,
        model: 'google_aio',
      }
    }

    const cited_urls: CitedUrl[] = aio.sources.map((s, i) => ({
      url: s.url,
      anchor: s.title,
      position: i + 1,
    }))

    return {
      engine: 'google_aio',
      text: aio.text || '',
      cited_urls,
      response_ms: Date.now() - start,
      cost_usd: COST_USD_PER_CALL,
      model: 'google_aio',
    }
  } catch (e: any) {
    return {
      engine: 'google_aio',
      text: '',
      cited_urls: [],
      response_ms: Date.now() - start,
      cost_usd: 0,
      error: e?.message || String(e),
    }
  }
}
