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

// Minimal HTML escaping for email template interpolation. The emails we
// send include client/agency names pulled from the database — always
// escape before slotting them into markup.
function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────────────────────
// Form-data → clients column mapper
//
// Shared by both the autosave action and the complete action so the final
// submission guarantees every column is populated even if autosave missed
// the last keystroke. Anything not in FIELD_MAP falls through to the
// `unmappedFields` bucket which the caller merges into onboarding_answers.
//
// Array values land in text columns as comma-joined strings so existing
// text-typed columns (marketing_channels, marketing_budget, etc.) don't
// blow up with pg type errors.
// ─────────────────────────────────────────────────────────────
function mapFormDataToClientColumns(form_data: Record<string, any>): {
  updateData: Record<string, any>
  unmappedFields: Record<string, any>
} {
  const FIELD_MAP: Record<string, string> = {
    // Business basics
    business_name: 'name',
    email: 'email',
    phone: 'phone',
    website: 'website',
    industry: 'industry',
    city: 'city',
    state: 'state',
    zip: 'zip',
    address: 'address',
    // Owner / primary contact
    owner_name: 'owner_name',
    owner_title: 'owner_title',
    owner_phone: 'owner_phone',
    owner_email: 'owner_email',
    // `title` is the owner's job title field on the form
    title: 'owner_title',
    // Business details
    num_employees: 'num_employees',
    year_founded: 'year_founded',
    service_area: 'service_area',
    primary_service: 'primary_service',
    secondary_services: 'secondary_services',
    target_customer: 'target_customer',
    avg_deal_size: 'avg_deal_size',
    // Adaptive-question synonyms (B2B contract size → avg_deal_size column)
    avg_contract_value: 'avg_deal_size',
    // Marketing — the form uses legacy names, columns use the canonical names
    marketing_channels: 'marketing_channels',
    current_ad_platforms: 'marketing_channels',
    marketing_budget: 'marketing_budget',
    monthly_ad_budget: 'marketing_budget',
    // Competitors
    competitor_1: 'competitor_1',
    competitor_2: 'competitor_2',
    competitor_3: 'competitor_3',
    unique_selling_prop: 'unique_selling_prop',
    // Brand
    brand_voice: 'brand_voice',
    tagline: 'tagline',
    brand_tagline: 'tagline',
    logo_url: 'logo_url',
    // Tools + platforms
    crm_used: 'crm_used',
    // Adaptive-question synonym — B2B CRM question maps to same column
    b2b_crm: 'crm_used',
    hosting_provider: 'hosting_provider',
    // Social URLs
    facebook_url: 'facebook_url',
    instagram_url: 'instagram_url',
    linkedin_url: 'linkedin_url',
    tiktok_url: 'tiktok_url',
    youtube_url: 'youtube_url',
    google_business_url: 'google_business_url',
    google_biz_url: 'google_business_url',
    // Google rating (form uses different names than columns)
    google_rating: 'review_rating',
    google_reviews: 'review_count',
    // Reviews / referrals
    review_platforms: 'review_platforms',
    referral_sources: 'referral_sources',
    // Freeform
    notes: 'notes',
    // The first question on the form — client's own-words self-description.
    // Used as primary context by every Koto AI system.
    welcome_statement: 'welcome_statement',
  }

  // Form fields we deliberately DO NOT persist as columns or spillover.
  // first_name + last_name get combined into owner_name below.
  // country is too noisy on its own until we add a real column.
  // The nested contacts_* objects are containers, not values — they render as
  // [object Object] if they leak into the jsonb display.
  const SKIP_KEYS = new Set([
    'first_name', 'last_name', 'country',
    'contacts_technical', 'contacts_billing', 'contacts_marketing', 'contacts_emergency',
  ])

  const updateData: Record<string, any> = {}
  const unmappedFields: Record<string, any> = {}

  for (const [formKey, value] of Object.entries(form_data || {})) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (SKIP_KEYS.has(formKey)) continue

    const dbColumn = FIELD_MAP[formKey]
    if (dbColumn) {
      // Array → comma-joined string for text columns; primitive values pass through.
      if (Array.isArray(value)) {
        updateData[dbColumn] = value
          .map((item) => {
            if (item && typeof item === 'object') {
              return item.name || item.label || item.value || ''
            }
            return String(item ?? '')
          })
          .filter(Boolean)
          .join(', ')
      } else {
        updateData[dbColumn] = value
      }
    } else {
      unmappedFields[formKey] = value
    }
  }

  // Combine first_name + last_name → owner_name (only if either is present
  // and the form didn't already supply an explicit owner_name).
  const firstName = (form_data?.first_name && String(form_data.first_name).trim()) || ''
  const lastName  = (form_data?.last_name  && String(form_data.last_name).trim())  || ''
  if ((firstName || lastName) && !updateData.owner_name) {
    const combined = `${firstName} ${lastName}`.trim()
    if (combined) updateData.owner_name = combined
  }

  return { updateData, unmappedFields }
}

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

