// ─────────────────────────────────────────────────────────────
// strategyEngine.ts
//
// Unified Strategic Planner for KotoIQ.
//
// Synthesizes topical authority coverage, competitor gaps, query
// path clusters, historical trajectory, and domain authority into
// a single actionable strategic plan (attack / defend / abandon +
// weekly actions, monthly milestones, resource allocation).
//
// Stores the result in kotoiq_strategic_plans so the UI can recall
// the most recent plan without re-running the LLM synthesis.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

type SB = any
type AI = Anthropic

const MODEL = 'claude-sonnet-4-20250514'

export interface StrategicPlanBody {
  client_id: string
  agency_id?: string
  timeframe?: '1_month' | '3_month' | '6_month'
}

// ─────────────────────────────────────────────────────────────
// Helper — pull all of the ingredients the planner needs
// ─────────────────────────────────────────────────────────────
async function gatherStrategicInputs(s: SB, client_id: string) {
  const [
    { data: client },
    { data: maps },
    { data: nodes },
    { data: clusters },
    { data: keywords },
    { data: snapshots },
    { data: latestEnrichment },
    { data: backlinkProfile },
    { data: contentInventory },
  ] = await Promise.all([
    s.from('clients').select('id, name, website, primary_service, target_customer, industry, location').eq('id', client_id).maybeSingle(),
    s.from('kotoiq_topical_maps').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1),
    s.from('kotoiq_topical_nodes').select('*').eq('client_id', client_id),
    s.from('kotoiq_query_clusters').select('*').eq('client_id', client_id),
    s.from('kotoiq_keywords').select('keyword, fingerprint, kp_monthly_volume, sc_avg_position, sc_clicks, sc_impressions, opportunity_score, rank_propensity, competitor_domains, intent, category').eq('client_id', client_id).limit(2000),
    s.from('kotoiq_snapshots').select('keyword_fingerprint, sc_position, sc_clicks, opportunity_score, created_at').eq('client_id', client_id).order('created_at', { ascending: false }).limit(4000),
    s.from('kotoiq_sync_log').select('metadata, completed_at').eq('client_id', client_id).eq('source', 'deep_enrich').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_backlink_profile').select('domain_authority, total_referring_domains, competitor_comparison').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_content_inventory').select('url, trajectory, sc_position, sc_clicks, freshness_status, refresh_priority').eq('client_id', client_id).limit(500),
  ])

  return {
    client,
    map: maps?.[0] || null,
    nodes: nodes || [],
    clusters: clusters || [],
    keywords: keywords || [],
    snapshots: snapshots || [],
    enrichment: latestEnrichment?.metadata || null,
    backlinkProfile: backlinkProfile || null,
    contentInventory: contentInventory || [],
  }
}

