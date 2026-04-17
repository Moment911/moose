// ── KotoIQ Pipeline Orchestrator ────────────────────────────────────────────
// Chains all 6 stages of the KotoIQ pipeline: Ingest → Graph → Plan → Generate → Ship → Measure
// Each stage calls the KotoIQ API via internal fetch, keeping the orchestrator decoupled.

import { createClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  client_id: string
  agency_id: string
  site_id?: string
  target_keywords: string[]
  auto_publish: boolean
  stages_to_run?: number[] // defaults to [1,2,3,4,5,6]
}

export interface StepResult {
  step: string
  action: string
  status: 'success' | 'error' | 'skipped'
  data?: any
  error?: string
  started_at: string
  finished_at: string
}

export interface StageProgress {
  stage: number
  stage_name: string
  status: 'waiting' | 'running' | 'done' | 'error' | 'skipped'
  steps_complete: number
  steps_total: number
  steps: StepResult[]
  started_at?: string
  finished_at?: string
  duration_ms?: number
}

export interface PipelineRun {
  id: string
  client_id: string
  agency_id: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  stages: StageProgress[]
  config: PipelineConfig
  started_at: string
  finished_at?: string
  results?: PipelineResults
}

export interface PipelineResults {
  pages_generated: number
  pages_published: number
  keywords_targeted: number
  published_urls: string[]
  errors: string[]
}

// ── In-memory run store ────────────────────────────────────────────────────
// Keyed by run_id. In production this could be backed by Redis or DB.

const activeRuns = new Map<string, PipelineRun>()
const cancelFlags = new Map<string, boolean>()

export function getRun(runId: string): PipelineRun | undefined {
  return activeRuns.get(runId)
}

