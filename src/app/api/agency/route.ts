import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const agencyId = p.get('agency_id')
  const s = sb()

  if (action === 'get_email_settings') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('agencies').select(
      'sender_name, sender_email, reply_to_email, support_email, billing_email, noreply_email, email_routing, email_signature, email_domain_verified, resend_domain_id'
    ).eq('id', agencyId).single()
    return NextResponse.json(data || {})
  }

  if (action === 'get_settings') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('agencies').select('*').eq('id', agencyId).single()
    return NextResponse.json(data || {})
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, agency_id } = body
  const s = sb()

  if (action === 'update_email_settings') {
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const allowed = ['sender_name', 'sender_email', 'reply_to_email', 'support_email', 'billing_email', 'noreply_email', 'email_signature', 'email_routing']
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    const { error } = await s.from('agencies').update(updates).eq('id', agency_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'verify_email_domain') {
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: agency } = await s.from('agencies').select('sender_email').eq('id', agency_id).single()
    if (!agency?.sender_email) return NextResponse.json({ error: 'Set sender_email first' }, { status: 400 })

    const domain = agency.sender_email.split('@')[1]
    if (!domain) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'Resend not configured' }, { status: 500 })

    try {
      const res = await fetch('https://api.resend.com/domains', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domain }),
      })
      const data = await res.json()
      if (data.id) {
        await s.from('agencies').update({ resend_domain_id: data.id, email_domain_verified: false }).eq('id', agency_id)
        return NextResponse.json({ domain_id: data.id, records: data.records || [], status: data.status })
      }
      return NextResponse.json({ error: data.message || 'Domain registration failed' }, { status: 400 })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'check_domain_status') {
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: agency } = await s.from('agencies').select('resend_domain_id').eq('id', agency_id).single()
    if (!agency?.resend_domain_id) return NextResponse.json({ verified: false, status: 'not_configured' })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'Resend not configured' }, { status: 500 })

    const res = await fetch(`https://api.resend.com/domains/${agency.resend_domain_id}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    })
    const data = await res.json()
    const verified = data.status === 'verified'
    if (verified) await s.from('agencies').update({ email_domain_verified: true }).eq('id', agency_id)
    return NextResponse.json({ verified, status: data.status, records: data.records })
  }

  if (action === 'send_test_email') {
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: agency } = await s.from('agencies').select('sender_name, sender_email, reply_to_email').eq('id', agency_id).single()
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'Resend not configured' }, { status: 500 })

    const from = agency?.sender_email
      ? `${agency.sender_name || 'Koto'} <${agency.sender_email}>`
      : process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>'
    const to = agency?.reply_to_email || agency?.sender_email || 'adam@hellokoto.com'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to, subject: 'Test — Your Koto email is configured correctly',
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2>Email Configuration Test</h2><p>This email confirms your Koto email settings are working correctly.</p><p><strong>From:</strong> ${from}</p><p><strong>To:</strong> ${to}</p><p><strong>Time:</strong> ${new Date().toLocaleString()}</p><p style="color:#9ca3af;font-size:12px;margin-top:24px;">Sent from Koto platform</p></div>`,
        }),
      })
      const data = await res.json()
      return NextResponse.json({ success: res.ok, id: data.id, error: data.message })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
