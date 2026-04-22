import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — shared Anthropic-API wrapper for the Sonnet prompt chain.
//
// Every Trainer prompt module (baseline, roadmap, workout, food-prefs, meals,
// adjust) builds a system-prompt + user-message + tool-use schema pair.  This
// runner is the one place that:
//
//   1. Posts to https://api.anthropic.com/v1/messages with tool_choice forcing
//      the named tool (strict-JSON output pattern).
//   2. Extracts the tool_use.input block as the typed output T.
//   3. Logs usage to koto_token_usage via logTokenUsage (fire-and-forget).
//   4. Returns a discriminated-union result — never throws on HTTP / parse
//      failures so the /api/trainer/generate dispatcher can surface them
//      to the operator without catching around every call.
//
// Ported from src/lib/kotoiq/profileUploadImage.ts (raw fetch + tool_use +
// logTokenUsage pattern).  Intentionally does NOT use @anthropic-ai/sdk so
// we stay on the same transport KotoIQ uses and get identical error shapes.
// ─────────────────────────────────────────────────────────────────────────────

import { MODELS } from './trainerConfig'
import { logTokenUsage } from '../tokenTracker'

export type SonnetTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type SonnetRunArgs = {
  /** koto_token_usage `feature` column (e.g. FEATURE_TAGS.BASELINE). */
  featureTag: string
  /** Full system prompt including the $150/hr-coach voice paragraph. */
  systemPrompt: string
  /** The tool schema — its `name` is what tool_choice forces. */
  tool: SonnetTool
  /** User-turn content.  Usually a compact JSON payload + one-line ask. */
  userMessage: string
  /** Agency id for per-agency token-usage attribution. */
  agencyId: string
  /** Default 4000; pass 16000 for meal-plan call (largest output). */
  maxTokens?: number
  /** Default 'sonnet'.  Haiku reserved for cheaper future sub-prompts. */
  model?: 'sonnet' | 'haiku'
  /** Freeform metadata forwarded to koto_token_usage.metadata. */
  metadata?: Record<string, unknown>
}

export type SonnetRunResult<T> =
  | { ok: true; data: T; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: string; status?: number }

/**
 * Call Anthropic /v1/messages forcing a single named tool, parse the
 * tool_use input as T, log usage, and return a discriminated result.
 *
 * Never throws.  Transport / parse failures arrive as
 * `{ ok: false, error, status? }`.
 */
export async function callSonnet<T>(args: SonnetRunArgs): Promise<SonnetRunResult<T>> {
  const modelId = (args.model ?? 'sonnet') === 'haiku' ? MODELS.HAIKU : MODELS.SONNET

  const body = {
    model: modelId,
    max_tokens: args.maxTokens ?? 4000,
    system: args.systemPrompt,
    tools: [args.tool],
    tool_choice: { type: 'tool' as const, name: args.tool.name },
    messages: [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: args.userMessage }],
      },
    ],
  }

  let r: Response
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': MODELS.ANTHROPIC_VERSION,
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `fetch_failed:${msg}` }
  }

  if (!r.ok) {
    let detail = ''
    try {
      detail = (await r.text()).slice(0, 500)
    } catch {
      /* ignore body read errors */
    }
    return {
      ok: false,
      error: `anthropic_http_${r.status}${detail ? `:${detail}` : ''}`,
      status: r.status,
    }
  }

  let resp: {
    content?: Array<{ type: string; input?: unknown }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  try {
    resp = (await r.json()) as typeof resp
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `anthropic_bad_json:${msg}` }
  }

  const inputTokens = resp?.usage?.input_tokens ?? 0
  const outputTokens = resp?.usage?.output_tokens ?? 0

  // Log usage FIRST so failures below still bill the operator for the call
  // that actually happened.  Fire-and-forget — never awaited.
  void logTokenUsage({
    feature: args.featureTag,
    model: modelId,
    inputTokens,
    outputTokens,
    agencyId: args.agencyId,
    metadata: args.metadata ?? {},
  })

  const toolUse = (resp?.content ?? []).find(
    (c): c is { type: 'tool_use'; input?: unknown } => c.type === 'tool_use',
  )
  if (!toolUse || typeof toolUse.input === 'undefined') {
    return { ok: false, error: 'no_tool_use_in_response' }
  }

  return {
    ok: true,
    data: toolUse.input as T,
    usage: { inputTokens, outputTokens },
  }
}
