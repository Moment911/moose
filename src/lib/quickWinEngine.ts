// ─────────────────────────────────────────────────────────────
// Quick Win Engine — unified priority stack for KotoIQ
// Aggregates action items from every KotoIQ tool, scores them
// by impact/effort, and ranks the top 25 with Claude.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

type Effort = '5min' | '15min' | '30min' | '1hr' | 'half_day' | 'full_day' | 'multi_day'
type EffortCategory = 'quick_win' | 'moderate' | 'major_project'

interface Candidate {
  title: string
  source: string
  action_type: string
  effort?: Effort
  effort_minutes?: number
  effort_category?: EffortCategory
  category?: EffortCategory
  impact_score: number
  estimated_traffic_gain: number
  estimated_revenue_gain: number
  how_to_do_it: string
  related_data: any
  [key: string]: any
}

// Effort classification helper
function effortFromMinutes(mins: number): { effort: Effort; category: EffortCategory } {
  if (mins <= 5) return { effort: '5min', category: 'quick_win' }
  if (mins <= 15) return { effort: '15min', category: 'quick_win' }
  if (mins <= 30) return { effort: '30min', category: 'quick_win' }
  if (mins <= 60) return { effort: '1hr', category: 'moderate' }
  if (mins <= 240) return { effort: 'half_day', category: 'moderate' }
  if (mins <= 480) return { effort: 'full_day', category: 'major_project' }
  return { effort: 'multi_day', category: 'major_project' }
}

// priority_score = impact * 10 / effort_minutes (higher = better)
function calcPriority(impact: number, mins: number): number {
  if (mins <= 0) return impact * 10
  return Math.round((impact * 10 / mins) * 100) / 100
}

const EFFORT_RANK: Record<EffortCategory, number> = {
  quick_win: 1,
  moderate: 2,
  major_project: 3,
}

