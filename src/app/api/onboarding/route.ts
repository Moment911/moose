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

  const sections = [
    { icon: '🏢', label: 'Business basics',        items: ['Legal business name & EIN/Tax ID', 'Year founded, employee count', 'Business address & website URL', 'Annual revenue range'] },
    { icon: '📋', label: 'Your services & pricing', items: ['Complete list of services or products', 'Your top 5 revenue drivers', 'Pricing model & average job value', 'Seasonal revenue patterns'] },
    { icon: '👥', label: 'Your customers',          items: ['Who your ideal customers are', 'Their demographics & pain points', 'Why they choose you over competitors', 'Your unique value proposition'] },
    { icon: '🎨', label: 'Brand & social',          items: ['Logo files (or a link to them)', 'Brand colors, fonts & tagline', 'Social media profile URLs', 'Current follower counts & review ratings'] },
    { icon: '🔑', label: 'Account access',          items: ['Website hosting login & domain info', 'Google Analytics & Tag Manager IDs', 'Facebook Pixel & Google Ads IDs', 'CMS login (WordPress, Wix, etc.)'] },
    { icon: '📲', label: 'For texting & tracking',  items: ['Legal name exactly as on your EIN', 'EIN / Federal Tax ID (XX-XXXXXXX)', 'How customers opt in to receive texts', 'Key contacts: technical, billing, marketing'] },
  ]

  const sectionsHtml = sections.map(s => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #f3f4f6; vertical-align:top; width:28px;">
        <span style="font-size:18px;">${s.icon}</span>
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #f3f4f6; vertical-align:top;">
        <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;">${s.label}</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">
          ${s.items.map(item => `→ ${item}`).join('<br/>')}
        </div>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:#0a0a0a;padding:22px 32px;">${logo}</td></tr>

  <!-- Hero -->
  <tr><td style="padding:36px 32px 24px;">
    <h1 style="margin:0 0 10px;font-size:26px;font-weight:900;color:#0a0a0a;letter-spacing:-.5px;">Welcome to ${opts.agencyName}! 👋</h1>
    <p style="margin:0 0 6px;font-size:16px;color:#374151;line-height:1.7;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.7;">
      We are thrilled to start building your marketing strategy. Before we dive in, we need to learn everything about your business — your services, customers, brand, and goals — so every campaign, keyword, and dollar is pointed in the right direction.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.7;">
      <strong>The onboarding form takes about 20–30 minutes.</strong> It saves automatically, so you can close it and come back anytime using the same link below.
    </p>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 32px 32px;text-align:center;">
    <a href="${opts.onboardingUrl}" style="display:inline-block;padding:16px 40px;border-radius:12px;background:${color};color:#fff;font-size:17px;font-weight:800;text-decoration:none;letter-spacing:-.01em;">
      Start My Onboarding →
    </a>
    <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">No account needed · Auto-saves · Return anytime with this link</p>
  </td></tr>

  <!-- What you'll need divider -->
  <tr><td style="padding:0 32px;">
    <div style="border-top:2px solid #f3f4f6;padding-top:28px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.1em;">Before you start</p>
      <h2 style="margin:0 0 8px;font-size:19px;font-weight:900;color:#0a0a0a;">Have these nearby — takes 2 minutes to gather</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
        You don't need all of these right now. Answer what you can, skip what you don't have. Nothing is a blocker — our team will follow up on anything missing.
      </p>
    </div>
  </td></tr>

  <!-- Checklist table -->
  <tr><td style="padding:0 32px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      ${sectionsHtml}
    </table>
  </td></tr>

  <!-- AI tip -->
  <tr><td style="padding:0 32px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fbfc;border-radius:12px;border:1px solid #a5f3fc;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0;font-size:14px;color:#0e7490;line-height:1.7;">
          <strong>✨ AI Suggest button:</strong> Every field in the form has an AI Suggest button. If you're unsure what to write, click it — our AI will draft an answer based on what you've already told us. You can edit it before saving.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer note -->
  <tr><td style="padding:0 32px 32px;">
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
      Questions about any of the fields? Just reply to this email — we're happy to walk you through anything.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0 0 10px;font-size:12px;color:#9ca3af;">Sent by ${opts.agencyName} &nbsp;·&nbsp; <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none;">${APP_URL}</a></p>
    <p style="margin:0;font-size:11px;color:#d1d5db;">
      Powered by &nbsp;<a href="https://hellokoto.com" style="color:#9ca3af;text-decoration:none;font-weight:700;letter-spacing:-.01em;">koto</a>
      &nbsp;·&nbsp; <a href="https://hellokoto.com" style="color:#d1d5db;text-decoration:none;">hellokoto.com</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}))
    const { action, client_id, agency_id } = body
    const sb = getSupabase()

    // ── Autosave (debounced, fire-and-forget from the onboarding form) ──────
    // Maps known form fields to real `clients` columns (so they show up in
    // the existing client UI without any extra wiring) and stores anything
    // unmapped in `clients.onboarding_answers` jsonb. Always returns 200 —
    // the client form never surfaces an error from autosave.
    if (action === 'autosave') {
      const form_data = (body.form_data && typeof body.form_data === 'object') ? body.form_data : null
      const saved_at = typeof body.saved_at === 'string' ? body.saved_at : new Date().toISOString()

      if (!client_id || !form_data) {
        return NextResponse.json({ ok: true })
      }

      try {
        // Form-field name → clients column name. Anything not in this map
        // falls through to the onboarding_answers jsonb spillover.
        const FIELD_MAP: Record<string, string> = {
          business_name: 'name', name: 'name',
          email: 'email', phone: 'phone',
          website: 'website', industry: 'industry',
          city: 'city', state: 'state', zip: 'zip', address: 'address',
          owner_name: 'owner_name', owner_title: 'owner_title',
          owner_phone: 'owner_phone', owner_email: 'owner_email',
          num_employees: 'num_employees',
          primary_service: 'primary_service', secondary_services: 'secondary_services',
          target_customer: 'target_customer',
          avg_deal_size: 'avg_deal_size',
          marketing_channels: 'marketing_channels', marketing_budget: 'marketing_budget',
          competitor_1: 'competitor_1', competitor_2: 'competitor_2', competitor_3: 'competitor_3',
          unique_selling_prop: 'unique_selling_prop',
          brand_voice: 'brand_voice',
          review_platforms: 'review_platforms',
          crm_used: 'crm_used',
          referral_sources: 'referral_sources',
          notes: 'notes',
          facebook_url: 'facebook_url', instagram_url: 'instagram_url',
          linkedin_url: 'linkedin_url', tiktok_url: 'tiktok_url',
          youtube_url: 'youtube_url', google_business_url: 'google_business_url',
          year_founded: 'year_founded',
          service_area: 'service_area',
          tagline: 'tagline', brand_tagline: 'tagline',
        }

        const updateData: Record<string, any> = {}
        const unmappedFields: Record<string, any> = {}

        for (const [formKey, value] of Object.entries(form_data)) {
          if (value === null || value === undefined || value === '') continue
          if (Array.isArray(value) && value.length === 0) continue
          const dbColumn = FIELD_MAP[formKey]
          if (dbColumn) {
            updateData[dbColumn] = value
          } else {
            unmappedFields[formKey] = value
          }
        }

        updateData.onboarding_status = 'in_progress'

        // Load existing onboarding_answers so we can merge spillover fields
        const { data: existing } = await sb
          .from('clients')
          .select('onboarding_answers, agency_id')
          .eq('id', client_id)
          .maybeSingle()

        const existingAnswers: Record<string, any> =
          (existing?.onboarding_answers && typeof existing.onboarding_answers === 'object')
            ? existing.onboarding_answers
            : {}

        updateData.onboarding_answers = {
          ...existingAnswers,
          ...unmappedFields,
          _last_autosave: saved_at,
          _autosave_count: (Number(existingAnswers._autosave_count) || 0) + 1,
        }
        updateData.updated_at = new Date().toISOString()

        const { error } = await sb.from('clients').update(updateData).eq('id', client_id)

        if (error) {
          // eslint-disable-next-line no-console
          console.error('[Onboarding autosave error]', error.message, 'data:', JSON.stringify(updateData).slice(0, 200))
          return NextResponse.json({ ok: true, error: error.message })
        }

        // Vault history — fire-and-forget, never blocks the response.
        sb.from('koto_data_vault').insert({
          agency_id: agency_id || existing?.agency_id || null,
          client_id,
          record_type: 'onboarding',
          source: 'client_provided',
          title: `Onboarding autosave — ${Object.keys(updateData).length} fields`,
          summary: Object.entries(form_data)
            .slice(0, 5)
            .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
            .join(' · '),
          payload: form_data,
          source_meta: {
            is_autosave: true,
            saved_at,
            field_count: Object.keys(form_data).length,
          },
        }).then(() => {}, () => {})

        return NextResponse.json({ ok: true, saved_fields: Object.keys(updateData).length })
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[Onboarding autosave failed]', e?.message || e)
        return NextResponse.json({ ok: true })
      }
    }

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
      const form_data = (body && body.form_data) || {}

      // Look up client name for the notification body
      const { data: clientRow } = await sb.from('clients')
        .select('name, agency_id, email')
        .eq('id', client_id)
        .maybeSingle()
      const clientName = clientRow?.name || 'A client'
      const resolvedAgency = agency_id || clientRow?.agency_id || null

      // Mark client onboarding complete + save answers
      await sb.from('clients').update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_status: 'complete',
        onboarding_answers: form_data,
        status: 'active',
      }).eq('id', client_id)

      // Write a vault entry for the submission (traceability)
      try {
        await sb.from('koto_data_vault').insert({
          agency_id: resolvedAgency,
          client_id,
          record_type: 'onboarding',
          source: 'client_provided',
          title: `${clientName} — Onboarding submission`,
          payload: form_data,
        })
      } catch { /* vault table may not exist in some installs */ }

      // Fire notification — fire and forget
      try {
        if (resolvedAgency) {
          await sb.from('koto_notifications').insert({
            agency_id: resolvedAgency,
            type: 'onboarding_complete',
            title: '📝 Onboarding complete',
            body: `${clientName} completed their onboarding form`,
            link: `/clients/${client_id}`,
            icon: '📝',
            metadata: { client_id },
          })
        }
      } catch { /* swallow */ }

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
