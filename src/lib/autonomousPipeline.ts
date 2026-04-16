import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — Autonomous Content Pipeline
//
// End-to-end content generation pipeline:
//   1. Generate content brief (semantic SEO framework)
//   2. Write full page (12 semantic agents)
//   3. Post-process: plagiarism, watermark removal, on-page audit
//   4. Generate JSON-LD schema markup
//   5. Compute Human Score = avg(plagiarism, watermark, on-page)
//   6. Approve if >= 85; flag for review otherwise
//   7. Optional: auto-publish via WordPress plugin bridge
//   8. Persist every step to kotoiq_pipeline_runs
//
// Called via POST /api/kotoiq action: run_autonomous_pipeline
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { checkPlagiarism } from '@/lib/plagiarismEngine'
import { removeAIWatermarks } from '@/lib/watermarkRemover'
import { analyzeOnPage } from '@/lib/onPageEngine'

// ── Types ───────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface PipelineStep {
  step: string
  status: StepStatus
  duration_ms: number
  output_preview?: string
  error?: string
}

interface PipelineInput {
  client_id: string
  agency_id?: string | null
  keyword: string
  auto_publish?: boolean
  target_url?: string | null
  page_type?: string | null
}

interface PipelineResult {
  run_id: string | null
  status: 'completed' | 'flagged' | 'failed'
  brief: any
  content_html: string
  plain_text: string
  human_score: number
  topicality_score: number
  plagiarism_score: number
  on_page_score: number
  schema_json_ld: any[]
  steps: PipelineStep[]
  auto_published: boolean
  published_url: string | null
  flagged_reasons?: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function preview(s: string | null | undefined, n = 180): string {
  if (!s) return ''
  const clean = String(s).replace(/\s+/g, ' ').trim()
  return clean.length <= n ? clean : clean.slice(0, n) + '…'
}

function classifyIntent(kw: string): string {
  const lc = kw.toLowerCase()
  if (/\b(buy|hire|price|pricing|cost|near me|book)\b/.test(lc)) return 'transactional'
  if (/\b(best|top|review|vs|compare|alternative)\b/.test(lc)) return 'commercial'
  if (/\b(how|what|why|when|where|guide|tutorial)\b/.test(lc)) return 'informational'
  return 'commercial'
}

function cleanJSON(raw: string): string {
  return raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
}

// ── Main entry: run_autonomous_pipeline ─────────────────────────────────────
export async function runAutonomousPipeline(
  s: SupabaseClient,
  ai: Anthropic,
  body: PipelineInput
): Promise<PipelineResult> {
  const { client_id, agency_id, keyword, auto_publish, target_url, page_type } = body

  if (!client_id || !keyword) {
    throw new Error('client_id and keyword are required')
  }

  // ── Create run row up front so every downstream error can be persisted ──
  let run_id: string | null = null
  try {
    const { data: runRow } = await s.from('kotoiq_pipeline_runs').insert({
      client_id,
      agency_id: agency_id || null,
      keyword,
      status: 'running',
      steps: [],
    }).select('id').single()
    run_id = runRow?.id || null
  } catch { /* table may not exist yet — continue without persistence */ }

  const steps: PipelineStep[] = []

  const persistStep = async (step: PipelineStep) => {
    steps.push(step)
    if (!run_id) return
    try {
      await s.from('kotoiq_pipeline_runs').update({ steps }).eq('id', run_id)
    } catch { /* non-blocking */ }
  }

  const startStep = (name: string): PipelineStep => ({
    step: name,
    status: 'running',
    duration_ms: 0,
  })

  // ── Load client info once for downstream prompts ──
  const { data: client } = await s
    .from('clients')
    .select('id, name, website, primary_service, target_customer, industry, location, city, state, welcome_statement, unique_selling_prop, onboarding_answers')
    .eq('id', client_id)
    .single()

  const clientName: string = client?.name || 'this business'
  const website: string = client?.website || ''
  const industry: string = client?.primary_service || client?.industry || 'general services'
  const location: string = client?.location || [client?.city, client?.state].filter(Boolean).join(', ') || ''

  // Keyword data from UKF — optional context for the brief
  const { data: kwData } = await s
    .from('kotoiq_keywords')
    .select('*')
    .eq('client_id', client_id)
    .ilike('keyword', keyword)
    .maybeSingle()

  // ════════════════════════════════════════════════════════════════════════
  // STEP 1 — CONTENT BRIEF (semantic SEO framework)
  // ════════════════════════════════════════════════════════════════════════
  const step1 = startStep('content_brief')
  const t1 = Date.now()
  let brief: any = null
  let brief_id: string | null = null

  try {
    const briefPrompt = `You are KotoIQ, an elite SEO content strategist applying advanced Semantic SEO principles. Generate a comprehensive content brief.

BUSINESS: ${clientName}
WEBSITE: ${website}
PRIMARY SERVICE: ${industry}
TARGET CUSTOMER: ${client?.target_customer || 'local customers'}
LOCATION: ${location}

TARGET KEYWORD: "${keyword}"
SEARCH INTENT: ${kwData?.intent || classifyIntent(keyword)}
PAGE TYPE: ${page_type || 'service_page'}
SUGGESTED URL: ${target_url || `/${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`}

KEYWORD DATA:
- Monthly volume: ${kwData?.kp_monthly_volume || 'Unknown'}
- Current position: ${kwData?.sc_avg_position ? `#${Math.round(kwData.sc_avg_position)}` : 'Not ranking'}
- Opportunity: ${kwData?.opportunity_score || 'Unknown'}/100
- Domain Authority: ${kwData?.moz_da || 'Unknown'}

APPLY THIS FRAMEWORK:
1. INFORMATION GAIN — identify 3+ specific gaps in current top-ranking content that THIS page will fill.
2. ENTITY-FIRST — identify 15-20 core entities and map their relationships.
3. AI SKELETON + HUMAN MARKERS — label each outline section [AI-READY] or [HUMAN-REQUIRED] (30%+ human).
4. PERFORMANCE SIGNALS — specific CTR targets, impression share goals, refresh triggers.
5. SEMANTIC ARCHITECTURE — macro-context (main content) vs micro-context (supplementary), contextual border, grouper question.
6. TITLE OPTIMIZATION — 3 variations (conjunctive / entity-attribute / hypernym-hyponym), heaviest term first, under 60 chars.
7. MICRO-SEMANTICS — for first 3 sections: paragraph opener, key predicates, word sequence, snippet format.

Output ONLY valid JSON, no markdown fences:
{
  "title_tag": "max 60 chars",
  "meta_description": "max 155 chars",
  "h1": "primary heading",
  "target_url": "/url/",
  "target_word_count": 1500,
  "outline": [
    { "h2": "Section", "h3s": ["Subsection"], "key_points": ["coverage"], "word_count_target": 300 }
  ],
  "schema_types": ["LocalBusiness", "FAQPage", "Service", "BreadcrumbList"],
  "faq_questions": [
    { "question": "Q", "answer_guidance": "40-60 word answer" }
  ],
  "target_entities": ["entity1", "entity2"],
  "information_gain": {
    "gaps_in_current_content": ["gap1", "gap2", "gap3"],
    "unique_value_propositions": ["uvp1"]
  },
  "experience_markers": {
    "human_required_sections": ["section"],
    "ai_ready_sections": ["section"],
    "experience_percentage": "30%+"
  },
  "performance_tracking": {
    "target_ctr_by_position": { "pos_1": 0.28, "pos_3": 0.12, "pos_10": 0.025 },
    "content_refresh_trigger": "when to refresh"
  },
  "estimated_monthly_traffic": 250
}`

    const briefMsg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: 'You are KotoIQ content strategist applying Semantic SEO principles. Return ONLY valid JSON. No markdown.',
      messages: [{ role: 'user', content: briefPrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_pipeline_brief',
      model: 'claude-sonnet-4-20250514',
      inputTokens: briefMsg.usage?.input_tokens || 0,
      outputTokens: briefMsg.usage?.output_tokens || 0,
      agencyId: agency_id || undefined,
    })

    const rawBrief = briefMsg.content[0].type === 'text' ? briefMsg.content[0].text : '{}'
    brief = JSON.parse(cleanJSON(rawBrief))

    // Persist brief so write_full_page-style logic can hydrate it later
    try {
      const { data: savedBrief } = await s.from('kotoiq_content_briefs').insert({
        client_id,
        agency_id: agency_id || null,
        target_keyword: keyword,
        target_url: brief.target_url || target_url || null,
        page_type: page_type || 'service_page',
        title_tag: brief.title_tag,
        meta_description: brief.meta_description,
        h1: brief.h1,
        outline: brief.outline,
        schema_types: brief.schema_types,
        faq_questions: brief.faq_questions,
        target_word_count: brief.target_word_count,
        target_entities: brief.target_entities,
        opportunity_score: kwData?.opportunity_score || null,
        rank_propensity: kwData?.rank_propensity || null,
        estimated_monthly_traffic: brief.estimated_monthly_traffic || null,
      }).select('id').single()
      brief_id = savedBrief?.id || null
    } catch { /* brief persistence not required to continue */ }

    step1.status = 'completed'
    step1.duration_ms = Date.now() - t1
    step1.output_preview = `Brief: "${brief.title_tag}" · ${brief.target_word_count} words · ${brief.outline?.length || 0} sections`
    await persistStep(step1)
  } catch (e: any) {
    step1.status = 'failed'
    step1.duration_ms = Date.now() - t1
    step1.error = e?.message || 'brief generation failed'
    await persistStep(step1)
    if (run_id) {
      try {
        await s.from('kotoiq_pipeline_runs').update({
          status: 'failed',
          steps,
          completed_at: new Date().toISOString(),
        }).eq('id', run_id)
      } catch { /* ignore */ }
    }
    throw new Error('Pipeline failed at brief generation: ' + step1.error)
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 2 — FULL PAGE WRITE (12 semantic agents)
  // ════════════════════════════════════════════════════════════════════════
  const step2 = startStep('full_page_write')
  const t2 = Date.now()
  let content_html = ''
  let plain_text = ''
  let topicality_score_num = 0

  try {
    const writePrompt = `You are an expert SEO content writer. Produce a complete, publishable page based on this brief. Apply Semantic SEO: entity coverage, frame semantics, micro-semantic optimization, featured-snippet-ready opening.

BUSINESS: ${clientName}
WEBSITE: ${website}
SERVICE: ${industry}
TARGET CUSTOMER: ${client?.target_customer || 'local customers'}
LOCATION: ${location}

BRIEF:
Title Tag: ${brief.title_tag}
Meta: ${brief.meta_description}
H1: ${brief.h1}
Target Keyword: ${keyword}
Target Word Count: ${brief.target_word_count || 1500}

OUTLINE:
${JSON.stringify(brief.outline, null, 2)}

FAQ QUESTIONS:
${JSON.stringify(brief.faq_questions, null, 2)}

REQUIRED ENTITIES (mention naturally): ${JSON.stringify(brief.target_entities || [])}
INFORMATION GAIN — MUST ADDRESS: ${JSON.stringify(brief.information_gain?.gaps_in_current_content || [])}
UNIQUE VALUE PROPS: ${JSON.stringify(brief.information_gain?.unique_value_propositions || [])}

RULES:
1. ${brief.target_word_count || 1500}+ words of high-quality original content.
2. Follow the outline EXACTLY — use the H2s and H3s as given.
3. Opening paragraph: 40-60 words, direct answer to query intent (featured snippet target).
4. Mention every target entity naturally. Address every information-gain gap.
5. Include the FAQ section with full 40-60 word answers.
6. Short paragraphs (2-3 sentences max). Natural language — no keyword stuffing.
7. Include specific local details: city/area, the business name, concrete numbers.
8. End with a strong CTA paragraph.
9. Avoid these AI-generated clichés: "in today's fast-paced world", "delve into", "tapestry of", "realm of", "navigate the complexities", "it's worth noting".
10. Use varied sentence length. Mix short punchy sentences with longer explanatory ones.

Return content in this exact format:
---TITLE---
[title tag]
---META---
[meta description]
---H1---
[h1]
---CONTENT---
[full page content in clean HTML — h2, h3, p, ul, ol tags only]
---FAQ_HTML---
[FAQ section in HTML]
---PLAIN_TEXT---
[same content as plain text, no HTML tags]`

    const writeMsg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: 'You are an expert SEO content writer. Write complete, publishable page content.',
      messages: [{ role: 'user', content: writePrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_pipeline_write',
      model: 'claude-sonnet-4-20250514',
      inputTokens: writeMsg.usage?.input_tokens || 0,
      outputTokens: writeMsg.usage?.output_tokens || 0,
      agencyId: agency_id || undefined,
    })

    const rawWrite = writeMsg.content[0].type === 'text' ? writeMsg.content[0].text : ''
    const sections: Record<string, string> = {}
    const parts = rawWrite.split(/---(\w+)---/)
    for (let i = 1; i < parts.length; i += 2) {
      sections[parts[i].toLowerCase().trim()] = parts[i + 1]?.trim() || ''
    }

    content_html = sections.content || rawWrite
    plain_text = sections.plain_text || rawWrite.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // ── Topicality scoring (lightweight inline) ──
    try {
      const requiredEntities: string[] = Array.isArray(brief.target_entities) ? brief.target_entities : []
      const lcContent = plain_text.toLowerCase()
      const covered = requiredEntities.filter(e => lcContent.includes(String(e).toLowerCase())).length
      const entityCoverage = requiredEntities.length > 0 ? (covered / requiredEntities.length) * 100 : 80
      const kwHits = (lcContent.match(new RegExp(keyword.toLowerCase().replace(/[^a-z0-9\s]/g, ''), 'g')) || []).length
      const wordCount = plain_text.split(/\s+/).length
      const density = wordCount > 0 ? (kwHits / wordCount) * 100 : 0
      // Ideal density 0.5-2.5%. Penalize both under- and over-use.
      const densityScore = density < 0.3 ? 50 : density > 3 ? 50 : 95
      topicality_score_num = Math.min(100, Math.round((entityCoverage * 0.7 + densityScore * 0.3) * 100) / 100)
    } catch { topicality_score_num = 70 }

    step2.status = 'completed'
    step2.duration_ms = Date.now() - t2
    step2.output_preview = `Wrote ${plain_text.split(/\s+/).length} words · topicality ${topicality_score_num}/100`
    await persistStep(step2)
  } catch (e: any) {
    step2.status = 'failed'
    step2.duration_ms = Date.now() - t2
    step2.error = e?.message || 'page write failed'
    await persistStep(step2)
    if (run_id) {
      try {
        await s.from('kotoiq_pipeline_runs').update({
          status: 'failed',
          steps,
          completed_at: new Date().toISOString(),
        }).eq('id', run_id)
      } catch { /* ignore */ }
    }
    throw new Error('Pipeline failed at page write: ' + step2.error)
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 3 — POST-PROCESS (plagiarism + watermark + on-page audit in parallel)
  // ════════════════════════════════════════════════════════════════════════
  const step3a = startStep('plagiarism_check')
  const step3b = startStep('watermark_removal')
  const step3c = startStep('on_page_audit')
  const t3 = Date.now()

  let plagiarism_score = 0
  let human_score_after = 0
  let on_page_score = 0
  let cleaned_text = plain_text

  const [plagRes, watermarkRes, onPageRes] = await Promise.allSettled([
    checkPlagiarism(s, ai, {
      client_id,
      agency_id: agency_id || null,
      content: plain_text,
      url: null,
      check_type: 'both',
    }),
    removeAIWatermarks(ai, {
      content: plain_text,
      aggressiveness: 'moderate',
      client_id,
      agency_id: agency_id || null,
      supabase: s,
    }),
    website
      ? analyzeOnPage(s, ai, {
          client_id,
          agency_id: agency_id || null,
          url: website,
          target_keyword: keyword,
        })
      : Promise.reject(new Error('no website on client — skipping on-page audit')),
  ])

  // Plagiarism result
  if (plagRes.status === 'fulfilled') {
    plagiarism_score = Number(plagRes.value?.overall_originality_score) || 0
    step3a.status = 'completed'
    step3a.output_preview = `Originality ${plagiarism_score}/100 · AI-likelihood ${plagRes.value?.ai_generation_likelihood || 0}%`
  } else {
    step3a.status = 'failed'
    step3a.error = (plagRes as any).reason?.message || 'plagiarism check failed'
    plagiarism_score = 75 // neutral fallback — don't block pipeline
  }
  step3a.duration_ms = Date.now() - t3
  await persistStep(step3a)

  // Watermark result
  if (watermarkRes.status === 'fulfilled') {
    human_score_after = Number(watermarkRes.value?.human_score_after) || 0
    cleaned_text = watermarkRes.value?.cleaned_content || plain_text
    step3b.status = 'completed'
    step3b.output_preview = `Human score ${watermarkRes.value?.human_score_before || 0} → ${human_score_after} (removed ${watermarkRes.value?.watermarks_removed?.length || 0} markers)`
  } else {
    step3b.status = 'failed'
    step3b.error = (watermarkRes as any).reason?.message || 'watermark removal failed'
    human_score_after = 75
  }
  step3b.duration_ms = Date.now() - t3
  await persistStep(step3b)

  // On-page result (against existing site — signals structural readiness)
  if (onPageRes.status === 'fulfilled') {
    on_page_score = Number(onPageRes.value?.overall_score) || 0
    step3c.status = 'completed'
    step3c.output_preview = `On-page ${on_page_score}/100 (grade ${onPageRes.value?.grade})`
  } else {
    step3c.status = 'skipped'
    step3c.error = (onPageRes as any).reason?.message || 'on-page audit skipped'
    on_page_score = 75
  }
  step3c.duration_ms = Date.now() - t3
  await persistStep(step3c)

  // Swap in the cleaned text + rebuild HTML if cleaned
  if (cleaned_text && cleaned_text !== plain_text) {
    plain_text = cleaned_text
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 4 — SCHEMA MARKUP (JSON-LD)
  // ════════════════════════════════════════════════════════════════════════
  const step4 = startStep('schema_generation')
  const t4 = Date.now()
  let schemas: any[] = []

  try {
    // Pull GBP data from latest intel report if available
    const { data: latestReport } = await s
      .from('koto_intel_reports')
      .select('report_data')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const gbp = (latestReport as any)?.report_data?.gbp_audit || {}

    const schemaPrompt = `Generate production-ready JSON-LD structured data for this published page. Output SEPARATE schema objects — one per schema type.

BUSINESS: ${clientName}
WEBSITE: ${website}
SERVICE: ${industry}
ADDRESS: ${gbp.address || ''}
PHONE: ${gbp.phone || ''}
RATING: ${gbp.rating || ''}
REVIEW COUNT: ${gbp.review_count || ''}
CATEGORIES: ${(gbp.categories || []).join(', ')}

PAGE:
URL: ${brief.target_url || target_url || ''}
Title: ${brief.title_tag}
H1: ${brief.h1}
Target Keyword: ${keyword}
FAQ Questions: ${JSON.stringify(brief.faq_questions || [])}
Schema Types Required: ${JSON.stringify(brief.schema_types || ['LocalBusiness', 'BreadcrumbList', 'FAQPage', 'Service'])}

Rules:
- Produce LocalBusiness (or the most specific subtype e.g. HomeAndConstructionBusiness, Dentist, Plumber) with every available field populated.
- Produce BreadcrumbList for the URL path.
- Produce FAQPage ONLY if faq_questions is non-empty — each Question needs an acceptedAnswer.
- Produce Service with serviceType + provider referencing the business.
- Use valid schema.org @context and @type. No invented properties.

Return ONLY a valid JSON array of schema objects, no markdown fences:
[
  { "@context": "https://schema.org", "@type": "...", ... }
]`

    const schemaMsg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: 'Generate production-ready JSON-LD schema. Return ONLY a valid JSON array.',
      messages: [{ role: 'user', content: schemaPrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_pipeline_schema',
      model: 'claude-sonnet-4-20250514',
      inputTokens: schemaMsg.usage?.input_tokens || 0,
      outputTokens: schemaMsg.usage?.output_tokens || 0,
      agencyId: agency_id || undefined,
    })

    const rawSchema = schemaMsg.content[0].type === 'text' ? schemaMsg.content[0].text : '[]'
    const parsed = JSON.parse(cleanJSON(rawSchema))
    schemas = Array.isArray(parsed) ? parsed : [parsed]

    step4.status = 'completed'
    step4.duration_ms = Date.now() - t4
    step4.output_preview = `${schemas.length} schema blocks: ${schemas.map(x => x?.['@type']).filter(Boolean).join(', ')}`
    await persistStep(step4)
  } catch (e: any) {
    step4.status = 'failed'
    step4.duration_ms = Date.now() - t4
    step4.error = e?.message || 'schema generation failed'
    schemas = []
    await persistStep(step4)
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 5 — HUMAN SCORE (weighted blend of signals)
  // ════════════════════════════════════════════════════════════════════════
  const human_score = Math.round(
    ((plagiarism_score + human_score_after + on_page_score) / 3) * 100
  ) / 100

  // ════════════════════════════════════════════════════════════════════════
  // STEP 6 — APPROVAL GATE
  // ════════════════════════════════════════════════════════════════════════
  const APPROVAL_THRESHOLD = 85
  const flagged_reasons: string[] = []
  if (plagiarism_score < 80) flagged_reasons.push(`Low originality: ${plagiarism_score}`)
  if (human_score_after < 80) flagged_reasons.push(`AI watermarks remain: human score ${human_score_after}`)
  if (on_page_score < 70) flagged_reasons.push(`Weak on-page signals: ${on_page_score}`)
  if (topicality_score_num < 70) flagged_reasons.push(`Low topicality: ${topicality_score_num}`)

  const approved = human_score >= APPROVAL_THRESHOLD && flagged_reasons.length === 0
  const finalStatus: 'completed' | 'flagged' = approved ? 'completed' : 'flagged'

  // ════════════════════════════════════════════════════════════════════════
  // STEP 7 — AUTO-PUBLISH (optional, only if approved)
  // ════════════════════════════════════════════════════════════════════════
  const step7 = startStep('auto_publish')
  const t7 = Date.now()
  let auto_published = false
  let published_url: string | null = null

  if (auto_publish && approved) {
    try {
      // Look up an active WordPress site connection
      const { data: wpSite } = await s
        .from('koto_wp_sites')
        .select('site_url, api_key')
        .eq('client_id', client_id)
        .limit(1)
        .maybeSingle()

      if (wpSite?.site_url && wpSite?.api_key) {
        // Fire a publish event through the existing wp-ping bridge.
        // The WP plugin listens for pipeline.publish events and creates a draft/post.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
        const pingRes = await fetch(`${appUrl}/api/seo/wp-ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-koto-key': wpSite.api_key,
          },
          body: JSON.stringify({
            event: 'pipeline.publish',
            site_url: wpSite.site_url,
            payload: {
              title: brief.title_tag,
              slug: (brief.target_url || '').replace(/^\/|\/$/g, ''),
              h1: brief.h1,
              meta_description: brief.meta_description,
              content_html,
              schema_json_ld: schemas,
              target_keyword: keyword,
            },
          }),
          signal: AbortSignal.timeout(15000),
        }).catch(() => null)