// ── Generate Quick Win Queue ────────────────────────────────────────────────
export async function generateQuickWinQueue(
  s: SupabaseClient,
  ai: Anthropic,
  body: {
    client_id: string
    agency_id?: string
    min_impact?: number
    max_effort?: EffortCategory
  }
) {
  const {
    client_id,
    agency_id,
    min_impact = 5,
    max_effort = 'moderate',
  } = body
  if (!client_id) throw new Error('client_id required')

  const maxRank = EFFORT_RANK[max_effort] || 2
  const candidates: Candidate[] = []

  // ── SOURCE 1: Striking distance keywords (push top 3) ──
  const { data: strikingKws } = await s
    .from('kotoiq_keywords')
    .select('keyword, sc_avg_position, kp_monthly_volume, sc_clicks, sc_ctr, opportunity_score, category')
    .eq('client_id', client_id)
    .eq('category', 'striking_distance')
    .order('opportunity_score', { ascending: false })
    .limit(3)
  for (const k of strikingKws || []) {
    const vol = Number(k.kp_monthly_volume || 0)
    const trafficGain = Math.round(vol * 0.18) // moving 11 -> 3 ~ 18% CTR lift estimate
    candidates.push({
      title: `Push "${k.keyword}" into top 3 (pos ${k.sc_avg_position ? Math.round(k.sc_avg_position) : '?'})`,
      source: 'keywords.striking_distance',
      action_type: 'rank_push',
      ...effortFromMinutes(240),
      impact_score: Math.min(100, Math.round((Number(k.opportunity_score || 0) + (trafficGain / 10)))),
      estimated_traffic_gain: trafficGain,
      estimated_revenue_gain: 0,
      how_to_do_it: 'Refresh the ranking URL: tighten title/H1, add FAQ schema, tighten first paragraph, add 2-3 internal links from high-authority pages using the exact keyword as anchor.',
      related_data: { keyword: k.keyword, current_position: k.sc_avg_position, volume: vol },
    })
  }

  // ── SOURCE 2: Content inventory — urgent/soon refreshes on declining pages ──
  const { data: decliningContent } = await s
    .from('kotoiq_content_inventory')
    .select('url, title, sc_position, sc_clicks, refresh_priority, trajectory, days_since_update, word_count')
    .eq('client_id', client_id)
    .in('refresh_priority', ['urgent', 'soon'])
    .eq('trajectory', 'declining')
    .limit(15)
  for (const c of decliningContent || []) {
    const clicks = Number(c.sc_clicks || 0)
    const lossEstimate = Math.round(clicks * 0.3)
    const mins = c.refresh_priority === 'urgent' ? 120 : 180
    candidates.push({
      title: `Refresh declining page: ${c.title || c.url}`,
      source: 'content_inventory.refresh',
      action_type: 'content_refresh',
      ...effortFromMinutes(mins),
      impact_score: Math.min(100, 40 + Math.round(lossEstimate / 5)),
      estimated_traffic_gain: lossEstimate,
      estimated_revenue_gain: 0,
      how_to_do_it: `Page is declining (${c.days_since_update || '?'}d stale). Update facts, add 2025 data, expand to 1500+ words, add schema, improve internal links.`,
      related_data: { url: c.url, trajectory: c.trajectory, clicks },
    })
  }

  // ── SOURCE 3: Schema eligible-not-implemented ──
  const { data: schemaRow } = await s
    .from('kotoiq_schema_audit')
    .select('eligible_not_implemented, scanned_at')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
  const schemaItems = (schemaRow?.[0]?.eligible_not_implemented || []) as any[]
  for (const item of schemaItems.slice(0, 10)) {
    const ctrLift = Number(item.potential_ctr_lift || 0)
    if (ctrLift < 10) continue
    candidates.push({
      title: `Add ${item.type || 'schema'} to ${item.url || 'page'}`,
      source: 'schema.missing',
      action_type: 'schema_add',
      ...effortFromMinutes(20),
      impact_score: Math.min(100, 30 + ctrLift),
      estimated_traffic_gain: Math.round(ctrLift * 2),
      estimated_revenue_gain: 0,
      how_to_do_it: `Paste JSON-LD ${item.type} schema into page head. Validate with Google Rich Results test. Estimated ${ctrLift}% CTR lift.`,
      related_data: item,
    })
  }

  // ── SOURCE 4: Backlink opportunities (critical or ease_score >= 0.7) ──
  const { data: backlinkOpps } = await s
    .from('kotoiq_backlink_opportunities')
    .select('*')
    .eq('client_id', client_id)
    .or('priority.eq.critical,ease_score.gte.0.7')
    .eq('status', 'open')
    .order('ease_score', { ascending: false })
    .limit(15)
  for (const b of backlinkOpps || []) {
    const da = Number(b.domain_authority || 0)
    const ease = Number(b.ease_score || 0)
    const mins = ease >= 0.8 ? 60 : ease >= 0.7 ? 120 : 240
    candidates.push({
      title: `Pursue backlink: ${b.target_domain || b.target_url}`,
      source: 'backlink_opportunities',
      action_type: 'backlink_outreach',
      ...effortFromMinutes(mins),
      impact_score: Math.min(100, Math.round(da + ease * 30)),
      estimated_traffic_gain: Math.round(da * 0.5),
      estimated_revenue_gain: 0,
      how_to_do_it: (b.outreach_template as string) || b.strategy_notes || 'Send personalized outreach email to editor/owner. Reference existing content gap.',
      related_data: { domain: b.target_domain, da, ease, type: b.opportunity_type },
    })
  }

  // ── SOURCE 5: KotoIQ recommendations (quick_win + critical/high) ──
  const { data: recs } = await s
    .from('kotoiq_recommendations')
    .select('*')
    .eq('client_id', client_id)
    .eq('effort', 'quick_win')
    .in('priority', ['critical', 'high'])
    .in('status', ['pending', 'open'])
    .limit(15)
  for (const r of recs || []) {
    const impactBase = r.priority === 'critical' ? 75 : 55
    candidates.push({
      title: r.title || 'Untitled recommendation',
      source: 'recommendations',
      action_type: r.type || 'general',
      ...effortFromMinutes(30),
      impact_score: impactBase,
      estimated_traffic_gain: 0,
      estimated_revenue_gain: 0,
      how_to_do_it: r.detail || r.estimated_impact || 'See recommendation detail.',
      related_data: { rec_id: r.id, priority: r.priority, type: r.type },
    })
  }

  // ── SOURCE 6: On-page audits quick_wins ──
  const { data: onPageRows } = await s
    .from('kotoiq_on_page_audits')
    .select('url, target_keyword, quick_wins, overall_score, scanned_at')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(10)
  for (const row of onPageRows || []) {
    const qw = (row.quick_wins || []) as any[]
    for (const w of qw.slice(0, 3)) {
      candidates.push({
        title: `${typeof w === 'string' ? w : (w.title || w.fix || 'On-page fix')} — ${row.url}`,
        source: 'on_page_audits.quick_wins',
        action_type: 'on_page_fix',
        ...effortFromMinutes(15),
        impact_score: 45,
        estimated_traffic_gain: 0,
        estimated_revenue_gain: 0,
        how_to_do_it: typeof w === 'string' ? w : (w.how_to || w.detail || 'Apply the listed on-page fix.'),
        related_data: { url: row.url, keyword: row.target_keyword, fix: w },
      })
    }
  }

  // ── SOURCE 7: GSC audit striking distance ──
  const { data: gscRows } = await s
    .from('kotoiq_gsc_audits')
    .select('striking_distance, scanned_at')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
  const gscSD = (gscRows?.[0]?.striking_distance || []) as any[]
  for (const item of gscSD.slice(0, 10)) {
    const impressions = Number(item.impressions || 0)
    const pos = Number(item.position || 15)
    const trafficGain = Math.round(impressions * 0.08) // 8% CTR lift from moving into top 10
    candidates.push({
      title: `GSC striking distance: "${item.query || item.keyword}"`,
      source: 'gsc_audit.striking_distance',
      action_type: 'rank_push',
      ...effortFromMinutes(120),
      impact_score: Math.min(100, 40 + Math.round(trafficGain / 5)),
      estimated_traffic_gain: trafficGain,
      estimated_revenue_gain: 0,
      how_to_do_it: `Query currently at pos ${Math.round(pos)} with ${impressions} monthly impressions. Optimize ranking URL's title, H1, and opening paragraph around the query.`,
      related_data: item,
    })
  }

  // ── SOURCE 8: Link audit duplicate anchor issues ──
  const { data: linkAuditRows } = await s
    .from('kotoiq_link_audit')
    .select('duplicate_anchor_issues, scanned_at')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
  const dupAnchors = (linkAuditRows?.[0]?.duplicate_anchor_issues || []) as any[]
  for (const d of dupAnchors.slice(0, 10)) {
    candidates.push({
      title: `Fix duplicate anchor: "${d.anchor || d.anchor_text || '?'}"`,
      source: 'link_audit.duplicate_anchors',
      action_type: 'internal_link_fix',
      ...effortFromMinutes(10),
      impact_score: 25,
      estimated_traffic_gain: 0,
      estimated_revenue_gain: 0,
      how_to_do_it: 'Same anchor pointing to different URLs confuses search engines. Pick the canonical target and update the others.',
      related_data: d,
    })
  }

  // ── Filter by impact + effort ──
  const filtered = candidates.filter(c =>
    c.impact_score >= min_impact && EFFORT_RANK[(c.effort_category || c.category || 'moderate') as EffortCategory] <= maxRank
  )

  // Compute priority scores + sort
  const scored = filtered.map(c => ({
    ...c,
    priority: calcPriority(c.impact_score, c.effort_minutes || 30),
  })).sort((a, b) => b.priority - a.priority)

  // ── Use Claude to summarize/re-rank the top 25 ──
  const top25 = scored.slice(0, 25)
  let finalQueue = top25

  if (top25.length > 0) {
    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: 'You are an SEO strategist. You receive a list of candidate action items and must re-rank them by true business impact, tightening titles and how_to_do_it copy. Return ONLY valid JSON — an array of {index, title, how_to_do_it, priority_rank} where index matches the input item\'s position. Keep all items — just re-rank and tighten text.',
        messages: [{
          role: 'user',
          content: `Client has ${top25.length} candidate quick wins. Re-rank 1..${top25.length} and tighten copy:\n\n${JSON.stringify(top25.map((c, i) => ({ i, title: c.title, source: c.source, effort: c.effort, impact: c.impact_score, traffic: c.estimated_traffic_gain, how: c.how_to_do_it })), null, 0)}\n\nReturn JSON array of {index, title, how_to_do_it, priority_rank} only.`,
        }],
      })
      void logTokenUsage({
        feature: 'kotoiq_quick_win_queue',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: agency_id,
      })
      const text = (msg.content[0]?.type === 'text' ? msg.content[0].text : '[]')
        .replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const reranked = JSON.parse(text) as Array<{ index: number; title: string; how_to_do_it: string; priority_rank: number }>

      if (Array.isArray(reranked) && reranked.length) {
        const map = new Map<number, { title: string; how_to_do_it: string; priority_rank: number }>()
        for (const r of reranked) {
          if (typeof r.index === 'number') map.set(r.index, r)
        }
        finalQueue = top25
          .map((c, i) => {
            const r = map.get(i)
            return {
              ...c,
              title: r?.title || c.title,
              how_to_do_it: r?.how_to_do_it || c.how_to_do_it,
              priority: r?.priority_rank != null ? (top25.length - r.priority_rank + 1) : c.priority,
            }
          })
          .sort((a, b) => b.priority - a.priority)
      }
    } catch {
      /* non-blocking — fall back to scored order */
    }
  }

  // ── Persist — delete pending items + insert fresh top 25 ──
  try {
    await s.from('kotoiq_quick_win_queue').delete()
      .eq('client_id', client_id)
      .eq('status', 'pending')

    const rows = finalQueue.map((c, i) => ({
      client_id,
      title: c.title,
      source: c.source,
      action_type: c.action_type,
      effort: c.effort_category,
      effort_minutes: c.effort_minutes,
      impact_score: c.impact_score,
      estimated_traffic_gain: c.estimated_traffic_gain || 0,
      estimated_revenue_gain: c.estimated_revenue_gain || 0,
      priority: Math.round(c.priority * 100) / 100,
      how_to_do_it: c.how_to_do_it,
      related_data: c.related_data || {},
      status: 'pending',
    }))

    if (rows.length) {
      const { data: inserted } = await s.from('kotoiq_quick_win_queue').insert(rows).select()
      if (inserted) finalQueue = inserted.map((row: any) => ({
        ...row,
        effort_category: row.effort, // keep shape consistent with local type if consumed directly
      })) as any
    }
  } catch { /* non-blocking */ }

  // ── Pull saved rows (so ids are returned) ──
  const { data: saved } = await s
    .from('kotoiq_quick_win_queue')
    .select('*')
    .eq('client_id', client_id)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(25)

  const queue = (saved || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    action_type: r.action_type,
    effort: r.effort,
    effort_minutes: r.effort_minutes,
    impact_score: Number(r.impact_score || 0),
    estimated_traffic_gain: Number(r.estimated_traffic_gain || 0),
    estimated_revenue_gain: Number(r.estimated_revenue_gain || 0),
    priority: Number(r.priority || 0),
    how_to_do_it: r.how_to_do_it,
    related_data: r.related_data || {},
    status: r.status,
  }))

  const totalTraffic = queue.reduce((sum, q) => sum + (q.estimated_traffic_gain || 0), 0)
  const totalRevenue = queue.reduce((sum, q) => sum + (q.estimated_revenue_gain || 0), 0)

  return {
    queue,
    total_items: queue.length,
    estimated_total_traffic_gain: totalTraffic,
    estimated_total_revenue_gain: Math.round(totalRevenue * 100) / 100,
  }
}

// ── Update Quick Win Status ─────────────────────────────────────────────────
export async function updateQuickWinStatus(
  s: SupabaseClient,
  body: { item_id: string; status: 'done' | 'in_progress' | 'skipped' | 'pending' }
) {
  const { item_id, status } = body
  if (!item_id) throw new Error('item_id required')
  if (!['done', 'in_progress', 'skipped', 'pending'].includes(status)) throw new Error('invalid status')

  const update: any = { status }
  if (status === 'done') update.completed_at = new Date().toISOString()

  const { data, error } = await s
    .from('kotoiq_quick_win_queue')
    .update(update)
    .eq('id', item_id)
    .select()
    .single()

  if (error) throw error
  return { success: true, item: data }
}
