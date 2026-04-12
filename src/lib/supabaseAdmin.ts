// src/lib/supabaseAdmin.ts
//
// Single source of truth for the Supabase service-role client.
//
// This file is the ONLY place in the repo that should read
// SUPABASE_SERVICE_ROLE_KEY. Every API route and server library that
// needs admin access imports `supabaseAdmin` from here. The upside:
//
//   1. One place to audit. Any future concern about the service-role
//      key starts and ends with this file.
//   2. Build-time leak protection. The `import 'server-only'` line at
//      the top makes Next.js *refuse to bundle* this module into any
//      client component. If anyone ever tries to `import` this from
//      a 'use client' file or a React Router view, `next build` will
//      fail with a clear error pointing at the offending import.
//   3. No silent anon fallback. The previous pattern
//      `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`
//      was convenient during local dev but hid misconfigured
//      production deployments that would silently downgrade to anon
//      access (breaking RLS-protected writes without throwing). This
//      module throws at construction time if the service key is
//      missing, so the failure is loud and immediate.
//
// Usage:
//   import { supabaseAdmin } from '@/lib/supabaseAdmin'
//   const { data } = await supabaseAdmin.from('clients').select('*')
//
// Or for one-off callers that want their own instance:
//   import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
//   const sb = createSupabaseAdmin()

import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function assertEnv() {
  if (!SUPABASE_URL) {
    throw new Error(
      '[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Check your Vercel environment variables.'
    )
  }
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      '[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Admin operations will fail. Check your Vercel environment variables — ' +
      'in production we do NOT fall back to the anon key, because that would ' +
      'silently break any write that depends on bypassing RLS.'
    )
  }
}

// Lazy singleton — constructed on first use, not at module load, so
// importing this file in a test environment without the env var set
// doesn't throw until the code actually tries to make a query.
let _client: SupabaseClient | null = null

export function createSupabaseAdmin(): SupabaseClient {
  assertEnv()
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) _client = createSupabaseAdmin()
  return _client
}

// Default export for the common case — a shared singleton.
// Using a Proxy so `supabaseAdmin.from(...)` constructs the real
// client on first access instead of at import time. This keeps module
// import side-effect-free in case this file ever gets pulled into a
// cold path where the env var isn't available (e.g. Next.js build
// collection phase).
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    // @ts-expect-error — dynamic forward
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
