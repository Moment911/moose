// ─────────────────────────────────────────────────────────────
// Semantic SEO Agents — KotoIQ Tier 2
//
// Five specialized Claude prompt pipelines for deeper semantic
// analysis: lexical relations, topic clustering, title auditing,
// key-fact summarization, and bridge topic discovery.
//
// Agents:
//  9. Lexical Relation Analyzer — hyponym/hypernym/meronym mapping
// 10. Topic Clusterer — pillar/cluster/support page architecture
// 11. Title-Query Coverage Ratio Auditor — title tag optimization
// 12. Key-Fact Summarizer — extract & score semantic facts
// 13. Bridge Topic Suggester — contextual bridges between topics
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

const MODEL = 'claude-sonnet-4-20250514'

// ── Result Types ─────────────────────────────────────────────

export interface LexicalRelationResult {
  keyword: string
  hypernyms: string[]
  hyponyms: string[]
  meronyms: string[]
  co_hyponyms: string[]
  holonyms: string[]
  related_entities: { term: string; relation: string; must_include: boolean }[]
}

export interface TopicClusterResult {
  clusters: {
    name: string
    pillar_keyword: string
    pillar_type: 'pillar' | 'hub'
    cluster_keywords: {
      keyword: string
      role: 'pillar' | 'cluster' | 'support' | 'faq'
      suggested_url: string
    }[]
    internal_link_strategy: string
    publishing_order: number
  }[]
  orphan_keywords: string[]
}

export interface TitleAuditResult {
  score: number
  issues: { issue: string; severity: 'critical' | 'warning' | 'suggestion' }[]
  improved_titles: {
    title: string
    method: 'conjunctive' | 'entity_attribute' | 'hypernym_hyponym'
    rationale: string
  }[]
  term_weight_analysis: {
    term: string
    weight: 'heavy' | 'medium' | 'light'
    position_optimal: boolean
  }[]
}

export interface KeyFactResult {
  key_facts: {
    fact: string
    importance: 'critical' | 'important' | 'supporting'
    category: string
  }[]
  missing_facts: string[]
  suggested_meta_description: string
  fact_density_score: number
  competitor_advantages?: string[]
}

export interface BridgeTopicResult {
  bridge_topics: {
    topic: string
    connects: [string, string]
    content_type: 'blog' | 'guide' | 'faq' | 'comparison'
    suggested_title: string
    priority: 'high' | 'medium' | 'low'
    rationale: string
  }[]
  cluster_strengthening_effect: string
}

// ── Helpers ──────────────────────────────────────────────────

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

function extractText(msg: any): string {
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
}

function track(msg: any, feature: string, agencyId?: string) {
  void logTokenUsage({
    feature,
    model: MODEL,
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId,
  })
}

// ═══════════════════════════════════════════════════════════════
// Agent 9: Lexical Relation Analyzer
// ═══════════════════════════════════════════════════════════════

