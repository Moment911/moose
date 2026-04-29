// ─────────────────────────────────────────────────────────────
// Meta Ads — Token refresh helper
// Long-lived tokens last 60 days. Refresh when <7 days remaining.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function ensureMetaToken(
  s: SupabaseClient,
  conn: { id: string; access_token: string; token_expires_at?: string }
): Promise<string> {
  if (!conn.access_token) throw new Error('No Meta access token')

  // Check if token needs refresh
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime()
    const now = Date.now()
    if (expiresAt - now > REFRESH_THRESHOLD_MS) return conn.access_token
  }

  // Refresh the long-lived token
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) return conn.access_token // can't refresh, use as-is

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: conn.access_token,
  })

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`)
  if (!res.ok) return conn.access_token // refresh failed, use existing

  const data = await res.json()
  if (!data.access_token) return conn.access_token

  // Update stored token
  const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()
  await s.from('seo_connections').update({
    access_token: data.access_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', conn.id)

  return data.access_token
}
