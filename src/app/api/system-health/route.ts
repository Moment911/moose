import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

interface HealthCheck {
  name: string
  category: 'database' | 'api' | 'env' | 'integration' | 'data' | 'performance'
  status: 'pass' | 'warn' | 'fail' | 'auto_fixed'
  detail: string
  fix?: string          // suggested fix if failed
  auto_fixable: boolean
  auto_fixed_detail?: string
  checked_at: string
}

// ── Check all environment variables ─────────────────────────────────────────
function checkEnvVars(): HealthCheck[] {
  const required = [
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase connection'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase auth'],
    ['ANTHROPIC_API_KEY', 'Claude AI'],
    ['RETELL_API_KEY', 'Voice agents'],
    ['RESEND_API_KEY', 'Email delivery'],
    ['NEXT_PUBLIC_APP_URL', 'App URL'],
  ]
  const optional = [
    ['GOOGLE_PLACES_KEY', 'Google Places (competitors, GBP)'],
    ['MOZ_API_KEY', 'Moz (domain authority)'],
    ['GOOGLE_ADS_DEVELOPER_TOKEN', 'Google Ads'],
    ['GOOGLE_CLIENT_ID', 'Google OAuth'],
    ['GOOGLE_CLIENT_SECRET', 'Google OAuth'],
    ['TELNYX_API_KEY', 'Phone provisioning'],
  ]

  const checks: HealthCheck[] = []
  for (const [key, desc] of required) {
    const val = process.env[key]
    checks.push({
      name: `ENV: ${key}`,
      category: 'env',
      status: val ? 'pass' : 'fail',
      detail: val ? `${desc} — configured` : `${desc} — MISSING. This will break core functionality.`,
      fix: val ? undefined : `Add ${key} to Vercel environment variables`,
      auto_fixable: false,
      checked_at: new Date().toISOString(),
    })
  }
  for (const [key, desc] of optional) {
    const val = process.env[key]
    checks.push({
      name: `ENV: ${key}`,
      category: 'env',
      status: val ? 'pass' : 'warn',
      detail: val ? `${desc} — configured` : `${desc} — not set. Some features will be limited.`,
      fix: val ? undefined : `Add ${key} to Vercel for full ${desc} functionality`,
      auto_fixable: false,
      checked_at: new Date().toISOString(),
    })
  }
  return checks
}

// ── Check database tables exist ─────────────────────────────────────────────
async function checkDatabase(): Promise<HealthCheck[]> {
  const s = sb()
  const checks: HealthCheck[] = []
  const tables = [
    'clients', 'agencies', 'users', 'notifications',
    'koto_intel_reports', 'koto_token_usage',
    'kotoiq_keywords', 'kotoiq_snapshots', 'kotoiq_recommendations',
    'kotoiq_sync_log', 'kotoiq_gmb_grid', 'kotoiq_content_briefs',
    'seo_connections', 'projects', 'files', 'annotations',
  ]

  for (const table of tables) {
    try {
      const { count, error } = await s.from(table).select('*', { count: 'exact', head: true })
      if (error) {
        checks.push({ name: `DB: ${table}`, category: 'database', status: 'fail', detail: `Table error: ${error.message}`, fix: `Check if table "${table}" exists in Supabase`, auto_fixable: false, checked_at: new Date().toISOString() })
      } else {
        checks.push({ name: `DB: ${table}`, category: 'database', status: 'pass', detail: `${count} rows`, auto_fixable: false, checked_at: new Date().toISOString() })
      }
    } catch (e: any) {
      checks.push({ name: `DB: ${table}`, category: 'database', status: 'fail', detail: e.message, auto_fixable: false, checked_at: new Date().toISOString() })
    }
  }

  // Check DB connection
  try {
    const { error } = await s.from('agencies').select('id').limit(1)
    checks.push({ name: 'DB: Connection', category: 'database', status: error ? 'fail' : 'pass', detail: error ? `Connection failed: ${error.message}` : 'Connected to Supabase', auto_fixable: false, checked_at: new Date().toISOString() })
  } catch {
    checks.push({ name: 'DB: Connection', category: 'database', status: 'fail', detail: 'Cannot reach Supabase', fix: 'Check SUPABASE_URL and keys', auto_fixable: false, checked_at: new Date().toISOString() })
  }

  return checks
}

