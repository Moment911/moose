'use client'
// ── Step 6: Your plan — review, approve, and CREATE the pages (in-flow) ───────
// Phase 11 Plan 11-05 produced a ranked build order; Phase 12 / 12-06's strategy
// step persisted an EXECUTABLE plan (kotoiq_plans + steps) and its plan_id. This
// step used to dump the user OUT of the guided tab into the Page Factory shell
// (a hard <a href> that dropped the client/site context). It now keeps the whole
// research → approve → create loop INSIDE the guided flow: it loads the executable
// plan, shows the ranked order, and drives plan_approve + plan_execute_next right
// here. The approval gate is preserved — nothing builds until the operator clicks
// Approve, and each page is created step-by-step (Vercel-safe, one action/call).
// Auto-internal-linking still happens on build via 11-05's computeInternalLinks.

import { useState, useEffect, useCallback } from 'react'
import { ListChecks, Hammer, CheckCircle2, Loader2, AlertTriangle, Hand } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, StatGrid, Stat, FlagChip, Skeleton, NextStepLink,
} from '../../ui/koto'
import StepShell from './StepShell'

const BUCKET_LABEL = {
  quick_win: 'Quick win', net_new: 'Net-new', big_bet: 'Big bet',
  low_demand_deprioritize: 'Low demand', unscored: 'Unscored',
}
const BUCKET_VARIANT = {
  quick_win: 'success', net_new: 'high', big_bet: 'medium',
  low_demand_deprioritize: 'low', unscored: 'low',
}

// Step-status → visual. The executor uses: pending / running / completed /
// failed / manual_required / skipped.
const STEP_ICON = {
  completed: { Icon: CheckCircle2, color: () => t.success },
  running: { Icon: Loader2, color: () => t.pink, spin: true },
  failed: { Icon: AlertTriangle, color: () => t.warning },
  manual_required: { Icon: Hand, color: () => t.warning },
}

