import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Plan 2 — cost-guardrail layer.  Every paid parser in Plans 04-07
// calls checkBudget() before triggering.  Route handlers call applyOverride()
// when the operator clicks "override" and checkRateLimit() at entry.
//
// Implements:
//   D-22 — per-client $5/day warn at 80% + block at 100%
//   D-23 — per-agency $50/day warn at 80% + block at 100%, scope=agency wins
//   D-25 — override audit log (single koto_audit_log row per override)
//   RESEARCH §Security Domain — in-process sliding-window rate limits
//
// Non-blocking forwarder pattern (Phase 7 D-19):
//   checkBudget() never throws on read failure — getTodaySpend returns 0.
//   applyOverride() never throws on write failure — returns {logged:false}
//   and logs to console.error so the pipeline keeps moving.  Agency-owner
//   daily digest SELECTs from koto_audit_log; a missed row degrades
//   visibility but does not block work.
//
// Threat model tie-ins:
//   T-08-10 (D): every puller MUST call checkBudget before paid work
//   T-08-11 (R): applyOverride writes before the paid call proceeds
//   T-08-15 (S): userId comes from verifySession() — never req body
// ─────────────────────────────────────────────────────────────────────────────

import { getKotoIQDb, type KotoIQDb } from '../kotoiqDb'
import { BUDGETS, RATE_LIMITS } from './profileConfig'
import type { SourceType } from './profileTypes'

// ── BudgetCheck discriminated state ──────────────────────────────────────────

export type BudgetCheck = {
  allowed: boolean
  warn: boolean
  block: boolean
  scope: 'client' | 'agency' | null
  today_spend_client: number
  today_spend_agency: number
  projected_client: number
  projected_agency: number
  remaining_client: number
  remaining_agency: number
  requires_override: boolean
  warn_reason?: 'client' | 'agency'
  block_reason?: 'client' | 'agency'
}

export type CheckBudgetArgs = {
  agencyId: string
  clientId: string
  estimatedCost: number
  /** Optional pre-built db handle — avoids re-creating the scoped client. */
  db?: KotoIQDb
}

/**
 * D-22 + D-23 — combined per-client and per-agency budget check.
 *
 * Returns a discriminated state every caller branches on:
 *   - allowed=true,  warn=false → proceed silently
 *   - allowed=true,  warn=true  → proceed but surface a banner (D-22 80% warn)
 *   - allowed=false, block=true → refuse unless requires_override handled
 *
 * Scope priority: agency wins over client.  When both limits would trip,
 * we report scope='agency' so the UI gates the override button to
 * owner/admin role (D-23).  Client-only blocks can be overridden by any
 * operator (D-22).
 *
 * Never throws.  Read failure from getTodaySpend is treated as 0 spend
 * (fail-open) to keep the pipeline unblocked on DB flakiness.
 */
export async function checkBudget(args: CheckBudgetArgs): Promise<BudgetCheck> {
  const db = args.db ?? getKotoIQDb(args.agencyId)

  const [clientSpend, agencySpend] = await Promise.all([
    getTodaySpend(db, args.agencyId, args.clientId),
    getTodaySpend(db, args.agencyId, null),
  ])

  const projectedClient = clientSpend + args.estimatedCost
  const projectedAgency = agencySpend + args.estimatedCost
  const clientBudget = BUDGETS.PER_CLIENT_DAILY_USD
  const agencyBudget = BUDGETS.PER_AGENCY_DAILY_USD
  const warnRatio = BUDGETS.WARN_THRESHOLD_RATIO

  const clientBlocks = projectedClient > clientBudget
  const agencyBlocks = projectedAgency > agencyBudget

  // Scope priority: agency is the tighter gate (override restricted to
  // owner/admin role per D-23).  Report agency when both trip.
  const blockScope: 'client' | 'agency' | null = agencyBlocks
    ? 'agency'
    : clientBlocks
      ? 'client'
      : null

  const clientWarns = projectedClient >= warnRatio * clientBudget
  const agencyWarns = projectedAgency >= warnRatio * agencyBudget

  return {
    allowed: !(clientBlocks || agencyBlocks),
    warn: clientWarns || agencyWarns,
    block: clientBlocks || agencyBlocks,
    scope: blockScope,
    today_spend_client: clientSpend,
    today_spend_agency: agencySpend,
    projected_client: round4(projectedClient),
    projected_agency: round4(projectedAgency),
    remaining_client: Math.max(0, round4(clientBudget - clientSpend)),
    remaining_agency: Math.max(0, round4(agencyBudget - agencySpend)),
    requires_override: clientBlocks || agencyBlocks,
    warn_reason: clientWarns ? 'client' : agencyWarns ? 'agency' : undefined,
    block_reason: agencyBlocks ? 'agency' : clientBlocks ? 'client' : undefined,
  }
}

