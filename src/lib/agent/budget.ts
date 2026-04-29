import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Budget Enforcement
//
// Reads the goal's budget and sums actual spend from completed/in-progress
// runs for that goal.  Returns whether the next action fits within budget.
//
// Pattern follows src/lib/ads/llmRouter.ts enforceBudget().
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetCheckResult =
  | { ok: true }
  | { ok: false; reason: 'cost' | 'tokens' | 'actions' }

export async function checkAndReserveBudget(args: {
  s: SupabaseClient
  goal_id: string
  budget_usd: number
  budget_tokens: number
  budget_actions: number
  est_cost_usd: number
  est_tokens: number
}): Promise<BudgetCheckResult> {
  const { s, goal_id, budget_usd, budget_tokens, budget_actions, est_cost_usd, est_tokens } = args

  // Sum actual spend across all runs for this goal
  const { data: runs } = await s
    .from('kotoiq_agent_runs')
    .select('cost_usd, tokens_used, actions_taken')
    .eq('goal_id', goal_id)

  let totalCost = 0
  let totalTokens = 0
  let totalActions = 0
  for (const r of runs ?? []) {
    totalCost += Number(r.cost_usd || 0)
    totalTokens += Number(r.tokens_used || 0)
    totalActions += Number(r.actions_taken || 0)
  }

  if (totalCost + est_cost_usd > budget_usd) return { ok: false, reason: 'cost' }
  if (totalTokens + est_tokens > budget_tokens) return { ok: false, reason: 'tokens' }
  if (totalActions + 1 > budget_actions) return { ok: false, reason: 'actions' }

  return { ok: true }
}
