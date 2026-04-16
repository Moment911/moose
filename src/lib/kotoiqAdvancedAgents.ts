// ─────────────────────────────────────────────────────────────
// KotoIQ Advanced Semantic SEO Agents
//
// A second wave of semantic intelligence agents built on top of
// the existing Tier 1-3 agents. These lean on cross-dataset
// context (topical maps, snapshot history, competitor sitemaps)
// to produce higher-order strategic signals.
//
// Agents:
// 1. Topical Authority Auditor — cluster-level authority score
// 2. Context Vector Aligner — intent-to-outline alignment
// 3. Multi-Engine AEO Scorer — 5-engine citation eligibility
// 4. Content Decay Predictor — 30/60/90 day position forecast
// 5. Competitor Topical Map Extractor — infer rival site maps
// 6. Passage Ranking Optimizer — per-paragraph snippet scoring
// ─────────────────────────────────────────────────────────────

import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any

const MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 3000

// ── Types ────────────────────────────────────────────────────

export interface TopicalAuthorityResult {
  authority_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  topical_coverage: number
  historical_data_strength: number
  content_depth: number
  competitive_position: number
  cluster_scores: {
    cluster_name: string
    score: number
    strengths: string[]
    gaps: string[]
  }[]
  overall_verdict: string
  recommendations: string[]
}

export interface ContextVectorAlignerResult {
  alignment_score: number
  vector_match: 'aligned' | 'partial' | 'misaligned'
  missing_contexts: string[]
  extraneous_contexts: string[]
  recommended_outline_adjustments: {
    position: string
    action: 'add' | 'remove' | 'reframe' | 'reorder' | 'merge' | 'split'
    suggestion: string
  }[]
  dominant_user_intent_vector: string
  warning?: string
}

export interface EngineScore {
  score: number
  eligibility: 'strong' | 'moderate' | 'weak' | 'ineligible'
  factors: string[]
  citation_likelihood?: number
}

export interface MultiEngineAEOResult {
  engines: {
    google_ai_overview: EngineScore
    perplexity: EngineScore & { citation_likelihood: number }
    chatgpt_search: EngineScore
    claude: EngineScore
    copilot: EngineScore
  }
  overall_aeo_score: number
  top_recommendations: string[]
  best_positioned_for: string[]
}

export interface ContentDecayResult {
  decay_risk: 'low' | 'medium' | 'high' | 'critical'
  predicted_position_30d: number
  predicted_position_60d: number
  predicted_position_90d: number
  predicted_clicks_loss_90d: number
  decay_factors: string[]
  recommended_refresh_date: string
  refresh_priority: 1 | 2 | 3 | 4 | 5
}

export interface CompetitorTopicalMapResult {
  inferred_central_entity: string
  inferred_source_context: string
  core_section_topics: {
    topic: string
    urls_count: number
    estimated_depth: 'shallow' | 'moderate' | 'deep'
  }[]
  outer_section_topics: {
    topic: string
    urls_count: number
    estimated_depth: 'shallow' | 'moderate' | 'deep'
  }[]
  topical_map_size: number
  coverage_vs_client: {
    shared: string[]
    competitor_advantage: string[]
    client_advantage: string[]
  }
  strategic_insights: string[]
}

