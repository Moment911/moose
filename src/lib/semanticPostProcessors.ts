// ─────────────────────────────────────────────────────────────
// Semantic SEO Post-Processors — KotoIQ Engine Module 2
//
// Agents 5-8: content post-processing and quality scoring.
// These agents operate on AI-written content to clean, score,
// filter, and generate snippet-ready answers.
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

const MODEL = 'claude-sonnet-4-20250514'

// ── Shared Types ──────────────────────────────────────────────

export interface CleanedContentResult {
  cleaned_content: string
  removed_count: number
  removals: { original_phrase: string; action: 'removed' | 'simplified'; reason: string }[]
  density_improvement_pct: number
}

export interface TopicalityResult {
  overall_score: number
  entity_coverage: number
  frame_coverage: number
  contextual_completeness: number
  heading_quality: number
  information_gain: number
  gaps: { topic: string; importance: string; suggestion: string }[]
  excess: { topic: string; reason: string }[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface FilterResult {
  sentences: { text: string; category: 'informative' | 'contextual' | 'transitional' | 'filler' | 'redundant'; score: number; suggestion?: string }[]
  filler_count: number
  filler_pct: number
  informative_pct: number
  quality_score: number
}

export interface SafeAnswerResult {
  featured_snippet_answer: string
  word_count: number
  paa_answers: { question: string; answer: string; word_count: number }[]
  h2_answer_pairs: { heading: string; direct_answer: string }[]
}

// ── Helpers ───────────────────────────────────────────────────

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

function extractText(msg: any): string {
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
}

function track(msg: any, feature: string) {
  void logTokenUsage({
    feature,
    model: MODEL,
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
  })
}

// ═══════════════════════════════════════════════════════════════
// Agent 5: Contextless Word Remover
// ═══════════════════════════════════════════════════════════════

export async function runContextlessWordRemover(ai: AI, params: {
  content: string
  keyword: string
  target_entities: string[]
}): Promise<CleanedContentResult> {
  const { content, keyword, target_entities } = params

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are a semantic density optimizer for SEO content. Your task is to increase the contextual weight of every sentence by removing or simplifying words and phrases that add length without contributing meaning relevant to the target keyword.

Your goal is to maximize the ratio of semantically meaningful tokens to total tokens. In information retrieval, search engines weight content based on term frequency, contextual relevance, and information density. Every filler word dilutes the semantic signal of surrounding meaningful terms.

TARGET CATEGORIES FOR REMOVAL OR SIMPLIFICATION:

1. FILLER ADJECTIVES: "really", "very", "actually", "basically", "literally", "definitely", "certainly", "essentially", "simply", "incredibly", "extremely", "absolutely", "totally", "completely", "quite", "rather", "somewhat", "fairly"

2. GENERIC PREDICATES that add no specificity: "is known for", "has been recognized as", "is considered to be", "is widely regarded as", "has been serving", "continues to provide", "is dedicated to", "is committed to", "strives to deliver"

3. STOP-WORD-HEAVY PHRASES that can be condensed:
   - "in order to" → "to"
   - "due to the fact that" → "because"
   - "at this point in time" → "now"
   - "in the event that" → "if"
   - "with regards to" → "regarding" or "about"
   - "for the purpose of" → "to" or "for"
   - "on a daily basis" → "daily"
   - "in a timely manner" → "promptly"

4. REDUNDANT QUALIFIERS: "end result", "free gift", "past history", "future plans", "added bonus", "basic fundamentals", "each and every", "first and foremost"

5. HEDGING LANGUAGE that weakens semantic authority: "might", "could potentially", "it's possible that", "it may be the case that", "perhaps", "arguably", "to some extent", "in some cases", "it's worth noting that", "it goes without saying"

6. EMPTY DISCOURSE MARKERS: "as a matter of fact", "needless to say", "it is important to note that", "it should be mentioned that", "when it comes to", "in today's world"

RULES:
- Never remove domain-specific terminology, named entities, or technical terms
- Never remove words that contribute to the semantic frame of "${keyword}"
- Preserve all factual claims, data points, and specific details
- Preserve sentence structure and readability — do not create telegraphic text
- Target entities to preserve: ${target_entities.join(', ')}
- Calculate density improvement as: (removed_word_count / original_word_count) * 100

Return JSON matching this exact structure:
{
  "cleaned_content": "the full content with removals/simplifications applied",
  "removed_count": <number of distinct removals made>,
  "removals": [
    {"original_phrase": "the original phrase", "action": "removed" or "simplified", "reason": "why this dilutes semantic density"}
  ],
  "density_improvement_pct": <percentage of words removed>
}`,
    messages: [{
      role: 'user',
      content: `Clean the following content for the keyword "${keyword}". Remove contextless words and phrases that dilute semantic density:\n\n${content}`,
    }],
  })

  track(msg, 'kotoiq_contextless_word_remover')
  return parseJSON<CleanedContentResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 6: Topicality Scorer
// ═══════════════════════════════════════════════════════════════

export async function runTopicalityScorer(ai: AI, params: {
  content: string
  keyword: string
  competitor_outlines?: string[]
  required_entities?: string[]
  frame_elements?: string[]
}): Promise<TopicalityResult> {
  const { content, keyword, competitor_outlines, required_entities, frame_elements } = params

  const competitorSection = competitor_outlines?.length
    ? `\nCOMPETITOR OUTLINES (top-ranking pages):\n${competitor_outlines.map((o, i) => `Competitor ${i + 1}:\n${o}`).join('\n\n')}`
    : ''

  const entitySection = required_entities?.length
    ? `\nREQUIRED ENTITIES (from Named Entity analysis):\n${required_entities.join(', ')}`
    : ''

  const frameSection = frame_elements?.length
    ? `\nFRAME ELEMENTS (from Frame Semantics analysis):\n${frame_elements.join(', ')}`
    : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are a topicality scoring engine for semantic SEO. You evaluate how thoroughly a piece of content covers the topical requirements for a given search query.

Modern search algorithms evaluate content through multiple lenses:

1. ENTITY COVERAGE (0-100): Does the content mention the named entities that a comprehensive treatment of this topic requires? These include people, organizations, products, technologies, locations, and concepts that are semantically expected for the query. Cross-reference against the required entities list if provided.

2. FRAME COVERAGE (0-100): In frame semantics, every concept evokes a "frame" — a structure of related roles, actions, and participants. For example, "buying a house" evokes a Commercial_Transaction frame with roles: Buyer, Seller, Goods, Money, Purpose. Does the content fill the expected frame roles for the keyword's dominant semantic frame? Cross-reference against the frame elements list if provided.

3. CONTEXTUAL COMPLETENESS (0-100): Does the content address the full scope of the query intent? For informational queries, this means covering causes, effects, methods, comparisons, and edge cases. For commercial queries, this means features, benefits, pricing, alternatives, and use cases. Evaluate whether a reader would need to search again after reading this content.

4. HEADING QUALITY (0-100): Do the H2/H3 headings form a logical topical hierarchy? Are they semantically rich (containing relevant terms) rather than generic ("Overview", "Introduction", "Conclusion")? Does the heading structure mirror the information architecture that top-ranking pages use for this query?

5. INFORMATION GAIN (0-100): Compared to what competitors cover, does this content provide unique insights, data, perspectives, or depth? Information gain measures whether the content adds value beyond what already exists in the search index. If no competitor outlines are provided, evaluate whether the content provides specific, non-generic insights.

6. TERM WEIGHT DISTRIBUTION: Are the most important terms for this topic used with appropriate frequency? Neither stuffed nor absent? Do co-occurring terms appear in natural contextual proximity?

GAPS: Identify specific topics, entities, or subtopics that should be covered but are not present. Rate each gap's importance as "critical", "important", or "nice-to-have".

EXCESS: Identify topics included in the content that are tangential to the main query and dilute topical focus. These are sections or paragraphs that would be better suited to a separate page.

GRADING:
A = 90-100 (comprehensive, competitor-beating coverage)
B = 75-89 (solid coverage with minor gaps)
C = 60-74 (adequate but missing important subtopics)
D = 40-59 (thin coverage, significant gaps)
F = 0-39 (fails to address the topic meaningfully)

Return JSON matching this exact structure:
{
  "overall_score": <0-100>,
  "entity_coverage": <0-100>,
  "frame_coverage": <0-100>,
  "contextual_completeness": <0-100>,
  "heading_quality": <0-100>,
  "information_gain": <0-100>,
  "gaps": [{"topic": "missing topic", "importance": "critical|important|nice-to-have", "suggestion": "how to add it"}],
  "excess": [{"topic": "tangential topic", "reason": "why it dilutes focus"}],
  "grade": "A|B|C|D|F"
}`,
    messages: [{
      role: 'user',
      content: `Score the topicality of the following content for the keyword "${keyword}".${entitySection}${frameSection}${competitorSection}\n\nCONTENT TO SCORE:\n${content}`,
    }],
  })

