import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  starter: {
    page_builder: true, wordpress_plugin: true, seo_hub: true, reviews: true,
    review_campaigns: true, proposals: true, proposal_library: true, automations: true,
    tasks: true, koto_desk: true, help_center: true, scout: true, pipeline_crm: true,
    performance_dashboard: true, cmo_agent: false, voice_agent: false,
    answering_service: false, ai_page_research: false, ai_script_generation: false,
    client_billing: true, credit_system: true, phone_numbers: false,
    team_management: true, white_label: false, api_access: false, custom_domain: false,
  },
  growth: {
    page_builder: true, wordpress_plugin: true, seo_hub: true, reviews: true,
    review_campaigns: true, proposals: true, proposal_library: true, automations: true,
    tasks: true, koto_desk: true, help_center: true, scout: true, pipeline_crm: true,
    performance_dashboard: true, cmo_agent: true, voice_agent: true,
    answering_service: true, ai_page_research: true, ai_script_generation: true,
    client_billing: true, credit_system: true, phone_numbers: true,
    team_management: true, white_label: false, api_access: false, custom_domain: false,
  },
  agency: {
    page_builder: true, wordpress_plugin: true, seo_hub: true, reviews: true,
    review_campaigns: true, proposals: true, proposal_library: true, automations: true,
    tasks: true, koto_desk: true, help_center: true, scout: true, pipeline_crm: true,
    performance_dashboard: true, cmo_agent: true, voice_agent: true,
    answering_service: true, ai_page_research: true, ai_script_generation: true,
    client_billing: true, credit_system: true, phone_numbers: true,
    team_management: true, white_label: true, api_access: true, custom_domain: true,
  },
}

