// The browser supabase client is exposed via a Proxy whose TS type resolves
// to `{}`; cast to SupabaseClient for the bits we actually use.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as supabaseRaw } from '../supabase'
const supabase = supabaseRaw as unknown as SupabaseClient

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — client-side fetch helper for the trainee /my-plan view.
//
// Reads the current magic-link session from the browser supabase client,
// pulls the access token, and POSTs to /api/trainer/my-plan with a Bearer
// header. The server verifies the token against koto_fitness_trainee_users
// and returns only THIS trainee's plan — body.trainee_id is ignored.
//
// NOT marked `server-only` — this file is imported by the MyPlanPage view,
// which runs in the browser.
// ─────────────────────────────────────────────────────────────────────────────

export interface MyPlanAgencyBranding {
  name: string | null
  brand_color: string | null
  logo_url: string | null
  support_email: string | null
}

export interface MyPlanTrainee {
  id: string
  full_name: string | null
  primary_goal: string | null
}

export interface MyPlanInviteMeta {
  status: string
  disclaimer_ack_at: string | null
}

export interface MyPlanResponse {
  plan: Record<string, unknown> | null
  logs: unknown[]
  trainee: MyPlanTrainee
  agency: MyPlanAgencyBranding | null
  invite: MyPlanInviteMeta
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function callMyPlan<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeader()),
  }
  const res = await fetch('/api/trainer/my-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...extra }),
  })
  const raw = await res.text()
  let payload: unknown = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }
  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && (payload as { error?: string }).error) ||
      `Request failed (${res.status})`
    const e = new Error(String(msg))
    ;(e as Error & { status?: number }).status = res.status
    throw e
  }
  return payload as T
}

export function fetchMyPlan(): Promise<MyPlanResponse> {
  return callMyPlan<MyPlanResponse>('get_my_plan')
}

export interface LogSetInput {
  plan_id: string
  session_day_number: number
  exercise_id: string
  exercise_name: string
  set_number: number
  actual_reps: number
  actual_weight_kg?: number | null
  rpe?: number | null
  notes?: string
}

export function logSet(input: LogSetInput): Promise<{ log_id: string }> {
  return callMyPlan<{ log_id: string }>('log_set', input as unknown as Record<string, unknown>)
}

export interface UpdateLogPatch {
  actual_weight_kg?: number | null
  actual_reps?: number
  rpe?: number | null
  notes?: string | null
}

export function updateLog(log_id: string, patch: UpdateLogPatch): Promise<{ ok: boolean }> {
  return callMyPlan<{ ok: boolean }>('update_log', { log_id, patch })
}

/**
 * Persist the disclaimer-ack timestamp. Writes to the trainee's own
 * user_metadata via supabase.auth.updateUser — no server round-trip needed.
 * Also POSTs to a (future) endpoint so the mapping row mirrors the ack;
 * for Phase 3 we just write metadata and re-fetch the plan (the JWT still
 * carries the old metadata until refresh, but our UI reads ack from the
 * metadata update promise).
 */
/**
 * Natural-language plan adjustment — powers the "What's going on?" box.
 * POSTs to /api/my-plan/adjust (separate endpoint from /api/trainer/my-plan
 * because this is a generating action with a larger auth surface).
 */
export interface NaturalAdjustInput {
  message: string
  scope?: 'this_session' | 'rest_of_block' | 'swap_exercise'
  session_day_number?: number
  exercise_id?: string
}

export interface NaturalAdjustResponse {
  ok: true
  workout_plan: Record<string, unknown>
  adherence_note: string | null
  adjustments_made: unknown[]
}

export async function adjustPlanNL(input: NaturalAdjustInput): Promise<NaturalAdjustResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeader()),
  }
  const res = await fetch('/api/my-plan/adjust', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const raw = await res.text()
  let payload: unknown = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }
  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && (payload as { error?: string; detail?: string }).detail) ||
      (payload && typeof payload === 'object' && (payload as { error?: string }).error) ||
      `Adjust failed (${res.status})`
    const e = new Error(String(msg))
    ;(e as Error & { status?: number }).status = res.status
    throw e
  }
  return payload as NaturalAdjustResponse
}

export async function ackDisclaimer(): Promise<void> {
  const nowIso = new Date().toISOString()
  await supabase.auth.updateUser({
    data: { trainer_disclaimer_ack_at: nowIso },
  })
}
