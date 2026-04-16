// ─────────────────────────────────────────────────────────────
// Semantic SEO Tier 3 Agents — KotoIQ
//
// Utility agents that integrate across the platform:
// audit tools, content enhancers, and diagnostic agents.
//
// Agents:
// 14. Comment Generator — aspect-based review analysis
// 15. Sentiment Optimizer — authentic sentiment flow
// 16. Named Entity Inserter — entity insertion into drafts
// 17. Metadiscourse Markers Auditor — filler detection
// 18. N-gram / Skip-gram Extractor — phrase pattern analysis
// 19. Triple Generator — knowledge graph triples
// 20. Spam Hit Detector — Google update impact analysis
// 21. Quality Update Auditor — HCU compliance audit
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

const MODEL = 'claude-sonnet-4-20250514'

// ── Types ────────────────────────────────────────────────────

export interface CommentGeneratorResult {
  aspects: {
    aspect: string
    sentiment: 'positive' | 'negative' | 'mixed'
    mention_count: number
    summary: string
    sample_quotes: string[]
  }[]
  overall_themes: { positive: string[]; negative: string[] }
  suggested_response_topics: string[]
}

export interface SentimentOptimizerResult {
  optimized_content: string
  sentiment_flow: { section: string; sentiment: string; score: number }[]
  authenticity_score: number
  changes_made: string[]
}

export interface EntityInserterResult {
  enhanced_content: string
  insertions: { entity: string; location: string; sentence: string }[]
  entities_inserted: number
  entities_skipped: { entity: string; reason: string }[]
}

export interface MetadiscourseResult {
  markers_found: {
    text: string
    position: number
    category: 'hedge' | 'transition' | 'filler' | 'meta' | 'booster'
    suggestion: string
  }[]
  total_found: number
  density_pct: number
  quality_impact_score: number
  cleaned_content: string
}

export interface NgramResult {
  bigrams: { phrase: string; count: number; competitor_avg?: number }[]
  trigrams: { phrase: string; count: number; competitor_avg?: number }[]
  skip_grams: { phrase: string; count: number }[]
  missing_phrases: string[]
  over_represented: string[]
  phrase_diversity_score: number
}

export interface TripleResult {
  triples: { subject: string; predicate: string; object: string; confidence: number }[]
  entity_connections: { entity_a: string; relationship: string; entity_b: string }[]
  schema_suggestions: { triple: string; schema_type: string; property: string }[]
}

export interface SpamHitResult {
  detected_events: {
    date_range: string
    type: 'core_update' | 'spam_update' | 'helpful_content' | 'link_spam' | 'product_reviews' | 'unknown'
    confidence: number
    traffic_change_pct: number
    description: string
  }[]
  risk_factors: string[]
  recovery_recommendations: string[]
  overall_health: 'healthy' | 'at_risk' | 'penalized'
}

export interface QualityAuditResult {
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  criteria: {
    criterion: string
    category: 'helpfulness' | 'expertise' | 'user_first' | 'content_quality' | 'technical'
    score: number
    finding: string
    recommendation: string
  }[]
  critical_issues: string[]
  strengths: string[]
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

// ── Programmatic n-gram extraction ──────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
}

function extractBigrams(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`
    counts.set(bg, (counts.get(bg) || 0) + 1)
  }
  return counts
}

function extractTrigrams(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < tokens.length - 2; i++) {
    const tg = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`
    counts.set(tg, (counts.get(tg) || 0) + 1)
  }
  return counts
}

function mapToSorted(m: Map<string, number>): { phrase: string; count: number }[] {
  const result: { phrase: string; count: number }[] = []
  m.forEach((count, phrase) => result.push({ phrase, count }))
  result.sort((a, b) => b.count - a.count)
  return result
}

// ═══════════════════════════════════════════════════════════════
// Agent 14: Comment Generator (Pros/Cons/Sentiments)
// ═══════════════════════════════════════════════════════════════

