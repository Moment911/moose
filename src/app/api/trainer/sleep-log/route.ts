import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/sleep-log — Phase C sleep tracker
//
// Token-based (trainee_id is the token — same auth model as food-log).
// Actions:
//   upsert       — { trainee_id, sleep_date, hours_slept, quality_1_10?,
//                    bed_time?, wake_time?, notes? }
//                  UNIQUE(trainee_id, sleep_date) so re-submits update in place.
//   list_range   — { trainee_id, from, to } -> rows for a week/month chart.
//   latest       — { trainee_id } -> most recent single row + 14-day trailing.
//   delete       — { trainee_id, sleep_date }.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 30

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function n(v: unknown): number | null {
  if (v == null) return null
  const x = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(x) ? x : null
}

export async function POST(req: NextRequest) {
  const sb = getDb()
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return err(400, 'trainee_id required')

  const { data: trainee } = await sb
    .from('koto_fitness_trainees')
    .select('id, agency_id')
    .eq('id', traineeId)
    .maybeSingle()
  if (!trainee) return err(404, 'Trainee not found')
  const agencyId = (trainee as { agency_id: string }).agency_id

  if (action === 'upsert') {
    const sleepDate = typeof body.sleep_date === 'string' ? body.sleep_date : new Date().toISOString().slice(0, 10)
    const hours = n(body.hours_slept)
    if (hours == null || hours < 0 || hours > 24) return err(400, 'hours_slept (0-24) required')
    const quality = n(body.quality_1_10)
    const row = {
      agency_id: agencyId,
      trainee_id: traineeId,
      sleep_date: sleepDate,
      hours_slept: hours,
      quality_1_10: quality != null && quality >= 1 && quality <= 10 ? Math.round(quality) : null,
      bed_time: typeof body.bed_time === 'string' && body.bed_time.length > 0 ? body.bed_time : null,
      wake_time: typeof body.wake_time === 'string' && body.wake_time.length > 0 ? body.wake_time : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    }
    const { data, error } = await sb
      .from('koto_fitness_sleep_logs')
      .upsert(row, { onConflict: 'trainee_id,sleep_date' })
      .select('id, sleep_date, hours_slept, quality_1_10, bed_time, wake_time, notes')
      .single()
    if (error) {
      console.error('[sleep-log] upsert failed:', error.message)
      return err(500, 'Upsert failed')
    }
    return NextResponse.json({ log: data })
  }

  if (action === 'list_range') {
    const from = typeof body.from === 'string' ? body.from : ''
    const to = typeof body.to === 'string' ? body.to : ''
    if (!from || !to) return err(400, 'from and to dates required')
    const { data } = await sb
      .from('koto_fitness_sleep_logs')
      .select('sleep_date, hours_slept, quality_1_10, bed_time, wake_time, notes')
      .eq('trainee_id', traineeId)
      .eq('agency_id', agencyId)
      .gte('sleep_date', from)
      .lte('sleep_date', to)
      .order('sleep_date', { ascending: true })
    return NextResponse.json({ logs: data || [] })
  }

  if (action === 'latest') {
    const fromDate = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10)
    const toDate = new Date().toISOString().slice(0, 10)
    const { data } = await sb
      .from('koto_fitness_sleep_logs')
      .select('sleep_date, hours_slept, quality_1_10, bed_time, wake_time, notes')
      .eq('trainee_id', traineeId)
      .eq('agency_id', agencyId)
      .gte('sleep_date', fromDate)
      .lte('sleep_date', toDate)
      .order('sleep_date', { ascending: false })
    const logs = data || []
    return NextResponse.json({ logs, latest: logs[0] || null })
  }

  if (action === 'delete') {
    const sleepDate = typeof body.sleep_date === 'string' ? body.sleep_date : ''
    if (!sleepDate) return err(400, 'sleep_date required')
    const { error } = await sb
      .from('koto_fitness_sleep_logs')
      .delete()
      .eq('trainee_id', traineeId)
      .eq('agency_id', agencyId)
      .eq('sleep_date', sleepDate)
    if (error) return err(500, 'Delete failed')
    return NextResponse.json({ ok: true })
  }

  return err(400, 'Unknown action')
}