export async function runLexicalRelationAnalyzer(
  ai: AI,
  params: {
    keyword: string
    industry?: string
    agencyId?: string
  },
): Promise<LexicalRelationResult> {
  const { keyword, industry, agencyId } = params

  const industryClause = industry ? ` in the ${industry} industry` : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You are a lexical semantics analyst specializing in search engine topic modeling. Your task is to map the full taxonomy of lexical relations around a keyword — the hierarchy of terms that search engines use to understand whether content provides complete entity coverage.

LEXICAL SEMANTIC RELATIONS:

1. HYPERNYMS (broader terms): The category or class that the keyword belongs to. These are the "is-a" relationships. Search engines use hypernyms to classify content into topical categories. For "running shoes": hypernym = "footwear", "athletic shoes", "sports equipment". Content that mentions hypernyms signals awareness of the broader category and helps search engines place the page in the correct topical cluster.

2. HYPONYMS (narrower terms): Specific types, varieties, or subcategories of the keyword. These are the "types-of" relationships. For "running shoes": hyponyms = "trail runners", "road shoes", "racing flats", "stability shoes", "neutral shoes". Content that covers hyponyms demonstrates comprehensive knowledge — a page about "running shoes" that only discusses the general concept without mentioning specific types signals shallow coverage.

3. MERONYMS (part-of terms): Components, parts, or constituent elements of the keyword. These are the "has-a" or "part-of" relationships. For "running shoes": meronyms = "outsole", "midsole", "upper", "heel counter", "toe box", "insole", "lacing system". Content that references meronyms signals technical depth and expertise. These terms are especially important for product and service pages.

4. HOLONYMS (whole-of terms): The larger wholes that the keyword is a part of. The inverse of meronyms. For "running shoes": holonyms = "running gear", "marathon kit", "athletic wardrobe". These help establish the contextual ecosystem the keyword exists within.

5. CO-HYPONYMS (sibling terms): Other terms that share the same hypernym — siblings in the taxonomy. For "running shoes" (hypernym "athletic shoes"): co-hyponyms = "basketball shoes", "tennis shoes", "hiking boots", "cross-trainers". Mentioning co-hyponyms in comparative contexts strengthens topical authority by demonstrating awareness of the competitive landscape.

6. RELATED ENTITIES: Named entities, brands, standards, certifications, or specific things that are semantically linked to the keyword but don't fit neatly into the taxonomy hierarchy. Flag which of these MUST be included for complete entity coverage versus which are optional enhancements.

WHY THIS MATTERS FOR SEO:
Search engines build internal taxonomy trees for every topic. When a page's content aligns with the expected taxonomy — mentioning the right hypernyms for context, hyponyms for depth, and meronyms for technical detail — the page receives stronger topical relevance signals. Pages that only use the target keyword without its lexical relations appear thin and incomplete to modern ranking algorithms.

Return ONLY valid JSON matching this structure:
{
  "keyword": "the analyzed keyword",
  "hypernyms": ["broader category terms"],
  "hyponyms": ["specific subtypes"],
  "meronyms": ["component parts"],
  "co_hyponyms": ["sibling terms sharing the same parent category"],
  "holonyms": ["larger wholes this keyword belongs to"],
  "related_entities": [
    {"term": "entity name", "relation": "how it relates to the keyword", "must_include": true/false}
  ]
}

Be thorough — aim for 5-10 terms in each category where the keyword supports it. For simpler keywords, fewer terms are acceptable. Only include terms that genuinely belong in that lexical relation — accuracy matters more than volume.`,
    messages: [{
      role: 'user',
      content: `Map the complete lexical relation taxonomy for the keyword: "${keyword}"${industryClause}

Identify all hypernyms, hyponyms, meronyms, holonyms, and co-hyponyms. For each related entity, indicate whether it MUST be included for complete entity coverage or is an optional enhancement.`,
    }],
  })

  track(msg, 'kotoiq_lexical_relation_analyzer', agencyId)
  return parseJSON<LexicalRelationResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 10: Topic Clusterer
// ═══════════════════════════════════════════════════════════════

export async function runTopicClusterer(
  ai: AI,
  params: {
    keywords: { keyword: string; volume?: number; position?: number; intent?: string }[]
    business_context?: string
    agencyId?: string
  },
): Promise<TopicClusterResult> {
  const { keywords, business_context, agencyId } = params

  const contextClause = business_context
    ? `\nBusiness context: ${business_context}`
    : ''

  const keywordList = keywords
    .map(k => {
      const parts = [k.keyword]
      if (k.volume) parts.push(`vol:${k.volume}`)
      if (k.position) parts.push(`pos:${k.position}`)
      if (k.intent) parts.push(`intent:${k.intent}`)
      return parts.join(' | ')
    })
    .join('\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a topical authority architect specializing in semantic keyword clustering for SEO. Your task is to group keywords into clusters based on semantic meaning and search intent, then define the optimal pillar/cluster/support page architecture.

TOPICAL AUTHORITY CLUSTERING:

Search engines evaluate topical authority at the cluster level, not the page level. A site that publishes one comprehensive page about a topic performs worse than a site that publishes a well-structured cluster: a pillar page covering the core topic, cluster pages covering major subtopics, and supporting pages answering specific questions. The internal linking between these pages creates semantic reinforcement — each page strengthens the authority of every other page in the cluster.

CLUSTERING PRINCIPLES:

1. SEMANTIC GROUPING: Keywords should be grouped by meaning, not just by shared words. "best running shoes for flat feet" and "stability shoes for overpronation" belong in the same cluster even though they share no words, because they address the same underlying need.

2. INTENT ALIGNMENT: Keywords within a cluster should serve related but distinct intents. A cluster mixing purely informational queries with transactional queries is valid — the informational content feeds the transactional pages. But a cluster mixing unrelated intents creates weak topical cohesion.

3. PAGE ROLE ASSIGNMENT:
   - PILLAR: The central, comprehensive page (2000-4000 words) that covers the core topic broadly. Every cluster has exactly one pillar.
   - CLUSTER: Major subtopic pages (1000-2000 words) that go deep on specific aspects. These link to and from the pillar.
   - SUPPORT: Narrow, specific pages (500-1000 words) that answer individual questions or cover niche angles. These link to cluster pages.
   - FAQ: Question-answer pages that target PAA (People Also Ask) opportunities. These link to the most relevant cluster or pillar page.

4. PILLAR TYPE:
   - PILLAR: Traditional pillar page — a single authoritative page on a broad topic ("Complete Guide to Running Shoes")
   - HUB: A hub page that serves primarily as a navigation/index page linking to cluster content ("Running Shoes: All Guides & Resources"). Better for very broad topics with many subtopics.

5. PUBLISHING ORDER: Not all pages should be published simultaneously. The optimal order builds topical momentum:
   - Publish the pillar first to establish the topic
   - Then cluster pages in order of search volume (highest first)
   - Then support/FAQ pages to fill gaps
   - Number each cluster's publishing order (1 = publish first)

6. INTERNAL LINK STRATEGY: For each cluster, describe the specific internal linking approach — which pages link to which, anchor text patterns, and how the linking structure reinforces the topical hierarchy.

7. SUGGESTED URLs: For each keyword, suggest a URL slug that is clean, keyword-rich, and follows a logical hierarchy (e.g., /running-shoes/, /running-shoes/trail-runners/, /running-shoes/trail-runners/best-for-beginners/).

8. ORPHAN KEYWORDS: Keywords that don't fit cleanly into any cluster. These may need their own cluster, may be too tangential, or may need further research.

Return ONLY valid JSON matching this structure:
{
  "clusters": [
    {
      "name": "Descriptive cluster name",
      "pillar_keyword": "the keyword that should be the pillar page",
      "pillar_type": "pillar" or "hub",
      "cluster_keywords": [
        {"keyword": "keyword text", "role": "pillar|cluster|support|faq", "suggested_url": "/url-slug/"}
      ],
      "internal_link_strategy": "description of how pages in this cluster should link to each other",
      "publishing_order": 1
    }
  ],
  "orphan_keywords": ["keywords that don't fit any cluster"]
}`,
    messages: [{
      role: 'user',
      content: `Group the following keywords into semantic topic clusters and define the pillar/cluster/support architecture.${contextClause}

KEYWORDS:
${keywordList}

Create clusters based on semantic meaning and intent, assign page roles, suggest URL structures, define internal linking strategies, and set publishing order. Identify any orphan keywords that don't fit.`,
    }],
  })

  track(msg, 'kotoiq_topic_clusterer', agencyId)
  return parseJSON<TopicClusterResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 11: Title-Query Coverage Ratio Auditor
