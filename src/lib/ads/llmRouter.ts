// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Task-specific multi-provider LLM router
//
// Routes each task to the optimal model (Gemini Flash for bulk
// classification, Claude for reasoning, GPT-4o for TikTok).
// Automatic fallback, Zod validation, budget enforcement,
// per-call cost logging.
//
// Usage:
//   import { adsLLM } from '@/lib/ads/llmRouter'
//   const result = await adsLLM.run({
//     task: 'recommend_negatives',
//     clientId: 'uuid',
//     agencyId: 'uuid',
//     input: { ... },
//   })
// ─────────────────────────────────────────────────────────────

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { logTokenUsage } from '@/lib/tokenTracker'

import * as Schemas from './llmSchemas'
import { PROMPT_REGISTRY } from './prompts'

// ── Types ─────────────────────────────────────────────────────

export type AdsTask =
  | 'classify_search_term'
  | 'recommend_negatives'
  | 'recommend_new_keywords'
  | 'generate_ad_copy_google'
  | 'generate_ad_copy_meta'
  | 'generate_ad_copy_linkedin'
  | 'generate_ad_copy_tiktok'
  | 'explain_anomaly'
  | 'weekly_executive_summary'
  | 'label_cluster'
  | 'period_comparison_narrative'

type Provider = 'anthropic' | 'openai' | 'gemini'

interface ProviderTarget {
  provider: Provider
  model: string
}

interface TaskConfig {
  primary: ProviderTarget
  fallback?: ProviderTarget
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  promptVersion: number
  maxRetries: number
}

// ── Model constants ───────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-6-20250627'
const GPT4O_MODEL = 'gpt-4o'
const GPT4O_MINI_MODEL = 'gpt-4o-mini'
const GEMINI_FLASH_MODEL = 'gemini-2.5-flash'

const PROVIDER_TIMEOUT_MS = 60_000
const MAX_TOKENS = 4_096

// ── Pricing per 1M tokens ─────────────────────────────────────

const PRICING: Record<string, { in: number; out: number }> = {
  [CLAUDE_MODEL]: { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  [GPT4O_MODEL]: { in: 2.5, out: 10 },
  [GPT4O_MINI_MODEL]: { in: 0.15, out: 0.6 },
  [GEMINI_FLASH_MODEL]: { in: 0.30, out: 2.50 },
}

// ── Task → Model routing table ────────────────────────────────

const TASKS: Record<AdsTask, TaskConfig> = {
  classify_search_term: {
    primary: { provider: 'gemini', model: GEMINI_FLASH_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MINI_MODEL },
    inputSchema: Schemas.ClassifySearchTermInput,
    outputSchema: Schemas.SearchTermClassificationSchema,
    promptVersion: 1,
    maxRetries: 2,
  },
  recommend_negatives: {
    primary: { provider: 'gemini', model: GEMINI_FLASH_MODEL },
    fallback: { provider: 'anthropic', model: CLAUDE_MODEL },
    inputSchema: Schemas.RecommendNegativesInput,
    outputSchema: Schemas.NegativesResponseSchema,
    promptVersion: 1,
    maxRetries: 2,
  },
  recommend_new_keywords: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.RecommendNewKeywordsInput,
    outputSchema: Schemas.NewKeywordsResponseSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  generate_ad_copy_google: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.GoogleRSAInput,
    outputSchema: Schemas.GoogleRSASchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  generate_ad_copy_meta: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.MetaAdInput,
    outputSchema: Schemas.MetaAdSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  generate_ad_copy_linkedin: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.LinkedInAdInput,
    outputSchema: Schemas.LinkedInAdSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  generate_ad_copy_tiktok: {
    primary: { provider: 'openai', model: GPT4O_MODEL },
    fallback: { provider: 'anthropic', model: CLAUDE_MODEL },
    inputSchema: Schemas.TikTokAdInput,
    outputSchema: Schemas.TikTokAdSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  explain_anomaly: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.ExplainAnomalyInput,
    outputSchema: Schemas.AnomalyExplanationSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  weekly_executive_summary: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.WeeklySummaryInput,
    outputSchema: Schemas.WeeklySummarySchema,
    promptVersion: 1,
    maxRetries: 1,
  },
  label_cluster: {
    primary: { provider: 'gemini', model: GEMINI_FLASH_MODEL },
    inputSchema: Schemas.LabelClusterInput,
    outputSchema: Schemas.LabelClusterSchema,
    promptVersion: 1,
    maxRetries: 2,
  },
  period_comparison_narrative: {
    primary: { provider: 'anthropic', model: CLAUDE_MODEL },
    fallback: { provider: 'openai', model: GPT4O_MODEL },
    inputSchema: Schemas.PeriodComparisonInput,
    outputSchema: Schemas.PeriodComparisonSchema,
    promptVersion: 1,
    maxRetries: 1,
  },
}

// ── JSON extraction (tolerates fences/preamble) ───────────────

function extractJson(text: string): unknown {
  if (!text) throw new Error('Empty LLM response')
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch {}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) { try { return JSON.parse(fence[1].trim()) } catch {} }
  const first = findBalanced(trimmed, '{', '}')
  if (first) { try { return JSON.parse(first) } catch {} }
  const arr = findBalanced(trimmed, '[', ']')
  if (arr) { try { return JSON.parse(arr) } catch {} }
  throw new Error('Could not extract JSON from LLM response')
}

function findBalanced(s: string, open: string, close: string): string | null {
  const start = s.indexOf(open)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++
    else if (s[i] === close) { depth--; if (depth === 0) return s.slice(start, i + 1) }
  }
  return null
}

// ── Provider callers ──────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

