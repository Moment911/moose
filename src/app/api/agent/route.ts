import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const BASE_URL      = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Pull all client data for the agent to analyze ────────────────────────────
async function gatherClientSnapshot(clientId: string) {
  const sb = getSupabase()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: client },
    { data: config },
    { data: reviews },
    { data: gbp },
    { data: pageAudit },
    { data: keywords },
    { data: citations },
    { data: rankScans },
    { data: tickets },
    { data: monthlyReport },
    { data: recentInsights },
  ] = await Promise.all([
    sb.from('clients').select('*').eq('id', clientId).single(),
    sb.from('agent_configs').select('*').eq('client_id', clientId).single(),
    sb.from('reviews').select('*').eq('client_id', clientId).gte('created_at', thirtyDaysAgo),
    sb.from('gbp_audits').select('*').eq('client_id', clientId).order('audited_at', { ascending: false }).limit(1),
    sb.from('seo_page_audits').select('*').eq('client_id', clientId).order('audited_at', { ascending: false }).limit(1),
    sb.from('seo_tracked_keywords').select('*').eq('client_id', clientId).order('tracked_at', { ascending: false }).limit(20),
    sb.from('citation_checks').select('*').eq('client_id', clientId).order('checked_at', { ascending: false }).limit(1),
    sb.from('local_rank_scans').select('*').eq('client_id', clientId).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(10),
    sb.from('desk_tickets').select('*').eq('client_id', clientId).gte('created_at', thirtyDaysAgo),
    sb.from('seo_monthly_reports').select('*').eq('client_id', clientId).order('month', { ascending: false }).limit(2),
    sb.from('agent_insights').select('*').eq('client_id', clientId).eq('dismissed', false).order('created_at', { ascending: false }).limit(20),
  ])

  return { client, config, reviews, gbp: gbp?.[0], pageAudit: pageAudit?.[0], keywords, citations: citations?.[0], rankScans, tickets, monthlyReport, recentInsights }
}

