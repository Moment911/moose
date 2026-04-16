// ─────────────────────────────────────────────────────────────
// Multi-AI Blender — KotoIQ heavy-research orchestrator
//
// Fans a single task out to Claude Sonnet, GPT-4o, and Gemini
// 1.5 Pro in parallel, then asks Claude Opus to synthesize a
// best-of unified answer from the surviving responses.
//
// Per-provider failures are tolerated via Promise.allSettled —
// one bad key / rate-limit / timeout does not tank the request.
// Opus synthesis only runs when 2+ providers succeed; a single
// surviving response is returned verbatim.
//
// Kill-switch: BLENDED_AI_ENABLED=false → Claude-only fallback.
// Per-call opt-out: pass skipBlend: true.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { logTokenUsage } from '@/lib/tokenTracker'

const CLAUDE_ARM_MODEL = 'claude-sonnet-4-20250514'
const OPENAI_ARM_MODEL = 'gpt-4o'
const GEMINI_ARM_MODEL = 'gemini-1.5-pro-latest'
const SYNTHESIS_MODEL  = 'claude-opus-4-20250514'

const PROVIDER_TIMEOUT_MS  = 25_000
const SYNTHESIS_TIMEOUT_MS = 15_000
const DEFAULT_MAX_TOKENS   = 4_096

export interface BlendInput {
  systemPrompt: string
  userPrompt: string
  synthesisInstruction: string
  maxTokens?: number
  feature: string
  agencyId?: string
  skipBlend?: boolean
}

export interface ProviderOutput {
  text: string
  ms: number
  tokens: number
}

export interface BlendResult {
  synthesized: string
  sources: {
    claude: ProviderOutput
    openai: ProviderOutput
    gemini: ProviderOutput
  }
  synthesisMs: number
  totalMs: number
  totalTokens: number
  failedProviders: string[]
}

// ── Env + kill switch ──────────────────────────────────────────
function blendEnabled(): boolean {
  const flag = (process.env.BLENDED_AI_ENABLED || '').toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'off') return false
  return true
}

function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GEMINI_API_KEY
    || process.env.GOOGLE_GEMINI_KEY
    || ''
}

// Per-promise timeout — AbortSignal.timeout handles network; this
// wraps SDK calls that ignore abort signals.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

// ── Provider: Claude Sonnet ────────────────────────────────────
async function callClaude(input: BlendInput): Promise<ProviderOutput> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const start = Date.now()
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await withTimeout(
    ai.messages.create({
      model: CLAUDE_ARM_MODEL,
      max_tokens: input.maxTokens || DEFAULT_MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
    }),
    PROVIDER_TIMEOUT_MS,
    'claude',
  )
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const inTok = msg.usage?.input_tokens || 0
  const outTok = msg.usage?.output_tokens || 0
  void logTokenUsage({
    feature: input.feature,
    model: CLAUDE_ARM_MODEL,
    inputTokens: inTok,
    outputTokens: outTok,
    agencyId: input.agencyId,
    metadata: { provider: 'claude', role: 'arm' },
  })
  return { text, ms: Date.now() - start, tokens: inTok + outTok }
}

// ── Provider: OpenAI GPT-4o ────────────────────────────────────
async function callOpenAI(input: BlendInput): Promise<ProviderOutput> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  const start = Date.now()
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const resp = await withTimeout(
    client.chat.completions.create({
      model: OPENAI_ARM_MODEL,
      max_tokens: input.maxTokens || DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }),
    PROVIDER_TIMEOUT_MS,
    'openai',
  )
  const text = resp.choices?.[0]?.message?.content || ''
  const inTok = resp.usage?.prompt_tokens || 0
  const outTok = resp.usage?.completion_tokens || 0
  void logTokenUsage({
    feature: input.feature,
    model: OPENAI_ARM_MODEL,
    inputTokens: inTok,
    outputTokens: outTok,
    agencyId: input.agencyId,
    metadata: { provider: 'openai', role: 'arm' },
  })
  return { text, ms: Date.now() - start, tokens: inTok + outTok }
}

