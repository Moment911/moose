// ─────────────────────────────────────────────────────────────
// Live connection validation — probes each provider's API to
// confirm tokens/keys are still valid and returns last-synced.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccessToken } from '@/lib/seoService'
import { ensureMetaToken } from '@/lib/ads/metaTokenRefresh'
import { ensureLinkedInToken } from '@/lib/ads/linkedinTokenRefresh'

type ValidationResult = {
  provider: string
  valid: boolean
  error?: string
  last_synced?: string
}

const PROBE_TIMEOUT = 10_000

async function probe(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    return { ok: res.ok, status: res.status }
  } catch (e: any) {
    if (e.name === 'AbortError') return { ok: false, status: 0 }
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

function errorMsg(provider: string, status: number): string {
  if (status === 0) return `Could not reach ${provider} API — try again`
  if (status === 401 || status === 403) {
    if (['search_console', 'analytics', 'ads', 'gmb'].includes(provider))
      return 'Token expired or revoked — reconnect your Google account'
    if (provider === 'meta') return 'Token expired — reconnect Meta'
    if (provider === 'linkedin') return 'Token expired — reconnect LinkedIn'
    return 'Invalid API key — update your credentials'
  }
  return `API returned ${status} — check your configuration`
}

async function probeSearchConsole(conn: any): Promise<ValidationResult> {
  const token = await getAccessToken(conn)
  if (!token) return { provider: 'search_console', valid: false, error: 'Token refresh failed — reconnect Google' }
  const { ok, status } = await probe('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { provider: 'search_console', valid: ok, ...(!ok && { error: errorMsg('search_console', status) }) }
}

async function probeAnalytics(conn: any): Promise<ValidationResult> {
  const token = await getAccessToken(conn)
  if (!token) return { provider: 'analytics', valid: false, error: 'Token refresh failed — reconnect Google' }
  const { ok, status } = await probe('https://analyticsdata.googleapis.com/v1beta/properties?pageSize=1', {
    headers: { Authorization: `Bearer ${token}` },
  })
  // GA4 Admin API may 404 on /properties — fall back to accountSummaries
  if (!ok && status === 404) {
    const r2 = await probe('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { provider: 'analytics', valid: r2.ok, ...(!r2.ok && { error: errorMsg('analytics', r2.status) }) }
  }
  return { provider: 'analytics', valid: ok, ...(!ok && { error: errorMsg('analytics', status) }) }
}

async function probeAds(conn: any): Promise<ValidationResult> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  if (!devToken) return { provider: 'ads', valid: true, error: 'Cannot fully validate — developer token not configured' }
  const token = await getAccessToken(conn)
  if (!token) return { provider: 'ads', valid: false, error: 'Token refresh failed — reconnect Google' }
  const { ok, status } = await probe('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
    headers: { Authorization: `Bearer ${token}`, 'developer-token': devToken },
  })
  return { provider: 'ads', valid: ok, ...(!ok && { error: errorMsg('ads', status) }) }
}

async function probeGmb(conn: any): Promise<ValidationResult> {
  const token = await getAccessToken(conn)
  if (!token) return { provider: 'gmb', valid: false, error: 'Token refresh failed — reconnect Google' }
  const { ok, status } = await probe('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { provider: 'gmb', valid: ok, ...(!ok && { error: errorMsg('gmb', status) }) }
}

async function probeMeta(s: SupabaseClient, conn: any): Promise<ValidationResult> {
  try {
    const token = await ensureMetaToken(s, conn)
    const { ok, status } = await probe(`https://graph.facebook.com/v21.0/me?access_token=${token}`)
    return { provider: 'meta', valid: ok, ...(!ok && { error: errorMsg('meta', status) }) }
  } catch {
    return { provider: 'meta', valid: false, error: 'Token refresh failed — reconnect Meta' }
  }
}

async function probeLinkedin(s: SupabaseClient, conn: any): Promise<ValidationResult> {
  try {
    const token = await ensureLinkedInToken(s, conn)
    const { ok, status } = await probe('https://api.linkedin.com/rest/me', {
      headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202401', 'X-Restli-Protocol-Version': '2.0.0' },
    })
    return { provider: 'linkedin', valid: ok, ...(!ok && { error: errorMsg('linkedin', status) }) }
  } catch {
    return { provider: 'linkedin', valid: false, error: 'Token refresh failed — reconnect LinkedIn' }
  }
}

async function probeHotjar(conn: any): Promise<ValidationResult> {
  const siteId = conn.account_id || conn.external_id
  if (!siteId) return { provider: 'hotjar', valid: false, error: 'Missing Site ID' }
  const { ok, status } = await probe(`https://insights.hotjar.com/api/v2/sites/${siteId}/recordings?count=1`, {
    headers: { Authorization: `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
  })
  return { provider: 'hotjar', valid: ok, ...(!ok && { error: errorMsg('hotjar', status) }) }
}

async function probeClarity(conn: any): Promise<ValidationResult> {
  const projectId = conn.account_id || conn.external_id
  if (!projectId) return { provider: 'clarity', valid: false, error: 'Missing Project ID' }
  const { ok, status } = await probe(`https://www.clarity.ms/api/v1/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
  })
  return { provider: 'clarity', valid: ok, ...(!ok && { error: errorMsg('clarity', status) }) }
}

export async function validateConnections(
  s: SupabaseClient,
  clientId: string,
  provider?: string
): Promise<ValidationResult[]> {
  // Load connections
  let query = s.from('seo_connections').select('*').eq('client_id', clientId).eq('connected', true)
  if (provider) query = query.eq('provider', provider)
  const { data: connections } = await query
  if (!connections?.length) return []

  // Load last successful sync per source
  const { data: syncs } = await s.from('kotoiq_sync_log')
    .select('source, completed_at')
    .eq('client_id', clientId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(50)

  const lastSyncMap: Record<string, string> = {}
  for (const sync of syncs || []) {
    if (sync.source && !lastSyncMap[sync.source]) lastSyncMap[sync.source] = sync.completed_at
  }

  // Map source names to provider names (sync_log may use different source names)
  const syncSourceAliases: Record<string, string[]> = {
    search_console: ['full_sync', 'search_console'],
    analytics: ['full_sync', 'analytics'],
    ads: ['full_sync', 'ads', 'google_ads'],
    gmb: ['full_sync', 'gmb'],
    meta: ['meta', 'meta_ads'],
    linkedin: ['linkedin', 'linkedin_ads'],
    hotjar: ['hotjar', 'behavior_hotjar'],
    clarity: ['clarity', 'behavior_clarity'],
  }

  function getLastSynced(prov: string): string | undefined {
    const aliases = syncSourceAliases[prov] || [prov]
    for (const alias of aliases) {
      if (lastSyncMap[alias]) return lastSyncMap[alias]
    }
    return undefined
  }

  // Probe all in parallel
  const probes = connections.map(async (conn: any): Promise<ValidationResult> => {
    let result: ValidationResult
    switch (conn.provider) {
      case 'search_console': result = await probeSearchConsole(conn); break
      case 'analytics': result = await probeAnalytics(conn); break
      case 'ads': result = await probeAds(conn); break
      case 'gmb': result = await probeGmb(conn); break
      case 'meta': result = await probeMeta(s, conn); break
      case 'linkedin': result = await probeLinkedin(s, conn); break
      case 'hotjar': result = await probeHotjar(conn); break
      case 'clarity': result = await probeClarity(conn); break
      default: result = { provider: conn.provider, valid: false, error: 'Unknown provider' }
    }
    result.last_synced = getLastSynced(conn.provider)
    return result
  })

  const settled = await Promise.allSettled(probes)
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { provider: connections[i].provider, valid: false, error: 'Validation probe crashed' }
  )
}