/**
 * Sum koto_token_usage.cost_usd for the current UTC day.
 *
 * Filtering:
 *   clientId=null     → agency-wide total (all rows for agency_id)
 *   clientId=<uuid>   → per-client: rows where metadata->>client_id = uuid
 *
 * Phase 7 stores client_id in metadata jsonb (not as a column) — existing
 * logTokenUsage() call sites in tokenTracker.ts thread it through metadata.
 * We read it client-side after the SELECT to avoid a jsonb GIN index
 * requirement for Phase 8 (the daily row count per agency is small enough
 * that in-memory filtering is cheap).
 *
 * Fail-open: any read error returns 0 so a Supabase blip doesn't block
 * operator work.  Error is logged to console.error for observability.
 */
export async function getTodaySpend(
  db: KotoIQDb,
  agencyId: string,
  clientId: string | null,
): Promise<number> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const sinceIso = today.toISOString()

  try {
    const query = db.client
      .from('koto_token_usage')
      .select('cost_usd, metadata')
      .eq('agency_id', agencyId)
      .gte('created_at', sinceIso)

    const { data, error } = (await query) as {
      data: Array<{ cost_usd: number | null; metadata?: any }> | null
      error: any
    }

    if (error || !data) {
      if (error) {
        console.error('[profileCostBudget] getTodaySpend read failed', {
          agencyId,
          clientId,
          error,
        })
      }
      return 0
    }

    let total = 0
    for (const row of data) {
      if (clientId) {
        const rowClient = row.metadata?.client_id
        if (rowClient !== clientId) continue
      }
      total += Number(row.cost_usd ?? 0)
    }
    return round4(total)
  } catch (e) {
    console.error('[profileCostBudget] getTodaySpend threw', { agencyId, clientId, error: e })
    return 0
  }
}

// ── D-25 override audit logging ──────────────────────────────────────────────

export type ApplyOverrideArgs = {
  agencyId: string
  clientId: string
  /** From verifySession().userId — NEVER accept from request body (T-08-15). */
  userId: string
  estimatedCost: number
  originalCap: number
  overrideValue: number
  scope: 'client' | 'agency' | 'per_source_cap'
  sourceType: SourceType
  justification?: string | null
  db?: KotoIQDb
}

/**
 * D-25 — write exactly one koto_audit_log row when an operator overrides
 * a budget gate.  Mirrors the apiAuth.ts impersonation-log shape verbatim
 * (action text, target_agency_id, metadata jsonb).
 *
 * Agency owners read these via a daily digest query:
 *   SELECT * FROM koto_audit_log
 *    WHERE target_agency_id = $1
 *      AND action = 'cost_budget_override'
 *      AND created_at >= now() - interval '1 day'
 *
 * Never throws on audit-write failure — logs to console.error and returns
 * { logged:false } per Phase 7 D-19 non-blocking forwarder pattern.  The
 * paid call still proceeds; the operator's trail just has a gap (logged
 * alongside the write failure so the operator agency can reconcile).
 */