export function listRuns(clientId: string): PipelineRun[] {
  return Array.from(activeRuns.values())
    .filter(r => r.client_id === clientId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
}

export function cancelRun(runId: string): boolean {
  if (activeRuns.has(runId)) {
    cancelFlags.set(runId, true)
    return true
  }
  return false
}

// ── Supabase helper ────────────────────────────────────────────────────────

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Internal API caller ────────────────────────────────────────────────────

async function callKotoIQ(action: string, payload: Record<string, any>): Promise<any> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  const res = await fetch(`${APP_URL}/api/kotoiq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

async function callBuilderAttribution(action: string, payload: Record<string, any>): Promise<any> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  const res = await fetch(`${APP_URL}/api/wp/builder/attribution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── Concurrency limiter ────────────────────────────────────────────────────

async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  let idx = 0

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      try {
        const value = await tasks[i]()
        results[i] = { status: 'fulfilled', value }
      } catch (reason: any) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Step runner (resilient — logs errors, continues) ───────────────────────

async function runStep(
  run: PipelineRun,
  stageIdx: number,
  stepName: string,
  action: string,
  payload: Record<string, any>,
  fetcher: (action: string, payload: Record<string, any>) => Promise<any> = callKotoIQ
): Promise<StepResult> {
  const started_at = new Date().toISOString()
  try {
    const data = await fetcher(action, payload)
    const result: StepResult = {
      step: stepName,
      action,
      status: data?.error ? 'error' : 'success',
      data: data?.error ? undefined : data,
      error: data?.error || undefined,
      started_at,
      finished_at: new Date().toISOString(),
    }
    run.stages[stageIdx].steps.push(result)
    run.stages[stageIdx].steps_complete++
    return result
  } catch (err: any) {
    const result: StepResult = {
      step: stepName,
      action,
      status: 'error',
      error: err?.message || 'Unknown error',
      started_at,
      finished_at: new Date().toISOString(),
    }
    run.stages[stageIdx].steps.push(result)
    run.stages[stageIdx].steps_complete++
    return result
  }
}

// ── Stage definitions ──────────────────────────────────────────────────────

const STAGE_NAMES = ['Ingest', 'Graph', 'Plan', 'Generate', 'Ship', 'Measure']
const STAGE_STEP_COUNTS = [6, 5, 5, -1, -1, 3] // -1 = dynamic (per-keyword)

function buildInitialStages(config: PipelineConfig): StageProgress[] {
  const stagesToRun = config.stages_to_run || [1, 2, 3, 4, 5, 6]
  const kwCount = config.target_keywords.length

  return STAGE_NAMES.map((name, i) => {
    const stageNum = i + 1
    const isActive = stagesToRun.includes(stageNum)
    let stepsTotal: number
    if (stageNum === 4) stepsTotal = kwCount * 5 // 5 steps per keyword
    else if (stageNum === 5) stepsTotal = kwCount + 2 // per-page pipeline + 2 bulk steps
    else stepsTotal = STAGE_STEP_COUNTS[i]

    return {
      stage: stageNum,
      stage_name: name,
      status: isActive ? 'waiting' as const : 'skipped' as const,
      steps_complete: 0,
      steps_total: stepsTotal,
      steps: [],
    }
  })
}

// ── Stage 1: Ingest ────────────────────────────────────────────────────────

async function runStageIngest(run: PipelineRun, config: PipelineConfig) {
  const si = 0
  const p = { client_id: config.client_id, agency_id: config.agency_id }

  await runStep(run, si, 'Sync data sources', 'sync', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'GSC audit', 'run_gsc_audit', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Bing audit', 'run_bing_audit', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Backlink scan', 'scan_backlink_opportunities', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Review analysis', 'analyze_reviews', p)
  if (cancelFlags.get(run.id)) return

  // Store target keywords into kotoiq_keywords if they don't exist
  const supabase = sb()
  for (const kw of config.target_keywords) {
    const fp = kw.toLowerCase().trim().replace(/\s+/g, ' ')
    const { data: existing } = await supabase
      .from('kotoiq_keywords')
      .select('id')
      .eq('client_id', config.client_id)
      .eq('fingerprint', fp)
      .maybeSingle()
    if (!existing) {
      await supabase.from('kotoiq_keywords').insert({
        client_id: config.client_id,
        agency_id: config.agency_id,
        keyword: kw.trim(),
        fingerprint: fp,
        source: 'pipeline_orchestrator',
      })
    }
  }
  run.stages[si].steps_complete = run.stages[si].steps_total
}

// ── Stage 2: Graph ─────────────────────────────────────────────────────────

async function runStageGraph(run: PipelineRun, config: PipelineConfig) {
  const si = 1
  const p = { client_id: config.client_id, agency_id: config.agency_id }

  await runStep(run, si, 'Generate topical map', 'generate_topical_map', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Brand SERP scan', 'scan_brand_serp', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'E-E-A-T audit', 'audit_eeat', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Semantic network', 'analyze_semantic_network', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Export knowledge graph', 'export_knowledge_graph', { client_id: config.client_id })
}

// ── Stage 3: Plan ──────────────────────────────────────────────────────────

async function runStagePlan(run: PipelineRun, config: PipelineConfig) {
  const si = 2
  const p = { client_id: config.client_id, agency_id: config.agency_id }

  await runStep(run, si, 'Analyze query paths', 'analyze_query_paths', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Generate strategic plan', 'generate_strategic_plan', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Build content calendar', 'build_content_calendar', { client_id: config.client_id })
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Analyze topical coverage', 'analyze_topical_coverage', p)
  if (cancelFlags.get(run.id)) return

  await runStep(run, si, 'Generate quick wins', 'generate_quick_win_queue', { client_id: config.client_id })
}

// ── Stage 4: Generate (parallel per keyword, concurrency 3) ────────────────

async function runStageGenerate(run: PipelineRun, config: PipelineConfig): Promise<any[]> {
  const si = 3
  const generatedPages: any[] = []

  const tasks = config.target_keywords.map((keyword) => async () => {
    if (cancelFlags.get(run.id)) return null

    // 1. Generate brief
    const briefResult = await runStep(run, si, `Brief: ${keyword}`, 'generate_brief', {
      client_id: config.client_id,
      keyword,
    })
    if (cancelFlags.get(run.id)) return null

    const briefData = briefResult.data || {}

    // 2. Write full page
    const pageResult = await runStep(run, si, `Write: ${keyword}`, 'write_full_page', {
      client_id: config.client_id,
      keyword,
      brief: briefData,
    })
    if (cancelFlags.get(run.id)) return null

    const content = pageResult.data?.content || pageResult.data?.html || ''

    // 3. Check plagiarism
    await runStep(run, si, `Plagiarism: ${keyword}`, 'check_plagiarism', {
      client_id: config.client_id,
      content,
      keyword,
    })
    if (cancelFlags.get(run.id)) return null

    // 4. Generate schema
    const schemaResult = await runStep(run, si, `Schema: ${keyword}`, 'generate_schema', {
      client_id: config.client_id,
      content,
      keyword,
    })
    if (cancelFlags.get(run.id)) return null

    // 5. Optimize passages
    const passageResult = await runStep(run, si, `Optimize: ${keyword}`, 'optimize_passages', {
      client_id: config.client_id,
      content,
      keyword,
    })

    const page = {
      keyword,
      content: passageResult.data?.optimized_content || content,
      schema: schemaResult.data?.schema || null,
      brief: briefData,
    }
    generatedPages.push(page)
    return page
  })

  await parallelLimit(tasks, 3)
  return generatedPages
}

// ── Stage 5: Ship ──────────────────────────────────────────────────────────

async function runStageShip(
  run: PipelineRun,
  config: PipelineConfig,
  generatedPages: any[]
): Promise<string[]> {
  const si = 4
  const publishedUrls: string[] = []

  // Run autonomous pipeline for each keyword/page
  for (const page of generatedPages) {
    if (cancelFlags.get(run.id)) break

    const result = await runStep(run, si, `Publish: ${page.keyword}`, 'run_autonomous_pipeline', {
      client_id: config.client_id,
      keyword: page.keyword,
      auto_publish: config.auto_publish,
      content: page.content,
      schema: page.schema,
    })
    if (result.data?.url) publishedUrls.push(result.data.url)
  }

  if (cancelFlags.get(run.id)) return publishedUrls

  // Bulk: internal link scan
  await runStep(run, si, 'Scan internal links', 'scan_internal_links', {
    client_id: config.client_id,
    agency_id: config.agency_id,
  })
  if (cancelFlags.get(run.id)) return publishedUrls

  // Bulk: sitemap crawl
  await runStep(run, si, 'Crawl sitemaps', 'crawl_sitemaps', {
    client_id: config.client_id,
    agency_id: config.agency_id,
  })

  return publishedUrls
}

// ── Stage 6: Measure ───────────────────────────────────────────────────────

async function runStageMeasure(
  run: PipelineRun,
  config: PipelineConfig,
  publishedUrls: string[]
) {
  const si = 5

  // Fetch CWV for each published URL
  for (const url of publishedUrls) {
    if (cancelFlags.get(run.id)) break
    await runStep(
      run, si, `CWV: ${url}`, 'fetch_cwv',
      { client_id: config.client_id, url },
      callBuilderAttribution
    )
  }

  if (cancelFlags.get(run.id)) return

  // Content decay prediction
  await runStep(run, si, 'Decay prediction', 'predict_content_decay', {
    client_id: config.client_id,
  })
  if (cancelFlags.get(run.id)) return

  // ROI projections
  await runStep(run, si, 'ROI projections', 'roi_projections', {
    client_id: config.client_id,
  })
}

// ── Master orchestrator ────────────────────────────────────────────────────

export async function runFullPipeline(config: PipelineConfig): Promise<string> {
  const runId = `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const stagesToRun = config.stages_to_run || [1, 2, 3, 4, 5, 6]

  const run: PipelineRun = {
    id: runId,
    client_id: config.client_id,
    agency_id: config.agency_id,
    status: 'running',
    stages: buildInitialStages(config),
    config,
    started_at: new Date().toISOString(),
  }

  activeRuns.set(runId, run)
  cancelFlags.set(runId, false)

  // Fire-and-forget — the caller gets the run_id immediately
  ;(async () => {
    let generatedPages: any[] = []
    let publishedUrls: string[] = []
    const errors: string[] = []

    const stageFns: Array<() => Promise<void>> = [
      // Stage 1
      async () => { await runStageIngest(run, config) },
      // Stage 2
      async () => { await runStageGraph(run, config) },
      // Stage 3
      async () => { await runStagePlan(run, config) },
      // Stage 4
      async () => { generatedPages = await runStageGenerate(run, config) },
      // Stage 5
      async () => { publishedUrls = await runStageShip(run, config, generatedPages) },
      // Stage 6
      async () => { await runStageMeasure(run, config, publishedUrls) },
    ]

    for (let i = 0; i < 6; i++) {
      if (cancelFlags.get(runId)) {
        run.status = 'cancelled'
        break
      }

      const stageNum = i + 1
      if (!stagesToRun.includes(stageNum)) continue

      run.stages[i].status = 'running'
      run.stages[i].started_at = new Date().toISOString()

      try {
        await stageFns[i]()
        run.stages[i].status = cancelFlags.get(runId) ? 'error' : 'done'
      } catch (err: any) {
        run.stages[i].status = 'error'
        errors.push(`Stage ${stageNum} (${STAGE_NAMES[i]}): ${err?.message || 'Unknown error'}`)
      }

      run.stages[i].finished_at = new Date().toISOString()
      run.stages[i].duration_ms =
        new Date(run.stages[i].finished_at!).getTime() -
        new Date(run.stages[i].started_at!).getTime()
    }

    // Collect all step-level errors
    for (const stage of run.stages) {
      for (const step of stage.steps) {
        if (step.status === 'error' && step.error) {
          errors.push(`${stage.stage_name} → ${step.step}: ${step.error}`)
        }
      }
    }

    run.results = {
      pages_generated: generatedPages.length,
      pages_published: publishedUrls.length,
      keywords_targeted: config.target_keywords.length,
      published_urls: publishedUrls,
      errors,
    }
    run.finished_at = new Date().toISOString()
    if (run.status === 'running') {
      run.status = errors.length > 0 && generatedPages.length === 0 ? 'error' : 'done'
    }
  })()

  return runId
}