// ── Provider: Gemini 1.5 Pro (REST) ────────────────────────────
async function callGemini(input: BlendInput): Promise<ProviderOutput> {
  const key = getGeminiKey()
  if (!key) throw new Error('GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY) not set')
  const start = Date.now()
  const body = {
    systemInstruction: { role: 'system', parts: [{ text: input.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
    generationConfig: { maxOutputTokens: input.maxTokens || DEFAULT_MAX_TOKENS },
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ARM_MODEL}:generateContent?key=${key}`
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
  const inTok = data.usageMetadata?.promptTokenCount || 0
  const outTok = data.usageMetadata?.candidatesTokenCount || 0
  void logTokenUsage({
    feature: input.feature,
    model: 'gemini-1.5-pro',
    inputTokens: inTok,
    outputTokens: outTok,
    agencyId: input.agencyId,
    metadata: { provider: 'gemini', role: 'arm' },
  })
  return { text, ms: Date.now() - start, tokens: inTok + outTok }
}

// ── Synthesis: Claude Opus ────────────────────────────────────
async function synthesize(
  input: BlendInput,
  survivors: { label: 'Claude' | 'OpenAI' | 'Gemini'; text: string }[],
): Promise<{ text: string; ms: number; tokens: number }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required for synthesis')
  }
  const start = Date.now()
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const synthSystem = `You are a senior strategist. You have received ${survivors.length} independent AI-generated responses to the same task. ${input.synthesisInstruction} Produce ONE superior unified response that takes the strongest elements from each. Do not mention the source AIs. Keep the output format strict per the original task.`

  const userBlocks = survivors
    .map((s, idx) => `---\nRESPONSE ${String.fromCharCode(65 + idx)} (${s.label}):\n${s.text}`)
    .join('\n\n')

  const synthUser = `ORIGINAL TASK:\n${input.userPrompt}\n\n${userBlocks}`

  const msg = await withTimeout(
    ai.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: input.maxTokens || DEFAULT_MAX_TOKENS,
      system: synthSystem,
      messages: [{ role: 'user', content: synthUser }],
    }),
    SYNTHESIS_TIMEOUT_MS,
    'synthesis',
  )
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const inTok = msg.usage?.input_tokens || 0
  const outTok = msg.usage?.output_tokens || 0
  void logTokenUsage({
    feature: input.feature,
    model: SYNTHESIS_MODEL,
    inputTokens: inTok,
    outputTokens: outTok,
    agencyId: input.agencyId,
    metadata: { provider: 'claude', role: 'synthesis', survivors: survivors.map(s => s.label) },
  })
  return { text, ms: Date.now() - start, tokens: inTok + outTok }
}

// ── Main entrypoint ───────────────────────────────────────────
export async function blendThreeAIs(input: BlendInput): Promise<BlendResult> {
  const totalStart = Date.now()
  const empty: ProviderOutput = { text: '', ms: 0, tokens: 0 }
  const failedProviders: string[] = []

  // Caller-level opt-out or global kill-switch → Claude-only path.
  // We still wrap the single call in the same BlendResult shape so
  // callers have a stable contract.
  if (input.skipBlend || !blendEnabled()) {
    try {
      const claude = await callClaude(input)
      return {
        synthesized: claude.text,
        sources: { claude, openai: empty, gemini: empty },
        synthesisMs: 0,
        totalMs: Date.now() - totalStart,
        totalTokens: claude.tokens,
        failedProviders: ['openai', 'gemini'],
      }
    } catch (e: any) {
      throw new Error(`Claude-only fallback failed: ${e?.message || String(e)}`)
    }
  }

  // Pre-flight: if ALL three keys are missing, bail hard so the
  // caller sees a clear error instead of 3 rejected promises.
  const hasClaude = !!process.env.ANTHROPIC_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!getGeminiKey()
  if (!hasClaude && !hasOpenAI && !hasGemini) {
    throw new Error('No AI provider keys configured — set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY')
  }

  // Fan out. allSettled so one failure does not cancel the others.
  const [claudeR, openaiR, geminiR] = await Promise.allSettled([
    callClaude(input),
    callOpenAI(input),
    callGemini(input),
  ])

  const claude = claudeR.status === 'fulfilled' ? claudeR.value : empty
  const openai = openaiR.status === 'fulfilled' ? openaiR.value : empty
  const gemini = geminiR.status === 'fulfilled' ? geminiR.value : empty

  if (claudeR.status === 'rejected') failedProviders.push('claude')
  if (openaiR.status === 'rejected') failedProviders.push('openai')
  if (geminiR.status === 'rejected') failedProviders.push('gemini')

  const survivors: { label: 'Claude' | 'OpenAI' | 'Gemini'; text: string }[] = []
  if (claudeR.status === 'fulfilled' && claude.text) survivors.push({ label: 'Claude', text: claude.text })
  if (openaiR.status === 'fulfilled' && openai.text) survivors.push({ label: 'OpenAI', text: openai.text })
  if (geminiR.status === 'fulfilled' && gemini.text) survivors.push({ label: 'Gemini', text: gemini.text })

  if (survivors.length === 0) {
    const reasons = [claudeR, openaiR, geminiR]
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason?.message || 'unknown')
      .join(' | ')
    throw new Error(`All 3 AI providers failed: ${reasons}`)
  }

  // Single survivor → skip synthesis; the blender's value only
  // kicks in with 2+ perspectives to merge.
  if (survivors.length === 1) {
    return {
      synthesized: survivors[0].text,
      sources: { claude, openai, gemini },
      synthesisMs: 0,
      totalMs: Date.now() - totalStart,
      totalTokens: claude.tokens + openai.tokens + gemini.tokens,
      failedProviders,
    }
  }

  // 2+ survivors → Opus synthesis. If synthesis itself fails we
  // fall back to the first survivor so callers still get output.
  let synthText = ''
  let synthesisMs = 0
  let synthTokens = 0
  try {
    const synth = await synthesize(input, survivors)
    synthText = synth.text
    synthesisMs = synth.ms
    synthTokens = synth.tokens
  } catch (e: any) {
    failedProviders.push('synthesis')
    synthText = survivors[0].text
  }

  return {
    synthesized: synthText,
    sources: { claude, openai, gemini },
    synthesisMs,
    totalMs: Date.now() - totalStart,
    totalTokens: claude.tokens + openai.tokens + gemini.tokens + synthTokens,
    failedProviders,
  }
}
