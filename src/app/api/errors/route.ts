import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, severity, message, stack, url, user_id, agency_id, metadata: extraMeta } = body

    if (!type || !severity || !message) {
      return NextResponse.json({ error: 'Missing required fields: type, severity, message' }, { status: 400 })
    }

    const sb = getSupabase()

    const { data, error } = await sb.from('koto_system_logs').insert({
      level: 'error',
      service: type,
      action: severity,
      message,
      metadata: {
        stack,
        url,
        severity,
        type,
        ...(extraMeta || {}),
      },
      user_id: user_id || null,
      agency_id: agency_id || null,
    }).select('id').single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send P1 alert email via Resend
    if (severity === 'p1') {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY || '')
        await resend.emails.send({
          from: process.env.DESK_EMAIL_FROM || 'alerts@hellokoto.com',
          to: 'adam@hellokoto.com',
          subject: `🚨 P1 Error - ${message.slice(0, 120)}`,
          html: `<h2>P1 Error Alert</h2>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>URL:</strong> ${url || 'N/A'}</p>
            ${stack ? `<pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${stack}</pre>` : ''}
            <p style="color:#9ca3af;font-size:12px;">Logged at ${new Date().toISOString()}</p>`,
        })
      } catch (emailErr: any) {
        console.error('Failed to send P1 alert email:', emailErr.message)
      }
    }

    return NextResponse.json({ ok: true, id: data?.id })
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
    const user_id = searchParams.get('user_id')
    const agency_id = searchParams.get('agency_id')
    const limit = parseInt(searchParams.get('limit') || '200', 10)

    const sb = getSupabase()

    let q = sb
      .from('koto_system_logs')
      .select('*')
      .eq('level', 'error')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (severity) q = q.eq('metadata->>severity', severity)
    if (type) q = q.eq('service', type)
    if (since) q = q.gte('created_at', since)
    if (user_id) q = q.eq('user_id', user_id)
    if (agency_id) q = q.eq('agency_id', agency_id)
    if (resolved === 'true') q = q.eq('metadata->>resolved', 'true')
    if (resolved === 'false') q = q.or('metadata->>resolved.is.null,metadata->>resolved.neq.true')

    const { data, error } = await q

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ errors: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, resolved, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    const sb = getSupabase()

    // Fetch current metadata
    const { data: existing, error: fetchError } = await sb
      .from('koto_system_logs')
      .select('metadata')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const updatedMetadata = {
      ...(existing?.metadata || {}),
      resolved: resolved ?? true,
      resolved_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    }

    const { error: updateError } = await sb
      .from('koto_system_logs')
      .update({ metadata: updatedMetadata })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
