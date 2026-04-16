// ─────────────────────────────────────────────────────────────
// Semantic SEO Processing Agents — KotoIQ
//
// Four specialized Claude prompt pipelines that improve semantic
// SEO quality during page brief generation and full page writing.
//
// Agents:
// 1. Query Gap Analyzer — query network mapping + competitor gaps
// 2. Frame Semantics Analyzer — conceptual frame coverage
// 3. Semantic Role Labeler — sentence-level optimization
// 4. Named Entity Suggester — topical authority signals
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

// ── Shared Types ──────────────────────────────────────────────

export interface QueryGapResult {
  primary_angle: string
  context_signifiers: string[]
  competitor_gaps: string[]
  recommended_h2_order: string[]
  commercial_opportunities: string[]
  query_network: string[]
}

export interface FrameResult {
  frame_name: string
  frame_elements: {
    element: string
    importance: string
    covered_by_competitors: boolean
    your_coverage: string
  }[]
  missing_critical: string[]
  competitive_advantage_elements: string[]
}

export interface RoleLabelResult {
  optimized_sentences: {
    original: string
    optimized: string
    reason: string
    weight_shift: string
  }[]
  predicate_suggestions: {
    current: string
    suggested: string
    context_impact: string
  }[]
}

export interface EntityResult {
  entities: {
    name: string
    type: string
    priority: string
    context: string
  }[]
  missing_critical: string[]
}

// ── Helpers ───────────────────────────────────────────────────

