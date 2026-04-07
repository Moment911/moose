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

  if (action === 'get_voices' || action === 'list_voices') {
    try {
      const raw = await retellFetch('/list-voices')
      const voices = (Array.isArray(raw) ? raw : []).map((v: any) => ({
        id: v.voice_id, name: v.voice_name, provider: v.provider,
        gender: v.gender, accent: v.accent, language: v.language || 'en',
        age: v.age, preview_url: v.preview_audio_url, avatar_url: v.avatar_url,
        recommended: v.recommended || false,
      }))
      return new NextResponse(JSON.stringify({ voices }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      })
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
      // Build Retell agent config
      const retellConfig: any = {
        agent_name: name,
        voice_id: voice_id || '11labs-Marissa',
        response_engine: { type: 'retell-llm', llm_id: null },
        language: language || 'en-US',
        general_prompt: systemPrompt,
        begin_message: script_intro || `Hi, this is ${name}. How are you today?`,
        enable_backchannel: true,
        backchannel_frequency: 0.7,
        interruption_sensitivity: 0.8,
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
      }
      // Live transfer
      if (body.transfer_phone && body.transfer_enabled) {
        retellConfig.transfer_list = [{ number: body.transfer_phone, description: 'Live transfer to team' }]
      }
      const retellAgent = await retellFetch('/create-agent', 'POST', retellConfig)

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

      const { data: campaign } = await sb.from('koto_voice_campaigns')
        .select('*, koto_voice_agents(*)').eq('id', campaign_id).single()
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

      const agent = campaign.koto_voice_agents
      if (!agent?.retell_agent_id) return NextResponse.json({ error: 'Agent has no Retell ID' }, { status: 400 })

      const maxAttempts = campaign.max_attempts || 3
      const callsPerHour = campaign.calls_per_hour || 20
      const delayMs = Math.round(3600000 / callsPerHour)

      const { data: leads } = await sb.from('koto_voice_leads')
        .select('*').eq('campaign_id', campaign_id).eq('status', 'pending').limit(100)
      if (!leads?.length) return NextResponse.json({ error: 'No pending leads' }, { status: 400 })

      await sb.from('koto_voice_campaigns').update({ status: 'active' }).eq('id', campaign_id)

      let skippedDnc = 0, skippedHours = 0, skippedMaxAttempts = 0, started = 0, errors = 0
      const results: any[] = []

      for (const lead of leads) {
        // 1. Check DNC
        const { data: optOut } = await sb.from('koto_voice_tcpa_records').select('id').eq('phone', lead.phone).eq('opt_out', true).maybeSingle()
        if (optOut) {
          await sb.from('koto_voice_leads').update({ status: 'dnc_blocked', dnc_status: 'blocked' }).eq('id', lead.id)
          skippedDnc++; results.push({ lead_id: lead.id, status: 'dnc_blocked' }); continue
        }

        // 2. Check timezone/calling hours (8am-9pm local)
        const phone = (lead.phone || '').replace(/\D/g, '')
        const areaCode = phone.length >= 10 ? phone.slice(phone.length === 11 ? 1 : 0, phone.length === 11 ? 4 : 3) : ''
        // Simple timezone check — full map is in callTimeChecker.ts
        const eastCodes = ['201','202','203','205','207','212','215','216','301','302','303','304','305','312','313','315','404','407','410','412','413','414','415','416','419','443','484','508','516','518','561','570','585','601','603','607','609','610','614','617','631','646','678','704','706','713','716','717','718','724','732','757','770','772','774','781','786','802','803','804','810','813','814','828','843','845','848','856','857','858','860','862','863','864','865','901','904','908','910','912','914','917','919','929','941','954','973','978','980','984','985']
        const centralCodes = ['205','210','214','217','218','219','224','225','228','251','254','256','262','270','309','314','316','318','319','320','334','337','346','402','405','409','417','430','432','469','479','501','504','507','512','515','531','563','573','580','605','608','612','615','618','620','630','636','641','651','660','662','682','701','708','712','713','715','726','731','737','740','763','765','769','773','779','785','806','815','816','817','830','832','847','870','872','903','913','918','920','936','940','952','956','972','979']
        const mountainCodes = ['303','307','385','406','435','480','505','520','602','623','719','720','801','915','928','970']
        const pacificCodes = ['206','209','213','253','310','323','360','408','415','424','425','442','503','509','510','530','541','559','562','619','626','628','650','657','661','669','702','707','714','725','747','760','775','805','818','831','858','909','916','925','949','951','971']

        let tz = 'America/New_York'
        if (centralCodes.includes(areaCode)) tz = 'America/Chicago'
        else if (mountainCodes.includes(areaCode)) tz = 'America/Denver'
        else if (pacificCodes.includes(areaCode)) tz = 'America/Los_Angeles'

        const localHour = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }))
        if (localHour < 8 || localHour >= 21) {
          await sb.from('koto_voice_leads').update({ attempted_outside_hours: true, timezone: tz }).eq('id', lead.id)
          skippedHours++; results.push({ lead_id: lead.id, status: 'outside_hours' }); continue
        }

        // 3. Check max attempts
        if ((lead.attempt_number || 1) > maxAttempts) {
          await sb.from('koto_voice_leads').update({ status: 'max_attempts' }).eq('id', lead.id)
          skippedMaxAttempts++; results.push({ lead_id: lead.id, status: 'max_attempts' }); continue
        }

        // 4. Make the call
        try {
          const call = await retellFetch('/v2/create-phone-call', 'POST', {
            from_number: body.from_number || undefined,
            to_number: lead.phone,
            agent_id: agent.retell_agent_id,
            metadata: { lead_id: lead.id, campaign_id, agency_id, business_name: lead.business_name },
            retell_llm_dynamic_variables: {
              contact_name: lead.first_name || 'there',
              first_name: lead.first_name || 'there',
              business_name: lead.business_name || 'your business',
              city: lead.city || '',
              industry: lead.industry_name || '',
              agent_name: agent.name || '',
              closer_name: agent.closer_name || 'our strategist',
              closer_title: agent.closer_title || '',
              closer_bio: agent.closer_bio || '',
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

          await sb.from('koto_voice_leads').update({
            status: 'calling', retell_call_id: call.call_id, called_at: new Date().toISOString(),
            attempt_number: (lead.attempt_number || 0) + 1, timezone: tz,
          }).eq('id', lead.id)
          await sb.from('koto_voice_calls').insert({
            lead_id: lead.id, campaign_id, agency_id,
            retell_call_id: call.call_id, direction: 'outbound', status: 'initiated',
          })
          started++
          results.push({ lead_id: lead.id, call_id: call.call_id, status: 'initiated' })
        } catch (e: any) {
          await sb.from('koto_voice_leads').update({ status: 'failed', notes: e.message }).eq('id', lead.id)
          errors++
          results.push({ lead_id: lead.id, error: e.message, status: 'failed' })
        }

        // Pacing delay between calls
        if (delayMs > 500) await new Promise(r => setTimeout(r, Math.min(delayMs, 5000)))
        else await new Promise(r => setTimeout(r, 500))
      }

      await sb.from('koto_voice_campaigns').update({ called: started, failed: errors }).eq('id', campaign_id)

      return NextResponse.json({ started, skipped_dnc: skippedDnc, skipped_hours: skippedHours, skipped_max_attempts: skippedMaxAttempts, errors, results })
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

        // Bill for the call (outbound voice)
        if (duration > 0 && callRecord?.agency_id) {
          const minutes = Math.ceil(duration / 60)
          try {
            await fetch(new URL('/api/billing', req.url).toString(), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record_usage', agency_id: callRecord.agency_id,
                feature: 'voice_outbound', quantity: minutes, unit: 'minutes',
                unit_cost: 0.05,
              }),
            })
          } catch {}
        }

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

      // ── Voicemail Detection ──────────────────────────────────────────────
      if (event === 'call_analyzed' && call.call_type === 'voicemail_detected') {
        await sb.from('koto_voice_leads').update({
          status: 'voicemail', call_duration_seconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
        }).eq('retell_call_id', retell_call_id)
        await sb.from('koto_voice_calls').update({ status: 'voicemail' }).eq('retell_call_id', retell_call_id)
        // Schedule callback 4 hours later
        if (callRecord?.lead_id) {
          const callbackTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
          await sb.from('koto_voice_leads').update({ status: 'callback', callback_time: callbackTime }).eq('id', callRecord.lead_id)
        }
      }

      // ── Call Analyzed (post-call intelligence) ─────────────────────────────
      if (event === 'call_analyzed') {
        const transcript = call.transcript || call.call_analysis?.transcript || ''
        const recording = call.recording_url || ''
        const summary = call.call_analysis?.call_summary || ''
        // Save transcript + recording
        if (transcript) await sb.from('koto_voice_calls').update({ transcript, recording_url: recording, ai_summary: summary }).eq('retell_call_id', retell_call_id)
        if (transcript) await sb.from('koto_voice_leads').update({ transcript_full: transcript, transcript_summary: summary, recording_url: recording }).eq('retell_call_id', retell_call_id)
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
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)
      const todayISO = todayStart.toISOString()

      // Active calls (both outbound + inbound)
      const [{ data: outActive }, { data: inActive }] = await Promise.all([
        sb.from('koto_voice_calls').select('*, koto_voice_leads(first_name, last_name, phone, business_name)').in('status', ['initiated', 'in_progress']).order('created_at', { ascending: false }).limit(20),
        sb.from('koto_inbound_calls').select('*, koto_inbound_agents(agent_name)').in('outcome', ['in_progress', 'ringing']).order('created_at', { ascending: false }).limit(20),
      ])

      const activeCalls = [
        ...(outActive || []).map((c: any) => { const lead = Array.isArray(c.koto_voice_leads) ? c.koto_voice_leads[0] : c.koto_voice_leads; return { ...c, direction: 'outbound', contact_name: lead?.first_name ? `${lead.first_name} ${lead.last_name || ''}`.trim() : lead?.phone || 'Unknown', contact_phone: lead?.phone || '' } }),
        ...(inActive || []).map((c: any) => { const agent = Array.isArray(c.koto_inbound_agents) ? c.koto_inbound_agents[0] : c.koto_inbound_agents; return { ...c, direction: 'inbound', contact_name: c.caller_name || c.caller_number || 'Unknown', contact_phone: c.caller_number || '', agent_name: agent?.agent_name || '' } }),
      ]

      // Recent calls (last 50 from both tables)
      const [{ data: outRecent }, { data: inRecent }] = await Promise.all([
        sb.from('koto_voice_calls').select('id, status, duration_seconds, sentiment, appointment_set, recording_url, created_at, agency_id, retell_call_id, koto_voice_leads(first_name, last_name, phone, business_name)').order('created_at', { ascending: false }).limit(30),
        sb.from('koto_inbound_calls').select('id, outcome, duration_seconds, sentiment, recording_url, caller_number, caller_name, summary, urgency, created_at, agency_id, koto_inbound_agents(agent_name)').order('created_at', { ascending: false }).limit(30),
      ])

      const recentCalls = [
        ...(outRecent || []).map((c: any) => { const lead = Array.isArray(c.koto_voice_leads) ? c.koto_voice_leads[0] : c.koto_voice_leads; return { id: c.id, direction: 'outbound', type: 'Campaign Call', agent: '', contact: lead?.first_name || '', phone: lead?.phone || '', duration: c.duration_seconds || 0, outcome: c.appointment_set ? 'appointment' : c.status || 'unknown', sentiment: c.sentiment || 'neutral', recording_url: c.recording_url, created_at: c.created_at } }),
        ...(inRecent || []).map((c: any) => { const agent = Array.isArray(c.koto_inbound_agents) ? c.koto_inbound_agents[0] : c.koto_inbound_agents; return { id: c.id, direction: 'inbound', type: 'Answering Service', agent: agent?.agent_name || '', contact: c.caller_name || '', phone: c.caller_number || '', duration: c.duration_seconds || 0, outcome: c.outcome || 'completed', sentiment: c.sentiment || 'neutral', recording_url: c.recording_url, urgency: c.urgency, created_at: c.created_at } }),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)

      // Stats for today
      const [{ count: outToday }, { count: inToday }, { count: outAnswered }, { count: appts }] = await Promise.all([
        sb.from('koto_voice_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
        sb.from('koto_inbound_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
        sb.from('koto_voice_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('status', 'completed'),
        sb.from('koto_voice_calls').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('appointment_set', true),
      ])

      const totalToday = (outToday || 0) + (inToday || 0)
      const answeredRate = (outToday || 0) > 0 ? Math.round(((outAnswered || 0) / (outToday || 1)) * 100) : 0

      // Check webhook status
      const { data: lastWebhook } = await sb.from('koto_system_logs').select('created_at').eq('service', 'voice_webhook').order('created_at', { ascending: false }).limit(1)
      const retellConfigured = !!process.env.RETELL_API_KEY

      return NextResponse.json({
        active_calls: activeCalls,
        recent_calls: recentCalls,
        stats: { total_today: totalToday, active_now: activeCalls.length, answered_rate: answeredRate, appointments_today: appts || 0, outbound_today: outToday || 0, inbound_today: inToday || 0 },
        webhook: { retell_configured: retellConfigured, last_received: lastWebhook?.[0]?.created_at || null, webhook_url: 'https://hellokoto.com/api/voice' },
      })
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

    // ── Analyze Personality from recordings ─────────────────────────────────
    if (action === 'analyze_personality') {
      const { filenames } = body
      const AKEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const prompt = `Based on a sales professional's call recordings titled: ${(filenames || []).join(', ')}, analyze and generate a communication style profile. Return JSON only: {"pace":"fast/moderate/slow","pause_usage":"frequent/moderate/rare","vocabulary_level":"simple/moderate/advanced","warmth_level":"high/moderate/low","humor_level":"high/moderate/low/none","question_style":"open-ended/direct/socratic","energy_level":"high/moderate/calm","signature_phrases":["phrase1","phrase2"],"dos":["do1","do2"],"donts":["dont1","dont2"]}`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      let profile = {}
      try { profile = JSON.parse(data.content?.[0]?.text || '{}') } catch {}
      if (body.agent_id) {
        await sb.from('koto_voice_agents').update({ personality_profile: profile }).eq('id', body.agent_id)
      }
      return NextResponse.json({ profile })
    }

    // ── Post-call AI coaching ────────────────────────────────────────────────
    if (action === 'generate_coaching') {
      const { call_id: cId, transcript: tx, outcome: oc, lead_score: ls } = body
      const AKEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      const prompt = `You are a 25-year expert cold calling coach. Grade this AI agent call.
Transcript: ${(tx || '').slice(0, 3000)}
Outcome: ${oc || 'unknown'}
Lead score: ${ls || 50}

Grade 1-10 on: Opening effectiveness, Qualification depth, Objection handling, Closing attempt, Tone/naturalness, TCPA compliance.
For each: score, what_went_well (1 sentence), what_to_improve (1 sentence), specific_line_improvement.
Overall grade: A/B/C/D/F. Key insight (2-3 sentences). Script change recommendation (before/after).
Return JSON only: {"criteria":[{"name":"Opening","score":N,"well":"...","improve":"...","line":"..."}],"overall_grade":"B","key_insight":"...","script_change":{"before":"...","after":"..."}}`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      let coaching = {}
      try { coaching = JSON.parse(data.content?.[0]?.text || '{}') } catch {}
      if (cId) await sb.from('koto_voice_calls').update({ coaching_report: coaching }).eq('id', cId)
      return NextResponse.json({ coaching })
    }

    // ── Update appointment outcome ───────────────────────────────────────────
    if (action === 'update_appointment_outcome') {
      const { appointment_id, outcome: apptOutcome, deal_value: dv, notes: apptNotes } = body
      const patch: any = { appointment_outcome: apptOutcome, closer_notes: apptNotes }
      if (apptOutcome === 'closed') { patch.deal_value = dv; patch.status = 'completed' }
      if (apptOutcome === 'no_show') patch.status = 'no_show'
      if (apptOutcome === 'rescheduled') patch.status = 'rescheduled'
      await sb.from('koto_voice_appointments').update(patch).eq('id', appointment_id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[Voice API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
