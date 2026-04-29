import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import type {
  Goal, GoalType, GoalTrigger, Plan, PlannedAction, ActionOutcome,
  RunOutcome, VerificationResult, State, Strategist, GoalDefinition, CaptainName, Captain,
} from './types'
import { agentLLM } from './llm'
import { checkAndReserveBudget } from './budget'
import * as ledger from './ledger'
import { getTool, getToolsByCaptain } from './tools/registry'
import { invokeTool } from './tools/invoker'

// Captains
import { contentCaptain } from './captains/content'
import { semanticCaptain } from './captains/semantic'
import { authorityCaptain } from './captains/authority'

// Goals
import { closeTopicalGap } from './goals/closeTopicalGap'
import { defendBrandSerp } from './goals/defendBrandSerp'
import { recoverDecayingContent } from './goals/recoverDecayingContent'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Strategist
//
// Tier 1 orchestrator.  Reads a goal, calls the goal definition's assess(),
// uses LLM to produce a plan (constrained to the goal's captains' tools),
// then executes with approval gates and budget enforcement.
// ─────────────────────────────────────────────────────────────────────────────

// ── Registries ──────────────────────────────────────────────────────────────

export const GOAL_DEFS: Record<GoalType, GoalDefinition<any>> = {
  close_topical_gap: closeTopicalGap,
  defend_brand_serp: defendBrandSerp,
  recover_decaying_content: recoverDecayingContent,
}

const CAPTAINS: Record<CaptainName, Captain> = {
  content: contentCaptain,
  semantic: semanticCaptain,
  authority: authorityCaptain,
}

// ── Planner prompt ──────────────────────────────────────────────────────────

function buildPlannerPrompt(args: {
  goal: Goal
  state: State
  tools: { name: string; description: string; captain: CaptainName; approvalRequired: boolean }[]
}): { system: string; user: string } {
  const { goal, state, tools } = args

  const toolList = tools.map(t =>
    `- ${t.name} (captain: ${t.captain}${t.approvalRequired ? ', REQUIRES APPROVAL' : ''}): ${t.description}`
  ).join('\n')

  const system = `You are the KotoIQ Strategist — a planning agent that produces ordered action plans to achieve SEO goals.

RULES:
1. You may ONLY choose tools from the AVAILABLE TOOLS list below. Do NOT invent tool names.
2. Each action must specify: tool_name, captain, input (valid JSON matching the tool's requirements), and a reason explaining WHY this action helps the goal.
3. Order matters — actions execute sequentially. Put reads/assessments before writes/generations.
4. Respect the budget: max ${goal.budget.budget_actions} actions, $${goal.budget.budget_usd} USD, ${goal.budget.budget_tokens} tokens.
5. Mark approval_required=true for any tool that modifies user-visible data or publishes content.
6. Return ONLY a valid JSON array of PlannedAction objects. No explanations outside the JSON.

AVAILABLE TOOLS:
${toolList}

OUTPUT SCHEMA (strict):
[
  {
    "sequence": 1,
    "captain": "semantic",
    "tool_name": "generate_brief",
    "input": { ... },
    "approval_required": false,
    "reason": "Why this action",
    "est_cost_usd": 0.05,
    "est_tokens": 5000
  }
]`

  const stateJson = JSON.stringify(state.data, null, 2)
  const scopeJson = JSON.stringify(goal.scope)

  const user = `GOAL: ${goal.goal_type}
SCOPE: ${scopeJson}
CLIENT_ID: ${goal.client_id}

CURRENT STATE:
${stateJson.slice(0, 6000)}${stateJson.length > 6000 ? '\n... (truncated)' : ''}

Produce an action plan to achieve this goal. Be specific with tool inputs — include client_id, agency_id="${goal.agency_id}", and any required parameters from the state data.`

  return { system, user }
}

// ── Planner output schema ───────────────────────────────────────────────────

const PlannedActionSchema = z.object({
  sequence: z.number(),
  captain: z.enum(['content', 'semantic', 'authority']),
  tool_name: z.string(),
  input: z.unknown(),
  approval_required: z.boolean(),
  reason: z.string(),
  est_cost_usd: z.number(),
  est_tokens: z.number(),
})

