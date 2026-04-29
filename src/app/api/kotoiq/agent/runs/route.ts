import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { verifySession } from '@/lib/apiAuth'
import * as ledger from '@/lib/agent/ledger'
import { strategist } from '@/lib/agent/strategist'

export const runtime = 'nodejs'
export const maxDuration = 300

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// POST — start a run for a goal
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

  const { goal_id, trigger } = body
  if (!goal_id) {
    return NextResponse.json({ error: 'goal_id required' }, { status: 400 })
  }

  try {
    const s = sb()
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

    const goal = await ledger.getGoal(s, goal_id)
    if (!goal || goal.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    if (goal.status !== 'active') {
      return NextResponse.json({ error: `Goal is ${goal.status}, not active` }, { status: 400 })
    }

    const outcome = await strategist.runGoal({
      s, ai, goal,
      trigger: trigger || 'manual',
    })

    return NextResponse.json({ success: true, outcome })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — list runs or get single run
export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  const { searchParams } = new URL(req.url)
  const agencyId = session.agencyId || searchParams.get('agency_id')
  if (!agencyId) {
    return NextResponse.json({ error: 'Unauthorized — agency_id required' }, { status: 401 })
  }

  const run_id = searchParams.get('run_id')
  const goal_id = searchParams.get('goal_id')
  const client_id = searchParams.get('client_id')

  try {
    const s = sb()

    if (run_id) {
      const run = await ledger.getRun(s, run_id)
      if (!run || run.agency_id !== agencyId) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }
      const actions = await ledger.listRunActions(s, run_id)
      return NextResponse.json({ run, actions })
    }

    if (!goal_id && !client_id) {
      return NextResponse.json({ error: 'goal_id or client_id required' }, { status: 400 })
    }

    let q = s
      .from('kotoiq_agent_runs')
      .select('id, goal_id, client_id, trigger, status, cost_usd, tokens_used, actions_taken, started_at, completed_at, outcome')
      .eq('agency_id', agencyId)
      .order('started_at', { ascending: false })
      .limit(50)

    if (goal_id) q = q.eq('goal_id', goal_id)
    if (client_id) q = q.eq('client_id', client_id)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ runs: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