async function callAnthropic(model: string, prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  const msg = await withTimeout(
    ai.messages.create({ model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }),
    PROVIDER_TIMEOUT_MS,
    'anthropic',
  )
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n')
  return { text, inTok: msg.usage?.input_tokens || 0, outTok: msg.usage?.output_tokens || 0 }
}

async function callOpenAI(model: string, prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
  const res = await withTimeout(
    client.chat.completions.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
    PROVIDER_TIMEOUT_MS,
    'openai',
  )
  return {
    text: res.choices?.[0]?.message?.content || '',
    inTok: res.usage?.prompt_tokens || 0,
    outTok: res.usage?.completion_tokens || 0,
  }
}

async function callGemini(model: string, prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_KEY || ''
  if (!key) throw new Error('GEMINI_API_KEY not set')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: MAX_TOKENS, responseMimeType: 'application/json' },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
  return {
    text,
    inTok: data.usageMetadata?.promptTokenCount || 0,
    outTok: data.usageMetadata?.candidatesTokenCount || 0,
  }
}

async function callProvider(provider: Provider, model: string, prompt: string) {
  switch (provider) {
    case 'anthropic': return callAnthropic(model, prompt)
    case 'openai': return callOpenAI(model, prompt)
    case 'gemini': return callGemini(model, prompt)
  }
}

// ── Budget enforcement ────────────────────────────────────────

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

async function getMonthSpend(clientId: string): Promise<number> {
  const { data } = await sb()
    .from('kotoiq_ads_llm_usage')
    .select('cost_usd')
    .eq('client_id', clientId)
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
  return (data || []).reduce((sum, r) => sum + Number(r.cost_usd || 0), 0)
}

async function enforceBudget(clientId: string): Promise<void> {
  const [spent, settings] = await Promise.all([
    getMonthSpend(clientId),
    sb().from('kotoiq_ads_settings').select('monthly_llm_budget_usd').eq('client_id', clientId).single(),
  ])
  const budget = Number(settings.data?.monthly_llm_budget_usd ?? 100)
  if (spent >= budget) {
    throw new Error(`Monthly ads LLM budget exhausted: $${spent.toFixed(2)} of $${budget}`)
  }
}

// ── Log usage to kotoiq_ads_llm_usage ─────────────────────────

async function logAdsUsage(args: {
  clientId: string | null
  agencyId?: string
  task: string
  model: string
  promptTokens: number
  completionTokens: number
  costUsd: number
  latencyMs: number
  success: boolean
  errorMessage?: string
  promptVersion: number
}): Promise<void> {
  // Log to ads-specific table
  void sb().from('kotoiq_ads_llm_usage').insert({
    client_id: args.clientId,
    agency_id: args.agencyId || null,
    task: args.task,
    model: args.model,
    prompt_tokens: args.promptTokens,
    completion_tokens: args.completionTokens,
    cost_usd: args.costUsd,
    latency_ms: args.latencyMs,
    success: args.success,
    error_message: args.errorMessage || null,
    prompt_version: args.promptVersion,
  })
  // Also log to the shared koto_token_usage via existing tracker
  void logTokenUsage({
    feature: `ads_intel_${args.task}`,
    model: args.model,
    inputTokens: args.promptTokens,
    outputTokens: args.completionTokens,
    agencyId: args.agencyId,
  })
}

// ── Main router ───────────────────────────────────────────────

export interface AdsLLMRunArgs {
  task: AdsTask
  clientId: string | null
  agencyId?: string
  input: unknown
}

export interface AdsLLMResult {
  data: unknown
  usage: { cost_usd: number; tokens: number; model: string }
}

async function run(args: AdsLLMRunArgs): Promise<AdsLLMResult> {
  const config = TASKS[args.task]
  if (!config) throw new Error(`Unknown ads task: ${args.task}`)

  // Validate input
  const parsedInput = config.inputSchema.parse(args.input)

  // Budget check
  if (args.clientId) await enforceBudget(args.clientId)

  // Render prompt
  const renderFn = PROMPT_REGISTRY[args.task]
  if (!renderFn) throw new Error(`No prompt template for task: ${args.task}`)
  const prompt = renderFn(parsedInput)

  // Try primary, then fallback
  const targets = [config.primary, config.fallback].filter(Boolean) as ProviderTarget[]

  for (const target of targets) {
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const start = Date.now()
      try {
        const raw = await callProvider(target.provider, target.model, prompt)
        const parsed = extractJson(raw.text)
        const validated = config.outputSchema.parse(parsed)

        const price = PRICING[target.model] ?? { in: 0, out: 0 }
        const costUsd = (raw.inTok * price.in + raw.outTok * price.out) / 1_000_000

        void logAdsUsage({
          clientId: args.clientId,
          agencyId: args.agencyId,
          task: args.task,
          model: target.model,
          promptTokens: raw.inTok,
          completionTokens: raw.outTok,
          costUsd,
          latencyMs: Date.now() - start,
          success: true,
          promptVersion: config.promptVersion,
        })

        return {
          data: validated,
          usage: { cost_usd: costUsd, tokens: raw.inTok + raw.outTok, model: target.model },
        }
      } catch (err: any) {
        void logAdsUsage({
          clientId: args.clientId,
          agencyId: args.agencyId,
          task: args.task,
          model: target.model,
          promptTokens: 0,
          completionTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - start,
          success: false,
          errorMessage: String(err?.message ?? err).slice(0, 500),
          promptVersion: config.promptVersion,
        })
        if (attempt === config.maxRetries) break
      }
    }
  }

  throw new Error(`All providers failed for ads task: ${args.task}`)
}

export const adsLLM = { run }
