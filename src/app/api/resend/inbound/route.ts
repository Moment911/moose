// ─────────────────────────────────────────────────────────────
// Resend Inbound Webhook — Phase G
//
// Receives competitor newsletter emails routed through Resend
// inbound. Looks up the recipient alias, classifies + persists.
//
// Setup outside this file:
// 1. Configure an inbound domain in Resend (MX records).
// 2. Set KOTO_INBOUND_DOMAIN env var to that domain.
// 3. Add a Resend inbound webhook pointing at this URL.
// 4. Optional: set RESEND_INBOUND_SECRET and verify signature.
//
// Falls open with a stub on misconfiguration so the system is
// non-fatal until DNS+webhook setup is complete.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { persistCompetitorEmail } from '@/lib/kotoiq/newsletterIntelEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// Permissive parser — handles Resend inbound format and common
// SendGrid / Mailgun / Postmark variants so we can swap providers.
function extractEmailPayload(raw: any): {
  to: string
  from_address: string
  from_name?: string
  subject: string
  html?: string
  text?: string
  sent_at?: string
} | null {
  if (!raw || typeof raw !== 'object') return null

  // Resend
  const toAddr =
       raw?.to?.[0]?.address
    || (Array.isArray(raw?.to) ? raw.to[0] : raw?.to)
    || raw?.envelope?.to?.[0]
    || raw?.recipient
    || ''
  const fromAddr =
       raw?.from?.address
    || (typeof raw?.from === 'string' ? raw.from : '')
    || raw?.sender
    || ''
  const fromName = raw?.from?.name || raw?.fromName || undefined
  const subject = raw?.subject || ''
  const html = raw?.html || raw?.body_html || raw?.htmlBody || raw?.['body-html']
  const text = raw?.text || raw?.body_plain || raw?.textBody || raw?.['body-plain']
  const sent_at = raw?.date || raw?.timestamp || raw?.received_at

  if (!toAddr || !fromAddr) return null
  return { to: toAddr, from_address: fromAddr, from_name: fromName, subject, html, text, sent_at }
}

export async function POST(req: NextRequest) {
  // Optional signature verification — best-effort
  const secret = process.env.RESEND_INBOUND_SECRET
  if (secret) {
    const sig = req.headers.get('resend-signature') || req.headers.get('x-resend-signature') || ''
    if (!sig) {
      return NextResponse.json({ error: 'missing signature' }, { status: 401 })
    }
    // NOTE: real HMAC verification would happen here once Resend's inbound signature
    // format is finalized. For now we accept the presence of the header.
  }

  let payload: any
  try { payload = await req.json() }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const parsed = extractEmailPayload(payload)
  if (!parsed) return NextResponse.json({ error: 'unrecognized payload shape' }, { status: 400 })

  const s = sb()

  // Resolve alias → client + brand
  const { data: alias, error: aliasErr } = await s.from('kotoiq_competitor_email_aliases')
    .select('id, client_id, brand_name, is_active')
    .eq('alias_email', parsed.to.toLowerCase())
    .maybeSingle()

  if (aliasErr) return NextResponse.json({ error: aliasErr.message }, { status: 500 })
  if (!alias) {
    return NextResponse.json({ error: 'no alias for recipient', to: parsed.to }, { status: 404 })
  }
  if (!alias.is_active) {
    return NextResponse.json({ skipped: 'alias inactive' })
  }

  const { data: client } = await s.from('clients')
    .select('agency_id')
    .eq('id', alias.client_id)
    .maybeSingle()

  try {
    const { id, classification } = await persistCompetitorEmail(s, {
      client_id: alias.client_id,
      brand_name: alias.brand_name,
      alias_id: alias.id,
      from_address: parsed.from_address,
      from_name: parsed.from_name,
      subject: parsed.subject,
      body_html: parsed.html,
      body_text: parsed.text,
      sent_at: parsed.sent_at,
      source: 'webhook',
      agency_id: client?.agency_id || null,
    })
    return NextResponse.json({ id, classification })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

// Friendly GET so you can hit the URL in a browser to confirm
// it's reachable when configuring Resend.
export async function GET() {
  return NextResponse.json({ ok: true, route: 'resend/inbound', method: 'POST' })
}
