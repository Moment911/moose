// ─────────────────────────────────────────────────────────────
// Auto-Fix Queue Engine
//
// Materializes findings from audits/recommendations into a
// single queue. User reviews → approves/rejects → runApprovedFixes
// dispatches based on fix_type by calling other /api/kotoiq actions.
//
// Pattern: thin functions, no class wrappers, all taking
// (s: SupabaseClient, body: {...}). Mirrors askKotoIQEngine.ts.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

// ── Types ────────────────────────────────────────────────────
type Severity = 'high' | 'medium' | 'low'
type Effort = 'quick_win' | 'moderate' | 'major_project'
type FixType =
  | 'regenerate_brief'
  | 'apply_schema'
  | 'add_internal_link'
  | 'refresh_content'
  | 'mark_done'
  | 'manual'
type SourceType =
  | 'recommendation'
  | 'schema_audit'
  | 'technical_deep'
  | 'content_inventory'
  | 'eeat_audit'
  | 'page_diff'
  | 'manual'

interface QueueRow {
  client_id: string
  agency_id?: string | null
  source_type: SourceType
  source_id?: string | null
  source_signature: string
  title: string
  detail?: string | null
  target_url?: string | null
  severity: Severity
  estimated_impact?: string | null
  effort: Effort
  fix_type: FixType
  fix_params: Record<string, any>
}

// ── Helpers ──────────────────────────────────────────────────
function priorityToSeverity(p: string | null | undefined): Severity {
  const s = (p || '').toLowerCase()
  if (s === 'critical' || s === 'urgent' || s === 'high') return 'high'
  if (s === 'low') return 'low'
  return 'medium'
}

function effortFrom(s: string | null | undefined): Effort {
  const v = (s || '').toLowerCase()
  if (v === 'quick_win') return 'quick_win'
  if (v === 'major_project' || v === 'major' || v === 'project') return 'major_project'
  return 'moderate'
}

function recTypeToFix(t: string | null | undefined): { fix_type: FixType; effort: Effort } {
  const v = (t || '').toLowerCase()
  if (v === 'new_content') return { fix_type: 'regenerate_brief', effort: 'moderate' }
  if (v === 'schema_fix') return { fix_type: 'apply_schema', effort: 'quick_win' }
  if (v === 'quick_win') return { fix_type: 'manual', effort: 'quick_win' }
  if (v === 'link_build') return { fix_type: 'add_internal_link', effort: 'moderate' }
  return { fix_type: 'manual', effort: 'moderate' }
}