  track(msg, 'kotoiq_topicality_scorer')
  return parseJSON<TopicalityResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 7: Algorithmic Authorship (Sentence Filterer)
// ═══════════════════════════════════════════════════════════════

export async function runSentenceFilterer(ai: AI, params: {
  content: string
  keyword: string
}): Promise<FilterResult> {
  const { content, keyword } = params

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: `You are a sentence-level quality filterer for SEO content. You evaluate every sentence in the content for its informational value, classifying each as one of five categories.

The goal is to identify and flag sentences that a search engine's quality evaluator would consider low-value. Modern ranking systems assess content at the passage level — individual paragraphs and sentences are scored for their contribution to the overall informational value of the page.

CATEGORIES:

1. INFORMATIVE (score 8-10): Adds new data, insight, evidence, or specific detail. Contains facts, statistics, examples, technical explanations, or unique analysis. These sentences are the core value of the content.
   Examples of informative sentences:
   - "Core Web Vitals scores below 75 correlate with a 23% drop in organic impressions."
   - "The three primary ranking factors for local search are relevance, distance, and prominence."

2. CONTEXTUAL (score 5-7): Provides necessary context, definitions, or background that supports informative sentences. Without these, the reader would lack the foundation to understand the informative content. These are valuable but not the primary value drivers.
   Examples:
   - "Local SEO differs from traditional SEO in its emphasis on geographic proximity signals."
   - "Before implementing schema markup, it's essential to understand the types Google supports."

3. TRANSITIONAL (score 4-6): Needed for logical flow between sections or ideas. These sentences serve a structural purpose — they connect one idea to the next. A small number of these are necessary; too many signal padding.
   Examples:
   - "With that foundation in place, let's examine the technical implementation."
   - "This approach works well for small businesses, but enterprise sites require a different strategy."

4. FILLER (score 0-3): Can be removed without losing any information. These sentences add word count without adding meaning. They often restate what is obvious, use generic language that could apply to any topic, or employ AI-typical padding phrases.
   Common filler patterns:
   - Restating the heading: If the H2 says "Benefits of SEO", the sentence "There are many benefits of SEO" is filler.
   - Generic truisms: "In today's competitive digital landscape...", "It's no secret that...", "When it comes to..."
   - Empty emphasis: "It's important to note that...", "It's worth mentioning that...", "One thing to keep in mind is..."
   - AI-typical openers: "In today's fast-paced world", "In the ever-evolving landscape of", "As technology continues to advance"
   - Vacuous conclusions: "By following these tips, you can improve your results."

5. REDUNDANT (score 0-2): Repeats information already stated earlier in the content. This includes paraphrased restatements, circular definitions, and conclusions that merely summarize what was just said in the preceding paragraph.

SCORING:
- Score each sentence 0-10 based on its informational density relative to the keyword "${keyword}"
- For filler and redundant sentences, provide a suggestion: either "remove" or a rewritten version that adds value
- Calculate quality_score as: (informative_count + contextual_count * 0.7) / total_sentences * 100

Return JSON matching this exact structure:
{
  "sentences": [
    {"text": "the sentence", "category": "informative|contextual|transitional|filler|redundant", "score": <0-10>, "suggestion": "optional improvement or 'remove'"}
  ],
  "filler_count": <number of filler + redundant sentences>,
  "filler_pct": <percentage of total sentences that are filler/redundant>,
  "informative_pct": <percentage that are informative>,
  "quality_score": <0-100 composite quality score>
}`,
    messages: [{
      role: 'user',
      content: `Evaluate every sentence in the following content for the keyword "${keyword}". Classify each sentence and score its informational value:\n\n${content}`,
    }],
  })

  track(msg, 'kotoiq_sentence_filterer')
  return parseJSON<FilterResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 8: Safe Answer Generator
