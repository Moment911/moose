import 'server-only' // fails the build if this module is ever imported from a client component
// ── Predictive Dialing Engine ─────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export async function getBestCallTime(sicCode: string, state?: string): Promise<{
  best_day: string; best_hour: number; best_window: string; connection_rate: number; appointment_rate: number; confidence: string; heatmap: any[]
}> {
  const sb = getSupabase()
  let query = sb.from('koto_call_timing_intelligence').select('*').eq('industry_sic_code', sicCode)
  if (state) query = query.eq('state', state)
  const { data } = await query.order('appointment_rate', { ascending: false })

  if (!data?.length) return { best_day: 'Tuesday', best_hour: 10, best_window: 'Tuesday 10-11am', connection_rate: 0.40, appointment_rate: 0.18, confidence: 'low', heatmap: [] }

  const best = data[0]
  return {
    best_day: DAYS[best.day_of_week] || 'Tuesday',
    best_hour: best.hour_of_day,
    best_window: `${DAYS[best.day_of_week]} ${best.hour_of_day > 12 ? best.hour_of_day - 12 : best.hour_of_day}${best.hour_of_day >= 12 ? 'pm' : 'am'}`,
    connection_rate: best.connection_rate || 0,
    appointment_rate: best.appointment_rate || 0,
    confidence: best.confidence_level || 'low',
    heatmap: data,
  }
}

export async function updateTimingIntelligence(sicCode: string, state: string | null, dayOfWeek: number, hour: number, connected: boolean, appointmentSet: boolean, duration: number): Promise<void> {
  const sb = getSupabase()
  const { data: existing } = await sb.from('koto_call_timing_intelligence')
    .select('*')
    .eq('industry_sic_code', sicCode)
    .is('state', state || null)
    .eq('day_of_week', dayOfWeek)
    .eq('hour_of_day', hour)
    .maybeSingle()

  if (existing) {
    const total = (existing.total_calls || 0) + 1
    const conn = (existing.total_connected || 0) + (connected ? 1 : 0)
    const appts = (existing.total_appointments || 0) + (appointmentSet ? 1 : 0)
    await sb.from('koto_call_timing_intelligence').update({
      total_calls: total, total_connected: conn, total_appointments: appts,
      connection_rate: total > 0 ? conn / total : 0,
      appointment_rate: total > 0 ? appts / total : 0,
      avg_call_duration: ((existing.avg_call_duration || 0) * (total - 1) + duration) / total,
      confidence_level: total >= 50 ? 'high' : total >= 20 ? 'medium' : 'low',
      last_updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await sb.from('koto_call_timing_intelligence').insert({
      industry_sic_code: sicCode, state: state || null, day_of_week: dayOfWeek, hour_of_day: hour,
      total_calls: 1, total_connected: connected ? 1 : 0, total_appointments: appointmentSet ? 1 : 0,
      connection_rate: connected ? 1 : 0, appointment_rate: appointmentSet ? 1 : 0,
      avg_call_duration: duration, confidence_level: 'low',
    })
  }
}

export function generateCallHeatmap(timingData: any[]): number[][] {
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const t of timingData) {
    heatmap[t.day_of_week][t.hour_of_day] = Math.round((t.appointment_rate || 0) * 100)
  }
  return heatmap
}