const PlanOutputSchema = z.array(PlannedActionSchema)

// ── Execute a sequence of actions with approval gates ───────────────────────

async function executeActions(args: {
  s: SupabaseClient
  ai: Anthropic
  goal: Goal
  run_id: string
  actions: PlannedAction[]
}): Promise<{ outcomes: ActionOutcome[]; hasApprovalGate: boolean; costAccum: number; tokensAccum: number }> {
  const { s, ai, goal, run_id, actions } = args
  const outcomes: ActionOutcome[] = []
  let hasApprovalGate = false
  let costAccum = 0
  let tokensAccum = 0

  for (const planned of actions) {
    const action_id = await ledger.createAction(s, run_id, goal, planned)

    if (planned.approval_required && goal.requires_approval) {
      hasApprovalGate = true
      outcomes.push({
        action_id,
        status: 'skipped',
        output: null,
        cost_usd: 0,
        tokens_used: 0,
        duration_ms: 0,
        error: 'Awaiting approval',
      })
      continue
    }

    await ledger.updateActionStatus(s, action_id, 'executing')

    try {
      const result = await invokeTool({
        s,
        ai,
        tool_name: planned.tool_name,
        input: planned.input,
        runContext: { run_id, client_id: goal.client_id, agency_id: goal.agency_id },
      })

      const outcome: ActionOutcome = {
        action_id,
        status: 'succeeded',
        output: result.output,
        cost_usd: result.cost_usd,
        tokens_used: result.tokens_used,
        duration_ms: result.duration_ms,
      }

      await ledger.updateActionOutcome(s, action_id, outcome)
      outcomes.push(outcome)
      costAccum += result.cost_usd
      tokensAccum += result.tokens_used
    } catch (err: any) {
      const outcome: ActionOutcome = {
        action_id,
        status: 'failed',
        output: null,
        cost_usd: 0,
        tokens_used: 0,
        duration_ms: 0,
        error: err?.message ?? String(err),
      }
      await ledger.updateActionOutcome(s, action_id, outcome)
      outcomes.push(outcome)
    }
  }

  return { outcomes, hasApprovalGate, costAccum, tokensAccum }
}

// ── Strategist implementation ───────────────────────────────────────────────

