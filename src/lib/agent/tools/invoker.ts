import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { getTool } from './registry'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Tool Invoker
//
// Dispatches a tool call: lookup → validate input → invoke → validate output
// → return with timing and cost.  No LLM logic — pure function dispatch.
// ─────────────────────────────────────────────────────────────────────────────

export interface InvokeResult {
  output: unknown
  cost_usd: number
  tokens_used: number
  duration_ms: number
}

export async function invokeTool(args: {
  s: SupabaseClient
  ai: Anthropic
  tool_name: string
  input: unknown
  runContext: { run_id: string; client_id: string; agency_id: string }
}): Promise<InvokeResult> {
  const { s, ai, tool_name, input, runContext } = args

  // ── Lookup ────────────────────────────────────────────────────────────────
  const tool = getTool(tool_name)
  if (!tool) {
    throw new Error(`[invoker] Unknown tool: ${tool_name}`)
  }

  // ── Validate input ────────────────────────────────────────────────────────
  const parsed = tool.inputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`[invoker] Input validation failed for ${tool_name}: ${parsed.error.message}`)
  }

  // ── Invoke with timing ────────────────────────────────────────────────────
  const start = Date.now()
  const output = await tool.invoke({
    s,
    ai,
    input: parsed.data,
    runContext,
  })
  const duration_ms = Date.now() - start

  // ── Validate output (non-blocking — log warning but don't reject) ─────────
  const outParsed = tool.outputSchema.safeParse(output)
  if (!outParsed.success) {
    console.warn(`[invoker] Output validation warning for ${tool_name}: ${outParsed.error.message}`)
    // Don't throw — output schemas are z.unknown() for most tools currently.
    // This will become strict once output schemas are tightened.
  }

  // ── Cost estimate (actual LLM cost is tracked by engine functions via tokenTracker) ─
  const cost_usd = tool.estCostUsd(parsed.data)
  const tokens_used = tool.estTokens(parsed.data)

  return { output, cost_usd, tokens_used, duration_ms }
}
