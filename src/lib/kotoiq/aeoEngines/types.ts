// Shared types for AEO engine clients (Phase A).
// Each engine returns the same shape so the orchestrator can
// treat them uniformly under Promise.allSettled.

export type AeoEngineKey =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'google_aio'

export interface AeoEngineResponse {
  engine: AeoEngineKey
  text: string                // raw answer
  cited_urls: CitedUrl[]      // structured citations if engine provides them
  response_ms: number
  cost_usd: number
  tokens?: { input: number; output: number }
  model?: string
  error?: string              // present when the engine failed; text='' in that case
}

export interface CitedUrl {
  url: string
  anchor?: string             // anchor/title text if engine gave it
  position?: number           // 1-based, if engine surfaced an ordering
}

export interface RunPromptOptions {
  agencyId?: string | null
  clientId?: string | null
  feature?: string            // for token tracking, defaults to 'aeo_visibility'
}

// Per-engine cost helpers — kept in one place so we can update
// pricing without hunting through engine files.
export const ENGINE_PRICING = {
  // OpenAI gpt-4o-mini per-million tokens
  chatgpt:    { input: 0.150,  output: 0.600  },
  // Anthropic claude-haiku-4-5 per-million tokens
  claude:     { input: 1.000,  output: 5.000  },
  // Gemini 2.0-flash per-million tokens (effectively free under daily quota)
  gemini:     { input: 0.075,  output: 0.300  },
  // Perplexity sonar per-million tokens (+ search surcharge handled inline)
  perplexity: { input: 1.000,  output: 1.000  },
  // DataForSEO Google AIO is per-call, not per-token — handled inline
  google_aio: { input: 0,      output: 0      },
} as const

export function computeCost(
  engine: AeoEngineKey,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = ENGINE_PRICING[engine]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p.input
       + (outputTokens / 1_000_000) * p.output
}
