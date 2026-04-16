/**
 * POST /api/answering/post-call  { call_id }
 *   Runs post-call analysis (Claude Haiku) on a call's transcript, extracts
 *   summary + intent + leadInfo, and persists to koto_inbound_calls.
 *
 * Designed to be called from the Retell `call_analyzed` webhook, or manually
 * from the dashboard (e.g. "regenerate summary" button on a Call Log row).
 */
import { NextRequest, NextResponse } from 'next/server'
import { processEndedCall } from '@/lib/answering/postCallProcessor'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { call_id } = body
  if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  const result = await processEndedCall({ callId: call_id })
  const status = result.ok ? 200 : (result.reason === 'call_not_found' ? 404 : 500)
  return NextResponse.json(result, { status })
}
