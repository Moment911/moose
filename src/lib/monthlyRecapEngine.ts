import 'server-only'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { logTokenUsage } from './tokenTracker'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const resend = new Resend(process.env.RESEND_API_KEY || '')

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

interface RecapData {
  clientName: string
  agencyName: string
  month: string
  projects: { total: number; new: number; completed: number }
  annotations: { total: number; resolved: number; pending: number }
  tasks: { total: number; completed: number; open: number }
  reviews: { total: number; avgRating: number }
  tickets: { opened: number; resolved: number }
  highlights: string[]
  nextSteps: string[]
}

export async function generateMonthlyRecap(clientId: string, agencyId: string, month?: Date): Promise<{ sent: boolean; error?: string }> {
  const s = sb()
  const now = month || new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const monthStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Load client + agency
  const [{ data: client }, { data: agency }] = await Promise.all([
    s.from('clients').select('name, email, brand_kit, notification_prefs').eq('id', clientId).single(),
    s.from('agencies').select('name, brand_name, brand_color, brand_logo_url, owner_email').eq('id', agencyId).single(),
  ])

  if (!client || !agency) return { sent: false, error: 'Client or agency not found' }

  // Check notification preferences
  const prefs = client.notification_prefs || {}
  if (prefs.monthly_recap === false) return { sent: false, error: 'Monthly recap disabled' }

  // Find client user email
  const { data: clientUsers } = await s.from('koto_client_users').select('user_id').eq('client_id', clientId).limit(5)
  let recipientEmails: string[] = []
  if (clientUsers?.length) {
    const { data: { users } } = await s.auth.admin.listUsers()
    const userMap: Record<string, string> = {}
    users?.forEach((u: any) => { userMap[u.id] = u.email })
    recipientEmails = clientUsers.map(cu => userMap[cu.user_id]).filter(Boolean)
  }
  if (!recipientEmails.length && client.email) recipientEmails = [client.email]
  if (!recipientEmails.length) return { sent: false, error: 'No email found for client' }

  // Gather stats for the month
  const range = { gte: firstOfMonth.toISOString(), lte: lastOfMonth.toISOString() }

  const [projRes, annRes, taskRes, ticketRes] = await Promise.all([
    s.from('projects').select('id, name, created_at, status').eq('client_id', clientId),
    s.from('annotations').select('id, status, created_at, files!inner(project_id, projects!inner(client_id))').eq('files.projects.client_id', clientId).limit(500),
    s.from('tasks').select('id, status, created_at, completed_at').eq('client_id', clientId),
    s.from('desk_tickets').select('id, status, created_at').eq('agency_id', agencyId).gte('created_at', range.gte).lte('created_at', range.lte),
  ])

  const projects = projRes.data || []
  const newProjects = projects.filter(p => p.created_at >= range.gte && p.created_at <= range.lte)
  const annotations = annRes.data || []
  const resolvedAnns = annotations.filter(a => a.status === 'completed')
  const pendingAnns = annotations.filter(a => a.status !== 'completed')
  const tasks = taskRes.data || []
  const completedTasks = tasks.filter(t => t.completed_at && t.completed_at >= range.gte)
  const openTasks = tasks.filter(t => t.status === 'open')
  const tickets = ticketRes.data || []
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed')

  const recapData: RecapData = {
    clientName: client.name,
    agencyName: agency.brand_name || agency.name,
    month: monthStr,
    projects: { total: projects.length, new: newProjects.length, completed: projects.filter(p => p.status === 'completed').length },
    annotations: { total: annotations.length, resolved: resolvedAnns.length, pending: pendingAnns.length },
    tasks: { total: tasks.length, completed: completedTasks.length, open: openTasks.length },
    reviews: { total: 0, avgRating: 0 },
    tickets: { opened: tickets.length, resolved: resolvedTickets.length },
    highlights: [],
    nextSteps: [],
  }

  // Generate AI highlights + next steps
  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: 'Generate a monthly recap email summary. Return JSON with "highlights" (3-4 achievements) and "next_steps" (2-3 recommendations). Keep it warm, professional, and specific.',
    messages: [{ role: 'user', content: `Client: ${client.name}\nMonth: ${monthStr}\nStats: ${JSON.stringify(recapData)}\n\nGenerate highlights and next steps as JSON: { "highlights": ["..."], "next_steps": ["..."] }` }],
  })

  void logTokenUsage({
    feature: 'monthly_recap',
    model: 'claude-haiku-4-5-20251001',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId,
  })

  try {
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    recapData.highlights = parsed.highlights || []
    recapData.nextSteps = parsed.next_steps || []
  } catch { /* use empty */ }

  // Build HTML email
  const brandColor = client.brand_kit?.colors?.primary || agency.brand_color || '#E6007E'
  const html = buildRecapEmail(recapData, brandColor, agency.brand_logo_url)

  // Send email
  try {
    await resend.emails.send({
      from: `${agency.brand_name || agency.name} <noreply@hellokoto.com>`,
      to: recipientEmails,
      subject: `Your ${monthStr} Marketing Recap — ${agency.brand_name || agency.name}`,
      html,
    })
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e.message }
  }
}

function buildRecapEmail(data: RecapData, brandColor: string, logoUrl?: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px">
  <tr><td style="background:${brandColor};padding:32px 24px;text-align:center">
    ${logoUrl ? `<img src="${logoUrl}" alt="" style="height:40px;margin-bottom:12px">` : ''}
    <h1 style="color:#fff;font-size:24px;margin:0;font-weight:800">Monthly Recap</h1>
    <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">${data.month} — ${data.clientName}</p>
  </td></tr>
  <tr><td style="padding:32px 24px">
    <h2 style="font-size:18px;color:#111;margin:0 0 16px">Highlights</h2>
    ${data.highlights.map(h => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:14px;color:#374151;line-height:1.5">
      <span style="color:${brandColor};font-size:18px;line-height:1">&#10003;</span>
      <span>${h}</span>
    </div>`).join('')}
  </td></tr>
  <tr><td style="padding:0 24px 24px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:16px;background:#f9fafb;border-radius:10px;text-align:center;width:33%">
          <div style="font-size:28px;font-weight:900;color:${brandColor}">${data.projects.total}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Projects</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:16px;background:#f9fafb;border-radius:10px;text-align:center;width:33%">
          <div style="font-size:28px;font-weight:900;color:${brandColor}">${data.annotations.resolved}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Items Completed</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:16px;background:#f9fafb;border-radius:10px;text-align:center;width:33%">
          <div style="font-size:28px;font-weight:900;color:${brandColor}">${data.tasks.completed}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Tasks Done</div>
        </td>
      </tr>
    </table>
  </td></tr>
  ${data.nextSteps.length ? `<tr><td style="padding:0 24px 32px">
    <h2 style="font-size:18px;color:#111;margin:0 0 16px">Coming Up Next</h2>
    ${data.nextSteps.map(s => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:14px;color:#374151;line-height:1.5">
      <span style="color:${brandColor};font-size:16px">&#9654;</span>
      <span>${s}</span>
    </div>`).join('')}
  </td></tr>` : ''}
  <tr><td style="padding:0 24px 32px;text-align:center">
    <a href="https://hellokoto.com/login" style="display:inline-block;padding:14px 32px;background:${brandColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">View Your Dashboard</a>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9ca3af;margin:0">Powered by ${data.agencyName}</p>
  </td></tr>
</table></body></html>`
}
