import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getKCAccess } from '@/lib/kotoclose-auth'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'check_access'
    const s = sb()

    if (action === 'check_access') {
      const access = await getKCAccess()
      return Response.json(access)
    }

    const access = await getKCAccess()
    if (!access.canAccess) return Response.json({ error: 'Unauthorized' }, { status: 403 })

    const agencyFilter = access.isSuperAdmin ? null : access.agencyId

    if (action === 'dashboard_stats') {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      let baseQ = s.from('kc_calls').select('*', { count: 'exact', head: true })
      if (agencyFilter) baseQ = baseQ.eq('agency_id', agencyFilter)

      const [
        { count: liveCount },
        { count: totalToday },
        { count: connectedCount },
        { count: optedCount },
        { count: vmCount },
        { count: apptCount },
      ] = await Promise.all([
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).eq('status', 'live')
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).gte('created_at', todayISO)
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).gte('created_at', todayISO).in('outcome', ['completed', 'opted_in', 'appointment'])
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).in('outcome', ['completed', 'opted_in', 'appointment']),
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).gte('created_at', todayISO).eq('opted_in', true)
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('opted_in', true),
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).gte('created_at', todayISO).eq('status', 'voicemail')
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('status', 'voicemail'),
        agencyFilter
          ? s.from('kc_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyFilter).gte('created_at', todayISO).eq('appointment_set', true)
          : s.from('kc_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('appointment_set', true),
      ])

      let cbQuery = s.from('kc_callbacks').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      if (agencyFilter) cbQuery = cbQuery.eq('agency_id', agencyFilter)
      const { count: cbCount } = await cbQuery

      // Avg duration
      let durQuery = s.from('kc_calls').select('duration_seconds').gte('created_at', todayISO).not('duration_seconds', 'is', null)
      if (agencyFilter) durQuery = durQuery.eq('agency_id', agencyFilter)
      const { data: durData } = await durQuery.limit(500)
      const durations = (durData || []).map((d: any) => d.duration_seconds || 0).filter((d: number) => d > 0)
      const avgSec = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0
      const avgDuration = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, '0')}`

      const total = totalToday || 0
      const connected = connectedCount || 0
      const connectRate = total > 0 ? Math.round(connected / total * 1000) / 10 : 0

      return Response.json({
        live_calls: liveCount || 0, total_today: total, connected,
        opted_ins: optedCount || 0, voicemails: vmCount || 0,
        callbacks: cbCount || 0, appointments: apptCount || 0,
        avg_duration: avgDuration, connect_rate: connectRate,
      })
    }

    if (action === 'recent_calls') {
      const limit = parseInt(searchParams.get('limit') || '50')
      const filter = searchParams.get('filter') || 'all'
      const searchTerm = searchParams.get('search') || ''
      const sort = searchParams.get('sort') || 'time'

      let query = s.from('kc_calls').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)

      if (filter === 'completed') query = query.eq('status', 'completed')
      else if (filter === 'voicemail') query = query.eq('status', 'voicemail')
      else if (filter === 'callback') query = query.eq('status', 'callback')
      else if (filter === 'opted') query = query.eq('opted_in', true)
      else if (filter === 'appt') query = query.eq('appointment_set', true)
      else if (filter === 'na') query = query.eq('status', 'no_answer')

      if (searchTerm) {
        query = query.or(`contact_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      }

      if (sort === 'company') query = query.order('company_name', { ascending: true })
      else if (sort === 'duration') query = query.order('duration_seconds', { ascending: false })
      else if (sort === 'score') query = query.order('intelligence_score', { ascending: false })
      else query = query.order('created_at', { ascending: false })

      const { data } = await query.limit(limit)
      return Response.json({ data: data || [] })
    }

    if (action === 'callbacks') {
      const date = searchParams.get('date')
      let query = s.from('kc_callbacks').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      if (date) {
        query = query.gte('scheduled_at', `${date}T00:00:00`).lte('scheduled_at', `${date}T23:59:59`)
      } else {
        query = query.gte('scheduled_at', new Date().toISOString()).eq('status', 'pending')
      }
      const { data } = await query.order('scheduled_at', { ascending: true })
      return Response.json({ data: data || [] })
    }

    if (action === 'callback_calendar') {
      let query = s.from('kc_callbacks').select('scheduled_at').eq('status', 'pending')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const d = (row.scheduled_at || '').split('T')[0]
        if (d) counts[d] = (counts[d] || 0) + 1
      }
      return Response.json({ data: Object.entries(counts).map(([date, count]) => ({ date, count })) })
    }

    if (action === 'vm_library') {
      let query = s.from('kc_voicemails').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query.order('created_at', { ascending: false })
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
    const access = await getKCAccess()
    if (!access.canAccess) return Response.json({ error: 'Unauthorized' }, { status: 403 })

    if (action === 'schedule_callback') {
      const { contact_name, company_name, phone, scheduled_at, reason, notes, lead_id } = body
      const { data } = await s.from('kc_callbacks').insert({
        agency_id: access.agencyId || '00000000-0000-0000-0000-000000000099',
        contact_name, company_name, phone, scheduled_at, reason, notes: notes || null, lead_id: lead_id || null,
        status: 'pending',
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    if (action === 'toggle_agency') {
      if (!access.isSuperAdmin) return Response.json({ error: 'Super admin only' }, { status: 403 })
      const { agency_id, field, value } = body
      const valid = ['kotoclose_enabled', 'feature_intelligence', 'feature_rvm', 'feature_ghl', 'feature_brain_builder', 'max_daily_calls', 'max_campaigns', 'plan_tier']
      if (!valid.includes(field)) return Response.json({ error: 'Invalid field' }, { status: 400 })
      await s.from('kc_agency_access').upsert({ agency_id, [field]: value, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' })
      return Response.json({ success: true })
    }

    if (action === 'save_voicemail') {
      const { name, storage_path, public_url, duration_sec } = body
      const { data } = await s.from('kc_voicemails').insert({
        agency_id: access.agencyId || '00000000-0000-0000-0000-000000000099',
        name, storage_path: storage_path || null, public_url: public_url || null, duration_sec: duration_sec || 0,
        status: 'active',
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    if (action === 'delete_voicemail') {
      const agencyId = access.agencyId || '00000000-0000-0000-0000-000000000099'
      await s.from('kc_voicemails').delete().eq('id', body.id).eq('agency_id', agencyId)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
