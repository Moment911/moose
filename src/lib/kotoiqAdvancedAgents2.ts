// ─────────────────────────────────────────────────────────────
// KotoIQ Advanced Semantic SEO Agents — Wave 2
//
// Five additional semantic-SEO intelligence agents that operate
// at the intersection of SERP analysis, document-network alignment,
// topical-border policing, cornerstone identification, and
// link-equity proposition scoring.
//
// Agents:
//  1. SERP Intent Classifier — classifies intent at scale from SERP composition
//  2. Query / Document Alignment Scorer — alignment to a query NETWORK, not one keyword
//  3. Topical Borders Detector — flags drift outside a target topic
//  4. Cornerstone Content Identifier — finds the right pillar/cornerstone candidates
//  5. Link Proposition Value Scorer — scores internal links by topical relevance, not PageRank alone
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

const MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 3000

// ── Types ────────────────────────────────────────────────────

export type SerpIntent =
  | 'informational'
  | 'navigational'
  | 'transactional'
  | 'commercial'
  | 'local'
  | 'mixed'
  | 'branded'

export interface SerpIntentClassification {
  keyword: string
  intent: SerpIntent
  confidence: number
  dominant_features: string[]
  search_intent_signals: string[]
  commercial_value: 'high' | 'medium' | 'low'
}

export interface SerpIntentClassifierResult {
  classifications: SerpIntentClassification[]
  summary: {
    total: number
    by_intent: {
      informational: number
      navigational: number
      transactional: number
      commercial: number
      local: number
      mixed: number
      branded: number
    }
    recommendations: string[]
  }
}

export interface QueryAlignmentScore {
  query: string
  alignment_score: number
  intent_match: 'aligned' | 'partial' | 'mismatch'
  missing_concepts: string[]
}

export interface QueryDocumentAlignmentResult {
  overall_alignment_score: number
  query_scores: QueryAlignmentScore[]
  strongest_aligned_queries: string[]
  weakest_aligned: string[]
  recommendations: string[]
}

export interface DriftParagraph {
  paragraph_index: number
  text_preview: string
  drift_topic: string
  severity: 'minor' | 'moderate' | 'severe'
  recommended_action: string
}

export interface TopicalBordersResult {
  overall_focus_score: number
  drift_paragraphs: DriftParagraph[]
  in_topic_paragraphs_pct: number
  recommended_removals: string[]
}

export interface CornerstoneCandidate {
  url: string
  title: string
  score: number
  why_cornerstone: string
  suggested_cluster: string
  supporting_pages_to_link: string[]
  action: 'promote' | 'expand' | 'merge' | 'create_new'
}

export interface CornerstoneGap {
  missing_cornerstone_topic: string
  recommended_pillar_outline: string[]
}

export interface CornerstoneContentResult {
  cornerstones: CornerstoneCandidate[]
  existing_cornerstones: string[]
  gaps: CornerstoneGap[]
}

export interface LinkScored {
  source_url: string
  target_url: string
  anchor_text: string
  topical_relevance: number
  anchor_quality: number
  overall_value_score: number
  classification: 'high_value' | 'medium' | 'low' | 'waste'
}

export interface LinkPropositionSuggestion {
  source: string
  target: string
  suggested_anchor: string
}

export interface LinkPropositionValueResult {
  links_scored: LinkScored[]
  total_passing_value: number
  suggestions: {
    remove_low_value: { source: string; target: string; anchor_text: string }[]
    add_high_value_opportunities: LinkPropositionSuggestion[]
  }
}

// ── Helpers ──────────────────────────────────────────────────

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

