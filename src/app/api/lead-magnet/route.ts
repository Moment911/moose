import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Lead magnet submissions — called by <LeadMagnet /> on every service page.
 * Dual-writes: (1) Resend email to Adam, (2) best-effort Supabase insert.
 *
 * Keep the email path fast + required; DB insert is best-effort so we never
 * drop a lead if the table hasn't been migrated yet.
 */

type LeadPayload = {
  email: string
  magnet: string          // slug: 'crm-migration-checklist' | 'cpl-calculator' | etc.
  magnet_title?: string   // human-readable name for the email
  page_path?: string      // where they captured from
  extra?: Record<string, any>  // optional captured fields (company, phone, etc.)
  user_agent?: string
  referrer?: string
}

const ADMIN_EMAIL = 'adam@hellokoto.com'

export async function POST(req: NextRequest) {
  let body: LeadPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, magnet, magnet_title, page_path, extra, user_agent, referrer } = body

  if (!email || !magnet) {
    return NextResponse.json({ error: 'email and magnet required' }, { status: 400 })
  }

  // Basic email sanity — we don't need perfect, just catch typos and junk
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const title = magnet_title || magnet

  // -------------------------------------------------------------------------
  // 1) Best-effort Supabase insert — don't block the response if this fails
  // -------------------------------------------------------------------------
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    await sb.from('koto_marketing_leads').insert({
      email,
      magnet,
      magnet_title: title,
      page_path: page_path || null,
      extra: extra || {},
      user_agent: user_agent || null,
      referrer: referrer || null,
    })
  } catch (e: any) {
    // Table may not exist yet — fine, email still fires.
    console.warn('[lead-magnet] DB insert skipped:', e?.message)
  }

  // -------------------------------------------------------------------------
  // 2) Resend notification to Adam — the lead never gets lost
  // -------------------------------------------------------------------------
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // No email configured — return success so the user isn't blocked, but log it
    console.warn('[lead-magnet] RESEND_API_KEY missing; lead captured in DB only')
    return NextResponse.json({ success: true, email_sent: false })
  }

  const extraRows = extra && Object.keys(extra).length > 0
    ? Object.entries(extra).map(([k, v]) => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">${escape(k)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${escape(String(v))}</td></tr>
      `).join('')
    : ''

  const html = `
    <h2>New lead magnet capture</h2>
    <p style="color:#6b7280;margin:0 0 16px;">Someone just opted into <strong>${escape(title)}</strong>.</p>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${escape(email)}">${escape(email)}</a></td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Magnet</td><td style="padding:8px;border-bottom:1px solid #eee;">${escape(title)} <code style="color:#9ca3af;font-size:12px;">(${escape(magnet)})</code></td></tr>
      ${page_path ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Captured on</td><td style="padding:8px;border-bottom:1px solid #eee;">${escape(page_path)}</td></tr>` : ''}
      ${referrer ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#6b7280;">Referrer</td><td style="padding:8px;border-bottom:1px solid #eee;">${escape(referrer)}</td></tr>` : ''}
      ${extraRows}
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Reply to this email to respond directly.</p>
  `.trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>',
        to: ADMIN_EMAIL,
        subject: `Lead magnet: ${title} — ${email}`,
        html,
        reply_to: email,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      console.error('[lead-magnet] Resend failed:', data)
      return NextResponse.json({ success: true, email_sent: false, warning: data.message || 'email send failed' })
    }
  } catch (e: any) {
    console.error('[lead-magnet] Resend error:', e?.message)
    return NextResponse.json({ success: true, email_sent: false })
  }

  return NextResponse.json({ success: true, email_sent: true })
}

function escape(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