// ═══════════════════════════════════════════════════════════════

export async function runTitleQueryAuditor(
  ai: AI,
  params: {
    title: string
    target_keyword: string
    page_type?: string
    agencyId?: string
  },
): Promise<TitleAuditResult> {
  const { title, target_keyword, page_type, agencyId } = params

  const pageTypeClause = page_type ? `\nPage type: ${page_type}` : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You are a title tag optimization analyst specializing in query-title coverage ratios. Your task is to audit whether a title tag adequately covers the primary query intent and identify specific improvements.

TITLE-QUERY COVERAGE ANALYSIS:

The title tag is the single most important on-page ranking signal. Search engines evaluate titles through multiple lenses:

1. MACRO-CONTEXT SIGNAL: Does the title establish the correct topical context? A title like "Best Running Shoes" establishes a commercial/comparison macro-context. "How to Choose Running Shoes" establishes an informational/guide macro-context. The macro-context must match the dominant search intent for the target keyword. Misaligned macro-context causes poor CTR and sends negative engagement signals.

2. QUERY TYPE MATCH: Different query types demand different title structures:
   - Informational: "How to...", "What is...", "Guide to..." — the title should promise answers
   - Commercial: "Best...", "Top...", "vs..." — the title should promise comparisons/evaluations
   - Transactional: "[Service] in [Location]", "[Product] — Buy/Order" — the title should promise action
   - Navigational: "[Brand Name] — [Page Description]" — the title should be clear and branded

3. TERM WEIGHT DISTRIBUTION: Words at the beginning of a title carry more weight than words at the end. The target keyword's most important terms should appear in the first 40 characters. Measure whether each term is in a heavy (first third), medium (middle third), or light (final third) position.

4. CONDITIONAL SYNONYMY: Sometimes the exact keyword should not appear verbatim in the title. Instead, a contextual synonym or semantic equivalent performs better because it matches a broader set of query variations. Identify whether the title uses the optimal form of the keyword — exact match, partial match, or semantic equivalent — for maximum query coverage.

5. ENTITY-ATTRIBUTE COVERAGE: For entity-focused queries, the title should contain both the entity and its most important attribute. "Emergency Plumber" (entity) + "24/7" (key attribute). "Running Shoes" (entity) + "for Flat Feet" (key attribute/qualifier). Titles that include the key attribute narrow intent match and improve CTR.

6. TITLE IMPROVEMENT METHODS:
   - CONJUNCTIVE: Combine two related concepts with a conjunction or separator: "Running Shoes for Flat Feet: Stability & Support Guide"
   - ENTITY_ATTRIBUTE: Lead with the entity-attribute pair: "Flat Feet Running Shoes — Top Stability Models Compared"
   - HYPERNYM_HYPONYM: Use the broader category to establish context, then narrow: "Athletic Footwear Guide: Best Running Shoes for Flat Feet"

SCORING (0-100):
- 90-100: Title perfectly covers the query intent, optimal term positioning, correct macro-context
- 70-89: Good coverage with minor positioning or synonym issues
- 50-69: Adequate but missing key attributes or suboptimal term weight
- 30-49: Significant coverage gaps — misaligned intent or missing critical terms
- 0-29: Title fails to cover the query — wrong macro-context or irrelevant terms

Return ONLY valid JSON matching this structure:
{
  "score": <0-100>,
  "issues": [
    {"issue": "description of the problem", "severity": "critical|warning|suggestion"}
  ],
  "improved_titles": [
    {"title": "improved title text", "method": "conjunctive|entity_attribute|hypernym_hyponym", "rationale": "why this version is better"}
  ],
  "term_weight_analysis": [
    {"term": "individual term from the title", "weight": "heavy|medium|light", "position_optimal": true/false}
  ]
}

Generate 2-3 improved title alternatives, each using a different method. Keep all titles under 60 characters where possible (never exceed 70).`,
    messages: [{
      role: 'user',
      content: `Audit this title tag for coverage of the target keyword.

Title: "${title}"
Target keyword: "${target_keyword}"${pageTypeClause}

Analyze macro-context alignment, query type match, term weight distribution, conditional synonymy usage, and entity-attribute coverage. Score the title and provide improved alternatives.`,
    }],
  })

  track(msg, 'kotoiq_title_query_auditor', agencyId)
  return parseJSON<TitleAuditResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 12: Key-Fact Summarizer
// ═══════════════════════════════════════════════════════════════

export async function runKeyFactSummarizer(
  ai: AI,
  params: {
    content: string
    keyword: string
    purpose: 'competitor_analysis' | 'self_audit' | 'meta_description'
    agencyId?: string
  },
): Promise<KeyFactResult> {
  const { content, keyword, purpose, agencyId } = params

  const purposeInstructions: Record<string, string> = {
    competitor_analysis: `PURPOSE: Competitor analysis.
Extract the key differentiators from this competitor's content. Identify what they cover that makes their content rank-worthy. Focus on unique data points, specific claims, proprietary insights, and structural advantages. Also identify advantages this competitor has that would need to be matched or exceeded.`,
    self_audit: `PURPOSE: Self audit.
Evaluate your own content for factual completeness. Identify which key facts are present, which are missing, and whether the facts presented adequately match what the search query demands. A page that answers the query's implicit questions with specific, verifiable facts outranks pages with generic statements.`,
    meta_description: `PURPOSE: Meta description generation.
Extract the 2-3 most compelling facts from the content and synthesize them into a meta description that maximizes click-through rate. The meta description should contain the most important factual claim, a specificity signal (number, timeframe, or scope), and a value proposition. Keep it under 155 characters.`,
  }

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You are a semantic fact extraction engine for SEO content analysis. Your task is to identify and rank the most semantically important facts in a piece of content relative to a target keyword.