// Inverse of FIELD_MAP — maps dedicated client columns back to
// their canonical form field key. Used by get_current_answers so
// the OnboardingPage can hydrate form state from the DB without
// knowing the server-side column naming.
const COLUMN_TO_FORM_KEY: Record<string, string> = {
  name: 'business_name',
  email: 'email',
  phone: 'phone',
  website: 'website',
  industry: 'industry',
  city: 'city',
  state: 'state',
  zip: 'zip',
  address: 'address',
  owner_name: 'owner_name',
  owner_title: 'title',
  owner_phone: 'owner_phone',
  owner_email: 'owner_email',
  num_employees: 'num_employees',
  year_founded: 'year_founded',
  service_area: 'service_area',
  primary_service: 'primary_service',
  secondary_services: 'secondary_services',
  target_customer: 'target_customer',
  avg_deal_size: 'avg_deal_size',
  marketing_channels: 'current_ad_platforms',
  marketing_budget: 'monthly_ad_budget',
  brand_voice: 'brand_voice',
  tagline: 'tagline',
  logo_url: 'logo_url',
  unique_selling_prop: 'unique_selling_prop',
  crm_used: 'crm_used',
  hosting_provider: 'hosting_provider',
  facebook_url: 'facebook_url',
  instagram_url: 'instagram_url',
  linkedin_url: 'linkedin_url',
  tiktok_url: 'tiktok_url',
  youtube_url: 'youtube_url',
  google_business_url: 'google_biz_url',
  review_rating: 'google_rating',
  review_count: 'google_reviews',
  review_platforms: 'review_platforms',
  referral_sources: 'referral_sources',
  notes: 'notes',
  welcome_statement: 'welcome_statement',
}

