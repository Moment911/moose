import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const GOOGLE_KEY    = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''
const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY || ''
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

type CheckResult = {
  name: string
  status: 'ok' | 'warn' | 'error'
  latency_ms?: number
  message: string
  detail?: string
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t = Date.now()
  const result = await fn()
  return { result, ms: Date.now() - t }
}

// ── Individual health checks ─────────────────────────────────────────────────

async function checkSupabase(): Promise<CheckResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { name: 'Supabase DB', status: 'error', message: 'Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }
  }
  try {
    const t = Date.now()
    const { error } = await getSupabase().from('agencies').select('id').limit(1)
    const ms = Date.now() - t
    if (error) return { name: 'Supabase DB', status: 'error', latency_ms: ms, message: error.message }
    return { name: 'Supabase DB', status: ms > 2000 ? 'warn' : 'ok', latency_ms: ms, message: ms > 2000 ? 'Slow response' : 'Connected' }
  } catch (e: any) {
    return { name: 'Supabase DB', status: 'error', message: e.message }
  }
}

async function checkSupabaseTables(): Promise<CheckResult[]> {
  const tables = ['agencies', 'clients', 'reviews', 'desk_tickets', 'subscriptions', 'projects', 'seo_monthly_reports']
  const results: CheckResult[] = []
  for (const table of tables) {
    try {
      const t = Date.now()
      const { error, count } = await getSupabase().from(table).select('*', { count: 'exact', head: true })
      const ms = Date.now() - t
      if (error) {
        results.push({ name: table, status: 'error', message: error.message })
      } else {
        results.push({ name: table, status: 'ok', latency_ms: ms, message: `${count ?? 0} rows` })
      }
    } catch (e: any) {
      results.push({ name: table, status: 'error', message: e.message })
    }
  }
  return results
}


async function checkAnthropicAI(): Promise<CheckResult> {
  if (!ANTHROPIC_KEY) {
    return { name: 'Anthropic AI', status: 'error', message: 'Missing ANTHROPIC_API_KEY' }
  }
  try {
    const { result: res, ms } = await timed(() =>
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] }),
      })
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { name: 'Anthropic AI', status: 'error', latency_ms: ms, message: `HTTP ${res.status}`, detail: err?.error?.message }
    }
    return { name: 'Anthropic AI', status: ms > 5000 ? 'warn' : 'ok', latency_ms: ms, message: ms > 5000 ? 'Slow' : 'Responding' }
  } catch (e: any) {
    return { name: 'Anthropic AI', status: 'error', message: e.message }
  }
}

async function checkGooglePlaces(): Promise<CheckResult> {
  if (!GOOGLE_KEY) {
    return { name: 'Google Places API', status: 'warn', message: 'Missing NEXT_PUBLIC_GOOGLE_PLACES_KEY' }
  }
  try {
    const { result: res, ms } = await timed(() =>
      fetch(`https://places.googleapis.com/v1/places:searchText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.id' },
        body: JSON.stringify({ textQuery: 'test', maxResultCount: 1 }),
      })
    )
    if (res.status === 403) return { name: 'Google Places API', status: 'error', latency_ms: ms, message: 'API key invalid or restricted' }
    if (!res.ok) return { name: 'Google Places API', status: 'error', latency_ms: ms, message: `HTTP ${res.status}` }
    return { name: 'Google Places API', status: 'ok', latency_ms: ms, message: 'Active' }
  } catch (e: any) {
    return { name: 'Google Places API', status: 'error', message: e.message }
  }
}

async function checkStripe(): Promise<CheckResult> {
  if (!STRIPE_KEY) {
    return { name: 'Stripe', status: 'warn', message: 'Missing STRIPE_SECRET_KEY' }
  }
  try {
    const { result: res, ms } = await timed(() =>
      fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${STRIPE_KEY}` },
      })
    )
    if (res.status === 401) return { name: 'Stripe', status: 'error', latency_ms: ms, message: 'Invalid API key' }
    if (!res.ok) return { name: 'Stripe', status: 'error', latency_ms: ms, message: `HTTP ${res.status}` }
    return { name: 'Stripe', status: 'ok', latency_ms: ms, message: 'Connected' }
  } catch (e: any) {
    return { name: 'Stripe', status: 'error', message: e.message }
  }
}