export const strategist: Strategist = {

  async previewPlan({ s, ai, goal }: {
    s: SupabaseClient
    ai: Anthropic
    goal: Goal
  }): Promise<Plan> {
    const goalDef = GOAL_DEFS[goal.goal_type]
    if (!goalDef) throw new Error(`[strategist] No goal definition for: ${goal.goal_type}`)

    // Create run row
    const run_id = await ledger.createRun(s, goal, 'manual')

    // Assess current state
    const state = await goalDef.assess({ s, goal })

    // Collect tools from the goal's captains
    const availableTools = goalDef.captains
      .flatMap(c => getToolsByCaptain(c))
      .map(t => ({
        name: t.name,
        description: t.description,
        captain: t.captain,
        approvalRequired: t.approvalRequired,
      }))

    // Build and call planner
    const { system, user } = buildPlannerPrompt({ goal, state, tools: availableTools })
    const llmResult = await agentLLM({
      ai,
      system,
      user,
      schema: PlanOutputSchema,
      temperature: 0.2,
      agencyId: goal.agency_id,
      feature: 'agent_planner',
    })

    let actions = llmResult.result as PlannedAction[]

    // Validate each action against registry
    const validCaptains = new Set(goalDef.captains)
    actions = actions.filter(a => {
      const tool = getTool(a.tool_name)
      if (!tool) {
        console.warn(`[strategist] Dropping hallucinated tool: ${a.tool_name}`)
        return false
      }
      if (!validCaptains.has(tool.captain)) {
        console.warn(`[strategist] Dropping tool ${a.tool_name} — captain ${tool.captain} not in goal's captains`)
        return false
      }
      // Enforce approval from registry (override LLM's opinion)
      a.approval_required = tool.approvalRequired
      return true
    })

    // Re-sequence after filtering
    actions = actions.map((a, i) => ({ ...a, sequence: i + 1 }))

    // Budget trim
    let totalCost = llmResult.cost_usd
    let totalTokens = llmResult.tokens
    const trimmed: PlannedAction[] = []
    for (const a of actions) {
      const check = await checkAndReserveBudget({
        s,
        goal_id: goal.id,
        budget_usd: goal.budget.budget_usd,
        budget_tokens: goal.budget.budget_tokens,
        budget_actions: goal.budget.budget_actions,
        est_cost_usd: totalCost + a.est_cost_usd,
        est_tokens: totalTokens + a.est_tokens,
      })
      if (!check.ok) {
        console.warn(`[strategist] Budget limit reached after ${trimmed.length} actions (${(check as any).reason})`)
        break
      }
      totalCost += a.est_cost_usd
      totalTokens += a.est_tokens
      trimmed.push(a)
    }

    const plan: Plan = {
      goal_id: goal.id,
      run_id,
      actions: trimmed,
      total_est_cost_usd: totalCost,
      total_est_tokens: totalTokens,
      reasoning: `Planned ${trimmed.length} actions for ${goal.goal_type} (${actions.length - trimmed.length} trimmed by budget).`,
    }

    // Persist plan + state snapshot (used by runGoal for verification baseline)
    await ledger.updateRunPlan(s, run_id, plan, state)

    return plan
  },

  async runGoal({ s, ai, goal, trigger }: {
    s: SupabaseClient
    ai: Anthropic
    goal: Goal
    trigger: GoalTrigger
  }): Promise<RunOutcome> {
    const goalDef = GOAL_DEFS[goal.goal_type]
    if (!goalDef) throw new Error(`[strategist] No goal definition for: ${goal.goal_type}`)

    // Plan (assess + LLM planning happens inside previewPlan)
    const plan = await this.previewPlan({ s, ai, goal })
    const { run_id } = plan

    // Retrieve the state_snapshot that previewPlan persisted (verification baseline)
    const runRow = await ledger.getRun(s, run_id)
    const beforeState = runRow?.state_snapshot as (State & { data: any }) | null

    await ledger.updateRunStatus(s, run_id, 'executing')

    // Execute actions
    const { outcomes, hasApprovalGate, costAccum, tokensAccum } = await executeActions({
      s, ai, goal, run_id, actions: plan.actions,
    })

    const totalCost = plan.total_est_cost_usd + costAccum // planner cost + execution cost
    const totalTokens = plan.total_est_tokens + tokensAccum

    // If any actions are awaiting approval, pause the run
    if (hasApprovalGate) {
      await ledger.updateRunStatus(s, run_id, 'awaiting_approval')

      // Still run verification on what executed so far
      let verification: VerificationResult
      if (beforeState && goalDef.verify) {
        try {
          verification = await goalDef.verify({ s, goal, beforeState, actions: outcomes })
        } catch (err: any) {
          verification = {
            passed: false,
            vacuous: true,
            metric: 'verification_error',
            before: 0,
            after: 0,
            delta: 0,
            notes: `Partial verification failed: ${err?.message ?? String(err)}`,
          }
        }
      } else {
        verification = {
          passed: false,
          vacuous: true,
          metric: 'awaiting_approval',
          before: 0,
          after: 0,
          delta: 0,
          notes: 'Run paused — actions awaiting approval. Verification will re-run on resume.',
        }
      }

      // Persist partial outcome (run stays in awaiting_approval status)
      const partialOutcome: RunOutcome = {
        run_id,
        goal_id: goal.id,
        status: 'failed', // Not truly failed — the RunOutcome type lacks 'awaiting_approval'
        actions: outcomes,
        verification,
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
      }

      // Update cost/tokens on the run row but keep status as awaiting_approval
      await s.from('kotoiq_agent_runs').update({
        outcome: partialOutcome,
        cost_usd: totalCost,
        tokens_used: totalTokens,
        actions_taken: outcomes.filter(o => o.status === 'succeeded').length,
      }).eq('id', run_id)

      return partialOutcome
    }

    // Full completion — verify
    await ledger.updateRunStatus(s, run_id, 'verifying')
    let verification: VerificationResult
    if (beforeState && goalDef.verify) {
      try {
        verification = await goalDef.verify({ s, goal, beforeState, actions: outcomes })
      } catch (err: any) {
        verification = {
          passed: false,
          vacuous: true,
          metric: 'verification_error',
          before: 0,
          after: 0,
          delta: 0,
          notes: `Verification failed: ${err?.message ?? String(err)}`,
        }
      }
    } else {
      verification = {
        passed: false,
        vacuous: true,
        metric: 'no_baseline',
        before: 0,
        after: 0,
        delta: 0,
        notes: 'No state baseline available for verification.',
      }
    }

    const anyFailed = outcomes.some(o => o.status === 'failed')
    const runStatus = anyFailed ? 'failed' as const : 'completed' as const

    const runOutcome: RunOutcome = {
      run_id,
      goal_id: goal.id,
      status: runStatus,
      actions: outcomes,
      verification,
      total_cost_usd: totalCost,
      total_tokens: totalTokens,
    }

    await ledger.finalizeRun(s, run_id, runOutcome)
    return runOutcome
  },
}