export async function runCommentGenerator(ai: AI, params: {
  reviews: { text: string; rating: number; author?: string }[]
  business_name: string
  product_or_service?: string
  agencyId?: string
}): Promise<CommentGeneratorResult> {
  const reviewBlock = params.reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5${r.author ? `, by ${r.author}` : ''}):\n${r.text}`)
    .join('\n---\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a review intelligence analyst. Your task is to perform aspect-based sentiment analysis on customer reviews.

For each distinct aspect/feature/topic mentioned across reviews:
1. Identify the aspect (e.g., "response time", "pricing", "quality of work", "communication")
2. Classify overall sentiment for that aspect across all mentions
3. Count how many reviews mention it
4. Summarize the consensus view
5. Extract 1-3 direct quotes that best represent the sentiment

Also identify overarching positive and negative themes, and suggest topics the business should address in responses.

Business: ${params.business_name}
${params.product_or_service ? `Product/Service focus: ${params.product_or_service}` : ''}

Return ONLY valid JSON:
{
  "aspects": [{"aspect": "string", "sentiment": "positive|negative|mixed", "mention_count": number, "summary": "string", "sample_quotes": ["string"]}],
  "overall_themes": {"positive": ["string"], "negative": ["string"]},
  "suggested_response_topics": ["string"]
}`,
    messages: [{ role: 'user', content: `Analyze these ${params.reviews.length} reviews:\n\n${reviewBlock}` }],
  })

  track(msg, 'kotoiq_comment_generator', params.agencyId)
  return parseJSON<CommentGeneratorResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 15: Comment Sentiment Optimizer
// ═══════════════════════════════════════════════════════════════

export async function runSentimentOptimizer(ai: AI, params: {
  content: string
  target_sentiment: 'balanced' | 'positive' | 'authentic'
  business_context?: string
  agencyId?: string
}): Promise<SentimentOptimizerResult> {
  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are a content authenticity optimizer specializing in review summaries and testimonial sections.

Your task is to ensure sentiment flows realistically through content. Content that is uniformly positive reads as fake and hurts trust signals. Real customer experiences include nuance — even positive reviews mention trade-offs.

TARGET SENTIMENT MODE: "${params.target_sentiment}"
- "balanced": Mix genuine praise with honest acknowledgments. ~60% positive, ~25% neutral/nuanced, ~15% constructive.
- "positive": Maintain overall positive tone but inject micro-authenticity signals — specific details, minor caveats acknowledged then resolved, varied emotional register.
- "authentic": Prioritize believability. Vary sentence length, mix formal/informal, include specific details that only real customers would know.

${params.business_context ? `Business context: ${params.business_context}` : ''}

RULES:
- Never fabricate reviews or testimonials
- Preserve all factual claims from the original
- Add authenticity markers: specific dates, product names, comparison references
- Vary sentence structure and emotional register
- Remove patterns that signal AI generation: uniform paragraph length, identical sentence openings, superlative stacking

Score authenticity 0-100 where 100 = indistinguishable from organic user-generated content.

Return ONLY valid JSON:
{
  "optimized_content": "string",
  "sentiment_flow": [{"section": "string", "sentiment": "string", "score": number}],
  "authenticity_score": number,
  "changes_made": ["string"]
}`,
    messages: [{ role: 'user', content: `Optimize the sentiment flow of this content:\n\n${params.content}` }],
  })

  track(msg, 'kotoiq_sentiment_optimizer', params.agencyId)
  return parseJSON<SentimentOptimizerResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 16: Named Entity Inserter
// ═══════════════════════════════════════════════════════════════

export async function runEntityInserter(ai: AI, params: {
  content: string
  entities_to_insert: { name: string; type: string; context: string }[]
  keyword: string
  agencyId?: string
}): Promise<EntityInserterResult> {
  const entityList = params.entities_to_insert
    .map(e => `- ${e.name} (${e.type}): ${e.context}`)
    .join('\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are a semantic entity integration specialist. Your task is to naturally insert missing entities into existing content without disrupting readability or flow.

ENTITY INSERTION PRINCIPLES:
1. Each entity must be contextually relevant where inserted — do not force entities into unrelated paragraphs.
2. Prefer appositional insertion (adding entity as a clarifying phrase) over creating new sentences.
3. Maintain the original voice and tone of the content.
4. If an entity cannot be naturally inserted without forcing it, skip it and explain why.
5. Entities should strengthen the topical authority of the content for the target keyword.
6. Prefer inserting entities near semantically related existing terms.

Target keyword: "${params.keyword}"

Entities to insert:
${entityList}

Return ONLY valid JSON:
{
  "enhanced_content": "string (full content with entities inserted)",
  "insertions": [{"entity": "string", "location": "paragraph/section description", "sentence": "the sentence where inserted"}],
  "entities_inserted": number,
  "entities_skipped": [{"entity": "string", "reason": "string"}]
}`,
    messages: [{ role: 'user', content: `Insert the specified entities into this content:\n\n${params.content}` }],
  })

  track(msg, 'kotoiq_entity_inserter', params.agencyId)
  return parseJSON<EntityInserterResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 17: Metadiscourse Markers Auditor