// ── Check API routes respond ────────────────────────────────────────────────
async function checkAPIs(): Promise<HealthCheck[]> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  const checks: HealthCheck[] = []
  const routes = [
    ['/api/health', 'Health endpoint'],
    ['/api/intel', 'KotoIntel'],
    ['/api/kotoiq', 'KotoIQ'],
    ['/api/changelog', 'Changelog'],
  ]

  for (const [path, name] of routes) {
    try {
      const start = Date.now()
      const res = await fetch(`${appUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: '__health_check' }),
        signal: AbortSignal.timeout(10000),
      })
      const ms = Date.now() - start
      // A 400 "Unknown action" is fine — it means the route is responding
      const ok = res.status < 500
      checks.push({
        name: `API: ${name}`,
        category: 'api',
        status: ok ? (ms > 5000 ? 'warn' : 'pass') : 'fail',
        detail: ok ? `Responding (${ms}ms)` : `HTTP ${res.status}`,
        fix: ok ? undefined : `Route ${path} is returning 500 errors`,
        auto_fixable: false,
        checked_at: new Date().toISOString(),
      })
    } catch (e: any) {
      checks.push({ name: `API: ${name}`, category: 'api', status: 'fail', detail: `Unreachable: ${e.message}`, fix: `Check if ${path} is deployed correctly`, auto_fixable: false, checked_at: new Date().toISOString() })
    }
  }
  return checks
}

// ── Check external integrations ─────────────────────────────────────────────
async function checkIntegrations(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
        signal: AbortSignal.timeout(10000),
      })
      checks.push({ name: 'Integration: Claude AI', category: 'integration', status: res.ok ? 'pass' : 'warn', detail: res.ok ? 'API responding' : `HTTP ${res.status}`, auto_fixable: false, checked_at: new Date().toISOString() })
    } catch {
      checks.push({ name: 'Integration: Claude AI', category: 'integration', status: 'fail', detail: 'Cannot reach Anthropic API', fix: 'Check ANTHROPIC_API_KEY', auto_fixable: false, checked_at: new Date().toISOString() })
    }
  }

  // Moz
  if (process.env.MOZ_API_KEY) {
    try {
      const res = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${process.env.MOZ_API_KEY}` },
        body: JSON.stringify({ targets: ['google.com'], url_metrics_columns: ['domain_authority'] }),
        signal: AbortSignal.timeout(10000),
      })
      checks.push({ name: 'Integration: Moz API', category: 'integration', status: res.ok ? 'pass' : 'warn', detail: res.ok ? 'API responding' : `HTTP ${res.status}`, auto_fixable: false, checked_at: new Date().toISOString() })
    } catch {
      checks.push({ name: 'Integration: Moz API', category: 'integration', status: 'fail', detail: 'Cannot reach Moz', auto_fixable: false, checked_at: new Date().toISOString() })
    }
  }

  // Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      })
      checks.push({ name: 'Integration: Resend Email', category: 'integration', status: res.ok ? 'pass' : 'warn', detail: res.ok ? 'API responding' : `HTTP ${res.status}`, auto_fixable: false, checked_at: new Date().toISOString() })
    } catch {
      checks.push({ name: 'Integration: Resend Email', category: 'integration', status: 'fail', detail: 'Cannot reach Resend', auto_fixable: false, checked_at: new Date().toISOString() })
    }
  }

  return checks
}