// ─────────────────────────────────────────────────────────────
// Build a compact digest to hand to Claude.
// We intentionally summarize — the raw dataset is far too large
// for a single completion.
// ─────────────────────────────────────────────────────────────
function summarizeInputs(inputs: Awaited<ReturnType<typeof gatherStrategicInputs>>) {
  const { client, map, nodes, clusters, keywords, snapshots, enrichment, backlinkProfile, contentInventory } = inputs

  // Competitor inventory — collapse competitor_domains per keyword
  const competitorFreq: Record<string, { count: number; value: number }> = {}
  for (const kw of keywords as any[]) {
    const comps: string[] = Array.isArray(kw.competitor_domains) ? kw.competitor_domains : []
    const value = Number(kw.kp_monthly_volume || 0)
    for (const c of comps) {
      if (!c) continue
      if (!competitorFreq[c]) competitorFreq[c] = { count: 0, value: 0 }
      competitorFreq[c].count += 1
      competitorFreq[c].value += value
    }
  }
  const topCompetitors = Object.entries(competitorFreq)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, 8)
    .map(([domain, v]) => ({ domain, keyword_count: v.count, estimated_monthly_value: v.value }))

  // Cluster coverage digest
  const clusterSummary = (clusters || []).slice(0, 25).map((c: any) => ({
    name: c.cluster_name,
    coverage_pct: Number(c.coverage_pct || 0),
    total_queries: c.total_queries || 0,
    covered_queries: c.covered_queries || 0,
    gap_count: Array.isArray(c.gap_queries) ? c.gap_queries.length : 0,
    avg_session_depth: c.avg_session_depth || null,
  }))

  // Topical node coverage — split by status
  const statusBucket: Record<string, number> = { gap: 0, partial: 0, covered: 0, excess: 0 }
  const priorityBucket: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const priorityGaps: any[] = []
  for (const n of nodes as any[]) {
    statusBucket[n.status || 'gap'] = (statusBucket[n.status || 'gap'] || 0) + 1
    priorityBucket[n.priority || 'medium'] = (priorityBucket[n.priority || 'medium'] || 0) + 1
    if ((n.status === 'gap' || n.status === 'partial') && (n.priority === 'critical' || n.priority === 'high')) {
      priorityGaps.push({
        entity: n.entity,
        status: n.status,
        priority: n.priority,
        search_volume: n.search_volume,
        section: n.section,
        suggested_url: n.suggested_url,
      })
    }
  }

  // Historical trajectory — avg position shift per fingerprint
  const latestByFp: Record<string, { pos: number; ts: string }> = {}
  const oldestByFp: Record<string, { pos: number; ts: string }> = {}
  for (const snap of snapshots as any[]) {
    const fp = snap.keyword_fingerprint
    if (!fp || snap.sc_position == null) continue
    if (!latestByFp[fp] || latestByFp[fp].ts < snap.created_at) latestByFp[fp] = { pos: snap.sc_position, ts: snap.created_at }
    if (!oldestByFp[fp] || oldestByFp[fp].ts > snap.created_at) oldestByFp[fp] = { pos: snap.sc_position, ts: snap.created_at }
  }
  const trajectories = Object.keys(latestByFp).map((fp) => ({
    fp,
    shift: (oldestByFp[fp]?.pos || 0) - (latestByFp[fp]?.pos || 0),
  })).filter((t) => Math.abs(t.shift) > 0.5)
  const improving = trajectories.filter((t) => t.shift > 0).length
  const declining = trajectories.filter((t) => t.shift < 0).length

  // Content decay summary
  const decayBucket: Record<string, number> = {}
  for (const ci of contentInventory as any[]) {
    const k = ci.trajectory || 'unknown'
    decayBucket[k] = (decayBucket[k] || 0) + 1
  }

  // High-commercial keywords the client doesn't own
  const commercialGaps = (keywords as any[])
    .filter((k: any) => (k.intent === 'transactional' || k.intent === 'commercial') && (k.sc_avg_position == null || k.sc_avg_position > 20))
    .sort((a: any, b: any) => (b.kp_monthly_volume || 0) - (a.kp_monthly_volume || 0))
    .slice(0, 15)
    .map((k: any) => ({ keyword: k.keyword, volume: k.kp_monthly_volume, position: k.sc_avg_position, opportunity: k.opportunity_score }))

  const clientDA = Number(backlinkProfile?.domain_authority || enrichment?.domain_authority || 0)
  const competitorDAs = (backlinkProfile?.competitor_comparison || []).map((c: any) => Number(c.da || 0)).filter((n: number) => n > 0)
  const avgCompetitorDA = competitorDAs.length > 0 ? competitorDAs.reduce((a: number, b: number) => a + b, 0) / competitorDAs.length : null

  return {
    client,
    central_entity: map?.central_entity || null,
    source_context: map?.source_context || null,
    topical_coverage_score: Number(map?.topical_coverage_score || 0),
    vastness_score: Number(map?.vastness_score || 0),
    depth_score: Number(map?.depth_score || 0),
    momentum_score: Number(map?.momentum_score || 0),
    overall_authority_score: Number(map?.overall_authority_score || 0),
    node_status_breakdown: statusBucket,
    node_priority_breakdown: priorityBucket,
    priority_gaps: priorityGaps.slice(0, 20),
    clusters: clusterSummary,
    top_competitors: topCompetitors,
    commercial_gaps: commercialGaps,
    trajectory: { improving_keywords: improving, declining_keywords: declining, tracked_fingerprints: Object.keys(latestByFp).length },
    content_trajectory: decayBucket,
    domain_authority: clientDA,
    avg_competitor_da: avgCompetitorDA,
    da_gap: avgCompetitorDA ? avgCompetitorDA - clientDA : null,
  }
}

