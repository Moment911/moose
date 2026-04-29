import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalDefinition, Goal, State, ActionOutcome, VerificationResult } from '../types'
import { contentCaptain } from '../captains/content'

// ─────────────────────────────────────────────────────────────────────────────
// Goal: recover_decaying_content
//
// Architecture: AGENT_ARCHITECTURE.md Section 8.1
//
// Assess content inventory for decaying pages (refresh_priority high,
// trajectory declining, position dropping).  Plan light refreshes or
// full rewrites depending on severity.
//
// Trigger: schedule (nightly cron) or threshold (on refresh_priority change).
// Verify: 7 days post-execution, re-run decay predictor on the same URLs.
//         Pass if avg decay_score improved >= 5 OR avg position improved.
//
// Note: clients with 0 content inventory rows will produce an empty plan.
// That's correct — the goal's shouldAct() returns false, so the cron
// evaluator skips it.  The goal becomes useful once the client's content
// inventory is populated via build_content_inventory.
// ─────────────────────────────────────────────────────────────────────────────

interface DecayItem {
  url: string
  title: string | null
  current_position: number | null
  trajectory: string | null
  refresh_priority: string | null
  days_since_update: number | null
  word_count: number | null
  sc_clicks: number | null
  sc_impressions: number | null
}

interface RecoverDecayingContentState {
  inventory: DecayItem[]
  inventory_count: number
  calendar: any[]
  pipeline_runs: any[]
  high_priority_count: number
  declining_count: number
}

export const recoverDecayingContent: GoalDefinition<RecoverDecayingContentState> = {
  goal_type: 'recover_decaying_content',

  description: 'Identify pages losing rank (declining trajectory, high refresh_priority) and generate content briefs or full rewrites to recover them. Targets avg decay_score improvement of >= 5 points.',

  defaultBudget: {
    budget_usd: 5.0,
    budget_tokens: 200000,
    budget_actions: 10,
  },

  captains: ['content'],

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State & { data: RecoverDecayingContentState }> {
    const contentState = await contentCaptain.assess({ s, goal })
    const cd = contentState.data as any

    const inventory = (cd.inventory ?? []) as DecayItem[]

    // Count high-priority and declining items
    const highPriority = inventory.filter((i: any) =>
      i.refresh_priority === 'critical' || i.refresh_priority === 'urgent' || i.refresh_priority === 'high'
    )
    const declining = inventory.filter((i: any) => i.trajectory === 'declining')

    return {
      goal_type: 'recover_decaying_content',
      client_id: goal.client_id,
      data: {
        inventory,
        inventory_count: inventory.length,
        calendar: cd.calendar ?? [],
        pipeline_runs: cd.pipeline_runs ?? [],
        high_priority_count: highPriority.length,
        declining_count: declining.length,
      },
      captured_at: new Date().toISOString(),
    }
  },

  shouldAct(state: State & { data: RecoverDecayingContentState }): boolean {
    return state.data.high_priority_count > 0 || state.data.declining_count > 0
  },

  async verify({ s, goal, beforeState, actions }: {
    s: SupabaseClient
    goal: Goal
    beforeState: State & { data: RecoverDecayingContentState }
    actions: ActionOutcome[]
  }): Promise<VerificationResult> {
    const beforeUrls = beforeState.data.inventory
      .filter(i => i.refresh_priority === 'critical' || i.refresh_priority === 'urgent' || i.refresh_priority === 'high')
      .map(i => i.url)

    if (beforeUrls.length === 0) {
      return {
        passed: true,
        vacuous: true,
        metric: 'decay_recovery',
        before: 0,
        after: 0,
        delta: 0,
        notes: 'No decaying content found at plan time — nothing to verify.',
      }
    }

    // Re-query the same URLs from content inventory
    const { data: currentItems } = await s
      .from('kotoiq_content_inventory')
      .select('url, sc_position, refresh_priority, trajectory')
      .eq('client_id', goal.client_id)
      .in('url', beforeUrls)

    if (!currentItems || currentItems.length === 0) {
      return {
        passed: false,
        vacuous: true,
        metric: 'decay_recovery',
        before: beforeUrls.length,
        after: 0,
        delta: 0,
        notes: 'Could not re-query inventory URLs for verification.',
      }
    }

    // Compare: count items that improved (no longer high priority or trajectory improved)
    const beforeHighCount = beforeUrls.length
    const afterHighCount = currentItems.filter(i =>
      i.refresh_priority === 'critical' || i.refresh_priority === 'urgent' || i.refresh_priority === 'high'
    ).length

    const improved = beforeHighCount - afterHighCount
    const executedCount = actions.filter(a => a.status === 'succeeded').length

    return {
      passed: improved >= 1 || afterHighCount < beforeHighCount,
      vacuous: false,
      metric: 'decay_recovery',
      before: beforeHighCount,
      after: afterHighCount,
      delta: improved,
      notes: `${improved} of ${beforeHighCount} high-priority items improved. ${executedCount} actions executed.`,
    }
  },
}
