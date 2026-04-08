import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runParallelSession, calculateOptimalBatchSize } from '@/lib/parallelDialer'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_sessions'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'get_sessions') {
      const { data } = await s.from('koto_parallel_dial_sessions').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(20)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_session_status') {
      const sessionId = searchParams.get('session_id') || ''
      const { data: session } = await s.from('koto_parallel_dial_sessions').select('*').eq('id', sessionId).single()
      if (!session) return Response.json({ error: 'Not found' }, { status: 404 })

      const progressPct = session.total_leads > 0 ? Math.round(session.leads_dialed / session.total_leads * 100) : 0

      // Get latest batch
      const { data: latestBatch } = await s.from('koto_parallel_dial_attempts')
        .select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1).maybeSingle()

      return Response.json({
        ...session,
        progress_percent: progressPct,
        current_batch: latestBatch,
        estimated_remaining: session.calls_per_hour > 0 ? Math.round((session.total_leads - session.leads_dialed) / session.calls_per_hour * 60) : null,
      })
    }

    if (action === 'get_batch_history') {
      const sessionId = searchParams.get('session_id') || ''
      const { data } = await s.from('koto_parallel_dial_attempts').select('*').eq('session_id', sessionId).order('batch_number', { ascending: false }).limit(50)
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

    if (action === 'start_session') {
      const { campaign_id, agency_id, parallel_count, lead_filter } = body

      // Get leads
      let query = s.from('koto_voice_leads').select('*').eq('campaign_id', campaign_id).eq('status', 'pending')
      if (lead_filter === 'high_propensity') query = query.gte('lead_score', 60)
      const { data: leads } = await query.order('lead_score', { ascending: false }).limit(500)

      if (!leads?.length) return Response.json({ error: 'No pending leads in campaign' }, { status: 400 })

      // Get agency phone numbers
      const { data: phones } = await s.from('koto_phone_numbers').select('phone_number').eq('agency_id', agency_id).eq('status', 'active').limit(5)
      const fromNumbers = (phones || []).map((p: any) => p.phone_number)
      if (!fromNumbers.length) return Response.json({ error: 'No active phone numbers. Add numbers first.' }, { status: 400 })

      // Get agent
      const { data: campaign } = await s.from('koto_voice_campaigns').select('agent_id').eq('id', campaign_id).single()
      const { data: agent } = await s.from('koto_voice_agents').select('retell_agent_id').eq('id', campaign?.agent_id).maybeSingle()
      if (!agent?.retell_agent_id) return Response.json({ error: 'Campaign has no voice agent configured' }, { status: 400 })

      // Create session
      const count = Math.min(5, Math.max(2, parallel_count || 3))
      const { data: session } = await s.from('koto_parallel_dial_sessions').insert({
        agency_id, campaign_id,
        parallel_count: count,
        total_leads: leads.length,
        status: 'active',
      }).select('id').single()

      if (!session) return Response.json({ error: 'Failed to create session' }, { status: 500 })

      // Start async (non-blocking)
      const config = {
        campaignId: campaign_id,
        agencyId: agency_id,
        parallelCount: count,
        fromNumbers,
        agentId: agent.retell_agent_id,
        dynamicVariables: {},
      }

      // Fire and forget — the session runs in the background
      runParallelSession(session.id, leads, config).catch(e => {
        console.error('Parallel session error:', e)
        s.from('koto_parallel_dial_sessions').update({ status: 'stopped' }).eq('id', session.id)
      })

      const estCallsPerHour = count * 12 // ~12 batches per hour at 3s gap + 25s dial time
      return Response.json({
        success: true,
        session_id: session.id,
        total_leads: leads.length,
        parallel_count: count,
        estimated_calls_per_hour: estCallsPerHour,
        estimated_completion_minutes: Math.round(leads.length / estCallsPerHour * 60),
      })
    }

    if (action === 'pause_session') {
      await s.from('koto_parallel_dial_sessions').update({ status: 'paused', paused_at: new Date().toISOString() }).eq('id', body.session_id)
      return Response.json({ success: true })
    }

    if (action === 'resume_session') {
      await s.from('koto_parallel_dial_sessions').update({ status: 'active', paused_at: null }).eq('id', body.session_id)
      return Response.json({ success: true })
    }

    if (action === 'stop_session') {
      await s.from('koto_parallel_dial_sessions').update({ status: 'stopped', completed_at: new Date().toISOString() }).eq('id', body.session_id)
      return Response.json({ success: true })
    }

    if (action === 'get_optimal_batch_size') {
      const size = calculateOptimalBatchSize(body.connection_rate || 0.35)
      return Response.json({ optimal_batch_size: size })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