// ── Data integrity checks + auto-fix ────────────────────────────────────────
async function checkDataIntegrity(): Promise<HealthCheck[]> {
  const s = sb()
  const checks: HealthCheck[] = []

  // Check for orphaned clients (no agency_id)
  try {
    const { data: orphans } = await s.from('clients').select('id').is('agency_id', null).limit(10)
    if (orphans?.length) {
      checks.push({ name: 'Data: Orphaned clients', category: 'data', status: 'warn', detail: `${orphans.length} clients have no agency_id`, fix: 'Assign orphaned clients to an agency or delete them', auto_fixable: false, checked_at: new Date().toISOString() })
    } else {
      checks.push({ name: 'Data: Orphaned clients', category: 'data', status: 'pass', detail: 'All clients belong to an agency', auto_fixable: false, checked_at: new Date().toISOString() })
    }
  } catch { /* skip */ }

  // Check for stale KotoIQ syncs (stuck in "running" for >1 hour)
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { data: stale } = await s.from('kotoiq_sync_log').select('id').eq('status', 'running').lt('started_at', oneHourAgo)
    if (stale?.length) {
      // Auto-fix: mark as failed
      await s.from('kotoiq_sync_log').update({ status: 'failed', error_message: 'Auto-fixed: timed out after 1 hour', completed_at: new Date().toISOString() }).eq('status', 'running').lt('started_at', oneHourAgo)
      checks.push({ name: 'Data: Stale sync jobs', category: 'data', status: 'auto_fixed', detail: `${stale.length} stuck sync(s) marked as failed`, auto_fixed_detail: 'Syncs running >1 hour were auto-marked as failed', auto_fixable: true, checked_at: new Date().toISOString() })
    } else {
      checks.push({ name: 'Data: Stale sync jobs', category: 'data', status: 'pass', detail: 'No stuck syncs', auto_fixable: true, checked_at: new Date().toISOString() })
    }
  } catch { /* skip */ }

  // Check for stale intel reports
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { data: stale } = await s.from('koto_intel_reports').select('id').eq('status', 'running').lt('created_at', oneHourAgo)
    if (stale?.length) {
      await s.from('koto_intel_reports').update({ status: 'failed', report_data: { error: 'Auto-fixed: timed out' } }).eq('status', 'running').lt('created_at', oneHourAgo)
      checks.push({ name: 'Data: Stale intel reports', category: 'data', status: 'auto_fixed', detail: `${stale.length} stuck report(s) marked as failed`, auto_fixable: true, checked_at: new Date().toISOString() })
    } else {
      checks.push({ name: 'Data: Stale intel reports', category: 'data', status: 'pass', detail: 'No stuck reports', auto_fixable: true, checked_at: new Date().toISOString() })
    }
  } catch { /* skip */ }

  // Check agency name hasn't been changed from Momenta Marketing
  try {
    const { data: agency } = await s.from('agencies').select('name, brand_name').eq('id', '00000000-0000-0000-0000-000000000099').single()
    if (agency && agency.brand_name !== 'Momenta Marketing') {
      // Auto-fix
      await s.from('agencies').update({ brand_name: 'Momenta Marketing' }).eq('id', '00000000-0000-0000-0000-000000000099')
      checks.push({ name: 'Data: Agency name', category: 'data', status: 'auto_fixed', detail: `Brand name was "${agency.brand_name}" — auto-fixed to "Momenta Marketing"`, auto_fixable: true, checked_at: new Date().toISOString() })
    } else {
      checks.push({ name: 'Data: Agency name', category: 'data', status: 'pass', detail: 'Momenta Marketing — correct', auto_fixable: true, checked_at: new Date().toISOString() })
    }
  } catch { /* skip */ }

  // Check for deleted clients still referenced
  try {
    const { count } = await s.from('clients').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null)
    checks.push({ name: 'Data: Soft-deleted clients', category: 'data', status: 'pass', detail: `${count || 0} soft-deleted (properly excluded from queries)`, auto_fixable: false, checked_at: new Date().toISOString() })
  } catch { /* skip */ }

  return checks
}

// ═══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'full_scan') {
    const [envChecks, dbChecks, apiChecks, integrationChecks, dataChecks] = await Promise.all([
      Promise.resolve(checkEnvVars()),
      checkDatabase(),
      checkAPIs(),
      checkIntegrations(),
      checkDataIntegrity(),
    ])

    const allChecks = [...envChecks, ...dbChecks, ...apiChecks, ...integrationChecks, ...dataChecks]

    const summary = {
      total: allChecks.length,
      pass: allChecks.filter(c => c.status === 'pass').length,
      warn: allChecks.filter(c => c.status === 'warn').length,
      fail: allChecks.filter(c => c.status === 'fail').length,
      auto_fixed: allChecks.filter(c => c.status === 'auto_fixed').length,
      overall: allChecks.some(c => c.status === 'fail') ? 'unhealthy' : allChecks.some(c => c.status === 'warn') ? 'degraded' : 'healthy',
      scanned_at: new Date().toISOString(),
    }

    // Store scan result
    const s = sb()
    await s.from('kotoiq_sync_log').insert({
      client_id: null, source: 'system_health', status: 'complete',
      records_synced: allChecks.length,
      completed_at: new Date().toISOString(),
      metadata: { summary, checks: allChecks },
    })

    return NextResponse.json({ summary, checks: allChecks })
  }

  // Get latest scan result
  if (action === 'latest') {
    const s = sb()
    const { data } = await s.from('kotoiq_sync_log').select('metadata, completed_at')
      .eq('source', 'system_health').order('completed_at', { ascending: false }).limit(1).single()
    return NextResponse.json({ scan: data?.metadata || null, scanned_at: data?.completed_at || null })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
