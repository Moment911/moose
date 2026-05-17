// ─────────────────────────────────────────────────────────────────────────
// Plan Executor — runs ONE next-ready step per call.
//
// Companion to planBuilderEngine.ts. Where the builder produces a draft
// graph of steps tied to /api/kotoiq actions, the executor walks that
// graph: it finds the next step whose dependencies are all satisfied,
// dispatches its action, captures an artifact_ref + result summary, and
// advances both the step's status and the plan's status.
//
// Single-step on purpose: keeps every call well under Vercel's 300s cap
// and gives the UI explicit control (one click = one step). The PlansTab
// loops execute_next client-side when the user hits "Run remaining".
//
// Approval and manual steps are NOT auto-dispatched. They flip to
// 'manual_required' and wait for the user to call plan_approve (which
// also marks any pending manual_required steps as completed if the user
// confirms them inline) or skip them via the upcoming skip API.
// ─────────────────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

// ── Types ──────────────────────────────────────────────────────────────
export interface ExecuteNextInput {
  plan_id: string
  agency_id?: string
}

export interface PlanRow {
  id: string
  client_id: string
  agency_id: string | null
  status: string
  goal: string
}

export interface PlanStepRow {
  id: string
  plan_id: string
  sequence: number
  kind: string
  label: string
  status: string
  action: string | null
  // depends_on is jsonb. Per planBuilderEngine the LLM emits sequence
  // numbers (not step ids) so we treat it as number[]. The migration
  // comment says "ids" — that's a stale comment, the schema is jsonb
  // and the writer is authoritative.
  depends_on: number[] | null
  params: Record<string, unknown> | null
  artifact_ref: string | null
  artifact_kind: string | null
  result: Record<string, unknown> | null
  error: string | null
}

export interface ExecuteNextResult {
  plan_status: string
  step?: {
    id: string
    sequence: number
    label: string
    kind: string
    status: string
    artifact_ref: string | null
    artifact_kind: string | null
    result: Record<string, unknown> | null
    error: string | null
  }
  message?: string  // for terminal/no-op cases
}

// ── Public entrypoints ────────────────────────────────────────────────
export async function executeNextStep(
  s: SupabaseClient,
  input: ExecuteNextInput,
): Promise<ExecuteNextResult> {
  const { plan_id } = input
  if (!plan_id) throw new Error('plan_id required')

  const { plan, steps } = await loadPlanAndSteps(s, plan_id)

  if (plan.status === 'draft') {
    throw new Error('plan is still a draft — approve before executing')
  }
  if (plan.status === 'paused') {
    throw new Error('plan is paused — resume before executing')
  }
  if (plan.status === 'archived') {
    throw new Error('plan is archived')
  }
  if (plan.status === 'completed' || plan.status === 'failed') {
    return { plan_status: plan.status, message: `plan already ${plan.status}` }
  }

  const next = pickNextReadyStep(steps)
  if (!next) {
    // No more runnable steps. Decide if the plan is done or just waiting.
    const incomplete = steps.filter(st => !isTerminal(st.status))
    if (incomplete.length === 0) {
      await markPlanCompleted(s, plan.id)
      return { plan_status: 'completed', message: 'all steps complete' }
    }
    // Blocked: every remaining step depends on something pending/manual.
    const waitingOnManual = incomplete.some(st => st.status === 'manual_required')
    return {
      plan_status: plan.status,
      message: waitingOnManual
        ? 'waiting on manual_required steps — approve or skip them to proceed'
        : 'no ready steps (dependency chain blocked)',
    }
  }

  // Approval / manual: don't dispatch — flip status and wait for user.
  if (next.kind === 'approval' || next.kind === 'manual' || !next.action) {
    await updateStep(s, next.id, {
      status: 'manual_required',
      started_at: new Date().toISOString(),
    })
    await ensurePlanRunning(s, plan.id, plan.status)
    return {
      plan_status: 'running',
      step: {
        id: next.id,
        sequence: next.sequence,
        label: next.label,
        kind: next.kind,
        status: 'manual_required',
        artifact_ref: null,
        artifact_kind: null,
        result: null,
        error: null,
      },
    }
  }

  // Automated step: dispatch and capture.
  await updateStep(s, next.id, {
    status: 'running',
    started_at: new Date().toISOString(),
  })
  await ensurePlanRunning(s, plan.id, plan.status)

  const dispatch = await dispatchAction(
    next.action,
    next.params || {},
    plan.client_id,
    plan.agency_id || undefined,
  )

  if (!dispatch.ok) {
    const errMsg = dispatch.errorMessage || 'dispatch failed'
    await updateStep(s, next.id, {
      status: 'failed',
      error: errMsg,
      result: dispatch.result || null,
      completed_at: new Date().toISOString(),
    })
    await markPlanFailed(s, plan.id)
    return {
      plan_status: 'failed',
      step: {
        id: next.id,
        sequence: next.sequence,
        label: next.label,
        kind: next.kind,
        status: 'failed',
        artifact_ref: null,
        artifact_kind: null,
        result: dispatch.result || null,
        error: errMsg,
      },
    }
  }

  const { ref, kind: artKind } = extractArtifact(next.kind, dispatch.result)
  const summary = summarizeResult(dispatch.result)
  await updateStep(s, next.id, {
    status: 'completed',
    artifact_ref: ref,
    artifact_kind: artKind,
    result: summary,
    completed_at: new Date().toISOString(),
  })

  // If this was the last step, mark the plan complete.
  const refreshed = await s.from('kotoiq_plan_steps')
    .select('status').eq('plan_id', plan.id)
  const remaining = (refreshed.data || []).filter((r: { status: string }) => !isTerminal(r.status))
  if (remaining.length === 0) {
    await markPlanCompleted(s, plan.id)
    return {
      plan_status: 'completed',
      step: {
        id: next.id,
        sequence: next.sequence,
        label: next.label,
        kind: next.kind,
        status: 'completed',
        artifact_ref: ref,
        artifact_kind: artKind,
        result: summary,
        error: null,
      },
    }
  }

  return {
    plan_status: 'running',
    step: {
      id: next.id,
      sequence: next.sequence,
      label: next.label,
      kind: next.kind,
      status: 'completed',
      artifact_ref: ref,
      artifact_kind: artKind,
      result: summary,
      error: null,
    },
  }
}

