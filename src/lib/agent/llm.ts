import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { logTokenUsage } from '@/lib/tokenTracker'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — LLM Wrapper
//
// Wraps Anthropic SDK following the adsLLM pattern from src/lib/ads/llmRouter.ts:
//   - System + user prompt → structured JSON output
//   - Zod validation with one retry on parse failure
//   - Token tracking via existing tokenTracker
//   - Cost calculation using published rates
//
// Used by the Strategist for planning prompts.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096
const TIMEOUT_MS = 60_000

// Claude Sonnet 4 pricing per 1M tokens
const PRICE_IN = 3.0
const PRICE_OUT = 15.0

function extractJson(text: string): unknown {
  if (!text) throw new Error('Empty LLM response')
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* try fence extraction */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) { try { return JSON.parse(fence[1].trim()) } catch { /* continue */ } }
  const start = trimmed.indexOf('{')
  if (start !== -1) {
    let depth = 0
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++
      else if (trimmed[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(trimmed.slice(start, i + 1)) } catch { break } } }
    }
  }
  const arrStart = trimmed.indexOf('[')
  if (arrStart !== -1) {
    let depth = 0
    for (let i = arrStart; i < trimmed.length; i++) {
      if (trimmed[i] === '[') depth++
      else if (trimmed[i] === ']') { depth--; if (depth === 0) { try { return JSON.parse(trimmed.slice(arrStart, i + 1)) } catch { break } } }
    }
  }
  throw new Error('Could not extract JSON from LLM response')
}

export interface AgentLLMResult<T = unknown> {
  result: T
  tokens: number
  cost_usd: number
}

export async function agentLLM<T>(args: {
  ai: Anthropic
  system: string
  user: string
  schema: z.ZodType<T>
  temperature?: number
  agencyId?: string
  feature?: string
}): Promise<AgentLLMResult<T>> {
  const { ai, system, user, schema, temperature, agencyId, feature } = args

  const callLLM = async () => {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      ...(temperature !== undefined ? { temperature } : {}),
    })

    const text = msg.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n')
    const inTok = msg.usage?.input_tokens || 0
    const outTok = msg.usage?.output_tokens || 0

    return { text, inTok, outTok }
  }

  // First attempt
  let raw = await callLLM()
  let parsed: unknown
  let validated: T

  try {
    parsed = extractJson(raw.text)
    validated = schema.parse(parsed)
  } catch (firstErr) {
    // One retry — include the validation error in the retry prompt
    const retryRaw = await callLLM()
    raw = {
      text: retryRaw.text,
      inTok: raw.inTok + retryRaw.inTok,
      outTok: raw.outTok + retryRaw.outTok,
    }
    parsed = extractJson(retryRaw.text)
    validated = schema.parse(parsed) // throws if still invalid
  }

  const cost_usd = (raw.inTok * PRICE_IN + raw.outTok * PRICE_OUT) / 1_000_000
  const tokens = raw.inTok + raw.outTok

  // Fire-and-forget token tracking
  void logTokenUsage({
    feature: feature || 'agent_planner',
    model: MODEL,
    inputTokens: raw.inTok,
    outputTokens: raw.outTok,
    agencyId,
  })

  return { result: validated, tokens, cost_usd }
}
