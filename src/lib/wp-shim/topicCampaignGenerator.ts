// Topic Campaign Generator — Claude-powered master document builder.
//
// Input: a topic ("Website Design"), client context, optional knobs.
// Output: a TopicCampaignMaster JSON blob with rotation variants per
// section, [koto_*] location tokens inserted, FAQ Q&A optimized for AEO
// (AI search engine extraction), meta title/description templates, and
// a JSON-LD schema template.
//
// The master is stored once and resolved per-city at deploy time via
// resolveMaster() in tokenResolver.ts.

import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import type { TopicCampaignMaster } from './tokenResolver'

export interface GenerateMasterInput {
    topic: string
    /** The business / agency name to use in the page voice. */
    companyName?: string
    /** Phone the [koto_phone] token will resolve to (informs the LLM how to phrase CTAs). */
    phone?: string
    /** Optional pasted-HTML template the page body should fit into. Influences voice + style. */
    htmlWrapperHint?: string
    /** Number of rotation variants per content block. Default 4. Range 2-6. */
    variantsPerSection?: number
    /** Number of FAQs to generate. Default 6. Range 3-10. */
    faqCount?: number
    /** Free-form operator notes (e.g. "emphasize affordable pricing", "B2B tone"). */
    notes?: string
    /** Agency ID for token-usage attribution. */
    agencyId?: string
}

export interface GenerateMasterResult {
    master: TopicCampaignMaster
    raw: string
    inputTokens: number
    outputTokens: number
    model: string
}

const SUPPORTED_TOKENS = [
    '[koto_city]',
    '[koto_state]',
    '[koto_state_abbr]',
    '[koto_zip]',
    '[koto_county]',
    '[koto_population]',
    '[koto_phone]',
    '[koto_phone_link]',
    '[koto_company_name]',
    '[koto_city_state]',
    '[koto_city_state_abbr]',
    '[koto_city_state_zip]',
] as const

