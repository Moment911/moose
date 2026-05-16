// ─────────────────────────────────────────────────────────────
// Change Classifier — Phase B noise filter
//
// Given a diff between two page snapshots, asks Claude Haiku
// to classify it as one of:
//   meaningful | ab_test | widget | typo | irrelevant
//
// Only `meaningful` changes hit alerts and the events timeline.
// User reclassifications are captured separately for future
// prompt tuning.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { ExtractedPage } from './pageContentExtractor'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 12_000
const MAX_OUTPUT = 400

export type ChangeCategory = 'meaningful' | 'ab_test' | 'widget' | 'typo' | 'irrelevant'
export type ChangeSeverity = 'high' | 'medium' | 'low' | null

export interface ClassifiedChange {
  category: ChangeCategory
  confidence: number          // 0.0-1.0
  reason: string
  severity: ChangeSeverity
  summary: string             // one-line human-readable summary for alerts
  cost_usd: number
  error?: string
}

export interface PageDiff {
  fields_changed: string[]
  prev: Pick<ExtractedPage, 'h1' | 'h2_list' | 'cta_list' | 'hero_copy' | 'body_text' | 'meta_title' | 'meta_description'>
  curr: Pick<ExtractedPage, 'h1' | 'h2_list' | 'cta_list' | 'hero_copy' | 'body_text' | 'meta_title' | 'meta_description'>
}

const SYSTEM_PROMPT = `You are a competitive-intelligence noise filter. Classify a page change so the user only sees signal.

Categories:
- meaningful: a real marketing, product, pricing, or positioning change. Examples: new feature launched, price changed, value-prop rewrite, new CTA copy, journey/funnel restructure, brand repositioning.
- ab_test: minor copy variation that looks like A/B testing. Examples: "Start Free Trial" → "Try Free", small button color/text tweaks.
- widget: third-party widget update. Examples: "4.7 stars (123 reviews)" → "4.7 stars (124 reviews)", "Trusted by 5,000 customers" → "5,100", chat widget version, social-proof counter.
- typo: typo, grammar, or punctuation correction only.
- irrelevant: timestamp, view count, dynamic personalization, randomized testimonial rotation, ad refresh.

If category is 'meaningful', also set severity:
- high: pricing change, new product/feature launch, brand repositioning
- medium: new CTA, hero rewrite, new feature row, journey/funnel change
- low: small copy edit, image swap, minor reorder

Return STRICT JSON only — no markdown, no prose:
{"category":"...","confidence":0.0,"reason":"one short sentence","severity":"high|medium|low|null","summary":"one-line human-readable diff for alerts"}`

export async function classifyChange(
  diff: PageDiff,
  ctx: { url: string; page_type?: string; competitor_domain?: string; clientId?: string; agencyId?: string | null } = { url: '' },
): Promise<ClassifiedChange> {
  const fallback: ClassifiedChange = {
    category: 'meaningful',
    confidence: 0,
    reason: 'classifier unavailable; defaulting to meaningful',
    severity: 'low',
    summary: `Change detected on ${ctx.url}`,
    cost_usd: 0,
    error: 'no_api_key',
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  const userPrompt = [
    `URL: ${ctx.url}`,
    `Page type: ${ctx.page_type || 'unknown'}`,
    `Competitor: ${ctx.competitor_domain || ''}`,
    `Fields changed: ${JSON.stringify(diff.fields_changed)}`,
    '',
    'PREVIOUS:',
    `H1: ${diff.prev.h1}`,
    `Hero: ${(diff.prev.hero_copy || '').slice(0, 300)}`,
    `CTAs: ${JSON.stringify((diff.prev.cta_list || []).slice(0, 10))}`,
    `Body excerpt: ${(diff.prev.body_text || '').slice(0, 800)}`,
    `Meta title: ${diff.prev.meta_title}`,
    '',
    'CURRENT:',
    `H1: ${diff.curr.h1}`,
    `Hero: ${(diff.curr.hero_copy || '').slice(0, 300)}`,
    `CTAs: ${JSON.stringify((diff.curr.cta_list || []).slice(0, 10))}`,
    `Body excerpt: ${(diff.curr.body_text || '').slice(0, 800)}`,
    `Meta title: ${diff.curr.meta_title}`,
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
      feature: 'aeo_page_diff_classifier',
      model: MODEL,
      inputTokens,
      outputTokens,
      agencyId: ctx.agencyId || null,
      metadata: { url: ctx.url, client_id: ctx.clientId },
    })

    const parsed = safeJson(raw)
    if (!parsed?.category) return { ...fallback, cost_usd, error: 'parse_failed' }

    const validCategories: ChangeCategory[] = ['meaningful', 'ab_test', 'widget', 'typo', 'irrelevant']
    const category: ChangeCategory = validCategories.includes(parsed.category) ? parsed.category : 'meaningful'

    const validSev = ['high', 'medium', 'low']
    let severity: ChangeSeverity = null
    if (category === 'meaningful') {
      severity = validSev.includes(parsed.severity) ? parsed.severity : 'medium'
    }

    return {
      category,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reason: String(parsed.reason || '').slice(0, 200),
      severity,
      summary: String(parsed.summary || `Change detected on ${ctx.url}`).slice(0, 260),
      cost_usd,
    }
  } catch (e: any) {
    return { ...fallback, error: e?.message || String(e) }
  }
}

/**
 * Compute the field-level diff between two snapshots — which
 * structured fields differ. Used as input to the classifier.
 */
export function computeFieldDiff(prev: ExtractedPage, curr: ExtractedPage): PageDiff {
  const fields_changed: string[] = []
  if (prev.h1 !== curr.h1) fields_changed.push('h1')
  if (JSON.stringify(prev.h2_list) !== JSON.stringify(curr.h2_list)) fields_changed.push('h2_list')
  if (JSON.stringify(prev.cta_list) !== JSON.stringify(curr.cta_list)) fields_changed.push('cta_list')
  if (prev.hero_copy !== curr.hero_copy) fields_changed.push('hero_copy')
  if (prev.body_text !== curr.body_text) fields_changed.push('body_text')
  if (prev.meta_title !== curr.meta_title) fields_changed.push('meta_title')
  if (prev.meta_description !== curr.meta_description) fields_changed.push('meta_description')

  return {
    fields_changed,
    prev: {
      h1: prev.h1, h2_list: prev.h2_list, cta_list: prev.cta_list,
      hero_copy: prev.hero_copy, body_text: prev.body_text,
      meta_title: prev.meta_title, meta_description: prev.meta_description,
    },
    curr: {
      h1: curr.h1, h2_list: curr.h2_list, cta_list: curr.cta_list,
      hero_copy: curr.hero_copy, body_text: curr.body_text,
      meta_title: curr.meta_title, meta_description: curr.meta_description,
    },
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
