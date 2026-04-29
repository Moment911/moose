import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Goal,
  GoalStatus,
  GoalScope,
  Budget,
  Plan,
  PlannedAction,
  RunStatus,
  RunOutcome,
  ActionOutcome,
  AgentAction,
  CreateGoalInput,
  GoalTrigger,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Ledger
//
// Read/write helpers for the three agent tables.  All functions accept a
// SupabaseClient (service-role) as the first arg and add explicit
// .eq('agency_id', ...) scoping on every query — matching the pattern
// used by pipelineOrchestrator.ts for kotoiq_pipeline_runs.
//
// These tables are NOT in DIRECT_AGENCY_TABLES (that would require editing
// kotoiqDb.ts, which is outside the agent layer), so we scope manually.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────────────────────

function goalFromRow(row: any): Goal {
  return {
    id: row.id,
    agency_id: row.agency_id,
    client_id: row.client_id,
    goal_type: row.goal_type,
    status: row.status,
    trigger: row.trigger,
    schedule_cron: row.schedule_cron ?? null,
    threshold_config: row.threshold_config ?? null,
    scope: (row.scope ?? {}) as GoalScope,
    budget: {
      budget_usd: Number(row.budget_usd),
      budget_tokens: row.budget_tokens,
      budget_actions: row.budget_actions,
    },
    requires_approval: row.requires_approval,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function actionFromRow(row: any): AgentAction {
  return {
    id: row.id,
    run_id: row.run_id,
    goal_id: row.goal_id,
    agency_id: row.agency_id,
    client_id: row.client_id,
    sequence: row.sequence,
    captain: row.captain,
    tool_name: row.tool_name,
    input: row.input,
    output: row.output ?? null,
    status: row.status,
    approval_required: row.approval_required,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    rejected_reason: row.rejected_reason ?? null,
    result_ref_table: row.result_ref_table ?? null,
    result_ref_id: row.result_ref_id ?? null,
    cost_usd: Number(row.cost_usd),
    tokens_used: row.tokens_used,
    duration_ms: row.duration_ms ?? null,
    error: row.error ?? null,
    created_at: row.created_at,
    completed_at: row.completed_at ?? null,
  }
}

// ── Goals ───────────────────────────────────────────────────────────────────

export async function createGoal(
  s: SupabaseClient,
  agency_id: string,
  client_id: string,
  input: CreateGoalInput,
): Promise<Goal> {
  const row = {
    agency_id,
    client_id,
    goal_type: input.goal_type,
    trigger: input.trigger,
    schedule_cron: input.schedule_cron ?? null,
    threshold_config: input.threshold_config ?? null,
    scope: input.scope ?? {},
    budget_usd: input.budget_usd ?? 5.0,
    budget_tokens: input.budget_tokens ?? 200000,
    budget_actions: input.budget_actions ?? 10,
    requires_approval: input.requires_approval ?? true,
    created_by: input.created_by ?? null,
  }

  const { data, error } = await s
    .from('kotoiq_agent_goals')
    .insert(row)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`[ledger] createGoal failed: ${error?.message ?? 'no data'}`)
  }

  return goalFromRow(data)
}

export async function getGoal(
  s: SupabaseClient,
  goal_id: string,
): Promise<Goal | null> {
  const { data, error } = await s
    .from('kotoiq_agent_goals')
    .select('*')
    .eq('id', goal_id)
    .single()

  if (error || !data) return null
  return goalFromRow(data)
}

export async function listActiveGoals(
  s: SupabaseClient,
  filters?: { client_id?: string; agency_id?: string },
): Promise<Goal[]> {
  let q = s
    .from('kotoiq_agent_goals')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (filters?.client_id) q = q.eq('client_id', filters.client_id)
  if (filters?.agency_id) q = q.eq('agency_id', filters.agency_id)

  const { data, error } = await q
  if (error || !data) return []
  return data.map(goalFromRow)
}

export async function updateGoalStatus(
  s: SupabaseClient,
  goal_id: string,
  status: GoalStatus,
): Promise<void> {
  const { error } = await s
    .from('kotoiq_agent_goals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', goal_id)

  if (error) {
    throw new Error(`[ledger] updateGoalStatus failed: ${error.message}`)
  }
}

// ── Runs ────────────────────────────────────────────────────────────────────

