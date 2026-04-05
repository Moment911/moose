import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}
const ai     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '' })
function getResend() { return new Resend(process.env.RESEND_API_KEY || '') }
const FROM   = process.env.DESK_EMAIL_FROM || 'Koto <reports@momentamktg.com>'
const APP    = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function fmt(n: number|null, type='num'): string {
  if (n == null || isNaN(n)) return '—'
  if (type === '$')    return '$' + Math.round(n).toLocaleString()
  if (type === 'x')    return n.toFixed(2) + 'x'
  if (type === 'pct')  return n.toFixed(1) + '%'
  return Math.round(n).toLocaleString()
}

function delta(curr: number, prev: number): string {
  if (!prev) return ''
  const pct = ((curr - prev) / prev) * 100
  return (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(1) + '%'
}

function statRow(label: string, curr: any, prev: any, type='num'): string {
  const d = prev != null ? delta(curr, prev) : ''
  const color = d.startsWith('▲') ? '#16a34a' : d.startsWith('▼') ? '#ea2729' : '#374151'
  return `<tr>
    <td style="padding:10px 16px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6">${label}</td>
    <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#111;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(curr,type)}</td>
    <td style="padding:10px 16px;font-size:13px;color:${color};border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700">${d}</td>
  </tr>`
}

export async function POST(req: NextRequest) {
  const { clientId, agencyId, recipientEmail, period = '7d' } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const days = period === '30d' ? 30 : 7
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
  const prevCutoff = new Date(cutoff); prevCutoff.setDate(prevCutoff.getDate() - days)
  const cutoffStr  = cutoff.toISOString().split('T')[0]
  const prevCutoffStr = prevCutoff.toISOString().split('T')[0]

  // Load all data
  const [
    {data:client},{data:agency},{data:snaps},{data:campaigns},
    {data:recs},{data:execLog},{data:alerts}
  ] = await Promise.all([
    getSupabase().from('clients').select('name,email').eq('id',clientId).single(),
    getSupabase().from('agencies').select('name,brand_name,billing_email,brand_color').eq('id',agencyId||'00000000-0000-0000-0000-000000000099').single(),
    getSupabase().from('perf_snapshots').select('*').eq('client_id',clientId).gte('snapshot_date',prevCutoffStr).order('snapshot_date'),
    getSupabase().from('perf_campaigns').select('*').eq('client_id',clientId).order('cost',{ascending:false}).limit(5),
    getSupabase().from('perf_recommendations').select('*').eq('client_id',clientId).neq('status','dismissed').order('est_impact_val',{ascending:false}).limit(10),
    getSupabase().from('perf_execution_log').select('*').eq('client_id',clientId).gte('applied_at',cutoffStr).order('applied_at',{ascending:false}).limit(10),
    getSupabase().from('perf_alerts').select('*').eq('client_id',clientId).eq('acknowledged',false).limit(5),
  ])

  const periodSnaps = (snaps||[]).filter(s => s.snapshot_date >= cutoffStr)
  const prevSnaps   = (snaps||[]).filter(s => s.snapshot_date >= prevCutoffStr && s.snapshot_date < cutoffStr)
  const sum = (arr: any[], key: string) => arr.reduce((s,d)=>s+(d[key]||0),0)
  const avg = (arr: any[], key: string) => arr.length ? sum(arr,key)/arr.length : 0

  const curr = {
    spend:   sum(periodSnaps,'ads_spend'),
    clicks:  sum(periodSnaps,'ads_clicks'),
    conv:    sum(periodSnaps,'ads_conversions'),
    roas:    avg(periodSnaps,'ads_roas'),
    sessions:sum(periodSnaps,'ga4_sessions'),
    gscClicks:sum(periodSnaps,'gsc_clicks'),
    gmbSearches:sum(periodSnaps,'gmb_searches'),
  }
  const prev_ = {
    spend:   sum(prevSnaps,'ads_spend'),
    roas:    avg(prevSnaps,'ads_roas'),
    conv:    sum(prevSnaps,'ads_conversions'),
    sessions:sum(prevSnaps,'ga4_sessions'),
  }

  const agName  = agency?.brand_name || agency?.name || 'Your Agency'
  const agColor = agency?.brand_color || '#ea2729'
  const clientName = client?.name || 'Client'
  const toEmail    = recipientEmail || agency?.billing_email

  if (!toEmail) return NextResponse.json({ error: 'No recipient email' }, { status: 400 })

  // AI executive summary
  const summaryPrompt = `Write a 3-sentence executive summary for ${clientName}'s ${period} performance report.
Data: Spend ${fmt(curr.spend,'$')}, ROAS ${fmt(curr.roas,'x')}, Conversions ${fmt(curr.conv)}, Sessions ${fmt(curr.sessions)}.
${(alerts||[]).length > 0 ? 'Alerts: ' + (alerts||[]).map((a:any)=>a.title).join(', ') : ''}
${(recs||[]).filter((r:any)=>r.priority==='high').length > 0 ? 'High priority opportunities: ' + (recs||[]).filter((r:any)=>r.priority==='high').map((r:any)=>r.title).join(', ') : ''}
Be specific, confident, and concise. Focus on performance vs prior period and top opportunity.`

  const summaryMsg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 300,
    messages: [{ role:'user', content: summaryPrompt }],
    system: 'Write a professional marketing performance summary. 3 sentences max. No markdown.'
  })
  const summary = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : ''

  // Build HTML email
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden">

  <!-- Header -->
  <tr><td style="background:#0a0a0a;padding:22px 28px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:18px;font-weight:700;color:#fff">${agName}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:2px">Performance Report · ${days}-day summary</div></td>
      <td style="text-align:right"><div style="font-size:13px;color:rgba(255,255,255,.4)">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div></td>
    </tr></table>
  </td></tr>

  <!-- Client + summary -->
  <tr><td style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
    <div style="font-size:11px;font-weight:700;color:${agColor};text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Client</div>
    <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:16px">${clientName}</div>
    <div style="background:#f9fafb;border-radius:12px;padding:16px 18px;border-left:3px solid ${agColor}">
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">${summary}</p>
    </div>
  </td></tr>

  <!-- Alerts -->
  ${(alerts||[]).length > 0 ? `
  <tr><td style="padding:20px 28px 0;border-bottom:1px solid #f3f4f6">
    <div style="font-size:11px;font-weight:700;color:#ea2729;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Alerts requiring attention</div>
    ${(alerts||[]).map((a:any)=>`<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;padding:10px 14px;background:#fef2f2;border-radius:10px;border-left:3px solid #ea2729">
      <div style="font-size:14px;color:#374151">${a.title}: ${a.detail||''}</div>
    </div>`).join('')}
  </td></tr>` : ''}

  <!-- KPI table -->
  <tr><td style="padding:24px 28px">
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Performance — last ${days} days vs prior ${days} days</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <thead><tr style="background:#f9fafb">
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#374151;text-align:left;text-transform:uppercase">Metric</th>
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#374151;text-align:right;text-transform:uppercase">This period</th>
        <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#374151;text-align:right;text-transform:uppercase">vs prior</th>
      </tr></thead>
      <tbody>
        ${statRow('Ad Spend',curr.spend,prev_.spend,'$')}
        ${statRow('ROAS',curr.roas,prev_.roas,'x')}
        ${statRow('Conversions',curr.conv,prev_.conv)}
        ${statRow('Paid Clicks',curr.clicks,null)}
        ${statRow('Organic Sessions',curr.sessions,prev_.sessions)}
        ${statRow('Search Console Clicks',curr.gscClicks,null)}
        ${statRow('GMB Searches',curr.gmbSearches,null)}
      </tbody>
    </table>
  </td></tr>

  <!-- Top campaigns -->
  ${(campaigns||[]).length > 0 ? `
  <tr><td style="padding:0 28px 24px">
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Top campaigns</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <thead><tr style="background:#f9fafb">
        <th style="padding:8px 14px;font-size:11px;color:#374151;text-align:left;text-transform:uppercase">Campaign</th>
        <th style="padding:8px 14px;font-size:11px;color:#374151;text-align:right;text-transform:uppercase">Spend</th>
        <th style="padding:8px 14px;font-size:11px;color:#374151;text-align:right;text-transform:uppercase">ROAS</th>
        <th style="padding:8px 14px;font-size:11px;color:#374151;text-align:right;text-transform:uppercase">Conv</th>
      </tr></thead>
      <tbody>
        ${(campaigns||[]).map((c:any,i:number)=>`<tr style="border-top:${i>0?'1px solid #f3f4f6':'none'}">
          <td style="padding:10px 14px;font-size:13px;color:#111;font-weight:600">${c.name}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right">${fmt(c.cost,'$')}</td>
          <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:${(c.roas||0)>=3?'#16a34a':(c.roas||0)>=1.5?'#f59e0b':'#ea2729'}">${fmt(c.roas,'x')}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right">${fmt(c.conversions)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </td></tr>` : ''}

  <!-- Top recommendations -->
  ${(recs||[]).filter((r:any)=>r.status==='pending').length > 0 ? `
  <tr><td style="padding:0 28px 24px">
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Top AI recommendations</div>
    ${(recs||[]).filter((r:any)=>r.status==='pending').slice(0,5).map((r:any)=>`
    <div style="margin-bottom:10px;padding:12px 16px;background:${r.priority==='high'?'#fef2f2':r.priority==='medium'?'#fffbeb':'#f9fafb'};border-radius:10px;border-left:3px solid ${r.priority==='high'?'#ea2729':r.priority==='medium'?'#f59e0b':'#6b7280'}">
      <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px">${r.title}</div>
      <div style="font-size:13px;color:#374151">${r.description?.slice(0,150)}${(r.description?.length||0)>150?'…':''}</div>
      ${r.est_impact?`<div style="margin-top:6px;font-size:12px;font-weight:700;color:#16a34a">${r.est_impact}</div>`:''}
    </div>`).join('')}
    <div style="margin-top:12px;text-align:center">
      <a href="${APP}/perf" style="display:inline-block;padding:11px 24px;background:#ea2729;color:#fff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">View Full Dashboard →</a>
    </div>
  </td></tr>` : ''}

  <!-- Changes made -->
  ${(execLog||[]).length > 0 ? `
  <tr><td style="padding:0 28px 24px;border-top:1px solid #f3f4f6">
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 10px">Changes applied this period</div>
    ${(execLog||[]).map((l:any)=>`<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
      <div style="width:8px;height:8px;border-radius:50%;background:${l.status==='success'?'#16a34a':'#ea2729'};flex-shrink:0;margin-top:5px"></div>
      <div style="font-size:13px;color:#374151">${l.rec_title} — ${l.detail?.slice(0,100)||''}</div>
    </div>`).join('')}
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">Performance report from ${agName} · Powered by Koto · <a href="${APP}" style="color:#ea2729;text-decoration:none">View Dashboard</a></p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`

  // Send the email
  const emailResult = await getResend().emails.send({
    from:    FROM,
    to:      toEmail,
    subject: `${clientName} — ${days}-day Performance Report · ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,
    html,
  })

  return NextResponse.json({ sent: true, to: toEmail, email_id: emailResult.data?.id })
}