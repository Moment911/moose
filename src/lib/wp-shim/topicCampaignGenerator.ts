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
    /** Optional pre-rendered competitor context block — top SERP results
     *  + H1/H2/word-count signal — that Claude uses to take deliberately
     *  differentiated angles. Built by competitorContext.ts. */
    competitorContext?: string
    /** Related subtopics (from topical_expand) to weave into the FAQs +
     *  sections so the page builds topical authority around the cluster. */
    topicalCluster?: string[]
    /** E-E-A-T audit gaps to specifically address on a regeneration pass.
     *  Each is a directive like "authoritativeness: no citations → add cited
     *  stats". Claude addresses them in the copy WITHOUT fabricating facts. */
    improvementDirectives?: string[]
    /** Operator-supplied real info (author name, credentials, address, etc.)
     *  to weave into the copy for concrete E-E-A-T signals. */
    eeatInfo?: string
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

/** Exported so generate_master_compare can reuse the same prompt across providers. */
export function buildMasterPrompt(input: GenerateMasterInput): { system: string; user: string } {
    const variants = clamp(input.variantsPerSection ?? 4, 2, 6)
    const faqCount = clamp(input.faqCount ?? 6, 3, 10)

    const system = `You are a senior SEO + AEO (AI Engine Optimization) strategist. Your job is to produce hyperlocal landing-page content optimized for THREE outcomes simultaneously:

  1. Traditional SEO ranking (Google, Bing) for "<topic> <city>" queries
  2. AI search citation (ChatGPT, Perplexity, Claude, Google AI Overviews) — declarative, factual sentences that LLMs can extract verbatim
  3. RankMath / Yoast on-page audit score — the page must pass keyword-placement checks out of the box

The page will be deployed to many cities. The "focus keyword" for each deployed page is "<topic> [koto_city]" — for example "Website Design Austin". Every content choice below must serve that exact focus keyword landing in the right places.

RankMath on-page checklist — your output MUST satisfy ALL of these:
- Focus keyword in H1: every hero.headline_variant MUST contain BOTH the topic noun-phrase AND [koto_city]. Not just one. Both.
- Focus keyword in first paragraph: the FIRST sentence of EVERY hero.subheadline_variant AND the FIRST sentence of the FIRST section's body_variants MUST contain the topic word AND [koto_city].
- Focus keyword in H2: every section.heading_template MUST contain BOTH the topic noun-phrase AND [koto_city] or [koto_city_state]. Examples: "<Topic> Services in [koto_city]", "Why Choose [koto_city] <Topic>", "<Topic> Process in [koto_city], [koto_state]".
- Focus keyword density: across each section's body, mention the topic noun-phrase 2-4 times AND [koto_city] 2-3 times. Natural language — never keyword-stuff.
- Focus keyword in meta description: title 50-60 chars, MUST include topic + [koto_city]. Description 140-160 chars, MUST include topic + [koto_city] in the first 100 chars.
- Content length: every body_variant must be 100-180 words (longer side of the original 60-160 range so total page hits 800+ words).
- FAQs must include the focus keyword: every FAQ question_template MUST contain the topic word OR [koto_city]. Aim for 50/50 split (half mention topic, half mention city).

Hard rules — applies to ALL content:
- Return ONLY valid JSON matching the schema described. No markdown fences, no commentary.
- Vary sentence structure and word choice across variants. Never produce two variants that share more than 30% of the same sentences.
- Insert location tokens naturally: [koto_city], [koto_state], [koto_state_abbr], [koto_county], [koto_zip], [koto_company_name], [koto_phone]. Never invent token names. Use SUPPORTED_TOKENS only: ${SUPPORTED_TOKENS.join(' ')}
- FAQ answers must be declarative, self-contained sentences (AEO-optimized): start with a clear statement, then 1-3 supporting sentences. Avoid "we", "you", "our" in the FIRST sentence — make it factually quotable by an LLM. Example: GOOD — "Website design in [koto_city] typically costs $3,000-$15,000 depending on scope." BAD — "We charge based on scope."
- FAQ questions should follow AnswerThePublic patterns: How, What, Why, When, Where, Can, Should, How much, Is, Best, Top.
- JSON-LD schema_jsonld_template: a single JSON object with @context and @graph containing three @type entries: LocalBusiness, WebPage, FAQPage. Use tokens inside string values where needed. Output as a STRING containing valid JSON (we will JSON.parse it after token resolution).`

    const user = `Generate a TopicCampaignMaster JSON object for the following:

TOPIC: ${input.topic}
COMPANY_NAME: ${input.companyName || '(operator will provide; use [koto_company_name] token)'}
PHONE: ${input.phone ? `(operator provided — refer to it via [koto_phone] token)` : '(not provided — still include [koto_phone] in CTAs)'}
NOTES: ${input.notes || '(none)'}
${input.competitorContext ? `\n${input.competitorContext}\n` : ''}
${input.topicalCluster?.length ? `\nTOPICAL CLUSTER — the FAQs and sections must COLLECTIVELY touch these related subtopics so the page builds topical authority around the theme. Weave them in naturally (a FAQ here, a section angle there) — do NOT just list them:\n- ${input.topicalCluster.slice(0, 12).join('\n- ')}\n` : ''}
${input.improvementDirectives?.length ? `\nREVISION DIRECTIVES — this is a regeneration to close specific E-E-A-T gaps found by an audit. Address each where it fits naturally in the copy (cite concrete specifics, add experience/authority signals). CRITICAL: do NOT fabricate facts, statistics, client names, results, or testimonials — those are filled from real operator/Google data elsewhere. Improve the WRITING toward these goals, not by inventing data:\n- ${input.improvementDirectives.slice(0, 12).join('\n- ')}\n` : ''}
${input.eeatInfo ? `\nVERIFIED BUSINESS INFO (operator-supplied, use these real details for E-E-A-T signals — weave into author byline, about section, trust signals, credentials):\n${input.eeatInfo}\n` : ''}
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
  "direct_answer_template": "<40-60 word self-contained answer paragraph rendered above the hero. Treat as the page's TL;DR — purpose-written to be lifted verbatim into AI search answer cards (Perplexity, ChatGPT Search, Google AI Overviews). MUST contain the topic word AND [koto_city]. Open with a declarative sentence, no 'we' / 'you' / 'our' in the first sentence.>",
  "howto": {
    "title_template": "<H2 heading like 'How to Choose <Topic> in [koto_city]' or 'How <Topic> Works in [koto_city]'>",
    "steps": [
      { "name_template": "<step 1 short name>", "text_template": "<step 1 description, 25-50 words, includes [koto_city] in 1-2 of the 5 steps>" },
      { "name_template": "<step 2 short name>", "text_template": "<step 2 description>" },
      { "name_template": "<step 3 short name>", "text_template": "<step 3 description>" },
      { "name_template": "<step 4 short name>", "text_template": "<step 4 description>" },
      { "name_template": "<step 5 short name>", "text_template": "<step 5 description>" }
    ]
  },
  "comparison": {
    "title_template": "<H2 heading like 'Local vs. National <Topic> in [koto_city]'>",
    "columns": ["", "Local [koto_city] Agency", "National Provider"],
    "rows": [
      { "label_template": "<dimension 1, e.g. 'Response time'>", "cells_template": ["<local advantage>", "<national tradeoff>"] },
      { "label_template": "<dimension 2, e.g. 'Knowledge of [koto_city] market'>", "cells_template": ["<local advantage>", "<national tradeoff>"] },
      { "label_template": "<dimension 3, e.g. 'Pricing transparency'>", "cells_template": ["<local advantage>", "<national tradeoff>"] },
      { "label_template": "<dimension 4>", "cells_template": ["<local advantage>", "<national tradeoff>"] },
      { "label_template": "<dimension 5>", "cells_template": ["<local advantage>", "<national tradeoff>"] }
    ]
  },
  "schema_jsonld_template": "<STRINGIFIED valid JSON with @context, @graph containing LocalBusiness + WebPage + FAQPage. LocalBusiness must include name ([koto_company_name]), telephone ([koto_phone]), areaServed (city/state). FAQPage must mirror the FAQs above with tokens. The string MUST be valid JSON after [koto_*] tokens are replaced. Note: WebPage Speakable + Service entity + HowTo + Dataset are appended automatically at deploy time, you do NOT need to include them here.>"
}

Return ONLY the JSON object. No explanation, no markdown.`

    return { system, user }
}

