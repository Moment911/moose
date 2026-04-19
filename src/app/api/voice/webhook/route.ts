import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enrichCallerData } from '@/lib/preCallIntelligence'
import { buildRetellDynamicVars, fetchDiscoveryBrief } from '@/lib/dynamicPromptBuilder'
import { buildFrontDeskPromptForClient } from '@/lib/frontDeskPromptBuilder'
import { parseTranscriptIntoQA } from '@/lib/qaIntelligence'
import { triggerFollowUpSequence } from '@/lib/followUpSequencer'
import { createVideoVoicemail } from '@/lib/heygenVideoEngine'
import { createNotification } from '@/lib/notifications'
import { syncLeadToGHL, syncCallToGHL, addGHLTags } from '@/lib/goHighLevelSync'
import { touch as scoutTouch } from '@/lib/scout/touchOpportunity'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const s = sb()

    // Log webhook receipt
    await s.from('koto_system_logs').insert({
      level: 'info', service: 'voice_webhook',
      action: body.event || body.type || 'unknown',
      message: `Retell webhook: ${body.event || body.type || 'ping'} — call ${body.call?.call_id || body.call_id || 'N/A'}`,
      metadata: { event: body.event, call_id: body.call?.call_id || body.call_id },
    })

    const event = body.event || body.type || ''
    const call = body.call || body.data || body

    if (!call) {
      return Response.json({ received: true, status: 'no_call_data' }, { status: 200 })
    }

    const callId = call.call_id || call.id || ''

    // Call started
    if (event === 'call_started' || event === 'call_created') {
      if (callId) {
        // Run pre-call intelligence enrichment (non-blocking — don't fail the webhook)
        let preCallIntel = null
        try {
          const callerPhone = call.from_number || call.to_number || ''
          if (callerPhone) {
            preCallIntel = await enrichCallerData(callerPhone)
            const dynamicVars = buildRetellDynamicVars(preCallIntel)

            // Pull discovery brief if a matching engagement exists for this prospect
            try {
              const businessName = call.metadata?.business_name
                || body.metadata?.business_name
                || (preCallIntel as any)?.lead?.prospect_company
                || ''
              const discoveryAgencyId = body.metadata?.agency_id
                || call.metadata?.agency_id
                || (preCallIntel as any)?.lead?.agency_id
                || ''
              if (businessName && discoveryAgencyId) {
                const briefResult = await fetchDiscoveryBrief(discoveryAgencyId, businessName)
                if (briefResult) {
                  ;(dynamicVars as any).discovery_brief = briefResult.brief
                  await s.from('koto_system_logs').insert({
                    level: 'info',
                    service: 'discovery',
                    action: 'retell_brief_injected',
                    message: `Discovery brief injected for ${businessName}`,
                    metadata: { call_id: callId, engagement_id: briefResult.engagement_id, agency_id: discoveryAgencyId },
                  })
                }
              }
            } catch (e: any) {
              console.error('Discovery brief lookup failed (non-fatal):', e?.message)
            }

            // Front desk prompt injection for inbound calls
            let frontDeskClientId: string | null = null
            try {
              const direction = call.direction || call.call_type || ''
              const inboundNumber = call.to_number || ''
              if ((direction === 'inbound' || direction === 'inbound_phone_call') && inboundNumber) {
                // Check koto_front_desk_configs by retell_phone_number
                const { data: fdConfig } = await s.from('koto_front_desk_configs')
                  .select('client_id')
                  .eq('retell_phone_number', inboundNumber)
                  .eq('status', 'active')
                  .maybeSingle()
                if (fdConfig?.client_id) {
                  frontDeskClientId = fdConfig.client_id
                } else {
                  // Fallback: check koto_inbound_agents by phone_number
                  const { data: inboundAgent } = await s.from('koto_inbound_agents')
                    .select('client_id')
                    .eq('phone_number', inboundNumber)
                    .eq('status', 'active')
                    .maybeSingle()
                  if (inboundAgent?.client_id) {
                    // Verify a front desk config exists for this client
                    const { data: fdCheck } = await s.from('koto_front_desk_configs')
                      .select('client_id')
                      .eq('client_id', inboundAgent.client_id)
                      .eq('status', 'active')
                      .maybeSingle()
                    if (fdCheck) frontDeskClientId = inboundAgent.client_id
                  }
                }

                if (frontDeskClientId) {
                  const fdPrompt = await buildFrontDeskPromptForClient(frontDeskClientId)
                  if (fdPrompt) {
                    ;(dynamicVars as any).front_desk_prompt = fdPrompt
                    ;(dynamicVars as any).is_front_desk = 'true'
                    ;(dynamicVars as any).front_desk_client_id = frontDeskClientId
                  }
                }
              }
            } catch (e: any) {
              console.error('Front desk prompt lookup failed (non-fatal):', e?.message)
            }

            // Push dynamic variables to Retell for this call
            const retellKey = process.env.RETELL_API_KEY
            if (retellKey && Object.keys(dynamicVars).length > 0) {
              const patchMetadata: any = { pre_call_intel: preCallIntel, dynamic_vars: dynamicVars }
              if (frontDeskClientId) patchMetadata.front_desk_client_id = frontDeskClientId
              fetch(`https://api.retellai.com/v2/calls/${callId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${retellKey}` },
                body: JSON.stringify({ metadata: patchMetadata }),
              }).catch(() => {}) // fire-and-forget
            }
          }
        } catch (e: any) {
          console.error('Pre-call intel error (non-fatal):', e.message)
        }

        await s.from('koto_voice_calls').upsert({
          retell_call_id: callId,
          status: 'in_progress',
          from_number: call.from_number || '',
          to_number: call.to_number || '',
          start_timestamp: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
          metadata: body,
          pre_call_intel: preCallIntel,
        }, { onConflict: 'retell_call_id' })

        // KotoClose: upsert live call into kc_calls
        const kcAgencyId = body.metadata?.agency_id || call.metadata?.agency_id || null
        if (kcAgencyId) {
          try {
            await s.from('kc_calls').upsert({
              retell_call_id: callId,
              agency_id: kcAgencyId,
              contact_name: call.metadata?.prospect_name || body.metadata?.prospect_name || 'Unknown',
              company_name: call.metadata?.business_name || body.metadata?.business_name || '',
              phone: call.to_number || call.from_number || '',
              status: 'live',
              created_at: new Date().toISOString(),
            }, { onConflict: 'retell_call_id', ignoreDuplicates: false })
          } catch { /* non-fatal */ }
        }
      }
    }

    // Call ended
    if (event === 'call_ended') {
      if (callId) {
        const duration = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0
        const answered = duration > 5

        await s.from('koto_voice_calls').update({
          status: answered ? 'completed' : 'no_answer',
          duration_seconds: duration,
          recording_url: call.recording_url || '',
          transcript: call.transcript || '',
          sentiment: call.call_analysis?.user_sentiment || 'neutral',
          end_timestamp: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : new Date().toISOString(),
          call_analysis: call.call_analysis || {},
          metadata: body,
        }).eq('retell_call_id', callId)

        // KotoClose: update kc_calls with final outcome
        {
          const kcAgencyId = body.metadata?.agency_id || call.metadata?.agency_id || null
          const sentiment = call.call_analysis?.user_sentiment
          const sentimentScore = sentiment === 'Positive' ? 85 : sentiment === 'Negative' ? 25 : 55
          const isVoicemail = call.disconnection_reason === 'voicemail_reached' || call.call_type === 'voicemail_detected'
          try {
            await s.from('kc_calls').upsert({
              retell_call_id: callId,
              agency_id: kcAgencyId || null,
              contact_name: call.call_analysis?.custom_analysis_data?.contact_name ?? call.metadata?.prospect_name ?? body.metadata?.prospect_name ?? 'Unknown',
              company_name: call.call_analysis?.custom_analysis_data?.company_name ?? call.metadata?.business_name ?? body.metadata?.business_name ?? '',
              phone: call.to_number || call.from_number || '',
              duration_seconds: duration,
              status: isVoicemail ? 'voicemail' : !answered ? 'no_answer' : 'completed',
              outcome: call.call_analysis?.call_summary ?? '',
              opted_in: call.call_analysis?.custom_analysis_data?.opted_in ?? false,
              appointment_set: call.call_analysis?.custom_analysis_data?.appointment_set ?? false,
              sentiment_score: sentimentScore,
              intelligence_score: sentimentScore,
              stage_reached: call.call_analysis?.custom_analysis_data?.stage_reached ?? 'Unknown',
              ghl_synced: false,
              recording_url: call.recording_url ?? null,
              transcript: call.transcript ?? null,
            }, { onConflict: 'retell_call_id', ignoreDuplicates: false })
          } catch { /* non-fatal */ }
        }

        // Scout: record the call onto the unified opportunity spine.
        // Non-fatal — telemetry must never fail the webhook.
        try {
          const scoutAgencyId = body.metadata?.agency_id || call.metadata?.agency_id
          if (scoutAgencyId) {
            const direction = (call.direction || '').toLowerCase()
            const isInbound = direction === 'inbound'
            const isVoicemail = call.disconnection_reason === 'voicemail_reached' || call.call_type === 'voicemail_detected'
            const activityType = isVoicemail
              ? 'call_voicemail'
              : !answered
                ? 'call_missed'
                : isInbound ? 'call_inbound' : 'call_outbound'

            const contactPhone = isInbound ? (call.from_number || '') : (call.to_number || '')
            const companyName = call.call_analysis?.custom_analysis_data?.company_name
              || call.metadata?.business_name
              || body.metadata?.business_name
              || undefined
            const contactName = call.call_analysis?.custom_analysis_data?.contact_name
              || call.metadata?.prospect_name
              || body.metadata?.prospect_name
              || undefined

            const summary = call.call_analysis?.call_summary || ''
            const sentiment = call.call_analysis?.user_sentiment || 'neutral'

            await scoutTouch({
              agencyId: scoutAgencyId,
              source: isInbound ? 'inbound_call' : 'voice_call',
              voiceCallId: callId || undefined,
              contactPhone: contactPhone || undefined,
              companyName,
              contactName,
              activityType,
              description: summary ? summary.slice(0, 280) : undefined,
              metadata: {
                retell_call_id: callId,
                duration_seconds: duration,
                sentiment,
                disconnection_reason: call.disconnection_reason || null,
                transcript: call.transcript || null,
                recording_url: call.recording_url || null,
                appointment_set: call.call_analysis?.custom_analysis_data?.appointment_set ?? null,
                stage_reached: call.call_analysis?.custom_analysis_data?.stage_reached ?? null,
              },
            })
          }
        } catch { /* non-fatal — scout telemetry must not break webhook */ }

        // Also update voice lead if exists
        await s.from('koto_voice_leads').update({
          status: answered ? 'answered' : 'no_answer',
          call_duration_seconds: duration,
          recording_url: call.recording_url || '',
          transcript: call.transcript || '',
        }).eq('retell_call_id', callId)

        // Increment front desk total_calls if this was a front desk call
        {
          const fdClientId = call.metadata?.front_desk_client_id || body.metadata?.front_desk_client_id
          if (fdClientId) {
            try {
              const { data: fdRow } = await s.from('koto_front_desk_configs')
                .select('total_calls')
                .eq('client_id', fdClientId)
                .maybeSingle()
              if (fdRow != null) {
                await s.from('koto_front_desk_configs')
                  .update({ total_calls: (fdRow.total_calls || 0) + 1 })
                  .eq('client_id', fdClientId)
              }
            } catch { /* non-fatal */ }

            // Auto-create call record in koto_front_desk_calls with recording
            try {
              const agencyId_ = call.metadata?.agency_id || body.metadata?.agency_id
              const callerPhone_ = call.from_number || ''
              const callerName_ = call.caller_name || call.call_analysis?.custom_analysis_data?.caller_name || ''
              const outcome_ = call.call_analysis?.custom_analysis_data?.call_outcome || call.disconnection_reason || 'completed'
              const appointmentSet_ = call.call_analysis?.custom_analysis_data?.appointment_set === true || call.call_analysis?.call_successful === true
              const durationSec = call.end_timestamp && call.start_timestamp
                ? Math.round((new Date(call.end_timestamp).getTime() - new Date(call.start_timestamp).getTime()) / 1000) : 0

              const { data: fdCfg } = await s.from('koto_front_desk_configs').select('id').eq('client_id', fdClientId).maybeSingle()

              await s.from('koto_front_desk_calls').insert({
                config_id: fdCfg?.id || null,
                agency_id: agencyId_,
                client_id: fdClientId,
                retell_call_id: call.call_id || body.call_id || null,
                caller_phone: callerPhone_,
                caller_name: callerName_,
                direction: 'inbound',
                duration_seconds: durationSec,
                outcome: appointmentSet_ ? 'appointment' : outcome_,
                sentiment: call.call_analysis?.user_sentiment || 'neutral',
                transcript: call.transcript || null,
                ai_summary: call.call_analysis?.call_summary || null,
                recording_url: call.recording_url || null,
                ghl_synced: false,
              })
            } catch { /* non-fatal */ }

            // Push front desk caller to GHL as a contact
            try {
              const agencyId = call.metadata?.agency_id || body.metadata?.agency_id
              if (agencyId) {
                const callerPhone = call.from_number || ''
                const callerName = call.caller_name || call.call_analysis?.custom_analysis_data?.caller_name || ''
                const outcome = call.call_analysis?.custom_analysis_data?.call_outcome || call.disconnection_reason || 'completed'
                const appointmentSet = call.call_analysis?.custom_analysis_data?.appointment_set === true
                  || call.call_analysis?.call_successful === true

                const ghlContactId = await syncLeadToGHL(agencyId, {
                  prospect_name: callerName,
                  prospect_phone: callerPhone,
                  prospect_company: '',
                  lead_score: appointmentSet ? 90 : 50,
                  industry_sic_code: '',
                })

                if (ghlContactId) {
                  // Sync the call record
                  await syncCallToGHL(agencyId, {
                    direction: 'inbound',
                    duration: call.end_timestamp && call.start_timestamp
                      ? Math.round((new Date(call.end_timestamp).getTime() - new Date(call.start_timestamp).getTime()) / 1000)
                      : 0,
                    outcome,
                    transcript: call.transcript || '',
                  }, ghlContactId)

                  // Tag the contact
                  const tags = ['koto-front-desk', `client-${fdClientId}`]
                  if (appointmentSet) tags.push('appointment-booked')
                  await addGHLTags(agencyId, ghlContactId, tags)
                }
              }
            } catch { /* GHL sync is non-fatal */ }

            // Post-call auto-SMS via GHL
            try {
              const agencyId = call.metadata?.agency_id || body.metadata?.agency_id
              const callerPhone = call.from_number || ''
              if (agencyId && callerPhone) {
                const { data: fdCfg } = await s.from('koto_front_desk_configs')
                  .select('sms_post_call_enabled, sms_post_call_template, sms_missed_call_enabled, sms_missed_call_template, company_name, phone, website, scheduling_link')
                  .eq('client_id', fdClientId).maybeSingle()

                const durationSec = call.end_timestamp && call.start_timestamp
                  ? Math.round((new Date(call.end_timestamp).getTime() - new Date(call.start_timestamp).getTime()) / 1000) : 0
                const wasMissed = durationSec < 5 || call.disconnection_reason === 'no_answer'

                let smsTemplate = ''
                let smsType = ''
                if (wasMissed && fdCfg?.sms_missed_call_enabled) {
                  smsTemplate = fdCfg.sms_missed_call_template || 'Hi! We missed your call at {company}. Call us back at {phone} or schedule online: {scheduling_link}'
                  smsType = 'missed_call'
                } else if (!wasMissed && fdCfg?.sms_post_call_enabled) {
                  smsTemplate = fdCfg.sms_post_call_template || 'Thanks for calling {company}! If you need anything, call us at {phone} or visit {website}'
                  smsType = 'post_call'
                }

                if (smsTemplate) {
                  const smsMsg = smsTemplate
                    .replace(/\{company\}/g, fdCfg?.company_name || '')
                    .replace(/\{phone\}/g, fdCfg?.phone || '')
                    .replace(/\{website\}/g, fdCfg?.website || '')
                    .replace(/\{scheduling_link\}/g, fdCfg?.scheduling_link || fdCfg?.website || '')
                    .replace(/\{caller_name\}/g, call.caller_name || '')

                  // Send via GHL if connected
                  const { data: ghlMap } = await s.from('koto_ghl_client_mappings')
                    .select('access_token, ghl_location_id')
                    .eq('client_id', fdClientId).eq('status', 'active').maybeSingle()

                  if (ghlMap?.access_token) {
                    // Find or create contact
                    const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlMap.ghl_location_id}&phone=${encodeURIComponent(callerPhone)}`, {
                      headers: { 'Authorization': `Bearer ${ghlMap.access_token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
                    })
                    const searchData = await searchRes.json()
                    const ghlCid = searchData?.contacts?.[0]?.id
                    if (ghlCid) {
                      await fetch('https://services.leadconnectorhq.com/conversations/messages', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${ghlMap.access_token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
                        body: JSON.stringify({ type: 'SMS', contactId: ghlCid, message: smsMsg, locationId: ghlMap.ghl_location_id }),
                      })
                    }
                  }

                  // Log the SMS
                  await s.from('koto_front_desk_sms').insert({
                    agency_id: agencyId, client_id: fdClientId,
                    direction: 'outbound', to_number: callerPhone,
                    message: smsMsg, message_type: smsType, ai_generated: false,
                    status: 'sent', sent_via: 'ghl',
                  })
                }
              }
            } catch { /* post-call SMS is non-fatal */ }
          }
        }

        // Notifications — fire after the core state updates
        {
          const notifAgencyId = body.metadata?.agency_id || call.metadata?.agency_id || null
          const appointmentSet = call.call_analysis?.custom_analysis_data?.appointment_set === true
            || call.call_analysis?.call_successful === true
          if (notifAgencyId && appointmentSet) {
            createNotification(
              s, notifAgencyId, 'appointment_set',
              '🎯 Appointment set!',
              'New appointment booked from voice call',
              '/voice', '🎯',
              { call_id: callId },
            ).catch(() => {})
          }
          if (notifAgencyId && duration > 60 && answered) {
            createNotification(
              s, notifAgencyId, 'call_completed',
              '📞 Call completed',
              `${Math.round(duration / 60)}min call completed`,
              '/voice/live', '📞',
              { call_id: callId, duration_seconds: duration },
            ).catch(() => {})
          }
        }

        // Bill the call + parse Q&A intelligence
        if (duration > 0) {
          const { data: callRecord } = await s.from('koto_voice_calls').select('id, agency_id, campaign_id, lead_id').eq('retell_call_id', callId).single()
          if (callRecord?.agency_id) {
            await fetch(new URL('/api/billing', req.url).toString(), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record_usage', agency_id: callRecord.agency_id,
                feature: 'voice_outbound', quantity: Math.ceil(duration / 60), unit: 'minutes', unit_cost: 0.05,
              }),
            })
          }

          // Parse Q&A from transcript into intelligence database (non-blocking)
          const transcript = call.transcript || ''
          if (transcript && callRecord?.id) {
            const leadId = callRecord.lead_id || ''
            let sicCode = 'unknown'
            if (leadId) {
              const { data: lead } = await s.from('koto_voice_leads').select('industry_sic_code').eq('id', leadId).maybeSingle()
              if (lead?.industry_sic_code) sicCode = lead.industry_sic_code
            }
            parseTranscriptIntoQA(
              transcript,
              callRecord.id,
              callRecord.agency_id || '',
              sicCode,
              {
                appointment_set: call.call_analysis?.call_successful === true,
                lead_score: call.call_analysis?.lead_score || 50,
                duration_seconds: duration,
                campaign_id: callRecord.campaign_id,
                lead_id: leadId,
              }
            ).catch(e => console.error('QA parse error (non-fatal):', e.message))
          }

          // Trigger follow-up sequence based on outcome (non-blocking)
          if (callRecord?.lead_id && callRecord?.agency_id) {
            const trigger = call.call_analysis?.call_successful ? 'appointment_set' :
                           call.call_analysis?.callback_requested ? 'callback_requested' :
                           duration < 5 ? 'no_answer' : 'not_interested'
            const { data: leadData } = await s.from('koto_voice_leads').select('*').eq('id', callRecord.lead_id).maybeSingle()
            if (leadData) {
              triggerFollowUpSequence(trigger, leadData, callRecord.agency_id, callRecord.campaign_id)
                .catch(e => console.error('Follow-up trigger error (non-fatal):', e.message))
            }
          }
        }
      }
    }

    // Call analyzed (voicemail, sentiment, etc.)
    if (event === 'call_analyzed') {
      if (callId) {
        const updates: Record<string, any> = { metadata: body }
        if (call.call_analysis) updates.call_analysis = call.call_analysis
        if (call.call_analysis?.user_sentiment) updates.sentiment = call.call_analysis.user_sentiment
        if (call.call_type === 'voicemail_detected') updates.status = 'voicemail'

        await s.from('koto_voice_calls').update(updates).eq('retell_call_id', callId)

        // Auto-generate video voicemail if voicemail detected and lead has email
        if (call.call_type === 'voicemail_detected') {
          const { data: callRecord } = await s.from('koto_voice_calls').select('agency_id, lead_id').eq('retell_call_id', callId).maybeSingle()
          if (callRecord?.lead_id) {
            const { data: lead } = await s.from('koto_voice_leads').select('*').eq('id', callRecord.lead_id).maybeSingle()
            if (lead?.prospect_email) {
              createVideoVoicemail(lead, callRecord.agency_id, { emailTo: lead.prospect_email })
                .catch(e => console.error('Video voicemail error (non-fatal):', e.message))
            }
          }
        }
      }
    }

    // Always return 200 — Retell requires this
    return Response.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error('Retell webhook error:', error.message)
    // Return 200 even on error to prevent Retell from retrying
    return Response.json({ received: true, error: error.message }, { status: 200 })
  }
}

// GET handler for webhook validation/ping
export async function GET() {
  return Response.json({ status: 'ok', webhook: 'voice', timestamp: new Date().toISOString() }, { status: 200 })
}
