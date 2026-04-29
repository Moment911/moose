import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { strategist } from '../src/lib/agent/strategist'
import * as ledger from '../src/lib/agent/ledger'
import type { GoalType } from '../src/lib/agent/types'

const TEST_CLIENT_ID = 'b83eb71f-ae1e-4b0b-9aca-953e988d0af3'
const TEST_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

const VALID_GOALS: GoalType[] = ['close_topical_gap', 'defend_brand_serp', 'recover_decaying_content']

async function main() {
  const goalArg = (process.argv[2] || 'close_topical_gap') as GoalType
  if (!VALID_GOALS.includes(goalArg)) {
    console.error(`Invalid goal type: ${goalArg}. Must be one of: ${VALID_GOALS.join(', ')}`)
    process.exit(1)
  }

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ai = new Anthropic()

  console.log(`═══ Creating goal: ${goalArg} ═══`)
  const goal = await ledger.createGoal(s, TEST_AGENCY_ID, TEST_CLIENT_ID, {
    goal_type: goalArg,
    trigger: 'manual',
    scope: {},
    budget_usd: 0.20,
    budget_tokens: 50000,
    budget_actions: 3,
    requires_approval: true,
  })
  console.log(`  Goal ID: ${goal.id}`)
  console.log(`  Budget: $${goal.budget.budget_usd} / ${goal.budget.budget_tokens} tok / ${goal.budget.budget_actions} actions`)
  console.log()

  console.log(`═══ Running strategist.runGoal() ═══`)
  const outcome = await strategist.runGoal({ s, ai, goal, trigger: 'manual' })

  console.log(`\n═══ Run Result ═══`)
  console.log(`  Run ID: ${outcome.run_id}`)
  console.log(`  Status: ${outcome.status}`)
  console.log(`  Total cost: $${outcome.total_cost_usd.toFixed(4)}`)
  console.log(`  Total tokens: ${outcome.total_tokens}`)
  console.log(`  Verification: ${outcome.verification.metric} — ${outcome.verification.notes}`)
  console.log()

  console.log('═══ Action Outcomes ═══')
  for (const a of outcome.actions) {
    console.log(`  Action ${a.action_id}:`)
    console.log(`    Status: ${a.status}`)
    console.log(`    Cost: $${a.cost_usd.toFixed(4)} | Tokens: ${a.tokens_used} | Duration: ${a.duration_ms}ms`)
    if (a.error) console.log(`    Error: ${a.error}`)
    if (a.status === 'succeeded' && a.output) {
      const out = a.output as any
      if (out?.brief?.title_tag) {
        console.log(`    Brief: "${out.brief.title_tag}" — ${out.brief.outline?.length ?? 0} sections, ${out.brief.target_word_count} words`)
      } else {
        console.log(`    Output: ${JSON.stringify(a.output).slice(0, 300)}`)
      }
    }
    console.log()
  }

  console.log('═══ Pending Approvals ═══')
  const pending = await ledger.listPendingApprovals(s, { client_id: TEST_CLIENT_ID })
  const runPending = pending.filter(p => p.run_id === outcome.run_id)
  for (const p of runPending) {
    console.log(`  ${p.id}: [${p.captain}] ${p.tool_name} — ${p.status}`)
  }
  if (runPending.length === 0) console.log('  (none for this run)')
  console.log()

  console.log('═══ DB Run Row ═══')
  const runRow = await ledger.getRun(s, outcome.run_id)
  console.log(`  status: ${runRow?.status}`)
  console.log(`  cost_usd: ${runRow?.cost_usd}`)
  console.log(`  actions_taken: ${runRow?.actions_taken}`)
  console.log()

  await ledger.updateGoalStatus(s, goal.id, 'cancelled')
  console.log(`Goal cancelled. Run ID: ${outcome.run_id}`)
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
