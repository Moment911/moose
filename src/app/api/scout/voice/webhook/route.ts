import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logTokenUsage } from '@/lib/tokenTracker'

// ─────────────────────────────────────────────────────────────
// Scout Voice Webhook — handles Retell events for outbound
// cold-call / SDR calls.
//
// Events:
//   call_started   — call connected, update status
//   function_call  — save_discovery_answer, detect_buying_signal,
//                    set_appointment, dnc_request, transfer_to_human
//   call_ended     — finalize record, post-call analysis via Claude
//   call_analyzed  — Retell's built-in analysis (optional enrichment)
// ─────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function safeJson(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}

// ── CORS preflight (Retell sends OPTIONS first) ──
export async function OPTIONS() {
  return new Response('OK', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// ── Main webhook handler ──
export async function POST(req: NextRequest) {
  const headers = { 'Access-Control-Allow-Origin': '*' }
  try {
    const body = await req.json()
    const s = sb()

    const event = body.event || body.type || ''
    const call = body.call || {}
    const callId = body.call_id || call.call_id || ''
    const metadata = call.metadata || body.metadata || {}

    const scoutCallId: string | null = metadata.scout_call_id || null
    const agencyId: string | null = metadata.agency_id || null
    const opportunityId: string | null = metadata.opportunity_id || null

    console.log('[scout/voice/webhook] event:', event, 'callId:', callId, 'scoutCallId:', scoutCallId)

    // ── call_started ──────────────────────────────────────────────
    if (event === 'call_started' || event === 'call_created') {
      if (scoutCallId) {
        await s.from('scout_voice_calls').update({
          status: 'speaking',
          retell_call_id: callId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', scoutCallId)

        await s.from('scout_voice_queue').update({
          status: 'in_progress',
        }).eq('scout_call_id', scoutCallId)
      }
      return new Response('OK', { status: 200, headers })
    }

    // ── Function calls (tool callbacks from Retell LLM) ───────────
    const fnName: string = body.name || body.fn_name || body.function?.name || call.name || ''
    const rawArgs: any = body.args ?? body.arguments ?? body.function?.arguments ?? call.arguments ?? {}
    const fnArgs: any = typeof rawArgs === 'string' ? safeJson(rawArgs) : (rawArgs || {})

    const isFunctionCall = !!fnName && (
      event === 'function_call' || event === 'tool_call' ||
      body.type === 'function_call' || (!event && !body.call_inbound)
    )

    if (isFunctionCall) {
      console.log('[scout/voice/webhook] fn:', fnName, 'args:', JSON.stringify(fnArgs).slice(0, 300))

      // ── save_discovery_answer ─────────────────────────────────
      if (fnName === 'save_discovery_answer') {
        const field = String(fnArgs.field || '').trim()
        const value = String(fnArgs.value || '').trim()
        const confidence = typeof fnArgs.confidence === 'number' ? fnArgs.confidence : 80

        if (!field || !scoutCallId) {
          return NextResponse.json({ result: 'saved', success: false, error: 'missing field or call context' }, { headers })
        }

        // Fire-and-forget: update discovery_data jsonb + insert scout_call_questions row
        void (async () => {
          try {
            const { data: callRow } = await s.from('scout_voice_calls')
              .select('discovery_data, questions_answered, agency_id')
              .eq('id', scoutCallId).single()

            const disc = callRow?.discovery_data || {}
            disc[field] = value
            if (!disc._confidence) disc._confidence = {}
            disc._confidence[field] = confidence

            const answeredCount = Object.keys(disc).filter(k => !k.startsWith('_')).length

            await s.from('scout_voice_calls').update({
              discovery_data: disc,
              questions_answered: answeredCount,
              updated_at: new Date().toISOString(),
            }).eq('id', scoutCallId)

            // Also log as a scout_call_questions row for the learning loop
            await s.from('scout_call_questions').insert({
              scout_call_id: scoutCallId,
              agency_id: callRow?.agency_id || agencyId,
              question_text: field,
              answer_text: value,
              answered: true,
              sequence: answeredCount,
            })
          } catch (e) { console.error('[scout/webhook] save_discovery_answer error:', e) }
        })()

        return NextResponse.json({ result: 'saved' }, { headers })
      }

      // ── classify_pickup ───────────────────────────────────────
      if (fnName === 'classify_pickup') {
        const classification = String(fnArgs.classification || 'unknown')
        const confidence = typeof fnArgs.confidence === 'number' ? fnArgs.confidence : 70
        const personName = fnArgs.person_name || null
        const personTitle = fnArgs.person_title || null
        const notes = fnArgs.notes || null

        // Map classification to terminal state prefix
        const CLASSIFICATION_TO_STATE: Record<string, string> = {
          dm_direct: 'dm_reached_direct',
          gatekeeper: 'gatekeeper_blocked',     // updated to dm_reached_via_gatekeeper if DM reached later
          ivr: 'ivr_deadend',                   // updated to dm_reached_via_ivr if DM reached later
          wrong_person: 'wrong_person_redirect',
          voicemail: 'voicemail_left',
          unknown: 'unknown',
        }

        if (scoutCallId) {
          void (async () => {
            try {
              const { data: callRow } = await s.from('scout_voice_calls')
                .select('discovery_data, outcome').eq('id', scoutCallId).single()
              const disc = callRow?.discovery_data || {}
              disc._pickup = {
                classification,
                confidence,
                person_name: personName,
                person_title: personTitle,
                notes,
                classified_at: new Date().toISOString(),
              }

              const updates: Record<string, any> = {
                discovery_data: disc,
                updated_at: new Date().toISOString(),
              }

              // Set outcome as initial terminal state (may be refined by later events or post-call analysis)
              if (!callRow?.outcome) {
                updates.outcome = CLASSIFICATION_TO_STATE[classification] || classification
              }

              // If DM reached and we had a prior gatekeeper/IVR classification, upgrade the state
              if (classification === 'dm_direct') {
                const priorClassification = disc._pickup_history?.slice(-1)?.[0]?.classification
                if (priorClassification === 'gatekeeper') {
                  updates.outcome = 'dm_reached_via_gatekeeper'
                } else if (priorClassification === 'ivr') {
                  updates.outcome = 'dm_reached_via_ivr'
                } else {
                  updates.outcome = 'dm_reached_direct'
                }
              }

              // Keep history of all classifications (call may transition: IVR → gatekeeper → DM)
              if (!disc._pickup_history) disc._pickup_history = []
              disc._pickup_history.push({ classification, confidence, at: new Date().toISOString() })
              updates.discovery_data = disc

              await s.from('scout_voice_calls').update(updates).eq('id', scoutCallId)
            } catch (e) { console.error('[scout/webhook] classify_pickup error:', e) }
          })()
        }

        return NextResponse.json({ result: 'classified', classification }, { headers })
      }

      // ── detect_buying_signal ──────────────────────────────────
      if (fnName === 'detect_buying_signal') {
        const signalType = String(fnArgs.signal_type || 'unknown')
        const quote = String(fnArgs.quote || '')

        if (scoutCallId) {
          void (async () => {
            try {
              const { data: callRow } = await s.from('scout_voice_calls')
                .select('discovery_data').eq('id', scoutCallId).single()
              const disc = callRow?.discovery_data || {}
              if (!disc._buying_signals) disc._buying_signals = []
              disc._buying_signals.push({
                type: signalType,
                quote,
                at: new Date().toISOString(),
              })
              await s.from('scout_voice_calls').update({
                discovery_data: disc,
                updated_at: new Date().toISOString(),
              }).eq('id', scoutCallId)
            } catch (e) { console.error('[scout/webhook] detect_buying_signal error:', e) }
          })()
        }

        return NextResponse.json({ result: 'signal_logged' }, { headers })
      }

      // ── set_appointment ───────────────────────────────────────
      if (fnName === 'set_appointment') {
        const whenIso = String(fnArgs.when_iso || '')
        const meetingType = String(fnArgs.meeting_type || 'demo')
        const notes = String(fnArgs.notes || '')

        if (scoutCallId) {
          void (async () => {
            try {
              await s.from('scout_voice_calls').update({
                appointment_set: true,
                follow_up_at: whenIso || null,
                outcome: 'appointment_set',
                updated_at: new Date().toISOString(),
              }).eq('id', scoutCallId)

              // Append appointment details to discovery_data
              const { data: callRow } = await s.from('scout_voice_calls')
                .select('discovery_data, agency_id').eq('id', scoutCallId).single()
              const disc = callRow?.discovery_data || {}
              disc._appointment = { when: whenIso, type: meetingType, notes, set_at: new Date().toISOString() }
              await s.from('scout_voice_calls').update({ discovery_data: disc }).eq('id', scoutCallId)

              // Touch the opportunity if linked
              if (opportunityId) {
                await s.from('koto_opportunity_activities').insert({
                  opportunity_id: opportunityId,
                  agency_id: callRow?.agency_id || agencyId,
                  activity_type: 'appointment_set',
                  title: `${meetingType} booked for ${whenIso || 'TBD'}`,
                  metadata: { scout_call_id: scoutCallId, meeting_type: meetingType, when: whenIso, notes },
                }).then(() => {}, () => {})
              }
            } catch (e) { console.error('[scout/webhook] set_appointment error:', e) }
          })()
        }

        return NextResponse.json({ result: 'appointment_saved' }, { headers })
      }

      // ── dnc_request ───────────────────────────────────────────
      if (fnName === 'dnc_request') {
        const reason = String(fnArgs.reason || 'prospect_request')

        if (scoutCallId) {
          void (async () => {
            try {
              // Mark the call as DNC
              const { data: callRow } = await s.from('scout_voice_calls')
                .select('to_number, agency_id').eq('id', scoutCallId).single()

              await s.from('scout_voice_calls').update({
                outcome: 'dnc_requested',
                updated_at: new Date().toISOString(),
              }).eq('id', scoutCallId)

              // Write opt-out to TCPA records — blocks future calls via tcpaGate
              if (callRow?.to_number && callRow?.agency_id) {
                await s.from('koto_voice_tcpa_records').upsert({
                  agency_id: callRow.agency_id,
                  phone: callRow.to_number,
                  opt_out: true,
                  opt_out_at: new Date().toISOString(),
                  opt_out_source: 'prospect_request',
                  consent_status: 'revoked',
                }, { onConflict: 'agency_id,phone' })
              }

              // Cancel any queued calls for this number
              if (callRow?.to_number && callRow?.agency_id) {
                await s.from('scout_voice_queue').update({ status: 'cancelled' })
                  .eq('agency_id', callRow.agency_id)
                  .eq('contact_phone', callRow.to_number)
                  .in('status', ['pending', 'in_progress'])
              }
            } catch (e) { console.error('[scout/webhook] dnc_request error:', e) }
          })()
        }

        return NextResponse.json({ result: 'dnc_recorded' }, { headers })
      }

      // ── transfer_to_human ─────────────────────────────────────
      if (fnName === 'transfer_to_human') {
        const reason = String(fnArgs.reason || '')

        if (scoutCallId) {
          void (async () => {
            try {
              await s.from('scout_voice_calls').update({
                outcome: 'transferred',
                status: 'escalated',
                updated_at: new Date().toISOString(),
              }).eq('id', scoutCallId)
            } catch (e) { console.error('[scout/webhook] transfer_to_human error:', e) }
          })()
        }

        // Tell Retell to transfer (if agent has transfer_phone configured)
        // Retell handles the actual SIP transfer when we return a transfer action
        return NextResponse.json({ result: 'transfer_requested', reason }, { headers })
      }

      // Unknown function
      console.warn('[scout/voice/webhook] unknown function:', fnName)
      return NextResponse.json({ result: 'unknown_function' }, { headers })
    }

    // ── call_ended ────────────────────────────────────────────────
    if (event === 'call_ended') {
      const transcript = call.transcript || body.transcript || ''
      const recordingUrl = call.recording_url || body.recording_url || null
      const callDuration = call.duration_ms ? Math.round(call.duration_ms / 1000) : null
      const disconnectionReason = call.disconnection_reason || body.disconnection_reason || null
      const now = new Date()

      if (scoutCallId) {
        const { data: scoutCall } = await s.from('scout_voice_calls')
          .select('started_at, status, outcome, company_name, contact_name, industry, agency_id, opportunity_id, persona_id')
          .eq('id', scoutCallId).single()

        const duration = scoutCall?.started_at
          ? Math.round((now.getTime() - new Date(scoutCall.started_at).getTime()) / 1000)
          : 0

        // Finalize call (don't overwrite outcome if already set by a tool)
        const updates: Record<string, any> = {
          status: scoutCall?.status === 'escalated' ? 'escalated' : 'completed',
          ended_at: now.toISOString(),
          duration_seconds: callDuration || duration,
          transcript: transcript || undefined,
          disconnection_reason: disconnectionReason,
          updated_at: now.toISOString(),
        }
        if (recordingUrl) updates.recording_url = recordingUrl
        if (!scoutCall?.outcome) {
          // Infer outcome from call characteristics
          if (duration < 10) updates.outcome = 'no_answer'
          else if (duration < 30 && disconnectionReason === 'voicemail') updates.outcome = 'voicemail'
        }

        await s.from('scout_voice_calls').update(updates).eq('id', scoutCallId)
        await s.from('scout_voice_queue').update({ status: 'completed' }).eq('scout_call_id', scoutCallId)

        // ── Update persona call stats ──
        if (scoutCall?.persona_id) {
          void (async () => {
            try {
              const { data: persona } = await s.from('scout_voice_personas')
                .select('call_count').eq('id', scoutCall.persona_id).single()
              await s.from('scout_voice_personas').update({
                call_count: (persona?.call_count || 0) + 1,
                last_contact_at: now.toISOString(),
              }).eq('id', scoutCall.persona_id)
            } catch { /* non-critical */ }
          })()
        }

        // ── Post-call analysis via Claude ──
        if (ANTHROPIC_API_KEY && transcript && transcript.length > 50) {
          void runPostCallAnalysis(s, scoutCallId, scoutCall, transcript)
        }
      }

      return new Response('OK', { status: 200, headers })
    }

    // ── call_analyzed (Retell built-in) ───────────────────────────
    if (event === 'call_analyzed') {
      if (scoutCallId) {
        const analysis = call.call_analysis || body.call_analysis || null
        if (analysis) {
          await s.from('scout_voice_calls').update({
            conversation_intelligence: analysis,
            updated_at: new Date().toISOString(),
          }).eq('id', scoutCallId)
        }
      }
      return new Response('OK', { status: 200, headers })
    }

    // Unrecognized event — ack silently
    return new Response('OK', { status: 200, headers })
  } catch (e: any) {
    console.error('[scout/voice/webhook] error:', e?.message || e)
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

// ─────────────────────────────────────────────────────────────
// Post-call analysis — runs Claude Haiku on the transcript to
// extract structured insights, sentiment, and a coaching report.
// ─────────────────────────────────────────────────────────────
async function runPostCallAnalysis(
  s: ReturnType<typeof sb>,
  scoutCallId: string,
  scoutCall: any,
  transcript: string,
) {
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
        max_tokens: 1500,
        temperature: 0.1,
        messages: [{ role: 'user', content: `Analyze this outbound cold call transcript. The AI SDR called ${scoutCall?.company_name || 'a prospect'}${scoutCall?.contact_name ? ` (${scoutCall.contact_name})` : ''} in the ${scoutCall?.industry || 'unknown'} industry.

Transcript:
${transcript.slice(0, 6000)}

Return ONLY valid JSON:
{
  "call_summary": "2-3 sentence summary of what happened",
  "outcome_label": "dm_reached_direct | dm_reached_via_gatekeeper | dm_reached_via_ivr | gatekeeper_blocked | wrong_person_redirect | voicemail_left | ivr_deadend | no_answer | opt_out_requested | appointment_set | qualified_no_appointment | not_interested",
  "sentiment": "positive | neutral | negative | hostile",
  "talk_ratio_agent": 0.0 to 1.0,
  "talk_ratio_prospect": 0.0 to 1.0,
  "pain_points_disclosed": ["list of pain points mentioned by prospect"],
  "objections_raised": ["list of objections"],
  "buying_signals": ["list of buying signals"],
  "names_mentioned": ["names of people mentioned"],
  "current_vendor_mentioned": "vendor name or null",
  "budget_signal": "string or null",
  "timeline_signal": "string or null",
  "coaching_notes": ["1-3 specific things the AI agent could improve"],
  "follow_up_recommended": true/false,
  "follow_up_reason": "why or null"
}` }],
      }),
    })

    if (!resp.ok) return

    const data: any = await resp.json()
    const text = data?.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const analysis = JSON.parse(jsonMatch[0])

    const updates: Record<string, any> = {
      post_call_analysis: analysis,
      sentiment: analysis.sentiment || null,
      updated_at: new Date().toISOString(),
    }

    // Set outcome from analysis if not already set by a tool callback
    const { data: current } = await s.from('scout_voice_calls')
      .select('outcome').eq('id', scoutCallId).single()
    if (!current?.outcome && analysis.outcome_label) {
      updates.outcome = analysis.outcome_label
    }

    await s.from('scout_voice_calls').update(updates).eq('id', scoutCallId)

    // Log token usage
    const inputTokens = data?.usage?.input_tokens || 0
    const outputTokens = data?.usage?.output_tokens || 0
    if (inputTokens || outputTokens) {
      logTokenUsage({
        agencyId: scoutCall?.agency_id,
        feature: 'scout_voice_post_call_analysis',
        model: 'claude-haiku-4-5-20251001',
        inputTokens,
        outputTokens,
        metadata: { scout_call_id: scoutCallId },
      }).catch(() => {})
    }
  } catch (e) {
    console.error('[scout/webhook] post-call analysis error:', e)
  }
}
