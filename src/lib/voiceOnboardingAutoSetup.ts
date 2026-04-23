import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — Voice Onboarding → SEO Auto-Setup
//
// When onboarding completes (or on manual trigger), run the
// full KotoIQ warm-up sequence for a client:
//   1. Quick Scan (extract keywords from site + sitemap)
//   2. Topical Map (semantic SEO authority model)
//   3. On-Page Audit (homepage scoring)
//   4. Content Briefs for top 10 gap nodes
//   5. Content Calendar (10 briefs scheduled over 10 weeks)
//   6. Initial Strategy Engine plan (via hyperlocal engine prep)
//
// Every step is non-blocking — a failure in one does not
// prevent the next from running. Progress persists to
// kotoiq_auto_setup_runs so the UI can show what ran.
//
// Called via POST /api/kotoiq action: trigger_auto_setup
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { generateTopicalMap } from '@/lib/topicalMapEngine'
import { buildContentCalendar } from '@/lib/contentCalendarEngine'
import { analyzeOnPage } from '@/lib/onPageEngine'

// ── Types ───────────────────────────────────────────────────────────────────
interface AutoSetupInput {
  client_id: string
  agency_id?: string | null
}

interface AutoSetupResult {
  setup_id: string | null
  status: 'completed' | 'partial' | 'failed'
  quick_scan_keywords: number
  topical_map_nodes: number
  briefs_created: number
  calendar_items_created: number
  on_page_score: number
  strategy_plan_created: boolean
  errors: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fingerprint(kw: string): string {
  return kw.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, '-')
}

function classifyIntent(kw: string): string {
  const lc = kw.toLowerCase()
  if (/\b(buy|hire|price|pricing|cost|near me|book|schedule)\b/.test(lc)) return 'transactional'
  if (/\b(best|top|review|vs|compare|alternative)\b/.test(lc)) return 'commercial'
  if (/\b(how|what|why|when|where|guide|tutorial)\b/.test(lc)) return 'informational'
  return 'commercial'
}

function cleanJSON(raw: string): string {
  return raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
}