function extractText(msg: any): string {
  return msg.content?.[0]?.type === 'text' ? msg.content[0].text : '{}'
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
// Agent 1: SERP Intent Classifier
// ═══════════════════════════════════════════════════════════════

export async function runSerpIntentClassifier(ai: AI, params: {
  keywords: string[]
  serp_data?: any[]
  agencyId?: string
}): Promise<SerpIntentClassifierResult> {
  const keywords = params.keywords.slice(0, 60)
  const serpMap = new Map<string, any>()
  if (Array.isArray(params.serp_data)) {
    for (const row of params.serp_data) {
      const k = (row?.keyword || row?.query || '').toString().toLowerCase().trim()
      if (k) serpMap.set(k, row)
    }
  }

  // Build a compact SERP composition block per keyword. When SERP data is missing
  // we still let Claude infer from the keyword surface form.
  const block = keywords.map((kw, i) => {
    const sd = serpMap.get(kw.toLowerCase().trim())
    if (!sd) return `${i + 1}. "${kw}" — (no SERP data; classify from query surface form)`
    const items = Array.isArray(sd.items) ? sd.items : Array.isArray(sd.results) ? sd.results : []
    const types = items.slice(0, 12).map((it: any) => it?.type || it?.serp_item_type || 'organic').join(', ')
    const featSet = new Set<string>()
    for (const it of items.slice(0, 20)) {
      const t = (it?.type || it?.serp_item_type || '').toString()
      if (t) featSet.add(t)
    }
    const feats = Array.from(featSet).slice(0, 12).join(', ')
    const topTitles = items.slice(0, 5).map((it: any) => (it?.title || '').slice(0, 80)).filter(Boolean).join(' | ')
    return `${i + 1}. "${kw}"\n   features: ${feats || types || 'organic only'}\n   top titles: ${topTitles || '(none)'}`
  }).join('\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a SERP intent classifier. For each keyword you receive, you must assign a single dominant intent class based on what Google ACTUALLY ranks for that query — not guessed from the keyword tokens alone.

Search intent in semantic SEO is a property of the SERP, not of the query string. Two queries with similar wording can resolve to different intents because Google has decided one wants a transaction and the other wants an explanation. The composition of the SERP — the ratio and ordering of organic results, knowledge panels, AI Overviews, People Also Ask blocks, local packs, shopping carousels, image packs, video carousels, sitelinks, FAQ-rich results, news boxes, and brand panels — IS the answer Google has already given to "what does this query want?" Read those signals first.

Classification taxonomy:
- INFORMATIONAL: SERP dominated by AI Overview, PAA, knowledge panel, "what is/how to" titles, encyclopedic sources (Wikipedia, .edu, .gov), Featured Snippet present. User wants to learn.
- NAVIGATIONAL: SERP dominated by a single brand/site with sitelinks, brand knowledge panel, login/account results. User wants a specific destination.
- TRANSACTIONAL: SERP dominated by shopping carousel, ads above-the-fold heavy, product result types, "buy/order/get/hire/book" intent in ranking titles, ecommerce category pages. User wants to act now.
- COMMERCIAL: SERP dominated by review/comparison pages, "best of", "vs", "top X", listicles from Wirecutter/Forbes/G2-style sites, mixed organic + product cards. User is researching before purchase.
- LOCAL: Local pack present (3-pack map), GMB/Google Maps results, "near me" intent in titles, local services ads, geo-bound terms in top 3.
- MIXED: SERP shows two or more intents simultaneously with no clear winner — e.g. an informational AIO at the top followed by a shopping carousel below, or organic results split 50/50 between explainers and product pages. Use this when the SERP is genuinely fractured.
- BRANDED: Query string contains a brand name AND the SERP is dominated by that brand's owned properties.

For EACH keyword, return:
- intent: one of the 7 classes
- confidence: 0-100. High when the SERP composition gives a single clear signal. Lower when MIXED or when SERP data was absent and you had to infer from the surface form.
- dominant_features: the SERP feature blocks you actually observed (e.g. "ai_overview", "people_also_ask", "local_pack", "shopping", "knowledge_panel", "featured_snippet", "video_carousel", "site_links"). Use the feature names as given in the SERP data; if SERP data is absent, use [] or your best inference.
- search_intent_signals: 2-4 short bullet phrases citing what in the SERP (or the query) led to your call (e.g. "Top 3 organic are 'best X 2025' listicles", "AIO present + .gov source #1", "shopping carousel above the fold").
- commercial_value: high (transactional / commercial / local with high purchase intent), medium (mixed / branded with conversion potential), low (purely informational with no conversion path).

Then produce a SUMMARY:
- total: number of keywords classified
- by_intent: counts in each of the 7 classes
- recommendations: 3-5 strategic recommendations specific to this keyword set (e.g. "82% of keywords are informational — prioritize editorial pages with FAQPage schema before product pages", "12 keywords classified MIXED — these need split-content strategies with both explainer and CTA blocks").

LIMIT: classify up to 60 keywords. If more were sent, classify the first 60.

Return ONLY valid JSON (no prose, no markdown):
{
  "classifications": [
    {
      "keyword": "string",
      "intent": "informational|navigational|transactional|commercial|local|mixed|branded",
      "confidence": number,
      "dominant_features": ["string"],
      "search_intent_signals": ["string"],
      "commercial_value": "high|medium|low"
    }
  ],
  "summary": {
    "total": number,
    "by_intent": {"informational": number, "navigational": number, "transactional": number, "commercial": number, "local": number, "mixed": number, "branded": number},
    "recommendations": ["string"]
  }
}`,
    messages: [{
      role: 'user',
      content: `KEYWORDS WITH SERP COMPOSITION (${keywords.length}):\n${block}\n\nClassify intent per keyword and produce the summary.`,
    }],
  })

  track(msg, 'kotoiq_serp_intent_classifier', params.agencyId)
  return parseJSON<SerpIntentClassifierResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 2: Query / Document Alignment Scorer
// ═══════════════════════════════════════════════════════════════

export async function runQueryDocumentAlignmentScorer(ai: AI, params: {
  document_content: string
  primary_keyword: string
  query_network?: string[]
  agencyId?: string
}): Promise<QueryDocumentAlignmentResult> {
  const networkBlock = (params.query_network || []).slice(0, 40).map(q => `- ${q}`).join('\n')
  const docPreview = params.document_content.length > 12000
    ? params.document_content.slice(0, 12000) + '\n...[truncated]'
    : params.document_content

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a query / document alignment scorer. Your job is to evaluate how well a single document satisfies an ENTIRE QUERY NETWORK rather than a single primary keyword.

A query network is the set of related queries a single ranking page can plausibly satisfy: the primary head term, its modifiers, its sub-questions, its synonyms, and its adjacent intents. A page that ranks #1 for "emergency plumber" also has to satisfy "24 hour plumber", "after hours plumbing", "who to call when pipe bursts", "emergency plumbing cost", and so on. Pages that satisfy only the head term lose long-tail traffic and lose authority because Google sees them as topically thin even when they rank for the head.

If a query_network was not supplied, generate one yourself from the primary_keyword by expanding into:
- 4-7 informational variants (what is / how to / why / when / who)
- 3-5 commercial variants (best / cost / vs / near me / 2025)
- 3-5 transactional variants (buy / hire / book / get / call)
- 3-5 long-tail compound variants (modifier + head, head + qualifier)
Aim for 18-25 queries total in the network. Return them as part of the analysis.

For EACH query in the network, score the document on FOUR dimensions and combine to a 0-100 alignment_score:
1. Term coverage — does the document use the surface tokens of the query and their stems/lemmas? (~25% weight)
2. Semantic similarity — does the document discuss the same concept the query asks about even if wording differs? (~30% weight)
3. Intent match — does the document's tone, format, and CTAs match the query's intent class (informational vs transactional vs commercial vs local)? (~25% weight)
4. Entity coverage — are the named entities the query implies (people, brands, places, products, concepts) present in the document? (~20% weight)

Per-query intent_match label:
- "aligned": intent class of doc matches intent class of query AND alignment_score >= 70
- "partial": same intent family but missing key sub-concepts, OR intent adjacent (e.g. doc is commercial, query is informational about the same thing)
- "mismatch": doc's intent is fundamentally different from the query's (e.g. transactional product page vs informational definition query)

For each query that scored < 65, list 1-3 missing_concepts — specific topics, entities, or sub-questions the document failed to address.

OVERALL:
- overall_alignment_score = average of all per-query alignment_scores
- strongest_aligned_queries = top 5 queries by alignment_score (just the query strings)
- weakest_aligned = bottom 5 queries by alignment_score (just the query strings)
- recommendations = 3-6 concrete actions to raise overall_alignment_score (e.g. "Add a 'cost' section addressing 4 commercial-intent queries currently scoring < 50", "Add named entities X, Y, Z in body copy", "Insert FAQ block targeting the 3 informational sub-questions").

Primary keyword: "${params.primary_keyword}"

Return ONLY valid JSON:
{
  "overall_alignment_score": number,
  "query_scores": [{"query": "string", "alignment_score": number, "intent_match": "aligned|partial|mismatch", "missing_concepts": ["string"]}],
  "strongest_aligned_queries": ["string"],
  "weakest_aligned": ["string"],
  "recommendations": ["string"]
}`,
    messages: [{
      role: 'user',
      content: `${networkBlock ? `QUERY NETWORK (${(params.query_network || []).length} provided):\n${networkBlock}\n\n` : '(No query network provided — generate one from the primary keyword.)\n\n'}DOCUMENT:\n${docPreview}\n\nScore the document against the full query network.`,
    }],
  })

  track(msg, 'kotoiq_query_document_alignment_scorer', params.agencyId)
  return parseJSON<QueryDocumentAlignmentResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 3: Topical Borders Detector
// ═══════════════════════════════════════════════════════════════

export async function runTopicalBordersDetector(ai: AI, params: {
  content: string
  target_central_entity: string
  related_entities?: string[]
  agencyId?: string
}): Promise<TopicalBordersResult> {
  const relatedBlock = (params.related_entities || []).slice(0, 40).map(e => `- ${e}`).join('\n')
  const contentPreview = params.content.length > 14000
    ? params.content.slice(0, 14000) + '\n...[truncated]'
    : params.content

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a topical borders detector. In semantic SEO, every page has a TOPICAL BORDER: the implicit boundary around the target central entity beyond which content becomes off-topic and starts diluting topical authority. Pages that drift across this border lose ranking power even when the off-border content is well-written, because the page begins to resemble multiple intents at once and Google's classifiers down-rank it on every intent.

Your job is paragraph-by-paragraph drift analysis.

PROCESS:
1. Anchor on the target_central_entity. This is the gravity center every paragraph should orbit.
2. Use related_entities (if provided) as an in-border allowlist — entities semantically adjacent to the central entity that are still on-topic. If not provided, infer reasonable in-border entities from the central entity itself.
3. Split the content on paragraph boundaries (blank lines, hard breaks, or sentence runs of >2 sentences). Index from 0.
4. For EACH paragraph, classify as in-topic OR drift.
5. For drift paragraphs, identify the drift_topic (what unrelated topic it pulled in), assign severity, and recommend an action.

SEVERITY GRADING:
- "minor": tangential mention of an off-border topic (e.g. one sentence aside) that doesn't derail the paragraph. Recommended action usually "leave or trim".
- "moderate": paragraph mostly on-topic but spends 30-60% on a drift topic. Recommended action usually "rewrite to refocus" or "split into separate page".
- "severe": paragraph is fundamentally about a different topic than the target central entity. Recommended action usually "remove" or "move to a separate dedicated page".

OVERALL METRICS:
- overall_focus_score (0-100) = (in_topic_paragraph_count / total_paragraphs) × 100, weighted so SEVERE drift penalizes 2x and MODERATE drift 1.5x.
- in_topic_paragraphs_pct = simple percent of paragraphs with no drift flag.
- recommended_removals: list short paragraph previews (first 80 chars) of paragraphs whose recommended_action is "remove".

LIMIT: report up to 25 drift paragraphs. If more exist, report the 25 with highest severity.

Target central entity: "${params.target_central_entity}"
${relatedBlock ? `IN-BORDER RELATED ENTITIES:\n${relatedBlock}` : '(No related entities supplied — infer from the central entity.)'}

For each drift paragraph, text_preview should be the first ~120 chars of the original paragraph (no rewrite).

Return ONLY valid JSON:
{
  "overall_focus_score": number,
  "drift_paragraphs": [{"paragraph_index": number, "text_preview": "string", "drift_topic": "string", "severity": "minor|moderate|severe", "recommended_action": "string"}],
  "in_topic_paragraphs_pct": number,
  "recommended_removals": ["string"]
}`,
    messages: [{
      role: 'user',
      content: `CONTENT:\n${contentPreview}\n\nDetect topical drift relative to "${params.target_central_entity}".`,
    }],
  })

  track(msg, 'kotoiq_topical_borders_detector', params.agencyId)
  return parseJSON<TopicalBordersResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 4: Cornerstone Content Identifier
// ═══════════════════════════════════════════════════════════════

export async function runCornerstoneContentIdentifier(ai: AI, params: {
  pages: {
    url: string
    title: string
    word_count?: number | null
    sc_clicks?: number | null
    sc_impressions?: number | null
    internal_links_in?: number | null
    position?: number | null
  }[]
  topical_clusters?: string[]
  agencyId?: string
}): Promise<CornerstoneContentResult> {
  const pages = params.pages.slice(0, 200)
  const pageBlock = pages.map((p, i) => {
    const wc = p.word_count ?? '?'
    const clicks = p.sc_clicks ?? 0
    const imp = p.sc_impressions ?? 0
    const inLinks = p.internal_links_in ?? 0
    const pos = p.position ?? '?'
    return `${i + 1}. "${(p.title || '').slice(0, 90)}"\n   url: ${p.url}\n   words:${wc} clicks:${clicks} impressions:${imp} inbound_links:${inLinks} avg_pos:${pos}`
  }).join('\n')

  const clusterBlock = (params.topical_clusters || []).slice(0, 30).map(c => `- ${c}`).join('\n')

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a cornerstone content identifier. In semantic SEO, a cornerstone (or pillar) page is the most authoritative, most internally-linked, and broadest expression of a topic on a site. Cornerstone pages are designed to:
- Cover the full breadth of a single topical cluster
- Receive the most internal links from supporting (cluster) pages
- Hold ranks for head-term keywords
- Stay evergreen (low decay rate)
- Funnel link equity inward and outward across a topical hub

Your job is to look at the supplied pages and identify which existing pages are CORRECT cornerstone candidates, which existing pages are ALREADY being treated as cornerstones (and may or may not be the right ones), and where there are GAPS — clusters that should have a cornerstone but don't.

SCORING METHODOLOGY (per candidate, 0-100):
1. Traffic gravity (~30%): high sc_clicks + high sc_impressions + high avg position relative to other pages on this site. Cornerstones earn the most aggregate organic traffic.
2. Topical breadth (~25%): inferred from title/URL, does this page cover a BROAD topic (e.g. "Plumbing Services") rather than a narrow sub-topic (e.g. "How to fix a slow drain")? Cornerstones are the broad ones.
3. Internal link gravity (~20%): high internal_links_in indicates the rest of the site already treats this page as a hub.
4. Content depth (~15%): high word_count signals the page is comprehensive enough to anchor a cluster.
5. Evergreen-ness (~10%): inferred from the title — does this read like a perennial topic (yes: "Guide to X", "X 101"; no: "Q3 2024 Update")?

Per cornerstone candidate, output:
- score (0-100)
- why_cornerstone: 1-2 sentences citing the specific signals that justify the call
- suggested_cluster: the cluster name this page should anchor (use one from topical_clusters if provided, otherwise infer)
- supporting_pages_to_link: 3-7 URLs from the supplied pages that should be internally linked INTO this cornerstone (i.e. supporting cluster pages)
- action: "promote" (already a cornerstone, just amplify), "expand" (right page, needs more depth/content), "merge" (this page should absorb other thin pages), "create_new" (use this only when recommending a brand-new cornerstone — but in that case put the page in the gaps list, not here)

EXISTING CORNERSTONES: list URLs that already function as cornerstones (top 15% by combined traffic + inbound_links) — even if they aren't the optimal candidates.

GAPS: list topical clusters from topical_clusters (or that you infer from the page set) that DO NOT currently have a strong cornerstone candidate. For each, give a recommended_pillar_outline (5-8 H2 bullets) for what a new cornerstone page should cover.

LIMITS:
- Return at most 8 cornerstones (the strongest candidates).
- Return at most 5 gaps.

${clusterBlock ? `KNOWN TOPICAL CLUSTERS:\n${clusterBlock}\n` : '(No clusters provided — infer them from the page set.)\n'}

Return ONLY valid JSON:
{
  "cornerstones": [{"url": "string", "title": "string", "score": number, "why_cornerstone": "string", "suggested_cluster": "string", "supporting_pages_to_link": ["string"], "action": "promote|expand|merge|create_new"}],
  "existing_cornerstones": ["string"],
  "gaps": [{"missing_cornerstone_topic": "string", "recommended_pillar_outline": ["string"]}]
}`,
    messages: [{
      role: 'user',
      content: `PAGES (${pages.length}):\n${pageBlock}\n\nIdentify cornerstone content candidates, existing cornerstones, and gaps.`,
    }],
  })

  track(msg, 'kotoiq_cornerstone_content_identifier', params.agencyId)
  return parseJSON<CornerstoneContentResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 5: Link Proposition Value Scorer
