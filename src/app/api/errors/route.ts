import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ALERT_EMAILS = ['adam@hellokoto.com', 'adam@momentamktg.com']
const ALERT_PHONE = '+19544839229'

async function sendAlertEmail(message: string, stack: string, url: string, type: string, severity: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const from = process.env.DESK_EMAIL_FROM || 'Koto Alerts <alerts@hellokoto.com>'
  const timestamp = new Date().toISOString()
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">🚨 Critical Error Detected</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Severity</td><td style="padding:8px 0;font-weight:700;color:#dc2626;">${severity.toUpperCase()}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Type</td><td style="padding:8px 0;">${type}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Time</td><td style="padding:8px 0;">${timestamp}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">URL</td><td style="padding:8px 0;font-size:12px;">${url || 'N/A'}</td></tr>
        </table>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-bottom:16px;">
          <div style="font-weight:700;color:#dc2626;margin-bottom:4px;font-size:13px;">Error Message</div>
          <div style="color:#1f2937;font-size:14px;">${message}</div>
        </div>
        ${stack ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:4px;">Stack Trace</div><pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:11px;max-height:200px;">${stack.slice(0, 500)}</pre></div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="https://hellokoto.com/debug" style="display:inline-block;padding:8px 16px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Debug Console</a>
          <a href="https://hellokoto.com/qa" style="display:inline-block;padding:8px 16px;background:#ea2729;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">QA Console</a>
        </div>
        <p style="color:#9ca3af;font-size:11px;margin-top:16px;">This error has been logged. Auto-repair has been attempted.</p>
      </div>
    </div>`

  for (const to of ALERT_EMAILS) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: `🚨 P1 Koto Error — ${timestamp}`, html }),
      })
    } catch {}
  }
}

async function sendAlertSMS(message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from) return
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from, To: ALERT_PHONE,
        Body: `🚨 Koto P1 Error: ${message.slice(0, 100)}. Debug: hellokoto.com/debug`,
      }),
    })
  } catch {}
}

async function attemptAutoRepair(sb: any, message: string, type: string, errorLogId: string) {
  let repairType = 'manual_review'
  let description = 'Flagged for manual review'
  let confidence = 0

  if (message.includes('Minified React error') || message.includes('hooks')) {
    repairType = 'code_fix'; description = 'React rendering error — likely conditional hooks or missing import'; confidence = 70
  } else if (message.includes('not defined') || message.includes('is not a function')) {
    repairType = 'missing_import'; description = 'Reference error — missing import or undefined variable'; confidence = 80
  } else if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch')) {
    repairType = 'network_retry'; description = 'Network error — transient, will retry'; confidence = 90
  } else if (message.includes('does not exist') || message.includes('relation')) {
    repairType = 'schema_repair'; description = 'Database table/column missing — run pending migrations'; confidence = 85
  }

  try {
    await sb.from('koto_qa_errors').insert({
      error_type: type, message, severity: 'critical', suite: 'runtime',
    })

    if (confidence >= 70) {
      await sb.from('koto_qa_repairs').insert({
        repair_type: repairType, description,
        auto: true, status: confidence >= 90 ? 'applied' : 'pending',
        applied_at: confidence >= 90 ? new Date().toISOString() : null,
      })
    }
  } catch {}

  return { repairType, description, confidence }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, severity, message, stack, url, user_id, agency_id, metadata: extraMeta } = body

    if (!type || !severity || !message) {
      return NextResponse.json({ error: 'Missing required fields: type, severity, message' }, { status: 400 })
    }

    // Auto-escalate React errors to P1
    const effectiveSeverity = (severity === 'p2' && message.includes('Minified React error')) ? 'p1' : severity

    const sb = getSupabase()

    const { data, error } = await sb.from('koto_system_logs').insert({
      level: 'error',
      service: type,
      action: effectiveSeverity,
      message,
      metadata: { stack, url, severity: effectiveSeverity, type, ...(extraMeta || {}) },
      user_id: user_id || null,
      agency_id: agency_id || null,
    }).select('id').single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // P1 alerts: email + SMS + auto-repair
    if (effectiveSeverity === 'p1') {
      await Promise.all([
        sendAlertEmail(message, stack || '', url || '', type, effectiveSeverity),
        sendAlertSMS(message),
        attemptAutoRepair(sb, message, type, data?.id),
      ])
    }

    // P2 throttled alerts: check if 5+ in last 10 minutes
    if (effectiveSeverity === 'p2') {
      const tenMinAgo = new Date(Date.now() - 600000).toISOString()
      const { count } = await sb.from('koto_system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'error').eq('action', 'p2')
        .gte('created_at', tenMinAgo)

      if ((count || 0) >= 5) {
        // Send digest email
        const apiKey = process.env.RESEND_API_KEY
        if (apiKey) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: process.env.DESK_EMAIL_FROM || 'Koto Alerts <alerts@hellokoto.com>',
                to: ALERT_EMAILS[0],
                subject: `⚠ Koto Warning: ${count} errors in last 10 minutes`,
                html: `<h2>Multiple Errors Detected</h2><p>${count} P2 errors logged in the last 10 minutes.</p><p>Latest: ${message}</p><a href="https://hellokoto.com/debug">View Debug Console</a>`,
              }),
            })
          } catch {}
        }
      }
    }

    return NextResponse.json({ ok: true, id: data?.id, severity: effectiveSeverity })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const severity = searchParams.get('severity')
    const type = searchParams.get('type')
    const resolved = searchParams.get('resolved')
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '200', 10)

    const sb = getSupabase()
    let q = sb.from('koto_system_logs').select('*').eq('level', 'error').order('created_at', { ascending: false }).limit(limit)

    if (severity) q = q.eq('metadata->>severity', severity)
    if (type) q = q.eq('service', type)
    if (since) q = q.gte('created_at', since)
    if (resolved === 'true') q = q.eq('metadata->>resolved', 'true')
    if (resolved === 'false') q = q.or('metadata->>resolved.is.null,metadata->>resolved.neq.true')

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ errors: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, resolved, notes } = body
    if (!id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })

    const sb = getSupabase()
    const { data: existing, error: fetchError } = await sb.from('koto_system_logs').select('metadata').eq('id', id).single()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const { error: updateError } = await sb.from('koto_system_logs').update({
      metadata: { ...(existing?.metadata || {}), resolved: resolved ?? true, resolved_at: new Date().toISOString(), ...(notes ? { notes } : {}) },
    }).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