// ── Resume a paused run after approval ──────────────────────────────────────

export async function resumeRun(args: {
  s: SupabaseClient
  ai: Anthropic
  run_id: string
}): Promise<RunOutcome> {
  const { s, ai, run_id } = args

  // Load the run
  const runRow = await ledger.getRun(s, run_id)
  if (!runRow) throw new Error(`[resumeRun] Run not found: ${run_id}`)
  if (runRow.status !== 'awaiting_approval') {
    throw new Error(`[resumeRun] Run ${run_id} is ${runRow.status}, not awaiting_approval`)
  }

  // Load the goal
  const goal = await ledger.getGoal(s, runRow.goal_id)
  if (!goal) throw new Error(`[resumeRun] Goal not found: ${runRow.goal_id}`)

  const goalDef = GOAL_DEFS[goal.goal_type]
  if (!goalDef) throw new Error(`[resumeRun] No goal definition for: ${goal.goal_type}`)

  // Load existing actions for this run
  const existingActions = await ledger.listRunActions(s, run_id)

  await ledger.updateRunStatus(s, run_id, 'executing')

  const outcomes: ActionOutcome[] = []
  let costAccum = 0
  let tokensAccum = 0
  let hasRemainingGate = false

  for (const action of existingActions) {
    // Already completed — collect its outcome
    if (action.status === 'succeeded' || action.status === 'failed') {
      outcomes.push({
        action_id: action.id,
        status: action.status,
        output: action.output,
        cost_usd: action.cost_usd,
        tokens_used: action.tokens_used,
        duration_ms: action.duration_ms ?? 0,
        error: action.error ?? undefined,
      })
      costAccum += action.cost_usd
      tokensAccum += action.tokens_used
      continue
    }

    // Rejected — skip
    if (action.status === 'rejected') {
      outcomes.push({
        action_id: action.id,
        status: 'skipped',
        output: null,
        cost_usd: 0,
        tokens_used: 0,
        duration_ms: 0,
        error: `Rejected: ${action.rejected_reason ?? 'no reason'}`,
      })
      continue
    }

    // Approved — execute now
    if (action.status === 'approved') {
      await ledger.updateActionStatus(s, action.id, 'executing')

      try {
        const result = await invokeTool({
          s,
          ai,
          tool_name: action.tool_name,
          input: action.input,
          runContext: { run_id, client_id: goal.client_id, agency_id: goal.agency_id },
        })

        const outcome: ActionOutcome = {
          action_id: action.id,
          status: 'succeeded',
          output: result.output,
          cost_usd: result.cost_usd,
          tokens_used: result.tokens_used,
          duration_ms: result.duration_ms,
        }
        await ledger.updateActionOutcome(s, action.id, outcome)
        outcomes.push(outcome)
        costAccum += result.cost_usd
        tokensAccum += result.tokens_used
      } catch (err: any) {
        const outcome: ActionOutcome = {
          action_id: action.id,
          status: 'failed',
          output: null,
          cost_usd: 0,
          tokens_used: 0,
          duration_ms: 0,
          error: err?.message ?? String(err),
        }
        await ledger.updateActionOutcome(s, action.id, outcome)
        outcomes.push(outcome)
      }
      continue
    }

    // Still pending (not yet approved/rejected) — keep waiting
    if (action.status === 'pending' && action.approval_required) {
      hasRemainingGate = true
      outcomes.push({
        action_id: action.id,
        status: 'skipped',
        output: null,
        cost_usd: 0,
        tokens_used: 0,
        duration_ms: 0,
        error: 'Still awaiting approval',
      })
      continue
    }

    // Pending but not approval-gated — execute
    if (action.status === 'pending') {
      await ledger.updateActionStatus(s, action.id, 'executing')

      try {
        const result = await invokeTool({
          s,
          ai,
          tool_name: action.tool_name,
          input: action.input,
          runContext: { run_id, client_id: goal.client_id, agency_id: goal.agency_id },
        })

        const outcome: ActionOutcome = {
          action_id: action.id,
          status: 'succeeded',
          output: result.output,
          cost_usd: result.cost_usd,
          tokens_used: result.tokens_used,
          duration_ms: result.duration_ms,
        }
        await ledger.updateActionOutcome(s, action.id, outcome)
        outcomes.push(outcome)
        costAccum += result.cost_usd
        tokensAccum += result.tokens_used
      } catch (err: any) {
        const outcome: ActionOutcome = {
          action_id: action.id,
          status: 'failed',
          output: null,
          cost_usd: 0,
          tokens_used: 0,
          duration_ms: 0,
          error: err?.message ?? String(err),
        }
        await ledger.updateActionOutcome(s, action.id, outcome)
        outcomes.push(outcome)
      }
    }
  }

  // Still has unapproved actions — stay in awaiting_approval
  if (hasRemainingGate) {
    await ledger.updateRunStatus(s, run_id, 'awaiting_approval')
  }

  // Verify
  const beforeState = runRow.state_snapshot as (State & { data: any }) | null
  let verification: VerificationResult

  if (!hasRemainingGate && beforeState && goalDef.verify) {
    await ledger.updateRunStatus(s, run_id, 'verifying')
    try {
      verification = await goalDef.verify({ s, goal, beforeState, actions: outcomes })
    } catch (err: any) {
      verification = {
        passed: false,
        vacuous: true,
        metric: 'verification_error',
        before: 0,
        after: 0,
        delta: 0,
        notes: `Verification failed: ${err?.message ?? String(err)}`,
      }
    }
  } else {
    verification = {
      passed: false,
      vacuous: true,
      metric: hasRemainingGate ? 'still_awaiting_approval' : 'no_baseline',
      before: 0,
      after: 0,
      delta: 0,
      notes: hasRemainingGate
        ? 'Some actions still awaiting approval.'
        : 'No state baseline available for verification.',
    }
  }

  const anyFailed = outcomes.some(o => o.status === 'failed')
  const runStatus = hasRemainingGate
    ? 'failed' as const // RunOutcome type doesn't have 'awaiting_approval'
    : anyFailed ? 'failed' as const : 'completed' as const

  const totalCost = Number(runRow.cost_usd || 0) + costAccum
  const totalTokens = Number(runRow.tokens_used || 0) + tokensAccum

  const runOutcome: RunOutcome = {
    run_id,
    goal_id: goal.id,
    status: runStatus,
    actions: outcomes,
    verification,
    total_cost_usd: totalCost,
    total_tokens: totalTokens,
  }

  if (!hasRemainingGate) {
    await ledger.finalizeRun(s, run_id, runOutcome)
  } else {
    await s.from('kotoiq_agent_runs').update({
      outcome: runOutcome,
      cost_usd: totalCost,
      tokens_used: totalTokens,
      actions_taken: outcomes.filter(o => o.status === 'succeeded').length,
    }).eq('id', run_id)
  }

  return runOutcome
}
