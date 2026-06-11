import 'server-only'
// ── Guided-flow session persistence (WS7 seamless rework) ────────────────────
// The guided spine used to hold ALL of its state — which step you're on, the
// state/cities you picked, and every step's generated result — in ephemeral
// React state. Navigating away or refreshing reset it to step 1 and re-showed
// every "Run this" button as if nothing had happened, even though the heavy
// artifacts (confirmed services, strategy, build order) were already persisted
// in their own tables. The work was saved; the UI just never read it back.
//
// This module gives the spine a durable, rehydratable session WITHOUT a schema
// migration: it splices reserved keys into the existing untyped
// kotoiq_client_profile.fields jsonb (the same column saveConfirmedField writes
// the confirmed categories into). The reserved keys are underscore-prefixed so
// they never collide with a real category (keywords/phrases/services/offerings)
// and the score_grid / recommend_* readers that pull specific category keys are
// unaffected.
//
//   fields.__session     — { current_step, state, cities[], updated_at }
//   fields.__strategy    — { strategy, competitor_intel_available, saved_at }
//   fields.__opportunity — { opportunity, saved_at }
//
// All writes are read-merge-write against the live fields blob so concurrent
// category saves are preserved (same pattern as saveConfirmedField).

import { getKotoIQDb } from '../kotoiqDb'

// Reserved keys — underscore-prefixed so they can never shadow a real category.
export const SESSION_KEY = '__session' as const
export const STRATEGY_KEY = '__strategy' as const
export const OPPORTUNITY_KEY = '__opportunity' as const

export interface GuidedSession {
  /** Index of the step the user is viewing (0-based, matches GuidedSpine STEPS). */
  current_step?: number
  /** Confirmed target state abbreviation (e.g. 'TX'). */
  state?: string
  /** Confirmed target city names (Census place names). */
  cities?: string[]
  updated_at?: string
}

/** Read the full untyped fields jsonb for a client (or {} if no profile row). */
async function readFields(agencyId: string, clientId: string): Promise<Record<string, unknown>> {
  const db = getKotoIQDb(agencyId)
  const { data: profile } = await db.clientProfile.get(clientId)
  return ((profile as { fields?: Record<string, unknown> } | null)?.fields || {}) as Record<string, unknown>
}

/** Read-merge-write one reserved key into kotoiq_client_profile.fields. */
async function mergeKey(
  agencyId: string,
  clientId: string,
  key: string,
  value: unknown,
): Promise<{ ok: boolean; detail?: string }> {
  if (!agencyId || !clientId) return { ok: false, detail: 'missing agency_id or client_id' }
  try {
    const db = getKotoIQDb(agencyId)
    const fields = await readFields(agencyId, clientId)
    fields[key] = value
    const { error } = await db.clientProfile.upsert({ client_id: clientId, fields })
    if (error) return { ok: false, detail: (error as { message?: string }).message || 'upsert failed' }
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'mergeKey error' }
  }
}

// ── Session (nav position + targeting) ───────────────────────────────────────

/** Persist the lightweight nav/targeting session so back/forward/refresh restore it. */
export async function saveGuidedSession(
  agencyId: string,
  clientId: string,
  session: GuidedSession,
): Promise<{ ok: boolean; detail?: string }> {
  const clean: GuidedSession = {
    current_step: typeof session.current_step === 'number' ? session.current_step : undefined,
    state: typeof session.state === 'string' ? session.state : undefined,
    cities: Array.isArray(session.cities)
      ? session.cities.map(c => String(c)).filter(Boolean)
      : undefined,
    updated_at: new Date().toISOString(),
  }
  return mergeKey(agencyId, clientId, SESSION_KEY, clean)
}

export async function getGuidedSession(
  agencyId: string,
  clientId: string,
): Promise<GuidedSession | null> {
  const fields = await readFields(agencyId, clientId)
  const s = fields[SESSION_KEY]
  return (s && typeof s === 'object') ? (s as GuidedSession) : null
}

// ── Step result blobs (so a step rehydrates its rich view, not a Run button) ──

/** Persist the generated strategy blob so StepStrategy rehydrates the full plan. */
export async function saveStrategyBlob(
  agencyId: string,
  clientId: string,
  payload: { strategy: unknown; competitor_intel_available?: boolean },
): Promise<{ ok: boolean; detail?: string }> {
  return mergeKey(agencyId, clientId, STRATEGY_KEY, {
    strategy: payload.strategy,
    competitor_intel_available: !!payload.competitor_intel_available,
    saved_at: new Date().toISOString(),
  })
}

export async function getStrategyBlob(agencyId: string, clientId: string): Promise<unknown | null> {
  const fields = await readFields(agencyId, clientId)
  const s = fields[STRATEGY_KEY]
  return (s && typeof s === 'object') ? s : null
}

/** Persist the opportunity list so StepGaps rehydrates instead of re-running. */
export async function saveOpportunityBlob(
  agencyId: string,
  clientId: string,
  opportunity: unknown,
): Promise<{ ok: boolean; detail?: string }> {
  return mergeKey(agencyId, clientId, OPPORTUNITY_KEY, {
    opportunity,
    saved_at: new Date().toISOString(),
  })
}

export async function getOpportunityBlob(agencyId: string, clientId: string): Promise<unknown | null> {
  const fields = await readFields(agencyId, clientId)
  const o = fields[OPPORTUNITY_KEY]
  return (o && typeof o === 'object') ? o : null
}