// ── Ask Claude to analyze everything as a CMO expert ────────────────────────
async function runCMOAnalysis(snapshot: any, runType: string, adhocQuestion?: string) {
  if (!ANTHROPIC_KEY) return null

  const { client, config, reviews, gbp, pageAudit, keywords, citations, rankScans, tickets, monthlyReport } = snapshot

  const avgRating = reviews?.length
    ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : 'N/A'

  const unrespondedReviews = reviews?.filter((r: any) => !r.is_responded).length || 0
  const highPriKeywords    = keywords?.filter((k: any) => k.opportunity === 'high').length || 0
  const openTickets        = tickets?.filter((t: any) => !['resolved','closed'].includes(t.status)).length || 0

  const systemPrompt = `You are a world-class Chief Marketing Officer with 25 years of expertise in:
- Local SEO, technical SEO, and AI-powered search (AEO/GEO)
- Pay-per-click advertising (Google Ads, Meta Ads, LSA)
- Reputation management and review generation
- Content marketing and topic authority
- Google Business Profile optimization
- Competitor intelligence and market positioning
- Marketing automation and growth systems

You are analyzing performance data for a client and must provide expert, actionable insights.
Be specific, data-driven, and prioritize by business impact. Think like an experienced CMO who
has managed hundreds of local businesses. Don't be generic — reference actual numbers.`

  const userPrompt = adhocQuestion
    ? `You are the autonomous marketing agent for ${client?.name}.

Here is their current data:

Business: ${client?.name} | Industry: ${client?.industry || 'Unknown'} (SIC: ${client?.sic_code || 'N/A'})
Location: ${[client?.city, client?.state].filter(Boolean).join(', ')}
Goals: ${config?.business_goals?.join(', ') || 'Not specified'}
Competitors: ${config?.competitors?.join(', ') || 'Not tracked'}
Monthly Budget: $${config?.monthly_budget || 'N/A'}

CURRENT METRICS:
- GBP Score: ${gbp?.score || 'N/A'}/100
- Reviews (30 days): ${reviews?.length || 0} new | Avg: ${avgRating}★ | Unresponded: ${unrespondedReviews}
- SEO Score: ${pageAudit?.score || 'N/A'}/100
- High Priority Keywords: ${highPriKeywords}
- Open Support Tickets: ${openTickets}
- Citations tracked: ${citations?.results?.length || 0}

USER QUESTION: ${adhocQuestion}

Answer as their dedicated CMO. Be specific, practical, and reference their actual data.`

    : `Perform a ${runType} analysis for ${client?.name}.

BUSINESS PROFILE:
- Name: ${client?.name}
- Industry: ${client?.industry || 'Unknown'} (SIC: ${client?.sic_code || 'N/A'})  
- Location: ${[client?.city, client?.state].filter(Boolean).join(', ')}
- Website: ${client?.website || 'None'}
- Goals: ${config?.business_goals?.join(', ') || 'Not specified'}
- Target Keywords: ${config?.target_keywords?.join(', ') || 'Not specified'}
- Competitors: ${config?.competitors?.join(', ') || 'None tracked'}
- Primary Channel: ${config?.primary_channel || 'Not specified'}
- Monthly Budget: $${config?.monthly_budget || 'Not specified'}
- Avg Ticket Value: $${config?.avg_ticket_value || 'Not specified'}

PERFORMANCE DATA:
GBP: Score ${gbp?.score || 'N/A'}/100 | Issues: ${(gbp?.recommendations || []).slice(0,3).map((r: any) => r.label).join(', ') || 'None'}
Reviews: ${reviews?.length || 0} new in 30 days | Avg ${avgRating}★ | ${unrespondedReviews} unresponded
SEO: Score ${pageAudit?.score || 'N/A'}/100 | URL: ${pageAudit?.url || 'N/A'}
Keywords: ${keywords?.length || 0} tracked | ${highPriKeywords} high-priority opportunities
Citations: ${(citations?.results || []).filter((r: any) => r.found).length}/${citations?.results?.length || 0} directories found
Local Rank Scans: ${rankScans?.length || 0} scans in 30 days
Open Tickets: ${openTickets}
Last Monthly Report: ${monthlyReport?.[0]?.month || 'None'}

As their autonomous CMO agent, produce a comprehensive analysis. Return ONLY valid JSON:
{
  "summary": "2-3 sentence executive summary of their current position and biggest opportunity",
  "overall_score": <0-100 health score>,
  "insights": [
    {
      "type": "win|alert|opportunity|recommendation|warning",
      "category": "seo|reviews|gbp|keywords|competitor|ppc|content|reputation",
      "priority": "critical|high|medium|low",
      "title": "Short punchy title",
      "body": "Specific, data-referenced insight with clear action",
      "metric_before": "current value or situation",
      "metric_after": "target or expected improvement"
    }
  ],
  "top_actions": [
    {"week": 1, "action": "specific action", "impact": "expected result", "effort": "low|medium|high"},
    {"week": 2, "action": "...", "impact": "...", "effort": "..."},
    {"week": 3, "action": "...", "impact": "...", "effort": "..."},
    {"week": 4, "action": "...", "impact": "...", "effort": "..."}
  ],
  "90_day_plan": {
    "month1": "Focus and key objectives",
    "month2": "Build on month 1 results",
    "month3": "Scale what's working"
  },
  "quick_wins": ["action 1", "action 2", "action 3"],
  "kpi_targets": [
    {"metric": "Reviews", "current": "${reviews?.length || 0}/mo", "target": "X/mo", "timeline": "60 days"},
    {"metric": "GBP Score", "current": "${gbp?.score || 0}", "target": "X", "timeline": "30 days"}
  ]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  try {
    let text = data.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)
    return JSON.parse(text)
  } catch { return null }
}

// ── Save insights to DB ──────────────────────────────────────────────────────
async function saveInsights(clientId: string, agencyId: string, runId: string, analysis: any) {
  if (!analysis?.insights?.length) return 0
  const sb = getSupabase()
  const toInsert = analysis.insights.map((ins: any) => ({
    client_id:     clientId,
    agency_id:     agencyId,
    run_id:        runId,
    type:          ins.type,
    category:      ins.category,
    priority:      ins.priority,
    title:         ins.title,
    body:          ins.body,
    metric_before: ins.metric_before || null,
    metric_after:  ins.metric_after  || null,
  }))
  await sb.from('agent_insights').insert(toInsert)
  return toInsert.length
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id, run_type = 'adhoc', question } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const sb = getSupabase()

    // Create run record
    const { data: run } = await sb.from('agent_runs').insert({
      client_id, agency_id, run_type,
      status: 'running', started_at: new Date().toISOString(),
    }).select().single()

    const runId = run?.id

    // Gather all data
    const snapshot = await gatherClientSnapshot(client_id)

    // Run CMO analysis
    const analysis = await runCMOAnalysis(snapshot, run_type, question)

    // Save insights
    const insightsCount = analysis ? await saveInsights(client_id, agency_id, runId, analysis) : 0

    // Update run record
    await sb.from('agent_runs').update({
      status: 'done',
      completed_at: new Date().toISOString(),
      tasks_run: 1,
      insights_count: insightsCount,
      summary: analysis?.summary || '',
      report_data: analysis || {},
    }).eq('id', runId)

    return NextResponse.json({ run_id: runId, analysis, snapshot: {
      client: snapshot.client,
      reviews_count: snapshot.reviews?.length || 0,
      gbp_score: snapshot.gbp?.score,
      seo_score: snapshot.pageAudit?.score,
      keywords_count: snapshot.keywords?.length || 0,
      open_tickets: snapshot.tickets?.filter((t: any) => !['resolved','closed'].includes(t.status)).length || 0,
    }})

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const sb = getSupabase()
  const [
    { data: config },
    { data: runs },
    { data: insights },
    { data: chats },
  ] = await Promise.all([
    sb.from('agent_configs').select('*').eq('client_id', client_id).single(),
    sb.from('agent_runs').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(10),
    sb.from('agent_insights').select('*').eq('client_id', client_id).eq('dismissed', false).order('created_at', { ascending: false }).limit(50),
    sb.from('agent_chats').select('*').eq('client_id', client_id).order('created_at', { ascending: true }).limit(50),
  ])

  return NextResponse.json({ config, runs, insights, chats })
}
