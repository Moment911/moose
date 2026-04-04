import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend  = new Resend(process.env.RESEND_API_KEY)
const FROM    = process.env.DESK_EMAIL_FROM || 'MooseDesk <desk@momentamktg.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moose-adam-segalls-projects.vercel.app'

function base(body: string, pre: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${pre}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0a0a0a;padding:22px 32px;">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background:#ea2729;border-radius:9px;width:34px;height:34px;text-align:center;vertical-align:middle;">
      <span style="color:#fff;font-size:16px;font-weight:900;line-height:34px;">M</span>
    </td>
    <td style="padding-left:10px;vertical-align:middle;">
      <div style="font-size:17px;font-weight:900;color:#fff;">MooseDesk</div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);">Support Portal</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px;">${body}</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">Powered by Moose AI &nbsp;·&nbsp; <a href="${APP_URL}" style="color:#ea2729;text-decoration:none;">Visit Portal</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`
}

function btn(href: string, text: string, bg = '#ea2729') {
  return `<a href="${href}" style="display:inline-block;padding:13px 28px;border-radius:11px;background:${bg};color:${bg==='#ea2729'?'#fff':'#374151'};font-size:15px;font-weight:800;text-decoration:none;">${text}</a>`
}

function ticketCard(t: any) {
  const priColor = ['urgent','critical'].includes(t.priority) ? '#ea2729' : ['high'].includes(t.priority) ? '#f59e0b' : '#3b82f6'
  return `<div style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;padding:18px 22px;margin:20px 0;">
    <div style="font-size:12px;font-weight:800;color:#5bc6d0;margin-bottom:6px;">${t.ticket_number}</div>
    <div style="font-size:18px;font-weight:900;color:#111;margin-bottom:8px;">${t.subject}</div>
    <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${priColor}15;color:${priColor};font-size:12px;font-weight:700;">${(t.ai_priority||t.priority||'normal')} priority</span>
  </div>`
}

function aiBlock(t: any) {
  if (!t.ai_summary) return ''
  return `<div style="background:#0a0a0a;border-radius:12px;padding:18px 22px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;color:#5bc6d0;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">✨ AI Analysis</div>
    <div style="font-size:14px;color:rgba(255,255,255,.7);line-height:1.75;margin-bottom:${t.ai_suggested_response?'14px':'0'}">${t.ai_summary}</div>
    ${t.ai_suggested_response ? `<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:14px;border:1px solid rgba(255,255,255,.1);">
      <div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.4);margin-bottom:8px;">💡 SUGGESTED RESPONSE</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.7;">${t.ai_suggested_response}</div>
    </div>` : ''}
  </div>`
}