async function checkVercelDeployment(): Promise<CheckResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  try {
    const { result: res, ms } = await timed(() => fetch(`${appUrl}/api/debug`, { method: 'GET' }))
    if (!res.ok) return { name: 'Vercel App', status: 'error', latency_ms: ms, message: `HTTP ${res.status}` }
    return { name: 'Vercel App', status: ms > 3000 ? 'warn' : 'ok', latency_ms: ms, message: ms > 3000 ? 'Slow cold start' : 'Healthy' }
  } catch (e: any) {
    return { name: 'Vercel App', status: 'error', message: e.message }
  }
}

async function getAgencyStats(): Promise<any> {
  const sb = getSupabase()
  const [
    { count: agencies },
    { count: clients },
    { count: tickets },
    { count: reviews },
    { count: activeSubscriptions },
    { data: recentErrors },
  ] = await Promise.all([
    sb.from('agencies').select('*', { count: 'exact', head: true }),
    sb.from('clients').select('*', { count: 'exact', head: true }),
    sb.from('desk_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('reviews').select('*', { count: 'exact', head: true }),
    sb.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
    sb.from('system_health_log').select('*').eq('status', 'error').order('created_at', { ascending: false }).limit(5),
  ])
  return { agencies, clients, tickets, reviews, activeSubscriptions, recentErrors: recentErrors || [] }
}

// ── AI auto-fix for errors ───────────────────────────────────────────────────
async function askClaudeToFix(errors: CheckResult[]): Promise<string> {
  if (!ANTHROPIC_KEY || errors.length === 0) return ''
  const prompt = `You are a DevOps engineer monitoring the Koto marketing platform (hellokoto.com). 
The following system health checks just FAILED:

${errors.map(e => `- ${e.name}: ${e.message}${e.detail ? ' — ' + e.detail : ''}`).join('\n')}

For each error, provide:
1. Likely root cause
2. Specific fix steps the agency owner can take
3. Whether this is likely temporary or needs manual intervention
4. Severity (P1=down, P2=degraded, P3=cosmetic)

Be concise and actionable. Format as plain text with clear sections per error.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    const d = await res.json()
    return d.content?.[0]?.text || ''
  } catch { return '' }
}

// ── Persist health log to DB ─────────────────────────────────────────────────
async function logHealthCheck(checks: CheckResult[], aiAnalysis: string) {
  const sb = getSupabase()
  const errorCount = checks.filter(c => c.status === 'error').length
  const warnCount  = checks.filter(c => c.status === 'warn').length
  const overallStatus = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok'

  // Create table if it doesn't exist (best-effort)
  try {
    await sb.from('system_health_log').insert({
      status:       overallStatus,
      error_count:  errorCount,
      warn_count:   warnCount,
      checks:       checks,
      ai_analysis:  aiAnalysis || null,
      created_at:   new Date().toISOString(),
    })
  } catch (e) {
    // Table may not exist yet — ignore
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') || 'full'

  if (mode === 'ping') {
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  }

  if (mode === 'stats') {
    try {
      const stats = await getAgencyStats()
      return NextResponse.json(stats)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Full health check
  const startTime = Date.now()

  const [supabase, anthropic, google, stripe, vercel] = await Promise.all([
    checkSupabase(),
    checkAnthropicAI(),
    checkGooglePlaces(),
    checkStripe(),
    checkVercelDeployment(),
  ])

  const tablechecks = mode === 'full' ? await checkSupabaseTables() : []

  const allChecks = [supabase, anthropic, google, stripe, vercel, ...tablechecks]
  const errors    = allChecks.filter(c => c.status === 'error')
  const warns     = allChecks.filter(c => c.status === 'warn')

  // Ask Claude to analyze errors
  const aiAnalysis = errors.length > 0 ? await askClaudeToFix(errors) : ''

  // Log to DB
  await logHealthCheck(allChecks, aiAnalysis)

  const overallStatus = errors.length > 0 ? 'error' : warns.length > 0 ? 'warn' : 'ok'

  return NextResponse.json({
    status:       overallStatus,
    duration_ms:  Date.now() - startTime,
    timestamp:    new Date().toISOString(),
    checks:       allChecks,
    errors:       errors.length,
    warnings:     warns.length,
    ai_analysis:  aiAnalysis,
    env: {
      has_anthropic:  !!ANTHROPIC_KEY,
      has_google:     !!GOOGLE_KEY,
      has_stripe:     !!STRIPE_KEY,
      has_supabase:   !!SUPABASE_URL && !!SUPABASE_KEY,
    }
  })
}
