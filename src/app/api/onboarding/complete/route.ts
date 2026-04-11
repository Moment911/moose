// ─────────────────────────────────────────────────────────────
// /api/onboarding/complete
//
// Sends the completion email + PDF summary to BOTH the agency
// and the client when an onboarding finishes. Triggered from
// two places:
//   1. /api/onboarding "complete" action (form submission)
//   2. /api/onboarding/voice call_ended (when all priority
//      fields are captured)
//
// Action: 'send_completion_email'
//   Body: { client_id, agency_id }
//   Loads full client + agency, generates PDF via
//   buildOnboardingPdf, sends two Resend emails (one to the
//   agency, one to the client), idempotent — sets
//   completion_email_sent_at on the client row to avoid
//   double-sending.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildOnboardingPdf } from '../../../../lib/onboardingPdf'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '')
}

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, client_id, agency_id, force } = body

    if (action !== 'send_completion_email') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    }

    const sb = getSupabase()

    // Step 1 — load full client + agency
    const { data: client, error: clientErr } = await sb
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .maybeSingle()
    if (clientErr || !client) {
      console.warn('[onboarding/complete] client not found:', client_id, clientErr?.message)
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Idempotency guard — don't double-send unless caller forces it
    if (!force && (client as any).completion_email_sent_at) {
      console.log('[onboarding/complete] already sent for', client_id)
      return NextResponse.json({ ok: true, skipped: true, reason: 'already_sent' })
    }

    const resolvedAgencyId = agency_id || (client as any).agency_id
    let agency: any = null
    if (resolvedAgencyId) {
      const { data: agencyRow } = await sb
        .from('agencies')
        .select('*')
        .eq('id', resolvedAgencyId)
        .maybeSingle()
      agency = agencyRow
    }

    const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
    const primaryColor = agency?.primary_color || agency?.brand_color || '#00C2CB'
    const fromEmail = agency?.support_email || 'onboarding@hellokoto.com'
    const fromAddress = `${agencyName} <${fromEmail}>`
    const clientName = (client as any).name || 'Client'
    const ownerName = (client as any).owner_name || ''
    const ownerFirst = ownerName.split(' ')[0] || 'there'

    // Step 2 — generate PDF
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await buildOnboardingPdf({
        client,
        agency: {
          name: agency?.name,
          brand_name: agency?.brand_name,
          logo_url: agency?.logo_url || agency?.brand_logo_url,
          primary_color: primaryColor,
          website: agency?.website,
        },
      })
    } catch (e: any) {
      console.warn('[onboarding/complete] PDF generation failed:', e?.message)
      return NextResponse.json({ error: 'PDF generation failed', detail: e?.message }, { status: 500 })
    }

    const pdfFilename = `${clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-onboarding-summary.pdf`

    // Step 3 — pull highlights for the email body
    const welcomeBlurb = String((client as any).welcome_statement || '').slice(0, 220).trim()
    const cityState = [(client as any).city, (client as any).state].filter(Boolean).join(', ')
    const primaryService = (client as any).primary_service || '—'
    const monthlyBudget = (client as any).marketing_budget || '—'
    const topGoal = String((client as any).notes || '').split('.')[0]?.slice(0, 200) || '—'

    // Count fields captured
    const ALL_FIELDS = [
      'welcome_statement', 'owner_name', 'primary_service', 'target_customer',
      'city', 'notes', 'phone', 'website', 'industry', 'num_employees',
      'marketing_budget', 'crm_used', 'unique_selling_prop', 'referral_sources',
      'email', 'address', 'year_founded', 'secondary_services', 'competitor_1',
      'competitor_2', 'brand_voice', 'tagline', 'marketing_channels',
      'avg_deal_size', 'owner_title',
    ]
    const filled = ALL_FIELDS.filter((f) => (client as any)[f] && String((client as any)[f]).trim()).length
    const missing = ALL_FIELDS.length - filled

    const profileUrl = `${APP_URL}/clients/${client_id}`
    const onboardUrl = `${APP_URL}/onboard/${client_id}`

    // Step 4 — send to AGENCY
    const agencyEmail = agency?.email || agency?.notification_email || agency?.support_email
    const sendResults: any = {}
    const resend = getResend()

    if (agencyEmail) {
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,${primaryColor},#0099a8);padding:32px;color:#fff;">
    <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:8px;">${escapeHtml(agencyName)}</div>
    <h1 style="font-size:24px;font-weight:900;margin:0 0 8px;">✅ ${escapeHtml(clientName)} onboarding complete</h1>
    <p style="margin:0;font-size:14px;opacity:.92;">Full summary attached as PDF.</p>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      Hi ${escapeHtml(agencyName)} team,<br/><br/>
      <strong>${escapeHtml(clientName)}</strong> has completed their onboarding. Full summary attached.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 16px;">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;">
      <div style="font-size:11px;font-weight:800;color:#6b7280;letter-spacing:.06em;margin-bottom:10px;">KEY HIGHLIGHTS</div>
      ${welcomeBlurb ? `<div style="font-size:14px;color:#111;margin-bottom:8px;"><strong>Business:</strong> ${escapeHtml(welcomeBlurb)}${welcomeBlurb.length === 220 ? '…' : ''}</div>` : ''}
      ${cityState ? `<div style="font-size:14px;color:#111;margin-bottom:8px;"><strong>Location:</strong> ${escapeHtml(cityState)}</div>` : ''}
      <div style="font-size:14px;color:#111;margin-bottom:8px;"><strong>Primary service:</strong> ${escapeHtml(primaryService)}</div>
      <div style="font-size:14px;color:#111;margin-bottom:8px;"><strong>Marketing budget:</strong> ${escapeHtml(monthlyBudget)}/month</div>
      <div style="font-size:14px;color:#111;"><strong>Top goal:</strong> ${escapeHtml(topGoal)}</div>
    </div>
  </td></tr>

  <tr><td style="padding:0 32px 16px;">
    <div style="background:${primaryColor}10;border:1px solid ${primaryColor}30;border-radius:10px;padding:14px 18px;font-size:13px;color:#111;">
      <strong>${filled}</strong> of <strong>${ALL_FIELDS.length}</strong> fields captured.
      ${missing > 0 ? `<br/><span style="color:#6b7280;">${missing} field${missing === 1 ? '' : 's'} still missing — their onboarding link remains active.</span>` : ''}
    </div>
  </td></tr>

  <tr><td style="padding:8px 32px 24px;text-align:center;">
    <a href="${profileUrl}" style="display:inline-block;padding:12px 26px;border-radius:10px;background:${primaryColor};color:#fff;text-decoration:none;font-weight:800;font-size:14px;margin:4px;">View Client Profile →</a>
    <a href="${onboardUrl}" style="display:inline-block;padding:12px 26px;border-radius:10px;background:#fff;border:1.5px solid ${primaryColor};color:${primaryColor};text-decoration:none;font-weight:800;font-size:14px;margin:4px;">View Onboarding Form →</a>
  </td></tr>

  <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${escapeHtml(agencyName)} · Powered by <a href="https://hellokoto.com" style="color:#9ca3af;text-decoration:none;font-weight:700;">Koto</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

      try {
        const r = await resend.emails.send({
          from: fromAddress,
          to: agencyEmail,
          subject: `✅ ${clientName} onboarding complete — summary inside`,
          html,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
            },
          ],
        })
        sendResults.agency = { ok: true, id: (r as any)?.data?.id || null }
      } catch (e: any) {
        console.warn('[onboarding/complete] agency email failed:', e?.message)
        sendResults.agency = { ok: false, error: e?.message }
      }
    } else {
      sendResults.agency = { ok: false, error: 'no_agency_email' }
    }

    // Step 5 — send to CLIENT (simpler version)
    const clientEmail = (client as any).email || (client as any).owner_email
    if (clientEmail) {
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,${primaryColor},#0099a8);padding:32px;color:#fff;">
    <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:8px;">${escapeHtml(agencyName)}</div>
    <h1 style="font-size:26px;font-weight:900;margin:0 0 8px;">All set, ${escapeHtml(ownerFirst)}! 🎉</h1>
    <p style="margin:0;font-size:15px;opacity:.92;line-height:1.6;">Your onboarding is complete.</p>
  </td></tr>

  <tr><td style="padding:28px 32px 16px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      Thanks for completing your onboarding with <strong>${escapeHtml(agencyName)}</strong>. We've received all your information and our team will be in touch soon.
    </p>
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
      Attached is a copy of what you shared with us — keep it for your records.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 28px;">
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">
      Questions? Reply to this email or contact ${escapeHtml(fromEmail)}.
    </p>
  </td></tr>

  <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${escapeHtml(agencyName)}${agency?.website ? ` · <a href="${escapeHtml(agency.website)}" style="color:#9ca3af;text-decoration:none;">${escapeHtml(agency.website)}</a>` : ''}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

      try {
        const r = await resend.emails.send({
          from: fromAddress,
          to: clientEmail,
          subject: `Your onboarding with ${agencyName} is complete!`,
          html,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
            },
          ],
        })
        sendResults.client = { ok: true, id: (r as any)?.data?.id || null }
      } catch (e: any) {
        console.warn('[onboarding/complete] client email failed:', e?.message)
        sendResults.client = { ok: false, error: e?.message }
      }
    } else {
      sendResults.client = { ok: false, error: 'no_client_email' }
    }

    // Mark sent
    try {
      await sb
        .from('clients')
        .update({ completion_email_sent_at: new Date().toISOString() })
        .eq('id', client_id)
    } catch (e: any) {
      // Column may not exist yet — non-fatal
      console.warn('[onboarding/complete] could not mark sent:', e?.message)
    }

    return NextResponse.json({
      ok: true,
      pdf_bytes: pdfBuffer.length,
      filled,
      missing,
      ...sendResults,
    })
  } catch (e: any) {
    console.error('[onboarding/complete] fatal:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