export default function StepPlan({ clientId, agencyId, goNext }) {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null) // list_build_order: { total, by_bucket, order[] }
  const [error, setError] = useState(null)

  // Executable plan (kotoiq_plans) driven inline — the "create pages" engine.
  const [planId, setPlanId] = useState(null)
  const [exec, setExec] = useState(null)   // plan_get: { plan, steps }
  const [building, setBuilding] = useState(false)
  const [buildNote, setBuildNote] = useState(null)

  // ── Load the ranked build order + the executable plan id (from the strategy). ──
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_build_order', client_id: clientId, agency_id: agencyId }),
      })
      const d = await r.json()
      if (!d.ok) { setError(typeof d.error === 'string' ? d.error : 'Could not load your plan'); return }
      setPlan(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  const loadExec = useCallback(async (id) => {
    if (!id) return
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_get', client_id: clientId, agency_id: agencyId, plan_id: id }),
      })
      const d = await r.json()
      if (!d.error && d.plan) setExec(d)
    } catch {
      // Non-blocking — the ranked preview still renders without the executor.
    }
  }, [clientId, agencyId])

  // Resolve the executable plan_id from the persisted strategy, then load it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_strategy', client_id: clientId, agency_id: agencyId }),
        })
        const d = await r.json()
        const id = d?.strategy?.plan_id || null
        if (!cancelled && id) { setPlanId(id); loadExec(id) }
      } catch { /* no strategy yet — the build section just won't show */ }
    })()
    return () => { cancelled = true }
  }, [clientId, agencyId, loadExec])

  useEffect(() => { load() }, [load])

  // ── Approve + create the pages, one executor step per call (in-flow). ──────
  const approveAndBuild = useCallback(async () => {
    if (!planId) return
    setBuilding(true); setBuildNote(null)
    const call = async (action) => {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, plan_id: planId }),
      })
      return r.json()
    }
    try {
      // Approve first if it's still a draft/paused (the gate).
      const status = exec?.plan?.status
      if (status === 'draft' || status === 'paused') {
        const a = await call('plan_approve')
        if (a.error) { setBuildNote({ kind: 'error', text: a.error }); return }
      }
      // Run remaining automated steps; pause on manual/approval/failure.
      let safety = 40
      while (safety-- > 0) {
        const j = await call('plan_execute_next')
        if (j.error) { setBuildNote({ kind: 'error', text: j.error }); break }
        await loadExec(planId)
        if (!j.step) { setBuildNote({ kind: 'done', text: j.message || 'All pages created.' }); break }
        if (j.step.status === 'failed') {
          setBuildNote({ kind: 'error', text: `Stopped at step ${j.step.sequence}: ${j.step.error || 'failed'}` }); break
        }
        if (j.step.status === 'manual_required') {
          setBuildNote({ kind: 'manual', text: `Step ${j.step.sequence} needs your review: ${j.step.label}` }); break
        }
        if (j.plan_status === 'completed') { setBuildNote({ kind: 'done', text: 'All pages created.' }); break }
        if (j.plan_status === 'failed') { setBuildNote({ kind: 'error', text: 'Build failed.' }); break }
      }
    } catch (e) {
      setBuildNote({ kind: 'error', text: e?.message || 'Could not reach the server' })
    } finally {
      setBuilding(false)
    }
  }, [planId, exec, clientId, agencyId, loadExec])

  const total = plan?.total || 0
  const order = plan?.order || []
  const byBucket = plan?.by_bucket || {}
  const status = loading ? 'running' : building ? 'running' : 'waiting'

  const steps = exec?.steps || []
  const doneSteps = steps.filter(s => s.status === 'completed').length
  const planStatus = exec?.plan?.status
  const allBuilt = steps.length > 0 && doneSteps === steps.length

  return (
    <StepShell
      stepNumber={6}
      title="Your plan"
      accent="plan"
      status={status}
      subtitle="Your gaps, turned into a ranked build order — reviewed, approved, and built right here. You approve before anything publishes, and each page is created one step at a time."
      noteId="guided-plan"
      noteTitle="What this does"
      note={
        <>
          We line up the pages worth building, best opportunity first, then create them in order —
          without leaving this flow. Building a page also wires it into your site's internal links
          automatically. Nothing publishes on its own: you click <strong>Approve &amp; build</strong> first.
        </>
      }
    >
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="45%" />
        </div>
      )}

      {!loading && error && (
        <ActionCallout variant="warning" title="Couldn't load your plan" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {!loading && !error && total === 0 && (
        <EmptyState
          icon={ListChecks}
          headline="No build order yet"
          sub="Build your fast-rank strategy on the previous step to generate a ranked build order, then come back here to approve and create the pages."
          secondary={{ label: 'Back to strategy', onClick: () => {} }}
        />
      )}

      {!loading && !error && total > 0 && (
        <>
          <StatGrid columns={4}>
            <Stat value={total} label="Pages in plan" />
            <Stat value={byBucket.quick_win || 0} label="Quick wins" color={t.success} />
            <Stat value={byBucket.net_new || 0} label="Net-new" color={t.pink} />
            <Stat value={byBucket.big_bet || 0} label="Big bets" color={t.warning} isLast />
          </StatGrid>

          {/* Ranked order preview. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {order.slice(0, 10).map((p, i) => (
              <div key={p.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: t.rTile,
                border: `1px solid ${t.line}`, background: t.white,
              }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.muted, width: 22 }}>{i + 1}</span>
                <FlagChip variant={BUCKET_VARIANT[p.bucket] || 'low'}>{BUCKET_LABEL[p.bucket] || p.bucket}</FlagChip>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{p.service} in {p.city}</span>
                {p.reason && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }} title={p.reason}>
                    {p.reason}
                  </span>
                )}
              </div>
            ))}
            {order.length > 10 && (
              <span style={{ fontSize: 12, color: t.muted }}>+ {order.length - 10} more in the build order.</span>
            )}
          </div>

          {/* ── In-flow approve + create. No more eject to Page Factory. ──────── */}
          {planId ? (
            <div style={{
              border: `1px solid ${t.line}`, borderRadius: t.rCard, padding: '18px 20px',
              background: t.off, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <FlagChip variant="medium" icon={Hammer}>Approval required</FlagChip>
                {steps.length > 0 && (
                  <span style={{ fontSize: 12, color: t.muted }}>
                    {doneSteps} of {steps.length} steps done
                    {planStatus ? ` · ${planStatus}` : ''}
                  </span>
                )}
              </div>

              {/* Step timeline (compact). */}
              {steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {steps.map((st) => {
                    const v = STEP_ICON[st.status]
                    const Icon = v?.Icon
                    return (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        {Icon
                          ? <Icon size={15} color={v.color()} style={v.spin ? { animation: 'spin 1s linear infinite' } : undefined} />
                          : <span style={{ width: 15, height: 15, borderRadius: 99, border: `2px solid ${t.line}`, display: 'inline-block' }} />}
                        <span style={{ color: st.status === 'completed' ? t.muted : t.text, fontWeight: st.status === 'running' ? 600 : 400 }}>
                          {st.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {buildNote && (
                <div style={{ marginBottom: 14 }}>
                  <ActionCallout
                    variant={buildNote.kind === 'error' ? 'warning' : buildNote.kind === 'manual' ? 'info' : 'success'}
                    title={buildNote.kind === 'done' ? 'Pages created' : buildNote.kind === 'manual' ? 'Needs your review' : buildNote.kind === 'error' ? 'Build paused' : ''}
                  >
                    {buildNote.text}
                  </ActionCallout>
                </div>
              )}

              {!allBuilt && planStatus !== 'completed' && (
                <CtaButton
                  label={building ? 'Building your pages…' : (doneSteps > 0 ? 'Continue building' : `Approve & build ${total} pages`)}
                  icon={Hammer}
                  onClick={approveAndBuild}
                  disabled={building}
                  pulse={!building}
                />
              )}

              {(allBuilt || planStatus === 'completed') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color={t.success} />
                  <span style={{ fontSize: 14, color: t.text, fontWeight: 600 }}>All pages created and linked.</span>
                </div>
              )}
            </div>
          ) : (
            <ActionCallout variant="info" title="Build your strategy first">
              The executable plan is generated on the <strong>Your strategy</strong> step. Build it there,
              then come back to approve and create the pages here.
            </ActionCallout>
          )}

          <div style={{ marginTop: 8 }}>
            <NextStepLink onClick={goNext}>check what's live + cited</NextStepLink>
          </div>
        </>
      )}
    </StepShell>
  )
}
