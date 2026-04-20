// ── KotoIQ Pipeline Orchestrator ────────────────────────────────────────────
// Chains all 7 stages of the KotoIQ pipeline:
//   Profile → Ingest → Graph → Plan → Generate → Ship → Measure
// Each stage calls the KotoIQ API via internal fetch, keeping the orchestrator decoupled.
//
// Phase 7 / Plan 4 added Stage 0 (Profile) IN FRONT of the original 6 stages
// and durable kotoiq_pipeline_runs writes around every stage transition so the
// D-23 live ribbon survives a cold start.  Existing runStage* functions had
// their hard-coded `const si = N` bumped by 1 (Ingest 0→1, Graph 1→2, etc.).
//
// Cross-agency isolation: kotoiq_pipeline_runs is NOT in DIRECT_AGENCY_TABLES
// (it predates the kotoiqDb agency-scoping helper).  Every write below
// includes an explicit `.eq('agency_id', agencyId)` per CLAUDE.md isolation rule.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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

// STAGE_NAMES: Phase 7 / Plan 4 prepended 'Profile' (Stage 0). The 6 original
// stages keep their names but each `runStage* `'s `const si = N` was bumped
// by 1 to match the new STAGE_NAMES indices.
const STAGE_NAMES = [
  'Profile',
  'Ingest',
  'Graph',
  'Plan',
  'Generate',
  'Ship',
  'Measure',
]
const STAGE_STEP_COUNTS = [2, 6, 5, 5, -1, -1, 3] // -1 = dynamic (per-keyword)

function buildInitialStages(config: PipelineConfig): StageProgress[] {
  // Default: run all 7 stages (1..7). Existing callers passing [1,2,3,4,5,6]
  // get those mapped to the new Ingest..Measure stages (which retain their
  // names; the indices shift to 2..7). Stage 1 (Profile) runs by default for
  // any caller that doesn't explicitly pass stages_to_run.
  const stagesToRun = config.stages_to_run || [1, 2, 3, 4, 5, 6, 7]
  const kwCount = config.target_keywords.length

  return STAGE_NAMES.map((name, i) => {
    const stageNum = i + 1
    const isActive = stagesToRun.includes(stageNum)
    let stepsTotal: number
    // Stage 5 = Generate (5 steps per keyword), Stage 6 = Ship (kw + 2 bulk).
    // (After the Plan-4 shift: Generate moved from stage 4 → 5, Ship from 5 → 6.)
    if (stageNum === 5)
      stepsTotal = kwCount * 5 // 5 steps per keyword
    else if (stageNum === 6)
      stepsTotal = kwCount + 2 // per-page pipeline + 2 bulk steps
    else stepsTotal = STAGE_STEP_COUNTS[i]

    return {
      stage: stageNum,
      stage_name: name,
      status: isActive ? ('waiting' as const) : ('skipped' as const),
      steps_complete: 0,
      steps_total: stepsTotal,
      steps: [],
    }
  })
}

// ── kotoiq_pipeline_runs durable writes (D-23 ribbon) ──────────────────────
//
// IMPORTANT: kotoiq_pipeline_runs is one of the 7 backlog migrations not yet
// applied to live Supabase (defined in 20260419_kotoiq_automation.sql, see
// Phase 07-01-SUMMARY "Known follow-ups"). Every write below is wrapped in
// try/catch so the orchestrator continues working against the current live
// DB; the ribbon will not light up until the backlog is applied. Once the
// migration lands, the try/catch guards may be relaxed.
//
// Schema actually present in 20260419_kotoiq_automation.sql:
//   id (uuid PK), client_id, agency_id, keyword, status, ..., steps jsonb,
//   created_at, completed_at
// Note: the table does NOT have current_stage / current_step / started_at /
// updated_at columns. We track stage/step transitions inside the `steps`
// jsonb column (append-only event log) rather than dedicated columns.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pipelineRunsTable(): any {
  // Use the local sb() service-role client (line 86) — kotoiq_pipeline_runs
  // is not in DIRECT_AGENCY_TABLES so the kotoiqDb scoping helper would
  // refuse to inject agency_id automatically. We add `.eq('agency_id', ...)`
  // explicitly on every read/write.
  return sb().from('kotoiq_pipeline_runs')
}

