import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { verifySession } from '@/lib/apiAuth'
import * as ledger from '@/lib/agent/ledger'
import { resumeRun } from '@/lib/agent/strategist'

export const runtime = 'nodejs'
export const maxDuration = 300

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// GET — list pending approvals
export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  const { searchParams } = new URL(req.url)
  const agencyId = session.agencyId || searchParams.get('agency_id')
  if (!agencyId) {
    return NextResponse.json({ error: 'Unauthorized — agency_id required' }, { status: 401 })
  }

  const client_id = searchParams.get('client_id') ?? undefined

  try {
    const s = sb()
    const actions = await ledger.listPendingApprovals(s, {
      agency_id: agencyId,
      client_id,
    })

    const enriched = []
    for (const a of actions) {
      const run = await ledger.getRun(s, a.run_id)
      const goal = await ledger.getGoal(s, a.goal_id)
      enriched.push({
        ...a,
        run_status: run?.status ?? null,
        run_started_at: run?.started_at ?? null,
        goal_type: goal?.goal_type ?? null,
        goal_status: goal?.status ?? null,
      })
    }

    return NextResponse.json({ actions: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — approve or reject an action
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

  const { action_id, decision, edited_input, reason } = body
  if (!action_id || !decision) {
    return NextResponse.json({ error: 'action_id and decision required' }, { status: 400 })
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 })
  }

  try {
    const s = sb()

    const actions = await ledger.listPendingApprovals(s, { agency_id: agencyId })
    const action = actions.find(a => a.id === action_id)
    if (!action) {
      return NextResponse.json({ error: 'Action not found or not pending approval' }, { status: 404 })
    }

    if (decision === 'reject') {
      await ledger.updateActionStatus(s, action_id, 'rejected', {
        rejected_reason: reason || 'Rejected by user',
      })
      return NextResponse.json({ success: true, action_id, status: 'rejected' })
    }

    await ledger.updateActionStatus(s, action_id, 'approved', {
      approved_by: session.userId ?? undefined,
    })

    if (edited_input) {
      await s.from('kotoiq_agent_actions').update({ input: edited_input }).eq('id', action_id)
    }

    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const outcome = await resumeRun({ s, ai, run_id: action.run_id })

    return NextResponse.json({ success: true, action_id, status: 'approved', run_outcome: outcome })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
