// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase as supabaseAny } from './supabase'
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

export async function profileFetch<T = unknown>(body: Record<string, unknown>, opts?: { agencyId?: string | null }): Promise<T & { ok?: boolean; error?: string; status?: number }> {
  const auth = await authHeader()
  const headers: Record<string, string> = { 'content-type': 'application/json', ...auth }
  if (opts?.agencyId) headers['x-koto-agency-id'] = opts.agencyId
  const res = await fetch('/api/kotoiq/profile', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  let json: unknown = null
  try { json = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = (json as { error?: string } | null)?.error
    return { ok: false, error: err || `HTTP ${res.status}`, status: res.status } as T & { ok: boolean; error: string; status: number }
  }
  return (json || { ok: true }) as T & { ok?: boolean }
}

export async function profileStreamSeed(
  body: { client_id?: string; pasted_text?: string; force_rebuild?: boolean },
  signal?: AbortSignal,
  opts?: { agencyId?: string | null }
): Promise<Response> {
  const auth = await authHeader()
  const headers: Record<string, string> = { 'content-type': 'application/json', ...auth }
  if (opts?.agencyId) headers['x-koto-agency-id'] = opts.agencyId
  return fetch('/api/kotoiq/profile/stream_seed', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
}
