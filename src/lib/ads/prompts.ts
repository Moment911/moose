// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Prompt templates for all LLM tasks
// Each function returns the rendered prompt with input JSON embedded
// ─────────────────────────────────────────────────────────────

import { PPC_HEURISTICS, AD_PLATFORM_SPECS } from './knowledge'

function wrap(input: unknown): string {
  return JSON.stringify(input, null, 2)
}

// ── classify_search_term ──────────────────────────────────────

export function classifySearchTermPrompt(input: unknown): string {
  return `You are classifying a single Google Ads search term for relevance to a specific business.

INPUT:
${wrap(input)}

TASK:
Decide whether this search term is relevant to the business described in account_context.

Output strict JSON matching this shape:
{
  "intent": "informational" | "commercial" | "transactional" | "navigational" | "brand" | "irrelevant",
  "is_relevant_to_business": true | false,
  "confidence": <number 0..1>,
  "reason_one_sentence": "<one sentence>"
}

GUIDELINES:
- is_relevant_to_business: true only if a person searching this term could plausibly become a customer.
- intent: informational (wants to learn), commercial (comparing), transactional (ready to buy), navigational (specific brand), brand (own brand), irrelevant (unrelated).
- If the term is clearly off-topic (job seekers for software, "free" for paid-only), mark irrelevant.
- confidence should reflect ambiguity. High-intent exact match = 0.95+. Ambiguous short term = 0.4-0.6.

Return ONLY the JSON object, no preamble.`
}

// ── recommend_negatives ───────────────────────────────────────

export function recommendNegativesPrompt(input: unknown): string {
  return `You are a paid search analyst recommending negative keywords for a Google Ads account.

INPUT:
${wrap(input)}

${PPC_HEURISTICS}

TASK:
For each candidate search term, decide whether it should become a negative keyword. Each candidate has spent money with zero conversions and at least 5 clicks.

For each recommended negative, decide:
1. add_as — match type: exact (one specific phrase), phrase (recurring substring across many irrelevants), broad (rarely; only when totally off-topic)
2. scope: account (never trigger any campaign), campaign (might be relevant elsewhere), ad_group (might be relevant in sibling ad group)
3. estimated_monthly_savings_usd: project the spend over a full month based on the candidate's run rate.

OUTPUT JSON:
{
  "recommendations": [
    { "search_term": "...", "add_as": "exact"|"phrase"|"broad", "scope": "account"|"campaign"|"ad_group", "reason": "<short>", "confidence": 0..1, "estimated_monthly_savings_usd": <number> }
  ],
  "notes": "<optional: candidates you skipped and why>"
}

CONSERVATISM RULES:
- Default to exact match when uncertain.
- Don't recommend phrase for short common words without strong evidence.
- If a candidate could plausibly convert (longer-tail commercial query), exclude it.

Return ONLY the JSON object.`
}

// ── recommend_new_keywords ────────────────────────────────────

export function recommendNewKeywordsPrompt(input: unknown): string {
  return `You are a senior paid search strategist proposing new keywords based on intent gaps between Search Console (organic) and Google Ads (paid).

INPUT:
${wrap(input)}

TASK:
Recommend the 10–25 highest-value keywords to add. Prioritize:
1. Commercial/transactional intent over informational
2. High GSC impressions with poor average position (>10)
3. Themes that align with existing converting ad groups
4. Match types that respect intent: exact for high-intent, phrase for thematic

For each, output: keyword, match_type, proposed_ad_group_id (or "NEW:<theme>"), intent, rationale (cite GSC impressions), estimated_monthly_clicks, estimated_cpc_usd, priority (high/medium/low).

OUTPUT JSON:
{
  "recommendations": [...],
  "themes_observed": ["<theme 1>", ...]
}

Don't recommend keywords already in existing_keywords_sample (case-insensitive). Don't recommend pure informational unless client values top-of-funnel. Don't recommend competitor brands unless explicitly stated.

Return ONLY the JSON object.`
}

// ── google_rsa ────────────────────────────────────────────────

