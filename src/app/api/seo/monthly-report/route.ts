import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Pull all data for a client for a given month ─────────────────────────────
async function gatherClientData(clientId: string, monthStr: string) {
  const sb = getSupabase()

  // Date range for the month
  const [year, month] = monthStr.split('-').map(Number)
  const start = new Date(year, month - 1, 1).toISOString()
  const end   = new Date(year, month, 0, 23, 59, 59).toISOString()
  const prev  = new Date(year, month - 2, 1).toISOString()

  const [
    { data: client },
    { data: reviews },
    { data: prevReviews },
    { data: gbpAudits },
    { data: pageAudits },
    { data: keywords },
    { data: rankScans },
    { data: tickets },
    { data: projects },
  ] = await Promise.all([
    sb.from('clients').select('*').eq('id', clientId).single(),
    sb.from('reviews').select('*').eq('client_id', clientId).gte('created_at', start).lte('created_at', end),
    sb.from('reviews').select('*').eq('client_id', clientId).gte('created_at', prev).lt('created_at', start),
    sb.from('gbp_audits').select('*').eq('client_id', clientId).order('audited_at', { ascending: false }).limit(1),
    sb.from('seo_page_audits').select('*').eq('client_id', clientId).order('audited_at', { ascending: false }).limit(1),
    sb.from('seo_tracked_keywords').select('*').eq('client_id', clientId).order('tracked_at', { ascending: false }).limit(30),
    sb.from('local_rank_scans').select('*').eq('client_id', clientId).gte('created_at', start).lte('created_at', end).limit(10),
    sb.from('desk_tickets').select('*').eq('client_id', clientId).gte('created_at', start).lte('created_at', end),
    sb.from('projects').select('*').eq('client_id', clientId).eq('status', 'active'),
  ])

  // Calculate review stats
  const thisMonthReviews  = reviews || []
  const lastMonthReviews  = prevReviews || []
  const avgRating = thisMonthReviews.filter((r: any) => r.rating).length
    ? thisMonthReviews.filter((r: any) => r.rating).reduce((s: number, r: any) => s + r.rating, 0) / thisMonthReviews.filter((r: any) => r.rating).length
    : null
  const prevAvgRating = lastMonthReviews.filter((r: any) => r.rating).length
    ? lastMonthReviews.filter((r: any) => r.rating).reduce((s: number, r: any) => s + r.rating, 0) / lastMonthReviews.filter((r: any) => r.rating).length
    : null

  return {
    client,
    month: monthStr,
    reviews: {
      this_month:       thisMonthReviews.length,
      last_month:       lastMonthReviews.length,
      avg_rating:       avgRating ? Math.round(avgRating * 10) / 10 : null,
      prev_avg_rating:  prevAvgRating ? Math.round(prevAvgRating * 10) / 10 : null,
      responded:        thisMonthReviews.filter((r: any) => r.is_responded).length,
      recent:           thisMonthReviews.slice(0, 3).map((r: any) => ({ rating: r.rating, text: r.review_text?.slice(0, 150), author: r.reviewer_name })),
    },
    gbp: gbpAudits?.[0] ? {
      score:        gbpAudits[0].score,
      business_name: gbpAudits[0].business_name,
      top_issues:   (gbpAudits[0].recommendations || []).slice(0, 3).map((r: any) => r.label),
      audited_at:   gbpAudits[0].audited_at,
    } : null,
    seo: pageAudits?.[0] ? {
      score:       pageAudits[0].score,
      url:         pageAudits[0].url,
      audited_at:  pageAudits[0].audited_at,
    } : null,
    keywords: {
      total:       keywords?.length || 0,
      high_prio:   keywords?.filter((k: any) => k.opportunity === 'high').length || 0,
      top:         keywords?.slice(0, 5).map((k: any) => k.keyword) || [],
    },
    rank_scans:    rankScans?.length || 0,
    tickets: {
      total:    tickets?.length || 0,
      resolved: tickets?.filter((t: any) => ['resolved','closed'].includes(t.status)).length || 0,
    },
    active_projects: projects?.length || 0,
  }
}

