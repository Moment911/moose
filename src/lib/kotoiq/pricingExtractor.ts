// ─────────────────────────────────────────────────────────────
// Pricing Extractor — Phase C seed (used by Phase B page diff)
//
// Specialized extraction for /pricing pages. Given the cleaned
// body text + CTA list from a page snapshot, asks Claude Haiku
// to pull out structured tiers: name, price, billing_cycle,
// features, CTA. Returns {} if the page isn't actually a
// pricing page (e.g. user mis-labeled).
// ─────────────────────────────────────────────────────────────

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 15_000
const MAX_OUTPUT = 1200

export interface PricingTier {
  name: string                   // 'Pro', 'Enterprise', 'Free'
  price: string | null           // '$49' | '$49/mo' | 'Custom' | null
  price_numeric: number | null   // 49 if parseable, else null
  billing_cycle: 'monthly' | 'annual' | 'one_time' | 'usage' | 'custom' | null
  features: string[]
  cta_text: string | null
  is_highlighted: boolean        // 'most popular', 'recommended' tags
}

export interface PricingExtraction {
  is_pricing_page: boolean
  tiers: PricingTier[]
  promo_detected: string | null    // 'Save 20%', '50% off launch', etc.
  free_trial_days: number | null
  cost_usd: number
  error?: string
}

const SYSTEM_PROMPT = `You extract pricing information from a page snapshot.

You will receive: the page H1, hero copy, CTA list, and a body excerpt.

If this isn't actually a pricing/plans page (no prices visible, no tier comparison), set is_pricing_page=false and return tiers=[].

Otherwise, extract every pricing tier as an object with:
- name: the tier label (e.g. "Free", "Pro", "Team", "Enterprise")
- price: the displayed price string (e.g. "$49/mo", "$490/year", "Custom", "Free")
- price_numeric: the numeric value if extractable, else null
- billing_cycle: monthly|annual|one_time|usage|custom|null
- features: up to 12 short feature bullets exactly as listed for that tier
- cta_text: the button text for that tier (e.g. "Start free", "Talk to sales")
- is_highlighted: true if the tier has a "Most popular", "Recommended", "Best value" tag

Also extract:
- promo_detected: any active promo banner like "Save 20% annually" or "Launch pricing — 50% off through May" — null if none
- free_trial_days: integer if a trial length is mentioned (e.g. "14-day free trial" → 14), else null

Return STRICT JSON only (no markdown, no prose):
{"is_pricing_page":true,"tiers":[{...}],"promo_detected":null,"free_trial_days":null}`

export async function extractPricing(
  page: {
    h1: string
    hero_copy: string
    body_text: string
    cta_list: { text: string; href: string }[]
    meta_title: string
  },
  ctx: { url: string; clientId?: string; agencyId?: string | null } = { url: '' },
): Promise<PricingExtraction> {
  const empty: PricingExtraction = { is_pricing_page: false, tiers: [], promo_detected: null, free_trial_days: null, cost_usd: 0 }
  if (!process.env.ANTHROPIC_API_KEY) return { ...empty, error: 'no_api_key' }

  const userPrompt = [
    `URL: ${ctx.url}`,
    `Meta title: ${page.meta_title}`,
    `H1: ${page.h1}`,
    `Hero: ${(page.hero_copy || '').slice(0, 400)}`,
    `CTAs: ${JSON.stringify((page.cta_list || []).slice(0, 20))}`,
    '',
    `Body excerpt (3000 chars):`,
    (page.body_text || '').slice(0, 3000),
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
    const inputTokens = msg.usage?.input_tokens || 0
    const outputTokens = msg.usage?.output_tokens || 0
    const cost_usd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0

    void logTokenUsage({
      feature: 'aeo_pricing_extractor',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: ctx.agencyId || null,
      metadata: { url: ctx.url, client_id: ctx.clientId },
    })

    const parsed = safeJson(raw)
    if (!parsed) return { ...empty, cost_usd, error: 'parse_failed' }

    if (!parsed.is_pricing_page) return { ...empty, cost_usd, is_pricing_page: false }

    const tiers: PricingTier[] = Array.isArray(parsed.tiers)
      ? parsed.tiers
          .filter((t: any) => t?.name)
          .slice(0, 12)
          .map((t: any) => ({
            name: String(t.name).slice(0, 60),
            price: t.price ? String(t.price).slice(0, 60) : null,
            price_numeric: typeof t.price_numeric === 'number' ? t.price_numeric : null,
            billing_cycle: ['monthly', 'annual', 'one_time', 'usage', 'custom'].includes(t.billing_cycle) ? t.billing_cycle : null,
            features: Array.isArray(t.features) ? t.features.slice(0, 12).map((f: any) => String(f).slice(0, 200)) : [],
            cta_text: t.cta_text ? String(t.cta_text).slice(0, 60) : null,
            is_highlighted: !!t.is_highlighted,
          }))
      : []

    return {
      is_pricing_page: true,
      tiers,
      promo_detected: parsed.promo_detected ? String(parsed.promo_detected).slice(0, 200) : null,
      free_trial_days: typeof parsed.free_trial_days === 'number' ? parsed.free_trial_days : null,
      cost_usd,
    }
  } catch (e: any) {
    return { ...empty, error: e?.message || String(e) }
  }
}

function safeJson(raw: string): any | null {
  if (!raw) return null
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return null
}