// ═══════════════════════════════════════════════════════════════

export async function runLinkPropositionValueScorer(ai: AI, params: {
  links: {
    source_url: string
    source_topic?: string | null
    target_url: string
    target_topic?: string | null
    anchor_text: string
  }[]
  page_content_map?: { [url: string]: string }
  agencyId?: string
}): Promise<LinkPropositionValueResult> {
  const links = params.links.slice(0, 120)
  const linkBlock = links.map((l, i) => {
    const srcTopic = l.source_topic ? ` [src_topic: ${l.source_topic}]` : ''
    const tgtTopic = l.target_topic ? ` [tgt_topic: ${l.target_topic}]` : ''
    const anchor = (l.anchor_text || '(no anchor)').slice(0, 80)
    return `${i + 1}. ${l.source_url}${srcTopic} → ${l.target_url}${tgtTopic} | anchor: "${anchor}"`
  }).join('\n')

  // Page content excerpts (only when supplied) help anchor topic inference
  const contentMap = params.page_content_map || {}
  const contentEntries = Object.entries(contentMap).slice(0, 40)
  const contentBlock = contentEntries.length
    ? contentEntries.map(([url, c]) => `--- ${url} ---\n${(c || '').slice(0, 400)}`).join('\n\n')
    : ''

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a link proposition value scorer. In semantic SEO, the value of an internal link is NOT determined by raw PageRank flow alone. A link from a high-equity page to a low-relevance target wastes link equity and can even confuse Google's topical models. The semantic-SEO question is: does this link strengthen the topical authority of the target page, or does it bleed unrelated context across the site?

Score every link on FOUR factors:

1. TOPICAL RELEVANCE (0-100, ~40% weight):
   - Are the source and target on the same topic, on adjacent topics within the same cluster, or on unrelated topics?
   - Use source_topic and target_topic when supplied; otherwise infer from URL slugs and any provided page content excerpts.
   - 90+ = same cluster, same intent. 70-89 = adjacent within a cluster. 40-69 = same site / different cluster. 0-39 = unrelated topics.

2. ANCHOR TEXT QUALITY (0-100, ~25% weight):
   - Is the anchor descriptive of the target's topic (good) or generic (bad)?
   - Penalties: generic anchors ("click here", "learn more", "read more", "this article", "here", "more info") cap quality at 30. Naked URLs cap at 25. Image-only anchors cap at 35.
   - Bonuses: descriptive multi-word anchors that include the target's primary topic words score 80+. Exact-match keyword anchors score high but cap at 90 to avoid over-optimization signal.

3. CONTEXTUAL PLACEMENT (0-100, ~20% weight):
   - Inferred from source_topic + anchor: does the link appear to be embedded in topically related body copy (high) vs. boilerplate/footer/sidebar (low)?
   - When source_topic is provided AND anchor relates to that topic, assume contextual placement is high (75+).
   - When the anchor is generic OR source_topic is missing, assume placement is mid (40-60).

4. PAGERANK FLOW POTENTIAL (0-100, ~15% weight):
   - Even semantically perfect links waste equity if the source page has no equity to give. Assume modest equity unless the source URL is a homepage / pillar-style URL (then bump). Penalize links FROM deeply nested URLs (3+ path segments) by ~15.

Combine to overall_value_score = topical_relevance × 0.40 + anchor_quality × 0.25 + contextual_placement × 0.20 + pagerank_flow × 0.15.

Classify:
- "high_value" (>= 80): passes meaningful topical authority. Defend.
- "medium" (60-79): useful but not a power link. Optimize anchor or context.
- "low" (40-59): adds little. Consider better anchor or relocation.
- "waste" (< 40): bleeds equity to an unrelated target OR uses anchor that gives Google no signal. Recommend removal.

OUTPUT METRICS:
- total_passing_value: sum of overall_value_score across all links classified high_value or medium.
- suggestions.remove_low_value: list every link classified "waste" (with source_url, target_url, anchor_text)
- suggestions.add_high_value_opportunities: 3-8 NEW internal-link recommendations inferred from the link graph and page topics — pairs (source, target) where adding a link would clearly strengthen a cluster. Suggest a descriptive anchor for each.

LIMITS:
- Score up to 120 links. If more were sent, score the first 120.
- Return at most 25 entries in remove_low_value.
- Return at most 8 entries in add_high_value_opportunities.

Return ONLY valid JSON:
{
  "links_scored": [{"source_url": "string", "target_url": "string", "anchor_text": "string", "topical_relevance": number, "anchor_quality": number, "overall_value_score": number, "classification": "high_value|medium|low|waste"}],
  "total_passing_value": number,
  "suggestions": {
    "remove_low_value": [{"source": "string", "target": "string", "anchor_text": "string"}],
    "add_high_value_opportunities": [{"source": "string", "target": "string", "suggested_anchor": "string"}]
  }
}`,
    messages: [{
      role: 'user',
      content: `LINKS (${links.length}):\n${linkBlock}\n\n${contentBlock ? `PAGE CONTENT EXCERPTS:\n${contentBlock}\n\n` : ''}Score every link and produce removal + addition suggestions.`,
    }],
  })

  track(msg, 'kotoiq_link_proposition_value_scorer', params.agencyId)
  return parseJSON<LinkPropositionValueResult>(extractText(msg))
}