KEY FACT EXTRACTION:

Search engines increasingly evaluate content at the fact level — not just whether the page mentions a topic, but whether it provides specific, verifiable, and relevant facts that satisfy the query intent. Pages with higher fact density (ratio of specific facts to total word count) consistently outperform pages padded with generic statements.

FACT CLASSIFICATION:

1. CRITICAL FACTS: Facts that directly answer the primary query intent. For "how much does a roof replacement cost", the critical fact is the actual cost range. For "best CRM for small business", the critical facts are the specific CRM recommendations with reasoning. Without critical facts, the page fundamentally fails to satisfy the query.

2. IMPORTANT FACTS: Facts that provide essential context, qualifications, or supporting evidence for the critical facts. These include methodology explanations, comparison data, timeline information, and qualification criteria. Missing important facts weakens the page but doesn't invalidate it.

3. SUPPORTING FACTS: Facts that add depth, credibility, or nuance. These include statistics, case study references, expert opinions, historical context, and edge cases. Their presence elevates content from adequate to comprehensive.

FACT CATEGORIES:
Label each fact with a category: pricing, process, comparison, specification, timeline, qualification, statistic, recommendation, warning, definition, example, or other.

MISSING FACT DETECTION:
Based on the target keyword and search intent, identify facts that SHOULD be present but are not. These are the information gaps that could cause a searcher to bounce and search again.

