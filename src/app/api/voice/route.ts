import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function retellFetch(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch(`${RETELL_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.error || `Retell API error ${res.status}`)
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agency_id = searchParams.get('agency_id')
  const campaign_id = searchParams.get('campaign_id')
  const sb = getSupabase()

  if (action === 'get_agents') {
    const { data } = await sb.from('koto_voice_agents').select('*')
      .eq('agency_id', agency_id).order('created_at', { ascending: false })
    return NextResponse.json({ agents: data || [] })
  }

  if (action === 'get_campaigns') {
    const { data } = await sb.from('koto_voice_campaigns').select('*, koto_voice_agents(name, voice_name)')
      .eq('agency_id', agency_id).order('created_at', { ascending: false })
    return NextResponse.json({ campaigns: data || [] })
  }

  if (action === 'get_leads') {
    const { data } = await sb.from('koto_voice_leads').select('*')
      .eq('campaign_id', campaign_id).order('created_at', { ascending: false }).limit(500)
    return NextResponse.json({ leads: data || [] })
  }

  if (action === 'get_calls') {
    let query = sb.from('koto_voice_calls').select('*, koto_voice_leads(first_name, last_name, phone, business_name)')
    if (campaign_id) query = query.eq('campaign_id', campaign_id)
    else if (agency_id) query = query.eq('agency_id', agency_id)
    const { data } = await query.order('created_at', { ascending: false }).limit(200)
    return NextResponse.json({ calls: data || [] })
  }

  if (action === 'get_voices') {
    try {
      const voices = await retellFetch('/list-voices')
      return NextResponse.json({ voices })
    } catch (e: any) {
      return NextResponse.json({ voices: [], error: e.message })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id } = body
    const sb = getSupabase()

    // ── Create Agent ─────────────────────────────────────────────────────────
    if (action === 'create_agent') {
      const { client_id, name, voice_id, voice_name, gender, language,
              personality, goal, script_intro, script_questions,
              script_objections, script_closing, business_context } = body

      // Build the system prompt for Retell
      const systemPrompt = `You are ${name}, an AI voice agent for a marketing agency.

PERSONALITY: ${personality || 'Professional, friendly, confident'}
GOAL: ${goal || 'Schedule a consultation appointment'}

BUSINESS CONTEXT:
${business_context || 'You are calling local businesses to offer marketing services.'}

CALL SCRIPT:
Opening: ${script_intro || 'Hi, this is ' + name + '. I\'m reaching out because...'}

Questions to ask:
${(script_questions || []).map((q: any, i: number) => `${i + 1}. ${q.question}`).join('\n')}

Objection handling:
${(script_objections || []).map((o: any) => `If they say "${o.objection}" → respond: "${o.response}"`).join('\n')}

Closing: ${script_closing || 'I\'d love to schedule a quick 15-minute call with our team. What day works best for you this week?'}

RULES:
- Be natural and conversational, not robotic
- Listen more than you talk
- If they say they're not interested, thank them and end the call politely
- If they want to schedule, confirm the date, time, and their contact info
- Keep the call under 3 minutes unless they're engaged
- Never be pushy or aggressive`

      // Create agent in Retell
      const retellAgent = await retellFetch('/create-agent', 'POST', {
        agent_name: name,
        voice_id: voice_id || '11labs-Marissa',
        response_engine: {
          type: 'retell-llm',
          llm_id: null, // Use default Retell LLM
        },
        language: language || 'en-US',
        general_prompt: systemPrompt,
        begin_message: script_intro || `Hi, this is ${name}. How are you today?`,
      })

      // Save to database
      const { data: agent, error } = await sb.from('koto_voice_agents').insert({
        agency_id, client_id, name,
        retell_agent_id: retellAgent.agent_id,
        voice_id, voice_name, gender, language,
        personality, goal, script_intro, script_questions,
        script_objections, script_closing, business_context,
      }).select().single()

      if (error) throw error
      return NextResponse.json({ agent, retell: retellAgent })
    }

    // ── Update Agent ─────────────────────────────────────────────────────────
    if (action === 'update_agent') {
      const { agent_id, ...updates } = body
      const { data, error } = await sb.from('koto_voice_agents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', agent_id).select().single()
      if (error) throw error
      return NextResponse.json({ agent: data })
    }

    // ── Delete Agent ─────────────────────────────────────────────────────────
    if (action === 'delete_agent') {
      const { agent_id } = body
      const { data: agent } = await sb.from('koto_voice_agents').select('retell_agent_id').eq('id', agent_id).single()
      if (agent?.retell_agent_id) {
        try { await retellFetch(`/delete-agent/${agent.retell_agent_id}`, 'DELETE') } catch {}
      }
      await sb.from('koto_voice_agents').delete().eq('id', agent_id)
      return NextResponse.json({ ok: true })
    }

    // ── Create Campaign ──────────────────────────────────────────────────────
    if (action === 'create_campaign') {
      const { client_id, agent_id, name, scheduled_start, scheduled_end } = body
      const { data, error } = await sb.from('koto_voice_campaigns').insert({
        agency_id, client_id, agent_id, name,
        scheduled_start, scheduled_end,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    // ── Add Leads (bulk) ─────────────────────────────────────────────────────
    if (action === 'add_leads') {
      const { campaign_id, leads, source } = body
      if (!Array.isArray(leads) || leads.length === 0) {
        return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
      }

      const rows = leads.map((l: any) => ({
        campaign_id, agency_id,
        first_name: l.first_name || l.firstName || '',
        last_name: l.last_name || l.lastName || '',
        phone: l.phone || '',
        business_name: l.business_name || l.businessName || '',
        business_type: l.business_type || l.businessType || '',
        city: l.city || '',
        state: l.state || '',
        website: l.website || '',
        source: source || 'csv',
        status: 'pending',
      })).filter((r: any) => r.phone)

      const { data, error } = await sb.from('koto_voice_leads').insert(rows).select()
      if (error) throw error

      // Update campaign total_leads count
      await sb.from('koto_voice_campaigns').update({
        total_leads: rows.length,
      }).eq('id', campaign_id)

      return NextResponse.json({ imported: data?.length || 0, leads: data })
    }

    // ── Start Campaign ───────────────────────────────────────────────────────
    if (action === 'start_campaign') {
      const { campaign_id } = body

      // Get campaign + agent + leads
      const { data: campaign } = await sb.from('koto_voice_campaigns')
        .select('*, koto_voice_agents(*)').eq('id', campaign_id).single()
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

      const agent = campaign.koto_voice_agents
      if (!agent?.retell_agent_id) {
        return NextResponse.json({ error: 'Campaign agent has no Retell agent ID' }, { status: 400 })
      }

      const { data: leads } = await sb.from('koto_voice_leads')
        .select('*').eq('campaign_id', campaign_id).eq('status', 'pending').limit(100)

      if (!leads?.length) {
        return NextResponse.json({ error: 'No pending leads to call' }, { status: 400 })
      }

      // Update campaign status
      await sb.from('koto_voice_campaigns').update({ status: 'active' }).eq('id', campaign_id)

      // Start calling each lead via Retell
      const results: any[] = []
      for (const lead of leads) {
        try {
          // Create outbound call via Retell
          const call = await retellFetch('/v2/create-phone-call', 'POST', {
            from_number: body.from_number || undefined,
            to_number: lead.phone,
            agent_id: agent.retell_agent_id,
            metadata: {
              lead_id: lead.id,
              campaign_id: campaign_id,
              agency_id: agency_id,
              business_name: lead.business_name,
              contact_name: `${lead.first_name} ${lead.last_name}`.trim(),
            },
            retell_llm_dynamic_variables: {
              contact_name: lead.first_name || 'there',
              business_name: lead.business_name || 'your business',
              city: lead.city || '',
            },
          })

          // Update lead status
          await sb.from('koto_voice_leads').update({
            status: 'calling', retell_call_id: call.call_id, called_at: new Date().toISOString(),
          }).eq('id', lead.id)

          // Create call record
          await sb.from('koto_voice_calls').insert({
            lead_id: lead.id, campaign_id, agency_id,
            retell_call_id: call.call_id, direction: 'outbound', status: 'initiated',
          })

          results.push({ lead_id: lead.id, call_id: call.call_id, status: 'initiated' })
        } catch (e: any) {
          // Mark lead as failed
          await sb.from('koto_voice_leads').update({ status: 'failed', notes: e.message }).eq('id', lead.id)
          results.push({ lead_id: lead.id, error: e.message, status: 'failed' })
        }

        // Small delay between calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 500))
      }

      // Update campaign stats
      const initiated = results.filter(r => r.status === 'initiated').length
      const failed = results.filter(r => r.status === 'failed').length
      await sb.from('koto_voice_campaigns').update({
        called: initiated, failed,
      }).eq('id', campaign_id)

      return NextResponse.json({ results, initiated, failed })
    }

    // ── Pause Campaign ───────────────────────────────────────────────────────
    if (action === 'pause_campaign') {
      const { campaign_id } = body
      await sb.from('koto_voice_campaigns').update({ status: 'paused' }).eq('id', campaign_id)
      return NextResponse.json({ ok: true })
    }

    // ── Webhook (Retell callback) ────────────────────────────────────────────
    if (action === 'webhook') {
      const { event, call } = body

      if (!call?.call_id) return NextResponse.json({ ok: true })

      const retell_call_id = call.call_id
      const metadata = call.metadata || {}

      // Find the call record
      const { data: callRecord } = await sb.from('koto_voice_calls')
        .select('*').eq('retell_call_id', retell_call_id).single()

      if (event === 'call_started') {
        await sb.from('koto_voice_calls').update({ status: 'in_progress' }).eq('retell_call_id', retell_call_id)
        await sb.from('koto_voice_leads').update({ status: 'calling' }).eq('retell_call_id', retell_call_id)
      }

      if (event === 'call_ended') {
        const duration = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0
        const transcript = call.transcript || ''
        const recording = call.recording_url || ''

        // Determine call outcome
        const answered = duration > 5
        const appointmentSet = call.call_analysis?.custom_analysis_data?.appointment_set ||
          transcript.toLowerCase().includes('schedule') && transcript.toLowerCase().includes('appointment')
        const callbackRequested = transcript.toLowerCase().includes('call me back') ||
          transcript.toLowerCase().includes('call back')
        const sentiment = call.call_analysis?.user_sentiment || 'neutral'

        // Update call record
        await sb.from('koto_voice_calls').update({
          status: answered ? 'completed' : 'no_answer',
          duration_seconds: duration,
          recording_url: recording,
          transcript,
          sentiment,
          appointment_set: appointmentSet || false,
          callback_requested: callbackRequested || false,
          ai_summary: call.call_analysis?.call_summary || '',
        }).eq('retell_call_id', retell_call_id)

        // Update lead status
        const leadStatus = appointmentSet ? 'appointment_set'
          : callbackRequested ? 'callback'
          : answered ? 'answered'
          : 'no_answer'

        await sb.from('koto_voice_leads').update({
          status: leadStatus,
          call_duration_seconds: duration,
          recording_url: recording,
          transcript,
        }).eq('retell_call_id', retell_call_id)

        // Update campaign stats
        if (callRecord?.campaign_id) {
          const { data: stats } = await sb.from('koto_voice_leads')
            .select('status').eq('campaign_id', callRecord.campaign_id)

          if (stats) {
            const counts = {
              answered: stats.filter(s => ['answered', 'appointment_set', 'callback', 'not_interested'].includes(s.status)).length,
              appointments_set: stats.filter(s => s.status === 'appointment_set').length,
              callbacks: stats.filter(s => s.status === 'callback').length,
              no_answer: stats.filter(s => s.status === 'no_answer').length,
              failed: stats.filter(s => s.status === 'failed').length,
            }
            await sb.from('koto_voice_campaigns').update(counts).eq('id', callRecord.campaign_id)

            // Check if all leads are done
            const pending = stats.filter(s => ['pending', 'calling'].includes(s.status)).length
            if (pending === 0) {
              await sb.from('koto_voice_campaigns').update({ status: 'completed' }).eq('id', callRecord.campaign_id)
            }
          }
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── Generate Script Section with AI ─────────────────────────────────────
    if (action === 'generate_script') {
      const { section, business_context: ctx } = body
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const sicCode = ctx?.sic_code || ''
      const industry = ctx?.industry_division || ''
      const prompt = `Generate a ${section} script for an AI voice agent making outbound sales calls.

BUSINESS CONTEXT:
Business: ${ctx?.business_name || 'a local business'} (${ctx?.main_service || 'services'})
SIC Code: ${sicCode}
Industry: ${industry}
Target Customer: ${ctx?.target_customer || 'local businesses'}
Differentiator: ${ctx?.differentiator || 'quality service'}
Problem Solved: ${ctx?.problem_solved || 'business growth'}
Service Area: ${ctx?.service_area || 'local area'}
Deal Size: ${ctx?.deal_size || 'varies'}

INDUSTRY-SPECIFIC GUIDANCE:
- Use industry-appropriate terminology and tone
- Reference common pain points for this industry (lead generation, online visibility, competition)
- For healthcare: be HIPAA-aware, mention patient acquisition not "customers"
- For legal: respect bar association advertising rules, be professional
- For construction: call early morning or after hours (they're on job sites)
- For finance/insurance: be compliance-conscious, avoid guarantees
- For restaurants/retail: focus on foot traffic, online reviews, local SEO
- Address the most common objection: "I already have a marketing person / we're fine"
- Include a TCPA-compliant consent question if this is the closing or intro section

${section === 'objections' ? 'Generate 5-7 common objections with professional responses. Format: Objection: [text]\\nResponse: [text]\\n\\n' : ''}
${section === 'questions' ? 'Generate 5-7 qualifying discovery questions that uncover pain points and budget. Number them.' : ''}
${section === 'tcpa_consent' ? 'Generate a natural TCPA consent script: ask for consent to call, text, and email separately. Must sound conversational, not legal.' : ''}
${section === 'voicemail' ? 'Keep under 30 seconds when read aloud. Include callback number and reason to call back.' : ''}

Return ONLY the script text, no markdown or JSON.`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      return NextResponse.json({ script: data.content?.[0]?.text || '' })
    }

    // ── Score Script ─────────────────────────────────────────────────────────
    if (action === 'score_script') {
      const { script_text } = body
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: `Score this sales call script on 5 dimensions (1-10 each). Return JSON only: {"naturalness":N,"clarity":N,"empathy":N,"compliance":N,"effectiveness":N,"overall":N,"feedback":"brief feedback"}\n\nScript:\n${script_text}` }] }),
      })
      const data = await res.json()
      try { return NextResponse.json(JSON.parse(data.content?.[0]?.text || '{}')) } catch { return NextResponse.json({ overall: 5, feedback: 'Could not parse score' }) }
    }

    // ── Improve Script ───────────────────────────────────────────────────────
    if (action === 'improve_script') {
      const { script_text } = body
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: `Improve this sales call script to be more natural, empathetic, and TCPA compliant. Return ONLY the improved script text.\n\nOriginal:\n${script_text}` }] }),
      })
      const data = await res.json()
      return NextResponse.json({ improved: data.content?.[0]?.text || '' })
    }

    // ── Check Script Compliance ──────────────────────────────────────────────
    if (action === 'check_script_compliance') {
      const { script_text } = body
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: `Analyze this phone sales script for TCPA compliance issues. Return JSON: {"score":N,"lines":[{"line":N,"text":"...","status":"ok|warning|violation","issue":"...","fix":"..."}],"summary":"..."}\n\nScript:\n${script_text}` }] }),
      })
      const data = await res.json()
      try { return NextResponse.json(JSON.parse(data.content?.[0]?.text || '{}')) } catch { return NextResponse.json({ score: 50, lines: [], summary: 'Could not parse' }) }
    }

    // ── Analytics ─────────────────────────────────────────────────────────────
    if (action === 'get_analytics') {
      const { data: leads } = await sb.from('koto_voice_leads').select('*').eq('agency_id', agency_id).limit(1000)
      const { data: intel } = await sb.from('koto_voice_intelligence').select('*').eq('agency_id', agency_id).order('created_at', { ascending: false }).limit(1)
      const allLeads = leads || []
      const called = allLeads.filter(l => l.status !== 'pending')
      const answered = allLeads.filter(l => ['answered', 'appointment_set', 'callback', 'not_interested'].includes(l.status))
      const appts = allLeads.filter(l => l.status === 'appointment_set')
      return NextResponse.json({
        total: allLeads.length, called: called.length, answered: answered.length, appointments: appts.length,
        connectionRate: called.length ? Math.round(answered.length / called.length * 100) : 0,
        appointmentRate: answered.length ? Math.round(appts.length / answered.length * 100) : 0,
        avgDuration: called.length ? Math.round(called.reduce((s, l) => s + (l.call_duration_seconds || 0), 0) / called.length) : 0,
        intelligence: intel?.[0] || null,
      })
    }

    // ── Analyze and Learn ────────────────────────────────────────────────────
    if (action === 'analyze_and_learn') {
      const { agent_id: agId } = body
      const { data: calls } = await sb.from('koto_voice_leads').select('*').eq('agency_id', agency_id).not('transcript', 'is', null).order('created_at', { ascending: false }).limit(100)
      if (!calls?.length) return NextResponse.json({ error: 'No calls with transcripts to analyze' })
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const sample = (calls || []).slice(0, 20).map(c => `[${c.status}] ${c.transcript?.slice(0, 500)}`).join('\n---\n')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: `Analyze these ${calls.length} sales call transcripts and provide insights. Return JSON: {"what_works":["..."],"what_fails":["..."],"best_times":{"morning":N,"afternoon":N,"evening":N},"recommendations":["..."],"script_scores":{"intro":N,"discovery":N,"value_prop":N,"objection":N,"close":N}}\n\n${sample}` }] }),
      })
      const data = await res.json()
      let insights: any = {}
      try { insights = JSON.parse(data.content?.[0]?.text || '{}') } catch {}
      await sb.from('koto_voice_intelligence').insert({ agency_id, agent_id: agId, analysis_type: 'learning', insights, recommendations: insights.recommendations || [], what_works: insights.what_works || [], what_fails: insights.what_fails || [], best_times: insights.best_times || {}, script_scores: insights.script_scores || {}, calls_analyzed: calls.length })
      return NextResponse.json({ insights, calls_analyzed: calls.length })
    }

    // ── Get Live Calls (super admin) ─────────────────────────────────────────
    if (action === 'get_live_calls') {
      const { data: active } = await sb.from('koto_voice_calls').select('*, koto_voice_leads(first_name, last_name, phone, business_name)').in('status', ['initiated', 'in_progress']).order('created_at', { ascending: false }).limit(50)
      return NextResponse.json({ calls: active || [] })
    }

    // ── Stop Call ────────────────────────────────────────────────────────────
    if (action === 'stop_call') {
      const { call_id: cId, retell_call_id: rId } = body
      if (rId) { try { await retellFetch(`/v2/end-call/${rId}`, 'POST') } catch {} }
      if (cId) await sb.from('koto_voice_calls').update({ status: 'stopped' }).eq('id', cId)
      return NextResponse.json({ ok: true })
    }

    // ── TCPA Records ─────────────────────────────────────────────────────────
    if (action === 'get_tcpa_records') {
      const { data } = await sb.from('koto_voice_tcpa_records').select('*').eq('agency_id', agency_id).order('created_at', { ascending: false }).limit(500)
      return NextResponse.json({ records: data || [] })
    }

    if (action === 'export_tcpa_csv') {
      const { data } = await sb.from('koto_voice_tcpa_records').select('*').eq('agency_id', agency_id)
      const rows = (data || []).map(r => `${r.phone},${r.consent_phone},${r.consent_sms},${r.consent_email},${r.consent_method},${r.consent_timestamp},${r.opt_out},${r.dnc_result}`)
      const csv = 'phone,consent_phone,consent_sms,consent_email,method,timestamp,opt_out,dnc_result\n' + rows.join('\n')
      return NextResponse.json({ csv })
    }

    // ── Appointments ─────────────────────────────────────────────────────────
    if (action === 'get_appointments') {
      const { data } = await sb.from('koto_voice_appointments').select('*').eq('agency_id', agency_id).order('appointment_datetime', { ascending: true }).limit(100)
      return NextResponse.json({ appointments: data || [] })
    }

    if (action === 'book_appointment') {
      const { lead_id: lId, date, time, tz, prospect_name: pn, prospect_phone: pp, prospect_email: pe, prospect_business: pb } = body
      const dt = new Date(`${date}T${time}`)
      const { data } = await sb.from('koto_voice_appointments').insert({
        agency_id, lead_id: lId, appointment_date: date, appointment_time: time, appointment_datetime: dt.toISOString(), timezone: tz || 'America/New_York', prospect_name: pn, prospect_phone: pp, prospect_email: pe, prospect_business: pb,
      }).select().single()
      return NextResponse.json({ appointment: data })
    }

    // ── Calendar Settings ────────────────────────────────────────────────────
    if (action === 'get_calendar_settings') {
      const { data } = await sb.from('koto_voice_calendar_settings').select('*').eq('agency_id', agency_id).single()
      return NextResponse.json({ settings: data })
    }

    if (action === 'save_calendar_settings') {
      const { settings } = body
      const { data } = await sb.from('koto_voice_calendar_settings').upsert({ agency_id, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' }).select().single()
      return NextResponse.json({ settings: data })
    }

    // ── Run Test Simulation ──────────────────────────────────────────────────
    if (action === 'run_test_simulation') {
      const { campaign_id: cmpId, count } = body
      const { data: campaign } = await sb.from('koto_voice_campaigns').select('*').eq('id', cmpId).single()
      const simCount = count || 10
      // Simulate outcomes based on industry averages
      const connectionRate = 0.25 + Math.random() * 0.15
      const appointmentRate = 0.08 + Math.random() * 0.07
      const results = { simulated_calls: simCount, predicted_connections: Math.round(simCount * connectionRate), predicted_appointments: Math.round(simCount * connectionRate * appointmentRate), predicted_callbacks: Math.round(simCount * connectionRate * 0.15), predicted_no_answer: Math.round(simCount * (1 - connectionRate)), avg_duration_predicted: Math.round(45 + Math.random() * 60), connection_rate: Math.round(connectionRate * 100), appointment_rate: Math.round(appointmentRate * 100), bottleneck: Math.random() > 0.5 ? 'objection_handling' : 'closing' }
      await sb.from('koto_voice_test_results').insert({ agency_id, test_type: 'stress_test', test_config: { campaign_id: cmpId, count: simCount }, results, score: results.connection_rate })
      return NextResponse.json(results)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[Voice API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
