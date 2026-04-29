// ─────────────────────────────────────────────────────────────
// LinkedIn Ads — Token refresh helper
// Access tokens last 60 days, refresh tokens 365 days.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export async function ensureLinkedInToken(
  s: SupabaseClient,
  conn: { id: string; access_token: string; refresh_token?: string; token_expires_at?: string }
): Promise<string> {
  if (!conn.access_token) throw new Error('No LinkedIn access token')

  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime()
    if (expiresAt - Date.now() > REFRESH_THRESHOLD_MS) return conn.access_token
  }

  if (!conn.refresh_token) return conn.access_token

  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim()
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return conn.access_token

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) return conn.access_token

  const data = await res.json()
  if (!data.access_token) return conn.access_token

  const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()
  await s.from('seo_connections').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || conn.refresh_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', conn.id)

  return data.access_token
}
