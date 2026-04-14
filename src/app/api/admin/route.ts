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

  // ── Create user account with email + password ──────────────────────────
  if (action === 'create_user') {
    const { email, password, first_name, last_name, agency_id, role } = body
    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    const { data: authUser, error: authErr } = await s.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: first_name || '', last_name: last_name || '' },
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
    if (agency_id && authUser.user) {
      await s.from('agency_members').insert({ agency_id, user_id: authUser.user.id, role: role || 'owner' })
    }
    return NextResponse.json({ user: { id: authUser.user?.id, email } })
  }

  // ── Create client team member — auth user + koto_client_users + permissions ──
  if (action === 'create_client_user') {
    const { email, password, first_name, last_name, client_id, agency_id, role: memberRole } = body
    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    if (!client_id || !agency_id) return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })

    // 1. Create auth user (or find existing)
    let userId: string
    const { data: authUser, error: authErr } = await s.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: first_name || '', last_name: last_name || '' },
    })
    if (authErr) {
      // If user already exists, find them and re-link
      if (authErr.message?.includes('already been registered')) {
        const { data: { users } } = await s.auth.admin.listUsers()
        const existing = users?.find((u: any) => u.email === email)
        if (!existing) return NextResponse.json({ error: 'User exists but could not be found' }, { status: 500 })
        userId = existing.id
        // Update their name
        await s.auth.admin.updateUserById(userId, { user_metadata: { first_name: first_name || '', last_name: last_name || '' } })
      } else {
        return NextResponse.json({ error: authErr.message }, { status: 500 })
      }
    } else {
      userId = authUser.user!.id
    }

    // 2. Link to client
    const { error: cuErr } = await s.from('koto_client_users').insert({
      user_id: userId, client_id, agency_id, role: memberRole || 'viewer',
    })
    if (cuErr) return NextResponse.json({ error: 'User created but client link failed: ' + cuErr.message }, { status: 500 })

    // 3. Ensure permissions row — default: only KotoProof (dashboard is always visible)
    await s.from('koto_client_permissions').upsert({
      client_id, agency_id,
      can_view_pages: true,
      can_view_reviews: false, can_view_reports: false,
      can_view_tasks: false, can_edit_tasks: false, can_view_proposals: false,
    }, { onConflict: 'client_id' })

    return NextResponse.json({ user: { id: userId, email } })
  }

  // ── Remove client team member ────────────────────────────────────────────
  if (action === 'remove_client_user') {
    const { client_user_id } = body
    if (!client_user_id) return NextResponse.json({ error: 'client_user_id required' }, { status: 400 })
    const { error } = await s.from('koto_client_users').delete().eq('id', client_user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Update client team member role ───────────────────────────────────────
  if (action === 'update_client_user_role') {
    const { client_user_id, role: newRole } = body
    if (!client_user_id || !newRole) return NextResponse.json({ error: 'client_user_id and role required' }, { status: 400 })
    const { error } = await s.from('koto_client_users').update({ role: newRole }).eq('id', client_user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Update client permissions ─────────────────────────────────────────
  if (action === 'update_client_permissions') {
    const { client_id, agency_id, permissions } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { error } = await s.from('koto_client_permissions').upsert({
      client_id, agency_id, ...permissions,
    }, { onConflict: 'client_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Get client info (for portal UI — bypasses RLS) ──────────��─────────
  if (action === 'get_client_info') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data } = await s.from('clients').select('name, logo_url, brand_kit').eq('id', client_id).single()
    return NextResponse.json({ client: data || null })
  }

  // ── Get full client info (for pre-filling forms like KotoIntel) ──────────
  if (action === 'get_client_full') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data } = await s.from('clients')
      .select('name, website, industry, city, state, phone, brand_kit, primary_service, marketing_budget, unique_selling_prop, onboarding_answers')
      .eq('id', client_id)
      .single()
    return NextResponse.json({ client: data || null })
  }

  // ── Update notification preferences ──────────────────────────────────
  if (action === 'update_notification_prefs') {
    const { client_id, prefs } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { error } = await s.from('clients').update({ notification_prefs: prefs }).eq('id', client_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── List shared files for client ─────────────────────────────────────
  if (action === 'list_client_files') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: projects } = await s.from('projects').select('id').eq('client_id', client_id)
    if (!projects?.length) return NextResponse.json({ files: [] })
    const projIds = projects.map(p => p.id)
    const { data: files } = await s.from('files').select('id, name, type, url, storage_path, created_at, project_id')
      .in('project_id', projIds).order('created_at', { ascending: false }).limit(30)
    return NextResponse.json({ files: files || [] })
  }

  // ── List client team members with emails ─────────────────��────────────
  if (action === 'list_client_users') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: rows } = await s.from('koto_client_users').select('id, user_id, role, created_at')
      .eq('client_id', client_id).order('created_at', { ascending: true })
    if (!rows?.length) return NextResponse.json({ members: [] })
    const { data: { users } } = await s.auth.admin.listUsers()
    const userMap: Record<string, string> = {}
    users?.forEach((u: any) => { userMap[u.id] = u.email })
    return NextResponse.json({ members: rows.map(r => ({ ...r, email: userMap[r.user_id] || 'Unknown' })) })
  }

  // ── Update user metadata (name, etc.) ──────────────────────��──────────
  if (action === 'set_user_metadata') {
    const { user_id, metadata } = body
    if (!user_id || !metadata) return NextResponse.json({ error: 'user_id and metadata required' }, { status: 400 })
    const { error } = await s.auth.admin.updateUserById(user_id, { user_metadata: metadata })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Set/reset password for any user ───────────────────────────────────
  if (action === 'set_password') {
    const { user_id, email, new_password } = body
    if (!new_password) return NextResponse.json({ error: 'new_password required' }, { status: 400 })
    let uid = user_id
    if (!uid && email) {
      const { data: { users } } = await s.auth.admin.listUsers()
      uid = users?.find((u: any) => u.email === email)?.id
    }
    if (!uid) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { error } = await s.auth.admin.updateUserById(uid, { password: new_password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Send password reset email ─────────────────────────────────────────
  if (action === 'send_password_reset') {
    const { email } = body
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    const { error } = await s.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/login?reset=1`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: `Reset email sent to ${email}` })
  }

  // ── List all users with agency membership ─────────────────────────────
  if (action === 'list_users') {
    const { data: { users }, error } = await s.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data: members } = await s.from('agency_members').select('user_id, agency_id, role, agencies(name, brand_name)')
    const memberMap: Record<string, any> = {}
    for (const m of members || []) memberMap[m.user_id] = m
    const enriched = (users || []).map((u: any) => ({
      id: u.id, email: u.email,
      first_name: u.user_metadata?.first_name, last_name: u.user_metadata?.last_name,
      created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
      agency: memberMap[u.id] ? {
        id: memberMap[u.id].agency_id,
        name: memberMap[u.id].agencies?.brand_name || memberMap[u.id].agencies?.name,
        role: memberMap[u.id].role,
      } : null,
    }))
    return NextResponse.json({ users: enriched })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
