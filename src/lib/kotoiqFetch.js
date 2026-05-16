import { supabase } from './supabase'

/**
 * Authenticated fetch helper for /api/kotoiq.
 *
 * Every call attaches the user's Supabase access_token as
 * `Authorization: Bearer ${token}` so the server-side auth gate
 * (verifySession in src/lib/apiAuth.ts) can scope the request to
 * the caller's agency_id and enforce client-ownership.
 *
 * Usage:
 *   const data = await kotoiqFetch('quick_scan', { client_id, website })
 *   if (!data) toast.error('...')  // returns null on auth/network failure
 *
 *   // For non-JSON responses or when you need raw Response:
 *   const res = await kotoiqFetchRaw('export', { client_id })
 *
 * The helper silently tolerates a missing session for now — the server
 * falls back to legacy body-trust behavior. Once every call site has
 * migrated, the server gate will re-tighten to hard-401 unverified.
 */

async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) return { Authorization: `Bearer ${token}` }
  } catch { /* session unavailable — fall through to no-auth */ }
  return {}
}

export async function kotoiqFetchRaw(action, body = {}, extra = {}) {
  const auth = await authHeaders()
  return fetch('/api/kotoiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth, ...(extra.headers || {}) },
    body: JSON.stringify({ action, ...body }),
    ...extra,
  })
}

export async function kotoiqFetch(action, body = {}) {
  try {
    const res = await kotoiqFetchRaw(action, body)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