export async function generateTopicCampaignMaster(
    ai: Anthropic,
    input: GenerateMasterInput,
): Promise<GenerateMasterResult> {
    const variants = clamp(input.variantsPerSection ?? 4, 2, 6)
    const faqCount = clamp(input.faqCount ?? 6, 3, 10)

    const systemPrompt = `You are a senior SEO + AEO (AI Engine Optimization) strategist. Your job is to produce hyperlocal landing-page content optimized for two outcomes simultaneously:

  1. Traditional SEO ranking (Google, Bing) for "[topic] in [city]" queries
  2. AI search citation (ChatGPT, Perplexity, Claude, Google AI Overviews) — declarative, factual sentences that LLMs can extract verbatim as answers

Hard rules:
- Return ONLY valid JSON matching the schema described. No markdown fences, no commentary.
- Every paragraph variant must be 60-160 words. Vary sentence structure and word choice across variants.
- Insert location tokens naturally: [koto_city], [koto_state], [koto_state_abbr], [koto_county], [koto_zip], [koto_company_name], [koto_phone]. Never invent token names. Use SUPPORTED_TOKENS only: ${SUPPORTED_TOKENS.join(' ')}
- FAQ answers must be declarative, self-contained sentences (AEO-optimized): start with a clear statement, then 1-3 supporting sentences. Avoid "we", "you", "our" in the FIRST sentence — make it factually quotable by an LLM. Example: GOOD — "Website design in [koto_city] typically costs $3,000-$15,000 depending on scope." BAD — "We charge based on scope."
- FAQ questions should follow AnswerThePublic patterns: How, What, Why, When, Where, Can, Should, How much, Is, Best, Top.
- Meta title template: 50-60 chars, must include [koto_city]. Meta description: 140-160 chars, must include [koto_city] and a value proposition.
- JSON-LD schema_jsonld_template: a single JSON object @graph with three @type entries: LocalBusiness, WebPage, FAQPage. Use tokens inside string values where needed. Output as a STRING containing valid JSON (we will JSON.parse it after token resolution).`

    const userPrompt = `Generate a TopicCampaignMaster JSON object for the following:

TOPIC: ${input.topic}
COMPANY_NAME: ${input.companyName || '(operator will provide; use [koto_company_name] token)'}
PHONE: ${input.phone ? `(operator provided — refer to it via [koto_phone] token)` : '(not provided — still include [koto_phone] in CTAs)'}
NOTES: ${input.notes || '(none)'}
${input.htmlWrapperHint ? `STYLE_HINT (operator pasted HTML wrapper — match the implied voice/structure):\n${input.htmlWrapperHint.slice(0, 2000)}` : ''}

Produce a JSON object with this EXACT shape:

{
  "topic": "<topic verbatim>",
  "hero": {
    "headline_variants": [<${variants} strings — each is an H1 headline, 50-80 chars, includes [koto_city] and the topic, varied phrasing>],
    "subheadline_variants": [<${variants} strings — each is a 1-2 sentence supporting paragraph, 30-60 words, includes [koto_city] and [koto_state] and at least one of [koto_company_name] or [koto_phone]>]
  },
  "sections": [
    {
      "heading_template": "<H2 heading with [koto_city] token>",
      "body_variants": [<${variants} strings — paragraphs 80-160 words each, declarative AEO-friendly tone, [koto_city] [koto_state] tokens used naturally>]
    },
    // produce 4 sections covering: (1) Why <topic> matters in [koto_city], (2) What's included in our <topic> service, (3) The process / how it works, (4) Who we serve in [koto_county]/[koto_city]
  ],
  "faqs": [
    {
      "question_template": "<AnswerThePublic-style question with [koto_city]>",
      "answer_variants": [<${variants} strings — each a 40-80 word answer, declarative, AEO-quotable>]
    },
    // produce ${faqCount} FAQs, varied question types (How much, What, Why, When, Can, Best, etc.)
  ],
  "cta": {
    "headline": "<CTA headline 6-12 words, includes [koto_city]>",
    "body": "<CTA body 30-60 words, includes [koto_phone_link] or [koto_phone], strong action verb>"
  },
  "meta": {
    "title_template": "<50-60 chars, includes [koto_city] and [koto_state_abbr] and [koto_company_name]>",
    "description_template": "<140-160 chars, includes [koto_city], value prop, includes [koto_phone] if natural>"
  },
  "schema_jsonld_template": "<STRINGIFIED valid JSON with @context, @graph containing LocalBusiness + WebPage + FAQPage. LocalBusiness must include name ([koto_company_name]), telephone ([koto_phone]), areaServed (city/state). FAQPage must mirror the FAQs above with tokens. The string MUST be valid JSON after [koto_*] tokens are replaced>"
}

Return ONLY the JSON object. No explanation, no markdown.`

    const msg = await ai.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    })

    const inputTokens = msg.usage?.input_tokens || 0
    const outputTokens = msg.usage?.output_tokens || 0

    void logTokenUsage({
        feature: 'kotoiq_topic_campaign_master',
        model: 'claude-sonnet-4-6',
        inputTokens,
        outputTokens,
        agencyId: input.agencyId,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const cleaned = cleanJson(raw)
    let parsed: unknown
    try {
        parsed = JSON.parse(cleaned)
    } catch (err) {
        const m = err instanceof Error ? err.message : 'parse failed'
        throw new Error(`[topicCampaignGenerator] Claude returned non-JSON: ${m}. Raw head: ${cleaned.slice(0, 400)}`)
    }

    const master = parsed as TopicCampaignMaster
    validate(master)

    return {
        master,
        raw,
        inputTokens,
        outputTokens,
        model: 'claude-sonnet-4-6',
    }
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n))
}

function cleanJson(raw: string): string {
    let s = raw.trim()
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    return s.trim()
}

function validate(m: TopicCampaignMaster): void {
    const errs: string[] = []
    if (!m.topic) errs.push('missing topic')
    if (!m.hero?.headline_variants?.length) errs.push('missing hero.headline_variants')
    if (!m.hero?.subheadline_variants?.length) errs.push('missing hero.subheadline_variants')
    if (!Array.isArray(m.sections) || m.sections.length === 0) errs.push('missing sections')
    if (!Array.isArray(m.faqs) || m.faqs.length === 0) errs.push('missing faqs')
    if (!m.cta?.headline || !m.cta?.body) errs.push('missing cta')
    if (!m.meta?.title_template || !m.meta?.description_template) errs.push('missing meta')
    for (const [i, s] of (m.sections || []).entries()) {
        if (!s.heading_template) errs.push(`sections[${i}] missing heading_template`)
        if (!Array.isArray(s.body_variants) || s.body_variants.length === 0) {
            errs.push(`sections[${i}] missing body_variants`)
        }
    }
    for (const [i, f] of (m.faqs || []).entries()) {
        if (!f.question_template) errs.push(`faqs[${i}] missing question_template`)
        if (!Array.isArray(f.answer_variants) || f.answer_variants.length === 0) {
            errs.push(`faqs[${i}] missing answer_variants`)
        }
    }
    if (errs.length) {
        throw new Error(`[topicCampaignGenerator] master validation failed: ${errs.join('; ')}`)
    }
}