// ═══════════════════════════════════════════════════════════════

export async function runMetadiscourseAuditor(ai: AI, params: {
  content: string
  agencyId?: string
}): Promise<MetadiscourseResult> {
  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are a content quality auditor specializing in metadiscourse detection. Metadiscourse markers are phrases that talk about the text itself rather than the topic — they add length without adding information.

CATEGORIES TO DETECT:

1. HEDGE markers — weaken claims unnecessarily:
   "It is important to note that", "It should be mentioned that", "It's worth pointing out", "One might argue that", "It could be said that", "To some extent", "In a way", "More or less"

2. TRANSITION fillers — overused connective tissue:
   "In conclusion", "To sum up", "Moving on", "Having said that", "With that being said", "That being the case", "On the other hand" (when not actually contrasting), "Furthermore" (when just continuing)

3. FILLER phrases — zero semantic content:
   "In today's fast-paced world", "In today's digital age", "When it comes to", "At the end of the day", "The fact of the matter is", "It goes without saying", "As we all know", "Needless to say"

4. META commentary — text about the text:
   "As we discussed earlier", "As mentioned above", "In this article we will", "Let's take a look at", "Let's dive into", "Without further ado", "Before we begin"

5. BOOSTER phrases — inflate without evidence:
   "Undoubtedly", "Without a doubt", "Clearly", "Obviously", "Of course", "Naturally", "It is well known that", "Everyone knows that"

For each marker found, provide:
- The exact text matched
- Character position in the content
- Category
- A suggested replacement (often just deletion, sometimes a tighter alternative)

Calculate density as: (total_marker_words / total_content_words) * 100
Quality impact: 100 minus (density * 10), clamped to 0-100.

Also produce a cleaned version with all markers removed or replaced.

Return ONLY valid JSON:
{
  "markers_found": [{"text": "string", "position": number, "category": "hedge|transition|filler|meta|booster", "suggestion": "string"}],
  "total_found": number,
  "density_pct": number,
  "quality_impact_score": number,
  "cleaned_content": "string"
}`,
    messages: [{ role: 'user', content: `Audit this content for metadiscourse markers:\n\n${params.content}` }],
  })

  track(msg, 'kotoiq_metadiscourse_auditor', params.agencyId)
  return parseJSON<MetadiscourseResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 18: N-gram and Skip-gram Extractor
// ═══════════════════════════════════════════════════════════════

export async function runNgramExtractor(ai: AI, params: {
  content: string
  competitor_contents?: string[]
  keyword: string
  agencyId?: string
}): Promise<NgramResult> {
  // --- Programmatic extraction ---
  const tokens = tokenize(params.content)
  const bigramMap = extractBigrams(tokens)
  const trigramMap = extractTrigrams(tokens)

  // Compute competitor averages if provided
  const competitorBigrams: Map<string, number[]> = new Map()
  const competitorTrigrams: Map<string, number[]> = new Map()

  if (params.competitor_contents?.length) {
    for (const cc of params.competitor_contents) {
      const ct = tokenize(cc)
      const cb = extractBigrams(ct)
      const ctr = extractTrigrams(ct)
      cb.forEach((count, phrase) => {
        if (!competitorBigrams.has(phrase)) competitorBigrams.set(phrase, [])
        competitorBigrams.get(phrase)!.push(count)
      })
      ctr.forEach((count, phrase) => {
        if (!competitorTrigrams.has(phrase)) competitorTrigrams.set(phrase, [])
        competitorTrigrams.get(phrase)!.push(count)
      })
    }
  }

  const bigrams = mapToSorted(bigramMap).slice(0, 50).map(b => ({
    ...b,
    competitor_avg: competitorBigrams.has(b.phrase)
      ? Math.round(competitorBigrams.get(b.phrase)!.reduce((a, c) => a + c, 0) / competitorBigrams.get(b.phrase)!.length)
      : undefined,
  }))

  const trigrams = mapToSorted(trigramMap).slice(0, 50).map(t => ({
    ...t,
    competitor_avg: competitorTrigrams.has(t.phrase)
      ? Math.round(competitorTrigrams.get(t.phrase)!.reduce((a, c) => a + c, 0) / competitorTrigrams.get(t.phrase)!.length)
      : undefined,
  }))

  // --- Claude for skip-gram analysis + interpretation ---
  const competitorSnippets = params.competitor_contents?.length
    ? `\n\nCompetitor content snippets (first 2000 chars each):\n${params.competitor_contents.map((c, i) => `--- Competitor ${i + 1} ---\n${c.substring(0, 2000)}`).join('\n')}`
    : ''

  const bigramSummary = bigrams.slice(0, 20).map(b => `"${b.phrase}" (${b.count}${b.competitor_avg != null ? `, comp avg: ${b.competitor_avg}` : ''})`).join(', ')
  const trigramSummary = trigrams.slice(0, 20).map(t => `"${t.phrase}" (${t.count}${t.competitor_avg != null ? `, comp avg: ${t.competitor_avg}` : ''})`).join(', ')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a computational linguistics analyst specializing in n-gram and skip-gram analysis for SEO content optimization.

You have been provided with programmatically extracted bigrams and trigrams from the target content. Your job is to:

1. SKIP-GRAM ANALYSIS: Identify meaningful skip-grams (word pairs that frequently co-occur within a window of 3-5 words but are not adjacent). These reveal latent topical associations that search engines use for semantic matching. Extract the top 15-20 skip-grams.

2. MISSING PHRASES: Compare the content's n-gram profile against what a comprehensive page about "${params.keyword}" should contain. Identify important multi-word phrases that are absent.

3. OVER-REPRESENTED: Flag phrases that appear disproportionately often relative to content length — these may signal keyword stuffing or repetitive content.

4. PHRASE DIVERSITY SCORE: Rate 0-100 how diverse the phrase usage is. Low diversity = repetitive/thin. High diversity = comprehensive coverage.

Pre-computed bigrams (top 20): ${bigramSummary}
Pre-computed trigrams (top 20): ${trigramSummary}
Total unique bigrams: ${bigramMap.size}
Total unique trigrams: ${trigramMap.size}
Total tokens: ${tokens.length}

Return ONLY valid JSON:
{
  "skip_grams": [{"phrase": "word1 ... word2", "count": number}],
  "missing_phrases": ["string"],
  "over_represented": ["string"],
  "phrase_diversity_score": number
}`,
    messages: [{
      role: 'user',
      content: `Analyze skip-grams and phrase patterns for "${params.keyword}":\n\nContent (first 4000 chars):\n${params.content.substring(0, 4000)}${competitorSnippets}`,
    }],
  })

  track(msg, 'kotoiq_ngram_extractor', params.agencyId)

  const claudeResult = parseJSON<{
    skip_grams: { phrase: string; count: number }[]
    missing_phrases: string[]
    over_represented: string[]
    phrase_diversity_score: number
  }>(extractText(msg))

  return {
    bigrams,
    trigrams,
    skip_grams: claudeResult.skip_grams || [],
    missing_phrases: claudeResult.missing_phrases || [],
    over_represented: claudeResult.over_represented || [],
    phrase_diversity_score: claudeResult.phrase_diversity_score || 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// Agent 19: Triple Generator
// ═══════════════════════════════════════════════════════════════

export async function runTripleGenerator(ai: AI, params: {
  content: string
  keyword: string
  business_name?: string
  agencyId?: string
}): Promise<TripleResult> {
  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a knowledge graph extraction specialist. Your task is to extract subject-predicate-object triples from content — the fundamental units of structured knowledge that search engines use to build their Knowledge Graph.

EXTRACTION FRAMEWORK:

1. ENTITY TRIPLES: Extract factual relationships expressed or implied in the content.
   Example: ("John's Plumbing", "serves", "Austin, TX"), ("emergency plumbing", "requires", "licensed plumber")

2. ATTRIBUTE TRIPLES: Extract properties of entities.
   Example: ("John's Plumbing", "has_rating", "4.8/5"), ("service", "available", "24/7")

3. HIERARCHICAL TRIPLES: Extract is-a and part-of relationships.
   Example: ("emergency plumbing", "is_a", "plumbing service"), ("pipe repair", "part_of", "plumbing services")

4. ENTITY CONNECTIONS: Map how entities in the content relate to each other — these form the semantic web that search engines parse.

5. SCHEMA.ORG MAPPING: For each triple, suggest the most appropriate schema.org type and property that could represent this relationship in structured data.

Target keyword: "${params.keyword}"
${params.business_name ? `Business: ${params.business_name}` : ''}

Assign confidence 0-1 to each triple based on how explicitly the relationship is stated in the content (1.0 = explicitly stated, 0.5 = strongly implied, 0.3 = loosely implied).

Return ONLY valid JSON:
{
  "triples": [{"subject": "string", "predicate": "string", "object": "string", "confidence": number}],
  "entity_connections": [{"entity_a": "string", "relationship": "string", "entity_b": "string"}],
  "schema_suggestions": [{"triple": "subject predicate object", "schema_type": "schema.org type", "property": "schema.org property"}]
}`,
    messages: [{
      role: 'user',
      content: `Extract knowledge graph triples from this content about "${params.keyword}":\n\n${params.content.substring(0, 6000)}`,
    }],
  })

  track(msg, 'kotoiq_triple_generator', params.agencyId)
  return parseJSON<TripleResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 20: Spam Hit Detector
// ═══════════════════════════════════════════════════════════════

export async function runSpamHitDetector(ai: AI, params: {
  traffic_data: { date: string; clicks: number; impressions: number; position: number }[]
  domain: string
  agencyId?: string
}): Promise<SpamHitResult> {
  const trafficSummary = params.traffic_data
    .map(d => `${d.date}: clicks=${d.clicks}, impressions=${d.impressions}, avg_pos=${d.position.toFixed(1)}`)
    .join('\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a Google algorithm update forensics analyst. Your task is to analyze traffic patterns and identify which Google updates may have affected a website.

KNOWN UPDATE PATTERNS:

1. CORE UPDATES: Broad ranking changes. Signature: gradual shift over 2-3 weeks, affects many queries simultaneously, position changes of 5-20+ spots. Typically roll out March, August, November.

2. SPAM UPDATES: Targets manipulative practices. Signature: sudden sharp drop (1-3 days), primarily affects link-heavy or thin content pages, often 50%+ traffic loss.

3. HELPFUL CONTENT UPDATES: Targets low-quality/AI content. Signature: slow decline over 2-4 weeks, affects informational queries most, content-heavy sites with thin pages see biggest drops.

4. LINK SPAM UPDATES: Targets unnatural link profiles. Signature: moderate drop over 1-2 weeks, commercial/transactional queries affected most, sites with PBN or paid link profiles.

5. PRODUCT REVIEWS UPDATES: Targets thin review content. Signature: affects review/comparison pages specifically, may see some pages drop while others hold.

ANALYSIS METHOD:
- Look for sudden traffic drops (>20% week-over-week)
- Identify the date range of each event
- Cross-reference timing with known Google update dates
- Assess severity and pattern to classify the update type
- Consider whether multiple updates may have stacked

Domain: ${params.domain}

Return ONLY valid JSON:
{
  "detected_events": [{"date_range": "YYYY-MM-DD to YYYY-MM-DD", "type": "core_update|spam_update|helpful_content|link_spam|product_reviews|unknown", "confidence": number, "traffic_change_pct": number, "description": "string"}],
  "risk_factors": ["string"],
  "recovery_recommendations": ["string"],
  "overall_health": "healthy|at_risk|penalized"
}`,
    messages: [{
      role: 'user',
      content: `Analyze the following daily traffic data for ${params.domain} and identify any Google algorithm update impacts:\n\n${trafficSummary}`,
    }],
  })

  track(msg, 'kotoiq_spam_hit_detector', params.agencyId)
  return parseJSON<SpamHitResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 21: Quality Update Auditor