export async function applyOverride(args: ApplyOverrideArgs): Promise<{ logged: boolean }> {
  const db = args.db ?? getKotoIQDb(args.agencyId)

  const row = {
    user_id: args.userId,
    action: 'cost_budget_override' as const,
    target_agency_id: args.agencyId,
    target_client_id: args.clientId,
    metadata: {
      scope: args.scope,
      original_cap: args.originalCap,
      override_value: args.overrideValue,
      justification: args.justification ?? null,
      source_type: args.sourceType,
      client_id: args.clientId,
      estimated_cost: args.estimatedCost,
    },
  }

  try {
    const { error } = (await db.client.from('koto_audit_log').insert(row)) as { error: any }
    if (error) {
      console.error('[profileCostBudget] applyOverride audit write failed', { error, row })
      return { logged: false }
    }
    return { logged: true }
  } catch (e) {
    console.error('[profileCostBudget] applyOverride threw', { error: e, row })
    return { logged: false }
  }
}

// ── Rate limiting (RESEARCH §Security Domain) ────────────────────────────────
//
// In-process sliding-window buckets.  Per-Vercel-Function-instance local —
// T-08-12 accepts this tradeoff for v1; if an attacker triggers enough
// bursty requests to spread across cold-start instances we'll see multiples
// of the configured cap.  Upgrade path to Upstash-backed ratelimit is
// tracked in RESEARCH §12 Open Questions.  Until then, the budget cap
// (D-22/D-23) remains the real cost gate — rate-limiting is a politeness
// and quota-preservation layer.

type Bucket = { windowMs: number; max: number; events: number[] }
const RATE_BUCKETS: Record<string, Map<string, Bucket>> = {}

export type RateLimitAction = 'seed_form_url' | 'connect_gbp_oauth_start'

const RATE_CONFIG: Record<RateLimitAction, { windowMs: number; max: number }> = {
  seed_form_url: {
    windowMs: 60_000,
    max: RATE_LIMITS.SEED_FORM_URL_PER_AGENCY_PER_MIN,
  },
  connect_gbp_oauth_start: {
    windowMs: 3_600_000,
    max: RATE_LIMITS.CONNECT_GBP_OAUTH_START_PER_AGENCY_PER_HOUR,
  },
}

export type RateLimitResult = { allowed: boolean; retry_after_ms: number }

/**
 * Sliding-window rate limit check.  Call from the API route entry point
 * BEFORE any expensive work — a blocked caller should not even reach
 * checkBudget().
 *
 * Per-agency buckets.  Different agencies share no state; different
 * action keys share no state.
 *
 * On allow: records the event.  On block: returns the retry-after window
 * so the API can surface a 429 with a useful `Retry-After` hint.
 */
export function checkRateLimit(args: {
  agencyId: string
  actionKey: RateLimitAction
}): RateLimitResult {
  const actionCfg = RATE_CONFIG[args.actionKey]
  if (!actionCfg) {
    // Unknown action — fail open (the caller set up the rate-limit path
    // wrong; better to let the request through than silently block).
    return { allowed: true, retry_after_ms: 0 }
  }

  const perAction = RATE_BUCKETS[args.actionKey] ?? (RATE_BUCKETS[args.actionKey] = new Map())
  let bucket = perAction.get(args.agencyId)
  if (!bucket) {
    bucket = { windowMs: actionCfg.windowMs, max: actionCfg.max, events: [] }
    perAction.set(args.agencyId, bucket)
  }

  const now = Date.now()
  // Drop events older than the window (sliding-window semantics).
  bucket.events = bucket.events.filter((t) => now - t < bucket!.windowMs)

  if (bucket.events.length >= bucket.max) {
    const oldest = bucket.events[0] ?? now
    return {
      allowed: false,
      retry_after_ms: bucket.windowMs - (now - oldest),
    }
  }

  bucket.events.push(now)
  return { allowed: true, retry_after_ms: 0 }
}

/**
 * Test-only: wipe every rate-limit bucket between tests.  Exported so
 * Vitest `beforeEach` can reset; callers outside tests should never need
 * to invoke this.
 */
export function __resetRateLimits(): void {
  for (const k of Object.keys(RATE_BUCKETS)) delete RATE_BUCKETS[k]
}

// ── Utilities ────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
