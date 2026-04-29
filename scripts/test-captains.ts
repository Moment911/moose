import { createClient } from '@supabase/supabase-js'
import { contentCaptain } from '../src/lib/agent/captains/content'
import { semanticCaptain } from '../src/lib/agent/captains/semantic'
import { authorityCaptain } from '../src/lib/agent/captains/authority'
import type { Goal } from '../src/lib/agent/types'

const TEST_CLIENT_ID = 'b83eb71f-ae1e-4b0b-9aca-953e988d0af3'
const TEST_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

const testGoal: Goal = {
  id: 'test-goal-id',
  agency_id: TEST_AGENCY_ID,
  client_id: TEST_CLIENT_ID,
  goal_type: 'close_topical_gap',
  status: 'active',
  trigger: 'manual',
  schedule_cron: null,
  threshold_config: null,
  scope: {},
  budget: { budget_usd: 5, budget_tokens: 200000, budget_actions: 10 },
  requires_approval: true,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  console.log('═══ Content Captain assess() ═══')
  const contentState = await contentCaptain.assess({ s, goal: testGoal })
  const cd = contentState.data as any
  console.log(`  Inventory: ${cd.inventory_count} pages`)
  console.log(`  Calendar: ${cd.calendar_count} items (next 30d)`)
  console.log(`  Pipeline runs: ${cd.pipeline_runs_count}`)
  console.log()

  console.log('═══ Semantic Captain assess() ═══')
  const semanticState = await semanticCaptain.assess({ s, goal: testGoal })
  const sd = semanticState.data as any
  console.log(`  Map: ${sd.map?.name ?? 'none'} (authority: ${sd.map?.overall_authority_score ?? 'n/a'})`)
  console.log(`  Total nodes: ${sd.total_nodes}, covered: ${sd.covered_nodes}`)
  console.log(`  Gap nodes: ${sd.gap_count}`)
  console.log(`  Nodes by status:`, JSON.stringify(sd.nodes_by_status))
  if (sd.gap_nodes.length > 0) {
    console.log(`  Top 3 gaps:`)
    for (const g of sd.gap_nodes.slice(0, 3)) {
      console.log(`    - ${g.entity} (relevance: ${g.relevance_to_central}, priority: ${g.priority})`)
    }
  }
  console.log(`  Query clusters: ${sd.clusters?.length ?? 0}`)
  console.log(`  Semantic analysis: ${sd.semantic_analysis ? `score ${sd.semantic_analysis.overall_score}` : 'none'}`)
  console.log()

  console.log('═══ Authority Captain assess() ═══')
  const authorityState = await authorityCaptain.assess({ s, goal: testGoal })
  const ad = authorityState.data as any
  console.log(`  Brand SERP score: ${ad.brand_serp_score ?? 'none'}`)
  console.log(`  Knowledge panel: ${ad.has_knowledge_panel}`)
  console.log(`  Owned results: ${ad.owned_results}/${ad.total_results}`)
  console.log(`  E-E-A-T score: ${ad.eeat_score ?? 'none'}`)
  console.log(`  Schema coverage: ${ad.schema_coverage_pct ?? 'none'}%`)
  console.log(`  Domain authority: ${ad.domain_authority ?? 'none'}`)
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
