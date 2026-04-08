import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBestCallTime, generateCallHeatmap } from '@/lib/predictiveDialing'
import { scoreLead, scoreLeadBatch } from '@/lib/propensityScorer'
import { runDecayUpdate, getDecayDashboard } from '@/lib/leadDecayEngine'
import { getDealVelocityInsights } from '@/lib/dealVelocityTracker'
import { generateDailyDebrief } from '@/lib/debriefEmailEngine'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || ''
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'get_heatmap') {
      const sicCode = searchParams.get('sic_code') || '1711'
      const state = searchParams.get('state') || undefined
      const best = await getBestCallTime(sicCode, state)
      const heatmap = generateCallHeatmap(best.heatmap)
      return Response.json({ best, heatmap })
    }

    if (action === 'get_lead_scores') {
      const campaignId = searchParams.get('campaign_id')
      let query = s.from('koto_lead_scores_history').select('*').eq('agency_id', agencyId)
      if (campaignId) {
        const { data: leads } = await s.from('koto_voice_leads').select('id').eq('campaign_id', campaignId)
        const ids = (leads || []).map((l: any) => l.id)
        if (ids.length) query = query.in('lead_id', ids)
      }
      const { data } = await query.order('scored_at', { ascending: false }).limit(200)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_decay_dashboard') {
      const result = await getDecayDashboard(agencyId)
      return Response.json(result)
    }

    if (action === 'get_velocity_insights') {
      const result = await getDealVelocityInsights(agencyId)
      return Response.json(result)
    }

    if (action === 'get_debrief_history') {
      const { data } = await s.from('koto_debrief_emails').select('*').eq('agency_id', agencyId).order('sent_at', { ascending: false }).limit(30)
      return Response.json({ data: data || [] })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    if (action === 'score_leads') {
      const { campaign_id, agency_id } = body
      const { data: leads } = await s.from('koto_voice_leads').select('*').eq('campaign_id', campaign_id).limit(200)
      if (!leads?.length) return Response.json({ error: 'No leads' }, { status: 400 })
      const scored = await scoreLeadBatch(leads, agency_id)
      return Response.json({ success: true, scored: scored.length })
    }

    if (action === 'run_decay_update') {
      const result = await runDecayUpdate(body.agency_id)
      return Response.json({ success: true, ...result })
    }

    if (action === 'send_debrief_now') {
      const html = await generateDailyDebrief(body.agency_id, new Date())
      return Response.json({ success: !!html, sent: !!html })
    }

    if (action === 'get_best_time') {
      const result = await getBestCallTime(body.sic_code || '1711', body.state)
      return Response.json(result)
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
