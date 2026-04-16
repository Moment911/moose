// ─────────────────────────────────────────────────────────────
// Content Calendar & Publishing Momentum Engine — KotoIQ #15
// Builds prioritized publishing calendar from topical map gaps,
// content inventory, and keyword data. Calculates VDM scores.
// ─────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Helpers ──────────────────────────────────────────────────

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// ── Build Content Calendar ───────────────────────────────────
export async function buildContentCalendar(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  // 1. Get topical map nodes (gap and partial coverage)
  const { data: nodes } = await s.from('kotoiq_topical_nodes')
    .select('*')
    .eq('client_id', client_id)
    .in('coverage_status', ['gap', 'partial'])
    .order('priority_score', { ascending: false })

  // 2. Get content inventory (pages due for refresh)
  const { data: inventory } = await s.from('kotoiq_content_inventory')
    .select('*')
    .eq('client_id', client_id)
    .in('refresh_priority', ['urgent', 'soon'])
    .order('refresh_priority')

  // 3. Get keyword data for volume info
  const { data: keywords } = await s.from('kotoiq_keywords')
    .select('keyword, kp_monthly_volume, opportunity_score, intent, category')
    .eq('client_id', client_id)
    .order('opportunity_score', { ascending: false })
    .limit(200)

  // 4. Get client info
  const { data: client } = await s.from('clients')
    .select('name, primary_service, website')
    .eq('id', client_id)
    .single()

  // Build context for Claude
  const gapNodes = (nodes || []).filter(n => n.coverage_status === 'gap')
  const partialNodes = (nodes || []).filter(n => n.coverage_status === 'partial')
  const refreshPages = inventory || []
  const topKeywords = (keywords || []).slice(0, 50)

  const prompt = `You are building a content publishing calendar for "${client?.name || 'Business'}" (${client?.primary_service || 'local business'}).

DATA:
- Gap topics (no content exists): ${gapNodes.length} topics
${gapNodes.slice(0, 30).map(n => `  - "${n.topic}" [section: ${n.section}, priority: ${n.priority_score}]`).join('\n')}

- Partial topics (thin content): ${partialNodes.length} topics
${partialNodes.slice(0, 20).map(n => `  - "${n.topic}" [section: ${n.section}, priority: ${n.priority_score}]`).join('\n')}

- Pages needing refresh: ${refreshPages.length}
${refreshPages.slice(0, 15).map(p => `  - "${p.title || p.url}" [priority: ${p.refresh_priority}, trajectory: ${p.trajectory}]`).join('\n')}

- Top keywords by opportunity: ${topKeywords.length}
${topKeywords.slice(0, 20).map(k => `  - "${k.keyword}" [vol: ${k.kp_monthly_volume}, opp: ${k.opportunity_score}, intent: ${k.intent}]`).join('\n')}

Create a prioritized publishing calendar with 12-20 content items. Prioritize:
1. High-volume gap nodes from core section
2. Declining content needing refresh
3. Gap nodes from outer sections
4. New content from query clusters

Return JSON only:
{
  "items": [
    {
      "title": "Page title",
      "target_keyword": "primary keyword",
      "content_type": "blog|service_page|landing_page|faq|comparison|guide",
      "priority": 1,
      "estimated_word_count": 1500,
      "rationale": "Why this piece matters",
      "is_refresh": false
    }
  ]
}`

  let calendarItems: any[] = []

  try {
    const res = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      calendarItems = parsed.items || []
    }

    logTokenUsage({
      feature: 'kotoiq_content_calendar',
      model: 'claude-sonnet-4-20250514',
      inputTokens: res.usage?.input_tokens || 0,
      outputTokens: res.usage?.output_tokens || 0,
    })
  } catch (e: any) {
    return { error: 'AI calendar generation failed: ' + e.message, status: 500 }
  }

  if (!calendarItems.length) return { error: 'No calendar items generated', status: 500 }

  // Spread across weeks starting from next Monday
  const today = new Date()
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + daysUntilMonday)

  // Delete existing planned items (keep published/writing/review)
  await s.from('kotoiq_content_calendar')
    .delete()
    .eq('client_id', client_id)
    .eq('status', 'planned')

  const rows = calendarItems.map((item: any, i: number) => {
    // Spread: ~2 items per week
    const weekOffset = Math.floor(i / 2)
    const dayOffset = (i % 2) * 3 // Mon and Thu
    const plannedDate = addDays(startDate, weekOffset * 7 + dayOffset)

    // Try to match to a topical node
    const matchNode = (nodes || []).find(n =>
      n.topic.toLowerCase().includes((item.target_keyword || '').toLowerCase().split(' ')[0])
    )

    return {
      client_id,
      title: item.title,
      target_keyword: item.target_keyword || null,
      content_type: item.content_type || 'blog',
      status: item.is_refresh ? 'refresh' : 'planned',
      planned_date: plannedDate,
      refresh_date: null,
      topical_node_id: matchNode?.id || null,
      word_count: item.estimated_word_count || null,
      notes: item.rationale || null,
    }
  })

  const { data: inserted, error } = await s.from('kotoiq_content_calendar').insert(rows).select()
  if (error) return { error: error.message, status: 500 }

  return { success: true, items: inserted, total: inserted?.length || 0 }
}

