import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'
import { logTokenUsage } from '@/lib/tokenTracker'

// ─────────────────────────────────────────────────────────────
// VOB Voice Webhook — handles Retell events for outbound
// insurance verification calls.
//
// Unlike onboarding (inbound), VOB calls are OUTBOUND — Koto
// calls the insurance company. No call_inbound handler needed.
//
// Events:
//   call_started  — call connected, update status
//   function_call — save_vob_answer, navigate_ivr, escalate_call, end_call
//   call_ended    — post-call analysis via Claude, extract knowledge
// ─────────────────────────────────────────────────────────────

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function safeJson(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}

// ── CORS preflight ──
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

    // Extract VOB call context from metadata
    const vobCallId = metadata.vob_call_id || null
    const agencyId = metadata.agency_id || null
    const patientId = metadata.patient_id || null
    const carrierName = metadata.carrier_name || null

    console.log('[vob/voice] event:', event, 'callId:', callId, 'vobCallId:', vobCallId)

    // ── call_started / call_created ─────────────────────────────
    if (event === 'call_started' || event === 'call_created') {
      if (vobCallId) {
        await s.from('vob_calls').update({
          status: 'ivr',
          retell_call_id: callId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', vobCallId)

        // Notification
        if (agencyId) {
          createNotification(s, agencyId, 'vob_call_started', 'VOB call started',
            `Calling ${carrierName} for ${patientId}`, '/vob', '📞',
            { vob_call_id: vobCallId, carrier: carrierName }
          ).catch(() => {})
        }
      }
      return new Response('OK', { status: 200, headers })
    }

    // ── Function calls ──────────────────────────────────────────
    const fnName: string = body.name || body.fn_name || body.function?.name || call.name || ''
    const rawArgs: any = body.args ?? body.arguments ?? body.function?.arguments ?? call.arguments ?? {}
    const fnArgs: any = typeof rawArgs === 'string' ? safeJson(rawArgs) : (rawArgs || {})

    const isFunctionCall = !!fnName && (
      event === 'function_call' || event === 'tool_call' ||
      body.type === 'function_call' || (!event && !body.call_inbound)
    )

    if (isFunctionCall) {
      console.log('[vob/voice] function_call:', fnName, 'args:', JSON.stringify(fnArgs).slice(0, 300))

      // ── save_vob_answer ──
      if (fnName === 'save_vob_answer') {
        const field = String(fnArgs.field || '').trim()
        const value = String(fnArgs.value || '').trim()
        const confidence = typeof fnArgs.confidence === 'number' ? fnArgs.confidence : 85

        if (!field || !vobCallId) {
          return NextResponse.json({ success: false, error: 'Missing field or call context' })
        }

        // Fire-and-forget: update vob_data jsonb
        void (async () => {
          try {
            const { data: call } = await s.from('vob_calls').select('vob_data, questions_answered').eq('id', vobCallId).single()
            const vobData = call?.vob_data || {}
            vobData[field] = value
            // Also store confidence
            if (!vobData._confidence) vobData._confidence = {}
            vobData._confidence[field] = confidence

            await s.from('vob_calls').update({
              vob_data: vobData,
              questions_answered: Object.keys(vobData).filter(k => !k.startsWith('_')).length,
              status: 'speaking',
              updated_at: new Date().toISOString(),
            }).eq('id', vobCallId)
          } catch (e) { console.error('[vob] save_vob_answer error:', e) }
        })()

        return NextResponse.json({ result: 'saved', field, value })
      }

      // ── navigate_ivr ──
      if (fnName === 'navigate_ivr') {
        const action = String(fnArgs.action || '').trim()
        const description = String(fnArgs.description || '').trim()

        if (vobCallId) {
          void (async () => {
            try {
              const { data: call } = await s.from('vob_calls').select('ivr_log').eq('id', vobCallId).single()
              const log = call?.ivr_log || []
              log.push({ action, description, at: new Date().toISOString() })
              await s.from('vob_calls').update({
                ivr_log: log,
                status: 'ivr',
                updated_at: new Date().toISOString(),
              }).eq('id', vobCallId)
            } catch (e) { console.error('[vob] navigate_ivr error:', e) }
          })()
        }

        return NextResponse.json({ result: 'logged', action })
      }

      // ── escalate_call ──
      if (fnName === 'escalate_call') {
        const reason = String(fnArgs.reason || '').trim()

        if (vobCallId) {
          await s.from('vob_calls').update({
            status: 'escalated',
            error_message: `Escalated: ${reason}`,
            updated_at: new Date().toISOString(),
          }).eq('id', vobCallId)

          if (agencyId) {
            createNotification(s, agencyId, 'vob_escalated', 'VOB call escalated',
              `${carrierName}: ${reason}`, '/vob', '⚠️',
              { vob_call_id: vobCallId, reason }
            ).catch(() => {})
          }
        }

        return NextResponse.json({ result: 'escalated', reason })
      }

      // ── end_call ──
      if (fnName === 'end_call') {
        const reason = String(fnArgs.reason || 'completed').trim()
        const summary = String(fnArgs.summary || '').trim()

        if (vobCallId) {
          const now = new Date()
          const { data: call } = await s.from('vob_calls').select('started_at').eq('id', vobCallId).single()
          const duration = call?.started_at ? Math.round((now.getTime() - new Date(call.started_at).getTime()) / 1000) : 0

          await s.from('vob_calls').update({
            status: reason === 'escalated' ? 'escalated' : 'completed',
            ended_at: now.toISOString(),
            duration_seconds: duration,
            updated_at: now.toISOString(),
          }).eq('id', vobCallId)

          await s.from('vob_queue').update({ status: reason === 'escalated' ? 'failed' : 'completed' }).eq('vob_call_id', vobCallId)
        }

        return NextResponse.json({ result: 'ending call', action: 'end_call' })
      }

      // Unknown function
      console.warn('[vob/voice] unknown function:', fnName)
      return NextResponse.json({ result: 'unknown function' })
    }

    // ── call_ended — post-call analysis ─────────────────────────
    if (event === 'call_ended') {
      const transcript = call.transcript || body.transcript || ''
      const recordingUrl = call.recording_url || body.recording_url || null
      const callDuration = call.duration_ms ? Math.round(call.duration_ms / 1000) : null
      const now = new Date()

      if (vobCallId) {
        // Calculate duration
        const { data: vobCall } = await s.from('vob_calls').select('started_at, vob_data, carrier_name, level_of_care, status').eq('id', vobCallId).single()
        const duration = vobCall?.started_at ? Math.round((now.getTime() - new Date(vobCall.started_at).getTime()) / 1000) : 0

        // Finalize call if not already
        if (vobCall?.status !== 'completed' && vobCall?.status !== 'escalated') {
          await s.from('vob_calls').update({
            status: 'completed',
            ended_at: now.toISOString(),
            duration_seconds: callDuration || duration,
            transcript,
            ...(recordingUrl ? { recording_url: recordingUrl } : {}),
            updated_at: now.toISOString(),
          }).eq('id', vobCallId)

          await s.from('vob_queue').update({ status: 'completed' }).eq('vob_call_id', vobCallId)
        } else {
          // Just save transcript + recording
          await s.from('vob_calls').update({
            transcript,
            duration_seconds: callDuration || duration,
            ...(recordingUrl ? { recording_url: recordingUrl } : {}),
            updated_at: now.toISOString(),
          }).eq('id', vobCallId)
        }

        // Update carrier stats
        if (vobCall?.carrier_name) {
          void (async () => {
            try {
              const { data: carrier } = await s.from('vob_carriers').select('call_count, avg_call_duration_seconds')
                .ilike('carrier_name', `%${vobCall.carrier_name}%`).maybeSingle()
              if (carrier) {
                const newCount = (carrier.call_count || 0) + 1
                const newAvg = Math.round(((carrier.avg_call_duration_seconds || 0) * (carrier.call_count || 0) + duration) / newCount)
                await s.from('vob_carriers').update({
                  call_count: newCount,
                  avg_call_duration_seconds: newAvg,
                  last_called_at: now.toISOString(),
                  updated_at: now.toISOString(),
                }).ilike('carrier_name', `%${vobCall.carrier_name}%`)
              }
            } catch (e) { console.warn('[vob] carrier stats update error:', e) }
          })()
        }

        // ── Post-call analysis via Claude ──
        const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
        if (ANTHROPIC_KEY && transcript) {
          void (async () => {
            try {
              const vobData = vobCall?.vob_data || {}
              const answeredFields = Object.keys(vobData).filter(k => !k.startsWith('_'))

              const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 1200,
                  messages: [{ role: 'user', content: `Analyze this insurance benefits verification call transcript. The agent called ${vobCall?.carrier_name || 'an insurance company'} to verify ${vobCall?.level_of_care || 'behavioral health'} benefits.

Transcript:
${transcript.slice(0, 4000)}

VOB fields answered: ${answeredFields.join(', ')}

Return JSON:
{
  "call_summary": "2-3 sentence summary of what was verified",
  "completeness_score": 0-100,
  "rep_name": "name if mentioned",
  "reference_number": "ref# if mentioned",
  "hold_time_estimate_seconds": number,
  "ivr_steps_taken": number,
  "carrier_insights": ["insight about this carrier's process"],
  "answer_patterns": [{"raw": "what rep said", "normalized": "structured value", "field": "vob_field_name"}],
  "denial_risk_factors": ["any red flags for claim denial"],
  "denial_risk_score": 0-100,
  "missing_critical_fields": ["fields that should have been asked"],
  "revenue_estimate": {"gross": number, "net": number, "confidence": 0-100},
  "follow_up_needed": boolean,
  "follow_up_reason": "why"
}` }],
                }),
              })

              if (aiRes.ok) {
                const aiData = await aiRes.json()
                const text = aiData?.content?.[0]?.text || ''
                const jsonMatch = text.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                  const analysis = JSON.parse(jsonMatch[0])

                  // Update call with analysis
                  const updates: any = {
                    post_call_analysis: analysis,
                    updated_at: new Date().toISOString(),
                  }
                  if (analysis.rep_name) updates.rep_name = analysis.rep_name
                  if (analysis.reference_number) updates.reference_number = analysis.reference_number
                  if (analysis.revenue_estimate) updates.revenue_forecast = analysis.revenue_estimate
                  if (analysis.hold_time_estimate_seconds) updates.hold_time_seconds = analysis.hold_time_estimate_seconds

                  await s.from('vob_calls').update(updates).eq('id', vobCallId)

                  // Extract knowledge entries
                  if (analysis.carrier_insights?.length > 0 && agencyId) {
                    for (const insight of analysis.carrier_insights) {
                      await s.from('vob_knowledge').insert({
                        agency_id: agencyId,
                        carrier_name: vobCall?.carrier_name || 'Unknown',
                        knowledge_type: 'carrier_insight',
                        title: insight.slice(0, 100),
                        content: { insight, from_call: vobCallId, extracted_at: now.toISOString() },
                        confidence: 0.7,
                        source_call_id: vobCallId,
                      })
                    }
                  }

                  // Extract answer patterns
                  if (analysis.answer_patterns?.length > 0 && agencyId) {
                    for (const pattern of analysis.answer_patterns) {
                      await s.from('vob_knowledge').insert({
                        agency_id: agencyId,
                        carrier_name: vobCall?.carrier_name || 'Unknown',
                        knowledge_type: 'answer_pattern',
                        title: `${pattern.field}: "${pattern.raw}" → ${pattern.normalized}`,
                        content: pattern,
                        confidence: 0.8,
                        source_call_id: vobCallId,
                      })
                    }
                  }

                  // Log token usage
                  logTokenUsage({
                    agencyId: agencyId || undefined,
                    feature: 'vob_post_call_analysis',
                    model: 'claude-haiku-4-5-20251001',
                    inputTokens: aiData.usage?.input_tokens || 0,
                    outputTokens: aiData.usage?.output_tokens || 0,
                  }).catch(() => {})
                }
              }

              // Notification
              if (agencyId) {
                createNotification(s, agencyId, 'vob_complete', 'VOB call completed',
                  `${vobCall?.carrier_name} · ${answeredFields.length} fields verified · ${Math.round(duration / 60)}m`,
                  '/vob', '✅', { vob_call_id: vobCallId }
                ).catch(() => {})
              }
            } catch (e) { console.warn('[vob] post-call analysis error:', e) }
          })()
        }
      }

      return new Response('OK', { status: 200, headers })
    }

    // Default — return OK for any unhandled event
    return new Response('OK', { status: 200, headers })
  } catch (e: any) {
    console.error('[vob/voice] webhook error:', e)
    return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}
