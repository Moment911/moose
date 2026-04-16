// ─────────────────────────────────────────────────────────────
// Bulk Operations Engine
//
// Runs a chosen KotoIQ operation across many clients at once.
// Creates a kotoiq_bulk_runs row + kotoiq_bulk_run_clients rows,
// fires off per-client operations async, and lets the UI poll
// for progress.
// ─────────────────────────────────────────────────────────────

type BulkOperation = 'on_page_audit' | 'brief_generation' | 'content_refresh' | 'topical_map' | 'full_sync'

interface RunBody {
  agency_id: string
  operation: BulkOperation
  client_ids?: string[]
  options?: Record<string, any>
}

// Maps operation → action name + per-client body builder
const OPERATION_MAP: Record<BulkOperation, {
  action: string
  buildBody: (clientId: string, opts: any) => Record<string, any>
}> = {
  on_page_audit: {
    action: 'analyze_on_page',
    buildBody: (client_id, opts) => ({ client_id, url: opts?.url, keyword: opts?.keyword }),
  },
  brief_generation: {
    action: 'generate_brief',
    buildBody: (client_id, opts) => ({ client_id, keyword: opts?.keyword, top_n: opts?.top_n || 10 }),
  },
  content_refresh: {
    action: 'build_content_inventory',
    buildBody: (client_id) => ({ client_id }),
  },
  topical_map: {
    action: 'generate_topical_map',
    buildBody: (client_id) => ({ client_id }),
  },
  full_sync: {
    action: 'sync',
    buildBody: (client_id, opts) => ({ client_id, agency_id: opts?.agency_id }),
  },
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
}

export async function runBulkOperation(s: any, _ai: any, body: RunBody) {
  const { agency_id, operation, client_ids, options } = body
  if (!agency_id) throw new Error('agency_id required')
  if (!operation || !OPERATION_MAP[operation]) throw new Error('Invalid operation')

  // Resolve client list — if none provided, all active clients for agency
  let clients: Array<{ id: string; name: string }> = []
  if (client_ids && client_ids.length > 0) {
    const { data } = await s
      .from('clients')
      .select('id, name')
      .in('id', client_ids)
      .is('deleted_at', null)
    clients = data || []
  } else {
    const { data } = await s
      .from('clients')
      .select('id, name')
      .eq('agency_id', agency_id)
      .is('deleted_at', null)
    clients = data || []
  }

  if (clients.length === 0) throw new Error('No clients matched')

  // Create the bulk run header
  const { data: bulkRun, error: runErr } = await s
    .from('kotoiq_bulk_runs')
    .insert({
      agency_id,
      operation,
      total_clients: clients.length,
      options: options || {},
      status: 'running',
    })
    .select()
    .single()
  if (runErr) throw runErr

  // Seed per-client rows
  const rows = clients.map((c) => ({
    bulk_run_id: bulkRun.id,
    client_id: c.id,
    status: 'queued',
  }))
  await s.from('kotoiq_bulk_run_clients').insert(rows)

  // Fire-and-forget: for each client, kick off the operation async
  const opConfig = OPERATION_MAP[operation]
  const baseUrl = getBaseUrl()
  // Also create per-client processing_jobs entries for uniform tracking
  try {
    await s.from('kotoiq_processing_jobs').insert(
      clients.map((c) => ({
        client_id: c.id,
        engine: `bulk_${operation}`,
        status: 'queued',
        metadata: { bulk_run_id: bulkRun.id, operation, agency_id },
      }))
    )
  } catch {}

  // Kick off async — use fetch w/o await to avoid blocking
  for (const c of clients) {
    const perClientBody = opConfig.buildBody(c.id, { ...(options || {}), agency_id })
    ;(async () => {
      const startedAt = new Date().toISOString()
      await s
        .from('kotoiq_bulk_run_clients')
        .update({ status: 'running', started_at: startedAt })
        .eq('bulk_run_id', bulkRun.id)
        .eq('client_id', c.id)
      try {
        const res = await fetch(`${baseUrl}/api/kotoiq`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: opConfig.action, ...perClientBody }),
        })
        const result = await res.json().catch(() => ({}))
        const ok = res.ok && !result.error
        await s
          .from('kotoiq_bulk_run_clients')
          .update({
            status: ok ? 'complete' : 'failed',
            result_summary: ok ? summarizeResult(operation, result) : {},
            error: ok ? null : (result.error || `HTTP ${res.status}`),
            completed_at: new Date().toISOString(),
          })
          .eq('bulk_run_id', bulkRun.id)
          .eq('client_id', c.id)

        // Update rollup counters on the bulk run
        await incrementBulkRunCounters(s, bulkRun.id, ok)
      } catch (e: any) {
        await s
          .from('kotoiq_bulk_run_clients')
          .update({
            status: 'failed',
            error: e?.message || 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('bulk_run_id', bulkRun.id)
          .eq('client_id', c.id)
        await incrementBulkRunCounters(s, bulkRun.id, false)
      }
    })()
  }

  return {
    bulk_run_id: bulkRun.id,
    total_clients: clients.length,
    started_at: bulkRun.started_at,
  }
}

