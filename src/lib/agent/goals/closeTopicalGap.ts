import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalDefinition, Goal, State, ActionOutcome, VerificationResult } from '../types'
import { semanticCaptain } from '../captains/semantic'

// ─────────────────────────────────────────────────────────────────────────────
// Goal: close_topical_gap
//
// Architecture: AGENT_ARCHITECTURE.md Section 8.2
//
// DECISION (2026-04-29): Gap detection uses `existing_url IS NULL` rather than
// `status = 'gap'` from the original spec.  Reason:
//   1. Real data uses status='partial' for unfilled nodes, not 'gap'.
//   2. `existing_url IS NULL` captures the actual semantic question (does
//      content exist for this node?) regardless of status label.
//   3. Verification is clean: a node "fills" when existing_url flips from
//      null to populated.
// This pattern is future-proof against status-label drift.
// ─────────────────────────────────────────────────────────────────────────────

interface GapNode {
  id: string
  entity: string
  entity_type: string | null
  section: string
  status: string
  priority: string
  relevance_to_central: number | null
  suggested_title: string | null
  suggested_url: string | null
  search_volume: number | null
  existing_url: string | null
}

interface CloseTopicalGapState {
  map: any | null
  gap_nodes: GapNode[]
  gap_count: number
  total_nodes: number
  covered_count: number
  semantic_state: any
}

export const closeTopicalGap: GoalDefinition<CloseTopicalGapState> = {
  goal_type: 'close_topical_gap',

  description: 'Find topical map nodes without existing content (existing_url IS NULL) and generate briefs + content to fill them. Prioritizes by relevance_to_central DESC.',

  defaultBudget: {
    budget_usd: 5.0,
    budget_tokens: 200000,
    budget_actions: 10,
  },

  captains: ['semantic', 'content'],

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State & { data: CloseTopicalGapState }> {
    const { client_id } = goal

    // Get the base semantic state (map, clusters, etc.)
    const semanticState = await semanticCaptain.assess({ s, goal })

    // Get latest topical map
    const { data: mapRow } = await s
      .from('kotoiq_topical_maps')
      .select('id, name, central_entity, total_nodes, covered_nodes, overall_authority_score')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Query gap nodes: existing_url IS NULL (the real gap signal)
    let gapNodes: GapNode[] = []
    let totalNodes = 0
    let coveredCount = 0
    if (mapRow?.id) {
      const { data: allNodes } = await s
        .from('kotoiq_topical_nodes')
        .select('id, entity, entity_type, section, status, priority, relevance_to_central, suggested_title, suggested_url, search_volume, existing_url')
        .eq('map_id', mapRow.id)

      if (allNodes) {
        totalNodes = allNodes.length
        coveredCount = allNodes.filter(n => n.existing_url != null).length
        gapNodes = allNodes
          .filter(n => n.existing_url == null)
          .sort((a, b) => {
            // Sort by relevance_to_central DESC, then priority
            const relA = a.relevance_to_central ?? 0
            const relB = b.relevance_to_central ?? 0
            if (relB !== relA) return relB - relA
            const priOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
            return (priOrder[a.priority] ?? 2) - (priOrder[b.priority] ?? 2)
          })
      }
    }

    return {
      goal_type: 'close_topical_gap',
      client_id,
      data: {
        map: mapRow ?? null,
        gap_nodes: gapNodes,
        gap_count: gapNodes.length,
        total_nodes: totalNodes,
        covered_count: coveredCount,
        semantic_state: semanticState.data,
      },
      captured_at: new Date().toISOString(),
    }
  },

  shouldAct(state: State & { data: CloseTopicalGapState }): boolean {
    return state.data.gap_count > 0
  },

  async verify({ s, goal, beforeState, actions }: {
    s: SupabaseClient
    goal: Goal
    beforeState: State & { data: CloseTopicalGapState }
    actions: ActionOutcome[]
  }): Promise<VerificationResult> {
    const { client_id } = goal
    const beforeGapIds = beforeState.data.gap_nodes.map(n => n.id)
    const attemptedCount = actions.filter(a => a.status === 'succeeded').length

    if (beforeGapIds.length === 0) {
      return {
        passed: true,
        vacuous: true,
        metric: 'gap_nodes_filled',
        before: 0,
        after: 0,
        delta: 0,
        notes: 'No gap nodes existed at plan time — nothing to verify.',
      }
    }

    // Re-query the same nodes to see which now have existing_url populated
    const { data: currentNodes } = await s
      .from('kotoiq_topical_nodes')
      .select('id, existing_url')
      .in('id', beforeGapIds)

    const filledCount = (currentNodes ?? []).filter(n => n.existing_url != null).length
    const beforeGapCount = beforeGapIds.length
    const fillRate = attemptedCount > 0 ? filledCount / attemptedCount : 0

    return {
      passed: fillRate >= 0.5,
      vacuous: false,
      metric: 'gap_nodes_filled',
      before: beforeGapCount,
      after: beforeGapCount - filledCount,
      delta: filledCount,
      notes: `${filledCount} of ${attemptedCount} attempted nodes now have content (${Math.round(fillRate * 100)}% fill rate). Threshold: 50%.`,
    }
  },
}
