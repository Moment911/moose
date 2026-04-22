// Client-side auth-wrapped fetch for /api/trainer/*.  Mirrors
// src/lib/kotoiqProfileFetch.ts — reads the current Supabase session and
// attaches `Authorization: Bearer <access_token>` so verifySession on the
// server returns verified=true + the session's agencyId.
//
// Intentionally NOT guarded with 'server-only' — this module is imported
// from the client-side /trainer views.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase as supabaseAny } from '../supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = supabaseAny

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token ? { authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export async function trainerFetch(body: Record<string, unknown>): Promise<Response> {
  const auth = await authHeader()
  return fetch('/api/trainer/trainees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify(body),
  })
}