function parseJsonFromResponse(raw: string): any {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

function extractText(msg: any): string {
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
}

// ── Agent 1: Query Gap Analyzer ──────────────────────────────

export async function runQueryGapAnalyzer(
  ai: AI,
  params: {
    keyword: string
    industry: string
    business_name: string
    existing_keywords?: string[]
    competitor_pages?: { url: string; content_snippet: string }[]
    agencyId?: string
  },
): Promise<QueryGapResult> {
  const competitorContext = params.competitor_pages?.length
    ? `\n\nCompetitor pages to analyze:\n${params.competitor_pages.map(p => `URL: ${p.url}\nSnippet: ${p.content_snippet}`).join('\n---\n')}`
    : ''

  const existingContext = params.existing_keywords?.length
    ? `\n\nKeywords already targeted by this business: ${params.existing_keywords.join(', ')}`
    : ''

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a semantic SEO query network analyst. Your task is to deconstruct the query space around a target keyword and identify strategic gaps.

Core analytical framework:
- QUERY NETWORK MAPPING: Every keyword exists within a network of semantically related queries. These form contextual vectors — directional relationships between concepts that search engines use to understand topical coverage. Map the full network of queries that share semantic proximity with the target keyword.
- CONTEXT SIGNIFIERS: These are the concepts, entities, and terms that MUST appear in content targeting this keyword for search engines to classify the page correctly. They are the minimum viable semantic footprint. Without them, the page lacks the contextual density needed to rank.
- SEMANTIC DISTANCE: Measure how far competitor content drifts from the core topic. Pages that maintain tight semantic distance (staying close to the primary contextual vector) outperform pages that dilute across loosely related subtopics.
- TERM WEIGHT CALCULATION: Not all related terms carry equal weight. Primary context signifiers (terms that appear in 80%+ of ranking pages) carry more weight than secondary modifiers. Identify which terms carry disproportionate ranking signal.
- COMMERCIAL INTENT GAPS: Within any query network, some contextual vectors have high commercial value (purchase intent, comparison intent, specification intent) but low competitive density. These are the angles worth targeting.

Return ONLY valid JSON matching this structure:
{
  "primary_angle": "The optimal content angle — the specific contextual vector that balances search volume, commercial intent, and competitive gap",
  "context_signifiers": ["terms/concepts that MUST appear for topical relevance"],
  "competitor_gaps": ["specific topical angles competitors miss or cover weakly"],
  "recommended_h2_order": ["H2 headings in optimal semantic flow order — each heading should build contextual momentum for the next"],
  "commercial_opportunities": ["high-value query intents with low competition"],
  "query_network": ["the full network of semantically proximate queries"]
}`,
    messages: [{
      role: 'user',
      content: `Analyze the query network for "${params.keyword}" in the ${params.industry} industry.
Business: ${params.business_name}${existingContext}${competitorContext}

Identify the complete query network, critical context signifiers, competitor gaps, and the optimal content angle. Focus on finding high-value commercial opportunities with low competitive density.`,
    }],
  })

  void logTokenUsage({
    feature: 'kotoiq_semantic_agent_query_gap',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: params.agencyId,
  })

  return parseJsonFromResponse(extractText(msg))
}

// ── Agent 2: Frame Semantics Analyzer ────────────────────────

export async function runFrameAnalyzer(
  ai: AI,
  params: {
    keyword: string
    page_content?: string
    competitor_contents?: string[]
    agencyId?: string
  },
): Promise<FrameResult> {
  const contentContext = params.page_content
    ? `\n\nExisting page content to evaluate:\n${params.page_content.substring(0, 4000)}`
    : '\n\nNo existing content — this analysis is for brief generation (pre-writing).'

  const competitorContext = params.competitor_contents?.length
    ? `\n\nCompetitor content snippets:\n${params.competitor_contents.map((c, i) => `--- Competitor ${i + 1} ---\n${c.substring(0, 2000)}`).join('\n')}`
    : ''

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a frame semantics analyst specializing in search engine content evaluation.

Frame semantics is the theory that words evoke conceptual structures (frames) — interconnected networks of meaning that define how a topic is understood. Search engines use frame completeness as a quality signal: content that activates all expected frame elements for a topic demonstrates deeper expertise than content that only touches surface-level terms.

Your analytical framework:
- FRAME IDENTIFICATION: Every keyword activates a primary semantic frame — the conceptual structure that groups all related meanings. For "emergency plumber," the frame includes: urgency, locality, credibility, pricing, response_time, availability, licensing, insurance, emergency_types, assessment_process. Identify the complete frame.
- FRAME ELEMENT CLASSIFICATION: Each element has a different importance level:
  * CRITICAL: Elements without which the frame is fundamentally incomplete. Search engines expect these on every quality page for this topic. Missing critical elements signal thin content.
  * IMPORTANT: Elements that differentiate thorough coverage from basic coverage. Present on most top-ranking pages.
  * SUPPORTING: Elements that add depth and demonstrate genuine expertise. Present on best-in-class pages.
- ENTITY-ATTRIBUTE PAIRS: Within each frame element, identify the specific entity-attribute relationships that should be expressed. For "licensing" in a plumber frame: (plumber, holds_license), (license, issued_by_state), (license, verifiable). These pairs form the semantic substrate that search engines parse.
- RELEVANCE PROPAGATION: Frame elements are not independent — they propagate relevance to each other. Coverage of "licensing" strengthens the "credibility" element. Map these propagation paths.
- COMPETITOR FRAME COVERAGE: Analyze which frame elements competitors cover and which they neglect. Uncovered critical elements represent the highest-impact content opportunities.

Return ONLY valid JSON matching this structure:
{
  "frame_name": "Name of the semantic frame",
  "frame_elements": [
    {
      "element": "frame element name",
      "importance": "critical|important|supporting",
      "covered_by_competitors": true/false,
      "your_coverage": "missing|partial|complete"
    }
  ],
  "missing_critical": ["critical frame elements missing from your content"],
  "competitive_advantage_elements": ["frame elements you can cover better than competitors"]
}

For "your_coverage": if no existing page content is provided, mark all as "missing" — this is pre-writing analysis.`,
    messages: [{
      role: 'user',
      content: `Analyze the semantic frame for the keyword: "${params.keyword}"${contentContext}${competitorContext}

Identify every frame element, classify by importance, assess competitor coverage, and determine which elements represent the biggest opportunities.`,
    }],
  })

  void logTokenUsage({
    feature: 'kotoiq_semantic_agent_frame',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: params.agencyId,
  })

  return parseJsonFromResponse(extractText(msg))
}