// ── Get Content Calendar ─────────────────────────────────────
export async function getContentCalendar(s: SupabaseClient, body: any) {
  const { client_id, status, month, content_type } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  let q = s.from('kotoiq_content_calendar')
    .select('*')
    .eq('client_id', client_id)
    .order('planned_date', { ascending: true })

  if (status) q = q.eq('status', status)
  if (content_type) q = q.eq('content_type', content_type)
  if (month) {
    // month format: "2026-05"
    q = q.gte('planned_date', `${month}-01`).lte('planned_date', `${month}-31`)
  }

  const { data, error } = await q
  if (error) return { error: error.message, status: 500 }

  // Aggregate stats
  const items = data || []
  const stats = {
    total: items.length,
    planned: items.filter(i => i.status === 'planned').length,
    writing: items.filter(i => i.status === 'writing').length,
    review: items.filter(i => i.status === 'review').length,
    published: items.filter(i => i.status === 'published').length,
    refresh: items.filter(i => i.status === 'refresh').length,
  }

  return { items, stats }
}

// ── Update Calendar Item ─────────────────────────────────────
export async function updateCalendarItem(s: SupabaseClient, body: any) {
  const { id, ...updates } = body
  if (!id) return { error: 'id required', status: 400 }

  const allowed = ['title', 'target_keyword', 'content_type', 'status', 'planned_date',
    'published_date', 'refresh_date', 'assigned_to', 'notes', 'published_url', 'word_count']
  const clean: any = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (updates[k] !== undefined) clean[k] = updates[k]
  }

  // If publishing, set published_date and calculate refresh_date (6 months)
  if (clean.status === 'published' && !clean.published_date) {
    clean.published_date = new Date().toISOString().split('T')[0]
    const refreshDate = new Date()
    refreshDate.setMonth(refreshDate.getMonth() + 6)
    clean.refresh_date = refreshDate.toISOString().split('T')[0]
  }

  const { data, error } = await s.from('kotoiq_content_calendar').update(clean).eq('id', id).select().single()
  if (error) return { error: error.message, status: 500 }
  return { success: true, item: data }
}