export interface PassageRankingResult {
  passages: {
    index: number
    text: string
    current_snippet_score: number
    optimized_text: string
    optimization_reason: string
    snippet_type: 'paragraph' | 'list' | 'table' | 'answer_box'
  }[]
  best_passage_index: number
  overall_snippet_readiness: number
  optimization_suggestions: string[]
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
// Agent 1: Topical Authority Auditor
// ═══════════════════════════════════════════════════════════════

export async function runTopicalAuthorityAuditor(ai: AI, params: {
  central_entity?: string
  source_context?: string
  topical_nodes: {
    entity: string
    section: 'core' | 'outer' | string
    status: 'covered' | 'partial' | 'gap' | string
    priority?: number
    macro_context?: string
    existing_url?: string | null
    search_volume?: number | null
  }[]
  keywords: {
    keyword: string
    current_position?: number | null
    position_30d_ago?: number | null
    position_90d_ago?: number | null
    search_volume?: number | null
    clicks?: number | null
    impressions?: number | null
    category?: string
  }[]
  domain_authority?: number | null
  competitor_domain_authorities?: number[]
  business_context?: string
  agencyId?: string
}): Promise<TopicalAuthorityResult> {
  const nodeBlock = params.topical_nodes.slice(0, 120).map(n =>
    `- [${n.section}|${n.status}] "${n.entity}"${n.macro_context ? ` — ${n.macro_context}` : ''}${n.existing_url ? ' (published)' : ''}`
  ).join('\n')

  const keywordBlock = params.keywords.slice(0, 80).map(k => {
    const delta30 = k.current_position && k.position_30d_ago ? (k.position_30d_ago - k.current_position) : null
    const delta90 = k.current_position && k.position_90d_ago ? (k.position_90d_ago - k.current_position) : null
    const trajectory = delta90 !== null ? (delta90 > 1 ? 'rising' : delta90 < -1 ? 'falling' : 'stable') : 'unknown'
    return `- "${k.keyword}" — pos ${k.current_position ?? '?'} (30d:${k.position_30d_ago ?? '?'}, 90d:${k.position_90d_ago ?? '?'}) Δ90:${delta90 ?? '?'} [${trajectory}] vol:${k.search_volume ?? '?'} clicks:${k.clicks ?? 0}`
  }).join('\n')

  const daLine = params.domain_authority !== null && params.domain_authority !== undefined
    ? `Client domain authority: ${params.domain_authority}`
    : 'Client domain authority: unknown'
  const competitorDALine = params.competitor_domain_authorities?.length
    ? `Competitor DAs: ${params.competitor_domain_authorities.join(', ')} (avg ${Math.round(params.competitor_domain_authorities.reduce((a, b) => a + b, 0) / params.competitor_domain_authorities.length)})`
    : 'Competitor DAs: unknown'

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a topical authority auditor. Your job is to roll up four independent signals into a single cluster-level authority score for a client's site.

The four signals are:
1. TOPICAL COVERAGE — what share of the planned topical map is actually published? Covered nodes count 1.0, partial 0.5, gap 0. Weight core nodes 2x outer.
2. HISTORICAL DATA STRENGTH — do keywords in this cluster have improving trajectories over 30 and 90 days? Rising positions signal compounding authority. Falling positions signal decay. Stable top-10 positions count as strong authority.
3. CONTENT DEPTH — number of covered nodes per cluster, plus whether the published content covers both core and outer entities. A cluster with only outer content lacks foundational authority. Shallow clusters (1-2 covered nodes) cap at 40 score.
4. COMPETITIVE POSITION — client DA vs competitor DA. If the client DA is materially below competitors, even strong coverage caps authority around 70. If client DA matches or exceeds, coverage+trajectory can push authority to 90+.

GROUPING RULE: Group the topical_nodes into clusters by their macro_context or by semantic proximity of their entity names. A cluster should contain 3-15 related nodes. Aim for 4-8 clusters total. Give each a short descriptive name (e.g. "Emergency Plumbing Services", "Drain Cleaning Techniques").

For each cluster, produce:
- score (0-100): weighted average of the four signals restricted to that cluster
- strengths: 1-3 reasons this cluster is strong (cite specific nodes / keywords)
- gaps: 1-3 concrete gaps (missing core entities, falling rankings, thin depth)

Grading scale: A >= 90, B 75-89, C 60-74, D 40-59, F < 40.

${params.central_entity ? `Central entity: ${params.central_entity}` : ''}
${params.source_context ? `Source context: ${params.source_context}` : ''}
${params.business_context ? `Business: ${params.business_context}` : ''}
${daLine}
${competitorDALine}

Return ONLY valid JSON (no prose, no markdown):
{
  "authority_score": number,
  "grade": "A|B|C|D|F",
  "topical_coverage": number,
  "historical_data_strength": number,
  "content_depth": number,
  "competitive_position": number,
  "cluster_scores": [{"cluster_name": "string", "score": number, "strengths": ["string"], "gaps": ["string"]}],
  "overall_verdict": "string",
  "recommendations": ["string"]
}`,
    messages: [{
      role: 'user',
      content: `TOPICAL NODES (${params.topical_nodes.length} total, showing up to 120):
${nodeBlock}

KEYWORD PERFORMANCE WITH TRAJECTORIES (${params.keywords.length} total, showing up to 80):
${keywordBlock}

Score this site's topical authority.`,
    }],
  })

  track(msg, 'kotoiq_topical_authority_auditor', params.agencyId)
  return parseJSON<TopicalAuthorityResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 2: Context Vector Aligner