// ── Agent 3: Semantic Role Labeler ───────────────────────────

export async function runSemanticRoleLabeler(
  ai: AI,
  params: {
    keyword: string
    sentences: string[]
    primary_entity: string
    agencyId?: string
  },
): Promise<RoleLabelResult> {
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a semantic role labeling specialist for SEO content optimization.

Semantic role labeling (SRL) identifies WHO does WHAT to WHOM in each sentence. Search engines parse these subject-predicate-object relationships to determine which entity carries the most semantic weight on a page. If your target keyword or business name is consistently in the object position (being acted upon) rather than the agent position (performing actions), the page signals weaker topical authority.

Your analytical framework:
- AGENT-PATIENT ANALYSIS: In every sentence, identify:
  * AGENT (who/what performs the action)
  * PREDICATE (the action/relationship)
  * PATIENT (who/what receives the action)
  * INSTRUMENT/MANNER (how the action is performed)
  The primary entity should predominantly occupy the AGENT role for authority signals.

- SEMANTIC WEIGHT DISTRIBUTION: The entity in the agent position carries approximately 2-3x more semantic weight than the patient position. If the target keyword appears mostly as an object ("when you need [keyword]", "[keyword] is offered by..."), restructure so it leads the semantic relationship ("[keyword] provides...", "[keyword] eliminates...").

- PREDICATE SELECTION: Verbs are context signals. Weak predicates (is, has, offers, provides) carry minimal semantic differentiation. Strong predicates (eliminates, transforms, prevents, guarantees, certifies) activate richer contextual vectors and signal deeper topical coverage. Each predicate choice shifts the contextual vector of the sentence.

- CONTEXTUAL VECTOR ALIGNMENT: Each sentence should push the overall contextual vector toward the target topic. Sentences where the primary entity is passive or where generic predicates are used create semantic noise — they dilute the page's topical signal rather than strengthening it.

- WEIGHT SHIFT DOCUMENTATION: For each optimization, document what changed in terms of semantic weight. Example: "Moved [entity] from patient to agent position, replaced weak predicate 'has' with domain-specific 'certifies' — shifts contextual vector from generic description toward authority signal."

Return ONLY valid JSON matching this structure:
{
  "optimized_sentences": [
    {
      "original": "the original sentence",
      "optimized": "the restructured sentence",
      "reason": "why this restructuring improves semantic signal",
      "weight_shift": "what changed in terms of entity weight and contextual vector"
    }
  ],
  "predicate_suggestions": [
    {
      "current": "weak verb currently used",
      "suggested": "stronger domain-specific verb",
      "context_impact": "how this verb change affects the contextual signal"
    }
  ]
}

Only include sentences that actually need changes. If a sentence already has optimal structure, omit it from the output.`,
    messages: [{
      role: 'user',
      content: `Target keyword: "${params.keyword}"
Primary entity (should carry the most semantic weight): "${params.primary_entity}"

Analyze these sentences for semantic role optimization:

${params.sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

For each sentence: identify the agent-patient structure, determine if the primary entity carries sufficient semantic weight, and suggest restructuring where needed. Also identify weak predicates that should be replaced with stronger, domain-specific alternatives.`,
    }],
  })

  void logTokenUsage({
    feature: 'kotoiq_semantic_agent_role_labeler',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: params.agencyId,
  })

  return parseJsonFromResponse(extractText(msg))
}

// ── Agent 4: Named Entity Suggester ──────────────────────────

export async function runNamedEntitySuggester(
  ai: AI,
  params: {
    keyword: string
    industry: string
    location?: string
    business_name: string
    existing_entities?: string[]
    agencyId?: string
  },
): Promise<EntityResult> {
  const locationContext = params.location
    ? `\nTarget location: ${params.location}`
    : ''

  const existingContext = params.existing_entities?.length
    ? `\n\nEntities already present in the content: ${params.existing_entities.join(', ')}`
    : ''

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a named entity strategist for semantic SEO content optimization.

Named entities are the backbone of knowledge graph integration. Search engines maintain vast entity databases and use entity co-occurrence patterns to evaluate topical authority. A page about "commercial HVAC installation" that mentions relevant manufacturers (Carrier, Trane), certifications (NATE, EPA 608), industry standards (ASHRAE 90.1), and professional organizations (ACCA, SMACNA) signals dramatically more authority than a page with the same word count but no entity references.

Your analytical framework:
- ENTITY CO-OCCURRENCE EXPECTATIONS: For any given topic, search engines have learned which entities typically co-occur on authoritative pages. These expectations form entity-attribute pairs in the knowledge graph. Content that matches these expected co-occurrence patterns ranks higher because it aligns with the search engine's learned model of what authoritative coverage looks like.

- ENTITY CATEGORIES AND THEIR AUTHORITY IMPACT:
  * BRANDS/MANUFACTURERS: Product and brand names signal practical, hands-on knowledge. Mentioning specific brands (not generically) demonstrates real-world expertise.
  * ORGANIZATIONS: Industry bodies, regulatory agencies, professional associations. Signals awareness of the institutional landscape.
  * PEOPLE: Thought leaders, researchers, founders. Appropriate in some industries (tech, medicine) but not all.
  * LOCATIONS: Geographic entities — cities, regions, landmarks. Critical for local SEO, signals service area knowledge.
  * CERTIFICATIONS: Professional credentials, accreditations. Among the strongest authority signals because they represent verified expertise.
  * TECHNICAL TERMS: Precise industry terminology, not jargon. Terms that practitioners use but generalists don't. Signals insider knowledge.
  * INDUSTRY STANDARDS: Named standards, codes, regulations (ISO 9001, OSHA 1910, UL listing). Very high authority signal — only genuine experts reference specific standards.

- ENTITY PRIORITY CLASSIFICATION:
  * MUST_INCLUDE: Entities that authoritative pages universally reference. Omitting these is a red flag that signals shallow content. These are the entities in the closest semantic distance to the target keyword.
  * RECOMMENDED: Entities that top-10 ranking pages frequently include. Their presence strengthens topical authority but their absence isn't a disqualifier.
  * NICE_TO_HAVE: Entities that differentiate exceptional content from merely good content. Demonstrate depth beyond what competitors typically cover.

- CONTEXTUAL PLACEMENT: Each entity needs context — don't just name-drop. Suggest HOW each entity should be referenced to maximize its semantic contribution. Example: Don't just mention "NATE certification" — reference it as "technicians holding NATE certification in commercial refrigeration."

Return ONLY valid JSON matching this structure:
{
  "entities": [
    {
      "name": "entity name",
      "type": "brand|organization|person|location|certification|technical_term|industry_standard",
      "priority": "must_include|recommended|nice_to_have",
      "context": "how to reference this entity for maximum semantic impact — a brief suggested usage"
    }
  ],
  "missing_critical": ["critical entities not yet present in the content"]
}

Be specific and accurate. Only suggest entities that genuinely exist and are relevant. Do not fabricate certifications, standards, or organizations.`,
    messages: [{
      role: 'user',
      content: `Suggest named entities for content targeting: "${params.keyword}"
Industry: ${params.industry}
Business name: ${params.business_name}${locationContext}${existingContext}

Identify which named entities should appear in this content to maximize topical authority signals. Prioritize entities that search engines expect to see on authoritative pages for this topic. For each entity, explain how it should be contextually referenced — not just name-dropped.`,
    }],
  })

  void logTokenUsage({
    feature: 'kotoiq_semantic_agent_entity',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: params.agencyId,
  })

  return parseJsonFromResponse(extractText(msg))
}