// ── Calculate Momentum ───────────────────────────────────────
export async function calculateMomentum(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  const now = new Date()
  const thisMonthStart = startOfMonth(now).toISOString().split('T')[0]
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)).toISOString().split('T')[0]
  const twoMonthsAgoStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1)).toISOString().split('T')[0]
  const threeMonthsAgoStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 3, 1)).toISOString().split('T')[0]

  // Count published pages from both content_inventory and calendar
  const { count: inventoryTotal } = await s.from('kotoiq_content_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)

  const { count: calPublishedThisMonth } = await s.from('kotoiq_content_calendar')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .eq('status', 'published')
    .gte('published_date', thisMonthStart)

  const { count: calPublishedLastMonth } = await s.from('kotoiq_content_calendar')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .eq('status', 'published')
    .gte('published_date', lastMonthStart)
    .lt('published_date', thisMonthStart)

  const { count: calPublished2mo } = await s.from('kotoiq_content_calendar')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .eq('status', 'published')
    .gte('published_date', twoMonthsAgoStart)
    .lt('published_date', lastMonthStart)

  const pagesThisMonth = calPublishedThisMonth || 0
  const pagesLastMonth = calPublishedLastMonth || 0
  const pages3moAvg = Math.round(((pagesThisMonth + pagesLastMonth + (calPublished2mo || 0)) / 3) * 10) / 10

  // Topical map for vastness
  const { count: totalNodes } = await s.from('kotoiq_topical_nodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)

  const { count: coveredNodes } = await s.from('kotoiq_topical_nodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .eq('coverage_status', 'covered')

  // Vastness: breadth of topic coverage
  const vastnessRaw = (totalNodes || 0) > 0 ? ((coveredNodes || 0) / (totalNodes || 1)) : 0
  const vastnessScore = Math.round(vastnessRaw * 100)

  // Depth: avg word count across inventory pages
  const { data: inventoryPages } = await s.from('kotoiq_content_inventory')
    .select('word_count')
    .eq('client_id', client_id)
    .gt('word_count', 0)

  const avgWordCount = inventoryPages?.length
    ? Math.round(inventoryPages.reduce((sum, p) => sum + (p.word_count || 0), 0) / inventoryPages.length)
    : 0
  // 2000+ words = 100 depth, scale linearly
  const depthScore = Math.min(Math.round((avgWordCount / 2000) * 100), 100)

  // Momentum: publishing velocity
  // Target: 4 pages/month = 100, scale linearly
  const momentumScore = Math.min(Math.round((pages3moAvg / 4) * 100), 100)

  // VDM overall
  const overallVDM = Math.round(vastnessScore * 0.35 + depthScore * 0.35 + momentumScore * 0.30)

  // Refresh stats
  const { count: dueRefresh } = await s.from('kotoiq_content_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .in('refresh_priority', ['urgent', 'soon'])

  const { count: overdueRefresh } = await s.from('kotoiq_content_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .eq('refresh_priority', 'urgent')

  // Recommendations via Claude
  let recommendedPace = ''
  let priorityTopics: string[] = []

  try {
    const { data: gapNodes } = await s.from('kotoiq_topical_nodes')
      .select('topic, section, priority_score')
      .eq('client_id', client_id)
      .eq('coverage_status', 'gap')
      .order('priority_score', { ascending: false })
      .limit(10)

    const res = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Content velocity analysis:
- Pages this month: ${pagesThisMonth}
- Pages last month: ${pagesLastMonth}
- 3-month avg: ${pages3moAvg}
- Total indexed pages: ${inventoryTotal || 0}
- Avg word count: ${avgWordCount}
- Topical coverage: ${vastnessScore}% (${coveredNodes}/${totalNodes} topics covered)
- Pages needing refresh: ${dueRefresh || 0}

Top gap topics: ${(gapNodes || []).map(n => n.topic).join(', ')}

Return JSON only:
{
  "recommended_pace": "One sentence recommendation like: Publish 4 pages/month to match competitors and close topical gaps within 6 months.",
  "priority_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"]
}
Focus on actionable velocity advice following the KotoIQ VDM framework: if you can't go wide, go deeper and faster.`
      }],
    })

    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      recommendedPace = parsed.recommended_pace || ''
      priorityTopics = parsed.priority_topics || []
    }

    logTokenUsage({
      feature: 'kotoiq_publishing_momentum',
      model: 'claude-sonnet-4-20250514',
      inputTokens: res.usage?.input_tokens || 0,
      outputTokens: res.usage?.output_tokens || 0,
    })
  } catch (e) { /* continue without recommendation */ }

  const row = {
    client_id,
    vastness_score: vastnessScore,
    depth_score: depthScore,
    momentum_score: momentumScore,
    overall_vdm_score: overallVDM,
    pages_this_month: pagesThisMonth,
    pages_last_month: pagesLastMonth,
    pages_3mo_avg: pages3moAvg,
    competitor_velocity: [],
    pages_due_refresh: dueRefresh || 0,
    pages_overdue_refresh: overdueRefresh || 0,
    recommended_pace: recommendedPace,
    priority_topics: priorityTopics,
    calculated_at: new Date().toISOString(),
  }

  await s.from('kotoiq_publishing_momentum').delete().eq('client_id', client_id)
  const { error } = await s.from('kotoiq_publishing_momentum').insert(row)
  if (error) return { error: error.message, status: 500 }

  return { success: true, data: row }
}

// ── Get Momentum ─────────────────────────────────────────────
export async function getMomentum(s: SupabaseClient, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required', status: 400 }

  const { data, error } = await s.from('kotoiq_publishing_momentum')
    .select('*')
    .eq('client_id', client_id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') return { error: error.message, status: 500 }
  return { data: data || null }
}