export function googleRSAPrompt(input: unknown): string {
  return `You are writing a Google Responsive Search Ad (RSA).

${AD_PLATFORM_SPECS}

INPUT:
${wrap(input)}

CHARACTER LIMITS (HARD):
- Headlines: max 30 characters each. 15 headlines required.
- Descriptions: max 90 characters each. 4 descriptions required.
- Path1/Path2: max 15 chars each.

HEADLINE MIX (across 15): 4-5 benefit, 2-3 feature, 2-3 cta, 1-2 brand, 1-2 social_proof, 1-2 urgency.

PINNING: Pin one brand headline to position 1, one CTA to position 3. Leave most unpinned.

DESCRIPTIONS: Desc 1 = lead benefit + CTA (pin to 1). Desc 2 = differentiation/social proof. Desc 3-4 = secondary benefits.

At least 4 headlines should include a must_include_keyword. Follow brand_voice_md strictly. Never use forbidden_phrases.

OUTPUT JSON:
{
  "headlines": [{"text":"...","pin":1|2|3|null,"category":"benefit|feature|cta|brand|social_proof|urgency"}, ... 15 entries],
  "descriptions": [{"text":"...","pin":1|2|null}, ... 4 entries],
  "final_url": "<from input>",
  "path1": "...", "path2": "...",
  "rationale": "<2-3 sentences>"
}

VALIDATION: 15 headlines each ≤30 chars, 4 descriptions each ≤90 chars, at least 1 pinned to position 1, no forbidden phrases.

Return ONLY the JSON object.`
}

// ── meta_ad ───────────────────────────────────────────────────

export function metaAdPrompt(input: unknown): string {
  return `You are creating Facebook/Instagram ad creative. Output 3–5 distinct variants with materially different angles.

${AD_PLATFORM_SPECS}

INPUT:
${wrap(input)}

PER-VARIANT: primary_text (max 125 chars, hook in first 40), headline (max 40 chars), description (max 30 chars), cta (Learn More/Shop Now/Sign Up/Get Offer/Book Now/Subscribe/Download/Contact Us/Apply Now/Get Quote), creative_brief (2-3 sentences for designer), hook_concept (one-line angle description).

ANGLE DIVERSITY (pick different ones): Problem/agitation/solution, Social proof, Pattern interrupt, Demonstration, Direct offer/urgency, Founder/behind the scenes.

OBJECTIVE-AWARE TONE: awareness/traffic = curiosity-driven; engagement = provocative; leads = value exchange; sales = specific offer + urgency.

Also suggest 3-5 Meta interest/behavior targeting ideas.

OUTPUT JSON:
{
  "variants": [{ "primary_text": "...", "headline": "...", "description": "...", "cta": "...", "creative_brief": "...", "hook_concept": "..." }, ...],
  "audience_targeting_suggestions": [...],
  "rationale": "..."
}

Return ONLY the JSON object.`
}

// ── linkedin_ad ───────────────────────────────────────────────

export function linkedInAdPrompt(input: unknown): string {
  return `You are creating LinkedIn ad creative for B2B audiences. Professional but human tone. 3–5 variants with distinct angles.

${AD_PLATFORM_SPECS}

INPUT:
${wrap(input)}

PER-VARIANT: intro_text (max 150 chars, front-load hook), headline (max 70 chars), description (max 100 chars), cta (Learn More/Download/Register/Sign Up/Apply/Visit Website/View Quote/Get Started).

ANGLES TO ROTATE: Industry-specific pain, Peer benchmark, Tool/framework reveal, Counter-narrative, Outcome story.

DON'TS: No "Are you tired of..." openings. No clickbait headlines. No generic phrases. No overselling.

OUTPUT JSON:
{
  "variants": [{ "intro_text": "...", "headline": "...", "description": "...", "cta": "..." }, ...],
  "rationale": "..."
}

Return ONLY the JSON object.`
}

// ── tiktok_ad ─────────────────────────────────────────────────

export function tiktokAdPrompt(input: unknown): string {
  return `You are creating TikTok ad creative. Must feel native — like UGC, not a polished commercial. First 3 seconds decide everything.

${AD_PLATFORM_SPECS}

INPUT:
${wrap(input)}

PER-VARIANT: hook_first_3_seconds (literal words in first 3 sec), script_outline (4-8 beats), on_screen_text (2-5 overlays), sound_or_music_concept, caption (max 150 chars, 1-3 hashtags), cta.

HOOK PATTERNS: Pattern interrupt, POV/relatable, Surprising stat, Demonstration tease, Listicle promise, Confession/contrarian.

Each variant must use a DIFFERENT hook pattern. Handheld/selfie aesthetic. No brand name/logo first. No stock footage. Write like a real person.

OUTPUT JSON:
{
  "variants": [{ "hook_first_3_seconds": "...", "script_outline": [...], "on_screen_text": [...], "sound_or_music_concept": "...", "caption": "...", "cta": "..." }, ...],
  "rationale": "..."
}

Return ONLY the JSON object.`
}

// ── explain_anomaly ───────────────────────────────────────────

