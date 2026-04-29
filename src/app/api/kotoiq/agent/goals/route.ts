import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/apiAuth'
import * as ledger from '@/lib/agent/ledger'
import type { CreateGoalInput } from '@/lib/agent/types'

export const runtime = 'nodejs'
export const maxDuration = 30

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// POST — create a goal
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const session = await verifySession(req, body)
  const agencyId = session.agencyId || body.agency_id
  if (!agencyId) {
    return NextResponse.json({ error: 'Unauthorized — agency_id required' }, { status: 401 })
  }

  const { client_id, goal_type, scope, budget_usd, budget_tokens, budget_actions,
    schedule_cron, threshold_config, requires_approval, trigger } = body

  if (!client_id || !goal_type) {
    return NextResponse.json({ error: 'client_id and goal_type required' }, { status: 400 })
  }

  const validGoals = ['recover_decaying_content', 'close_topical_gap', 'defend_brand_serp']
  if (!validGoals.includes(goal_type)) {
    return NextResponse.json({ error: `Invalid goal_type. Must be one of: ${validGoals.join(', ')}` }, { status: 400 })
  }

  try {
    const s = sb()
    const goal = await ledger.createGoal(s, agencyId, client_id, {
      goal_type,
      trigger: trigger || 'manual',
      scope: scope || {},
      budget_usd,
      budget_tokens,
      budget_actions,
      schedule_cron,
      threshold_config,
      requires_approval,
      created_by: session.userId,
    } as CreateGoalInput)

    return NextResponse.json({ success: true, goal })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — list goals
export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  const { searchParams } = new URL(req.url)
  const agencyId = session.agencyId || searchParams.get('agency_id')
  if (!agencyId) {
    return NextResponse.json({ error: 'Unauthorized — agency_id required' }, { status: 401 })
  }

  const client_id = searchParams.get('client_id') ?? undefined
  const status = searchParams.get('status') ?? undefined

  try {
    const s = sb()
    let q = s
      .from('kotoiq_agent_goals')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (client_id) q = q.eq('client_id', client_id)
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ goals: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — update goal status or budget
export async function PATCH(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const session = await verifySession(req, body)
  const agencyId = session.agencyId || body.agency_id
  if (!agencyId) {
    return NextResponse.json({ error: 'Unauthorized — agency_id required' }, { status: 401 })
  }

  const { goal_id, status, budget_usd, budget_tokens, budget_actions, requires_approval } = body
  if (!goal_id) {
    return NextResponse.json({ error: 'goal_id required' }, { status: 400 })
  }

  try {
    const s = sb()
    const goal = await ledger.getGoal(s, goal_id)
    if (!goal || goal.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (budget_usd !== undefined) update.budget_usd = budget_usd
    if (budget_tokens !== undefined) update.budget_tokens = budget_tokens
    if (budget_actions !== undefined) update.budget_actions = budget_actions
    if (requires_approval !== undefined) update.requires_approval = requires_approval

    const { error } = await s
      .from('kotoiq_agent_goals')
      .update(update)
      .eq('id', goal_id)
      .eq('agency_id', agencyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const updated = await ledger.getGoal(s, goal_id)
    return NextResponse.json({ success: true, goal: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
