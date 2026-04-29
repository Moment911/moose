import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { strategist, GOAL_DEFS } from '@/lib/agent/strategist'
import type { Goal } from '@/lib/agent/types'

// Cron auth + config pattern matches src/app/api/cron/competitor-watch/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

function goalFromRow(row: any): Goal {
  return {
    id: row.id,
    agency_id: row.agency_id,
    client_id: row.client_id,
    goal_type: row.goal_type,
    status: row.status,
    trigger: row.trigger,
    schedule_cron: row.schedule_cron ?? null,
    threshold_config: row.threshold_config ?? null,
    scope: row.scope ?? {},
    budget: {
      budget_usd: Number(row.budget_usd),
      budget_tokens: row.budget_tokens,
      budget_actions: row.budget_actions,
    },
    requires_approval: row.requires_approval,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Simple cron schedule check — matches if the current hour equals the
 * hour in a "0 H * * *" style schedule.  Does not support minute-level,
 * day-of-week, or complex cron expressions.  Returns true if the
 * schedule_cron field is null (always match — let the goal definition
 * decide via shouldAct).
 */
function cronMatchesNow(scheduleCron: string | null): boolean {
  if (!scheduleCron) return true
  const parts = scheduleCron.trim().split(/\s+/)
  if (parts.length < 2) return true
  const cronHour = parseInt(parts[1], 10)
  if (isNaN(cronHour)) return true
  const nowHour = new Date().getUTCHours()
  return cronHour === nowHour
}

export async function GET(req: NextRequest) {
  // Auth — same pattern as /api/cron/competitor-watch
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s = sb()
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

  // Load all active goals that can be cron-triggered
  const { data: goalRows, error } = await s
    .from('kotoiq_agent_goals')
    .select('*')
    .eq('status', 'active')
    .in('trigger', ['schedule', 'threshold'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const goals = (goalRows ?? []).map(goalFromRow)
  const summary = { goals_checked: goals.length, runs_triggered: 0, errors: [] as string[] }

  // Process sequentially — one failure must not block others
  for (const goal of goals) {
    try {
      const goalDef = GOAL_DEFS[goal.goal_type]
      if (!goalDef) {
        summary.errors.push(`${goal.id}: no goal definition for ${goal.goal_type}`)
        continue
      }

      let shouldRun = false

      if (goal.trigger === 'schedule') {
        shouldRun = cronMatchesNow(goal.schedule_cron)
      } else if (goal.trigger === 'threshold') {
        const state = await goalDef.assess({ s, goal })
        shouldRun = goalDef.shouldAct(state)
      }

      if (!shouldRun) continue

      await strategist.runGoal({ s, ai, goal, trigger: goal.trigger })
      summary.runs_triggered++
    } catch (e: any) {
      summary.errors.push(`${goal.id}: ${e.message}`)
    }
  }

  return NextResponse.json(summary)
}