        if (pingRes?.ok) {
          auto_published = true
          published_url = `${wpSite.site_url.replace(/\/$/, '')}${brief.target_url || ''}`
          step7.status = 'completed'
          step7.output_preview = `Published to ${published_url}`
        } else {
          step7.status = 'failed'
          step7.error = 'wp-ping publish returned non-OK status'
        }
      } else {
        step7.status = 'skipped'
        step7.output_preview = 'No WordPress site connected — returning ready-to-publish HTML instead'
      }
    } catch (e: any) {
      step7.status = 'failed'
      step7.error = e?.message || 'publish failed'
    }
  } else {
    step7.status = 'skipped'
    step7.output_preview = auto_publish
      ? `Not auto-published: flagged for review (${flagged_reasons.join('; ')})`
      : 'auto_publish=false — returning ready-to-publish HTML'
  }
  step7.duration_ms = Date.now() - t7
  await persistStep(step7)

  // ════════════════════════════════════════════════════════════════════════
  // STEP 8 — FINAL PERSIST
  // ════════════════════════════════════════════════════════════════════════
  if (run_id) {
    try {
      await s.from('kotoiq_pipeline_runs').update({
        status: finalStatus,
        human_score,
        topicality_score: topicality_score_num,
        plagiarism_score,
        on_page_score,
        brief_id,
        content_html,
        plain_text,
        schema_json_ld: schemas,
        steps,
        auto_published,
        published_url,
        completed_at: new Date().toISOString(),
      }).eq('id', run_id)
    } catch { /* non-blocking */ }
  }

  return {
    run_id,
    status: finalStatus,
    brief: { id: brief_id, ...brief },
    content_html,
    plain_text,
    human_score,
    topicality_score: topicality_score_num,
    plagiarism_score,
    on_page_score,
    schema_json_ld: schemas,
    steps,
    auto_published,
    published_url,
    flagged_reasons: flagged_reasons.length > 0 ? flagged_reasons : undefined,
  }
}

// ── List last 20 runs for a client ──────────────────────────────────────────
export async function getPipelineRuns(
  s: SupabaseClient,
  body: { client_id: string; limit?: number }
): Promise<any[]> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data, error } = await s
    .from('kotoiq_pipeline_runs')
    .select('id, keyword, status, human_score, topicality_score, plagiarism_score, on_page_score, auto_published, published_url, created_at, completed_at, steps')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(body.limit || 20, 100))

  if (error && error.code !== 'PGRST116') throw error
  return data || []
}

// ── Get full detail of one run ──────────────────────────────────────────────
export async function getPipelineRun(
  s: SupabaseClient,
  body: { run_id: string }
): Promise<any> {
  const { run_id } = body
  if (!run_id) throw new Error('run_id required')

  const { data, error } = await s
    .from('kotoiq_pipeline_runs')
    .select('*')
    .eq('id', run_id)
    .single()

  if (error) throw error
  return data
}
