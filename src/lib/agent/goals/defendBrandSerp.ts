import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalDefinition, Goal, State, ActionOutcome, VerificationResult } from '../types'
import { authorityCaptain } from '../captains/authority'

// ─────────────────────────────────────────────────────────────────────────────
// Goal: defend_brand_serp
//
// Architecture: AGENT_ARCHITECTURE.md Section 8.3
//
// Assess the brand SERP state (score, knowledge panel, owned results,
// negative results, E-E-A-T, schema coverage, backlinks) and plan
// defensive actions: schema generation, knowledge graph export, E-E-A-T
// audit, backlink acquisition.
//
// Trigger: manual or threshold (on brand_serp_score decline).
// Verify: 7 days post-execution, re-run brand_serp_scan. Pass if
//         brand_serp_score improved >= 3 points.
// ─────────────────────────────────────────────────────────────────────────────

interface DefendBrandSerpState {
  brand_serp: any | null
  brand_serp_score: number | null
  has_knowledge_panel: boolean
  owned_results: number
  total_results: number
  negative_results: any[]
  eeat: any | null
  eeat_score: number | null
  schema: any | null
  schema_coverage_pct: number | null
  eligible_not_implemented: any[]
  backlinks: any | null
  domain_authority: number | null
}

export const defendBrandSerp: GoalDefinition<DefendBrandSerpState> = {
  goal_type: 'defend_brand_serp',

  description: 'Defend and improve the brand SERP: address missing knowledge panel, schema gaps, E-E-A-T deficits, and negative results. Targets brand_serp_score improvement of >= 3 points.',

  defaultBudget: {
    budget_usd: 5.0,
    budget_tokens: 200000,
    budget_actions: 10,
  },

  captains: ['authority'],

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State & { data: DefendBrandSerpState }> {
    const authorityState = await authorityCaptain.assess({ s, goal })
    const ad = authorityState.data as any

    return {
      goal_type: 'defend_brand_serp',
      client_id: goal.client_id,
      data: {
        brand_serp: ad.brand_serp,
        brand_serp_score: ad.brand_serp_score,
        has_knowledge_panel: ad.has_knowledge_panel,
        owned_results: ad.owned_results,
        total_results: ad.total_results,
        negative_results: ad.negative_results ?? [],
        eeat: ad.eeat,
        eeat_score: ad.eeat_score,
        schema: ad.schema,
        schema_coverage_pct: ad.schema_coverage_pct,
        eligible_not_implemented: ad.eligible_not_implemented ?? [],
        backlinks: ad.backlinks,
        domain_authority: ad.domain_authority,
      },
      captured_at: new Date().toISOString(),
    }
  },

  shouldAct(state: State & { data: DefendBrandSerpState }): boolean {
    const d = state.data
    if (d.brand_serp_score !== null && d.brand_serp_score < 70) return true
    if (d.negative_results.length > 0) return true
    if (!d.has_knowledge_panel) return true
    return false
  },

  async verify({ s, goal, beforeState, actions }: {
    s: SupabaseClient
    goal: Goal
    beforeState: State & { data: DefendBrandSerpState }
    actions: ActionOutcome[]
  }): Promise<VerificationResult> {
    const beforeScore = beforeState.data.brand_serp_score ?? 0

    // Re-query latest brand SERP
    const { data: currentSerp } = await s
      .from('kotoiq_brand_serp')
      .select('brand_serp_score, overall_score')
      .eq('client_id', goal.client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    const afterScore = currentSerp?.brand_serp_score ?? currentSerp?.overall_score ?? 0
    const delta = afterScore - beforeScore
    const executedCount = actions.filter(a => a.status === 'succeeded').length

    return {
      passed: delta >= 3,
      vacuous: executedCount === 0,
      metric: 'brand_serp_score',
      before: beforeScore,
      after: afterScore,
      delta,
      notes: `Brand SERP score ${beforeScore} → ${afterScore} (delta: ${delta >= 0 ? '+' : ''}${delta}). ${executedCount} actions executed. Threshold: +3 points.`,
    }
  },
}
