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

function buildOnboardingEmail(opts: {
  clientName: string, agencyName: string, agencyLogo?: string,
  brandColor: string, onboardingUrl: string, contactName?: string
}) {
  const color = opts.brandColor || '#ea2729'
  const logo  = opts.agencyLogo
    ? `<img src="${opts.agencyLogo}" alt="${opts.agencyName}" style="height:32px;max-width:180px;object-fit:contain;"/>`
    : `<div style="font-size:18px;font-weight:900;color:#fff;">${opts.agencyName}</div>`
  const greeting = opts.contactName ? `Hi ${opts.contactName},` : `Hi there,`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.08);">
  <tr><td style="background:#0a0a0a;padding:20px 28px;">${logo}</td></tr>
  <tr><td style="padding:32px 28px;">
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#111;">Welcome to ${opts.agencyName}! 🎉</h1>
    <p style="margin:0 0 8px;font-size:16px;color:#374151;line-height:1.7;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.7;">
      We're excited to work with ${opts.clientName}. To get started, we need a few details about your business so we can build the best possible strategy for you.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      It only takes about 10–15 minutes and will unlock your personalized marketing dashboard.
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${opts.onboardingUrl}" style="display:inline-block;padding:15px 32px;border-radius:12px;background:${color};color:#fff;font-size:16px;font-weight:800;text-decoration:none;">
        Complete Your Onboarding →
      </a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      This link is unique to your account. Questions? Reply to this email and we'll help you out.
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:14px 28px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${opts.agencyName} · <a href="${APP_URL}" style="color:#9ca3af;">${APP_URL}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const { action, client_id, agency_id } = await req.json()
    const sb = getSupabase()

    // ── Send onboarding link to client ──────────────────────────────────────
    if (action === 'send_link') {
      const [{ data: client }, { data: agency }] = await Promise.all([
        sb.from('clients').select('*').eq('id', client_id).single(),
        sb.from('agencies').select('*').eq('id', agency_id).single(),
      ])
      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      if (!client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })

      // Find or create onboarding token from access_forms table
      const { data: existing } = await sb.from('access_forms')
        .select('token').eq('client_id', client_id).eq('status', 'pending').single()

      let token = existing?.token
      if (!token) {
        // Create new access form / onboarding token
        const newToken = crypto.randomUUID().replace(/-/g, '')
        const { error: insErr } = await sb.from('access_forms').insert({
          client_id, agency_id,
          token: newToken,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        if (insErr) {
          // access_forms might not exist — try onboarding_tokens table
          const { data: tok } = await sb.from('onboarding_tokens').insert({
            client_id, agency_id, token: newToken,
          }).select().single()
          token = tok?.token || newToken
        } else {
          token = newToken
        }
      }

      const onboardingUrl = `${APP_URL}/onboarding/${token}`
      const brandColor    = agency?.brand_color || '#ea2729'
      const agencyName    = agency?.brand_name  || agency?.name || 'Your Agency'
      const contactName   = client.name?.split(' ')?.[0]

      const html = buildOnboardingEmail({
        clientName: client.name, agencyName, contactName,
        agencyLogo: agency?.brand_logo_url, brandColor, onboardingUrl,
      })

      const from = agency?.support_email
        ? `${agencyName} <${agency.support_email}>`
        : `${agencyName} <onboarding@hellokoto.com>`

      await getResend().emails.send({
        from, to: client.email,
        subject: `Welcome to ${agencyName} — Complete Your Onboarding`,
        html,
      })

      // Mark client as onboarding_sent
      await sb.from('clients').update({
        onboarding_sent_at: new Date().toISOString(),
        onboarding_token:   token,
        status: client.status === 'prospect' ? 'active' : client.status,
      }).eq('id', client_id)

      return NextResponse.json({ sent: true, token, onboarding_url: onboardingUrl })
    }

    // ── Called when onboarding form is submitted ─────────────────────────────
    if (action === 'complete') {
      const { form_data } = await req.json().catch(() => ({ form_data: {} }))

      // Mark client onboarding complete
      await sb.from('clients').update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_status: 'complete',
      }).eq('id', client_id)

      // Auto-create agent config from onboarding answers
      const { data: existing } = await sb.from('agent_configs')
        .select('id').eq('client_id', client_id).single()

      if (!existing) {
        const { data: client } = await sb.from('clients').select('*').eq('id', client_id).single()

        // Map onboarding answers to agent config
        const goals: string[] = []
        if (form_data?.marketing_goals?.includes('reviews'))    goals.push('increase_reviews')
        if (form_data?.marketing_goals?.includes('seo'))        goals.push('rank_top3')
        if (form_data?.marketing_goals?.includes('traffic'))    goals.push('grow_traffic')
        if (form_data?.marketing_goals?.includes('leads'))      goals.push('generate_leads')
        if (form_data?.marketing_goals?.includes('ppc'))        goals.push('ppc_roi')
        if (goals.length === 0) goals.push('rank_top3', 'increase_reviews', 'generate_leads')

        await sb.from('agent_configs').insert({
          client_id,
          agency_id,
          enabled: true,
          onboarding_done: true,
          business_goals:    goals,
          target_keywords:   form_data?.target_keywords || [],
          competitors:       form_data?.competitors?.map((c: any) => c.website || c.name).filter(Boolean) || [],
          service_area:      form_data?.service_area || [client?.city, client?.state].filter(Boolean).join(', '),
          monthly_budget:    parseFloat(form_data?.monthly_budget) || null,
          ad_budget:         parseFloat(form_data?.ad_budget) || null,
          primary_channel:   form_data?.primary_channel || 'both',
          business_type:     form_data?.business_type || 'b2c',
          avg_ticket_value:  parseFloat(form_data?.avg_transaction || form_data?.avg_ticket_value) || null,
          schedule_weekly:   true,
          schedule_monthly:  true,
          alert_review_new:  true,
        })
      }

      // Trigger first agent analysis (fire and forget)
      fetch(`${APP_URL}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, agency_id, run_type: 'onboarding' }),
      }).catch(() => {}) // don't await — run in background

      return NextResponse.json({ ok: true, agent_configured: !existing })
    }

    // ── Get onboarding status for all clients ────────────────────────────────
    if (action === 'status') {
      const { data: clients } = await sb.from('clients')
        .select('id,name,email,status,onboarding_sent_at,onboarding_completed_at,onboarding_status')
        .eq('agency_id', agency_id)
        .order('created_at', { ascending: false })
      return NextResponse.json({ clients: clients || [] })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