export async function generateTopicCampaignMaster(
    ai: Anthropic,
    input: GenerateMasterInput,
): Promise<GenerateMasterResult> {
    const { system: systemPrompt, user: userPrompt } = buildMasterPrompt(input)

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

// Pull the most-likely-parseable JSON string out of a model's raw output.
// Models (Claude especially) wrap JSON in ```json fences AND add prose before
// or after the block. The old anchored ^``` / ```$ stripping only worked when
// the output was EXACTLY a fenced block — any preamble defeated it and the
// parse threw "invalid JSON". This handles fences anywhere + an outermost-brace
// fallback. Returns a best-effort string; the caller still parses + validates.
function cleanJson(raw: string): string {
    let s = (raw || '').trim()
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) s = fenced[1].trim()
    if (!s.startsWith('{')) {
        const first = s.indexOf('{')
        const last = s.lastIndexOf('}')
        if (first !== -1 && last > first) s = s.slice(first, last + 1)
    }
    return s.trim()
}

/**
 * Non-throwing master JSON parser for the multi-model compare path. Tries the
 * raw string, then the fenced block, then the outermost {...} — so prose
 * before/after the JSON (or a trailing brace after stray text) still recovers.
 * Returns null when nothing parses, so the caller can mark that arm failed
 * without tanking the whole compare request.
 */
export function parseMasterJson(raw: string): any | null {
    if (!raw) return null
    const s = raw.trim()
    const candidates: string[] = [s]
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) candidates.push(fenced[1].trim())
    const first = s.indexOf('{')
    const last = s.lastIndexOf('}')
    if (first !== -1 && last > first) candidates.push(s.slice(first, last + 1))
    for (const c of candidates) {
        try { return JSON.parse(c) } catch { /* try next candidate */ }
    }
    return null
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
