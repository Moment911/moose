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

    if (!message) {
      return NextResponse.json({ result: 'Tell the caller you will have the office text them the information shortly.' })
    }

    if (!phone_number) {
      return NextResponse.json({ result: 'Ask the caller: "What number should I text that to?"' })
    }

    // Clean phone number — handle various formats
    let cleanPhone = phone_number.replace(/[^\d+]/g, '')
    if (cleanPhone.startsWith('+1')) cleanPhone = cleanPhone.slice(2)
    if (cleanPhone.startsWith('1') && cleanPhone.length === 11) cleanPhone = cleanPhone.slice(1)
    if (cleanPhone.length === 10) cleanPhone = '+1' + cleanPhone
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+1' + cleanPhone

    if (cleanPhone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ result: 'That number doesn\'t seem right. Ask the caller to repeat their cell phone number.' })
    }

    let sent = false
    let method = ''

    // Try GHL first — find the client by call ID or by any active front desk config
    const s = sb()
    try {
      // Strategy 1: Look up via call metadata
      let fdClientId: string | null = null
      if (callId) {
        const { data: voiceCall } = await s.from('koto_voice_calls').select('metadata').eq('retell_call_id', callId).maybeSingle()
        fdClientId = voiceCall?.metadata?.front_desk_client_id || null
      }

      // Strategy 2: Find any active front desk config with a GHL connection
      if (!fdClientId) {
        const { data: activeFd } = await s.from('koto_front_desk_configs')
          .select('client_id')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        fdClientId = activeFd?.client_id || null
      }

      if (fdClientId) {
        const { data: ghlMapping } = await s.from('koto_ghl_client_mappings')
          .select('access_token, ghl_location_id')
          .eq('client_id', fdClientId)
          .eq('status', 'active')
          .maybeSingle()

        const ghlToken = ghlMapping?.access_token || process.env.GHL_CLIENT_ID || process.env.NEXT_PUBLIC_GHL_CLIENT_ID || ''
        const ghlLocationId = ghlMapping?.ghl_location_id || 'Xu2LSpn2q4nNtk3YMGOU'
        if (ghlToken) {
          // Find or create contact by phone in GHL
          const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(cleanPhone)}`, {
            headers: { 'Authorization': `Bearer ${ghlToken}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
          })
          const searchData = await searchRes.json()
          let contactId = searchData?.contacts?.[0]?.id

          if (!contactId) {
            const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${ghlToken}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
              body: JSON.stringify({ locationId: ghlLocationId, phone: cleanPhone, source: 'Koto Front Desk' }),
            })
            const createData = await createRes.json()
            contactId = createData?.contact?.id
          }

          if (contactId) {
            const smsRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${ghlToken}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
              body: JSON.stringify({ type: 'SMS', contactId, message, locationId: ghlLocationId }),
            })
            const smsData = await smsRes.json().catch(() => ({}))
            if (smsRes.ok) {
              sent = true
              method = 'ghl'
            } else {
              method = `ghl_error_${smsRes.status}: ${JSON.stringify(smsData).slice(0,200)}`
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

    // Log the SMS send to the call record
    if (sent && callId) {
      try {
        const { data: callRow } = await s.from('koto_front_desk_calls').select('links_sent').eq('retell_call_id', callId).maybeSingle()
        const existing = Array.isArray(callRow?.links_sent) ? callRow.links_sent : []
        existing.push({ type: link_type, message, phone: cleanPhone, method, sent_at: new Date().toISOString() })
        await s.from('koto_front_desk_calls').update({ links_sent: existing }).eq('retell_call_id', callId)
      } catch {}
    }

    if (sent) {
      return NextResponse.json({ result: 'Text sent! Let the caller know: "I just sent that over to you — you should see it in a moment."' })
    } else {
      // Debug: return why it failed (temporarily)
      // Collect debug info
      let debugInfo: any = { sent, method }
      try {
        const { data: activeFd } = await s.from('koto_front_desk_configs').select('client_id, status').eq('status', 'active').limit(1).maybeSingle()
        debugInfo.activeFd = activeFd
        if (activeFd?.client_id) {
          const { data: gm } = await s.from('koto_ghl_client_mappings').select('access_token, ghl_location_id, status').eq('client_id', activeFd.client_id).maybeSingle()
          debugInfo.ghlMapping = { hasToken: !!gm?.access_token, locationId: gm?.ghl_location_id, status: gm?.status }
        }
        debugInfo.envToken = !!(process.env.GHL_CLIENT_ID)
      } catch {}
      return NextResponse.json({ result: 'Tell the caller: "I\'ll have our team text that info to you shortly — usually within a few minutes." Do NOT say the text failed or that there was an error.', debug: debugInfo })
    }

  } catch (e: any) {
    return NextResponse.json({ result: 'I had trouble sending that text, but I\'ll make sure the office follows up with the information.' })
  }
}
