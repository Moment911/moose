import 'server-only'
import { Resend } from 'resend'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — send the trainee invite email via Resend + a Supabase
// magic-link token.
//
// We follow the Koto onboarding pattern (src/app/api/onboarding/route.ts):
// build the HTML ourselves and send via Resend so the email is agency-
// branded (logo, brand color, sender). The auth portion is a Supabase
// `magiclink` token generated via auth.admin.generateLink — that gives us
// a URL the trainee clicks to sign in without a password.
//
// sender: agency.support_email when present (e.g. coach@agencydomain.com),
// otherwise the default onboarding mailbox. Keeping fallback identical to
// /api/onboarding send_link avoids maintaining two DNS stories.
// ─────────────────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

export interface TraineeInviteInput {
  userId: string          // auth.users.id (already provisioned)
  email: string
  agencyId: string
  traineeId: string
  traineeName?: string
}

export interface TraineeInviteResult {
  ok: true
  sent_at: string
  magic_link: string   // exposed for tests; NEVER persist to DB
}

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '')
}

async function loadAgencyBranding(
  db: SupabaseClient,
  agencyId: string,
): Promise<{
  name: string
  brandName: string
  brandColor: string
  logoUrl: string | null
  supportEmail: string | null
}> {
  const { data } = await db
    .from('agencies')
    .select('name, brand_name, brand_color, brand_logo_url, logo_url, support_email')
    .eq('id', agencyId)
    .maybeSingle()

  const ag = (data || {}) as {
    name?: string
    brand_name?: string
    brand_color?: string
    brand_logo_url?: string
    logo_url?: string
    support_email?: string
  }
  return {
    name: ag.name || 'Your Coach',
    brandName: ag.brand_name || ag.name || 'Your Coach',
    brandColor: ag.brand_color || '#ea2729',
    logoUrl: ag.brand_logo_url || ag.logo_url || null,
    supportEmail: ag.support_email || null,
  }
}

function buildInviteEmail(opts: {
  agencyName: string
  agencyLogo: string | null
  brandColor: string
  traineeName?: string
  magicLink: string
}): string {
  const { agencyName, agencyLogo, brandColor, traineeName, magicLink } = opts
  const color = brandColor || '#ea2729'
  const logo = agencyLogo
    ? `<img src="${agencyLogo}" alt="${agencyName}" style="height:32px;max-width:200px;object-fit:contain;"/>`
    : `<div style="font-size:18px;font-weight:900;color:#fff;">${agencyName}</div>`
  const greeting = traineeName ? `Hi ${traineeName.split(' ')[0]},` : 'Hi there,'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.08);">

  <tr><td style="background:#0a0a0a;padding:22px 32px;">${logo}</td></tr>

  <tr><td style="padding:36px 32px 20px;">
    <h1 style="margin:0 0 10px;font-size:26px;font-weight:900;color:#0a0a0a;letter-spacing:-.5px;">
      Your personalized training plan is ready 💪
    </h1>
    <p style="margin:0 0 10px;font-size:16px;color:#374151;line-height:1.7;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.7;">
      Your personal trainer at ${agencyName} has built you a full 90-day training and nutrition plan —
      complete with workouts, meals, a grocery list, and a coaching playbook to keep you on track.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.7;">
      Click below to sign in and view your plan. The link will log you in automatically — no password needed.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 32px;text-align:center;">
    <a href="${magicLink}" style="display:inline-block;padding:16px 40px;border-radius:12px;background:${color};color:#fff;font-size:17px;font-weight:800;text-decoration:none;letter-spacing:-.01em;">
      View My Plan →
    </a>
    <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">
      This link expires in 24 hours. Request a new one anytime by replying to this email.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 28px;">
    <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">
        <strong style="color:#374151;">A quick note:</strong> the guidance in your plan is fitness coaching, not medical advice.
        Please consult your physician before starting any new exercise or nutrition program, especially if you have a pre-existing condition.
      </p>
    </div>
  </td></tr>

  <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0 0 10px;font-size:12px;color:#9ca3af;">
      Sent by ${agencyName} &nbsp;·&nbsp; <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none;">${APP_URL}</a>
    </p>
    <p style="margin:0;font-size:11px;color:#d1d5db;">
      Powered by &nbsp;<a href="https://hellokoto.com" style="color:#9ca3af;text-decoration:none;font-weight:700;letter-spacing:-.01em;">koto</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

/**
 * Send (or resend) a trainee invite email with an embedded Supabase
 * magic-link token. Assumes the auth user and mapping row already exist
 * (see provisionTrainee).
 */
export async function sendTraineeInvite(
  input: TraineeInviteInput,
): Promise<TraineeInviteResult> {
  if (!input.email) throw new Error('email required')
  if (!input.agencyId) throw new Error('agencyId required')
  if (!input.traineeId) throw new Error('traineeId required')

  const db = getDb()

  // Generate the magic link — Supabase returns { properties.action_link }.
  // redirectTo lands the trainee on /my-plan after sign-in.
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: input.email.trim().toLowerCase(),
    options: { redirectTo: `${APP_URL}/my-plan` },
  })
  if (linkErr || !linkData?.properties?.action_link) {
    throw new Error(`generateLink failed: ${linkErr?.message || 'no action_link'}`)
  }
  const magicLink = linkData.properties.action_link

  const brand = await loadAgencyBranding(db, input.agencyId)

  const html = buildInviteEmail({
    agencyName: brand.brandName,
    agencyLogo: brand.logoUrl,
    brandColor: brand.brandColor,
    traineeName: input.traineeName,
    magicLink,
  })

  const from = brand.supportEmail
    ? `${brand.brandName} <${brand.supportEmail}>`
    : `${brand.brandName} <onboarding@hellokoto.com>`

  const { error: sendErr } = await getResend().emails.send({
    from,
    to: input.email,
    subject: `You're invited — your personalized training plan from ${brand.brandName}`,
    html,
  })
  if (sendErr) {
    throw new Error(`resend send failed: ${sendErr.message || 'unknown'}`)
  }

  return {
    ok: true,
    sent_at: new Date().toISOString(),
    magic_link: magicLink,
  }
}
