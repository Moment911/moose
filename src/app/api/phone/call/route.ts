import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const TELNYX_KEY = () => process.env.TELNYX_API_KEY || ''
const TWILIO_SID = () => process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = () => process.env.TWILIO_AUTH_TOKEN || ''

/* ── GET: list available numbers for calling ──────────────────────────── */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const agencyId = p.get('agency_id')
  const role = p.get('role') // super_admin, agency, client
  const clientId = p.get('client_id')
  const s = sb()

  if (action === 'get_numbers') {
    let q = s.from('koto_phone_numbers').select('id, phone_number, friendly_name, provider, type, purpose, agency_id, client_id').eq('status', 'active')

    if (role === 'super_admin') {
      // Super admin sees all numbers
    } else if (role === 'client' && clientId) {
      q = q.eq('client_id', clientId)
    } else if (agencyId) {
      q = q.eq('agency_id', agencyId)
    }

    const { data } = await q.order('created_at', { ascending: false })
    return NextResponse.json(data || [])
  }

  if (action === 'call_status') {
    const callId = p.get('call_id')
    const provider = p.get('provider') || 'telnyx'
    if (!callId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

    if (provider === 'telnyx') {
      try {
        const res = await fetch(`https://api.telnyx.com/v2/calls/${callId}`, {
          headers: { Authorization: `Bearer ${TELNYX_KEY()}` },
        })
        const json = await res.json()
        return NextResponse.json(json.data || {})
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }
    return NextResponse.json({ status: 'unknown' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/* ── POST: initiate and control calls ─────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  /* ── Initiate outbound call via Telnyx ─────────────────────────────── */
  if (action === 'dial') {
    const { from_number, to_number, agency_id, user_phone } = body
    if (!from_number || !to_number) {
      return NextResponse.json({ error: 'from_number and to_number required' }, { status: 400 })
    }

    // Determine provider from the from_number
    const { data: phoneRecord } = await s.from('koto_phone_numbers')
      .select('provider, provider_sid').eq('phone_number', from_number).single()

    const provider = phoneRecord?.provider || 'telnyx'

    if (provider === 'telnyx') {
      const key = TELNYX_KEY()
      if (!key) return NextResponse.json({ error: 'Telnyx not configured' }, { status: 500 })

      try {
        // Telnyx Call Control: create outbound call
        const res = await fetch('https://api.telnyx.com/v2/calls', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: to_number,
            from: from_number,
            connection_id: phoneRecord?.provider_sid || undefined,
            webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://hellokoto.com'}/api/phone/call`,
            webhook_url_method: 'POST',
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          return NextResponse.json({ error: json.errors?.[0]?.detail || 'Call failed' }, { status: res.status })
        }

        // Log the call
        await s.from('koto_phone_numbers').update({ last_used_at: new Date().toISOString() }).eq('phone_number', from_number)

        // Record billing
        try {
          await fetch(new URL('/api/billing', req.url).toString(), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record_usage', agency_id: agency_id || null,
              feature: 'voice_outbound', quantity: 1, unit: 'minutes', unit_cost: 0.05,
            }),
          })
        } catch {}

        return NextResponse.json({
          success: true,
          call_id: json.data?.call_control_id || json.data?.id,
          call_leg_id: json.data?.call_leg_id,
          provider: 'telnyx',
          status: 'initiated',
        })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // Twilio fallback
    if (provider === 'twilio') {
      const sid = TWILIO_SID()
      if (!sid) return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
      try {
        const params = new URLSearchParams({
          To: to_number,
          From: from_number,
          Url: 'http://demo.twilio.com/docs/voice.xml', // Simple TwiML
        })
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${TWILIO_TOKEN()}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })
        const json = await res.json()
        if (!res.ok) return NextResponse.json({ error: json.message || 'Call failed' }, { status: res.status })

        return NextResponse.json({
          success: true,
          call_id: json.sid,
          provider: 'twilio',
          status: json.status,
        })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  /* ── Hangup ────────────────────────────────────────────────────────── */
  if (action === 'hangup') {
    const { call_id, provider } = body
    if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

    if (provider === 'telnyx') {
      try {
        await fetch(`https://api.telnyx.com/v2/calls/${call_id}/actions/hangup`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TELNYX_KEY()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        return NextResponse.json({ success: true })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  }

  /* ── Send DTMF tones ───────────────────────────────────────────────── */
  if (action === 'dtmf') {
    const { call_id, digits, provider } = body
    if (!call_id || !digits) return NextResponse.json({ error: 'call_id and digits required' }, { status: 400 })

    if (provider === 'telnyx') {
      try {
        await fetch(`https://api.telnyx.com/v2/calls/${call_id}/actions/send_dtmf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TELNYX_KEY()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ digits }),
        })
        return NextResponse.json({ success: true })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  }

  /* ── Telnyx webhook for call events ─────────────────────────────────── */
  if (action === 'webhook' || body.data?.event_type) {
    // Handle Telnyx call control webhooks
    const event = body.data?.event_type || body.event
    console.log('[phone/call webhook]', event)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
