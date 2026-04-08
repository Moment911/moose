import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
        await s.from('koto_voice_calls').upsert({
          retell_call_id: callId,
          status: 'in_progress',
          from_number: call.from_number || '',
          to_number: call.to_number || '',
          start_timestamp: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
          metadata: body,
        }, { onConflict: 'retell_call_id' })
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

        // Also update voice lead if exists
        await s.from('koto_voice_leads').update({
          status: answered ? 'answered' : 'no_answer',
          call_duration_seconds: duration,
          recording_url: call.recording_url || '',
          transcript: call.transcript || '',
        }).eq('retell_call_id', callId)

        // Bill the call
        if (duration > 0) {
          const { data: callRecord } = await s.from('koto_voice_calls').select('agency_id').eq('retell_call_id', callId).single()
          if (callRecord?.agency_id) {
            await fetch(new URL('/api/billing', req.url).toString(), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record_usage', agency_id: callRecord.agency_id,
                feature: 'voice_outbound', quantity: Math.ceil(duration / 60), unit: 'minutes', unit_cost: 0.05,
              }),
            })
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
