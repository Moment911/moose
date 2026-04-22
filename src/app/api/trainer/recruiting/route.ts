import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/recruiting
//
// Actions: list, search, get, update_program, add_program,
//          add_coach, update_coach, delete_coach,
//          hot_list, add_hot, remove_hot
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function ok(data: unknown) { return NextResponse.json(data) }
function err(status: number, error: string) { return NextResponse.json({ error }, { status }) }

export async function POST(req: NextRequest) {
  const sb = getDb()
  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch { return err(400, 'Invalid JSON') }

  const action = body.action as string
  const sport = (body.sport as string) || 'baseball'

  // ── List programs with optional filters ──────────────────────────────────
  if (action === 'list' || action === 'search') {
    let q = sb.from('koto_recruiting_programs').select('*, koto_recruiting_coaches(*)').eq('sport', sport).order('school_name')

    if (body.division && typeof body.division === 'string') q = q.eq('division', body.division)
    if (body.conference && typeof body.conference === 'string') q = q.eq('conference', body.conference)
    if (body.state && typeof body.state === 'string') q = q.eq('state', body.state)
    if (body.query && typeof body.query === 'string') {
      q = q.ilike('school_name', `%${body.query}%`)
    }

    const limit = typeof body.limit === 'number' ? Math.min(body.limit, 500) : 100
    const offset = typeof body.offset === 'number' ? body.offset : 0
    q = q.range(offset, offset + limit - 1)

    const { data, error: qErr } = await q
    if (qErr) return err(500, qErr.message)
    return ok({ programs: data || [] })
  }

  // ── Get single program with coaches ──────────────────────────────────────
  if (action === 'get') {
    const id = body.program_id as string
    if (!id) return err(400, 'program_id required')
    const { data, error: qErr } = await sb
      .from('koto_recruiting_programs')
      .select('*, koto_recruiting_coaches(*)')
      .eq('id', id)
      .single()
    if (qErr || !data) return err(404, 'Program not found')
    return ok({ program: data })
  }

  // ── Update program ───────────────────────────────────────────────────────
  if (action === 'update_program') {
    const id = body.program_id as string
    if (!id) return err(400, 'program_id required')
    const allowed = ['school_name', 'team_name', 'division', 'conference', 'state', 'city', 'address', 'website', 'logo_url', 'enrollment', 'tuition_in_state', 'tuition_out_of_state', 'scholarship_available', 'notes']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in body) update[k] = body[k]
    }
    const { error: uErr } = await sb.from('koto_recruiting_programs').update(update).eq('id', id)
    if (uErr) return err(500, uErr.message)
    return ok({ success: true })
  }

  // ── Add program ──────────────────────────────────────────────────────────
  if (action === 'add_program') {
    const schoolName = body.school_name as string
    if (!schoolName) return err(400, 'school_name required')
    const row = {
      sport,
      school_name: schoolName,
      team_name: (body.team_name as string) || null,
      division: (body.division as string) || 'D1',
      conference: (body.conference as string) || null,
      state: (body.state as string) || null,
      city: (body.city as string) || null,
      website: (body.website as string) || null,
    }
    const { data, error: iErr } = await sb.from('koto_recruiting_programs').insert(row).select('id').single()
    if (iErr) return err(500, iErr.message)
    return ok({ program_id: (data as { id: string }).id })
  }

  // ── Coach CRUD ───────────────────────────────────────────────────────────
  if (action === 'add_coach') {
    const programId = body.program_id as string
    const fullName = body.full_name as string
    if (!programId || !fullName) return err(400, 'program_id and full_name required')
    const row = {
      program_id: programId,
      full_name: fullName,
      title: (body.title as string) || null,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      twitter: (body.twitter as string) || null,
      instagram: (body.instagram as string) || null,
      notes: (body.notes as string) || null,
    }
    const { data, error: iErr } = await sb.from('koto_recruiting_coaches').insert(row).select('id').single()
    if (iErr) return err(500, iErr.message)
    return ok({ coach_id: (data as { id: string }).id })
  }

  if (action === 'update_coach') {
    const id = body.coach_id as string
    if (!id) return err(400, 'coach_id required')
    const allowed = ['full_name', 'title', 'email', 'phone', 'twitter', 'instagram', 'notes', 'verified_at']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in body) update[k] = body[k]
    }
    const { error: uErr } = await sb.from('koto_recruiting_coaches').update(update).eq('id', id)
    if (uErr) return err(500, uErr.message)
    return ok({ success: true })
  }

  if (action === 'delete_coach') {
    const id = body.coach_id as string
    if (!id) return err(400, 'coach_id required')
    const { error: dErr } = await sb.from('koto_recruiting_coaches').delete().eq('id', id)
    if (dErr) return err(500, dErr.message)
    return ok({ success: true })
  }

  // ── Hot list ─────────────────────────────────────────────────────────────
  if (action === 'hot_list') {
    const traineeId = body.trainee_id as string
    if (!traineeId) return err(400, 'trainee_id required')
    const { data, error: qErr } = await sb
      .from('koto_recruiting_hot_list')
      .select('*, koto_recruiting_programs(id, school_name, division, conference, state)')
      .eq('trainee_id', traineeId)
      .order('created_at', { ascending: false })
    if (qErr) return err(500, qErr.message)
    return ok({ hot_list: data || [] })
  }

  if (action === 'add_hot') {
    const traineeId = body.trainee_id as string
    const programId = body.program_id as string
    if (!traineeId || !programId) return err(400, 'trainee_id and program_id required')
    const { error: iErr } = await sb.from('koto_recruiting_hot_list').upsert({
      trainee_id: traineeId,
      program_id: programId,
      interest_level: (body.interest_level as string) || 'interested',
      notes: (body.notes as string) || null,
    }, { onConflict: 'trainee_id,program_id' })
    if (iErr) return err(500, iErr.message)
    return ok({ success: true })
  }

  if (action === 'remove_hot') {
    const traineeId = body.trainee_id as string
    const programId = body.program_id as string
    if (!traineeId || !programId) return err(400, 'trainee_id and program_id required')
    const { error: dErr } = await sb.from('koto_recruiting_hot_list').delete().eq('trainee_id', traineeId).eq('program_id', programId)
    if (dErr) return err(500, dErr.message)
    return ok({ success: true })
  }

  // ── Get distinct filter options ──────────────────────────────────────────
  if (action === 'filters') {
    const [divisions, conferences, states] = await Promise.all([
      sb.from('koto_recruiting_programs').select('division').eq('sport', sport).order('division'),
      sb.from('koto_recruiting_programs').select('conference').eq('sport', sport).order('conference'),
      sb.from('koto_recruiting_programs').select('state').eq('sport', sport).order('state'),
    ])
    const unique = (arr: unknown[], key: string) => [...new Set((arr || []).map((r) => (r as Record<string, unknown>)[key]).filter(Boolean))]
    return ok({
      divisions: unique(divisions.data || [], 'division'),
      conferences: unique(conferences.data || [], 'conference'),
      states: unique(states.data || [], 'state'),
    })
  }

  return err(400, `Unknown action: ${action}`)
}