FACT DENSITY SCORE (0-100):
- 90-100: Exceptionally fact-dense — nearly every sentence contributes specific, verifiable information
- 70-89: Good fact density — majority of content is substantive with minimal filler
- 50-69: Moderate — mix of facts and generic statements
- 30-49: Thin — more generic language than specific facts
- 0-29: Very thin — content is mostly filler with few extractable facts

${purposeInstructions[purpose] || purposeInstructions.self_audit}

Return ONLY valid JSON matching this structure:
{
  "key_facts": [
    {"fact": "the extracted fact", "importance": "critical|important|supporting", "category": "category label"}
  ],
  "missing_facts": ["facts that should be present but are not"],
  "suggested_meta_description": "a meta description synthesized from the top facts (under 155 chars)",
  "fact_density_score": <0-100>,
  "competitor_advantages": ["advantages this content has — only for competitor_analysis purpose"]
}

For "competitor_advantages", only include this field when the purpose is competitor_analysis. For other purposes, omit it or return an empty array.`,
    messages: [{
      role: 'user',
      content: `Extract and rank key facts from the following content for the keyword "${keyword}".

CONTENT:
${content.substring(0, 8000)}

Identify all critical, important, and supporting facts. Detect missing facts that the query demands. Score the overall fact density. Generate a meta description from the top facts.`,
    }],
  })

  track(msg, 'kotoiq_key_fact_summarizer', agencyId)
  return parseJSON<KeyFactResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 13: Bridge Topic Suggester
// ═══════════════════════════════════════════════════════════════

export async function runBridgeTopicSuggester(
  ai: AI,
  params: {
    topic_a: string
    topic_b: string
    business_context?: string
    existing_pages?: string[]
    agencyId?: string
  },
): Promise<BridgeTopicResult> {
  const { topic_a, topic_b, business_context, existing_pages, agencyId } = params

  const contextClause = business_context
    ? `\nBusiness context: ${business_context}`
    : ''

  const pagesClause = existing_pages?.length
    ? `\nExisting pages on the site:\n${existing_pages.map(p => `- ${p}`).join('\n')}`
    : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You are a topical bridge analyst specializing in semantic gap identification for SEO content strategy. Your task is to identify connecting topics that link two semantic domains — the "neighborhood content" that strengthens contextual bridges between topical map nodes.

CONTEXTUAL BRIDGES IN TOPICAL AUTHORITY:

Search engines evaluate topical authority not just by the depth of individual topic clusters, but by the coherence of the connections between clusters. Two isolated clusters on related topics produce less authority than two clusters connected by bridge content. Bridge topics are the pages that create semantic pathways between different areas of expertise.

WHY BRIDGE TOPICS MATTER:

1. SEMANTIC NEIGHBORHOOD: Every page exists in a semantic neighborhood — the set of topically related pages that link to and from it. When two topic clusters share bridge content, they become part of each other's semantic neighborhood. This mutual reinforcement strengthens the authority signals for both clusters.

2. CONTEXTUAL VECTOR CONTINUITY: Search engines trace contextual vectors — directional paths of meaning — through a site's content. A site about "running shoes" and "marathon training" that lacks bridge content (e.g., "how to choose running shoes for your first marathon") has a broken contextual vector. The bridge content creates continuity, signaling that the site covers the complete user journey.

3. INTERNAL LINK GRAVITY: Bridge pages serve as natural internal link hubs — they can link to both topic clusters without the links feeling forced or irrelevant. This creates a natural-looking link graph that distributes PageRank between clusters.

4. USER JOURNEY COMPLETION: From a user experience perspective, bridge topics represent the questions users ask when transitioning between two related interests. "I know about X, now I want to know how X connects to Y." Answering these transitional questions keeps users on-site and signals comprehensive coverage.

BRIDGE TOPIC IDENTIFICATION CRITERIA:

- The topic must be genuinely related to BOTH domains, not just tangentially connected
- The topic should represent a natural user journey transition from A to B or B to A
- The topic should not already be covered by existing pages (check the existing pages list)
- The topic should be specific enough to warrant its own page, not so broad it duplicates a pillar page
- Priority is based on: search volume potential, semantic bridging strength, and content gap opportunity

CONTENT TYPES FOR BRIDGES:
- BLOG: Narrative/educational content that explores the connection between topics
- GUIDE: How-to content that walks through the practical intersection of both domains
- FAQ: Question-and-answer content targeting specific transitional queries
- COMPARISON: Side-by-side analysis that naturally references both domains

Return ONLY valid JSON matching this structure:
{
  "bridge_topics": [
    {
      "topic": "the bridge topic",
      "connects": ["topic_a aspect", "topic_b aspect"],
      "content_type": "blog|guide|faq|comparison",
      "suggested_title": "a title for the bridge page",
      "priority": "high|medium|low",
      "rationale": "why this bridge strengthens the connection between the two clusters"
    }
  ],
  "cluster_strengthening_effect": "overall description of how these bridge topics strengthen the topical map"
}

Generate 4-6 bridge topics, ranked by priority. Each should connect a specific aspect of Topic A to a specific aspect of Topic B.`,
    messages: [{
      role: 'user',
      content: `Identify bridge topics that connect these two semantic domains:

Topic A: "${topic_a}"
Topic B: "${topic_b}"${contextClause}${pagesClause}

Find the connecting topics that would create semantic pathways between these two topical clusters. Focus on topics that represent natural user journey transitions and would strengthen the authority of both clusters.`,
    }],
  })

  track(msg, 'kotoiq_bridge_topic_suggester', agencyId)
  return parseJSON<BridgeTopicResult>(extractText(msg))
}
