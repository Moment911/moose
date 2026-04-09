import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'
import type { KCAccess } from '@/lib/kotoclose-auth'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

// Server-side access check — uses SERVICE_ROLE_KEY (matches existing app pattern)
async function resolveKCAccess(req: NextRequest, searchParams: URLSearchParams): Promise<KCAccess> {
  const s = sb()
  const agencyId = resolveAgencyId(req, searchParams) || searchParams.get('agency_id')

  // Check super admin header
  const isSuper = req.headers.get('x-koto-admin') === 'true'
  if (isSuper) {
    return { canAccess: true, isSuperAdmin: true, agencyId: agencyId || null, userEmail: 'admin@hellokoto.com', features: { intelligence: true, rvm: true, ghl: true, brainBuilder: true, dncScrub: true }, limits: { maxDailyCalls: 999999, maxCampaigns: 999 }, planTier: 'agency' }
  }

  // Resolve agency — try param, header, or default
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  // Check kc_agency_access
  const { data: access } = await s.from('kc_agency_access').select('*').eq('agency_id', aid).maybeSingle()
  if (!access || !access.kotoclose_enabled) {
    // Fallback: if no explicit access row but agency exists, grant default access
    const { data: agency } = await s.from('agencies').select('id').eq('id', aid).maybeSingle()
    if (agency) {
      return { canAccess: true, isSuperAdmin: false, agencyId: aid, userEmail: null, features: { intelligence: true, rvm: true, ghl: true, brainBuilder: true, dncScrub: true }, limits: { maxDailyCalls: 500, maxCampaigns: 10 }, planTier: 'agency' }
    }
    return { canAccess: false, isSuperAdmin: false, agencyId: null, userEmail: null, features: { intelligence: false, rvm: false, ghl: false, brainBuilder: false, dncScrub: false }, limits: { maxDailyCalls: 0, maxCampaigns: 0 }, planTier: 'starter' }
  }

  return {
    canAccess: true, isSuperAdmin: false, agencyId: aid, userEmail: null,
    features: { intelligence: access.feature_intelligence ?? true, rvm: access.feature_rvm ?? true, ghl: access.feature_ghl ?? true, brainBuilder: access.feature_brain_builder ?? true, dncScrub: access.feature_dnc_scrub ?? true },
    limits: { maxDailyCalls: access.max_daily_calls ?? 500, maxCampaigns: access.max_campaigns ?? 10 },
    planTier: (access.plan_tier as KCAccess['planTier']) || 'agency',
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'check_access'
    const s = sb()

    if (action === 'check_access') {
      const access = await resolveKCAccess(req, searchParams)
      return Response.json(access)
    }

    const access = await resolveKCAccess(req, searchParams)
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

    if (action === 'campaigns') {
      let query = s.from('kc_campaigns').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query.order('created_at', { ascending: false })
      return Response.json({ data: data || [] })
    }

    if (action === 'signal_feed') {
      const limit = parseInt(searchParams.get('limit') || '20')
      let query = s.from('kc_lead_signals').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query.order('detected_at', { ascending: false }).limit(limit)
      return Response.json({ data: data || [] })
    }

    if (action === 'leaderboard') {
      let query = s.from('kc_agent_stats').select('*').eq('stat_date', new Date().toISOString().split('T')[0])
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query.order('appointments', { ascending: false })
      return Response.json({ data: data || [] })
    }

    if (action === 'analytics_weekly') {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()
      let query = s.from('kc_calls').select('created_at, opted_in, appointment_set')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data: rows } = await query.gte('created_at', fourteenDaysAgo)
      const byDate: Record<string, { total: number; opted_ins: number; appointments: number }> = {}
      for (const r of rows || []) {
        const d = (r.created_at || '').split('T')[0]
        if (!byDate[d]) byDate[d] = { total: 0, opted_ins: 0, appointments: 0 }
        byDate[d].total++
        if (r.opted_in) byDate[d].opted_ins++
        if (r.appointment_set) byDate[d].appointments++
      }
      return Response.json({ data: Object.entries(byDate).sort().map(([date, v]) => ({ date, ...v })) })
    }

    if (action === 'industries') {
      let query = s.from('kc_industry_brains').select('*')
      if (agencyFilter) query = query.eq('agency_id', agencyFilter)
      const { data } = await query.order('industry_name', { ascending: true })
      return Response.json({ data: data || [] })
    }

    if (action === 'all_agencies') {
      if (!access.isSuperAdmin) return Response.json({ error: 'Super admin only' }, { status: 403 })
      const { data } = await s.from('agencies').select('id, name, owner_email, created_at').is('deleted_at', null).order('created_at', { ascending: false })
      const { data: kcAccess } = await s.from('kc_agency_access').select('*')
      const accessMap: Record<string, any> = {}
      for (const a of kcAccess || []) accessMap[a.agency_id] = a
      return Response.json({ data: (data || []).map((a: any) => ({ ...a, kc: accessMap[a.id] || null })) })
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
    const access = await resolveKCAccess(req, new URL(req.url).searchParams)
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

    if (action === 'create_campaign') {
      const { name, industry_id, daily_limit, start_hour, end_hour, ghl_pipeline } = body
      const { data } = await s.from('kc_campaigns').insert({
        agency_id: access.agencyId || '00000000-0000-0000-0000-000000000099',
        name, industry_id: industry_id || null, daily_limit: daily_limit || 150,
        start_hour: start_hour || 9, end_hour: end_hour || 17, ghl_pipeline: ghl_pipeline || null,
        status: 'draft',
      }).select('*').maybeSingle()
      return Response.json({ data })
    }

    if (action === 'toggle_campaign') {
      const agencyId = access.agencyId || '00000000-0000-0000-0000-000000000099'
      const { data } = await s.from('kc_campaigns').update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.id).eq('agency_id', agencyId).select('*').maybeSingle()
      return Response.json({ data })
    }

    if (action === 'build_brain') {
      if (!access.features.brainBuilder) return Response.json({ error: 'Feature not enabled' }, { status: 403 })
      const { industry_name, sic_code, naics_code } = body
      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      let brainData: any = { persona_name: `${industry_name} Specialist`, voice_tone: 'professional', pain_points: [], objections: [], qa_bank: [] }
      if (apiKey) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: `You are configuring an AI cold calling brain for the ${industry_name} industry (SIC: ${sic_code}, NAICS: ${naics_code}). Generate a complete JSON config: {"persona_name":"","voice_tone":"","opening_script":"","optin_bridge":"","callback_bridge":"","pain_points":["5 strings"],"objections":["4 strings"],"qa_bank":[{"stage":"Connect|Discovery|Problem|Consequence|Solution|Close","question":"","coaching_note":""}],"data_signals":["5 strings"]}. Return ONLY valid JSON.` }] }),
            signal: AbortSignal.timeout(15000),
          })
          if (res.ok) {
            const d = await res.json()
            const txt = d.content?.[0]?.text || '{}'
            try { brainData = JSON.parse(txt.replace(/```json|```/g, '').trim()) } catch {}
          }
        } catch {}
      }
      const agencyId = access.agencyId || '00000000-0000-0000-0000-000000000099'
      const { data } = await s.from('kc_industry_brains').upsert({
        agency_id: agencyId, sic_code, naics_code, industry_name, ...brainData, learning_score: 65, built: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'agency_id,sic_code' }).select('*').maybeSingle()
      return Response.json({ data })
    }

    if (action === 'save_brain') {
      const { id, ...updates } = body
      delete updates.action
      const agencyId = access.agencyId || '00000000-0000-0000-0000-000000000099'
      if (id) {
        const { data } = await s.from('kc_industry_brains').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
        return Response.json({ data })
      }
      const { data } = await s.from('kc_industry_brains').insert({ agency_id: agencyId, ...updates }).select('*').maybeSingle()
      return Response.json({ data })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
