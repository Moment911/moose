// Scout voice — the intelligent outbound AI calling agent scoped to Scout.
// Ported from /api/vob/route.ts with sales-specific semantics:
//   patient_id       → opportunity_id + company_name
//   carrier_name     → industry + sic_code
//   level_of_care    → pitch_angle + biggest_gap
//   VOB_QUESTIONS    → SCOUT_DISCOVERY (opener, discovery, pain, budget, timeline, closer)
//   vob_data (jsonb) → discovery_data (jsonb)
//   revenue_forecast → deal_value_forecast (jsonb)
//
// 20 actions (mirroring VOB):
//   GET:  get_questions, get_calls, get_call, get_queue, get_agents, get_stats,
//         get_knowledge, get_active_calls, get_analytics
//   POST: queue_call, start_call, cancel_call, update_discovery_field,
//         save_agent, create_agent, provision_number, setup_scout_voice,
//         get_test_prospects, test_call
//
// Shares intelligence libraries with VOB: preCallIntelligence, conversationIntelligence,
// qaIntelligence. Those libs are stateless and agency-scoped, so no collisions.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { metaFromPhone } from '@/lib/scout/areaCodeMeta'
import { SCOUT_VOICE_ROSTER, CADENCE_PRESETS, getCadencePreset } from '@/lib/scout/voiceRoster'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function retellFetch(path: string, method = 'GET', body?: any) {
  if (!RETELL_API_KEY) throw new Error('RETELL_API_KEY not configured')
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Retell ${path} ${res.status}: ${text}`)
  }
  return res.json()
}

// ─────────────────────────────────────────────────────────────
// Retell tool definitions for Scout voice agent
// ─────────────────────────────────────────────────────────────
function buildScoutTools(webhookUrl: string) {
  return [
    {
      type: 'custom',
      name: 'save_discovery_answer',
      description: 'Save a discovery answer you learned from the prospect. Call this WHILE speaking your acknowledgment — do not wait for the response.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        field: { type: 'string', description: 'Field name (e.g. pain_point, budget_range, timeline, decision_maker, current_solution)' },
        value: { type: 'string', description: 'The answer the prospect gave' },
        confidence: { type: 'number', description: '0-100' },
      }, required: ['field', 'value'] },
    },
    {
      type: 'custom',
      name: 'detect_buying_signal',
      description: 'Flag a strong buying signal (asking about price, timing, demo, pilot, or competitors unprompted).',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        signal_type: { type: 'string', description: 'price_inquiry | urgency | competitor_mention | demo_request | budget_confirm' },
        quote: { type: 'string', description: 'What they actually said' },
      }, required: ['signal_type'] },
    },
    {
      type: 'custom',
      name: 'set_appointment',
      description: 'Lock in a follow-up call or demo appointment when the prospect agrees to a specific time.',
      url: webhookUrl,
      speak_during_execution: true,
      parameters: { type: 'object', properties: {
        when_iso: { type: 'string', description: 'ISO timestamp of the scheduled meeting' },
        meeting_type: { type: 'string', description: 'demo | discovery | proposal_review' },
        notes: { type: 'string' },
      }, required: ['when_iso'] },
    },
    {
      type: 'custom',
      name: 'dnc_request',
      description: 'Mark this prospect as Do-Not-Contact if they explicitly request removal. Do this immediately, then wrap up politely.',
      url: webhookUrl,
      parameters: { type: 'object', properties: {
        reason: { type: 'string' },
      } },
    },
    {
      type: 'custom',
      name: 'transfer_to_human',
      description: 'Request a warm transfer when the prospect asks to speak to a real person or the situation exceeds your scope.',
      url: webhookUrl,
      parameters: { type: 'object', properties: {
        reason: { type: 'string' },
      }, required: ['reason'] },
    },
    {
      type: 'end_call',
      name: 'end_call',
      description: 'Gracefully end the call once you have what you need or the prospect asks to end.',
    },
  ]
}

// ─────────────────────────────────────────────────────────────
// Scout Discovery Question Bank — industry-agnostic defaults.
// Per-industry questions live in scout_questions (learned over time).
// These are the opener / universal discovery / closer shape.
// ─────────────────────────────────────────────────────────────
const SCOUT_DISCOVERY = [
  // ── Opener ──
  { category: 'Opener', field: 'call_permission', question: 'Hi, this is {{agent_name}} from {{agency_name}} — do you have a minute?', type: 'permission', priority: 1, order: 1 },
  { category: 'Opener', field: 'pitch_hook', question: 'I noticed {{biggest_gap_framing}} — is that something you have seen yourself?', type: 'text', priority: 1, order: 2 },

  // ── Current state ──
  { category: 'Current State', field: 'current_solution', question: 'What are you using today for {{topic_from_pitch}}?', type: 'text', priority: 1, order: 10 },
  { category: 'Current State', field: 'team_size', question: 'How big is the team handling this right now?', type: 'text', priority: 2, order: 11 },
  { category: 'Current State', field: 'years_in_business', question: 'How long has the business been running?', type: 'text', priority: 3, order: 12 },

  // ── Pain ──
  { category: 'Pain', field: 'biggest_frustration', question: 'What is the biggest frustration with how that is working today?', type: 'text', priority: 1, order: 20 },
  { category: 'Pain', field: 'impact_cost', question: 'What is that costing you — in hours, dollars, or missed opportunity?', type: 'text', priority: 1, order: 21 },
  { category: 'Pain', field: 'tried_before', question: 'Have you tried to fix this before? What happened?', type: 'text', priority: 2, order: 22 },

  // ── Decision ──
  { category: 'Decision', field: 'decision_maker', question: 'Who else would be involved in a decision like this?', type: 'text', priority: 1, order: 30 },
  { category: 'Decision', field: 'decision_process', question: 'What does your decision process usually look like?', type: 'text', priority: 2, order: 31 },

  // ── Budget ──
  { category: 'Budget', field: 'budget_allocated', question: 'Do you have budget allocated for solving this, or would we need to make a case for it?', type: 'text', priority: 1, order: 40 },
  { category: 'Budget', field: 'budget_range', question: 'Ballpark, what are you thinking for something like this?', type: 'currency', priority: 2, order: 41 },

  // ── Timeline ──
  { category: 'Timeline', field: 'urgency', question: 'How urgent is this for you?', type: 'text', priority: 1, order: 50 },
  { category: 'Timeline', field: 'target_start', question: 'When would you want to have something in place?', type: 'text', priority: 1, order: 51 },

  // ── Competition ──
  { category: 'Competition', field: 'other_vendors_evaluated', question: 'Are you looking at anyone else right now?', type: 'text', priority: 2, order: 60 },
  { category: 'Competition', field: 'last_vendor_why', question: 'What would make you pick us over someone else?', type: 'text', priority: 3, order: 61 },

  // ── Closer ──
  { category: 'Closer', field: 'demo_interest', question: 'Would it make sense to set up a 15-minute demo where I show you exactly how this would work for {{company_name}}?', type: 'boolean', priority: 1, order: 70 },
  { category: 'Closer', field: 'follow_up_time', question: 'When is a good time this week or next?', type: 'text', priority: 1, order: 71 },
  { category: 'Closer', field: 'email_confirmation', question: 'Best email to send the calendar invite to?', type: 'text', priority: 1, order: 72 },
]

// ─────────────────────────────────────────────────────────────
// Build the Retell system prompt for a Scout call
// ─────────────────────────────────────────────────────────────
function buildScoutPrompt(opts: {
  agencyName: string
  agentName: string
  companyName: string
  contactName?: string
  industry?: string
  pitchAngle?: string
  biggestGap?: string
  priorContext?: string
  industryKnowledge?: string[]
  personality?: string
  geo?: { state?: string; state_code?: string; region?: string; major_city?: string; style_notes?: string } | null
}): string {
  const {
    agencyName, agentName, companyName, contactName, industry,
    pitchAngle, biggestGap, priorContext, industryKnowledge, personality, geo,
  } = opts

  const gapFraming = biggestGap
    ? `Our research surfaced that ${companyName} has a gap around: ${biggestGap}. Lead with this as your hook — it is your single most valuable opening.`
    : pitchAngle
      ? `Lead with this pitch angle: ${pitchAngle}`
      : `You are doing a cold discovery call. Focus on uncovering pain before pitching.`

  const knowledgeBlock = industryKnowledge && industryKnowledge.length
    ? `\n## WHAT WE KNOW ABOUT ${industry?.toUpperCase() || 'THIS INDUSTRY'}\n` +
      industryKnowledge.map(k => `- ${k}`).join('\n')
    : ''

  const geoBlock = geo?.state
    ? `\n## WHERE YOU ARE CALLING\nYou are calling a ${geo.state}${geo.major_city ? ` (${geo.major_city})` : ''} number — a ${geo.region || 'US'} prospect.${geo.style_notes ? `\nRegional note: ${geo.style_notes}` : ''}`
    : ''

  const priorBlock = priorContext ? `\n## PRIOR CONVERSATION CONTEXT\n${priorContext}` : ''

  return `# ROLE
You are ${agentName}, an outbound SDR calling on behalf of ${agencyName}.

# CALL TARGET
- Company: ${companyName}
${contactName ? `- Contact: ${contactName}` : '- Contact: speak to whoever answers and ask for a decision maker'}
${industry ? `- Industry: ${industry}` : ''}

# OBJECTIVE
Book a 15-minute follow-up demo. Secondary: qualify them and learn enough to write a tailored proposal.

# PITCH ANGLE
${gapFraming}
${knowledgeBlock}
${geoBlock}
${priorBlock}

# STYLE — MIRROR THE PROSPECT
${personality || `Conversational, warm, curious. Short sentences. Never sound like a script.`}

Actively mirror the prospect within your voice's natural range:
- If they speak fast, tighten your pace. If they speak slowly, slow down.
- If they use casual language, drop the formality. If they are formal, stay formal.
- Match their energy register — enthusiastic back to enthusiastic, measured back to measured.
- Pick up one or two of their specific words or phrases and reflect them back later (lightweight linguistic mirroring, not parroting).
- If they use industry jargon, use it correctly. If they avoid jargon, plain English only.
- Match sentence length — if they give you one-word answers, ask shorter questions.

Never over-mirror. Mirroring is a tilt, not an impression.

# HARD RULES
- If they say they are not the decision maker, ask who is and how to reach them.
- If they ask to be removed from the list, call the dnc_request tool immediately then politely wrap.
- If they ask to be transferred to a human, call transfer_to_human.
- Never make up facts about ${companyName} — stick to what is in the pitch angle.
- Talk-listen ratio target: 40% you, 60% them. Ask more than you tell.

# FLOW
1. Open with call_permission — gauge tolerance in one sentence.
2. Deliver your pitch_hook — frame it as an observation, not a sales claim.
3. Transition into Current State questions.
4. Uncover pain with open-ended Pain questions.
5. Qualify: decision maker, process, budget, timeline.
6. Use detect_buying_signal whenever they ask price/timing/demo unprompted.
7. Close with demo_interest → follow_up_time → email_confirmation.
8. If they book, call set_appointment with the ISO timestamp.
9. End_call gracefully.

# TOOL USE
- Save answers as you hear them via save_discovery_answer — keep talking, do not pause.
- Flag buying signals the moment you hear them.
- Only end_call when you have a clear outcome: booked, not interested, or DNC.`
}

