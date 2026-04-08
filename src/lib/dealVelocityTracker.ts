// ── Deal Velocity Tracker ────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function initializeDealTracking(leadId: string, agencyId: string, clientId?: string): Promise<string | null> {
  const sb = getSupabase()
  const { data: existing } = await sb.from('koto_deal_velocity').select('id').eq('lead_id', leadId).maybeSingle()
  if (existing) return existing.id

  const { data: lead } = await sb.from('koto_voice_leads').select('prospect_company, industry_sic_code').eq('id', leadId).maybeSingle()

  const { data } = await sb.from('koto_deal_velocity').insert({
    agency_id: agencyId, client_id: clientId || null, lead_id: leadId,
    business_name: lead?.prospect_company || '', industry_sic_code: lead?.industry_sic_code || '',
    first_call_at: new Date().toISOString(), total_calls: 1,
  }).select('id').single()

  return data?.id || null
}

export async function updateDealStage(leadId: string, stage: string, data?: any): Promise<void> {
  const sb = getSupabase()
  const { data: deal } = await sb.from('koto_deal_velocity').select('*').eq('lead_id', leadId).maybeSingle()
  if (!deal) return

  const now = new Date().toISOString()
  const updates: any = { updated_at: now }

  if (stage === 'connected' && !deal.first_connection_at) {
    updates.first_connection_at = now
    if (deal.first_call_at) updates.days_first_call_to_connection = daysBetween(deal.first_call_at, now)
  }
  if (stage === 'appointment' && !deal.first_appointment_at) {
    updates.first_appointment_at = now
    if (deal.first_call_at) updates.days_first_call_to_appointment = daysBetween(deal.first_call_at, now)
  }
  if (stage === 'closed_won') {
    updates.deal_closed_at = now
    if (deal.first_appointment_at) updates.days_appointment_to_close = daysBetween(deal.first_appointment_at, now)
    if (deal.first_call_at) updates.days_total_cycle = daysBetween(deal.first_call_at, now)
    updates.outcome = 'won'
    if (data?.deal_value) updates.deal_value = data.deal_value
    if (data?.winning_line) updates.winning_opening_line = data.winning_line
    if (data?.key_pain_point) updates.key_pain_point = data.key_pain_point
  }
  if (stage === 'closed_lost') {
    updates.deal_lost_at = now
    updates.outcome = 'lost'
    if (data?.lost_reason) updates.lost_reason = data.lost_reason
  }

  updates.total_calls = (deal.total_calls || 0) + (stage === 'connected' ? 0 : 0) // calls tracked separately

  await sb.from('koto_deal_velocity').update(updates).eq('id', deal.id)
}

export async function getDealVelocityInsights(agencyId: string): Promise<any> {
  const sb = getSupabase()
  const { data: deals } = await sb.from('koto_deal_velocity').select('*').eq('agency_id', agencyId).not('outcome', 'is', null).limit(200)

  if (!deals?.length) return { avg_days_to_appointment: 0, avg_days_to_close: 0, avg_total_cycle: 0, avg_touchpoints_to_close: 0, fastest_close_days: 0, slowest_close_days: 0, top_accelerators: [], winning_opening_lines: [] }

  const won = deals.filter(d => d.outcome === 'won')
  const lost = deals.filter(d => d.outcome === 'lost')

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const daysToAppt = won.map(d => d.days_first_call_to_appointment).filter(Boolean)
  const daysToClose = won.map(d => d.days_appointment_to_close).filter(Boolean)
  const totalCycle = won.map(d => d.days_total_cycle).filter(Boolean)

  return {
    avg_days_to_appointment: Math.round(avg(daysToAppt as number[])),
    avg_days_to_close: Math.round(avg(daysToClose as number[])),
    avg_total_cycle: Math.round(avg(totalCycle as number[])),
    avg_touchpoints_to_close: Math.round(avg(won.map(d => d.total_touchpoints || 0))),
    fastest_close_days: totalCycle.length ? Math.min(...totalCycle as number[]) : 0,
    slowest_close_days: totalCycle.length ? Math.max(...totalCycle as number[]) : 0,
    total_won: won.length,
    total_lost: lost.length,
    total_revenue: won.reduce((s, d) => s + (d.deal_value || 0), 0),
    winning_opening_lines: won.map(d => d.winning_opening_line).filter(Boolean).slice(0, 5),
    top_pain_points: won.map(d => d.key_pain_point).filter(Boolean).slice(0, 5),
    lost_reasons: lost.map(d => d.lost_reason).filter(Boolean).slice(0, 5),
  }
}

function daysBetween(d1: string, d2: string): number {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000)
}