function summarizeResult(operation: BulkOperation, result: any): Record<string, any> {
  switch (operation) {
    case 'on_page_audit':
      return { score: result.score, issues: result.issues?.length || 0 }
    case 'brief_generation':
      return { briefs_created: result.briefs?.length || (result.brief ? 1 : 0) }
    case 'content_refresh':
      return { pages_scanned: result.pages?.length || result.inventory?.length || 0 }
    case 'topical_map':
      return { nodes: result.map?.nodes?.length || result.nodes?.length || 0, coverage: result.map?.topical_coverage_score }
    case 'full_sync':
      return { keywords: result.keyword_count || result.ukf?.length || 0 }
    default:
      return {}
  }
}

async function incrementBulkRunCounters(s: any, bulkRunId: string, ok: boolean) {
  try {
    // Recompute from child rows (authoritative)
    const { data: children } = await s
      .from('kotoiq_bulk_run_clients')
      .select('status')
      .eq('bulk_run_id', bulkRunId)
    const total = children?.length || 0
    const completed = (children || []).filter((c: any) => c.status === 'complete').length
    const failed = (children || []).filter((c: any) => c.status === 'failed').length
    const finished = completed + failed
    const allDone = finished >= total && total > 0

    await s
      .from('kotoiq_bulk_runs')
      .update({
        completed_clients: completed,
        failed_clients: failed,
        status: allDone ? 'complete' : 'running',
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', bulkRunId)
  } catch {}
}

export async function getBulkOperationStatus(s: any, body: { bulk_run_id?: string; agency_id?: string }) {
  const { bulk_run_id, agency_id } = body

  if (bulk_run_id) {
    const { data: run } = await s
      .from('kotoiq_bulk_runs')
      .select('*')
      .eq('id', bulk_run_id)
      .maybeSingle()
    if (!run) throw new Error('bulk_run_id not found')

    const { data: children } = await s
      .from('kotoiq_bulk_run_clients')
      .select('*, clients(name)')
      .eq('bulk_run_id', bulk_run_id)

    const kids = children || []
    const total = run.total_clients ?? kids.length
    const completed = kids.filter((c: any) => c.status === 'complete').length
    const failed = kids.filter((c: any) => c.status === 'failed').length
    const inProgress = kids.filter((c: any) => c.status === 'running' || c.status === 'queued').length

    return {
      bulk_run_id: run.id,
      operation: run.operation,
      options: run.options,
      total,
      completed,
      failed,
      in_progress: inProgress,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      clients: kids.map((c: any) => ({
        client_id: c.client_id,
        client_name: c.clients?.name || '—',
        status: c.status,
        result_summary: c.result_summary || {},
        error: c.error || null,
        started_at: c.started_at,
        completed_at: c.completed_at,
      })),
    }
  }

  if (agency_id) {
    const { data: runs } = await s
      .from('kotoiq_bulk_runs')
      .select('*')
      .eq('agency_id', agency_id)
      .order('started_at', { ascending: false })
      .limit(20)
    return { runs: runs || [] }
  }

  throw new Error('bulk_run_id or agency_id required')
}
