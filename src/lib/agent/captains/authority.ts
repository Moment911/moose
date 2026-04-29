import 'server-only'
import type { Captain, Goal, State, PlannedAction, ActionOutcome } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { invokeTool } from '../tools/invoker'

// ─────────────────────────────────────────────────────────────────────────────
// Authority Captain — owns brand SERP, E-E-A-T, schema, backlinks, KG tools
//
// assess() reads: brand SERP, E-E-A-T audit, schema audit, backlink profile
// execute() dispatches to tool registry via invoker
// plan() deferred to Strategist
// ─────────────────────────────────────────────────────────────────────────────

const OWNED_TOOLS = [
  'brand_serp_scan',
  'get_brand_serp',
  'audit_eeat',
  'audit_schema',
  'generate_schema',
  'knowledge_graph_export',
  'analyze_backlinks',
]

export const authorityCaptain: Captain = {
  name: 'authority',
  ownedTools: OWNED_TOOLS,

  async assess({ s, goal }: { s: SupabaseClient; goal: Goal }): Promise<State> {
    const { client_id } = goal

    // Latest brand SERP
    const { data: brandSerp } = await s
      .from('kotoiq_brand_serp')
      .select('*')
      .eq('client_id', client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    // Latest E-E-A-T audit
    const { data: eeatAudit } = await s
      .from('kotoiq_eeat_audit')
      .select('overall_eeat_score, grade, experience_score, expertise_score, authority_score, trust_score, scanned_at')
      .eq('client_id', client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    // Latest schema audit
    const { data: schemaAudit } = await s
      .from('kotoiq_schema_audit')
      .select('coverage_pct, total_pages_with_schema, total_pages_without, schema_types, eligible_not_implemented, overall_score, scanned_at')
      .eq('client_id', client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    // Latest backlink profile
    const { data: backlinkProfile } = await s
      .from('kotoiq_backlink_profile')
      .select('domain_authority, total_backlinks, total_referring_domains, spam_score, edu_gov_links, trust_rank_estimate, overall_score, scanned_at')
      .eq('client_id', client_id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    return {
      goal_type: goal.goal_type,
      client_id,
      data: {
        brand_serp: brandSerp ?? null,
        brand_serp_score: brandSerp?.brand_serp_score ?? brandSerp?.overall_score ?? null,
        has_knowledge_panel: brandSerp?.has_knowledge_panel ?? false,
        owned_results: brandSerp?.owned_results ?? 0,
        total_results: brandSerp?.total_results ?? 0,
        negative_results: brandSerp?.negative_results ?? [],
        eeat: eeatAudit ?? null,
        eeat_score: eeatAudit?.overall_eeat_score ?? null,
        schema: schemaAudit ?? null,
        schema_coverage_pct: schemaAudit?.coverage_pct ?? null,
        eligible_not_implemented: schemaAudit?.eligible_not_implemented ?? [],
        backlinks: backlinkProfile ?? null,
        domain_authority: backlinkProfile?.domain_authority ?? null,
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
      throw new Error(`[authorityCaptain] Tool ${action.tool_name} is not owned by authority captain`)
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