// ═══════════════════════════════════════════════════════════════

export async function runContextVectorAligner(ai: AI, params: {
  target_keyword: string
  planned_content_outline: { heading: string; level?: 'h1' | 'h2' | 'h3'; notes?: string }[] | string[]
  competitor_h2s?: string[]
  query_intent?: string
  business_context?: string
  agencyId?: string
}): Promise<ContextVectorAlignerResult> {
  const outlineBlock = Array.isArray(params.planned_content_outline)
    ? (params.planned_content_outline as any[]).map((o, i) => {
      if (typeof o === 'string') return `${i + 1}. ${o}`
      return `${i + 1}. [${o.level || 'h2'}] ${o.heading}${o.notes ? ` — ${o.notes}` : ''}`
    }).join('\n')
    : ''

  const competitorBlock = params.competitor_h2s?.length
    ? params.competitor_h2s.map(h => `- ${h}`).join('\n')
    : '(no competitor data provided)'

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a semantic context vector aligner. Your task is to evaluate whether a planned content outline matches the dominant user-intent vector for the target keyword.

A "context vector" is the implicit set of sub-questions, entities, and sub-intents that users who search this keyword expect to see addressed. It is defined by:
1. The literal meaning of the keyword phrase
2. The stated query_intent (if provided)
3. The CONSENSUS structure of top-ranking competitor content (H2 patterns reveal what Google thinks answers this query)

YOUR JOB:
1. Infer the dominant user-intent vector from the keyword + intent + competitor H2s. State it as a single sentence.
2. Score the outline's ALIGNMENT with that vector on 0-100.
3. Identify MISSING contexts — sub-topics that the intent vector demands but the outline does not cover. Pull these from competitor H2 patterns when available.
4. Identify EXTRANEOUS contexts — outline items that drift away from the intent vector. Content that helps one intent can hurt another (informational vs transactional blending is a common mistake).
5. Recommend specific adjustments with action = add | remove | reframe | reorder | merge | split.

Vector match grading:
- "aligned": score >= 80. Outline matches the vector closely.
- "partial": 55-79. Outline addresses the core but misses 1-3 key contexts or includes 1-2 drifts.
- "misaligned": < 55. Outline addresses a different intent than the keyword demands.

If the intent appears to be split (e.g. keyword could be informational OR transactional), issue a warning explaining the split and which intent the outline currently leans toward.

Target keyword: "${params.target_keyword}"
${params.query_intent ? `Stated intent: ${params.query_intent}` : ''}
${params.business_context ? `Business: ${params.business_context}` : ''}

Return ONLY valid JSON:
{
  "alignment_score": number,
  "vector_match": "aligned|partial|misaligned",
  "missing_contexts": ["string"],
  "extraneous_contexts": ["string"],
  "recommended_outline_adjustments": [{"position": "string", "action": "add|remove|reframe|reorder|merge|split", "suggestion": "string"}],
  "dominant_user_intent_vector": "string",
  "warning": "string (optional - only if intent is split or outline drifts)"
}`,
    messages: [{
      role: 'user',
      content: `PLANNED OUTLINE:
${outlineBlock}

COMPETITOR H2 PATTERNS:
${competitorBlock}

Score the context vector alignment.`,
    }],
  })

  track(msg, 'kotoiq_context_vector_aligner', params.agencyId)
  return parseJSON<ContextVectorAlignerResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 3: Multi-Engine AEO Scorer
// ═══════════════════════════════════════════════════════════════

export async function runMultiEngineAEO(ai: AI, params: {
  content: string
  keyword: string
  url?: string
  has_schema?: boolean
  has_citations?: boolean
  agencyId?: string
}): Promise<MultiEngineAEOResult> {
  const contentPreview = params.content.length > 10000
    ? params.content.slice(0, 10000) + '\n...[truncated]'
    : params.content

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a multi-engine Answer Engine Optimization analyst. You evaluate whether a piece of content is likely to be cited/surfaced by five distinct AI search engines, each of which weighs ranking factors differently.

ENGINE PROFILES — score each 0-100 independently:

1. GOOGLE AI OVERVIEW
   - Favors: declarative one-sentence answers in the first paragraph, schema.org structured data, HowTo/FAQ/Article schema, entity-rich factual claims, passage-level extractability, pages already ranking in top 10.
   - Penalizes: opinion-heavy prose, listicles without structured data, walls of text, thin pages.
   - eligibility: "strong" if has_schema + factual opening + ranks/would rank top 10.

2. PERPLEXITY
   - Favors: authoritative-sounding sources, outbound citations to reputable domains, dense factual content, recent publication dates, statistics with numbers, comparison tables. Perplexity prefers to cite multiple sources per answer.
   - Penalizes: promotional tone, lack of citations, undated content.
   - citation_likelihood: estimate 0-100 probability this page gets cited in a Perplexity answer for the keyword.

3. CHATGPT SEARCH (GPT-4o browse + OpenAI SearchGPT)
   - Favors: conversational clarity, step-by-step structure, direct answers to common sub-questions, content that reads like a knowledgeable person explaining. De-emphasizes link-building; emphasizes content substance.
   - Penalizes: jargon without definitions, keyword-stuffed intros, outdated content.

4. CLAUDE (Anthropic's web tool)
   - Favors: nuanced reasoning, acknowledgment of tradeoffs, primary sources, long-form depth over brevity, content that cites its own sources, balanced viewpoints.
   - Penalizes: unsubstantiated claims, marketing fluff, polarized framing.

5. COPILOT (Microsoft / Bing chat)
   - Favors: Bing-indexed pages, Microsoft-ecosystem topics, clear H2 structure, content that matches Bing's ranking (which still rewards exact-match anchor text and older link equity), JSON-LD schema.
   - Penalizes: pages not well-indexed on Bing, JS-heavy rendering.

For each engine, list the top 2-4 FACTORS (from the profile above) that actually affect this content's score — be specific, cite evidence from the content.

"best_positioned_for" = the engines with eligibility "strong". Empty array if none.

overall_aeo_score = average of all 5 engine scores, weighted: Google 0.3, Perplexity 0.2, ChatGPT 0.2, Claude 0.15, Copilot 0.15.

Target keyword: "${params.keyword}"
${params.url ? `URL: ${params.url}` : ''}
Structured data present: ${params.has_schema ? 'yes' : 'unknown/no'}
Outbound citations present: ${params.has_citations ? 'yes' : 'unknown/no'}

Return ONLY valid JSON:
{
  "engines": {
    "google_ai_overview": {"score": number, "eligibility": "strong|moderate|weak|ineligible", "factors": ["string"]},
    "perplexity": {"score": number, "eligibility": "strong|moderate|weak|ineligible", "factors": ["string"], "citation_likelihood": number},
    "chatgpt_search": {"score": number, "eligibility": "strong|moderate|weak|ineligible", "factors": ["string"]},
    "claude": {"score": number, "eligibility": "strong|moderate|weak|ineligible", "factors": ["string"]},
    "copilot": {"score": number, "eligibility": "strong|moderate|weak|ineligible", "factors": ["string"]}
  },
  "overall_aeo_score": number,
  "top_recommendations": ["string"],
  "best_positioned_for": ["string"]
}`,
    messages: [{ role: 'user', content: `Score this content for all 5 AI search engines:\n\n${contentPreview}` }],
  })

  track(msg, 'kotoiq_multi_engine_aeo', params.agencyId)
  return parseJSON<MultiEngineAEOResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 4: Content Decay Predictor
