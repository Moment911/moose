import 'server-only'
import type { Captain, Goal, State, PlannedAction, ActionOutcome } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { invokeTool } from '../tools/invoker'
import { updateActionOutcome } from '../ledger'

// ─────────────────────────────────────────────────────────────────────────────
// Content Captain — owns content lifecycle tools
//
// assess() reads: content inventory, content calendar, pipeline runs
// execute() dispatches to tool registry via invoker
// plan() deferred to Strategist
// ─────────────────────────────────────────────────────────────────────────────

const OWNED_TOOLS = [
  'predict_content_decay',
  'get_content_inventory',
  'build_content_inventory',
  'analyze_on_page',
  'get_refresh_plan',
  'generate_brief',
  'run_autonomous_pipeline',
  'get_pipeline_run',
]

export const contentCaptain: Captain = {
  name: 'content',
  ownedTools: OWNED_TOOLS,

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State> {
    const { client_id } = goal

    // Content inventory — top 50 by refresh_priority
    const { data: inventory } = await s
      .from('kotoiq_content_inventory')
      .select('url, title, word_count, freshness_status, trajectory, refresh_priority, sc_position, sc_clicks, sc_impressions, days_since_update, thin_content')
      .eq('client_id', client_id)
      .order('refresh_priority', { ascending: false })
      .limit(50)

    // Content calendar — next 30 days planned
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: calendar } = await s
      .from('kotoiq_content_calendar')
      .select('title, target_keyword, content_type, status, planned_date, published_url')
      .eq('client_id', client_id)
      .gte('planned_date', now.toISOString().slice(0, 10))
      .lte('planned_date', thirtyDays)
      .order('planned_date', { ascending: true })

    // Pipeline runs — last 10
    const { data: pipelineRuns } = await s
      .from('kotoiq_pipeline_runs')
      .select('id, keyword, status, human_score, created_at, completed_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      goal_type: goal.goal_type,
      client_id,
      data: {
        inventory: inventory ?? [],
        inventory_count: inventory?.length ?? 0,
        calendar: calendar ?? [],
        calendar_count: calendar?.length ?? 0,
        pipeline_runs: pipelineRuns ?? [],
        pipeline_runs_count: pipelineRuns?.length ?? 0,
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
      throw new Error(`[contentCaptain] Tool ${action.tool_name} is not owned by content captain`)
    }

    const start = Date.now()
    try {
      const result = await invokeTool({
        s,
        ai,
        tool_name: action.tool_name,
        input: action.input,
        runContext: { run_id: runContext.run_id, client_id: '', agency_id: '' }, // filled by invoker from input
      })

      return {
        action_id: '', // filled by caller after createAction
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
