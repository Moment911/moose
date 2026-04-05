import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const KOTO_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Which add-ons are included per plan (no extra charge)
const PLAN_INCLUDES: Record<string, string[]> = {
  starter: ['review_campaigns','scout_pipeline','proposal_library','autonomous_agent',
            'weekly_digest','onboarding_auto','gbp_audit','twilio_sms'],
  growth:  ['review_campaigns','scout_pipeline','proposal_library','autonomous_agent',
            'weekly_digest','onboarding_auto','gbp_audit','twilio_sms',
            'client_portal','gsc_ga4','rank_tracker','competitor_intel','white_label_reports'],
  agency:  ['review_campaigns','scout_pipeline','proposal_library','autonomous_agent',
            'weekly_digest','onboarding_auto','gbp_audit','twilio_sms',
            'client_portal','gsc_ga4','rank_tracker','competitor_intel','white_label_reports',
            'api_access','custom_domain'],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agency_id = searchParams.get('agency_id')
  const sb = getSupabase()

  // Get all add-ons from catalog
  const { data: addons } = await sb.from('marketplace_addons')
    .select('*').eq('is_active', true).order('sort_order')

  // Get this agency's enabled add-ons
  let enabled: string[] = []
  let plan = 'starter'
  if (agency_id) {
    const [{ data: agencyAddons }, { data: sub }] = await Promise.all([
      sb.from('agency_addons').select('addon_key,enabled').eq('agency_id', agency_id).eq('enabled', true),
      sb.from('subscriptions').select('plan,status').eq('agency_id', agency_id).single(),
    ])
    plan = sub?.plan || 'starter'
    const manuallyEnabled = (agencyAddons || []).map(a => a.addon_key)
    const planIncludes = PLAN_INCLUDES[plan] || PLAN_INCLUDES.starter
    enabled = [...new Set([...planIncludes, ...manuallyEnabled])]
  }

  // Get pending requests
  const { data: requests } = agency_id
    ? await sb.from('addon_requests').select('*').eq('agency_id', agency_id).eq('status','pending')
    : { data: [] }

  return NextResponse.json({
    addons: addons || [],
    enabled,
    plan,
    pending_requests: requests || [],
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, agency_id, real_agency_id } = body
    const sb = getSupabase()
    const isKoto = real_agency_id === KOTO_AGENCY_ID || agency_id === KOTO_AGENCY_ID

    // ── Toggle add-on (Koto admin only) ──────────────────────────────────────
    if (action === 'toggle') {
      if (!isKoto && !body.admin_override) {
        return NextResponse.json({ error: 'Koto admin required' }, { status: 403 })
      }
      const { target_agency_id, addon_key, enabled, notes } = body

      const { data: existing } = await sb.from('agency_addons')
        .select('id').eq('agency_id', target_agency_id).eq('addon_key', addon_key).single()

      if (existing) {
        await sb.from('agency_addons').update({ enabled, notes, enabled_at: new Date().toISOString() })
          .eq('agency_id', target_agency_id).eq('addon_key', addon_key)
      } else {
        await sb.from('agency_addons').insert({
          agency_id: target_agency_id, addon_key, enabled,
          enabled_by: 'koto', notes,
        })
      }

      // If enabling, also approve any pending request
      if (enabled) {
        await sb.from('addon_requests').update({
          status: 'approved', reviewed_at: new Date().toISOString()
        }).eq('agency_id', target_agency_id).eq('addon_key', addon_key).eq('status', 'pending')
      }

      return NextResponse.json({ ok: true, enabled })
    }

    // ── Agency requests an add-on ─────────────────────────────────────────────
    if (action === 'request') {
      const { addon_key, message } = body
      // Check not already requested
      const { data: existing } = await sb.from('addon_requests')
        .select('id').eq('agency_id', agency_id).eq('addon_key', addon_key).eq('status','pending').single()
      if (existing) return NextResponse.json({ error: 'Already requested' }, { status: 400 })

      await sb.from('addon_requests').insert({ agency_id, addon_key, message })
      return NextResponse.json({ ok: true })
    }

    // ── Get all agency add-on statuses (Koto admin) ───────────────────────────
    if (action === 'all_agencies') {
      if (!isKoto) return NextResponse.json({ error: 'Koto admin required' }, { status: 403 })
      const [{ data: agencies }, { data: allAddons }, { data: requests }] = await Promise.all([
        sb.from('agencies').select('id,name,brand_name,plan,status').not('status','eq','canceled'),
        sb.from('agency_addons').select('*').eq('enabled', true),
        sb.from('addon_requests').select('*,agencies(name)').eq('status','pending'),
      ])
      return NextResponse.json({ agencies, agency_addons: allAddons, pending_requests: requests })
    }

    // ── Enable add-on for all agencies on a plan ──────────────────────────────
    if (action === 'enable_for_plan') {
      if (!isKoto) return NextResponse.json({ error: 'Koto admin required' }, { status: 403 })
      const { target_plan, addon_key, enabled } = body
      const { data: agencies } = await sb.from('subscriptions')
        .select('agency_id').eq('plan', target_plan).in('status',['active','trialing'])
      const rows = (agencies || []).map(a => ({
        agency_id: a.agency_id, addon_key, enabled, enabled_by: 'koto'
      }))
      if (rows.length > 0) {
        await sb.from('agency_addons').upsert(rows, { onConflict: 'agency_id,addon_key' })
      }
      return NextResponse.json({ ok: true, updated: rows.length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
