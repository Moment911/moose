import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { blendThreeAIs } from '@/lib/multiAiBlender'

// ─────────────────────────────────────────────────────────────────────────────
// Content Brief Engine — extracted from src/app/api/kotoiq/route.ts
//
// Generates a comprehensive SEO content brief using the Multi-AI Blender
// (Claude Sonnet + GPT-4o + Gemini Flash → synthesis).
//
// The original route handler at action === 'generate_brief' now delegates
// to this function.  The request/response shape is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateBriefInput {
  client_id: string
  agency_id?: string | null
  keyword: string
  target_url?: string | null
  page_type?: string | null
}

export interface GenerateBriefOutput {
  brief: Record<string, any> & { id?: string }
  keyword_data: any
}

function fingerprint(kw: string): string {
  return kw.toLowerCase().trim().replace(/\s+/g, ' ')
}

function classifyIntent(kw: string): string {
  const lc = kw.toLowerCase()
  if (/\b(near me|directions to|open now|hours of|drive to|walk to|closest|nearby)\b/.test(lc)) return 'visit_in_place'
  if (/\b\d{5}\b/.test(lc)) return 'visit_in_place'
  if (/\b(in|near)\s+[a-z]{3,}\b/.test(lc) && /\b(buy|hire|find|get|shop|eat|visit|plumber|dentist|lawyer|restaurant|store|salon|repair|service)\b/.test(lc)) return 'visit_in_place'
  if (/^(what is|what are|what does|what do|how much|how many|how long|how far|how old|when does|when is|when did|who is|who are|who was|where is|where are|where do|is it|are there|can you|does|do i need)\b/.test(lc)) return 'answer_seeking'
  if (/\b(buy|price|cost|quote|hire|book|schedule|emergency|same day|24.?hour|free estimate)\b/.test(lc)) return 'transactional'
  if (/\b(best|top|vs|review|compare|affordable|cheap|rated)\b/.test(lc)) return 'commercial'
  if (/\b(how|what|why|when|does|can|is|are|guide|tips|ideas)\b/.test(lc)) return 'informational'
  if (/\b(login|sign in|phone number|address|hours|website)\b/.test(lc)) return 'navigational'
  return 'commercial'
}

