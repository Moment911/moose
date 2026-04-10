import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enrichCallerData } from '@/lib/preCallIntelligence'
import { buildRetellDynamicVars, fetchDiscoveryBrief } from '@/lib/dynamicPromptBuilder'
import { parseTranscriptIntoQA } from '@/lib/qaIntelligence'
import { triggerFollowUpSequence } from '@/lib/followUpSequencer'
import { createVideoVoicemail } from '@/lib/heygenVideoEngine'

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

            // Push dynamic variables to Retell for this call
            const retellKey = process.env.RETELL_API_KEY
            if (retellKey && Object.keys(dynamicVars).length > 0) {
              fetch(`https://api.retellai.com/v2/calls/${callId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${retellKey}` },
                body: JSON.stringify({ metadata: { pre_call_intel: preCallIntel, dynamic_vars: dynamicVars } }),
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

        // Also update voice lead if exists
        await s.from('koto_voice_leads').update({
          status: answered ? 'answered' : 'no_answer',
          call_duration_seconds: duration,
          recording_url: call.recording_url || '',
          transcript: call.transcript || '',
        }).eq('retell_call_id', callId)

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