// ═══════════════════════════════════════════════════════════════

export async function runQualityUpdateAuditor(ai: AI, params: {
  url: string
  content?: string
  keyword?: string
  agencyId?: string
}): Promise<QualityAuditResult> {
  // Fetch content if not provided
  let pageContent = params.content || ''
  if (!pageContent) {
    try {
      const res = await fetch(params.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const html = await res.text()
        // Strip HTML tags for analysis
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000)
      }
    } catch {
      pageContent = '[Could not fetch page content]'
    }
  }

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a Google Helpful Content Update compliance auditor. Evaluate content against every criterion Google uses to assess whether content is "helpful" and written for people.

EVALUATION CRITERIA (score each 0-10):

HELPFULNESS:
1. "Written for people, not search engines" — Does the content read naturally or does it feel optimized? Look for keyword stuffing, unnatural phrasing, over-optimization signals.
2. "Leaves the reader satisfied" — Would someone who reads this feel they got what they needed? Is the information complete and actionable?
3. "Has a primary purpose beyond ranking" — Does the page serve a genuine informational, transactional, or navigational purpose?

EXPERTISE:
4. "Demonstrates first-hand expertise" — Are there original insights, personal experience, or proprietary data? Or is it generic information anyone could write?
5. "Written by someone knowledgeable" — Does the content demonstrate depth of understanding? Are technical details accurate and specific?

