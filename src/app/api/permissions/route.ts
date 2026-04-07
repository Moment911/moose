import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
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

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const s = sb()

  if (action === 'get_agency_features') {
    const agencyId = p.get('agency_id')
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('agency_features').select('*').eq('agency_id', agencyId).single()
    return NextResponse.json(data || {})
  }

  if (action === 'get_all_agency_features') {
    const { data } = await s.from('agency_features').select('*, agencies!inner(name, brand_name, plan)')
    return NextResponse.json(data || [])
  }

  if (action === 'get_client_permissions') {
    const clientId = p.get('client_id')
    if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data } = await s.from('koto_client_permissions').select('*').eq('client_id', clientId).single()
    return NextResponse.json(data || {})
  }

  if (action === 'get_plan_defaults') {
    const plan = p.get('plan') || 'starter'
    return NextResponse.json(PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.starter)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  if (action === 'update_agency_features') {
    const { agency_id, features } = body
    if (!agency_id || !features) return NextResponse.json({ error: 'agency_id and features required' }, { status: 400 })
    const { data, error } = await s.from('agency_features')
      .upsert({ agency_id, ...features }, { onConflict: 'agency_id' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'apply_plan_defaults') {
    const { agency_id, plan } = body
    if (!agency_id || !plan) return NextResponse.json({ error: 'agency_id and plan required' }, { status: 400 })
    const defaults = PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.starter
    const { data, error } = await s.from('agency_features')
      .upsert({ agency_id, ...defaults }, { onConflict: 'agency_id' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'update_client_permissions') {
    const { agency_id, client_id, permissions } = body
    if (!agency_id || !client_id || !permissions) return NextResponse.json({ error: 'agency_id, client_id, permissions required' }, { status: 400 })
    const { data, error } = await s.from('koto_client_permissions')
      .upsert({ agency_id, client_id, ...permissions, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
