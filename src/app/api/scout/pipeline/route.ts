import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const STAGES = ['new','contacted','interested','proposal_sent','negotiating','won','lost']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agency_id = searchParams.get('agency_id')
  const stage     = searchParams.get('stage')
  const sb = getSupabase()

  let q = sb.from('scout_pipeline').select('*').eq('agency_id', agency_id).order('lead_score', { ascending: false })
  if (stage && stage !== 'all') q = q.eq('stage', stage)

  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by stage for kanban
  const byStage: Record<string, any[]> = {}
  for (const s of STAGES) byStage[s] = []
  for (const lead of data || []) {
    if (byStage[lead.stage]) byStage[lead.stage].push(lead)
    else byStage['new'].push(lead)
  }

  // Pipeline stats
  const total = data?.length || 0
  const won   = data?.filter(l => l.stage === 'won').length || 0
  const pipeline_value = data?.filter(l => !['won','lost'].includes(l.stage))
    .reduce((s, l) => s + (l.estimated_value || 0), 0) || 0

  return NextResponse.json({ leads: data || [], by_stage: byStage, stats: { total, won, pipeline_value } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id } = body
    const sb = getSupabase()

    // ── Add lead (from Scout or manually) ──────────────────────────────────
    if (action === 'add') {
      const { lead } = body
      const { data, error } = await sb.from('scout_pipeline').insert({
        agency_id, ...lead, stage: lead.stage || 'new',
      }).select().single()
      if (error) throw error
      return NextResponse.json({ lead: data })
    }

    // ── Update stage ────────────────────────────────────────────────────────
    if (action === 'move') {
      const { lead_id, new_stage, lost_reason } = body
      const { data: old } = await sb.from('scout_pipeline').select('stage').eq('id', lead_id).single()
      const updates: any = { stage: new_stage, updated_at: new Date().toISOString() }
      if (lost_reason) updates.lost_reason = lost_reason
      if (new_stage === 'contacted' && !old?.stage?.includes('contacted')) {
        updates.last_contacted = new Date().toISOString()
      }
      await sb.from('scout_pipeline').update(updates).eq('id', lead_id)
      // Log activity
      await sb.from('scout_pipeline_activity').insert({
        pipeline_id: lead_id, agency_id, type: 'stage_change',
        content: `Moved from ${old?.stage || 'new'} → ${new_stage}`,
        old_stage: old?.stage, new_stage,
      })
      return NextResponse.json({ ok: true })
    }

    // ── Add note / activity ─────────────────────────────────────────────────
    if (action === 'note') {
      const { lead_id, type, content } = body
      await sb.from('scout_pipeline_activity').insert({
        pipeline_id: lead_id, agency_id, type: type || 'note', content,
      })
      await sb.from('scout_pipeline').update({
        notes: content, updated_at: new Date().toISOString(),
        ...(type === 'call' || type === 'email' ? { last_contacted: new Date().toISOString() } : {}),
      }).eq('id', lead_id)
      return NextResponse.json({ ok: true })
    }

    // ── Get activity for a lead ─────────────────────────────────────────────
    if (action === 'activity') {
      const { lead_id } = body
      const { data } = await sb.from('scout_pipeline_activity').select('*')
        .eq('pipeline_id', lead_id).order('created_at', { ascending: false }).limit(20)
      return NextResponse.json({ activity: data || [] })
    }

    // ── Update lead fields ──────────────────────────────────────────────────
    if (action === 'update') {
      const { lead_id, updates } = body
      const { data } = await sb.from('scout_pipeline').update({
        ...updates, updated_at: new Date().toISOString()
      }).eq('id', lead_id).select().single()
      return NextResponse.json({ lead: data })
    }

    // ── Delete lead ─────────────────────────────────────────────────────────
    if (action === 'delete') {
      await sb.from('scout_pipeline').delete().eq('id', body.lead_id)
      return NextResponse.json({ ok: true })
    }

    // ── Generate outreach email for a lead ──────────────────────────────────
    if (action === 'outreach_email') {
      const { lead } = body
      if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 400 })

      const prompt = `Write a short, personalized cold outreach email to ${lead.business_name} (${lead.industry || 'local business'}).

Their gap analysis shows:
- Lead score: ${lead.lead_score}/100
- Temperature: ${lead.temperature}
- Scout data: ${JSON.stringify(lead.scout_data?.gaps || lead.scout_data || {}).slice(0, 400)}

Write a 3-paragraph email:
1. Intro — reference something specific about their business
2. Value — what specific problem you noticed (reviews, SEO, website, etc.)
3. CTA — short, low-pressure ask

Tone: direct, confident, helpful. Not salesy. Max 150 words total.
Output ONLY the email body, no subject line, no "Dear", just start with "Hi [Name],"
`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      return NextResponse.json({ email: data.content?.[0]?.text?.trim() })
    }

    // ── Convert won lead to client ──────────────────────────────────────────
    if (action === 'convert') {
      const { lead_id } = body
      const { data: lead } = await sb.from('scout_pipeline').select('*').eq('id', lead_id).single()
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

      const { data: client, error: clientErr } = await sb.from('clients').insert({
        agency_id,
        name:      lead.business_name,
        email:     lead.email,
        phone:     lead.phone,
        website:   lead.website,
        city:      lead.city,
        state:     lead.state,
        industry:  lead.industry,
        sic_code:  lead.sic_code,
        status:    'active',
        google_place_id: lead.google_place_id,
      }).select().single()
      if (clientErr) throw clientErr

      // Mark lead as won
      await sb.from('scout_pipeline').update({ stage: 'won' }).eq('id', lead_id)
      await sb.from('scout_pipeline_activity').insert({
        pipeline_id: lead_id, agency_id, type: 'stage_change',
        content: `Converted to client (ID: ${client.id})`,
        old_stage: lead.stage, new_stage: 'won',
      })
      return NextResponse.json({ client_id: client.id, ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