USER-FIRST:
6. "Doesn't promise answers to questions with no answer" — Does it make claims it can't support? Does it answer subjective questions definitively?
7. "Doesn't use excessive automation" — Are there signs of AI-generated content without human editing? Patterns: uniform paragraph length, generic transitions, no specific examples.

CONTENT QUALITY:
8. "Provides substantial value vs other pages" — Does it offer something competitors don't? Or is it just another version of the same content?
9. "Doesn't just summarize what others say" — Is there original analysis, unique data, or a distinct perspective?
10. "Isn't keyword-stuffed" — Is the target keyword used naturally and at appropriate density?

URL: ${params.url}
${params.keyword ? `Target keyword: ${params.keyword}` : ''}

Grade: A (90-100), B (75-89), C (60-74), D (40-59), F (<40)

Return ONLY valid JSON:
{
  "overall_score": number,
  "grade": "A|B|C|D|F",
  "criteria": [{"criterion": "string", "category": "helpfulness|expertise|user_first|content_quality|technical", "score": number, "finding": "string", "recommendation": "string"}],
  "critical_issues": ["string"],
  "strengths": ["string"]
}`,
    messages: [{
      role: 'user',
      content: `Audit this page content against Helpful Content Update criteria:\n\nURL: ${params.url}\n\nContent:\n${pageContent.substring(0, 8000)}`,
    }],
  })

  track(msg, 'kotoiq_quality_update_auditor', params.agencyId)
  return parseJSON<QualityAuditResult>(extractText(msg))
}
