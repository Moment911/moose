import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

const MODEL = 'claude-sonnet-4-6-20250627'
const TIMEOUT_MS = 30_000
const MAX_OUTPUT = 4000

export interface ClientSeedContext {
  business_name?: string
  industry?: string
  primary_service?: string
  target_customer?: string
  marketing_budget?: string
  unique_selling_prop?: string
  city?: string
  state?: string
  service_area?: string
  website?: string
}

export interface SeededPrompt {
  prompt: string
  category: 'commercial' | 'informational' | 'comparison' | 'local' | 'problem'
  intent: string
}

const SYSTEM_PROMPT = `You generate test prompts for an Answer Engine Optimization (AEO) visibility tracker.

For the given business, produce a diverse list of REAL questions a customer would ask ChatGPT, Perplexity, Gemini, or Google AI Overviews at different stages of their search journey.

Coverage requirements — produce EXACTLY 40 prompts:
- 10 "commercial" — high purchase intent ("best X for Y", "top X provider in Z")
- 10 "informational" — research stage ("how does X work", "what is X")
- 10 "comparison" — comparison shopping ("X vs Y", "alternatives to X")
- 5  "local" — local intent if applicable ("X near me", "X in [city]") — omit if business is not local; substitute additional commercial prompts
- 5  "problem" — problem-aware stage ("my X is broken", "why does my X fail")

Prompts must:
- Sound like real natural language a person would type or speak
- Be specific to the business's actual industry and service
- Use the city / region / service area for local prompts when applicable
- Avoid generic "best company" prompts that don't mention what the business does
- Have varying length and phrasing — not all start the same way

Return STRICT JSON only:
{"prompts":[{"prompt":"...", "category":"commercial", "intent":"short tag"}]}

No markdown, no prose, no preamble.`

/**
 * Generate 40 starter AEO test prompts for a client from their
 * onboarding data. Used by aeo_seed_prompts API action when a
 * client is first set up.
 */
export async function seedPromptsForClient(
  ctx: ClientSeedContext,
  opts: { agencyId?: string | null; clientId?: string | null } = {},
): Promise<{ prompts: SeededPrompt[]; cost_usd: number; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { prompts: [], cost_usd: 0, error: 'ANTHROPIC_API_KEY not set' }
  }

  const business = compactJson(ctx)
  const userPrompt = `Business profile:\n${business}\n\nGenerate 40 AEO test prompts following the coverage requirements.`

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
    const inputTokens = msg.usage?.input_tokens || 0
    const outputTokens = msg.usage?.output_tokens || 0
    // Sonnet 4.6 pricing approximated at $3/M input, $15/M output
    const cost_usd = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

    void logTokenUsage({
      feature: 'aeo_visibility_seed',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: opts.agencyId || null,
      metadata: { client_id: opts.clientId },
    })

    const parsed = safeParseJson(raw)
    if (!parsed?.prompts || !Array.isArray(parsed.prompts)) {
      return { prompts: [], cost_usd, error: 'seeder_json_parse_failed' }
    }

    const prompts: SeededPrompt[] = parsed.prompts
      .filter((p: any) => typeof p?.prompt === 'string' && p.prompt.trim())
      .map((p: any) => ({
        prompt: String(p.prompt).trim(),
        category: ['commercial', 'informational', 'comparison', 'local', 'problem'].includes(p.category)
          ? p.category : 'informational',
        intent: String(p.intent || '').slice(0, 80),
      }))
      .slice(0, 40)

    return { prompts, cost_usd }
  } catch (e: any) {
    return { prompts: [], cost_usd: 0, error: e?.message || String(e) }
  }
}

function compactJson(ctx: ClientSeedContext): string {
  const keep: Record<string, string> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string' && v.trim()) keep[k] = v.trim()
  }
  return JSON.stringify(keep, null, 2)
}

function safeParseJson(raw: string): any | null {
  if (!raw) return null
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch { /* fall through */ }
  }
  return null
}
