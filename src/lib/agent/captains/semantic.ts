import 'server-only'
import type { Captain, Goal, State, PlannedAction, ActionOutcome } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { invokeTool } from '../tools/invoker'

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Captain — owns topical authority and semantic analysis tools
//
// assess() reads: topical maps, topical nodes (by status), query clusters,
//                 semantic analysis
// execute() dispatches to tool registry via invoker
// plan() deferred to Strategist
// ─────────────────────────────────────────────────────────────────────────────

const OWNED_TOOLS = [
  'generate_topical_map',
  'get_topical_map',
  'analyze_topical_coverage',
  'audit_topical_authority',
  'analyze_query_paths',
  'analyze_semantic_network',
  'update_topical_node',
]

export const semanticCaptain: Captain = {
  name: 'semantic',
  ownedTools: OWNED_TOOLS,

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State> {
    const { client_id } = goal

    // Latest active topical map
    const { data: mapRow } = await s
      .from('kotoiq_topical_maps')
      .select('id, name, central_entity, source_context, topical_coverage_score, vastness_score, depth_score, momentum_score, overall_authority_score, total_nodes, covered_nodes, status')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Node counts by status
    let nodesByStatus: Record<string, number> = {}
    let gapNodes: any[] = []
    if (mapRow?.id) {
      const { data: nodes } = await s
        .from('kotoiq_topical_nodes')
        .select('id, entity, entity_type, section, status, priority, relevance_to_central, suggested_title, suggested_url, search_volume, existing_url')
        .eq('map_id', mapRow.id)
        .order('relevance_to_central', { ascending: false })

      if (nodes) {
        for (const n of nodes) {
          nodesByStatus[n.status] = (nodesByStatus[n.status] || 0) + 1
        }
        gapNodes = nodes.filter(n => n.status === 'gap')
      }
    }

    // Latest query clusters
    const { data: clusters } = await s
      .from('kotoiq_query_clusters')
      .select('cluster_name, cluster_type, coverage_pct, total_queries, gap_queries')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Latest semantic analysis
    const { data: semanticRow } = await s
      .from('kotoiq_semantic_analysis')
      .select('overall_score, contextual_flow_score, contextual_consistency_score, scanned_at')
      .eq('client_id', client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    return {
      goal_type: goal.goal_type,
      client_id,
      data: {
        map: mapRow ?? null,
        nodes_by_status: nodesByStatus,
        gap_nodes: gapNodes,
        gap_count: gapNodes.length,
        total_nodes: mapRow?.total_nodes ?? 0,
        covered_nodes: mapRow?.covered_nodes ?? 0,
        clusters: clusters ?? [],
        semantic_analysis: semanticRow ?? null,
      },
      captured_at: new Date().toISOString(),
    }
  },

  async plan(): Promise<PlannedAction[]> {
    throw new Error('not implemented — handled by Strategist')
  },

  async execute({ s, ai, action, runContext }: {
    s: SupabaseClient
    ai: Anthropic
    action: PlannedAction
    runContext: { run_id: string; goal_id: string }
  }): Promise<ActionOutcome> {
    if (!OWNED_TOOLS.includes(action.tool_name)) {
      throw new Error(`[semanticCaptain] Tool ${action.tool_name} is not owned by semantic captain`)
    }

    const start = Date.now()
    try {
      const result = await invokeTool({
        s,
        ai,
        tool_name: action.tool_name,
        input: action.input,
        runContext: { run_id: runContext.run_id, client_id: '', agency_id: '' },
      })

      return {
        action_id: '',
        status: 'succeeded',
        output: result.output,
        cost_usd: result.cost_usd,
        tokens_used: result.tokens_used,
        duration_ms: result.duration_ms,
      }
    } catch (err: any) {
      return {
        action_id: '',
        status: 'failed',
        output: null,
        cost_usd: 0,
        tokens_used: 0,
        duration_ms: Date.now() - start,
        error: err?.message ?? String(err),
      }
    }
  },
}
