import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Retell custom tool webhook: send_sms ────────────────────────────────────
// Called by Retell when Jenny triggers the send_sms tool during a call.
// Sends via Twilio (direct) or GHL (if connected).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Retell sends tool calls in this format
    const args = body.args || body.arguments || body
    const phone_number = args.phone_number || ''
    const message = args.message || ''
    const link_type = args.link_type || 'general'
    const callId = body.call_id || body.call?.call_id || ''

    if (!phone_number || !message) {
      return NextResponse.json({ result: 'I need the phone number to send that text. Could you give me your cell number?' })
    }

    // Clean phone number
    const cleanPhone = phone_number.replace(/[^\d+]/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ result: 'That phone number doesn\'t look right. Could you repeat it for me?' })
    }

    let sent = false
    let method = ''

    // Try GHL first if configured (check by looking up the call's client)
    const s = sb()
    let ghlSent = false
    try {
      // Look up which client this call belongs to via metadata or call record
      if (callId) {
        const { data: voiceCall } = await s.from('koto_voice_calls').select('metadata').eq('retell_call_id', callId).maybeSingle()
        const fdClientId = voiceCall?.metadata?.front_desk_client_id
        if (fdClientId) {
          const { data: ghlMapping } = await s.from('koto_ghl_client_mappings')
            .select('access_token, ghl_location_id')
            .eq('client_id', fdClientId)
            .eq('status', 'active')
            .maybeSingle()

          if (ghlMapping?.access_token) {
            // Send via GHL
            // First find or create contact by phone
            const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlMapping.ghl_location_id}&phone=${encodeURIComponent(cleanPhone)}`, {
              headers: { 'Authorization': `Bearer ${ghlMapping.access_token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
            })
            const searchData = await searchRes.json()
            let contactId = searchData?.contacts?.[0]?.id

            if (!contactId) {
              // Create contact
              const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ghlMapping.access_token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
                body: JSON.stringify({ locationId: ghlMapping.ghl_location_id, phone: cleanPhone, source: 'Koto Front Desk' }),
              })
              const createData = await createRes.json()
              contactId = createData?.contact?.id
            }

            if (contactId) {
              await fetch('https://services.leadconnectorhq.com/conversations/messages', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ghlMapping.access_token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
                body: JSON.stringify({ type: 'SMS', contactId, message, locationId: ghlMapping.ghl_location_id }),
              })
              ghlSent = true
              sent = true
              method = 'ghl'
            }
          }
        }
      }
    } catch { /* GHL send failed, fall through to Twilio */ }

    // Fallback: send via Twilio
    if (!sent) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_PHONE_NUMBER

      if (accountSid && authToken && fromNumber) {
        const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: cleanPhone, From: fromNumber, Body: message }),
        })
        if (twilioRes.ok) {
          sent = true
          method = 'twilio'
        }
      }
    }

    // Log the SMS send
    try {
      await s.from('koto_front_desk_calls').update({
        links_sent: s.rpc ? undefined : undefined, // TODO: append to links_sent jsonb
      }).eq('retell_call_id', callId)
    } catch {}

    if (sent) {
      return NextResponse.json({ result: `Text sent successfully to ${cleanPhone}. Let the caller know it's on its way.` })
    } else {
      return NextResponse.json({ result: 'I wasn\'t able to send the text right now, but I\'ll make sure the office follows up with that link. Let the caller know someone will text it to them shortly.' })
    }

  } catch (e: any) {
    return NextResponse.json({ result: 'I had trouble sending that text, but I\'ll make sure the office follows up with the information.' })
  }
}
