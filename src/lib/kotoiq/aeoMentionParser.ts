import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { AeoEngineResponse } from './aeoEngines/types'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 15_000
const MAX_OUTPUT = 800

export interface TrackedBrand {
  brand_name: string
  aliases?: string[]
  domain?: string
  is_self?: boolean
}

export interface ParsedMention {
  brand: string                // canonical brand_name from the input list
  position: number             // 1=primary recommendation, 2=secondary, 3+=also-mentioned, 0=not mentioned
  sentiment: 'positive' | 'neutral' | 'negative'
  snippet: string              // the sentence(s) where the brand is mentioned (max ~200 chars)
}

export interface ParsedResponse {
  brand_mentions: ParsedMention[]
  cited_urls: { url: string; anchor?: string; position?: number }[]
  parser_cost_usd: number
  parser_ms: number
  error?: string
}

const SYSTEM_PROMPT = `You analyze AI search engine responses for brand mentions in competitive intelligence research.

You are given:
1) A list of tracked brands (each with optional aliases)
2) The raw response text from an AI search engine

Your job: return STRICT JSON with two arrays.

For "brand_mentions" — one entry per tracked brand that appears in the response. Use the canonical brand_name from the input list (not an alias).
- position: 1 if it's the primary/first/recommended option; 2 if secondary; 3+ if mentioned later or as an also-ran; 0 if NOT mentioned at all.
- sentiment: "positive" if the response endorses or recommends it; "neutral" if mentioned without judgment; "negative" if criticized or warned against.
- snippet: the exact sentence (or two) where it appears, max 200 characters.

For "cited_urls" — every URL referenced in the response text, including those in markdown links, plain text, or footnote-style. Deduplicate. If you can infer the anchor text, include it. Position is 1-based order of appearance.

CRITICAL: If a brand from the input list is not mentioned at all, OMIT it from brand_mentions (do not include with position=0 unless explicitly required; here, just omit).

CRITICAL: Be strict about brand matching. "Apple" is Apple Inc. only if context is tech/business; if the response is about fruit, do not match. Use surrounding context to disambiguate.

Return ONLY this JSON shape, no markdown, no prose:
{"brand_mentions":[{"brand":"...","position":1,"sentiment":"positive","snippet":"..."}], "cited_urls":[{"url":"https://...","anchor":"...","position":1}]}`

/**
 * Parse an engine response for tracked brand mentions and citations.
 * Uses Claude Haiku for cheap, fast structured extraction.
 */
export async function parseMentions(
  engineResponse: AeoEngineResponse,
  trackedBrands: TrackedBrand[],
  opts: { agencyId?: string | null; clientId?: string | null } = {},
): Promise<ParsedResponse> {
  const start = Date.now()
  const empty: ParsedResponse = {
    brand_mentions: [],
    cited_urls: engineResponse.cited_urls || [],
    parser_cost_usd: 0,
    parser_ms: 0,
  }

  if (!engineResponse.text || engineResponse.error) return empty
  if (!trackedBrands.length) return empty
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...empty, error: 'ANTHROPIC_API_KEY not set' }
  }

  const brandList = trackedBrands.map(b => ({
    brand_name: b.brand_name,
    aliases: b.aliases || [],
    is_self: !!b.is_self,
  }))

  const userPrompt = [
    `Tracked brands:\n${JSON.stringify(brandList, null, 2)}`,
    '',
    `AI engine response:\n${engineResponse.text}`,
  ].join('\n')

  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    let msg
    try {
      msg = await ai.messages.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })
    } finally {
      clearTimeout(t)
    }

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = safeParseJson(raw)
    const inputTokens = msg.usage?.input_tokens || 0
    const outputTokens = msg.usage?.output_tokens || 0
    const parser_cost_usd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0

    void logTokenUsage({
      feature: 'aeo_visibility_parser',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { engine: engineResponse.engine, client_id: opts.clientId },
    })

    if (!parsed) {
      return { ...empty, parser_cost_usd, parser_ms: Date.now() - start, error: 'parser_json_parse_failed' }
    }

    const brand_mentions: ParsedMention[] = (parsed.brand_mentions || [])
      .filter((m: any) => m?.brand && typeof m.position === 'number')
      .map((m: any) => ({
        brand: String(m.brand),
        position: Number(m.position) || 0,
        sentiment: ['positive', 'neutral', 'negative'].includes(m.sentiment) ? m.sentiment : 'neutral',
        snippet: String(m.snippet || '').slice(0, 220),
      }))

    // Prefer parser citations (which can have anchors) over raw URL extraction
    const parsed_urls = (parsed.cited_urls || [])
      .filter((u: any) => u?.url)
      .map((u: any, i: number) => ({
        url: String(u.url),
        anchor: u.anchor ? String(u.anchor) : undefined,
        position: typeof u.position === 'number' ? u.position : i + 1,
      }))

    const cited_urls = parsed_urls.length ? parsed_urls : (engineResponse.cited_urls || [])

    return {
      brand_mentions,
      cited_urls,
      parser_cost_usd,
      parser_ms: Date.now() - start,
    }
  } catch (e: any) {
    return { ...empty, parser_ms: Date.now() - start, error: e?.message || String(e) }
  }
}

function safeParseJson(raw: string): any | null {
  if (!raw) return null
  // Strip code fences if model wrapped output
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Last resort: pull the largest {...} block
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) } catch { /* fall through */ }
    }
    return null
  }
}