export async function createRun(
  s: SupabaseClient,
  goal: Goal,
  trigger: GoalTrigger,
): Promise<string> {
  const { data, error } = await s
    .from('kotoiq_agent_runs')
    .insert({
      goal_id: goal.id,
      agency_id: goal.agency_id,
      client_id: goal.client_id,
      trigger,
      status: 'planning',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[ledger] createRun failed: ${error?.message ?? 'no data'}`)
  }

  return data.id
}

export async function updateRunPlan(
  s: SupabaseClient,
  run_id: string,
  plan: Plan,
  stateSnapshot: unknown,
): Promise<void> {
  const { error } = await s
    .from('kotoiq_agent_runs')
    .update({
      plan,
      state_snapshot: stateSnapshot,
      status: 'executing' as RunStatus,
    })
    .eq('id', run_id)

  if (error) {
    throw new Error(`[ledger] updateRunPlan failed: ${error.message}`)
  }
}

export async function updateRunStatus(
  s: SupabaseClient,
  run_id: string,
  status: RunStatus,
  error_msg?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (error_msg) update.error = error_msg
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    update.completed_at = new Date().toISOString()
  }

  const { error } = await s
    .from('kotoiq_agent_runs')
    .update(update)
    .eq('id', run_id)

  if (error) {
    throw new Error(`[ledger] updateRunStatus failed: ${error.message}`)
  }
}

export async function finalizeRun(
  s: SupabaseClient,
  run_id: string,
  outcome: RunOutcome,
): Promise<void> {
  const { error } = await s
    .from('kotoiq_agent_runs')
    .update({
      status: outcome.status,
      outcome,
      cost_usd: outcome.total_cost_usd,
      tokens_used: outcome.total_tokens,
      actions_taken: outcome.actions.length,
      completed_at: new Date().toISOString(),
    })
    .eq('id', run_id)

  if (error) {
    throw new Error(`[ledger] finalizeRun failed: ${error.message}`)
  }
}

export async function getRun(
  s: SupabaseClient,
  run_id: string,
): Promise<any | null> {
  const { data, error } = await s
    .from('kotoiq_agent_runs')
    .select('*')
    .eq('id', run_id)
    .single()

  if (error || !data) return null
  return data
}

// ── Actions ─────────────────────────────────────────────────────────────────

export async function createAction(
  s: SupabaseClient,
  run_id: string,
  goal: Goal,
  planned: PlannedAction,
): Promise<string> {
  const { data, error } = await s
    .from('kotoiq_agent_actions')
    .insert({
      run_id,
      goal_id: goal.id,
      agency_id: goal.agency_id,
      client_id: goal.client_id,
      sequence: planned.sequence,
      captain: planned.captain,
      tool_name: planned.tool_name,
      input: planned.input,
      status: planned.approval_required ? 'pending' : 'pending',
      approval_required: planned.approval_required,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[ledger] createAction failed: ${error?.message ?? 'no data'}`)
  }

  return data.id
}

export async function updateActionOutcome(
  s: SupabaseClient,
  action_id: string,
  outcome: ActionOutcome,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: outcome.status,
    output: outcome.output,
    cost_usd: outcome.cost_usd,
    tokens_used: outcome.tokens_used,
    duration_ms: outcome.duration_ms,
    completed_at: new Date().toISOString(),
  }
  if (outcome.error) update.error = outcome.error
  if (outcome.result_ref) {
    update.result_ref_table = outcome.result_ref.table
    update.result_ref_id = outcome.result_ref.id
  }

  const { error } = await s
    .from('kotoiq_agent_actions')
    .update(update)
    .eq('id', action_id)

  if (error) {
    throw new Error(`[ledger] updateActionOutcome failed: ${error.message}`)
  }
}

export async function updateActionStatus(
  s: SupabaseClient,
  action_id: string,
  status: string,
  extra?: { approved_by?: string; rejected_reason?: string },
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (status === 'approved') {
    update.approved_at = new Date().toISOString()
    if (extra?.approved_by) update.approved_by = extra.approved_by
  }
  if (status === 'rejected' && extra?.rejected_reason) {
    update.rejected_reason = extra.rejected_reason
  }

  const { error } = await s
    .from('kotoiq_agent_actions')
    .update(update)
    .eq('id', action_id)

  if (error) {
    throw new Error(`[ledger] updateActionStatus failed: ${error.message}`)
  }
}

export async function listPendingApprovals(
  s: SupabaseClient,
  filters?: { client_id?: string; agency_id?: string },
): Promise<AgentAction[]> {
  let q = s
    .from('kotoiq_agent_actions')
    .select('*')
    .eq('status', 'pending')
    .eq('approval_required', true)
    .order('created_at', { ascending: true })

  if (filters?.client_id) q = q.eq('client_id', filters.client_id)
  if (filters?.agency_id) q = q.eq('agency_id', filters.agency_id)

  const { data, error } = await q
  if (error || !data) return []
  return data.map(actionFromRow)
}

export async function listRunActions(
  s: SupabaseClient,
  run_id: string,
): Promise<AgentAction[]> {
  const { data, error } = await s
    .from('kotoiq_agent_actions')
    .select('*')
    .eq('run_id', run_id)
    .order('sequence', { ascending: true })

  if (error || !data) return []
  return data.map(actionFromRow)
}