// ─────────────────────────────────────────────────────────────
// GET handler — used by the public OnboardingPage to poll for
// live voice call state and current answers during a voice call.
// Both actions are safe to poll every few seconds and return
// fast read-only responses.
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const clientId = url.searchParams.get('client_id') || ''
  if (!action || !clientId) {
    return NextResponse.json({ error: 'action and client_id required' }, { status: 400 })
  }
  const sb = getSupabase()

  // ── get_voice_status ──
  // Checks koto_onboarding_recipients for any active voice call.
  // Active = source='voice' AND status='in_progress' AND the
  // recipient row's last_active_at is within the last 3 minutes.
  if (action === 'get_voice_status') {
    const cutoff = new Date(Date.now() - 180000).toISOString()
    const { data } = await sb
      .from('koto_onboarding_recipients')
      .select('id, name, phone, call_id, last_active_at, fields_completed')
      .eq('client_id', clientId)
      .eq('source', 'voice')
      .eq('status', 'in_progress')
      .gte('last_active_at', cutoff)
      .order('last_active_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      active_call: !!data,
      caller_name: data?.name || null,
      call_id: data?.call_id || null,
      fields_captured_this_call: data?.fields_completed || 0,
      last_active_at: data?.last_active_at || null,
    })
  }

  // ── get_current_answers ──
  // Returns every populated field mapped back to its canonical
  // form key. Combines dedicated client columns (via
  // COLUMN_TO_FORM_KEY) with anything in onboarding_answers jsonb.
  // Also expands competitor_1/2/3 into a competitors array so the
  // form rebuilds the right shape.
  if (action === 'get_current_answers') {
    const { data: client } = await sb
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()
    if (!client) return NextResponse.json({ answers: {} })

    const answers: Record<string, any> = {}
    for (const [col, formKey] of Object.entries(COLUMN_TO_FORM_KEY)) {
      const v = (client as any)[col]
      if (v !== null && v !== undefined && v !== '') {
        answers[formKey] = v
      }
    }

    // Competitors: flat columns → array shape
    if (client.competitor_1 || client.competitor_2 || client.competitor_3) {
      answers.competitors = [
        { name: client.competitor_1 || '', url: '', strengths: '', weaknesses: '' },
        { name: client.competitor_2 || '', url: '', strengths: '', weaknesses: '' },
        { name: client.competitor_3 || '', url: '', strengths: '', weaknesses: '' },
      ]
    }

    // Jsonb spillover fills in the rest (owner_name split, etc)
    const jsonbAnswers = (client.onboarding_answers && typeof client.onboarding_answers === 'object') ? client.onboarding_answers : {}
    for (const [k, v] of Object.entries(jsonbAnswers)) {
      if (!k || k.startsWith('_')) continue
      if (v === null || v === undefined || v === '') continue
      if (answers[k] !== undefined) continue
      answers[k] = v
    }

    return NextResponse.json({ answers, onboarding_status: client.onboarding_status || null })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
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
        const { updateData, unmappedFields } = mapFormDataToClientColumns(form_data)

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
        // If the client sent along the live Claude classification, persist
        // it to the dedicated column so every AI system (CMO agent, discovery,
        // audit) can read it without re-classifying.
        if (body.classification && typeof body.classification === 'object') {
          updateData.business_classification = body.classification
        }
        // NOTE: updated_at is handled by the BEFORE UPDATE trigger
        // (migration 20260461_clients_updated_at_trigger.sql). Do not set it here.

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

      // Look up client name for the notification body + load existing answers
      const { data: clientRow } = await sb.from('clients')
        .select('name, agency_id, email, onboarding_answers')
        .eq('id', client_id)
        .maybeSingle()
      const clientName = clientRow?.name || 'A client'
      const resolvedAgency = agency_id || clientRow?.agency_id || null

      // Re-run the same FIELD_MAP on the final submission so every column
      // is guaranteed to be populated even if autosave missed the last
      // keystroke or the network flaked out right before submit. Defense
      // in depth — autosave should have done this already, but belt-and-
      // suspenders is cheap and the alternative is silent data loss.
      const { updateData: mapped, unmappedFields } = mapFormDataToClientColumns(form_data)

      const existingAnswers: Record<string, any> =
        (clientRow?.onboarding_answers && typeof clientRow.onboarding_answers === 'object')
          ? clientRow.onboarding_answers
          : {}

      const completeUpdate: Record<string, any> = {
        ...mapped,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_status: 'complete',
        status: 'active',
        onboarding_answers: {
          ...existingAnswers,
          ...unmappedFields,
          _submitted_at: new Date().toISOString(),
        },
      }
      // Persist the latest business classification if the client passed one
      if (body.classification && typeof body.classification === 'object') {
        completeUpdate.business_classification = body.classification
      }
      // NOTE: updated_at is handled by the BEFORE UPDATE trigger.
      await sb.from('clients').update(completeUpdate).eq('id', client_id)

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

      // Post-submit "here's your access setup guide" email — fire and forget.
      // Covers the gap between form submission and actual platform access grants.
      try {
        if (clientRow?.email) {
          const { data: agency } = await sb
            .from('agencies')
            .select('brand_name, name, brand_color, brand_logo_url, support_email')
            .eq('id', resolvedAgency || agency_id)
            .maybeSingle()
          const agencyName = agency?.brand_name || agency?.name || 'Momenta Marketing'
          const brandColor = agency?.brand_color || '#00C2CB'
          const accessEmail = agency?.support_email || 'access@momentamarketing.com'
          const accessGuideUrl = `${APP_URL}/access-guide?agency_name=${encodeURIComponent(agencyName)}&agency_email=${encodeURIComponent(accessEmail)}`
          const firstName = String(clientName).split(' ')[0] || 'there'

          const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,${brandColor},#0099a8);padding:32px;color:#fff;">
    <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:8px;">${agencyName}</div>
    <h1 style="font-size:26px;font-weight:900;margin:0 0 8px;">Thanks, ${firstName}! 🎉</h1>
    <p style="margin:0;font-size:15px;opacity:.92;line-height:1.6;">Your onboarding form is in. Now let's get us access to your platforms so we can hit the ground running.</p>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      We've built a complete access setup guide that shows you exactly how to grant us access to every marketing platform. It includes an AI assistant — just type in whatever platform you use and it'll give you the exact step-by-step instructions.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 24px;text-align:center;">
    <a href="${accessGuideUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:${brandColor};color:#fff;text-decoration:none;font-weight:800;font-size:15px;">
      📋 View Your Access Setup Guide →
    </a>
  </td></tr>

  <tr><td style="padding:0 32px 24px;">
    <div style="background:#f0fffe;border:1px solid ${brandColor}30;border-radius:10px;padding:16px 20px;">
      <div style="font-weight:700;font-size:14px;color:#111;margin-bottom:4px;">📧 Invite this email to your platforms</div>
      <div style="font-size:18px;color:${brandColor};font-weight:800;">${accessEmail}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">
        We never need your passwords. Every platform has a way to add team members — the guide walks you through each one.
      </div>
    </div>
  </td></tr>

  <tr><td style="padding:0 32px 28px;">
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">
      Questions? Just reply to this email — we'll help you through whichever platform is tripping you up. No question is too small.
    </p>
  </td></tr>

  <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Sent by ${agencyName} · Powered by <a href="https://hellokoto.com" style="color:#9ca3af;text-decoration:none;font-weight:700;">Koto</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

          const fromAddress = agency?.support_email
            ? `${agencyName} <${agency.support_email}>`
            : `${agencyName} <onboarding@hellokoto.com>`

          await getResend().emails.send({
            from: fromAddress,
            to: clientRow.email,
            subject: `Next step: grant ${agencyName} access to your platforms`,
            html,
          })
        }
      } catch { /* non-fatal — notification already fired */ }

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

      // Send completion email + PDF summary (fire and forget)
      fetch(`${APP_URL}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_completion_email',
          client_id,
          agency_id: resolvedAgency,
        }),
      }).catch((e) => console.warn('[onboarding complete] completion email trigger failed:', e))

      return NextResponse.json({ ok: true, agent_configured: !existing })
    }

    // ── Send missing-fields email ────────────────────────────────────────────
    // Manually triggered from ClientDetailPage after a voice onboarding call
    // ends incomplete. Sends a list of the specific questions still needing
    // answers to any email address — commonly forwarded to a teammate who can
    // fill in what the caller couldn't. Never sent automatically.
    if (action === 'send_missing_fields_email') {
      const toEmail: string = (body.to_email || '').trim()
      const toName: string = (body.to_name || '').trim()
      if (!client_id || !toEmail) {
        return NextResponse.json({ error: 'client_id and to_email required' }, { status: 400 })
      }

      const { data: client } = await sb
        .from('clients')
        .select('*')
        .eq('id', client_id)
        .maybeSingle()

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      // Keep this list in sync with ONBOARDING_QUESTIONS in
      // src/app/api/onboarding/voice/route.ts — both paths should agree
      // on what counts as "missing".
      const QUESTION_LIST: Array<{ field: string; question: string; priority: 1 | 2 | 3 }> = [
        { field: 'welcome_statement', question: "Tell us about your business in your own words — what you do, who you serve, and what's most important for us to know.", priority: 1 },
        { field: 'owner_name',        question: "What's your full name and your role at the company?", priority: 1 },
        { field: 'phone',             question: "What's the best phone number to reach you directly?", priority: 1 },
        { field: 'website',           question: "What's your website URL?", priority: 1 },
        { field: 'industry',          question: "How would you describe your industry or type of business?", priority: 1 },
        { field: 'city',              question: "What city and state are you located in?", priority: 1 },
        { field: 'num_employees',     question: "How many people work for you right now?", priority: 2 },
        { field: 'year_founded',      question: "What year was the business founded?", priority: 2 },
        { field: 'primary_service',   question: "What's your primary service or product?", priority: 1 },
        { field: 'secondary_services',question: "What other services or products do you offer?", priority: 2 },
        { field: 'target_customer',   question: "Describe your ideal customer. Who do you love working with?", priority: 1 },
        { field: 'avg_deal_size',     question: "What's the average value of a typical job or transaction?", priority: 2 },
        { field: 'marketing_budget',  question: "How much do you currently spend on marketing each month?", priority: 2 },
        { field: 'marketing_channels',question: "What marketing channels are you using right now?", priority: 2 },
        { field: 'crm_used',          question: "What CRM or software do you use to manage leads and customers?", priority: 2 },
        { field: 'competitor_1',      question: "Who's your biggest competitor?", priority: 3 },
        { field: 'unique_selling_prop',question:"Why should someone choose you over your competitors?", priority: 2 },
        { field: 'referral_sources',  question: "Where do most of your best customers come from?", priority: 2 },
        { field: 'notes',             question: "What are your top goals for the next 12 months?", priority: 1 },
      ]

      const answers = (client.onboarding_answers && typeof client.onboarding_answers === 'object') ? client.onboarding_answers : {}
      const missing = QUESTION_LIST.filter((q) => {
        const col = (client as any)[q.field]
        const jsonb = (answers as any)[q.field]
        const hasCol = col !== null && col !== undefined && col !== ''
        const hasJsonb = jsonb !== null && jsonb !== undefined && jsonb !== ''
        return !hasCol && !hasJsonb
      }).sort((a, b) => a.priority - b.priority)

      if (missing.length === 0) {
        return NextResponse.json({ ok: true, sent: false, reason: 'No missing fields — nothing to email' })
      }

      const aid = agency_id || client.agency_id
      const { data: agency } = aid
        ? await sb.from('agencies').select('name, brand_name, onboarding_phone_number').eq('id', aid).maybeSingle()
        : { data: null as any }

      const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
      const clientName = client.name || 'your business'
      const firstName = (toName || '').split(' ')[0] || 'there'
      const onboardingUrl = `${APP_URL}/onboard/${client_id}`
      const phoneLine = agency?.onboarding_phone_number
        ? `<div style="font-size:13px;color:#374151;margin-top:6px">or call us at <strong>${agency.onboarding_phone_number}</strong> and our AI will walk you through it by phone.</div>`
        : ''

      const missingHtml = missing
        .map((q) => `<li style="margin-bottom:8px;color:#374151;line-height:1.5">${escapeHtml(q.question)}</li>`)
        .join('')

      const emailHtml = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#00C2CB,#0099A8);padding:28px;border-radius:14px;margin-bottom:24px;color:#fff">
            <h1 style="margin:0 0 10px;font-size:22px">We still need a few details for ${escapeHtml(clientName)}</h1>
            <p style="margin:0;opacity:0.9;font-size:14px;line-height:1.5">Hi ${escapeHtml(firstName)}, ${escapeHtml(agencyName)} is setting up the account for ${escapeHtml(clientName)} and we're missing a few answers. You can either fill out the quick form or call in.</p>
          </div>

          <div style="background:#f9f9f9;border-radius:10px;padding:18px 20px;margin-bottom:20px">
            <div style="font-weight:800;margin-bottom:10px;font-size:14px;color:#111">Here's what we still need:</div>
            <ul style="margin:0;padding-left:18px;font-size:13px">
              ${missingHtml}
            </ul>
          </div>

          <div style="text-align:center;margin-bottom:20px">
            <a href="${onboardingUrl}" style="display:inline-block;padding:13px 28px;background:#00C2CB;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
              Complete My Section →
            </a>
            ${phoneLine}
          </div>

          <div style="font-size:12px;color:#6b7280;text-align:center">
            This should only take 5-10 minutes. Your answers save automatically.
          </div>
        </div>
      `

      try {
        const resend = getResend()
        await resend.emails.send({
          from: 'onboarding@hellokoto.com',
          to: toEmail,
          subject: `We still need a few details for ${clientName}`,
          html: emailHtml,
        })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to send email' }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        sent: true,
        sent_to: toEmail,
        missing_count: missing.length,
      })
    }

    // ── Send access guide email ──────────────────────────────────────────────
    // Sends the client a branded email linking to /access-guide with the
    // agency's access email and a short list of which platforms they should
    // grant us. Called from the ClientDetailPage "Send Access Guide" button.
    if (action === 'send_access_guide') {
      const email: string | undefined = body.email
      if (!client_id) {
        return NextResponse.json({ error: 'client_id required' }, { status: 400 })
      }

      const { data: client } = await sb
        .from('clients')
        .select('name, email, platform_access, owner_name, agency_id')
        .eq('id', client_id)
        .maybeSingle()

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      const destEmail = (email && email.trim()) || client.email
      if (!destEmail) {
        return NextResponse.json({ error: 'No email address provided' }, { status: 400 })
      }

      const aid = agency_id || client.agency_id
      const { data: agency } = aid
        ? await sb.from('agencies').select('name, brand_name').eq('id', aid).maybeSingle()
        : { data: null as any }

      const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
      const firstName = (client.owner_name || client.name || 'there').split(' ')[0]

      const accessEmail = 'access@momentamarketing.com'
      const guideUrl = `${APP_URL}/access-guide?agency_name=${encodeURIComponent(agencyName)}&agency_email=${encodeURIComponent(accessEmail)}`

      // Pull platforms the client checked during onboarding (if any)
      const platformAccess = (client.platform_access && typeof client.platform_access === 'object') ? client.platform_access : {}
      const checkedPlatforms = Object.keys(platformAccess).filter(k => platformAccess[k])
      const platformList = checkedPlatforms.length > 0
        ? `<div style="background:#f9f9f9;border-radius:10px;padding:16px 20px;margin-bottom:20px">
             <div style="font-weight:700;margin-bottom:8px">Platforms we need access to:</div>
             <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.8">
               ${checkedPlatforms.map(p => `<li>${p.replace(/_/g, ' ')}</li>`).join('')}
             </ul>
           </div>`
        : ''

      const emailHtml = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#00C2CB,#0099A8);padding:32px;border-radius:14px;margin-bottom:24px;color:#fff">
            <h1 style="margin:0 0 12px;font-size:24px">Your Access Setup Guide</h1>
            <p style="margin:0;opacity:0.9">Hi ${firstName}, here's how to securely grant ${agencyName} access to your marketing platforms.</p>
          </div>

          <div style="background:#f0fffe;border:2px solid #00C2CB40;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">
            <div style="font-size:14px;color:#374151;margin-bottom:16px">Click below to view step-by-step instructions for every platform, plus an AI assistant if you don't see yours listed:</div>
            <a href="${guideUrl}" style="display:inline-block;padding:14px 32px;background:#00C2CB;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px">
              View Access Setup Guide →
            </a>
          </div>

          ${platformList}

          <div style="background:#f9f9f9;border-radius:10px;padding:16px 20px;margin-bottom:20px">
            <div style="font-weight:700;margin-bottom:8px">📧 Our agency access email:</div>
            <div style="font-size:20px;color:#00C2CB;font-weight:800">${accessEmail}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Use this email when adding us to any platform — never share your password.</div>
          </div>

          <div style="font-size:13px;color:#6b7280;text-align:center">
            Questions? Reply to this email or call your account manager directly.
          </div>
        </div>
      `

      try {
        const resend = getResend()
        await resend.emails.send({
          from: 'onboarding@hellokoto.com',
          to: destEmail,
          subject: `Your Access Setup Guide — ${agencyName}`,
          html: emailHtml,
        })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to send email' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, sent_to: destEmail })
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