async function pipelineRunInsert(
  runId: string,
  config: PipelineConfig,
): Promise<void> {
  try {
    await pipelineRunsTable().insert({
      id: runId,
      agency_id: config.agency_id,
      client_id: config.client_id,
      status: 'running',
      steps: [
        {
          stage: 'Profile',
          step: 'Load profile',
          status: 'running',
          at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[pipelineOrchestrator] kotoiq_pipeline_runs insert failed', err)
  }
}

async function pipelineRunUpdateStage(
  runId: string,
  agencyId: string,
  stageName: string,
  stepName: string | null,
  status: 'running' | 'completed' | 'failed' | 'cancelled',
): Promise<void> {
  try {
    // Read current steps jsonb so we can append the new event.
    const { data: row } = await pipelineRunsTable()
      .select('id, steps')
      .eq('id', runId)
      .eq('agency_id', agencyId) // mandatory cross-agency guard
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSteps: any[] = Array.isArray(row?.steps) ? row.steps : []
    existingSteps.push({
      stage: stageName,
      step: stepName,
      status,
      at: new Date().toISOString(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { steps: existingSteps }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      patch.status = status
      patch.completed_at = new Date().toISOString()
    } else if (status === 'running') {
      patch.status = 'running'
    }

    await pipelineRunsTable()
      .update(patch)
      .eq('id', runId)
      .eq('agency_id', agencyId) // mandatory
  } catch (err) {
    console.error('[pipelineOrchestrator] kotoiq_pipeline_runs update failed', err)
  }
}

// ── Stage 1 (NEW — Plan 4): Profile (Stage 0 → si=0) ───────────────────────
//
// Composes the Plan 2 + Plan 3 + Plan 4 modules into a single seed call,
// then serializes the entity graph (D-22) into kotoiq_client_profile so
// Stage 3 (Graph) can consume it.
//
// Lazy imports are required because pipelineOrchestrator.ts → profileSeeder
// → kotoiqDb → @supabase/supabase-js builds a dependency tree that's heavy
// to instantiate at module load. Loading on first use also avoids a circular
// import risk if the seeder ever needs to reach back into the orchestrator.

async function runStageSeedProfile(
  run: PipelineRun,
  config: PipelineConfig,
): Promise<void> {
  const si = 0
  await runStep(
    run,
    si,
    'Load profile',
    'load_profile',
    { client_id: config.client_id, agency_id: config.agency_id },
    async () => {
      const { seedProfile } = await import('../kotoiq/profileSeeder')
      const result = await seedProfile({
        clientId: config.client_id,
        agencyId: config.agency_id,
        forceRebuild: false,
      })
      return {
        client_id: config.client_id,
        fields_resolved: Object.keys(result.profile.fields || {}).length,
        discrepancies: result.discrepancies.length,
      }
    },
  )
  if (cancelFlags.get(run.id)) return

  await runStep(
    run,
    si,
    'Serialize entity graph',
    'serialize_graph',
    { client_id: config.client_id },
    async () => {
      const { getKotoIQDb } = await import('../kotoiqDb')
      const { profileToEntityGraphSeed } = await import(
        '../kotoiq/profileGraphSerializer'
      )
      const db = getKotoIQDb(config.agency_id)
      const { data: profile } = await db.clientProfile.get(config.client_id)
      if (!profile) return { seed: null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seed = profileToEntityGraphSeed(profile as any)
      await db.clientProfile.upsert({
        client_id: config.client_id,
        entity_graph_seed: seed,
      })
      return { nodes: Object.keys(seed.confidence_by_node).length }
    },
  )
}

// ── Stage 2: Ingest (was Stage 1 pre-Plan-4 — si bumped 0 → 1) ─────────────

async function runStageIngest(run: PipelineRun, config: PipelineConfig) {
  const si = 1
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
      .eq('agency_id', config.agency_id)
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

// ── Stage 3: Graph (was Stage 2 pre-Plan-4 — si bumped 1 → 2) ──────────────

async function runStageGraph(run: PipelineRun, config: PipelineConfig) {
  const si = 2
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

// ── Stage 4: Plan (was Stage 3 pre-Plan-4 — si bumped 2 → 3) ───────────────

async function runStagePlan(run: PipelineRun, config: PipelineConfig) {
  const si = 3
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

// ── Stage 5: Generate — parallel per keyword, concurrency 3 ───────────────
// (was Stage 4 pre-Plan-4 — si bumped 3 → 4)

async function runStageGenerate(run: PipelineRun, config: PipelineConfig): Promise<any[]> {
  const si = 4
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

// ── Stage 6: Ship (was Stage 5 pre-Plan-4 — si bumped 4 → 5) ──────────────

async function runStageShip(
  run: PipelineRun,
  config: PipelineConfig,
  generatedPages: any[]
): Promise<string[]> {
  const si = 5
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

// ── Stage 7: Measure (was Stage 6 pre-Plan-4 — si bumped 5 → 6) ───────────

async function runStageMeasure(
  run: PipelineRun,
  config: PipelineConfig,
  publishedUrls: string[]
) {
  const si = 6

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
  // WR-04 — kotoiq_pipeline_runs.id is uuid PRIMARY KEY (per
  // supabase/migrations/20260419_kotoiq_automation.sql).  Previous
  // `pipe_${Date.now()}_${Math.random()...}` strings were not valid uuids
  // (Postgres rejected them on insert) AND had a birthday-paradox collision
  // risk under burst load.  randomUUID() removes both problems.
  const runId = randomUUID()
  // Default expanded to 7 stages now that Stage 1 = Profile (Plan 4).
  // Existing callers passing [1,2,3,4,5,6] still get a valid run; they just
  // won't trigger the new Profile stage. Pass [1,2,3,4,5,6,7] (or omit) for
  // the full pipeline including Stage 0 / Profile.
  const stagesToRun = config.stages_to_run || [1, 2, 3, 4, 5, 6, 7]

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

  // D-23 ribbon — insert the run row up front so a fresh ribbon subscriber
  // always sees the row, even if the in-memory map cold-starts away later.
  // Wrapped in try/catch inside pipelineRunInsert (table may not exist on
  // remote yet — see Phase 07-01 SUMMARY follow-ups).
  await pipelineRunInsert(runId, config)

  // Fire-and-forget — the caller gets the run_id immediately
  ;(async () => {
    let generatedPages: any[] = []
    let publishedUrls: string[] = []
    const errors: string[] = []

    // 7 stage functions in execution order. The 6 original stage functions
    // are unchanged in shape; runStageSeedProfile (Plan 4) prepends Stage 0.
    const stageFns: Array<() => Promise<void>> = [
      // Stage 1 — Profile (NEW)
      async () => { await runStageSeedProfile(run, config) },
      // Stage 2 — Ingest
      async () => { await runStageIngest(run, config) },
      // Stage 3 — Graph
      async () => { await runStageGraph(run, config) },
      // Stage 4 — Plan
      async () => { await runStagePlan(run, config) },
      // Stage 5 — Generate
      async () => { generatedPages = await runStageGenerate(run, config) },
      // Stage 6 — Ship
      async () => { publishedUrls = await runStageShip(run, config, generatedPages) },
      // Stage 7 — Measure
      async () => { await runStageMeasure(run, config, publishedUrls) },
    ]

    for (let i = 0; i < 7; i++) {
      if (cancelFlags.get(runId)) {
        run.status = 'cancelled'
        await pipelineRunUpdateStage(
          runId,
          config.agency_id,
          STAGE_NAMES[i] || 'Unknown',
          null,
          'cancelled',
        )
        break
      }

      const stageNum = i + 1
      if (!stagesToRun.includes(stageNum)) continue

      run.stages[i].status = 'running'
      run.stages[i].started_at = new Date().toISOString()
      // Durable: stage start
      await pipelineRunUpdateStage(
        runId,
        config.agency_id,
        STAGE_NAMES[i],
        null,
        'running',
      )

      try {
        await stageFns[i]()
        run.stages[i].status = cancelFlags.get(runId) ? 'error' : 'done'
      } catch (err: any) {
        run.stages[i].status = 'error'
        errors.push(`Stage ${stageNum} (${STAGE_NAMES[i]}): ${err?.message || 'Unknown error'}`)
        // Durable: stage failure
        await pipelineRunUpdateStage(
          runId,
          config.agency_id,
          STAGE_NAMES[i],
          null,
          'failed',
        )
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
    // Durable: terminal state
    await pipelineRunUpdateStage(
      runId,
      config.agency_id,
      STAGE_NAMES[STAGE_NAMES.length - 1],
      null,
      run.status === 'done'
        ? 'completed'
        : run.status === 'cancelled'
          ? 'cancelled'
          : 'failed',
    )
  })()

  return runId
}
