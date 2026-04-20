// Scout voice explorer — master search + edit + delete over the conversation
// brain. Three entity types in one API:
//
//   entity=call        → scout_voice_calls.transcript + post_call_analysis
//   entity=qa          → scout_call_questions (+ scout_voice_calls context)
//   entity=fact        → scout_voice_knowledge
//
// Free-text search runs against transcript / question / answer / fact text
// depending on entity. Sortable on any indexed column. Editable + deletable
// via PATCH / DELETE actions. Fast enough to feed a live-filter UI.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function escapeIlike(q: string) {
  // Escape PostgreSQL ILIKE wildcards in user-supplied search. We still wrap in
  // %...% for fuzzy matching; this just prevents the search term from acting
  // as a wildcard itself.
  return q.replace(/([\\%_])/g, '\\$1')
}

// ═══════════════════════════════════════════════════════════════════
// GET — search/list
// ═══════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agencyId = searchParams.get('agency_id') || ''
  const entity = (searchParams.get('entity') || 'call') as 'call' | 'qa' | 'fact' | 'all'
  const q = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'recent'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  // Extra filters
  const industry = searchParams.get('industry') || ''
  const sicCode = searchParams.get('sic_code') || ''
  const outcome = searchParams.get('outcome') || ''
  const scope = searchParams.get('scope') || ''
  const scopeValue = searchParams.get('scope_value') || ''

  if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

  const s = sb()
  const term = q ? `%${escapeIlike(q)}%` : null

  if (entity === 'call' || entity === 'all') {
    let query = s.from('scout_voice_calls').select(
      'id, company_name, contact_name, industry, sic_code, pitch_angle, biggest_gap, ' +
      'status, outcome, appointment_set, sentiment, duration_seconds, questions_answered, questions_total, ' +
      'started_at, ended_at, created_at, transcript, post_call_analysis, conversation_intelligence, ' +
      'discovery_data, recording_url, opportunity_id'
    ).eq('agency_id', agencyId)

    if (industry) query = query.eq('industry', industry)
    if (sicCode) query = query.eq('sic_code', sicCode)
    if (outcome) query = query.eq('outcome', outcome)
    if (term) {
      // Search across transcript + company + pitch_angle + biggest_gap
      query = query.or(
        `transcript.ilike.${term},company_name.ilike.${term},contact_name.ilike.${term},pitch_angle.ilike.${term},biggest_gap.ilike.${term}`
      )
    }

    // Sort
    if (sort === 'oldest') query = query.order('created_at', { ascending: true })
    else if (sort === 'duration') query = query.order('duration_seconds', { ascending: false, nullsFirst: false })
    else if (sort === 'company') query = query.order('company_name', { ascending: true })
    else if (sort === 'appt') query = query.order('appointment_set', { ascending: false }).order('ended_at', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (entity === 'call') return NextResponse.json({ entity: 'call', data: data || [], count: count ?? (data?.length || 0) })
    // else fall through to qa+fact for 'all'
    if (entity === 'all') {
      // For 'all' we do three queries — keep light
      return NextResponse.json({ entity: 'all', calls: data || [] })
    }
  }

  if (entity === 'qa') {
    let query = s.from('scout_call_questions').select(
      'id, scout_call_id, question_id, question_text, answer_text, answer_sentiment, answered, sequence, timestamp_seconds, created_at'
    ).eq('agency_id', agencyId)

    if (term) {
      query = query.or(`question_text.ilike.${term},answer_text.ilike.${term}`)
    }

    if (sort === 'oldest') query = query.order('created_at', { ascending: true })
    else if (sort === 'question') query = query.order('question_text', { ascending: true })
    else query = query.order('created_at', { ascending: false })

    const { data, error } = await query.range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with call context in one extra query so the UI can show
    // "company X · industry Y" on each Q&A row.
    const callIds = Array.from(new Set((data || []).map((r: any) => r.scout_call_id).filter(Boolean)))
    const callMap: Record<string, any> = {}
    if (callIds.length) {
      const { data: calls } = await s.from('scout_voice_calls')
        .select('id, company_name, industry, sic_code, outcome, appointment_set, ended_at')
        .in('id', callIds as string[])
      for (const c of calls || []) callMap[c.id] = c
    }
    const enriched = (data || []).map((r: any) => ({ ...r, call: callMap[r.scout_call_id] || null }))
    return NextResponse.json({ entity: 'qa', data: enriched, count: enriched.length })
  }

  if (entity === 'fact') {
    let query = s.from('scout_voice_knowledge').select('*')
      .or(`agency_id.is.null,agency_id.eq.${agencyId}`)

    if (scope) query = query.eq('scope', scope)
    if (scopeValue) query = query.eq('scope_value', scopeValue)
    if (term) {
      query = query.or(`fact.ilike.${term},scope_value.ilike.${term},fact_category.ilike.${term}`)
    }

    if (sort === 'oldest') query = query.order('created_at', { ascending: true })
    else if (sort === 'confidence') query = query.order('confidence_score', { ascending: false }).order('times_confirmed', { ascending: false })
    else if (sort === 'confirmed') query = query.order('times_confirmed', { ascending: false })
    else query = query.order('updated_at', { ascending: false })

    const { data, error } = await query.range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entity: 'fact', data: data || [], count: (data || []).length })
  }

  return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })
}