const PLAN_PRICES: Record<string, number> = { starter: 297, growth: 597, agency: 997, enterprise: 1997 }

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const s = sb()

  if (action === 'list_agencies') {
    // Get all agencies with client counts
    const { data: agencies } = await s.from('agencies')
      .select('id, name, brand_name, owner_name, owner_email, plan, status, slug, created_at')
      .order('created_at', { ascending: false })

    // Get client counts per agency (exclude soft-deleted)
    const result = await Promise.all((agencies || []).map(async (a) => {
      const { count: clientCount } = await s.from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', a.id)
        .is('deleted_at', null)
      const { count: pageCount } = await s.from('koto_wp_pages')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', a.id)
      const { count: wpSiteCount } = await s.from('koto_wp_sites')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', a.id)
      return { ...a, client_count: clientCount || 0, page_count: pageCount || 0, wp_site_count: wpSiteCount || 0 }
    }))

    return NextResponse.json(result)
  }

  if (action === 'get_agency_detail') {
    const agencyId = p.get('agency_id')
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    const [{ data: agency }, { data: clients }, { data: billing }, { data: features }] = await Promise.all([
      s.from('agencies').select('*').eq('id', agencyId).single(),
      s.from('clients').select('id, name, industry, status, created_at').eq('agency_id', agencyId).is('deleted_at', null).order('name'),
      s.from('koto_billing_accounts').select('*').eq('agency_id', agencyId).single(),
      s.from('agency_features').select('*').eq('agency_id', agencyId).single(),
    ])

    return NextResponse.json({ agency, clients: clients || [], billing, features })
  }

  if (action === 'list_all_clients') {
    // All clients across all agencies with agency name (exclude soft-deleted)
    const { data } = await s.from('clients')
      .select('id, name, industry, status, agency_id, website, phone, created_at, agencies!inner(name, brand_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500)
    return NextResponse.json(data || [])
  }

  if (action === 'dashboard_stats') {
    const [
      { count: agencyCount },
      { count: clientCount },
      { count: pageCount },
      { count: callCount },
      { count: wpSiteCount },
    ] = await Promise.all([
      s.from('agencies').select('*', { count: 'exact', head: true }),
      s.from('clients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      s.from('koto_wp_pages').select('*', { count: 'exact', head: true }),
      s.from('koto_voice_calls').select('*', { count: 'exact', head: true }),
      s.from('koto_wp_sites').select('*', { count: 'exact', head: true }),
    ])

    // MRR from billing
    const { data: billingAccounts } = await s.from('koto_billing_accounts').select('plan_price, status')
    const mrr = (billingAccounts || []).filter(a => a.status === 'active').reduce((sum, a) => sum + Number(a.plan_price || 0), 0)

    return NextResponse.json({
      agency_count: agencyCount || 0,
      client_count: clientCount || 0,
      page_count: pageCount || 0,
      call_count: callCount || 0,
      wp_site_count: wpSiteCount || 0,
      mrr,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  if (action === 'create_agency') {
    const { name, owner_name, owner_email, plan, send_welcome_email } = body
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const planKey = plan || 'starter'
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // 1. Create agency
    const { data: agency, error: agErr } = await s.from('agencies').insert({
      name, brand_name: name, owner_name, owner_email, plan: planKey,
      status: 'active', slug,
    }).select().single()
    if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 })

    // 2. Create billing account
    await s.from('koto_billing_accounts').insert({
      agency_id: agency.id, plan: planKey,
      plan_price: PLAN_PRICES[planKey] || 297, status: 'active',
      credit_balance: 0,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    })

    // 3. Create agency features based on plan
    const features = PLAN_FEATURES[planKey] || PLAN_FEATURES.starter
    await s.from('agency_features').insert({ agency_id: agency.id, ...features })

    // 4. Log
    await s.from('koto_system_logs').insert({
      level: 'info', service: 'admin', action: 'create_agency',
      message: `New agency created: ${name} (${planKey})`,
      metadata: { agency_id: agency.id, plan: planKey, owner_email },
    })

    // 5. Send welcome email
    if (send_welcome_email && owner_email && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>',
            to: owner_email,
            subject: `Welcome to Koto — Your ${planKey} plan is ready`,
            html: `<h2>Welcome to Koto, ${owner_name || name}!</h2>
              <p>Your agency account has been created on the <strong>${planKey}</strong> plan.</p>
              <p>Log in at: <a href="https://hellokoto.com/login">hellokoto.com/login</a></p>`,
          }),
        })
      } catch {}
    }

    return NextResponse.json(agency)
  }

  if (action === 'update_agency') {
    const { agency_id, ...updates } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const allowed = ['name', 'brand_name', 'owner_name', 'owner_email', 'plan', 'status', 'notes']
    const filtered: Record<string, any> = {}
    for (const k of allowed) { if (updates[k] !== undefined) filtered[k] = updates[k] }
    filtered.updated_at = new Date().toISOString()
    const { data, error } = await s.from('agencies').update(filtered).eq('id', agency_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'suspend_agency') {
    const { agency_id } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    await s.from('agencies').update({ status: 'suspended', suspended_at: new Date().toISOString() }).eq('id', agency_id)
    await s.from('koto_billing_accounts').update({ status: 'cancelled' }).eq('agency_id', agency_id)
    await s.from('koto_system_logs').insert({
      level: 'warn', service: 'admin', action: 'suspend_agency',
      message: `Agency suspended: ${agency_id}`,
    })
    return NextResponse.json({ success: true })
  }

  if (action === 'create_client_for_agency') {
    const { agency_id, name, industry, website, phone, email } = body
    if (!agency_id || !name) return NextResponse.json({ error: 'agency_id and name required' }, { status: 400 })
    const { data, error } = await s.from('clients').insert({
      agency_id, name, industry, website, phone, email, status: 'active',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create default permissions
    await s.from('koto_client_permissions').insert({
      agency_id, client_id: data.id,
    })

    // Create default pricing
    await s.from('koto_client_pricing').insert({
      agency_id, client_id: data.id,
    })

    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