function ticketCreatedClient(t: any, agName: string) {
  const url = `${APP_URL}/client-portal`
  return base(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#111;">We got your request ✓</h1>
    <p style="margin:0 0 4px;font-size:16px;color:#374151;line-height:1.7;">Hi ${t.submitter_name}, your request is in — <strong>${agName}</strong> has been notified and will respond shortly.</p>
    ${ticketCard(t)}
    ${t.ai_summary ? aiBlock(t) : ''}
    <p style="margin:20px 0 8px;font-size:14px;color:#374151;">You can view your ticket and track updates in your portal:</p>
    <p style="margin:0;">${btn(url,'View My Request →')}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Or simply reply to this email to add a message.</p>
  `, `Your request ${t.ticket_number} was received — ${t.subject}`)
}

function ticketCreatedAgency(t: any, agName: string) {
  const ticketUrl = `${APP_URL}/desk/ticket/${t.id}`
  return base(`
    <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:#fef2f2;border:1px solid #fecaca;font-size:12px;font-weight:800;color:#ea2729;margin-bottom:14px;">🎫 New Support Ticket</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111;">${t.ticket_number}: ${t.subject}</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#374151;">From <strong>${t.submitter_name}</strong> &lt;${t.submitter_email}&gt;</p>
    ${aiBlock(t)}
    <div style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;padding:18px 22px;margin:20px 0;">
      <div style="font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Original Message</div>
      <div style="font-size:15px;color:#374151;line-height:1.75;white-space:pre-wrap;">${t.description}</div>
    </div>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;">${btn(ticketUrl,'Open Ticket →')}</td>
      <td>${btn(ticketUrl+'#reply','Quick Reply','#f9fafb')}</td>
    </tr></table>
  `, `New ticket from ${t.submitter_name}: ${t.subject}`)
}

function replyToClient(t: any, r: any) {
  const url = `${APP_URL}/client-portal`
  return base(`
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111;">New reply on your ticket</h1>
    <p style="margin:0 0 18px;font-size:15px;color:#374151;"><strong>${r.author_name}</strong> replied to <strong>${t.ticket_number}: ${t.subject}</strong></p>
    <div style="background:#f9fafb;border-radius:12px;border-left:4px solid #ea2729;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:#374151;margin-bottom:8px;">${r.author_name}</div>
      <div style="font-size:15px;color:#374151;line-height:1.75;white-space:pre-wrap;">${r.body}</div>
    </div>
    <p style="margin:0;">${btn(url,'View & Reply →')}</p>
  `, `${r.author_name} replied to your ticket`)
}

function replyToAgency(t: any, r: any) {
  const url = `${APP_URL}/desk/ticket/${t.id}`
  return base(`
    <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:#eff6ff;border:1px solid #bfdbfe;font-size:12px;font-weight:800;color:#3b82f6;margin-bottom:14px;">💬 Client Replied</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111;">${t.ticket_number}: ${t.subject}</h1>
    <p style="margin:0 0 18px;font-size:15px;color:#374151;"><strong>${r.author_name}</strong> (${t.submitter_email}) sent a reply:</p>
    <div style="background:#f9fafb;border-radius:12px;border-left:4px solid #3b82f6;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:15px;color:#374151;line-height:1.75;white-space:pre-wrap;">${r.body}</div>
    </div>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;">${btn(url,'Open Ticket →')}</td>
      <td>${btn(url+'#reply','Reply Now','#f9fafb')}</td>
    </tr></table>
  `, `${r.author_name} replied to ${t.ticket_number}`)
}

function resolvedClient(t: any) {
  const url = `${APP_URL}/client-portal`
  return base(`
    <div style="text-align:center;padding:8px 0 20px;">
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#111;">Your request is resolved!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.75;">
        Ticket <strong>${t.ticket_number}</strong> — ${t.subject} — has been marked as resolved.<br/>
        If you need further help, just reply to this email or submit a new request.
      </p>
      ${btn(url,'Visit Your Portal →','#16a34a')}
    </div>
  `, `Resolved: ${t.ticket_number} — ${t.subject}`)
}

export async function POST(req: NextRequest) {
  try {
    const { type, ticket, reply, agencyEmail, agencyName } = await req.json()
    if (!ticket) return NextResponse.json({ error: 'No ticket' }, { status: 400 })

    const ag    = agencyName || 'Your Agency'
    const sends: any[] = []

    if (type === 'ticket_created') {
      sends.push({ from:FROM, to:ticket.submitter_email, replyTo:agencyEmail||FROM,
        subject:`[${ticket.ticket_number}] We received your request: ${ticket.subject}`,
        html:ticketCreatedClient(ticket,ag) })
      if (agencyEmail) sends.push({ from:FROM, to:agencyEmail, replyTo:ticket.submitter_email,
        subject:`🎫 New Ticket ${ticket.ticket_number}: ${ticket.subject}`,
        html:ticketCreatedAgency(ticket,ag) })
    }
    else if (type === 'reply_sent' && reply && !reply.is_internal) {
      if (reply.author_type === 'agent') {
        sends.push({ from:FROM, to:ticket.submitter_email, replyTo:agencyEmail||FROM,
          subject:`[${ticket.ticket_number}] New reply: ${ticket.subject}`,
          html:replyToClient(ticket,reply) })
      } else if (agencyEmail) {
        sends.push({ from:FROM, to:agencyEmail, replyTo:ticket.submitter_email,
          subject:`[${ticket.ticket_number}] Client replied: ${ticket.subject}`,
          html:replyToAgency(ticket,reply) })
      }
    }
    else if (type === 'ticket_resolved') {
      sends.push({ from:FROM, to:ticket.submitter_email, replyTo:agencyEmail||FROM,
        subject:`[${ticket.ticket_number}] Resolved: ${ticket.subject}`,
        html:resolvedClient(ticket) })
    }

    const results = await Promise.allSettled(sends.map(e => resend.emails.send(e)))
    const sent  = results.filter(r=>r.status==='fulfilled').length
    const errs  = results.filter((r): r is PromiseRejectedResult => r.status==='rejected').map(r=>r.reason?.message||String(r.reason))
    return NextResponse.json({ sent, failed:errs.length, errors:errs.length?errs:undefined })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}