// ── Inline quick-scan (matches /quick_scan action but returns result) ──────
async function runInlineQuickScan(
  s: SupabaseClient,
  ai: Anthropic,
  input: {
    client_id: string
    agency_id: string | null
    website: string
    industry: string
    location: string
  }
): Promise<{ keywords_inserted: number; client_da: number }> {
  let normalizedUrl = input.website.trim()
  if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
  const hostname = new URL(normalizedUrl).hostname

  const [pageText, sitemapPaths, clientDA] = await Promise.all([
    (async () => {
      try {
        const r = await fetch(normalizedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })
        const html = await r.text()
        return html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000)
      } catch { return '' }
    })(),
    (async () => {
      const urls: string[] = []
      for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
        try {
          const r = await fetch(`${new URL(normalizedUrl).origin}${path}`, { signal: AbortSignal.timeout(5000) })
          if (r.ok) {
            const t = await r.text()
            const locs = [...t.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1])
            urls.push(...locs)
          }
          if (urls.length > 0) break
        } catch { continue }
      }
      return [...new Set(urls)]
        .map(u => { try { return new URL(u).pathname } catch { return u } })
        .filter(p => p !== '/' && !p.includes('?'))
        .slice(0, 50)
    })(),
    (async () => {
      const mozKey = process.env.MOZ_API_KEY || ''
      if (!mozKey) return 0
      try {
        const r = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${mozKey}` },
          body: JSON.stringify({ targets: [hostname], url_metrics_columns: ['domain_authority'] }),
          signal: AbortSignal.timeout(10000),
        })
        if (!r.ok) return 0
        const d = await r.json()
        return d.results?.[0]?.domain_authority || 0
      } catch { return 0 }
    })(),
  ])

  const prompt = `Analyze this business website and extract the most important SEO keywords they should be targeting.

WEBSITE: ${normalizedUrl}
INDUSTRY: ${input.industry}
LOCATION: ${input.location}
DOMAIN AUTHORITY: ${clientDA}

PAGE CONTENT (first 3000 chars):
${pageText.slice(0, 3000)}

SITEMAP URLS:
${sitemapPaths.join('\n')}

Extract 30-50 SEO keywords — mix of service, location, long-tail, question, and commercial intent queries.

Return ONLY valid JSON array, no markdown:
[{"keyword": "exact phrase", "intent": "transactional|commercial|informational", "estimated_volume": 100, "estimated_difficulty": "low|medium|high", "priority": "high|medium|low"}]`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: 'Extract SEO keywords. Return ONLY valid JSON array.',
    messages: [{ role: 'user', content: prompt }],
  })
  void logTokenUsage({
    feature: 'kotoiq_auto_setup_quick_scan',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: input.agency_id || undefined,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const extracted = JSON.parse(cleanJSON(raw))
  const keywords = Array.isArray(extracted) ? extracted : []

  if (keywords.length === 0) return { keywords_inserted: 0, client_da: clientDA }

  const ukfRecords = keywords.map((kw: any) => ({
    client_id: input.client_id,
    agency_id: input.agency_id,
    keyword: kw.keyword,
    fingerprint: fingerprint(kw.keyword),
    intent: kw.intent || classifyIntent(kw.keyword),
    kp_monthly_volume: kw.estimated_volume || null,
    moz_da: clientDA || null,
    category: kw.priority === 'high' ? 'quick_win' : kw.priority === 'medium' ? 'striking_distance' : 'monitor',
    opportunity_score: kw.priority === 'high' ? 75 : kw.priority === 'medium' ? 55 : 35,
    rank_propensity: kw.estimated_difficulty === 'low' ? 70 : kw.estimated_difficulty === 'medium' ? 45 : 25,
    data_period: `Auto-setup quick scan — ${new Date().toISOString().split('T')[0]}`,
  }))

  await s.from('kotoiq_keywords').delete().eq('client_id', input.client_id)
  await s.from('kotoiq_keywords').insert(ukfRecords)

  return { keywords_inserted: ukfRecords.length, client_da: clientDA }
}

// ── Main entry: trigger_auto_setup ──────────────────────────────────────────
export async function triggerAutoSetup(
  s: SupabaseClient,
  ai: Anthropic,
  body: AutoSetupInput
): Promise<AutoSetupResult> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  // ── Create setup run row up front ──
  let setup_id: string | null = null
  try {
    const { data: runRow } = await s.from('kotoiq_auto_setup_runs').insert({
      client_id,
      status: 'running',
      results: {},
    }).select('id').single()
    setup_id = runRow?.id || null
  } catch { /* continue without persistence */ }

  const results: Record<string, any> = {}
  const errors: string[] = []

  const persist = async (patch: Record<string, any>) => {
    Object.assign(results, patch)
    if (!setup_id) return
    try {
      await s.from('kotoiq_auto_setup_runs').update({ results }).eq('id', setup_id)
    } catch { /* non-blocking */ }
  }

  // ── Client readiness check ──
  const { data: client } = await s
    .from('clients')
    .select('id, name, website, primary_service, city, state, industry, target_customer')
    .eq('id', client_id)
    .single()

  if (!client) {
    const err = 'Client not found'
    if (setup_id) {
      try {
        await s.from('kotoiq_auto_setup_runs').update({
          status: 'failed',
          error: err,
          completed_at: new Date().toISOString(),
        }).eq('id', setup_id)
      } catch { /* ignore */ }
    }
    throw new Error(err)
  }

  const website = (client.website || '').trim()
  const industry = client.primary_service || client.industry || ''
  const location = [client.city, client.state].filter(Boolean).join(', ')

  if (!client.name || !website || !industry || !location) {
    const missing = [
      !client.name && 'name',
      !website && 'website',
      !industry && 'primary_service',
      !location && 'location',
    ].filter(Boolean).join(', ')
    const err = `Client missing required fields: ${missing}`
    if (setup_id) {
      try {
        await s.from('kotoiq_auto_setup_runs').update({
          status: 'failed',
          error: err,
          completed_at: new Date().toISOString(),
        }).eq('id', setup_id)
      } catch { /* ignore */ }
    }
    throw new Error(err)
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 1 — QUICK SCAN
  // ════════════════════════════════════════════════════════════════════════
  let keywords_inserted = 0
  try {
    const scan = await runInlineQuickScan(s, ai, {
      client_id,
      agency_id: agency_id || null,
      website,
      industry,
      location,
    })
    keywords_inserted = scan.keywords_inserted
    await persist({ step_1_quick_scan: { keywords: keywords_inserted, da: scan.client_da } })
  } catch (e: any) {
    errors.push(`quick_scan: ${e?.message || e}`)
    await persist({ step_1_quick_scan: { error: e?.message || String(e) } })
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 2 — TOPICAL MAP
  // ════════════════════════════════════════════════════════════════════════
  let topical_map_nodes = 0
  let gapNodes: any[] = []
  try {
    const mapResult = await generateTopicalMap(s, ai, {
      client_id,
      agency_id: agency_id || null,
    })
    if (mapResult?.error) throw new Error(mapResult.error)
    topical_map_nodes = mapResult?.map?.total_nodes || 0
    await persist({
      step_2_topical_map: {
        total_nodes: topical_map_nodes,
        gap_nodes: mapResult?.map?.gap_nodes_count || 0,
        coverage_score: mapResult?.map?.coverage_score || 0,
      },
    })

    // Fetch the actual gap nodes — we'll use them for briefs
    const { data: nodes } = await s
      .from('kotoiq_topical_nodes')
      .select('id, topic, section, priority_score, coverage_status')
      .eq('client_id', client_id)
      .in('coverage_status', ['gap', 'partial'])
      .order('priority_score', { ascending: false })
      .limit(10)
    gapNodes = nodes || []
  } catch (e: any) {
    errors.push(`topical_map: ${e?.message || e}`)
    await persist({ step_2_topical_map: { error: e?.message || String(e) } })
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 3 — ON-PAGE AUDIT (homepage)
  // ════════════════════════════════════════════════════════════════════════
  let on_page_score = 0
  try {
    // Pick the highest-volume keyword to audit the homepage against
    const { data: topKw } = await s
      .from('kotoiq_keywords')
      .select('keyword')
      .eq('client_id', client_id)
      .order('opportunity_score', { ascending: false })
      .limit(1)
      .maybeSingle()
    const auditKw = topKw?.keyword || industry

    const audit = await analyzeOnPage(s, ai, {
      client_id,
      agency_id: agency_id || null,
      url: website.startsWith('http') ? website : 'https://' + website,
      target_keyword: auditKw,
    })
    on_page_score = Number(audit?.overall_score) || 0
    await persist({
      step_3_on_page_audit: {
        score: on_page_score,
        grade: audit?.grade || 'F',
        target_keyword: auditKw,
        critical_fixes: (audit?.critical_fixes || []).length,
        quick_wins: (audit?.quick_wins || []).length,
      },
    })
  } catch (e: any) {
    errors.push(`on_page_audit: ${e?.message || e}`)
    await persist({ step_3_on_page_audit: { error: e?.message || String(e) } })
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 4 — CONTENT BRIEFS (top 10 gap nodes)
  // ════════════════════════════════════════════════════════════════════════
  let briefs_created = 0
  const createdBriefs: Array<{ brief_id: string; topic: string; target_keyword: string; node_id: string | null }> = []
  try {
    // If we don't have gap nodes (e.g. topical map failed), fall back to top 10 keywords
    let candidates: Array<{ topic: string; keyword: string; node_id: string | null }> = gapNodes.map(n => ({
      topic: n.topic,
      keyword: n.topic,
      node_id: n.id,
    }))

    if (candidates.length < 10) {
      const { data: topKeywords } = await s
        .from('kotoiq_keywords')
        .select('keyword')
        .eq('client_id', client_id)
        .order('opportunity_score', { ascending: false })
        .limit(10 - candidates.length)
      for (const k of (topKeywords || [])) {
        candidates.push({ topic: k.keyword, keyword: k.keyword, node_id: null })
      }
    }

    candidates = candidates.slice(0, 10)

    // Generate briefs serially to keep token usage manageable
    for (const cand of candidates) {
      try {
        const briefPrompt = `You are KotoIQ, an SEO content strategist. Generate a focused content brief.

BUSINESS: ${client.name}
WEBSITE: ${website}
PRIMARY SERVICE: ${industry}
LOCATION: ${location}
TARGET CUSTOMER: ${client.target_customer || 'local customers'}

TARGET KEYWORD: "${cand.keyword}"
TOPIC: "${cand.topic}"
SEARCH INTENT: ${classifyIntent(cand.keyword)}

Apply Semantic SEO: information gain (3 gaps), entity-first (10-15 entities), human experience markers (30%+), and title variations.

Output ONLY valid JSON, no markdown:
{
  "title_tag": "max 60 chars",
  "meta_description": "max 155 chars",
  "h1": "primary heading",
  "target_url": "/slug/",
  "target_word_count": 1500,
  "outline": [
    { "h2": "Section", "h3s": ["Sub"], "key_points": ["coverage"], "word_count_target": 300 }
  ],
  "schema_types": ["Service", "FAQPage"],
  "faq_questions": [
    { "question": "Q", "answer_guidance": "40-60 word answer" }
  ],
  "target_entities": ["e1", "e2"],
  "information_gain": {
    "gaps_in_current_content": ["g1", "g2", "g3"]
  },
  "estimated_monthly_traffic": 100
}`

        const msg = await ai.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          system: 'Return ONLY valid JSON. No markdown.',
          messages: [{ role: 'user', content: briefPrompt }],
        })
        void logTokenUsage({
          feature: 'kotoiq_auto_setup_brief',
          model: 'claude-sonnet-4-20250514',
          inputTokens: msg.usage?.input_tokens || 0,
          outputTokens: msg.usage?.output_tokens || 0,
          agencyId: agency_id || undefined,
        })

        const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
        const brief = JSON.parse(cleanJSON(raw))

        const { data: savedBrief } = await s.from('kotoiq_content_briefs').insert({
          client_id,
          agency_id: agency_id || null,
          target_keyword: cand.keyword,
          target_url: brief.target_url || `/${fingerprint(cand.keyword)}/`,
          page_type: 'service_page',
          title_tag: brief.title_tag,
          meta_description: brief.meta_description,
          h1: brief.h1,
          outline: brief.outline,
          schema_types: brief.schema_types,
          faq_questions: brief.faq_questions,
          target_word_count: brief.target_word_count,
          target_entities: brief.target_entities,
          estimated_monthly_traffic: brief.estimated_monthly_traffic || null,
        }).select('id').single()

        if (savedBrief?.id) {
          briefs_created++
          createdBriefs.push({
            brief_id: savedBrief.id,
            topic: cand.topic,
            target_keyword: cand.keyword,
            node_id: cand.node_id,
          })
        }
      } catch (e: any) {
        // Single brief failure shouldn't block the rest
        errors.push(`brief for "${cand.keyword}": ${e?.message || e}`)
      }
    }

    await persist({
      step_4_briefs: {
        created: briefs_created,
        briefs: createdBriefs,
      },
    })
  } catch (e: any) {
    errors.push(`briefs: ${e?.message || e}`)
    await persist({ step_4_briefs: { error: e?.message || String(e) } })
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 5 — CONTENT CALENDAR (10 briefs scheduled over 10 weeks)
  // ════════════════════════════════════════════════════════════════════════
  let calendar_items_created = 0
  try {
    if (createdBriefs.length > 0) {
      // Schedule one brief per week, Monday, starting next Monday
      const today = new Date()
      const daysUntilMonday = ((8 - today.getDay()) % 7) || 7
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() + daysUntilMonday)

      // Clear any existing auto-generated planned items so repeated runs don't duplicate
      try {
        await s
          .from('kotoiq_content_calendar')
          .delete()
          .eq('client_id', client_id)
          .eq('status', 'planned')
          .like('notes', 'Auto-setup:%')
      } catch { /* ignore */ }

      const rows = createdBriefs.map((b, i) => {
        const plannedDate = new Date(startDate)
        plannedDate.setDate(plannedDate.getDate() + i * 7)
        return {
          client_id,
          title: b.topic,
          target_keyword: b.target_keyword,
          content_type: 'service_page',
          status: 'planned',
          planned_date: plannedDate.toISOString().split('T')[0],
          topical_node_id: b.node_id,
          notes: `Auto-setup: generated from onboarding completion. Brief ID: ${b.brief_id}`,
        }
      })

      const { data: inserted } = await s.from('kotoiq_content_calendar').insert(rows).select()
      calendar_items_created = inserted?.length || 0
    } else {
      // No briefs — fall back to buildContentCalendar which reads topical gaps
      try {
        const cal = await buildContentCalendar(s, ai, { client_id })
        calendar_items_created = cal?.total || 0
      } catch { /* ignore */ }
    }
    await persist({ step_5_calendar: { items: calendar_items_created } })
  } catch (e: any) {
    errors.push(`calendar: ${e?.message || e}`)
    await persist({ step_5_calendar: { error: e?.message || String(e) } })
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEP 6 — INITIAL STRATEGY PLAN (Claude-drafted 90-day priorities)
  // ════════════════════════════════════════════════════════════════════════
  let strategy_plan_created = false
  try {
    const strategyPrompt = `You are KotoIQ's strategy engine. Draft a concise 90-day SEO strategy plan for a newly onboarded client.

BUSINESS: ${client.name}
WEBSITE: ${website}
SERVICE: ${industry}
LOCATION: ${location}

ONBOARDING SIGNALS:
- Keywords identified: ${keywords_inserted}
- Topical map nodes: ${topical_map_nodes}
- On-page score: ${on_page_score}/100
- Content briefs ready: ${briefs_created}
- Calendar items scheduled: ${calendar_items_created}

Return ONLY valid JSON:
{
  "vision": "one-sentence strategic vision",
  "month_1_priorities": ["priority 1", "priority 2", "priority 3"],
  "month_2_priorities": ["priority 1", "priority 2", "priority 3"],
  "month_3_priorities": ["priority 1", "priority 2", "priority 3"],
  "key_metrics_to_track": ["metric 1", "metric 2", "metric 3", "metric 4"],
  "risk_flags": ["risk 1", "risk 2"],
  "expected_traffic_lift_90d": "estimate"
}`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'Return ONLY valid JSON.',
      messages: [{ role: 'user', content: strategyPrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_auto_setup_strategy',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id || undefined,
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const plan = JSON.parse(cleanJSON(raw))

    // Write as a recommendation record for the Strategy Engine UI
    try {
      await s.from('kotoiq_recommendations').insert({
        client_id,
        agency_id: agency_id || null,
        type: 'strategy_plan',
        priority: 'high',
        title: 'Initial 90-Day SEO Strategy',
        detail: plan.vision || 'Auto-generated strategy plan from onboarding',
        estimated_impact: plan.expected_traffic_lift_90d || 'See plan details',
        effort: 'major_project',
        status: 'pending',
        metadata: plan,
      })
      strategy_plan_created = true
    } catch { /* recommendation table may vary in schema */ }

    await persist({
      step_6_strategy: {
        created: strategy_plan_created,
        plan_preview: plan.vision || null,
      },
    })
  } catch (e: any) {
    errors.push(`strategy: ${e?.message || e}`)
    await persist({ step_6_strategy: { error: e?.message || String(e) } })
  }

  // ── Final status ──
  const anyCompleted = keywords_inserted > 0 || topical_map_nodes > 0 || briefs_created > 0
  const finalStatus: 'completed' | 'partial' | 'failed' =
    errors.length === 0 ? 'completed' : anyCompleted ? 'partial' : 'failed'

  if (setup_id) {
    try {
      await s.from('kotoiq_auto_setup_runs').update({
        status: finalStatus,
        results,
        error: errors.length > 0 ? errors.join(' | ') : null,
        completed_at: new Date().toISOString(),
      }).eq('id', setup_id)
    } catch { /* ignore */ }
  }

  return {
    setup_id,
    status: finalStatus,
    quick_scan_keywords: keywords_inserted,
    topical_map_nodes,
    briefs_created,
    calendar_items_created,
    on_page_score,
    strategy_plan_created,
    errors,
  }
}
