import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Canonical Types
//
// All types from AGENT_ARCHITECTURE.md Section 7.  This file is the single
// source of truth for the agent layer's type surface.  Everything else imports
// from here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Goal ────────────────────────────────────────────────────────────────────

export type GoalType =
  | 'recover_decaying_content'
  | 'close_topical_gap'
  | 'defend_brand_serp'

export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type GoalTrigger = 'manual' | 'schedule' | 'threshold' | 'bot'

export type CaptainName = 'content' | 'semantic' | 'authority'

export interface GoalScope {
  urls?: string[]
  topics?: string[]
  cluster_ids?: string[]
}

export interface Budget {
  budget_usd: number
  budget_tokens: number
  budget_actions: number
}

export interface Goal {
  id: string
  agency_id: string
  client_id: string
  goal_type: GoalType
  status: GoalStatus
  trigger: GoalTrigger
  schedule_cron: string | null
  threshold_config: Record<string, unknown> | null
  scope: GoalScope
  budget: Budget
  requires_approval: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── State ───────────────────────────────────────────────────────────────────

export interface State {
  goal_type: GoalType
  client_id: string
  data: unknown
  captured_at: string
}

// ── Plan ────────────────────────────────────────────────────────────────────

export interface PlannedAction {
  sequence: number
  captain: CaptainName
  tool_name: string
  input: unknown
  approval_required: boolean
  reason: string
  est_cost_usd: number
  est_tokens: number
}

export interface Plan {
  goal_id: string
  run_id: string
  actions: PlannedAction[]
  total_est_cost_usd: number
  total_est_tokens: number
  reasoning: string
}

// ── Action Outcome ──────────────────────────────────────────────────────────

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'skipped'

export interface ActionOutcome {
  action_id: string
  status: 'succeeded' | 'failed' | 'skipped'
  output: unknown
  result_ref?: { table: string; id: string }
  cost_usd: number
  tokens_used: number
  duration_ms: number
  error?: string
}

// ── Run ─────────────────────────────────────────────────────────────────────

export type RunStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface VerificationResult {
  passed: boolean
  /** True when passed=true is trivial (no work to verify), as opposed to
   *  substantive (agent did work and it succeeded).  Required before any
   *  goal becomes the basis of an SLA or paid feature — KOTO-AGENT-A13. */
  vacuous: boolean
  metric: string
  before: number
  after: number
  delta: number
  notes: string
}

export interface RunOutcome {
  run_id: string
  goal_id: string
  status: 'completed' | 'failed' | 'cancelled'
  actions: ActionOutcome[]
  verification: VerificationResult
  total_cost_usd: number
  total_tokens: number
}

// ── Action (DB row shape) ───────────────────────────────────────────────────

export interface AgentAction {
  id: string
  run_id: string
  goal_id: string
  agency_id: string
  client_id: string
  sequence: number
  captain: CaptainName
  tool_name: string
  input: unknown
  output: unknown | null
  status: ActionStatus
  approval_required: boolean
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  result_ref_table: string | null
  result_ref_id: string | null
  cost_usd: number
  tokens_used: number
  duration_ms: number | null
  error: string | null
  created_at: string
  completed_at: string | null
}

// ── Captain interface ───────────────────────────────────────────────────────

export interface Captain {
  name: CaptainName
  ownedTools: string[]

  /** Read current state relevant to a goal. No side effects. */
  assess(args: {
    s: SupabaseClient
    goal: Goal
  }): Promise<State>

  /** Produce a plan. No side effects. LLM call OK. */
  plan(args: {
    s: SupabaseClient
    goal: Goal
    state: State
  }): Promise<PlannedAction[]>

  /** Execute one planned action. Side effects allowed. */
  execute(args: {
    s: SupabaseClient
    ai: Anthropic
    action: PlannedAction
    runContext: { run_id: string; goal_id: string }
  }): Promise<ActionOutcome>
}

// ── Strategist interface ────────────────────────────────────────────────────

export interface Strategist {
  /** End-to-end: assess → plan → (approve?) → execute → verify → record. */
  runGoal(args: {
    s: SupabaseClient
    ai: Anthropic
    goal: Goal
    trigger: GoalTrigger
  }): Promise<RunOutcome>

  /** Just plan. Used for "preview before executing" flows. */
  previewPlan(args: {
    s: SupabaseClient
    ai: Anthropic
    goal: Goal
  }): Promise<Plan>
}

// ── Goal definition ─────────────────────────────────────────────────────────

export interface GoalDefinition<TStateData = unknown> {
  goal_type: GoalType
  description: string
  defaultBudget: Budget
  captains: CaptainName[]

  assess(args: { s: SupabaseClient; goal: Goal }): Promise<State & { data: TStateData }>
  shouldAct(state: State & { data: TStateData }): boolean
  verify(args: {
    s: SupabaseClient
    goal: Goal
    beforeState: State & { data: TStateData }
    actions: ActionOutcome[]
  }): Promise<VerificationResult>
}

// ── Tool registry entry ─────────────────────────────────────────────────────

export interface ToolEntry<TInput = unknown, TOutput = unknown> {
  name: string
  captain: CaptainName
  description: string
  inputSchema: import('zod').ZodType<TInput>
  outputSchema: import('zod').ZodType<TOutput>
  invoke: (args: {
    s: SupabaseClient
    ai: Anthropic
    input: TInput
    runContext: { run_id: string; client_id: string; agency_id: string }
  }) => Promise<TOutput>
  estCostUsd: (input: TInput) => number
  estTokens: (input: TInput) => number
  approvalRequired: boolean
  externalApis: string[]
  writesToTables: string[]
}

// ── Ledger input types (for creating rows) ──────────────────────────────────

export interface CreateGoalInput {
  goal_type: GoalType
  trigger: GoalTrigger
  schedule_cron?: string | null
  threshold_config?: Record<string, unknown> | null
  scope?: GoalScope
  budget_usd?: number
  budget_tokens?: number
  budget_actions?: number
  requires_approval?: boolean
  created_by?: string | null
}