// ═══════════════════════════════════════════════════════════════════
// PATCH — edit
//   body: { entity, id, patch: { ... } }
// ═══════════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { entity, id, patch, agency_id } = body
  if (!entity || !id || !patch) return NextResponse.json({ error: 'entity, id, patch required' }, { status: 400 })
  const s = sb()

  // Whitelist editable fields per entity to prevent privilege escalation.
  const ALLOWED: Record<string, string[]> = {
    call: ['pitch_angle', 'biggest_gap', 'outcome', 'appointment_set', 'sentiment', 'follow_up_at', 'transcript'],
    qa: ['question_text', 'answer_text', 'answer_sentiment', 'answered'],
    fact: ['fact', 'fact_category', 'confidence_score', 'scope', 'scope_value', 'direction'],
  }
  const allowed = ALLOWED[entity]
  if (!allowed) return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })

  const cleanPatch: Record<string, any> = {}
  for (const k of Object.keys(patch)) if (allowed.includes(k)) cleanPatch[k] = patch[k]
  if (Object.keys(cleanPatch).length === 0) return NextResponse.json({ error: 'No valid fields in patch' }, { status: 400 })

  const table = entity === 'call' ? 'scout_voice_calls'
    : entity === 'qa' ? 'scout_call_questions'
    : 'scout_voice_knowledge'

  let q = s.from(table).update(cleanPatch).eq('id', id)
  if (agency_id) q = q.eq('agency_id', agency_id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ═══════════════════════════════════════════════════════════════════
// DELETE — delete or mark irrelevant
//   body or query: { entity, id, mode='soft'|'hard' }
// ═══════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  let entity: string, id: string, mode: string, agencyId: string
  try {
    const body = await req.json().catch(() => null)
    if (body) {
      entity = body.entity; id = body.id; mode = body.mode || 'hard'; agencyId = body.agency_id || ''
    } else {
      const url = new URL(req.url)
      entity = url.searchParams.get('entity') || ''
      id = url.searchParams.get('id') || ''
      mode = url.searchParams.get('mode') || 'hard'
      agencyId = url.searchParams.get('agency_id') || ''
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!entity || !id) return NextResponse.json({ error: 'entity + id required' }, { status: 400 })
  const s = sb()

  if (entity === 'fact') {
    if (mode === 'soft') {
      // "Mark irrelevant" = drop confidence and contradict counter
      const { data: existing } = await s.from('scout_voice_knowledge').select('times_contradicted').eq('id', id).single()
      const { error } = await s.from('scout_voice_knowledge').update({
        confidence_score: 0,
        times_contradicted: (existing?.times_contradicted || 0) + 1,
      }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, mode: 'soft' })
    }
    const { error } = await s.from('scout_voice_knowledge').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, mode: 'hard' })
  }

  if (entity === 'qa') {
    if (mode === 'soft') {
      const { error } = await s.from('scout_call_questions').update({ answered: false, answer_text: null }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, mode: 'soft' })
    }
    const { error } = await s.from('scout_call_questions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, mode: 'hard' })
  }

  if (entity === 'call') {
    if (mode === 'soft') {
      // Clear transcript + intelligence; keep the row for audit
      const { error } = await s.from('scout_voice_calls').update({
        transcript: null, conversation_intelligence: null, post_call_analysis: null,
      }).eq('id', id).eq('agency_id', agencyId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, mode: 'soft' })
    }
    const { error } = await s.from('scout_voice_calls').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, mode: 'hard' })
  }

  return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })
}