// ── Generate AI narrative via Claude ────────────────────────────────────────
async function generateNarrative(data: any, agencyName: string) {
  if (!ANTHROPIC_KEY) return null

  const d = data
  const monthLabel = new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prompt = `You are a senior marketing agency account manager writing a monthly performance report for a client.

Agency: ${agencyName}
Client: ${d.client?.name}
Month: ${monthLabel}
Industry: ${d.client?.industry || 'Unknown'}

PERFORMANCE DATA:

Reviews:
- New reviews this month: ${d.reviews.this_month} (last month: ${d.reviews.last_month})
- Average rating: ${d.reviews.avg_rating || 'N/A'}★ (last month: ${d.reviews.prev_avg_rating || 'N/A'}★)
- Responded to: ${d.reviews.responded} of ${d.reviews.this_month}
${d.reviews.recent?.length ? '- Recent review highlights: ' + d.reviews.recent.map((r: any) => `"${r.text}" (${r.rating}★)`).join(' | ') : ''}

Google Business Profile:
${d.gbp ? `- GBP Score: ${d.gbp.score}/100\n- Top issues to fix: ${d.gbp.top_issues?.join(', ') || 'None'}` : '- No GBP audit this month'}

On-Page SEO:
${d.seo ? `- SEO Score: ${d.seo.score}/100 for ${d.seo.url}` : '- No page audit this month'}

Keywords:
- Total tracked: ${d.keywords.total}
- High priority opportunities: ${d.keywords.high_prio}
${d.keywords.top?.length ? '- Top opportunities: ' + d.keywords.top.join(', ') : ''}

Support:
- Tickets opened: ${d.tickets.total}, resolved: ${d.tickets.resolved}
- Active projects: ${d.active_projects}

Write a professional, client-friendly monthly report. Tone: confident, clear, agency-professional. 
Not too long — clients should be able to read it in 2 minutes.

Return ONLY valid JSON (no markdown):
{
  "subject_line": "compelling email subject line for this report",
  "executive_summary": "2-3 sentence overview of the month — lead with the most positive metric, then what needs attention",
  "wins": [
    {"title": "Win title", "detail": "specific detail with numbers"}
  ],
  "areas_to_improve": [
    {"title": "Area", "detail": "specific recommendation"}
  ],
  "review_narrative": "1-2 sentences specifically about reviews performance and response rate",
  "seo_narrative": "1-2 sentences about SEO/GBP health",
  "next_month_focus": ["priority 1 for next month", "priority 2", "priority 3"],
  "closing_line": "one warm closing sentence from the agency to the client"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
  })
  if (!res.ok) return null
  const d2 = await res.json()
  try {
    let text = d2.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)
    return JSON.parse(text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, agency_id, month, agency_name } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const monthStr = month || new Date().toISOString().slice(0, 7)

    // Check for existing report
    const { data: existing } = await getSupabase()
      .from('seo_monthly_reports')
      .select('*')
      .eq('client_id', client_id)
      .eq('month', monthStr)
      .single()

    // Gather fresh data
    const reportData = await gatherClientData(client_id, monthStr)

    // Generate AI narrative
    const narrative = await generateNarrative(reportData, agency_name || 'Your Agency')

    const result = {
      client_id,
      month: monthStr,
      report_data: reportData,
      ai_narrative: narrative,
      generated_at: new Date().toISOString(),
    }

    // Save/update in DB
    if (existing) {
      await getSupabase().from('seo_monthly_reports').update({
        report_data: reportData, ai_narrative: narrative
      }).eq('id', existing.id)
    } else {
      await getSupabase().from('seo_monthly_reports').insert({
        client_id, agency_id, month: monthStr, report_data: reportData, ai_narrative: narrative
      })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data } = await getSupabase()
    .from('seo_monthly_reports')
    .select('*')
    .eq('client_id', client_id)
    .order('month', { ascending: false })
    .limit(12)

  return NextResponse.json({ reports: data || [] })
}