// ═══════════════════════════════════════════════════════════════

export async function runContentDecayPredictor(ai: AI, params: {
  url: string
  keyword?: string
  current_position: number
  position_30d_ago?: number | null
  position_90d_ago?: number | null
  position_180d_ago?: number | null
  last_updated?: string | null
  word_count?: number | null
  competitor_freshness_days?: number | null
  current_clicks_monthly?: number | null
  search_volume?: number | null
  agencyId?: string
}): Promise<ContentDecayResult> {
  const trajectory = []
  if (params.position_180d_ago) trajectory.push(`180d ago: pos ${params.position_180d_ago}`)
  if (params.position_90d_ago) trajectory.push(`90d ago: pos ${params.position_90d_ago}`)
  if (params.position_30d_ago) trajectory.push(`30d ago: pos ${params.position_30d_ago}`)
  trajectory.push(`today: pos ${params.current_position}`)

  const daysSinceUpdate = params.last_updated
    ? Math.round((Date.now() - new Date(params.last_updated).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a content decay predictor. Your job is to forecast how a page's ranking position will change over the next 30, 60, and 90 days if no action is taken, and recommend a refresh priority.

DECAY DRIVERS you must weigh:
1. VELOCITY — the 30/90/180 day position trajectory. If the page has moved from pos 5 → 7 → 11 over 180 days, it is decaying ~3 positions per quarter and will likely continue. Extrapolate linearly unless a freshness spike is warranted.
2. FRESHNESS GAP — days since last_updated vs competitor_freshness_days. If the client page is 400 days old and competitors publish fresh content every 90 days, freshness gap is severe — add 3-5 positions of decay over 90d.
3. CONTENT DEPTH — word_count vs topic norms. Thin content (<600 words) on competitive topics decays faster. 2000+ word content with regular updates decays slowest.
4. POSITIONAL PHYSICS — top 3 positions are sticky (small decay), positions 4-10 have moderate volatility, 11-20 are the most unstable (either break into top 10 or fall to page 2+).
5. CTR IMPACT — estimate clicks_loss_90d using standard CTR curves: pos 1=28%, 2=15%, 3=10%, 4=7%, 5=5%, 6=4%, 7=3%, 8=2.5%, 9=2%, 10=1.5%, 11-20=0.8%, 21+=0.2%. clicks_loss = search_volume * (current_CTR - predicted_CTR_at_90d).

RISK GRADING:
- "low": predicted_position_90d within 2 of current, page is fresh (<180 days), content is substantial.
- "medium": 3-5 position drop predicted, or 180-365 days old, or thin content.
- "high": 6-10 position drop predicted, or content >365 days old on volatile topic, or already trending down sharply.
- "critical": predicted drop out of top 20, or the page is currently top 10 and 90d trajectory shows falling >3 positions.

REFRESH PRIORITY 1-5:
- 1 = refresh this week (critical loss imminent on high-value page)
- 2 = refresh this month (high-risk or high clicks loss predicted)
- 3 = refresh this quarter (medium risk)
- 4 = monitor (low risk but aging)
- 5 = no action needed

recommended_refresh_date: ISO date (YYYY-MM-DD) assuming today is ${new Date().toISOString().split('T')[0]}.

decay_factors: the 2-4 specific drivers pulling this page down. Be concrete.

URL: ${params.url}
${params.keyword ? `Target keyword: ${params.keyword}` : ''}
Trajectory: ${trajectory.join(' → ')}
${daysSinceUpdate !== null ? `Days since last update: ${daysSinceUpdate}` : 'Last updated: unknown'}
${params.word_count ? `Word count: ${params.word_count}` : ''}
${params.competitor_freshness_days ? `Competitor avg freshness: ${params.competitor_freshness_days} days` : ''}
${params.current_clicks_monthly ? `Current monthly clicks: ${params.current_clicks_monthly}` : ''}
${params.search_volume ? `Search volume: ${params.search_volume}/mo` : ''}

Return ONLY valid JSON:
{
  "decay_risk": "low|medium|high|critical",
  "predicted_position_30d": number,
  "predicted_position_60d": number,
  "predicted_position_90d": number,
  "predicted_clicks_loss_90d": number,
  "decay_factors": ["string"],
  "recommended_refresh_date": "YYYY-MM-DD",
  "refresh_priority": 1
}`,
    messages: [{ role: 'user', content: `Predict decay for this page and recommend refresh timing.` }],
  })

  track(msg, 'kotoiq_content_decay_predictor', params.agencyId)
  return parseJSON<ContentDecayResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 5: Competitor Topical Map Extractor
// ═══════════════════════════════════════════════════════════════

export async function runCompetitorTopicalMapExtractor(ai: AI, params: {
  competitor_url: string
  sitemap_urls: string[]
  client_central_entity?: string
  client_topics?: string[]
  agencyId?: string
}): Promise<CompetitorTopicalMapResult> {
  const sampleUrls = params.sitemap_urls.slice(0, 150)
  const urlBlock = sampleUrls.join('\n')

  const clientTopicsBlock = params.client_topics?.length
    ? params.client_topics.map(t => `- ${t}`).join('\n')
    : '(no client topic list provided)'

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a competitor topical map extractor. From a competitor's sitemap URL list, infer the structure of their topical authority map — what they have organized their site around.

URL SLUG ANALYSIS:
- Group URLs by their path prefix patterns (/services/*, /blog/*, /locations/*, /guides/*).
- Within each group, derive the topic each URL covers from its slug (e.g. /services/emergency-plumbing → "Emergency Plumbing").
- Count URLs per topic to estimate how much coverage they have given it.

INFERENCE RULES:
1. CENTRAL ENTITY — the single concept that ties the competitor's entire site together. Derive from homepage path patterns + dominant URL stems.
2. SOURCE CONTEXT — the business model / positioning hinted at by the site structure (e.g. "24/7 commercial plumbing contractor serving metro Denver").
3. CORE SECTION TOPICS — the high-priority entities they treat as core authority (typically main service/product pages, hub pages, pillar content). Usually 5-12 topics. Each topic should have multiple URLs supporting it.
4. OUTER SECTION TOPICS — supporting content (blog posts, guides, FAQs, glossary entries) that reinforces core topics. Usually 10-40 topics.
5. ESTIMATED DEPTH per topic:
   - "shallow" = 1-2 URLs on this topic
   - "moderate" = 3-7 URLs
   - "deep" = 8+ URLs (indicates genuine topical authority)

COVERAGE COMPARISON (only if client_topics provided):
- shared: topics both client and competitor cover
- competitor_advantage: topics competitor covers deeply that client does not
- client_advantage: topics client covers that competitor does not

STRATEGIC INSIGHTS: 3-5 concrete observations like "Competitor has 12 URLs on 'drain cleaning' subtopics — they are defending this cluster aggressively" or "Competitor lacks location pages — opportunity for local SEO".

Competitor URL: ${params.competitor_url}
Total URLs in sitemap sample: ${sampleUrls.length}
${params.client_central_entity ? `Client central entity (for comparison): ${params.client_central_entity}` : ''}

CLIENT TOPICS:
${clientTopicsBlock}

Return ONLY valid JSON:
{
  "inferred_central_entity": "string",
  "inferred_source_context": "string",
  "core_section_topics": [{"topic": "string", "urls_count": number, "estimated_depth": "shallow|moderate|deep"}],
  "outer_section_topics": [{"topic": "string", "urls_count": number, "estimated_depth": "shallow|moderate|deep"}],
  "topical_map_size": number,
  "coverage_vs_client": {"shared": ["string"], "competitor_advantage": ["string"], "client_advantage": ["string"]},
  "strategic_insights": ["string"]
}`,
    messages: [{ role: 'user', content: `COMPETITOR URLS (${sampleUrls.length}):\n${urlBlock}\n\nExtract the competitor's topical map.` }],
  })

  track(msg, 'kotoiq_competitor_topical_map_extractor', params.agencyId)
  return parseJSON<CompetitorTopicalMapResult>(extractText(msg))
}