export function explainAnomalyPrompt(input: unknown): string {
  return `You are a senior PPC analyst explaining a sudden change in a Google Ads metric. Keep the explanation grounded in data — do not speculate beyond it.

INPUT:
${wrap(input)}

REASONING:
1. Look at contributors first — if 1-2 entities account for >70% of deviation, the cause is concentrated.
2. Cross-reference recent_changes — configuration changes near the anomaly date are almost always the cause.
3. Check ga4_correlation — if Ads cost spiked but GA4 paid sessions didn't move, suspect tracking issue.
4. Consider auction dynamics last (new competitor, seasonality).

OUTPUT JSON:
{
  "most_likely_cause": "<one phrase>",
  "confidence": 0..1,
  "alternative_causes": ["...", "..."],
  "recommended_actions": [{ "action": "...", "urgency": "immediate"|"this_week"|"monitor" }],
  "one_paragraph_explanation": "<3-5 sentences for the client. Plain English.>"
}

URGENCY: immediate = broken/burning money (>$500/day excess). this_week = inefficient. monitor = may resolve.
CONFIDENCE: 0.9+ = clear evidence. 0.6-0.8 = contributors clear, no matching change. 0.4-0.6 = multiple causes. <0.4 = say so.

Return ONLY the JSON object.`
}

// ── weekly_summary ────────────────────────────────────────────

export function weeklySummaryPrompt(input: unknown): string {
  return `You are writing the executive summary for a weekly Google Ads + cross-channel report. Audience: client's marketing lead — busy, smart, wants signal not noise.

INPUT:
${wrap(input)}

OUTPUT JSON:
{
  "headline": "<one sentence, ~12 words, lead with the most important number>",
  "executive_summary_md": "<2-3 short paragraphs. First: what happened. Second: why. Third: what's next.>",
  "wins": ["<3-5 specific wins>"],
  "concerns": ["<3-5 specific concerns>"],
  "next_week_priorities": ["<3-5 actions>"]
}

RULES:
- Specific, not generic. Include numbers.
- Lead with numbers. Most sentences should contain a metric.
- No filler. No "We are pleased to report."
- Honest about losses.
- Use ONLY numbers from the input. Don't invent.
- wins/concerns must reference real entities from input.
- next_week_priorities must be actionable.
- If alerts_count > 0, mention in concerns.
- If wasted_spend_total_usd > 100, surface in concerns.
- If pending_recommendations_count > 5, mention as priority.

Return ONLY the JSON object.`
}

// ── period_comparison ─────────────────────────────────────────

export function periodComparisonPrompt(input: unknown): string {
  return `You are writing a narrative comparison of two time periods for a Google Ads account.

INPUT:
${wrap(input)}

OUTPUT JSON:
{
  "narrative_md": "<3-5 paragraphs in Markdown>",
  "key_takeaways": ["<3-5 takeaways>"]
}

STRUCTURE:
1. Topline — account-level change in cost, conversions, CPA, ROAS.
2. Winners — which campaigns/keywords improved most. Specific names and numbers.
3. Losers — which got worse. Specific names and numbers.
4. Patterns — concentrated or distributed? Flagged entities clustered?
5. What this implies — 1-2 sentences of strategic interpretation.

FLAGS: efficiency_drop = cost up >50% but conversions up <10%. efficiency_gain = cost down >25% but conversions up >10%.

Reference entities by actual names. Cite numbers with units. Don't speculate on invisible causes.

Return ONLY the JSON object.`
}

// ── label_cluster ─────────────────────────────────────────────

export function labelClusterPrompt(input: unknown): string {
  return `You are labeling a cluster of related search terms.

INPUT:
${wrap(input)}

TASK: Given the sample terms, produce:
- label: 2-4 word descriptive label (describe user's NEED, not marketer's product)
- intent: informational | commercial | transactional | navigational | brand | irrelevant
- one_line_summary: single sentence describing what users searching this cluster want

If the cluster is incoherent, set label to "Mixed / Unclear".

OUTPUT JSON:
{ "label": "...", "intent": "...", "one_line_summary": "..." }

Return ONLY the JSON object.`
}

// ── Prompt registry ───────────────────────────────────────────

export const PROMPT_REGISTRY: Record<string, (input: unknown) => string> = {
  classify_search_term: classifySearchTermPrompt,
  recommend_negatives: recommendNegativesPrompt,
  recommend_new_keywords: recommendNewKeywordsPrompt,
  generate_ad_copy_google: googleRSAPrompt,
  generate_ad_copy_meta: metaAdPrompt,
  generate_ad_copy_linkedin: linkedInAdPrompt,
  generate_ad_copy_tiktok: tiktokAdPrompt,
  explain_anomaly: explainAnomalyPrompt,
  weekly_executive_summary: weeklySummaryPrompt,
  period_comparison_narrative: periodComparisonPrompt,
  label_cluster: labelClusterPrompt,
}
