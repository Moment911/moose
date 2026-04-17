import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../lib/apiAuth'
import { runFullPipeline, getRun, cancelRun, listRuns } from '../../../../lib/builder/pipelineOrchestrator'
import type { PipelineConfig } from '../../../../lib/builder/pipelineOrchestrator'

export async function POST(req: NextRequest) {
  const session = await verifySession(req)
  if (!session.verified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // ── start ────────────────────────────────────────────────────────────────
  if (action === 'start') {
    const { client_id, agency_id, site_id, target_keywords, auto_publish, stages_to_run } = body

    if (!client_id || !agency_id) {
      return NextResponse.json({ error: 'client_id and agency_id are required' }, { status: 400 })
    }
    if (!target_keywords || !Array.isArray(target_keywords) || target_keywords.length === 0) {
      return NextResponse.json({ error: 'target_keywords must be a non-empty array' }, { status: 400 })
    }

    const config: PipelineConfig = {
      client_id,
      agency_id: session.agencyId || agency_id,
      site_id: site_id || undefined,
      target_keywords: target_keywords.map((k: string) => k.trim()).filter(Boolean),
      auto_publish: auto_publish === true,
      stages_to_run: stages_to_run || [1, 2, 3, 4, 5, 6],
    }

    const runId = await runFullPipeline(config)
    return NextResponse.json({ success: true, run_id: runId })
  }

  // ── status ───────────────────────────────────────────────────────────────
  if (action === 'status') {
    const { run_id } = body
    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }
    const run = getRun(run_id)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, run })
  }

  // ── stop ─────────────────────────────────────────────────────────────────
  if (action === 'stop') {
    const { run_id } = body
    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }
    const cancelled = cancelRun(run_id)
    if (!cancelled) {
      return NextResponse.json({ error: 'Run not found or already complete' }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: 'Pipeline cancellation requested' })
  }

  // ── list ─────────────────────────────────────────────────────────────────
  if (action === 'list') {
    const { client_id } = body
    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    }
    const runs = listRuns(client_id)
    return NextResponse.json({ success: true, runs })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