// ═══════════════════════════════════════════════════════════════
// Agent 6: Passage Ranking Optimizer
// ═══════════════════════════════════════════════════════════════

export async function runPassageRankingOptimizer(ai: AI, params: {
  content: string
  keyword: string
  user_question?: string
  agencyId?: string
}): Promise<PassageRankingResult> {
  const contentPreview = params.content.length > 12000
    ? params.content.slice(0, 12000) + '\n...[truncated]'
    : params.content

  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: `You are a passage ranking optimizer. Google's passage ranking indexes individual paragraphs and can surface them as featured snippets, answer boxes, and AI Overview citations independently of overall page rank. Your job is to split the content into passages, score each passage's snippet eligibility, and produce an optimized version of each.

PASSAGE SPLITTING:
- Split on paragraph boundaries (double newlines, or semantic breaks within long paragraphs).
- Target passage length for snippets: 40-60 words (optimal), 30-80 words (acceptable).
- Each passage should be self-contained — readable without the surrounding page.

PER-PASSAGE SCORING (0-100):
Score each passage on:
1. Self-containment — can it stand alone? (cannot reference "this", "above", "as mentioned")
2. Answer-directness — does it directly answer a question implied by the keyword?
3. Length fitness — 40-60 words ideal, penalize <30 or >80.
4. Structural clarity — simple declarative sentences, 1-2 per passage.
5. Entity density — names specific entities, numbers, or attributes users would scan for.

SNIPPET TYPE CLASSIFICATION:
- "paragraph": direct factual answer as prose
- "list": enumerated steps or items
- "table": comparison with rows/columns (if content has tabular data)
- "answer_box": yes/no or one-sentence direct answer

OPTIMIZED VERSION:
For each passage, produce an optimized_text that:
- Rewrites to 40-60 words
- Removes references that break self-containment
- Adds a declarative topic sentence if missing
- Preserves all factual claims (never invent facts)
- Keeps the original's voice
- For "list" or "table" types, format the rewrite accordingly

optimization_reason: 1 sentence on what the rewrite fixed.

Target keyword: "${params.keyword}"
${params.user_question ? `Implied user question: ${params.user_question}` : ''}

best_passage_index = index of the highest-scoring passage (the one most likely to be featured).
overall_snippet_readiness = average of all current_snippet_scores.
optimization_suggestions: 3-5 cross-cutting improvements (e.g. "add a definition paragraph at the top", "include a step-by-step numbered list near the middle").

LIMIT: return at most 20 passages. If content has more than 20 paragraphs, prioritize the top 20 by snippet potential.

Return ONLY valid JSON:
{
  "passages": [{"index": number, "text": "string (original)", "current_snippet_score": number, "optimized_text": "string", "optimization_reason": "string", "snippet_type": "paragraph|list|table|answer_box"}],
  "best_passage_index": number,
  "overall_snippet_readiness": number,
  "optimization_suggestions": ["string"]
}`,
    messages: [{ role: 'user', content: `Optimize passages in this content for snippet eligibility:\n\n${contentPreview}` }],
  })

  track(msg, 'kotoiq_passage_ranking_optimizer', params.agencyId)
  return parseJSON<PassageRankingResult>(extractText(msg))
}
