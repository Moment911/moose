// Retell tool handler. The agent calls this URL during a live conversation
// when the caller agrees to a booking. We persist the request, push it to
// the configured calendar webhook (Cal.com / generic), and return a friendly
// message Retell can speak back to the caller.
import { NextRequest, NextResponse } from 'next/server'
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
    // Retell wraps tool args under `args` and includes call context under `call`.
    const args = body?.args || body
    const call = body?.call || {}

    const caller_name = args?.caller_name || ''
    const callback_number = args?.callback_number || call?.from_number || ''
    const callback_email = args?.callback_email || ''
    const appointment_iso = args?.appointment_iso || ''
    const duration_minutes = Number(args?.duration_minutes) || 30
    const reason = args?.reason || ''

    if (!caller_name || !callback_number || !appointment_iso) {
      return NextResponse.json({
        result: 'error',
        message: 'I need a name, callback number, and appointment time to book.',
      })
    }

    const supabase = sb()
    const retellAgentId = call?.agent_id || body?.retell_agent_id

    // Look up the agent by retell_agent_id
    let agentDb: any = null
    if (retellAgentId) {
      const { data } = await supabase
        .from('koto_inbound_agents')
        .select('id, agency_id, business_name, name, calendar_webhook_url, scheduling_link')
        .eq('retell_agent_id', retellAgentId)
        .maybeSingle()
      agentDb = data
    }

    // Persist the booking request — survives even if no calendar is wired.
    const insertCandidate: any = {
      agency_id: agentDb?.agency_id || null,
      agent_id: agentDb?.id || null,
      retell_call_id: call?.call_id || null,
      caller_name,
      callback_number,
      callback_email: callback_email || null,
      appointment_at: appointment_iso,
      duration_minutes,
      reason: reason || null,
      status: 'pending',
    }
    let booking: any = null
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await supabase.from('koto_inbound_bookings').insert(insertCandidate).select().maybeSingle()
      if (!res.error) { booking = res.data; break }
      const m = /Could not find the '([^']+)' column/.exec(res.error.message || '')
      if (m && m[1] in insertCandidate) { delete insertCandidate[m[1]]; continue }
      // Table may not exist yet — fall through and rely on the post-call pipeline
      break
    }

    // Optionally fan out to the configured calendar webhook (Cal.com or generic).
    if (agentDb?.calendar_webhook_url) {
      try {
        await fetch(agentDb.calendar_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'booking_requested',
            booking_id: booking?.id,
            caller_name,
            callback_number,
            callback_email,
            appointment_iso,
            duration_minutes,
            reason,
            business_name: agentDb.business_name || agentDb.name,
          }),
        })
      } catch {}
    }

    const friendlyTime = (() => {
      try {
        return new Date(appointment_iso).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      } catch { return appointment_iso }
    })()

    return NextResponse.json({
      result: 'success',
      booking_id: booking?.id || null,
      message: `Got it — I have you down for ${friendlyTime}. We'll send a confirmation to ${callback_number}${callback_email ? ` and ${callback_email}` : ''}. Anything else I can help with?`,
    })
  } catch (e: any) {
    return NextResponse.json({
      result: 'error',
      message: 'Sorry, I had trouble saving that booking. Let me take down your details and have someone confirm.',
      error: e?.message,
    })
  }
}
