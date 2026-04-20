import 'server-only'
import { getKotoIQDb, type KotoIQDb } from '../kotoiqDb'
import { BUDGETS, RATE_LIMITS } from './profileConfig'
import type { SourceType } from './profileTypes'

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
  warn_reason?: string
  block_reason?: string
}

export type CheckBudgetArgs = {
  agencyId: string
  clientId: string
  estimatedCost: number
  /** If caller already has a db handle, pass it to avoid re-creating. */
  db?: KotoIQDb
}

/** D-22 + D-23: check daily budgets. Returns discriminated-union state.
 *  NEVER throws — pipeline never blocks on a budget-check read failure
 *  (matches Phase 7 D-19 non-blocking forwarder pattern). */
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
  const warnThreshold = BUDGETS.WARN_THRESHOLD_RATIO

  const clientBlocks = projectedClient > clientBudget
  const agencyBlocks = projectedAgency > agencyBudget
  // Priority: agency scope is tighter (D-23 override gated to owner role).
  const scope: 'client' | 'agency' | null = agencyBlocks ? 'agency' : clientBlocks ? 'client' : null

  const clientWarns = projectedClient >= warnThreshold * clientBudget
  const agencyWarns = projectedAgency >= warnThreshold * agencyBudget

  return {
    allowed: !(clientBlocks || agencyBlocks),
    warn: clientWarns || agencyWarns,
    block: clientBlocks || agencyBlocks,
    scope,
    today_spend_client: clientSpend,
    today_spend_agency: agencySpend,
    projected_client: projectedClient,
    projected_agency: projectedAgency,
    remaining_client: Math.max(0, clientBudget - clientSpend),
    remaining_agency: Math.max(0, agencyBudget - agencySpend),
    requires_override: clientBlocks || agencyBlocks,
    warn_reason: clientWarns ? 'client' : agencyWarns ? 'agency' : undefined,
    block_reason: agencyBlocks ? 'agency' : clientBlocks ? 'client' : undefined,
  }
}

/** Sum koto_token_usage.cost_usd for today (UTC midnight boundary).
 *  clientId=null → agency-wide total. */
export async function getTodaySpend(
  db: KotoIQDb,
  agencyId: string,
  clientId: string | null,
): Promise<number> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const sinceIso = today.toISOString()

  const q = db.client.from('koto_token_usage')
    .select('cost_usd, metadata')
    .eq('agency_id', agencyId)
    .gte('created_at', sinceIso)

  const { data, error } = await q
  if (error || !data) {
    console.error('[profileCostBudget] getTodaySpend read failed', { agencyId, clientId, error })
    return 0  // fail-open: never block on DB read failure
  }

  let total = 0
  for (const row of data as Array<{ cost_usd: number | null; metadata?: any }>) {
    if (clientId) {
      const rowClient = row.metadata?.client_id
      if (rowClient !== clientId) continue
    }
    total += Number(row.cost_usd ?? 0)
  }
  return Math.round(total * 10000) / 10000
}

export type ApplyOverrideArgs = {
  agencyId: string
  clientId: string
  userId: string
  estimatedCost: number
  originalCap: number
  overrideValue: number
  scope: 'client' | 'agency' | 'per_source_cap'
  sourceType: SourceType
  justification?: string | null
  db?: KotoIQDb
}

/** D-25: write exactly one koto_audit_log row per override. NEVER throws —
 *  log-and-continue on write failure so overrides don't block work. */
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

  const { error } = await db.client.from('koto_audit_log').insert(row)
  if (error) {
    console.error('[profileCostBudget] applyOverride audit write failed', { error, row })
    return { logged: false }
  }
  return { logged: true }
}

// ── Rate limiting (RESEARCH §Security Domain) ──────────────────────────────
// In-process sliding-window buckets. NOTE: function-instance-local — only
// effective per warm Vercel Function instance, not globally. Acceptable for
// v1; if we see abuse, upgrade to Upstash-backed ratelimit (RESEARCH §Open Q).

type Bucket = { windowMs: number; max: number; events: number[] }
const RATE_BUCKETS: Record<string, Map<string, Bucket>> = {}

export type RateLimitAction = 'seed_form_url' | 'connect_gbp_oauth_start'

export function checkRateLimit(args: {
  agencyId: string
  actionKey: RateLimitAction
}): { allowed: boolean; retry_after_ms: number } {
  const cfg = RATE_BUCKETS[args.actionKey] ?? (RATE_BUCKETS[args.actionKey] = new Map())
  let bucket = cfg.get(args.agencyId)
  if (!bucket) {
    const { windowMs, max } = RATE_CONFIG[args.actionKey]
    bucket = { windowMs, max, events: [] }
    cfg.set(args.agencyId, bucket)
  }
  const now = Date.now()
  bucket.events = bucket.events.filter(t => now - t < bucket!.windowMs)
  if (bucket.events.length >= bucket.max) {
    const oldest = bucket.events[0]
    return { allowed: false, retry_after_ms: bucket.windowMs - (now - oldest) }
  }
  bucket.events.push(now)
  return { allowed: true, retry_after_ms: 0 }
}

const RATE_CONFIG: Record<RateLimitAction, { windowMs: number; max: number }> = {
  seed_form_url: { windowMs: 60_000, max: RATE_LIMITS.SEED_FORM_URL_PER_AGENCY_PER_MIN },
  connect_gbp_oauth_start: { windowMs: 3_600_000, max: RATE_LIMITS.CONNECT_GBP_OAUTH_START_PER_AGENCY_PER_HOUR },
}

/** Test-only: reset buckets between tests. */
export function __resetRateLimits() {
  for (const k of Object.keys(RATE_BUCKETS)) delete RATE_BUCKETS[k]
}