// ═══════════════════════════════════════════════════════════════

export async function runSafeAnswerGenerator(ai: AI, params: {
  keyword: string
  business_name: string
  industry: string
  location?: string
  business_context?: string
}): Promise<SafeAnswerResult> {
  const { keyword, business_name, industry, location, business_context } = params

  const locationClause = location ? ` located in ${location}` : ''
  const contextClause = business_context ? `\nBusiness context: ${business_context}` : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a featured snippet and AI Overview answer engineer. You generate the ideal answer format that search engines extract for Position Zero and AI-generated overviews.

FEATURED SNIPPET ANSWER RULES:
- 40-60 words, no more
- First sentence: direct, declarative answer to the query — no hedging, no "might", no "can be"
- Second sentence: supporting context that adds credibility or specificity
- Third sentence (optional): a concrete detail tied to the business
- No questions in the answer — only statements
- No first person ("we", "our") — use the business name or third person
- Structure mirrors the "is-answer" pattern that Google extracts: [Entity] + [verb] + [definition/answer]
- Avoid starting with "It is" or "This is" — start with the subject noun

FORMAT FOR PAA (People Also Ask) ANSWERS:
- Generate 3-4 questions that are semantically related to the main keyword
- Each answer: 30-50 words, same direct-answer format
- Questions should cover: definition, comparison, method, and benefit angles
- Answers must be self-contained — a reader should not need additional context

FORMAT FOR H2-ANSWER PAIRS:
- Generate 3-4 heading + direct answer pairs
- Each heading should be a semantic subtopic of the main keyword
- Each answer is 1-2 sentences that directly address the heading
- These are designed to win passage-level indexing — each pair should be independently extractable as a featured snippet

SEMANTIC CONSIDERATIONS:
- Use the primary entity (business name) within the first 15 words of the featured snippet
- Include the target keyword naturally — do not force exact match
- Use specific numbers, timeframes, or metrics when the business context supports them
- Avoid superlatives ("best", "top", "leading") unless they can be substantiated
- The answer should satisfy the search intent completely — the user should not need to click through

Return JSON matching this exact structure:
{
  "featured_snippet_answer": "the 40-60 word answer",
  "word_count": <actual word count>,
  "paa_answers": [
    {"question": "People Also Ask question", "answer": "30-50 word answer", "word_count": <count>}
  ],
  "h2_answer_pairs": [
    {"heading": "H2 heading text", "direct_answer": "1-2 sentence direct answer"}
  ]
}`,
    messages: [{
      role: 'user',
      content: `Generate featured snippet answers for the keyword "${keyword}".
Business: ${business_name}
Industry: ${industry}${locationClause}${contextClause}

Create the ideal Position Zero answer, PAA variants, and H2-answer pairs optimized for this business.`,
    }],
  })

  track(msg, 'kotoiq_safe_answer_generator')
  return parseJSON<SafeAnswerResult>(extractText(msg))
}