async function dispatchKotoIQ(action: string, params: Record<string, any>): Promise<{ ok: boolean; json: any }> {
  try {
    const res = await fetch(`${APP_URL}/api/kotoiq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    })
    const json = await res.json()
    return { ok: res.ok && !json?.error, json }
  } catch (e: any) {
    return { ok: false, json: { error: String(e?.message || e) } }
  }
}

async function safeSelect<T = any>(p: any): Promise<T[]> {
  return Promise.resolve(p).then((r: any) => (r?.data || []) as T[]).catch(() => [] as T[])
}

async function safeFirst<T = any>(p: any): Promise<T | null> {
  return Promise.resolve(p).then((r: any) => (r?.data || null) as T | null).catch(() => null)
}

// ── Scanner — pulls findings from each audit table ──────────
// Each section appends QueueRow entries to `rows` with a stable
// source_signature so re-scans are idempotent.
export async function scanForFixes(s: SupabaseClient, body: {
  client_id: string
  agency_id?: string
}) {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')

  const rows: QueueRow[] = []

  // ── 1. Existing recommendations ─────────────────────────
  const recs = await safeSelect<any>(
    s.from('kotoiq_recommendations')
      .select('id, type, priority, title, detail, estimated_impact, effort, status')
      .eq('client_id', client_id)
      .in('status', ['pending', 'in_progress'])
      .limit(100)
  )
  for (const r of recs) {
    const { fix_type, effort } = recTypeToFix(r.type)
    rows.push({
      client_id,
      agency_id: agency_id || null,
      source_type: 'recommendation',
      source_id: r.id,
      source_signature: `recommendation:${r.id}`,
      title: r.title || '(untitled recommendation)',
      detail: r.detail,
      severity: priorityToSeverity(r.priority),
      estimated_impact: r.estimated_impact,
      effort: r.effort ? effortFrom(r.effort) : effort,
      fix_type,
      fix_params: { recommendation_id: r.id },
    })
  }

  // ── 2. Schema audit — missing rich results + errors ─────
  const schemaAudit = await safeFirst<any>(
    s.from('kotoiq_schema_audit')
      .select('id, eligible_not_implemented, schema_errors, coverage_pct')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )
  if (schemaAudit) {
    const eligible: any[] = Array.isArray(schemaAudit.eligible_not_implemented) ? schemaAudit.eligible_not_implemented : []
    for (const e of eligible.slice(0, 20)) {
      if (!e?.url || !e?.type) continue
      rows.push({
        client_id,
        agency_id: agency_id || null,
        source_type: 'schema_audit',
        source_id: schemaAudit.id,
        source_signature: `schema_audit:eligible:${e.url}:${e.type}`,
        title: `Add ${e.type} schema to ${new URL(e.url).pathname || '/'}`,
        detail: e.potential_ctr_lift ? `Potential CTR lift: ${e.potential_ctr_lift}` : 'Eligible for rich results but not implemented.',
        target_url: e.url,
        severity: 'medium',
        estimated_impact: e.potential_ctr_lift,
        effort: 'quick_win',
        fix_type: 'apply_schema',
        fix_params: { url: e.url, schema_type: e.type },
      })
    }
    const errors: any[] = Array.isArray(schemaAudit.schema_errors) ? schemaAudit.schema_errors : []
    for (const err of errors.slice(0, 20)) {
      if (!err?.url) continue
      rows.push({
        client_id,
        agency_id: agency_id || null,
        source_type: 'schema_audit',
        source_id: schemaAudit.id,
        source_signature: `schema_audit:error:${err.url}:${err.type || 'unknown'}`,
        title: `Fix ${err.type || 'schema'} on ${new URL(err.url).pathname || '/'}`,
        detail: err.error || 'Schema validation error.',
        target_url: err.url,
        severity: 'high',
        effort: 'quick_win',
        fix_type: 'apply_schema',
        fix_params: { url: err.url, schema_type: err.type, fix_error: err.error },
      })
    }
  }

  // ── 3. Technical deep — canonical / mobile / sitemap issues
  const tech = await safeFirst<any>(
    s.from('kotoiq_technical_deep')
      .select('id, canonical_issues, mobile_mismatches, sitemap_issues')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )
  if (tech) {
    const canonical: any[] = Array.isArray(tech.canonical_issues) ? tech.canonical_issues : []
    for (const c of canonical.slice(0, 15)) {
      if (!c?.url) continue
      rows.push({
        client_id,
        agency_id: agency_id || null,
        source_type: 'technical_deep',
        source_id: tech.id,
        source_signature: `technical_deep:canonical:${c.url}:${c.issue_type || 'generic'}`,
        title: `Canonical: ${c.issue_type || 'issue'} on ${new URL(c.url).pathname || '/'}`,
        detail: c.detail || null,
        target_url: c.url,
        severity: 'high',
        effort: 'quick_win',
        fix_type: 'manual',
        fix_params: { url: c.url, issue_type: c.issue_type },
      })
    }
    const mobile: any[] = Array.isArray(tech.mobile_mismatches) ? tech.mobile_mismatches : []
    for (const m of mobile.slice(0, 10)) {
      if (!m?.url) continue
      rows.push({
        client_id,
        agency_id: agency_id || null,
        source_type: 'technical_deep',
        source_id: tech.id,
        source_signature: `technical_deep:mobile:${m.url}`,
        title: `Mobile mismatch on ${new URL(m.url).pathname || '/'}`,
        detail: m.detail || 'Mobile and desktop render differently.',
        target_url: m.url,
        severity: 'medium',
        effort: 'moderate',
        fix_type: 'manual',
        fix_params: { url: m.url },
      })
    }
  }

  // ── 4. Content inventory — urgent refreshes / declining pages
  const inventory = await safeSelect<any>(
    s.from('kotoiq_content_inventory')
      .select('id, url, title, refresh_priority, freshness_status, trajectory, days_since_update, sc_position')
      .eq('client_id', client_id)
      .or('refresh_priority.eq.urgent,trajectory.eq.declining')
      .limit(25)
  )
  for (const inv of inventory) {
    if (!inv?.url) continue
    const isDeclining = inv.trajectory === 'declining'
    const isUrgent = inv.refresh_priority === 'urgent'
    const sev: Severity = isUrgent && isDeclining ? 'high' : isUrgent || isDeclining ? 'medium' : 'low'
    rows.push({
      client_id,
      agency_id: agency_id || null,
      source_type: 'content_inventory',
      source_id: inv.id,
      source_signature: `content_inventory:refresh:${inv.url}`,
      title: `Refresh ${inv.title || new URL(inv.url).pathname}`,
      detail: [
        inv.freshness_status ? `Freshness: ${inv.freshness_status}` : null,
        inv.trajectory ? `Trajectory: ${inv.trajectory}` : null,
        inv.days_since_update != null ? `${inv.days_since_update}d since update` : null,
        inv.sc_position != null ? `Position ${inv.sc_position}` : null,
      ].filter(Boolean).join(' · '),
      target_url: inv.url,
      severity: sev,
      effort: 'moderate',
      fix_type: 'refresh_content',
      fix_params: { url: inv.url, title: inv.title },
    })
  }

  // ── 5. E-E-A-T — collect signals marked found:false ─────
  const eeat = await safeFirst<any>(
    s.from('kotoiq_eeat_audit')
      .select('id, url, experience_signals, expertise_signals, authority_signals, trust_signals')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )
  if (eeat) {
    const dims: Array<[string, any[]]> = [
      ['experience', Array.isArray(eeat.experience_signals) ? eeat.experience_signals : []],
      ['expertise', Array.isArray(eeat.expertise_signals) ? eeat.expertise_signals : []],
      ['authority', Array.isArray(eeat.authority_signals) ? eeat.authority_signals : []],
      ['trust', Array.isArray(eeat.trust_signals) ? eeat.trust_signals : []],
    ]
    for (const [dim, signals] of dims) {
      for (const sig of signals.slice(0, 5)) {
        if (!sig || sig.found !== false) continue
        rows.push({
          client_id,
          agency_id: agency_id || null,
          source_type: 'eeat_audit',
          source_id: eeat.id,
          source_signature: `eeat_audit:${dim}:${sig.signal || 'unknown'}`,
          title: `E-E-A-T (${dim}): ${sig.signal || 'missing signal'}`,
          detail: sig.detail || null,
          target_url: eeat.url || null,
          severity: dim === 'trust' ? 'high' : 'medium',
          effort: 'moderate',
          fix_type: 'manual',
          fix_params: { dimension: dim, signal: sig.signal },
        })
      }
    }
  }

  // ── Persist (upsert on source_signature, never overwrite live status)
  // Strategy: for each row, INSERT … ON CONFLICT DO NOTHING. That keeps
  // user state (approved/rejected/snoozed) intact across re-scans.
  let inserted = 0
  let skipped = 0
  for (const r of rows) {
    const { error } = await s.from('kotoiq_autofix_queue').insert(r)
    if (error) {
      // Most common: unique violation (row already exists) — that's fine.
      if (String(error.message || '').includes('duplicate key')) {
        skipped++
      } else {
        skipped++
      }
    } else {
      inserted++
    }
  }

  return {
    ok: true,
    scanned_sources: ['recommendation', 'schema_audit', 'technical_deep', 'content_inventory', 'eeat_audit'],
    candidates_seen: rows.length,
    inserted,
    skipped,
  }
}

// ── List queue with filters ─────────────────────────────────
export async function listQueue(s: SupabaseClient, body: {
  client_id: string
  status?: string
  severity?: string
  source_type?: string
  fix_type?: string
  limit?: number
}) {
  const { client_id, status, severity, source_type, fix_type, limit = 200 } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_autofix_queue')
    .select('*')
    .eq('client_id', client_id)
    .order('severity', { ascending: true })   // 'high' alphabetically < 'low' < 'medium' — see normalized sort below
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) q = q.eq('status', status)
  if (severity) q = q.eq('severity', severity)
  if (source_type) q = q.eq('source_type', source_type)
  if (fix_type) q = q.eq('fix_type', fix_type)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  // Normalize sort: high → medium → low (Supabase can't custom-order enum text)
  const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const items = (data || []).slice().sort((a: any, b: any) => {
    const r = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9)
    if (r !== 0) return r
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    running: items.filter(i => i.status === 'running').length,
    completed: items.filter(i => i.status === 'completed').length,
    failed: items.filter(i => i.status === 'failed').length,
    snoozed: items.filter(i => i.status === 'snoozed').length,
    high: items.filter(i => i.severity === 'high').length,
  }

  return { items, counts }
}

// ── Lifecycle updates ───────────────────────────────────────
export async function approveFix(s: SupabaseClient, body: { ids: string[]; user_id?: string }) {
  const { ids, user_id } = body
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids required')
  const { data, error } = await s.from('kotoiq_autofix_queue')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user_id || null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error(error.message)
  return { ok: true, approved: (data || []).length }
}

export async function rejectFix(s: SupabaseClient, body: { ids: string[]; reason?: string }) {
  const { ids, reason } = body
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids required')
  const { data, error } = await s.from('kotoiq_autofix_queue')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .select('id')
  if (error) throw new Error(error.message)
  return { ok: true, rejected: (data || []).length }
}

export async function snoozeFix(s: SupabaseClient, body: { ids: string[]; days?: number }) {
  const { ids, days = 7 } = body
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids required')
  const until = new Date(Date.now() + days * 86400000).toISOString()
  const { data, error } = await s.from('kotoiq_autofix_queue')
    .update({
      status: 'snoozed',
      snoozed_until: until,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .select('id')
  if (error) throw new Error(error.message)
  return { ok: true, snoozed: (data || []).length, snoozed_until: until }
}

// ── Run approved fixes — dispatches by fix_type ─────────────
// Picks up to `limit` approved rows, dispatches each to the
// appropriate /api/kotoiq action, and updates status with the result.
export async function runApprovedFixes(s: SupabaseClient, body: {
  client_id: string
  agency_id?: string
  limit?: number
}) {
  const { client_id, agency_id, limit = 5 } = body
  if (!client_id) throw new Error('client_id required')

  const { data: approved, error } = await s.from('kotoiq_autofix_queue')
    .select('*')
    .eq('client_id', client_id)
    .eq('status', 'approved')
    .order('severity', { ascending: true })
    .order('approved_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!approved || approved.length === 0) {
    return { ok: true, ran: 0, results: [] }
  }

  const results: any[] = []
  for (const row of approved) {
    // Mark running
    await s.from('kotoiq_autofix_queue')
      .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', row.id)

    let res: { ok: boolean; json: any } = { ok: false, json: { error: 'no dispatcher' } }
    const p = row.fix_params || {}

    switch (row.fix_type) {
      case 'apply_schema':
        if (p.url) {
          res = await dispatchKotoIQ('generate_schema_for_url', {
            client_id, agency_id, url: p.url, schema_type: p.schema_type,
          })
        } else {
          res = { ok: false, json: { error: 'missing url in fix_params' } }
        }
        break
      case 'refresh_content':
      case 'regenerate_brief':
        if (p.url || p.title || p.keyword) {
          res = await dispatchKotoIQ('generate_brief', {
            client_id, agency_id,
            keyword: p.keyword || p.title || p.url,
            page_type: p.page_type || 'service_page',
          })
        } else {
          res = { ok: false, json: { error: 'missing keyword/title/url in fix_params' } }
        }
        break
      case 'mark_done':
        res = { ok: true, json: { message: 'marked done' } }
        break
      case 'manual':
      case 'add_internal_link':
      default:
        // No automated dispatcher — treat as a human-to-do, don't auto-run.
        await s.from('kotoiq_autofix_queue').update({
          status: 'approved', // revert so it stays visible
          started_at: null,
          updated_at: new Date().toISOString(),
          result: { ok: false, message: 'Manual fix — no automated dispatcher. Approve removes from pending; mark done when complete.' },
        }).eq('id', row.id)
        results.push({ id: row.id, fix_type: row.fix_type, ok: false, message: 'manual' })
        continue
    }

    // Persist outcome
    const finalStatus = res.ok ? 'completed' : 'failed'
    await s.from('kotoiq_autofix_queue').update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      result: {
        ok: res.ok,
        message: res.ok ? 'fix dispatched successfully' : (res.json?.error || 'dispatch failed'),
        artifact: res.json?.brief_id || res.json?.id || null,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)

    results.push({ id: row.id, fix_type: row.fix_type, ok: res.ok, message: res.ok ? 'dispatched' : (res.json?.error || 'failed') })
  }

  return { ok: true, ran: results.length, results }
}
