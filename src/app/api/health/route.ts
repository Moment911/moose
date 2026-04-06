import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function checkSupabase(sb: any) {
  const start = Date.now()
  try {
    const { error } = await sb.from('profiles').select('id').limit(1)
    const ms = Date.now() - start
    return { service: 'supabase', status: error ? 'degraded' : 'operational', response_ms: ms, message: error?.message || 'OK' }
  } catch (e: any) {
    return { service: 'supabase', status: 'outage', response_ms: Date.now() - start, message: e.message }
  }
}

async function checkWordPressSites(sb: any) {
  const { data: sites } = await sb.from('koto_wp_sites').select('id,site_url,api_key,connected').eq('connected', true)
  const results = []
  for (const site of (sites || []).slice(0, 5)) {
    const start = Date.now()
    try {
      const res = await fetch(`${site.site_url}/wp-json/koto/v1/agency/test`, {
        headers: { 'X-Koto-API-Key': site.api_key },
        signal: AbortSignal.timeout(8000)
      })
      results.push({ site_url: site.site_url, status: res.ok ? 'operational' : 'degraded', response_ms: Date.now() - start })
    } catch {
      results.push({ site_url: site.site_url, status: 'outage', response_ms: Date.now() - start })
    }
  }
  return results
}

async function checkVercel() {
  const start = Date.now()
  try {
    const res = await fetch('https://hellokoto.com/api/health/ping', { signal: AbortSignal.timeout(5000) })
    return { service: 'vercel', status: 'operational', response_ms: Date.now() - start, message: 'OK' }
  } catch (e: any) {
    return { service: 'vercel', status: 'degraded', response_ms: Date.now() - start, message: e.message }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const sb = getSB()

  if (action === 'ping') return NextResponse.json({ ok: true, ts: Date.now() })

  if (action === 'logs') {
    const level = searchParams.get('level')
    const service = searchParams.get('service')
    const search = searchParams.get('search')
    let q = sb.from('koto_system_logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (level) q = q.eq('level', level)
    if (service) q = q.eq('service', service)
    if (search) q = q.ilike('message', `%${search}%`)
    const { data } = await q
    return NextResponse.json({ logs: data || [] })
  }

  if (action === 'incidents') {
    const { data: incidents } = await sb.from('koto_incidents').select('*').order('created_at', { ascending: false }).limit(50)
    const { data: maintenance } = await sb.from('koto_maintenance').select('*').order('scheduled_start', { ascending: false }).limit(20)
    return NextResponse.json({ incidents: incidents || [], maintenance: maintenance || [] })
  }

  if (action === 'stats') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ count: userCount }, { count: pageCount }, { count: errorCount }, { data: recentChecks }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('koto_wp_pages').select('*', { count: 'exact', head: true }).gte('created_at', since),
      sb.from('koto_system_logs').select('*', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', since),
      sb.from('koto_health_checks').select('*').order('checked_at', { ascending: false }).limit(100),
    ])
    return NextResponse.json({ userCount, pageCount, errorCount, recentChecks: recentChecks || [] })
  }

  // Full health check
  const [supabaseCheck, vercelCheck] = await Promise.all([checkSupabase(sb), checkVercel()])
  const wpChecks = await checkWordPressSites(sb)

  const checks = [supabaseCheck, vercelCheck]
  for (const check of checks) {
    await sb.from('koto_health_checks').insert({ ...check, checked_at: new Date().toISOString() })
  }

  const overall = checks.every(c => c.status === 'operational') ? 'operational' : checks.some(c => c.status === 'outage') ? 'outage' : 'degraded'

  return NextResponse.json({ overall, services: checks, wordpress: wpChecks, timestamp: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  const sb = getSB()
  const body = await req.json()
  const { action } = body

  if (action === 'create_incident') {
    const { title, description, severity, services } = body
    const { data } = await sb.from('koto_incidents').insert({ title, description, severity, services, status: 'investigating' }).select().single()
    return NextResponse.json({ incident: data })
  }

  if (action === 'update_incident') {
    const { id, status, update_message } = body
    const { data: existing } = await sb.from('koto_incidents').select('updates').eq('id', id).single()
    const updates = [...(existing?.updates || []), { message: update_message, status, timestamp: new Date().toISOString() }]
    const patch: any = { status, updates, updated_at: new Date().toISOString() }
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    const { data } = await sb.from('koto_incidents').update(patch).eq('id', id).select().single()
    return NextResponse.json({ incident: data })
  }

  if (action === 'create_maintenance') {
    const { title, description, services, scheduled_start, scheduled_end } = body
    const { data } = await sb.from('koto_maintenance').insert({ title, description, services, scheduled_start, scheduled_end }).select().single()
    return NextResponse.json({ maintenance: data })
  }

  if (action === 'log') {
    const { level, service, action: logAction, message, metadata, user_id, agency_id, duration_ms } = body
    await sb.from('koto_system_logs').insert({ level, service, action: logAction, message, metadata, user_id, agency_id, duration_ms })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
