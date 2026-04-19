import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { MAX_VOICE_TRANSCRIPT_PULLS } from './profileConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — Retell /list-calls fetch helper.
//
// RESEARCH §3.4 Option A + §10: pull raw Retell transcripts on demand for
// the per-transcript Haiku extractor (profileVoiceExtract.extractFromVoiceTranscript).
// The deterministic _call_analysis structured fields are already covered by
// pullFromVoiceCallAnalysis (Plan 2); this module fetches the FULL transcript
// text Haiku needs to surface competitor mentions, objections, and pain-point
// emphasis that the structured analysis doesn't break out.
//
// AGENCY ISOLATION (RESEARCH §15 T-07 — "Retell transcript leak"):
//   koto_onboarding_phone_pool does NOT carry an agency_id column. Isolation
//   flows through the FK chain:
//      koto_onboarding_phone_pool.assigned_to_client_id
//        → clients.id
//        → clients.agency_id
//   The caller (profileSeeder.ts) has already verified that args.clientId
//   belongs to args.agencyId via pullFromClient's `.eq('agency_id', agencyId)`
//   check before this helper runs.  Phone numbers are NEVER accepted from a
//   request body or argument — they're queried out of the phone pool by
//   client_id only, so an attacker cannot cause Retell calls for a number
//   they don't own to be returned.  If the upstream pullFromClient check ever
//   loses its agency_id filter, this helper's isolation goes with it.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type RetellCall = {
  call_id: string
  transcript?: string
  start_timestamp?: number
  from_number?: string
  to_number?: string
  duration_ms?: number
}

async function retellFetch(
  path: string,
  method: 'POST' | 'GET',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const key = process.env.RETELL_API_KEY
  if (!key) throw new Error('RETELL_API_KEY missing')
  const res = await fetch(`https://api.retellai.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key.trim()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Retell ${path} ${res.status}`)
  return await res.json()
}

/**
 * Pulls Retell voice transcripts for a client, capped at
 * MAX_VOICE_TRANSCRIPT_PULLS. See file header for the FK-chain isolation model.
 *
 * Returns only calls with usable transcripts (≥ 40 chars). The 40-char floor
 * matches the Plan 3 extractFromVoiceTranscript noise guard so we don't burn
 * Haiku tokens on calls that won't yield extracted fields anyway.
 */
export async function pullRetellTranscripts(args: {
  clientId: string
  agencyId: string
}): Promise<RetellCall[]> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const { data: phones } = await sb
    .from('koto_onboarding_phone_pool')
    .select('phone_number, assigned_to_client_id')
    .eq('assigned_to_client_id', args.clientId)
  if (!phones || phones.length === 0) return []

  const calls: RetellCall[] = []
  for (const p of phones) {
    if (calls.length >= MAX_VOICE_TRANSCRIPT_PULLS) break
    try {
      const res = await retellFetch('/list-calls', 'POST', {
        filter_criteria: { to_number: [p.phone_number] },
        limit: MAX_VOICE_TRANSCRIPT_PULLS - calls.length,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (res?.calls || res?.data || []) as any[]
      for (const c of list) {
        if (calls.length >= MAX_VOICE_TRANSCRIPT_PULLS) break
        calls.push({
          call_id: c.call_id,
          transcript: c.transcript || '',
          start_timestamp: c.start_timestamp,
          from_number: c.from_number,
          to_number: c.to_number,
          duration_ms: c.duration_ms,
        })
      }
    } catch (err) {

      console.error('[profileRetellPull] retell /list-calls failed', err)
      // continue to next phone
    }
  }
  // Only keep calls with usable transcripts (RESEARCH §10: < 40 chars → skip).
  // Matches the noise guard in profileVoiceExtract so we don't return calls
  // that the downstream Haiku extractor will discard anyway.
  return calls.filter((c) => (c.transcript || '').length >= 40)
}
