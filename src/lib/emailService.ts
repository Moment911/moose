import 'server-only' // fails the build if this module is ever imported from a client component
async function logComm(params: {
  channel: string; recipient: string; subject?: string;
  body_preview?: string; status: string; provider: string;
  provider_id?: string; error_message?: string; agency_id?: string;
}) {
  try {
    await fetch((process.env.NEXT_PUBLIC_SITE_URL || '') + '/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_comm', ...params }),
    })
  } catch {}
}

async function resolveAgencySender(agencyId?: string): Promise<{ from: string; replyTo?: string }> {
  const defaultFrom = process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>'
  if (!agencyId) return { from: defaultFrom }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    const { data } = await sb.from('agencies')
      .select('sender_name, sender_email, reply_to_email, email_domain_verified')
      .eq('id', agencyId).single()
    if (data?.sender_email && data?.email_domain_verified) {
      return {
        from: `${data.sender_name || 'Agency'} <${data.sender_email}>`,
        replyTo: data.reply_to_email || data.sender_email,
      }
    }
    if (data?.sender_email) {
      return { from: defaultFrom, replyTo: data.reply_to_email || data.sender_email }
    }
  } catch {}
  return { from: defaultFrom }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  agencyId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'Resend not configured' }
  const sender = await resolveAgencySender(agencyId)
  const from = sender.from
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, ...(sender.replyTo ? { reply_to: sender.replyTo } : {}) }),
    })
    const data = await res.json()
    const result = res.ok ? { success: true, id: data.id } : { success: false, error: data.message }

    logComm({
      channel: 'email', recipient: to, subject,
      body_preview: subject, status: result.success ? 'sent' : 'failed',
      provider: 'resend', provider_id: data.id,
      error_message: result.error, agency_id: agencyId,
    })

    return result
  } catch (e: any) {
    logComm({
      channel: 'email', recipient: to, subject,
      status: 'failed', provider: 'resend',
      error_message: e.message, agency_id: agencyId,
    })
    return { success: false, error: e.message }
  }
}

// --- Email Template Functions ---

export function appointmentConfirmationEmail(
  name: string,
  closerName: string,
  closerTitle: string,
  datetime: string,
  calendarUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 24px;">Appointment Confirmed</h1>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
        Hi ${name},
      </p>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
        Your appointment with <strong>${closerName}</strong> (${closerTitle}) has been confirmed.
      </p>
      <div style="background: #f0f4ff; border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 8px;">
          ${datetime}
        </p>
      </div>
      <a href="${calendarUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; margin: 16px 0;">
        Add to Calendar
      </a>
      <p style="color: #9a9a9a; font-size: 13px; margin: 24px 0 0; line-height: 1.5;">
        If you need to reschedule, please reply to this email or contact us directly.
      </p>
    </div>
  </div>
</body>
</html>`.trim()
}

export function inboundCallSummaryEmail(
  agencyName: string,
  callerName: string,
  callerPhone: string,
  summary: string,
  intakeData: Record<string, string>,
  urgency: string,
  duration: string
): string {
  const urgencyColor =
    urgency === 'high' ? '#dc2626' : urgency === 'medium' ? '#f59e0b' : '#22c55e'

  const intakeRows = Object.entries(intakeData)
    .map(
      ([key, value]) =>
        `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #6b7280; font-size: 14px;">${key}</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px;">${value}</td></tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px;">Inbound Call Summary</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">${agencyName}</p>

      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Caller</p>
          <p style="color: #1a1a1a; font-size: 16px; font-weight: 600; margin: 0;">${callerName}</p>
          <p style="color: #4a4a4a; font-size: 14px; margin: 4px 0 0;">${callerPhone}</p>
        </div>
        <div>
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Duration</p>
          <p style="color: #1a1a1a; font-size: 16px; font-weight: 600; margin: 0;">${duration}</p>
        </div>
        <div>
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Urgency</p>
          <span style="display: inline-block; background: ${urgencyColor}20; color: ${urgencyColor}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; text-transform: capitalize;">${urgency}</span>
        </div>
      </div>

      <div style="background: #f9fafb; border-radius: 6px; padding: 20px; margin: 0 0 24px;">
        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Summary</p>
        <p style="color: #1a1a1a; font-size: 15px; line-height: 1.6; margin: 0;">${summary}</p>
      </div>

      ${
        intakeRows
          ? `<table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
        <thead>
          <tr>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Field</th>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Value</th>
          </tr>
        </thead>
        <tbody>${intakeRows}</tbody>
      </table>`
          : ''
      }
    </div>
  </div>
</body>
</html>`.trim()
}

export function dailyCallReportEmail(
  agencyName: string,
  date: string,
  stats: {
    totalCalls: number
    answeredCalls: number
    missedCalls: number
    avgDuration: string
    totalDuration: string
    appointmentsBooked: number
    topReasons?: string[]
  }
): string {
  const answerRate =
    stats.totalCalls > 0 ? Math.round((stats.answeredCalls / stats.totalCalls) * 100) : 0

  const topReasonsHtml = stats.topReasons
    ? stats.topReasons
        .map(
          (reason, i) =>
            `<li style="color: #4a4a4a; font-size: 14px; line-height: 1.8;">${i + 1}. ${reason}</li>`
        )
        .join('')
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px;">Daily Call Report</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">${agencyName}</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 32px;">${date}</p>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px;">
        <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Total Calls</p>
          <p style="color: #2563eb; font-size: 28px; font-weight: 700; margin: 0;">${stats.totalCalls}</p>
        </div>
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Answered</p>
          <p style="color: #22c55e; font-size: 28px; font-weight: 700; margin: 0;">${stats.answeredCalls}</p>
        </div>
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Missed</p>
          <p style="color: #dc2626; font-size: 28px; font-weight: 700; margin: 0;">${stats.missedCalls}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280; font-size: 14px;">Answer Rate</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">${answerRate}%</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280; font-size: 14px;">Avg Duration</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">${stats.avgDuration}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280; font-size: 14px;">Total Talk Time</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">${stats.totalDuration}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280; font-size: 14px;">Appointments Booked</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">${stats.appointmentsBooked}</td>
        </tr>
      </table>

      ${
        topReasonsHtml
          ? `<div style="margin-bottom: 24px;">
        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Top Call Reasons</p>
        <ol style="margin: 0; padding-left: 0; list-style: none;">${topReasonsHtml}</ol>
      </div>`
          : ''
      }
    </div>
  </div>
</body>
</html>`.trim()
}