// ─────────────────────────────────────────────────────────────
// generate_strategic_plan
// ─────────────────────────────────────────────────────────────
export async function generateStrategicPlan(s: SB, ai: AI, body: StrategicPlanBody) {
  const { client_id, agency_id, timeframe } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const tf = timeframe || '3_month'

  const inputs = await gatherStrategicInputs(s, client_id)
  if (!inputs.client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const digest = summarizeInputs(inputs)

  const prompt = `You are a senior SEO/GEO strategist. Synthesize a ${tf.replace('_', ' ')} strategic plan for this business from the data below.

BUSINESS:
${JSON.stringify(digest.client, null, 2)}

TOPICAL AUTHORITY:
- Central entity: ${digest.central_entity || 'Not mapped'}
- Source context: ${digest.source_context || 'Not set'}
- Topical coverage score: ${digest.topical_coverage_score}/100
- Vastness: ${digest.vastness_score} | Depth: ${digest.depth_score} | Momentum: ${digest.momentum_score}
- Overall authority: ${digest.overall_authority_score}/100
- Node status: ${JSON.stringify(digest.node_status_breakdown)}
- Node priorities: ${JSON.stringify(digest.node_priority_breakdown)}

PRIORITY GAPS (critical/high priority nodes not yet covered):
${JSON.stringify(digest.priority_gaps, null, 2)}

QUERY CLUSTERS (user search paths):
${JSON.stringify(digest.clusters, null, 2)}

TOP COMPETITORS (by total organic keyword value):
${JSON.stringify(digest.top_competitors, null, 2)}

COMMERCIAL KEYWORD GAPS (transactional/commercial intent not ranking):
${JSON.stringify(digest.commercial_gaps, null, 2)}

HISTORICAL TRAJECTORY:
- Improving keywords: ${digest.trajectory.improving_keywords}
- Declining keywords: ${digest.trajectory.declining_keywords}
- Content trajectory buckets: ${JSON.stringify(digest.content_trajectory)}

DOMAIN AUTHORITY:
- Client DA: ${digest.domain_authority}
- Avg competitor DA: ${digest.avg_competitor_da ?? 'unknown'}
- DA gap: ${digest.da_gap ?? 'unknown'}

TASK — produce a ${tf.replace('_', ' ')} strategic plan with these rules:

ATTACK PRIORITIES (exactly 3):
- Clusters where competitors are weakest AND query demand is high AND client currently has 40-70% coverage (winnable, not wasted).
- Include: cluster_name, reason_to_attack, expected_lift, required_content_count, estimated_timeframe.

DEFEND PRIORITIES (exactly 3):
- Clusters where client leads but trajectory is declining OR competitor is encroaching.
- Include: cluster_name, risk, defense_tactic, required_refresh_count.

ABANDON (list items to stop pursuing):
- Clusters where DA gap is too large (30+), commercial intent is low, or coverage would require excessive investment for little return.
- Include: cluster_name, reason_to_abandon.

WEEKLY ACTIONS (for the full ${tf.replace('_', ' ')} — one array of specific weekly tasks):
- Each action: { week: number, type: 'content'|'links'|'technical'|'local'|'schema', action: string, expected_outcome: string, effort_hours: number }

MONTHLY MILESTONES (measurable goals per month, count matches timeframe):
- Each: { month: number, metric: string, baseline: string, target: string, how_measured: string }

RESOURCE ALLOCATION (percentages must sum to 100):
- { content_pct: number, links_pct: number, technical_pct: number, local_pct: number }

EXECUTIVE SUMMARY (3-4 sentences): The core thesis of the plan — what we're doing and why this is the right play right now given the data.

Return ONLY valid JSON, no markdown fences, this exact shape:
{
  "attack_priorities": [{"cluster_name":"","reason_to_attack":"","expected_lift":"","required_content_count":0,"estimated_timeframe":""}],
  "defend_priorities": [{"cluster_name":"","risk":"","defense_tactic":"","required_refresh_count":0}],
  "abandon": [{"cluster_name":"","reason_to_abandon":""}],
  "weekly_actions": [{"week":1,"type":"content","action":"","expected_outcome":"","effort_hours":0}],
  "monthly_milestones": [{"month":1,"metric":"","baseline":"","target":"","how_measured":""}],
  "resource_allocation": {"content_pct":0,"links_pct":0,"technical_pct":0,"local_pct":0},
  "executive_summary": ""
}`

  let plan: any = null
  try {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.4,
      system: 'You are a senior SEO/GEO strategist. Return only valid JSON — no markdown, no preamble.',
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_strategic_plan',
      model: MODEL,
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
      metadata: { client_id, timeframe: tf },
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = text.replace(/```json\s*|```\s*$/g, '').trim()
    plan = JSON.parse(cleaned)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate plan', detail: e?.message }, { status: 500 })
  }

  const insertRow = {
    client_id,
    agency_id: agency_id || null,
    timeframe: tf,
    attack_priorities: plan.attack_priorities || [],
    defend_priorities: plan.defend_priorities || [],
    abandon_list: plan.abandon || [],
    weekly_actions: plan.weekly_actions || [],
    monthly_milestones: plan.monthly_milestones || [],
    resource_allocation: plan.resource_allocation || {},
    executive_summary: plan.executive_summary || '',
    status: 'active',
  }

  const { data: saved, error } = await s.from('kotoiq_strategic_plans').insert(insertRow).select().single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    plan_id: saved.id,
    attack_priorities: insertRow.attack_priorities,
    defend_priorities: insertRow.defend_priorities,
    abandon: insertRow.abandon_list,
    weekly_actions: insertRow.weekly_actions,
    monthly_milestones: insertRow.monthly_milestones,
    resource_allocation: insertRow.resource_allocation,
    executive_summary: insertRow.executive_summary,
  })
}

// ─────────────────────────────────────────────────────────────
// get_latest_strategic_plan
// ─────────────────────────────────────────────────────────────
export async function getLatestStrategicPlan(s: SB, body: { client_id: string }) {
  const { client_id } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await s
    .from('kotoiq_strategic_plans')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data || null })
}
