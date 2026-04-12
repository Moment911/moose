import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
function getResend() { return new Resend(process.env.RESEND_API_KEY || '') }

// ── Email HTML template ──────────────────────────────────────────────────────
function buildEmailHTML(opts: {
  agencyName: string, clientName: string, contactName: string,
  message: string, reviewUrl: string, trackingUrl: string,
  logoUrl?: string, brandColor?: string
}) {
  const color  = opts.brandColor || '#ea2729'
  const logo   = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.agencyName}" style="height:32px;max-width:160px;object-fit:contain;"/>`
    : `<div style="font-size:18px;font-weight:900;color:#fff;">${opts.agencyName}</div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Leave a Review</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.08);">
  <tr><td style="background:#0a0a0a;padding:20px 28px;">${logo}</td></tr>
  <tr><td style="padding:32px 28px;">
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#111;line-height:1.3;">
      How was your experience with ${opts.clientName}?
    </h1>
    <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.7;">
      ${opts.message.replace(/\n/g, '<br/>')}
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${opts.trackingUrl}" style="display:inline-block;padding:15px 32px;border-radius:12px;background:${color};color:#fff;font-size:16px;font-weight:800;text-decoration:none;letter-spacing:-.01em;">
        ⭐ Leave a Google Review
      </a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
      Your feedback takes less than 2 minutes and helps ${opts.clientName} grow their business.<br/>
      If you'd prefer not to receive emails like this, <a href="${APP_URL}/api/reviews/campaign?action=unsub&token=${opts.trackingUrl.split('token=')[1]?.split('&')[0]}" style="color:#9ca3af;">unsubscribe here</a>.
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:14px 28px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Sent on behalf of ${opts.clientName} by ${opts.agencyName}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// ── Generate AI-written message ──────────────────────────────────────────────
async function generateMessage(clientName: string, industry: string, channel: 'email' | 'sms'): Promise<string> {
  if (!ANTHROPIC_KEY) {
    return channel === 'sms'
      ? `Hi! Thank you for choosing ${clientName}. We'd love your feedback — could you leave us a quick Google review? It means the world to us. [REVIEW_LINK]`
      : `Hi [NAME],\n\nThank you so much for choosing ${clientName}. We truly hope you had a great experience!\n\nIf you have a moment, we'd be incredibly grateful if you could share your feedback with a quick Google review. It helps us grow and lets others know what to expect.\n\nThank you again for your trust in us!\n\nWarm regards,\nThe ${clientName} Team`
  }

  const prompt = channel === 'sms'
    ? `Write a short, friendly SMS review request for ${clientName} (${industry} business). Max 160 characters. Include [REVIEW_LINK] as placeholder. Warm, not pushy. No emojis.`
    : `Write a warm, professional email asking for a Google review for ${clientName} (${industry}). 3-4 short paragraphs. Start with "Hi [NAME]," — use [NAME] as placeholder for the customer's name. End with a team sign-off. Not pushy, genuinely grateful tone.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  return data.content?.[0]?.text?.trim() || ''
}

// ── Send to a single contact ─────────────────────────────────────────────────
async function sendToContact(contact: any, campaign: any, client: any, agency: any) {
  const sb = getSupabase()
  const trackUrl = `${APP_URL}/api/reviews/campaign?action=click&token=${contact.token}&url=${encodeURIComponent(campaign.review_url)}`
  const openUrl  = `${APP_URL}/api/reviews/campaign?action=open&token=${contact.token}`

  let sent = false
  let channel = 'email'

  if ((campaign.channel === 'email' || campaign.channel === 'both') && contact.email) {
    const msg = (campaign.message_email || '')
      .replace(/\[NAME\]/g, contact.name?.split(' ')[0] || 'there')
      .replace(/\[REVIEW_LINK\]/g, trackUrl)

    try {
      await getResend().emails.send({
        from:    agency?.support_email || `${agency?.brand_name || agency?.name || 'Your Agency'} <reviews@hellokoto.com>`,
        to:      contact.email,
        subject: campaign.subject || `How was your experience with ${client?.name}?`,
        html:    buildEmailHTML({
          agencyName: agency?.brand_name || agency?.name || 'Your Agency',
          clientName: client?.name || 'us',
          contactName: contact.name,
          message:    msg,
          reviewUrl:  campaign.review_url,
          trackingUrl: trackUrl + `&open=${openUrl}`,
          logoUrl:    agency?.brand_logo_url,
          brandColor: agency?.brand_color,
        }),
      })
      void trackPlatformCost({
        cost_type: 'resend_email', amount: PLATFORM_RATES.resend_email, unit_count: 1,
        description: 'review request email',
        metadata: { feature: 'review_campaign', campaign_id: campaign.id, client_id: client?.id },
      })
      sent = true; channel = 'email'
    } catch { /* fall through to SMS */ }
  }

  if (!sent && (campaign.channel === 'sms' || campaign.channel === 'both') && contact.phone) {
    // SMS via Twilio if configured
    const twilioSid   = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom  = process.env.TWILIO_PHONE_NUMBER

    if (twilioSid && twilioToken && twilioFrom) {
      const msg = (campaign.message_sms || '')
        .replace(/\[NAME\]/g, contact.name?.split(' ')[0] || 'there')
        .replace(/\[REVIEW_LINK\]/g, trackUrl)

      const phone = contact.phone.replace(/\D/g, '')
      const fullPhone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`

      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: fullPhone, Body: msg }).toString(),
      })
      sent = true; channel = 'sms'
    }
  }

  if (sent) {
    await sb.from('review_request_contacts').update({
      status: 'sent', channel_used: channel, sent_at: new Date().toISOString()
    }).eq('id', contact.id)
    await sb.from('review_campaigns').update({
      total_sent: (campaign.total_sent || 0) + 1
    }).eq('id', campaign.id)
  }

  return sent
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const token  = searchParams.get('token')
  const url    = searchParams.get('url')

  const sb = getSupabase()

  if (action === 'open' && token) {
    await sb.from('review_request_contacts').update({
      status: 'opened', opened_at: new Date().toISOString()
    }).eq('token', token).eq('status', 'sent')
    // Return 1x1 transparent gif
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    return new NextResponse(gif, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' } })
  }

  if (action === 'click' && token && url) {
    await sb.from('review_request_contacts').update({
      status: 'clicked', clicked_at: new Date().toISOString()
    }).eq('token', token)
    // Update campaign click count
    const { data: contact } = await sb.from('review_request_contacts').select('campaign_id').eq('token', token).single()
    if (contact?.campaign_id) {
      const { data: campaign } = await sb.from('review_campaigns').select('total_clicked').eq('id', contact.campaign_id).single()
      await sb.from('review_campaigns').update({ total_clicked: (campaign?.total_clicked || 0) + 1 }).eq('id', contact.campaign_id)
    }
    return NextResponse.redirect(decodeURIComponent(url))
  }

  if (action === 'unsub' && token) {
    await sb.from('review_request_contacts').update({ status: 'unsubscribed' }).eq('token', token)
    return new NextResponse('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>You have been unsubscribed.</h2><p>You will no longer receive review requests.</p></body></html>', { headers: { 'Content-Type': 'text/html' } })
  }

  // GET campaigns for a client
  const client_id = searchParams.get('client_id')
  const agency_id = searchParams.get('agency_id')
  if (client_id) {
    const { data: campaigns } = await sb.from('review_campaigns').select('*').eq('client_id', client_id).order('created_at', { ascending: false })
    return NextResponse.json({ campaigns: campaigns || [] })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, client_id } = body
    const sb = getSupabase()

    // ── Create campaign ──────────────────────────────────────────────────────
    if (action === 'create') {
      const { name, channel, subject, message_email, message_sms, review_url, send_delay_days, auto_send } = body
      const { data, error } = await sb.from('review_campaigns').insert({
        agency_id, client_id, name, channel: channel || 'email',
        subject, message_email, message_sms, review_url,
        send_delay_days: send_delay_days || 1, auto_send: auto_send || false,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    // ── Generate AI message ──────────────────────────────────────────────────
    if (action === 'generate_message') {
      const { channel } = body
      const { data: client } = await sb.from('clients').select('name,industry').eq('id', client_id).single()
      const message = await generateMessage(client?.name || '', client?.industry || '', channel || 'email')
      return NextResponse.json({ message })
    }

    // ── Add contacts ─────────────────────────────────────────────────────────
    if (action === 'add_contacts') {
      const { campaign_id, contacts } = body
      const rows = contacts.map((c: any) => ({
        campaign_id, client_id, agency_id,
        name: c.name, email: c.email || null, phone: c.phone || null,
      }))
      const { data, error } = await sb.from('review_request_contacts').insert(rows).select()
      if (error) throw error
      return NextResponse.json({ added: data?.length || 0 })
    }

    // ── Send campaign (to all pending contacts) ───────────────────────────────
    if (action === 'send') {
      const { campaign_id } = body
      const [
        { data: campaign },
        { data: contacts },
        { data: client },
        { data: agency },
      ] = await Promise.all([
        sb.from('review_campaigns').select('*').eq('id', campaign_id).single(),
        sb.from('review_request_contacts').select('*').eq('campaign_id', campaign_id).eq('status', 'pending'),
        sb.from('clients').select('*').eq('id', client_id).single(),
        sb.from('agencies').select('*').eq('id', agency_id).single(),
      ])

      if (!campaign) throw new Error('Campaign not found')
      let sent = 0
      for (const contact of contacts || []) {
        const ok = await sendToContact(contact, campaign, client, agency)
        if (ok) sent++
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100))
      }

      await sb.from('review_campaigns').update({ status: 'active' }).eq('id', campaign_id)
      return NextResponse.json({ sent })
    }

    // ── Send to single contact ────────────────────────────────────────────────
    if (action === 'send_one') {
      const { campaign_id, contact_id } = body
      const [{ data: campaign }, { data: contact }, { data: client }, { data: agency }] = await Promise.all([
        sb.from('review_campaigns').select('*').eq('id', campaign_id).single(),
        sb.from('review_request_contacts').select('*').eq('id', contact_id).single(),
        sb.from('clients').select('*').eq('id', client_id).single(),
        sb.from('agencies').select('*').eq('id', agency_id).single(),
      ])
      const ok = await sendToContact(contact, campaign, client, agency)
      return NextResponse.json({ sent: ok })
    }

    // ── Get campaign contacts + stats ─────────────────────────────────────────
    if (action === 'contacts') {
      const { campaign_id } = body
      const { data: contacts } = await sb.from('review_request_contacts').select('*').eq('campaign_id', campaign_id).order('created_at', { ascending: false })
      return NextResponse.json({ contacts: contacts || [] })
    }

    // ── Delete campaign ───────────────────────────────────────────────────────
    if (action === 'delete') {
      await sb.from('review_campaigns').delete().eq('id', body.campaign_id)
      return NextResponse.json({ ok: true })
    }

    // ── Update campaign ───────────────────────────────────────────────────────
    if (action === 'update') {
      const { campaign_id, ...updates } = body
      delete updates.action; delete updates.agency_id; delete updates.client_id
      const { data } = await sb.from('review_campaigns').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', campaign_id).select().single()
      return NextResponse.json({ campaign: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