export async function generateBrief(
  s: SupabaseClient,
  _ai: unknown,
  body: GenerateBriefInput,
): Promise<GenerateBriefOutput> {
  const { client_id, agency_id, keyword, target_url, page_type } = body
  if (!client_id || !keyword) throw new Error('client_id and keyword required')

  // Get keyword data from UKF
  const fp = fingerprint(keyword)
  const { data: kwData } = await s.from('kotoiq_keywords').select('*').eq('client_id', client_id).eq('fingerprint', fp).single()

  // Get client info
  const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer').eq('id', client_id).single()

  // Fetch top 3 competitor pages for this keyword if we have SC data
  let competitorPages: any[] = []
  if (kwData?.sc_top_page || client?.website) {
    try {
      // Simplified — would use DataForSEO in full version
    } catch { /* skip */ }
  }

  // Generate the brief with Claude
  const briefPrompt = `You are KotoIQ, an elite SEO content strategist. Generate a comprehensive content brief for a new page.

BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || 'Unknown'}
PRIMARY SERVICE: ${client?.primary_service || 'Unknown'}
TARGET CUSTOMER: ${client?.target_customer || 'Unknown'}

TARGET KEYWORD: "${keyword}"
SEARCH INTENT: ${kwData?.intent || classifyIntent(keyword)}
PAGE TYPE: ${page_type || 'service_page'}
SUGGESTED URL: ${target_url || `/${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`}

KEYWORD DATA:
- Monthly search volume: ${kwData?.kp_monthly_volume || 'Unknown'}
- Current organic position: ${kwData?.sc_avg_position ? `#${Math.round(kwData.sc_avg_position)}` : 'Not ranking'}
- Current organic clicks: ${kwData?.sc_clicks || 0}/month
- Competition: ${kwData?.kp_competition || 'Unknown'}
- CPC: ${kwData?.ads_cpc_cents ? `$${(kwData.ads_cpc_cents / 100).toFixed(2)}` : 'Unknown'}
- Opportunity score: ${kwData?.opportunity_score || 'Unknown'}/100
- Rank propensity: ${kwData?.rank_propensity || 'Unknown'}/100
- Client Domain Authority: ${kwData?.moz_da || 'Unknown'}

═══ THE 4-STEP FRAMEWORK (Apply to EVERY brief) ═══

STEP 1 — INFORMATION GAIN ANALYSIS:
Before structuring the brief, analyze what current AI Overviews and top-ranking pages already cover for this keyword. Identify SPECIFIC data points, user pain points, or technical shifts that existing content MISSES. The brief must include at least 3 "information gain" sections — content that adds NEW value no current page provides. If you can't identify the gap, the page isn't worth creating.

STEP 2 — ENTITY-FIRST OPTIMIZATION:
Identify the 15-20 core entities related to this keyword and business. The page must explicitly connect these entities through content AND internal linking. The goal is topical authority — not keyword stuffing. Map entity relationships so the site is seen as an authority graph.

STEP 3 — AI SKELETON + HUMAN EXPERIENCE MARKERS:
Mark each section in the outline as either:
- [AI-READY] — AI can write this section (technical info, definitions, lists)
- [HUMAN-REQUIRED] — Needs original experience: screenshots, proprietary data, case studies, unique methodology, before/after photos, customer stories
Google's "Experience" signal (E in E-E-A-T) is the competitive moat. At least 30% of the page should be marked [HUMAN-REQUIRED].

STEP 4 — PERFORMANCE SIGNALS:
Include specific metrics to track after publishing — which GSC impression share movements indicate the page is gaining authority, what CTR to target at each position, when to update the content.

STEP 5 — SEMANTIC CONTENT ARCHITECTURE (Topical Authority framework):

Define the MAIN CONTENT section:
- What is the macro-context (the ONE primary focus of this page)?
- What are the context-terms and topical entries?
- What heading hierarchy creates the best contextual flow?
- Write the heading vectors: each H2 should process the macro-context; H3s should be connected questions with conditions/qualifiers

Define the SUPPLEMENTARY CONTENT section:
- What micro-contexts support the macro-context?
- What internal links should appear here and with what anchor text?
- What contextual bridges connect this page to other topical map nodes?

Define the CONTEXTUAL BORDER:
- Where does main content end and supplementary content begin?
- What grouper question transitions from macro to micro context?

STEP 6 — TITLE TAG OPTIMIZATION (Entity-Attribute Pairs):
Generate 3 title tag options using these methods:
1. Conjunctive method: "Entity1 and Entity2 for Context" (conditional synonymy)
2. Entity-Attribute method: "Entity: Attribute1 and Attribute2"
3. Hypernym-Hyponym method: "General Term: Specific1, Specific2, Specific3"

Each title should:
- Place the heaviest term (highest search volume word) near the front
- Include the central entity or a synonym
- Stay under 60 characters
- Use conditional synonymy where applicable

STEP 7 — MICRO-SEMANTICS OPTIMIZATION:
For the first 3 heading sections, provide:
- Recommended paragraph opener (first sentence structure that maximizes relevance)
- Key predicates to use (verbs that signal the right context)
- Word sequence optimization notes (which word order creates higher term weight)
- Featured snippet format (if applicable: 40 words, 320 chars, direct answer first)

═══ CONTENT INSTRUCTIONS ═══
1. The brief must beat current top-ranking pages by providing INFORMATION GAIN — not just being longer
2. FAQ questions from real People Also Ask data
3. Schema markup for structured data
4. Entity coverage map for NLP/AEO optimization
5. Written for HUMANS first, optimized for search second
6. City/area mentions for local businesses
7. Target featured snippet AND AI Overview capture
8. Opening paragraph: 40-60 words direct answer (featured snippet target)
9. No generic advice — every recommendation must be specific to THIS keyword and THIS business

Return ONLY valid JSON:
{
  "title_tag": "max 60 chars, keyword first, city, brand last",
  "meta_description": "max 155 chars, keyword, CTA, differentiator",
  "h1": "primary heading, keyword + city naturally",
  "target_url": "/suggested-url-path/",
  "target_word_count": number,
  "outline": [
    {
      "h2": "Section heading",
      "h3s": ["Subsection 1", "Subsection 2"],
      "key_points": ["What to cover in this section"],
      "word_count_target": number
    }
  ],
  "schema_types": ["LocalBusiness", "FAQPage", "Service", "BreadcrumbList"],
  "faq_questions": [
    { "question": "Exact question to answer", "answer_guidance": "What to include in the answer (40-60 words for featured snippet)" }
  ],
  "target_entities": ["entity1", "entity2"],
  "internal_links": {
    "link_to_this_page_from": ["homepage", "services hub", "related service page"],
    "link_from_this_page_to": ["related services", "location pages", "contact page"]
  },
  "content_guidelines": {
    "opening_paragraph": "40-60 word direct answer to the query intent (featured snippet target)",
    "tone": "professional but approachable",
    "cta_placement": "after intro, mid-page, end of page",
    "image_suggestions": ["type of image 1", "type of image 2"],
    "differentiator_angle": "what makes this page unique vs competitors"
  },
  "information_gain": {
    "gaps_in_current_content": ["specific gap 1", "gap 2", "gap 3"],
    "unique_value_propositions": ["what THIS page will provide that no other page does"],
    "ai_overview_gaps": "what the current AI Overview for this query misses"
  },
  "experience_markers": {
    "human_required_sections": ["sections that NEED original human experience/data/screenshots"],
    "ai_ready_sections": ["sections AI can generate well"],
    "experience_percentage": "estimated % of page that needs human input"
  },
  "entity_map": {
    "core_entities": ["entity1", "entity2"],
    "entity_relationships": ["entity1 → entity2 (how they connect)"],
    "topical_authority_gaps": ["entities competitors cover that you don't"]
  },
  "performance_tracking": {
    "target_ctr_by_position": {"pos_1": 0.28, "pos_3": 0.12, "pos_10": 0.025},
    "impression_share_goal_30d": "expected impression count after 30 days",
    "content_refresh_trigger": "refresh if impressions drop 20% week-over-week"
  },
  "estimated_monthly_traffic": number,
  "ranking_timeline": "estimated weeks/months to rank based on competition",
  "aeo_optimization": {
    "target_snippet_type": "paragraph|list|table|faq",
    "ai_overview_eligible": true,
    "optimization_notes": "specific tips for AI citation",
    "suggested_searches_to_target": ["related searches that should become new pages"]
  },
  "main_content_sections": [
    {
      "heading": "H2 heading that processes the macro-context",
      "macro_context": "the primary focus this section addresses",
      "context_terms": ["term1", "term2"],
      "heading_vector": "how this H2 connects to the macro-context",
      "sub_sections": [
        { "h3": "Connected question with condition/qualifier", "key_predicates": ["verb1", "verb2"] }
      ]
    }
  ],
  "supplementary_content_sections": [
    {
      "heading": "Supplementary section heading",
      "micro_context": "what micro-context this supports",
      "internal_link_anchors": [{ "text": "anchor text", "target_page": "/target-url/" }],
      "contextual_bridge": "how this connects to other topical map nodes"
    }
  ],
  "contextual_border": {
    "main_content_ends_at": "heading or section name where main content ends",
    "supplementary_begins_at": "heading or section name where supplementary begins",
    "grouper_question": "transition question from macro to micro context"
  },
  "title_options": [
    { "method": "conjunctive", "title": "Entity1 and Entity2 for Context", "rationale": "why this works" },
    { "method": "entity_attribute", "title": "Entity: Attribute1 and Attribute2", "rationale": "why this works" },
    { "method": "hypernym_hyponym", "title": "General: Specific1, Specific2", "rationale": "why this works" }
  ],
  "micro_semantic_notes": [
    {
      "section": "section heading",
      "paragraph_opener": "recommended first sentence structure",
      "key_predicates": ["verbs that signal the right context"],
      "word_sequence_notes": "which word order creates higher term weight",
      "snippet_format": "featured snippet format if applicable"
    }
  ]
}`

  const blend = await blendThreeAIs({
    systemPrompt: 'You are KotoIQ content strategist applying Semantic SEO principles. Return ONLY valid JSON. No markdown.',
    userPrompt: briefPrompt,
    synthesisInstruction: 'Merge these content briefs into one elite brief — take the sharpest information-gain analysis, the deepest entity coverage, the best title/meta candidates, and the most specific human-required sections. Preserve the exact JSON schema.',
    feature: 'kotoiq_generate_brief_blended',
    agencyId: agency_id ?? undefined,
    maxTokens: 8000,
  })

  const raw = blend.synthesized || '{}'
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const brief = JSON.parse(cleaned)

  // Save to database
  const { data: saved } = await s.from('kotoiq_content_briefs').insert({
    client_id,
    agency_id: agency_id || null,
    target_keyword: keyword,
    target_url: brief.target_url || target_url,
    page_type: page_type || 'service_page',
    title_tag: brief.title_tag,
    meta_description: brief.meta_description,
    h1: brief.h1,
    outline: brief.outline,
    schema_types: brief.schema_types,
    faq_questions: brief.faq_questions,
    target_word_count: brief.target_word_count,
    target_entities: brief.target_entities,
    competitor_analysis: competitorPages.length > 0 ? competitorPages : null,
    opportunity_score: kwData?.opportunity_score || null,
    rank_propensity: kwData?.rank_propensity || null,
    estimated_monthly_traffic: brief.estimated_monthly_traffic || null,
    semantic_data: {
      main_content_sections: brief.main_content_sections || [],
      supplementary_content_sections: brief.supplementary_content_sections || [],
      contextual_border: brief.contextual_border || null,
      title_options: brief.title_options || [],
      micro_semantic_notes: brief.micro_semantic_notes || [],
    },
  }).select().single()

  return { brief: { id: saved?.id, ...brief }, keyword_data: kwData }
}