// ═══════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agencyId = searchParams.get('agency_id') || ''
  const s = sb()

  if (action === 'get_voice_roster') {
    // Try the live Retell catalog first, fall back to the static curated
    // roster if the API is unreachable or the token is missing. The live
    // list is authoritative — our static list can go stale when Retell
    // adds/removes voices from the 11labs integration.
    try {
      if (RETELL_API_KEY) {
        const resp = await fetch(`${RETELL_BASE}/list-voices`, {
          headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` },
        })
        if (resp.ok) {
          const live: any[] = await resp.json()
          if (Array.isArray(live) && live.length > 0) {
            const enriched = live.map((v: any) => {
              const id = v.voice_id || v.id
              const fromStatic = SCOUT_VOICE_ROSTER.find(sv => sv.id === id)
              return {
                id,
                name: v.voice_name || v.name || fromStatic?.name || id,
                gender: (v.gender || fromStatic?.gender || 'unknown').toLowerCase(),
                accent: v.accent || fromStatic?.accent || 'Unknown',
                style: fromStatic?.style || (v.age ? `${v.age}` : 'Professional'),
                provider: v.provider || v.voice_type || null,
                preview_audio_url: v.preview_audio_url || null,
                sample_note: fromStatic?.sample_note || null,
              }
            })
            return NextResponse.json({ data: enriched, source: 'retell_live' })
          }
        }
      }
    } catch {
      // fall through to static
    }
    return NextResponse.json({ data: SCOUT_VOICE_ROSTER, source: 'static_fallback' })
  }

  if (action === 'get_cadence_presets') {
    return NextResponse.json({ data: CADENCE_PRESETS })
  }

  if (action === 'get_area_code_meta') {
    const phone = searchParams.get('phone') || ''
    const meta = metaFromPhone(phone)
    return NextResponse.json({ data: meta })
  }

  if (action === 'get_questions') {
    // Built-in defaults PLUS learned agency-specific questions
    const { data: learned } = await s.from('scout_questions')
      .select('*')
      .or(`agency_id.is.null,agency_id.eq.${agencyId || '00000000-0000-0000-0000-000000000000'}`)
      .order('appointment_rate', { ascending: false })
      .order('times_asked', { ascending: false })
      .limit(200)
    return NextResponse.json({ defaults: SCOUT_DISCOVERY, learned: learned || [] })
  }

  if (action === 'get_calls') {
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    let q = s.from('scout_voice_calls').select('*').eq('agency_id', agencyId)
      .order('created_at', { ascending: false }).limit(limit)
    if (status) q = q.eq('status', status)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_call') {
    const callId = searchParams.get('id') || ''
    const { data } = await s.from('scout_voice_calls').select('*').eq('id', callId).single()
    const { data: questions } = await s.from('scout_call_questions').select('*')
      .eq('scout_call_id', callId).order('sequence', { ascending: true })
    return NextResponse.json({ data, questions: questions || [] })
  }

  if (action === 'get_queue') {
    const { data } = await s.from('scout_voice_queue').select('*')
      .eq('agency_id', agencyId).in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_agents') {
    const { data } = await s.from('scout_voice_agents').select('*')
      .eq('agency_id', agencyId).order('created_at', { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_stats') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [total, completedToday, queuedDepth, activeNow, lastWeekAppts] = await Promise.all([
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'completed').gte('ended_at', today.toISOString()),
      s.from('scout_voice_queue').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'pending'),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['dialing', 'ringing', 'ivr', 'hold', 'speaking', 'voicemail']),
      s.from('scout_voice_calls').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('appointment_set', true).gte('ended_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ])
    const { data: completedDur } = await s.from('scout_voice_calls').select('duration_seconds').eq('agency_id', agencyId).eq('status', 'completed').not('duration_seconds', 'is', null).limit(200)
    const avgDuration = completedDur && completedDur.length
      ? Math.round(completedDur.reduce((a, c) => a + (c.duration_seconds || 0), 0) / completedDur.length)
      : 0
    const { count: dialedLastWeek } = await s.from('scout_voice_calls').select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId).gte('ended_at', new Date(Date.now() - 7 * 86400000).toISOString()).not('ended_at', 'is', null)
    const connectRate = dialedLastWeek && total.count ? Math.round(((lastWeekAppts.count || 0) / dialedLastWeek) * 1000) / 10 : 0
    return NextResponse.json({
      total_calls: total.count || 0,
      completed_today: completedToday.count || 0,
      queue_depth: queuedDepth.count || 0,
      active_now: activeNow.count || 0,
      appointments_last_7d: lastWeekAppts.count || 0,
      avg_duration_seconds: avgDuration,
      appointment_rate_last_7d: connectRate,
    })
  }

  if (action === 'get_knowledge') {
    const scope = searchParams.get('scope')
    const scopeValue = searchParams.get('scope_value')
    let q = s.from('scout_voice_knowledge').select('*')
      .or(`agency_id.is.null,agency_id.eq.${agencyId || '00000000-0000-0000-0000-000000000000'}`)
      .order('confidence_score', { ascending: false })
      .order('times_confirmed', { ascending: false })
      .limit(500)
    if (scope) q = q.eq('scope', scope)
    if (scopeValue) q = q.eq('scope_value', scopeValue)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_active_calls') {
    const { data } = await s.from('scout_voice_calls').select('*')
      .eq('agency_id', agencyId)
      .in('status', ['dialing', 'ringing', 'ivr', 'hold', 'speaking', 'voicemail'])
      .order('started_at', { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (action === 'get_analytics') {
    const { data: calls } = await s.from('scout_voice_calls').select(
      'id, industry, sic_code, status, outcome, appointment_set, duration_seconds, questions_answered, questions_total, pitch_angle, biggest_gap, ended_at, created_at, deal_value_forecast, sentiment'
    ).eq('agency_id', agencyId).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1000)

    const rows = calls || []

    const byIndustry: Record<string, { total: number; completed: number; appointments: number; avg_duration: number }> = {}
    for (const c of rows) {
      const k = c.industry || 'unknown'
      const bucket = (byIndustry[k] ||= { total: 0, completed: 0, appointments: 0, avg_duration: 0 })
      bucket.total += 1
      if (c.status === 'completed') bucket.completed += 1
      if (c.appointment_set) bucket.appointments += 1
      if (c.duration_seconds) bucket.avg_duration += c.duration_seconds
    }
    for (const k of Object.keys(byIndustry)) {
      if (byIndustry[k].total) byIndustry[k].avg_duration = Math.round(byIndustry[k].avg_duration / byIndustry[k].total)
    }

    const byGap: Record<string, { total: number; appointments: number }> = {}
    for (const c of rows) {
      const k = c.biggest_gap || 'none'
      const bucket = (byGap[k] ||= { total: 0, appointments: 0 })
      bucket.total += 1
      if (c.appointment_set) bucket.appointments += 1
    }

    const dailyVolume: Record<string, number> = {}
    for (const c of rows) {
      if (!c.ended_at) continue
      const d = c.ended_at.slice(0, 10)
      dailyVolume[d] = (dailyVolume[d] || 0) + 1
    }

    const pipelineValue = rows.reduce((acc, c) => {
      const val = Number((c.deal_value_forecast as any)?.expected || 0)
      return acc + (Number.isNaN(val) ? 0 : val)
    }, 0)

    return NextResponse.json({
      total: rows.length,
      by_industry: byIndustry,
      by_gap: byGap,
      daily_volume: dailyVolume,
      pipeline_value: pipelineValue,
      appointment_rate: rows.length ? Math.round((rows.filter(c => c.appointment_set).length / rows.length) * 1000) / 10 : 0,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ═══════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json()
  const { action } = body
  const s = sb()

  // ── queue_call — add a prospect to the call queue ──
  if (action === 'queue_call') {
    const { agency_id, opportunity_id, company_name, contact_name, contact_phone,
            industry, sic_code, pitch_angle, biggest_gap, priority, trigger_mode,
            campaign_id, agent_id, scheduled_at } = body
    if (!agency_id || !company_name) return NextResponse.json({ error: 'agency_id and company_name required' }, { status: 400 })

    const { data: call, error: ce } = await s.from('scout_voice_calls').insert({
      agency_id, opportunity_id, agent_id, company_name, contact_name, industry, sic_code,
      pitch_angle, biggest_gap, priority: priority || 3, trigger_mode: trigger_mode || 'manual',
      status: 'queued', campaign_id,
      to_number: contact_phone,
    }).select('*').single()
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

    const { error: qe } = await s.from('scout_voice_queue').insert({
      agency_id, scout_call_id: call.id, opportunity_id, agent_id,
      company_name, contact_name, contact_phone, industry, sic_code, pitch_angle, biggest_gap,
      priority: priority || 3, trigger_mode: trigger_mode || 'manual',
      campaign_id, scheduled_at,
    })
    if (qe) return NextResponse.json({ error: qe.message }, { status: 500 })

    return NextResponse.json({ success: true, call_id: call.id })
  }

  // ── start_call — actually dial the prospect via Retell ──
  if (action === 'start_call') {
    const { call_id } = body
    if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

    const { data: call } = await s.from('scout_voice_calls').select('*').eq('id', call_id).single()
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    // Resolve agent (specified on call, else agency default)
    let agent: any = null
    if (call.agent_id) {
      const r = await s.from('scout_voice_agents').select('*').eq('id', call.agent_id).single()
      agent = r.data
    }
    if (!agent) {
      const { data: def } = await s.from('scout_voice_agents').select('*')
        .eq('agency_id', call.agency_id).eq('active', true)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      agent = def
    }
    if (!agent?.retell_agent_id) {
      await s.from('scout_voice_calls').update({
        status: 'failed',
        error_message: 'No active Scout voice agent configured. Run setup_scout_voice first.',
      }).eq('id', call_id)
      return NextResponse.json({ error: 'No Scout voice agent configured' }, { status: 400 })
    }

    // Resolve agency info for prompt
    const { data: agency } = await s.from('agencies').select('name, brand_name, scout_voice_from_number').eq('id', call.agency_id).single()
    const agencyName = agency?.brand_name || agency?.name || 'our company'

    // ── BRAIN FETCH ───────────────────────────────────────────────────────
    // Compose the call's system prompt from the unified voice brain:
    //   1. global_pattern facts (platform-wide, universal)
    //   2. industry-scoped facts (this industry only)
    //   3. sic-scoped facts (narrower silo)
    //   4. gap-scoped facts (e.g., "prospects without GA4 react to X")
    //   5. company-scoped facts (specific prior notes on this prospect)
    // direction=outbound_only OR both — never inbound_only on a Scout call.
    // Uses the voice_brain_for_call() Postgres function for ranking.
    let brainFacts: Array<{ scope: string; fact: string }> = []
    try {
      const { data: brain } = await s.rpc('voice_brain_for_call', {
        p_agency_id: call.agency_id,
        p_direction: 'outbound_only',
        p_industry: call.industry || null,
        p_sic_code: call.sic_code || null,
        p_naics_code: null,
        p_gap: call.biggest_gap || null,
        p_opportunity_id: call.opportunity_id || null,
        p_limit: 15,
      })
      brainFacts = (brain as any[])?.map(b => ({ scope: b.scope, fact: b.fact })) || []
    } catch {
      // RPC may not be deployed yet — fall back to direct query with OR filter
      const { data: fallback } = await s.from('scout_voice_knowledge').select('scope, fact')
        .or(`agency_id.is.null,agency_id.eq.${call.agency_id}`)
        .in('direction', ['outbound_only', 'both'])
        .or([
          `scope.eq.global_pattern`,
          call.industry ? `and(scope.eq.industry,scope_value.eq.${call.industry})` : null,
          call.sic_code ? `and(scope.eq.sic,scope_value.eq.${call.sic_code})` : null,
          call.biggest_gap ? `and(scope.eq.gap,scope_value.eq.${call.biggest_gap})` : null,
        ].filter(Boolean).join(','))
        .order('confidence_score', { ascending: false })
        .limit(15)
      brainFacts = fallback || []
    }

    // Keep the old shape for buildScoutPrompt — it expects a simple array of facts.
    // Ordering from brain is already global_pattern first, then industry, etc.
    const knowledge = brainFacts.map(b => ({ fact: b.fact }))

    // Geo awareness — tag the call with where the prospect lives so the
    // prompt can adjust regional expectations (pace, tone, norms).
    const geo = metaFromPhone(call.to_number)

    const systemPrompt = buildScoutPrompt({
      agencyName,
      agentName: agent.name || 'your Scout AI',
      companyName: call.company_name || 'them',
      contactName: call.contact_name || undefined,
      industry: call.industry || undefined,
      pitchAngle: call.pitch_angle || undefined,
      biggestGap: call.biggest_gap || undefined,
      industryKnowledge: (knowledge || []).map((k: any) => k.fact),
      personality: agent.personality_profile?.style || undefined,
      geo,
    })

    const fromNumber = agent.from_number || agency?.scout_voice_from_number
    if (!fromNumber) {
      await s.from('scout_voice_calls').update({ status: 'failed', error_message: 'No from_number configured' }).eq('id', call_id)
      return NextResponse.json({ error: 'No from_number configured' }, { status: 400 })
    }

    try {
      const res = await retellFetch('/v2/create-phone-call', 'POST', {
        from_number: fromNumber,
        to_number: call.to_number,
        override_agent_id: agent.retell_agent_id,
        retell_llm_dynamic_variables: {
          system_prompt: systemPrompt,
          company_name: call.company_name,
          contact_name: call.contact_name || '',
          industry: call.industry || '',
          pitch_angle: call.pitch_angle || '',
          biggest_gap: call.biggest_gap || '',
        },
        metadata: {
          agency_id: call.agency_id,
          scout_call_id: call.id,
          opportunity_id: call.opportunity_id,
          system: 'scout_voice',
        },
      })

      await s.from('scout_voice_calls').update({
        status: 'dialing',
        retell_call_id: res.call_id,
        from_number: fromNumber,
        started_at: new Date().toISOString(),
      }).eq('id', call_id)

      await s.from('scout_voice_queue').update({
        status: 'in_progress',
        last_attempt_at: new Date().toISOString(),
        attempt_count: (((await s.from('scout_voice_queue').select('attempt_count').eq('scout_call_id', call_id).single()).data?.attempt_count || 0) + 1),
      }).eq('scout_call_id', call_id)

      return NextResponse.json({ success: true, retell_call_id: res.call_id })
    } catch (e: any) {
      await s.from('scout_voice_calls').update({ status: 'failed', error_message: e.message }).eq('id', call_id)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── cancel_call ──
  if (action === 'cancel_call') {
    const { call_id } = body
    if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
    await s.from('scout_voice_calls').update({ status: 'cancelled' }).eq('id', call_id)
    await s.from('scout_voice_queue').update({ status: 'cancelled' }).eq('scout_call_id', call_id)
    return NextResponse.json({ success: true })
  }

  // ── update_discovery_field — upsert one field into discovery_data ──
  if (action === 'update_discovery_field') {
    const { call_id, field, value } = body
    if (!call_id || !field) return NextResponse.json({ error: 'call_id and field required' }, { status: 400 })
    const { data: call } = await s.from('scout_voice_calls').select('discovery_data, questions_answered').eq('id', call_id).single()
    const nextData = { ...(call?.discovery_data || {}), [field]: value }
    const answeredCount = Object.keys(nextData).length
    await s.from('scout_voice_calls').update({
      discovery_data: nextData,
      questions_answered: answeredCount,
    }).eq('id', call_id)
    return NextResponse.json({ success: true, discovery_data: nextData })
  }

  // ── save_agent — upsert a Scout voice agent config ──
  if (action === 'save_agent') {
    const { id, ...data } = body.agent || body
    if (id) {
      await s.from('scout_voice_agents').update(data).eq('id', id)
      return NextResponse.json({ success: true, id })
    }
    const { data: ins } = await s.from('scout_voice_agents').insert(data).select('id').single()
    return NextResponse.json({ success: true, id: ins?.id })
  }

  // ── create_agent — create Retell LLM + agent, store IDs ──
  if (action === 'create_agent') {
    const { agency_id, name, voice_id, industry_slug, from_number } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/voice/webhook`

    try {
      const llm = await retellFetch('/create-retell-llm', 'POST', {
        model: 'claude-4.5-haiku',
        general_prompt: 'You are a Scout SDR. The system prompt will be provided at call time via dynamic variables. Use the tools liberally.',
        general_tools: buildScoutTools(webhookUrl),
      })
      const agent = await retellFetch('/create-agent', 'POST', {
        agent_name: name || 'Scout SDR',
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        voice_id: voice_id || '11labs-Adrian',
        language: 'en-US',
        webhook_url: webhookUrl,
        responsiveness: 0.9,
        interruption_sensitivity: 0.6,
        enable_backchannel: true,
        ambient_sound: 'coffee-shop',
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
      })

      const { data: ins } = await s.from('scout_voice_agents').insert({
        agency_id, name: name || 'Scout SDR',
        retell_agent_id: agent.agent_id, retell_llm_id: llm.llm_id,
        voice_id: voice_id || '11labs-Adrian',
        industry_slug,
        from_number,
        active: true,
      }).select('id').single()

      return NextResponse.json({ success: true, agent_id: agent.agent_id, llm_id: llm.llm_id, id: ins?.id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── provision_number — buy a Retell phone number for Scout ──
  if (action === 'provision_number') {
    const { agency_id, area_code } = body
    if (!agency_id || !area_code) return NextResponse.json({ error: 'agency_id and area_code required' }, { status: 400 })
    try {
      const num = await retellFetch('/create-phone-number', 'POST', {
        area_code: String(area_code),
        nickname: `Scout SDR ${area_code}`,
      })
      await s.from('agencies').update({ scout_voice_from_number: num.phone_number }).eq('id', agency_id)
      return NextResponse.json({ success: true, phone_number: num.phone_number, phone_number_id: num.phone_number_id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── setup_scout_voice — one-click: agent + LLM + number provisioning ──
  if (action === 'setup_scout_voice') {
    const { agency_id, area_code, agent_name, voice_id, cadence_preset } = body
    if (!agency_id || !area_code) return NextResponse.json({ error: 'agency_id and area_code required' }, { status: 400 })

    const steps: any[] = []
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/voice/webhook`

    const cadence = getCadencePreset(cadence_preset)
    const chosenVoice = voice_id || '11labs-Adrian'

    try {
      const llm = await retellFetch('/create-retell-llm', 'POST', {
        model: 'claude-4.5-haiku',
        general_prompt: 'You are a Scout SDR. System prompt arrives via dynamic vars.',
        general_tools: buildScoutTools(webhookUrl),
      })
      steps.push({ step: 'retell_llm', ok: true, llm_id: llm.llm_id })

      const agent = await retellFetch('/create-agent', 'POST', {
        agent_name: agent_name || 'Scout SDR',
        response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
        voice_id: chosenVoice,
        language: 'en-US',
        webhook_url: webhookUrl,
        responsiveness: cadence.responsiveness,
        interruption_sensitivity: cadence.interruption_sensitivity,
        enable_backchannel: cadence.enable_backchannel,
        voice_speed: cadence.voice_speed,
        voice_temperature: cadence.voice_temperature,
      })
      steps.push({ step: 'retell_agent', ok: true, agent_id: agent.agent_id, voice_id: chosenVoice, cadence: cadence_preset || 'natural' })

      const num = await retellFetch('/create-phone-number', 'POST', {
        area_code: String(area_code),
        nickname: `Scout SDR ${area_code}`,
      })
      steps.push({ step: 'phone_number', ok: true, phone_number: num.phone_number })

      await s.from('agencies').update({
        scout_voice_agent_id: agent.agent_id,
        scout_voice_llm_id: llm.llm_id,
        scout_voice_from_number: num.phone_number,
      }).eq('id', agency_id)

      const { data: ins } = await s.from('scout_voice_agents').insert({
        agency_id, name: agent_name || 'Scout SDR',
        retell_agent_id: agent.agent_id, retell_llm_id: llm.llm_id,
        voice_id: '11labs-Adrian',
        from_number: num.phone_number,
        active: true,
      }).select('id').single()
      steps.push({ step: 'scout_agent_record', ok: true, id: ins?.id })

      return NextResponse.json({ success: true, ready: true, steps, agent_id: agent.agent_id, phone_number: num.phone_number })
    } catch (e: any) {
      steps.push({ step: 'error', ok: false, error: e.message })
      return NextResponse.json({ success: false, ready: false, steps, error: e.message }, { status: 500 })
    }
  }

  // ── ingest_knowledge — take a blob of reference text (pasted from a PDF,
  //    playbook, or coaching doc) and extract discrete facts into the brain.
  //    Claude Haiku handles the extraction + categorization in one shot.
  if (action === 'ingest_knowledge') {
    const { agency_id, text, scope, scope_value, direction, source_label } = body
    if (!agency_id || !text) return NextResponse.json({ error: 'agency_id and text required' }, { status: 400 })
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const systemPrompt = `You extract high-leverage cold-calling knowledge from reference material into structured facts.

Read the material the user pastes and return a JSON array of fact objects:
[
  {
    "fact": "one concrete actionable statement — specific, testable, useful on a live call",
    "category": "pitch_angle | pain_point | objection_response | timing | decision_maker | hot_button | opener | closer",
    "confidence": 0.5 to 0.95
  },
  ...
]

Rules:
- Each fact is self-contained, no context needed to apply it mid-call.
- Skip generic platitudes ("build rapport", "be a good listener"). Only specifics.
- Skip facts the source contradicts or marks uncertain.
- Max 25 facts per pass. Pick the most useful.
- Return ONLY the JSON array, no prose.`

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3500,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: String(text).slice(0, 60000) }],
        }),
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        return NextResponse.json({ error: `Claude error: ${resp.status} ${t.slice(0, 200)}` }, { status: 500 })
      }
      const data: any = await resp.json()
      const rawText: string = data?.content?.[0]?.text || '[]'
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      let facts: any[] = []
      try { facts = JSON.parse(cleaned) } catch { return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 }) }
      if (!Array.isArray(facts)) return NextResponse.json({ error: 'Claude did not return an array' }, { status: 500 })

      const resolvedScope = scope || 'global_pattern'
      const resolvedScopeValue = scope_value || null
      const resolvedDirection = direction || 'both'

      const rows = facts.slice(0, 25).map((f: any) => ({
        agency_id,
        scope: resolvedScope,
        scope_value: resolvedScopeValue,
        direction: resolvedDirection,
        source_system: 'manual',
        fact: String(f.fact || '').slice(0, 1000),
        fact_category: String(f.category || 'hot_button').slice(0, 60),
        confidence_score: Math.min(1, Math.max(0, Number(f.confidence) || 0.6)),
        times_confirmed: 1,
      })).filter((r: any) => r.fact.length > 10)

      if (rows.length === 0) return NextResponse.json({ inserted: 0, note: 'No useful facts extracted' })

      const { error } = await s.from('scout_voice_knowledge').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ inserted: rows.length, source_label: source_label || null })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'ingest failed' }, { status: 500 })
    }
  }

  // ── get_test_prospects — sample dummy rows for test dialing ──
  if (action === 'get_test_prospects') {
    return NextResponse.json({
      data: [
        { company_name: 'Acme HVAC', industry: 'HVAC', sic_code: '1711', biggest_gap: 'No Google Ads running', pitch_angle: 'Competitors are outbidding you on Maps' },
        { company_name: 'Lakeside Dental', industry: 'Dentistry', sic_code: '8021', biggest_gap: 'Google Business profile incomplete', pitch_angle: 'Missing hours + photos' },
        { company_name: 'Bright Legal', industry: 'Legal', sic_code: '8111', biggest_gap: 'No review management', pitch_angle: '3 unanswered negative reviews' },
        { company_name: 'Steel City Plumbing', industry: 'Plumbing', sic_code: '1711', biggest_gap: 'No email marketing', pitch_angle: 'Lost repeat customer revenue' },
      ],
    })
  }

  // ── test_call — dial a test number with a dummy prospect context ──
  if (action === 'test_call') {
    const { agency_id, to_number, company_name, pitch_angle, biggest_gap, industry } = body
    if (!agency_id || !to_number) return NextResponse.json({ error: 'agency_id and to_number required' }, { status: 400 })
    // Reuse queue_call + start_call machinery with the test prospect
    const { data: call, error: ce } = await s.from('scout_voice_calls').insert({
      agency_id,
      company_name: company_name || 'Test Prospect',
      industry: industry || 'Test',
      pitch_angle: pitch_angle || 'This is a test call.',
      biggest_gap: biggest_gap || undefined,
      priority: 1,
      trigger_mode: 'test',
      status: 'queued',
      to_number,
    }).select('*').single()
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

    // Directly call start_call logic inline by re-dispatching
    const startReq = new Request(req.url, {
      method: 'POST', headers: req.headers,
      body: JSON.stringify({ action: 'start_call', call_id: call.id }),
    })
    const startRes = await POST(startReq as any)
    const startData = await startRes.json().catch(() => ({}))
    if (!startData.success) {
      return NextResponse.json({ success: false, call_id: call.id, error: startData.error || 'start failed' }, { status: 500 })
    }
    return NextResponse.json({ success: true, call_id: call.id, retell_call_id: startData.retell_call_id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