// ── Step selection ────────────────────────────────────────────────────
function pickNextReadyStep(steps: PlanStepRow[]): PlanStepRow | null {
  const bySequence = [...steps].sort((a, b) => a.sequence - b.sequence)
  const completedSequences = new Set(
    steps.filter(st => st.status === 'completed' || st.status === 'skipped')
         .map(st => st.sequence),
  )
  for (const st of bySequence) {
    if (st.status !== 'pending') continue
    const deps = Array.isArray(st.depends_on) ? st.depends_on : []
    const allMet = deps.every(seq => completedSequences.has(seq))
    if (allMet) return st
  }
  return null
}

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'skipped'
}

// ── Dispatch ──────────────────────────────────────────────────────────
interface DispatchOutcome {
  ok: boolean
  result: Record<string, unknown> | null
  errorMessage?: string
}

async function dispatchAction(
  action: string,
  params: Record<string, unknown>,
  clientId: string,
  agencyId: string | undefined,
): Promise<DispatchOutcome> {
  try {
    const res = await fetch(`${APP_URL}/api/kotoiq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        client_id: clientId,
        agency_id: agencyId,
        ...params,
      }),
    })
    const json: Record<string, unknown> = await res.json().catch(() => ({}))
    const errField = typeof json?.error === 'string' ? (json.error as string) : null
    if (!res.ok || errField) {
      return {
        ok: false,
        result: json,
        errorMessage: errField || `HTTP ${res.status}`,
      }
    }
    return { ok: true, result: json }
  } catch (e) {
    const err = e as Error
    return { ok: false, result: null, errorMessage: err.message || 'dispatch threw' }
  }
}

// ── Artifact extraction ───────────────────────────────────────────────
// The /api/kotoiq actions return wildly different shapes. We pull the
// most useful single identifier per step kind so the timeline UI can
// link back to the produced asset.
function extractArtifact(
  stepKind: string,
  result: Record<string, unknown> | null,
): { ref: string | null; kind: string | null } {
  if (!result) return { ref: null, kind: null }
  const r = result as Record<string, unknown>

  const pickId = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = r[k]
      if (typeof v === 'string' && v.length > 0) return v
      if (typeof v === 'number') return String(v)
    }
    return null
  }

  if (stepKind === 'publish') {
    const ref = pickId('publish_id', 'wp_post_id', 'post_id', 'url')
    return { ref, kind: 'publish' }
  }
  if (stepKind === 'brief') {
    return { ref: pickId('brief_id', 'id'), kind: 'brief' }
  }
  if (stepKind === 'page') {
    // bulk_generate_pages returns { counts: {...}, brief_ids?: [...] }
    const counts = r.counts
    if (counts && typeof counts === 'object') {
      try { return { ref: JSON.stringify(counts), kind: 'briefs_batch' } }
      catch { /* fall through */ }
    }
    return { ref: pickId('brief_id', 'id'), kind: 'briefs_batch' }
  }
  if (stepKind === 'strategy') {
    return {
      ref: pickId('run_id', 'strategy_run_id', 'persisted_count', 'id'),
      kind: 'strategy',
    }
  }
  if (stepKind === 'analyze' || stepKind === 'audit' || stepKind === 'research') {
    return { ref: pickId('id', 'run_id'), kind: stepKind === 'analyze' ? 'analysis' : stepKind }
  }
  return { ref: pickId('id'), kind: stepKind }
}

// Trim the result we store on the step. The dispatcher routes can
// return multi-MB payloads (full SERP dumps, raw GBP responses);
// persisting all of that bloats the table and the UI never needs it.
function summarizeResult(result: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!result) return null
  let s: string
  try { s = JSON.stringify(result) } catch { return null }
  if (s.length <= 12000) return result
  // Too big — keep the top-level shape but stub heavy values.
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(result)) {
    if (v == null || typeof v !== 'object') { out[k] = v; continue }
    if (Array.isArray(v)) {
      out[k] = { __truncated_array: true, length: v.length, sample: v.slice(0, 3) }
    } else {
      try {
        const sub = JSON.stringify(v)
        out[k] = sub.length > 800
          ? { __truncated_object: true, keys: Object.keys(v as object).slice(0, 20) }
          : v
      } catch { out[k] = { __unserializable: true } }
    }
  }
  out.__summary = `original payload was ${s.length} chars; values over 800 chars stubbed`
  return out
}

// ── DB helpers ────────────────────────────────────────────────────────
async function loadPlanAndSteps(
  s: SupabaseClient,
  plan_id: string,
): Promise<{ plan: PlanRow; steps: PlanStepRow[] }> {
  const { data: plan, error: planErr } = await s.from('kotoiq_plans')
    .select('id, client_id, agency_id, status, goal')
    .eq('id', plan_id)
    .maybeSingle()
  if (planErr) throw new Error(`plan load: ${planErr.message}`)
  if (!plan) throw new Error('plan not found')

  const { data: steps, error: stErr } = await s.from('kotoiq_plan_steps')
    .select('id, plan_id, sequence, kind, label, status, action, depends_on, params, artifact_ref, artifact_kind, result, error')
    .eq('plan_id', plan_id)
    .order('sequence', { ascending: true })
  if (stErr) throw new Error(`steps load: ${stErr.message}`)

  return { plan: plan as PlanRow, steps: (steps || []) as PlanStepRow[] }
}

async function updateStep(
  s: SupabaseClient,
  step_id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await s.from('kotoiq_plan_steps')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', step_id)
  if (error) throw new Error(`step update: ${error.message}`)
}

async function ensurePlanRunning(
  s: SupabaseClient,
  plan_id: string,
  currentStatus: string,
): Promise<void> {
  if (currentStatus === 'running') return
  const { error } = await s.from('kotoiq_plans')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', plan_id)
  if (error) throw new Error(`plan -> running: ${error.message}`)
}

async function markPlanCompleted(s: SupabaseClient, plan_id: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await s.from('kotoiq_plans')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .eq('id', plan_id)
  if (error) throw new Error(`plan -> completed: ${error.message}`)
}

async function markPlanFailed(s: SupabaseClient, plan_id: string): Promise<void> {
  const { error } = await s.from('kotoiq_plans')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', plan_id)
  if (error) throw new Error(`plan -> failed: ${error.message}`)
}

// ── Lifecycle helpers (used by API actions) ───────────────────────────
export async function approvePlan(
  s: SupabaseClient,
  plan_id: string,
): Promise<{ ok: true; status: string }> {
  if (!plan_id) throw new Error('plan_id required')
  const { data, error } = await s.from('kotoiq_plans')
    .select('status').eq('id', plan_id).maybeSingle()
  if (error) throw new Error(`plan load: ${error.message}`)
  if (!data) throw new Error('plan not found')
  if (data.status !== 'draft' && data.status !== 'paused') {
    throw new Error(`cannot approve plan in status '${data.status}'`)
  }
  const now = new Date().toISOString()
  const { error: upErr } = await s.from('kotoiq_plans')
    .update({ status: 'approved', approved_at: now, updated_at: now })
    .eq('id', plan_id)
  if (upErr) throw new Error(`plan approve: ${upErr.message}`)
  return { ok: true, status: 'approved' }
}

export async function pausePlan(
  s: SupabaseClient,
  plan_id: string,
): Promise<{ ok: true; status: string }> {
  if (!plan_id) throw new Error('plan_id required')
  const { data, error } = await s.from('kotoiq_plans')
    .select('status').eq('id', plan_id).maybeSingle()
  if (error) throw new Error(`plan load: ${error.message}`)
  if (!data) throw new Error('plan not found')
  if (data.status === 'completed' || data.status === 'archived' || data.status === 'failed') {
    throw new Error(`cannot pause plan in status '${data.status}'`)
  }
  const { error: upErr } = await s.from('kotoiq_plans')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', plan_id)
  if (upErr) throw new Error(`plan pause: ${upErr.message}`)
  return { ok: true, status: 'paused' }
}

export async function archivePlan(
  s: SupabaseClient,
  plan_id: string,
): Promise<{ ok: true; status: string }> {
  if (!plan_id) throw new Error('plan_id required')
  const { error } = await s.from('kotoiq_plans')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', plan_id)
  if (error) throw new Error(`plan archive: ${error.message}`)
  return { ok: true, status: 'archived' }
}

// ── List / Get (consumed by UI) ──────────────────────────────────────
export async function listPlans(
  s: SupabaseClient,
  args: { client_id: string; status?: string; limit?: number },
): Promise<{ plans: Array<Record<string, unknown>> }> {
  const { client_id, status, limit = 50 } = args
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_plans')
    .select('id, client_id, agency_id, goal, summary, status, created_at, approved_at, completed_at, updated_at, meta')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))
  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw new Error(`plans list: ${error.message}`)

  // Add a step-count rollup per plan in one extra query.
  const plans = (data || []) as Array<Record<string, unknown>>
  if (plans.length === 0) return { plans }
  const planIds = plans.map(p => p.id as string)
  const { data: counts } = await s.from('kotoiq_plan_steps')
    .select('plan_id, status')
    .in('plan_id', planIds)
  const rollup = new Map<string, Record<string, number>>()
  for (const row of (counts || []) as Array<{ plan_id: string; status: string }>) {
    if (!rollup.has(row.plan_id)) rollup.set(row.plan_id, {})
    const r = rollup.get(row.plan_id)!
    r[row.status] = (r[row.status] || 0) + 1
    r.total = (r.total || 0) + 1
  }
  for (const p of plans) {
    p.step_counts = rollup.get(p.id as string) || { total: 0 }
  }

  return { plans }
}

export async function getPlan(
  s: SupabaseClient,
  args: { plan_id: string },
): Promise<{ plan: Record<string, unknown>; steps: Array<Record<string, unknown>> }> {
  const { plan_id } = args
  if (!plan_id) throw new Error('plan_id required')

  const { data: plan, error: planErr } = await s.from('kotoiq_plans')
    .select('*')
    .eq('id', plan_id)
    .maybeSingle()
  if (planErr) throw new Error(`plan load: ${planErr.message}`)
  if (!plan) throw new Error('plan not found')

  const { data: steps, error: stErr } = await s.from('kotoiq_plan_steps')
    .select('*')
    .eq('plan_id', plan_id)
    .order('sequence', { ascending: true })
  if (stErr) throw new Error(`steps load: ${stErr.message}`)

  return {
    plan: plan as Record<string, unknown>,
    steps: (steps || []) as Array<Record<string, unknown>>,
  }
}
