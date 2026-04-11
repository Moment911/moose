// ─────────────────────────────────────────────────────────────
// Token usage tracker
//
// Fire-and-forget helper used by every server-side Anthropic
// call site. Never throws — a failed log must not block the
// actual response.
// ─────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

export interface LogTokenUsageArgs {
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
  agencyId?: string | null
  sessionId?: string | null
  metadata?: Record<string, any>
}

export async function logTokenUsage(args: LogTokenUsageArgs): Promise<void> {
  try {
    // Skip empty counts — nothing to report
    if (!args.inputTokens && !args.outputTokens) return

    await fetch(`${APP_URL}/api/token-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log',
        feature: args.feature,
        model: args.model,
        input_tokens: args.inputTokens,
        output_tokens: args.outputTokens,
        agency_id: args.agencyId || null,
        session_id: args.sessionId || null,
        metadata: args.metadata || {},
      }),
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[tokenTracker] failed to log:', e)
  }
}

// Synchronous convenience wrapper — fire and forget so callers
// don't need to await anything.
export function trackTokens(args: LogTokenUsageArgs): void {
  void logTokenUsage(args)
}

// ─────────────────────────────────────────────────────────────
// Platform cost tracker — for flat-rate services (Resend,
// Google Places, Brave Search, HeyGen, etc.) that charge per
// request rather than per token. Writes to koto_platform_costs
// via the log_platform_cost action.
// ─────────────────────────────────────────────────────────────
export interface TrackPlatformCostArgs {
  cost_type: string       // 'resend_email' | 'google_places' | 'brave_search' | 'heygen_api' | ...
  amount: number          // dollars
  unit_count?: number     // default 1
  description?: string
  metadata?: Record<string, any>
}

export async function trackPlatformCost(args: TrackPlatformCostArgs): Promise<void> {
  try {
    if (!args.amount && args.amount !== 0) return
    await fetch(`${APP_URL}/api/token-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_platform_cost',
        cost_type: args.cost_type,
        amount: args.amount,
        unit_count: args.unit_count ?? 1,
        description: args.description || null,
        metadata: args.metadata || {},
      }),
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[trackPlatformCost] failed:', e)
  }
}

// Published per-call rates — source of truth for auto-instrumentation.
export const PLATFORM_RATES = {
  resend_email:  0.001,  // $0.001/email after free tier
  google_places: 0.017,  // $0.017/request
  brave_search:  0.003,  // $0.003/search (Data for AI plan)
  ipinfo:        0.0,    // free tier
}
