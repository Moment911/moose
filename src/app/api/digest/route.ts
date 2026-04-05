import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
function getResend() { return new Resend(process.env.RESEND_API_KEY || '') }

function row(label: string, value: string, color = '#374151') {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#9ca3af;font-family:Helvetica,sans-serif;width:140px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;font-weight:700;color:${color};font-family:Helvetica,sans-serif;">${value}</td>
  </tr>`
}

function insightRow(ins: any) {
  const icon = ins.type==='win'?'🏆':ins.type==='alert'?'🚨':ins.type==='opportunity'?'🎯':'💡'
  const color = ins.type==='win'?'#16a34a':ins.type==='alert'?'#ea2729':ins.type==='opportunity'?'#5bc6d0':'#7c3aed'
  return `<div style="padding:10px 14px;margin-bottom:8px;border-radius:10px;border-left:3px solid ${color};background:${color}08;">
    <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:3px;">${icon} ${ins.title}</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.5;">${(ins.body||'').slice(0,120)}${(ins.body||'').length>120?'…':''}</div>
  </div>`
}

function buildDigestEmail(opts: {
  agencyName: string, agencyLogo?: string, brandColor: string,
  digestDate: string, clients: any[], insights: any[], alerts: any[],
  slaBreaches: any[], digestUrl: string
}) {
  const color = opts.brandColor || '#ea2729'
  const logo  = opts.agencyLogo
    ? `<img src="${opts.agencyLogo}" alt="${opts.agencyName}" style="height:28px;max-width:160px;object-fit:contain;"/>`
    : `<div style="font-size:17px;font-weight:900;color:#fff;">${opts.agencyName}</div>`

  const alertsHtml = opts.alerts.slice(0,3).map(insightRow).join('')
  const insightsHtml = opts.insights.slice(0,5).map(insightRow).join('')

  const clientRows = opts.clients.slice(0,8).map(cl => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111;font-family:Helvetica,sans-serif;border-bottom:1px solid #f3f4f6;">${cl.name}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;font-family:Helvetica,sans-serif;border-bottom:1px solid #f3f4f6;">${cl.industry||'—'}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:${cl.avg_rating>=4?'#16a34a':cl.avg_rating>=3?'#f59e0b':'#ea2729'};font-family:Helvetica,sans-serif;border-bottom:1px solid #f3f4f6;">${cl.avg_rating?`${cl.avg_rating}★`:'—'}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;font-family:Helvetica,sans-serif;border-bottom:1px solid #f3f4f6;">${cl.open_tickets||0} open</td>
    </tr>
  `).join('')

  const slaHtml = opts.slaBreaches.length > 0 ? `
    <div style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;padding:14px 16px;margin:16px 0;">
      <div style="font-size:12px;font-weight:800;color:#ea2729;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">🚨 ${opts.slaBreaches.length} SLA Breach${opts.slaBreaches.length>1?'es':''}</div>
      ${opts.slaBreaches.map(t=>`<div style="font-size:12px;color:#374151;padding:3px 0;">${t.ticket_number} — ${t.subject} (${t.priority})</div>`).join('')}
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#0a0a0a;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;">
    ${logo}
    <span style="font-size:11px;color:rgba(255,255,255,.35);margin-left:auto;">Weekly Digest · ${opts.digestDate}</span>
  </td></tr>

  <tr><td style="padding:24px;">

    ${slaHtml}

    ${opts.alerts.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;color:#111;margin-bottom:10px;">🚨 Critical Alerts</div>
      ${alertsHtml}
    </div>` : ''}

    ${opts.insights.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;color:#111;margin-bottom:10px;">✨ Top Insights This Week</div>
      ${insightsHtml}
    </div>` : ''}

    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;color:#111;margin-bottom:10px;">📊 Client Snapshot</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Client</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Industry</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Rating</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Tickets</td>
        </tr>
        ${clientRows}
      </table>
    </div>

    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${opts.digestUrl}" style="display:inline-block;padding:13px 28px;border-radius:11px;background:${color};color:#fff;font-size:14px;font-weight:800;text-decoration:none;">
        View Full Dashboard →
      </a>
    </td></tr></table>

  </td></tr>
  <tr><td style="background:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Weekly digest from ${opts.agencyName} · <a href="${APP_URL}" style="color:#9ca3af;">${APP_URL}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// ── Gather all data for digest ───────────────────────────────────────────────
async function gatherDigestData(agencyId: string) {
  const sb  = getSupabase()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: clients },
    { data: reviews },
    { data: tickets },
    { data: insights },
  ] = await Promise.all([
    sb.from('clients').select('id,name,industry,status').eq('agency_id', agencyId).eq('status','active'),
    sb.from('reviews').select('client_id,rating').eq('agency_id', agencyId).gte('created_at', weekAgo),
    sb.from('desk_tickets').select('*').eq('agency_id', agencyId).not('status','in','("resolved","closed")'),
    sb.from('agent_insights').select('*').eq('agency_id', agencyId).eq('dismissed',false).order('created_at',{ascending:false}).limit(20),
  ])

  // Build per-client stats
  const clientStats = (clients || []).map(cl => {
    const clReviews = (reviews||[]).filter(r=>r.client_id===cl.id)
    const clTickets = (tickets||[]).filter(t=>t.client_id===cl.id)
    const avg = clReviews.filter(r=>r.rating).length
      ? (clReviews.reduce((s,r)=>s+r.rating,0)/clReviews.filter(r=>r.rating).length).toFixed(1)
      : null
    return { ...cl, avg_rating: avg ? parseFloat(avg) : null, open_tickets: clTickets.length }
  }).sort((a,b) => (b.open_tickets - a.open_tickets))

  // SLA breaches
  const slaHours: Record<string,number> = { urgent:2, high:8, normal:24, low:72 }
  const slaBreaches = (tickets||[]).filter(t => {
    const hrs = slaHours[t.priority] || 24
    const age = (now.getTime() - new Date(t.created_at).getTime()) / 3600000
    return age > hrs && !['resolved','closed'].includes(t.status)
  }).slice(0, 5)

  const alerts   = (insights||[]).filter(i=>i.type==='alert'||i.priority==='critical')
  const otherIns = (insights||[]).filter(i=>i.type!=='alert'&&i.priority!=='critical')

  return { clients: clientStats, alerts, insights: otherIns, slaBreaches }
}

export async function POST(req: NextRequest) {
  try {
    const { action, agency_id, test } = await req.json()
    const sb = getSupabase()

    // ── Send weekly digest ───────────────────────────────────────────────────
    if (action === 'send_digest' || action === 'weekly') {
      const agencies = agency_id
        ? [{ id: agency_id }]
        : (await sb.from('agencies').select('id,name,brand_name,brand_color,brand_logo_url,support_email,plan,status').not('status','eq','canceled')).data || []

      let sent = 0
      for (const ag of agencies) {
        try {
          const { data: full } = await sb.from('agencies').select('*').eq('id', ag.id).single()
          if (!full) continue
          // Get agency owner email
          const { data: member } = await sb.from('agency_members').select('user_id')
            .eq('agency_id', ag.id).eq('role','owner').single()
          // Fallback: check users table or billing_email
          const toEmail = full.billing_email || full.support_email
          if (!toEmail) continue

          const data = await gatherDigestData(ag.id)
          if (data.clients.length === 0 && !test) continue // skip empty agencies

          const html = buildDigestEmail({
            agencyName:  full.brand_name || full.name || 'Your Agency',
            agencyLogo:  full.brand_logo_url,
            brandColor:  full.brand_color || '#ea2729',
            digestDate:  new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),
            clients:     data.clients,
            insights:    data.insights,
            alerts:      data.alerts,
            slaBreaches: data.slaBreaches,
            digestUrl:   APP_URL,
          })

          await getResend().emails.send({
            from:    'Koto CMO <digest@hellokoto.com>',
            to:      toEmail,
            subject: `📊 Weekly Digest — ${data.alerts.length > 0 ? `${data.alerts.length} alerts need attention · ` : ''}${data.clients.length} clients`,
            html,
          })
          sent++
        } catch { /* continue to next agency */ }
      }
      return NextResponse.json({ sent, agencies: agencies.length })
    }

    // ── Send SLA breach alert (called from desk webhook) ─────────────────────
    if (action === 'sla_alert') {
      const { ticket, agency } = await req.json().catch(() => ({}))
      if (!ticket || !agency?.billing_email) return NextResponse.json({ ok: false })

      const slaHours: Record<string,number> = { urgent:2, high:8, normal:24, low:72 }
      const hrs = slaHours[ticket.priority] || 24
      const agencyName = agency.brand_name || agency.name || 'Your Agency'

      await getResend().emails.send({
        from:    'Koto Alerts <alerts@hellokoto.com>',
        to:      agency.billing_email,
        subject: `🚨 SLA Breach: ${ticket.ticket_number} (${ticket.priority} — ${hrs}h SLA)`,
        html: `
          <div style="font-family:Helvetica,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <div style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;padding:20px 24px;margin-bottom:16px;">
              <div style="font-size:14px;font-weight:800;color:#ea2729;margin-bottom:8px;">🚨 SLA Breached</div>
              <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:6px;">${ticket.ticket_number}: ${ticket.subject}</div>
              <div style="font-size:13px;color:#6b7280;">Priority: <strong>${ticket.priority}</strong> · SLA: ${hrs}h · Status: ${ticket.status}</div>
            </div>
            <a href="${APP_URL}/desk/ticket/${ticket.id}" style="display:inline-block;padding:12px 24px;background:#ea2729;color:#fff;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px;">View Ticket →</a>
          </div>`,
      })
      return NextResponse.json({ ok: true })
    }

    // ── Preview digest data (no email) ───────────────────────────────────────
    if (action === 'preview') {
      const data = await gatherDigestData(agency_id)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── Cron: runs every Monday 9am UTC ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const res = await fetch(`${APP_URL}/api/digest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'weekly' }),
  })
  const data = await res.json()
  return NextResponse.json(data)
}
