import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processFollowUpQueue, cancelSequenceForLead } from '@/lib/followUpSequencer'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_queue'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'get_queue') {
      const { data } = await s
        .from('koto_follow_up_queue')
        .select('*')
        .eq('status', 'pending')
        .eq('agency_id', agencyId)
        .order('scheduled_at', { ascending: true })
        .limit(100)
      return Response.json({ queue: data || [] })
    }

    if (action === 'get_history') {
      const { data } = await s
        .from('koto_follow_up_queue')
        .select('*')
        .eq('agency_id', agencyId)
        .in('status', ['sent', 'failed', 'cancelled'])
        .order('executed_at', { ascending: false })
        .limit(100)
      return Response.json({ history: data || [] })
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

    if (action === 'process_queue') {
      const result = await processFollowUpQueue()
      return Response.json({ success: true, ...result })
    }

    if (action === 'cancel_sequence') {
      const { lead_id } = body
      if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 })
      const cancelled = await cancelSequenceForLead(lead_id)
      return Response.json({ success: true, cancelled })
    }

    if (action === 'update_step') {
      const { step_id, scheduled_at, status } = body
      if (!step_id) return Response.json({ error: 'step_id required' }, { status: 400 })
      const updates: any = {}
      if (scheduled_at) updates.scheduled_at = scheduled_at
      if (status) updates.status = status
      await s.from('koto_follow_up_queue').update(updates).eq('id', step_id)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
