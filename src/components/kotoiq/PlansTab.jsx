"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Target, Plus, Play, Pause, Archive, CheckCircle, Loader2, AlertTriangle,
  ChevronRight, Clock, X, Sparkles, FileText, Wrench, Eye, Hand,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, BLK, GRN, AMB, DST } from '../../lib/theme'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const card = { background: '#fff', borderRadius: 16, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }
const subCard = { background: '#fafafa', borderRadius: 12, border: '1px solid #ececef', padding: '14px 16px' }

const STEP_KIND_ICON = {
  research: Eye, strategy: Target, analyze: Sparkles, brief: FileText,
  page: FileText, publish: Play, audit: Wrench, approval: Hand, manual: Hand,
}

const STATUS_COLOR = {
  // plan statuses
  draft: '#6b7280', approved: '#0a0a0a', running: R, paused: AMB,
  completed: GRN, failed: DST, archived: '#9ca3af',
  // step statuses
  pending: '#9ca3af', ready: '#0a0a0a',
  skipped: '#9ca3af', blocked: DST, manual_required: AMB,
}

function Pill({ label, color, bg }) {
  const c = color || '#0a0a0a'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, fontFamily: SF,
      color: c, background: bg || `${c}14`, border: `1px solid ${c}33`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{label}</span>
  )
}

function StatusPill({ status }) {
  const color = STATUS_COLOR[status] || '#6b7280'
  return <Pill label={status.replace(/_/g, ' ')} color={color} />
}

// ── New-plan inline form ─────────────────────────────────────────────
function NewPlanForm({ clientId, agencyId, onCreated, onCancel }) {
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!goal.trim()) return toast.error('Describe the goal first')
    setBusy(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_create', client_id: clientId, agency_id: agencyId, goal }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Plan drafted')
      onCreated && onCreated(j.plan_id)
    } catch (e) {
      toast.error(e.message || 'Could not draft plan')
    } finally { setBusy(false) }
  }
  return (
    <div style={{ ...card, border: `2px solid ${R}33` }}>
      <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={16} color={R} /> New Plan
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 10 }}>
        State the outcome you want. Be specific about services, geography, and timeframe — the planner uses that to pick concrete steps.
      </div>
      <textarea
        value={goal} onChange={e => setGoal(e.target.value)}
        placeholder="e.g. Grow Acme Plumbing's local visibility across Austin metro in Q3 — focus on water heater repair and drain cleaning."
        rows={4}
        style={{
          width: '100%', padding: '12px 14px', border: '1px solid #ececef', borderRadius: 8,
          fontSize: 13, fontFamily: SF, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10,
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={busy} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
          border: 'none', background: '#0a0a0a', color: '#fff', fontSize: 13, fontWeight: 700,
          fontFamily: SF, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
          {busy ? 'Drafting…' : 'Draft Plan'}
        </button>
        <button onClick={onCancel} disabled={busy} style={{
          padding: '10px 16px', borderRadius: 8, border: '1px solid #ececef',
          background: '#fff', fontSize: 13, fontWeight: 600, fontFamily: SF, cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Step row in the timeline ─────────────────────────────────────────
function StepRow({ step }) {
  const Icon = STEP_KIND_ICON[step.kind] || ChevronRight
  const depsLabel = Array.isArray(step.depends_on) && step.depends_on.length > 0
    ? `after #${step.depends_on.join(', #')}`
    : null
  return (
    <div style={{ ...subCard, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#fff', border: '1px solid #ececef',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={BLK} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: SF }}>#{step.sequence}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: SF }}>{step.label}</span>
            <StatusPill status={step.status} />
            {step.action && (
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'ui-monospace, monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                {step.action}
              </span>
            )}
          </div>
          {step.description && (
            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6, lineHeight: 1.5 }}>
              {step.description}
            </div>
          )}
          {depsLabel && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{depsLabel}</div>
          )}
          {step.error && (
            <div style={{ fontSize: 12, color: DST, marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <AlertTriangle size={12} style={{ marginTop: 2 }} />
              <span>{step.error}</span>
            </div>
          )}
          {step.artifact_ref && (
            <div style={{ fontSize: 11, color: GRN, marginTop: 6 }}>
              → {step.artifact_kind || 'output'}: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>{step.artifact_ref}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Detail view: a single plan + its step timeline ────────────────────
function PlanDetail({ planId, clientId, agencyId, onChange, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_get', client_id: clientId, agency_id: agencyId, plan_id: planId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
    } catch (e) {
      toast.error(e.message || 'Could not load plan')
    } finally { setLoading(false) }
  }, [planId, clientId, agencyId])

  useEffect(() => { load() }, [load])

  const call = async (action, extra = {}) => {
    setBusy(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, plan_id: planId, ...extra }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      return j
    } finally { setBusy(false) }
  }

  const approve = async () => {
    try { await call('plan_approve'); toast.success('Plan approved'); await load(); onChange && onChange() }
    catch (e) { toast.error(e.message) }
  }
  const pause = async () => {
    try { await call('plan_pause'); toast.success('Plan paused'); await load(); onChange && onChange() }
    catch (e) { toast.error(e.message) }
  }
  const archive = async () => {
    if (!confirm('Archive this plan? It will be hidden from the active list.')) return
    try { await call('plan_archive'); toast.success('Plan archived'); await load(); onChange && onChange(); onClose && onClose() }
    catch (e) { toast.error(e.message) }
  }
  const runNext = async () => {
    try {
      const j = await call('plan_execute_next')
      if (j.step) {
        if (j.step.status === 'completed') toast.success(`Step #${j.step.sequence}: ${j.step.label} — done`)
        else if (j.step.status === 'failed') toast.error(`Step #${j.step.sequence} failed: ${j.step.error}`)
        else if (j.step.status === 'manual_required') toast(`Step #${j.step.sequence}: needs human action`, { icon: '🖐' })
      } else if (j.message) toast(j.message)
      await load(); onChange && onChange()
    } catch (e) { toast.error(e.message) }
  }
  const runRemaining = async () => {
    if (!confirm('Run all remaining automated steps in sequence? Manual/approval steps will pause execution.')) return
    let safety = 30
    // eslint-disable-next-line no-constant-condition
    while (safety-- > 0) {
      try {
        const j = await call('plan_execute_next')
        await load()
        if (!j.step) { toast(j.message || 'Done'); break }
        if (j.step.status === 'failed' || j.step.status === 'manual_required') {
          if (j.step.status === 'failed') toast.error(`Stopped at step #${j.step.sequence}: ${j.step.error}`)
          else toast(`Paused at step #${j.step.sequence}: needs manual action`, { icon: '🖐' })
          break
        }
        if (j.plan_status === 'completed' || j.plan_status === 'failed') {
          toast(`Plan ${j.plan_status}`); break
        }
      } catch (e) { toast.error(e.message); break }
    }
    onChange && onChange()
  }

  if (loading && !data) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: BLK }} />
      </div>
    )
  }
  if (!data) return null
  const { plan, steps } = data
  const canApprove = plan.status === 'draft' || plan.status === 'paused'
  const canRun = plan.status === 'approved' || plan.status === 'running'
  const canPause = plan.status === 'running' || plan.status === 'approved'
  const canArchive = plan.status !== 'archived'
  const summary = (plan.meta && plan.meta.cost_usd != null)
    ? `${plan.meta.model || 'planner'} · $${(plan.meta.cost_usd).toFixed(4)}`
    : null

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <StatusPill status={plan.status} />
            {summary && <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: SF }}>{summary}</span>}
          </div>
          <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 800, color: BLK, marginBottom: 4 }}>
            {plan.goal}
          </div>
          {plan.summary && (
            <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{plan.summary}</div>
          )}
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280',
        }} aria-label="Close detail"><X size={18} /></button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #ececef' }}>
        {canApprove && (
          <button onClick={approve} disabled={busy} style={btnPrimary(busy)}>
            <CheckCircle size={14} /> Approve
          </button>
        )}
        {canRun && (
          <>
            <button onClick={runNext} disabled={busy} style={btnPrimary(busy)}>
              <Play size={14} /> Run next step
            </button>
            <button onClick={runRemaining} disabled={busy} style={btnSecondary(busy)}>
              Run remaining
            </button>
          </>
        )}
        {canPause && (
          <button onClick={pause} disabled={busy} style={btnSecondary(busy)}>
            <Pause size={14} /> Pause
          </button>
        )}
        {canArchive && (
          <button onClick={archive} disabled={busy} style={btnGhost(busy)}>
            <Archive size={14} /> Archive
          </button>
        )}
      </div>

      <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Timeline — {steps.length} step{steps.length === 1 ? '' : 's'}
      </div>
      {steps.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>No steps in this plan.</div>}
      {steps.map(st => <StepRow key={st.id} step={st} />)}
    </div>
  )
}

function btnPrimary(busy) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
    border: 'none', background: '#0a0a0a', color: '#fff', fontSize: 12, fontWeight: 700,
    fontFamily: SF, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
  }
}
function btnSecondary(busy) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
    border: '1px solid #ececef', background: '#fff', color: BLK, fontSize: 12, fontWeight: 700,
    fontFamily: SF, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
  }
}
function btnGhost(busy) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
    border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12, fontWeight: 600,
    fontFamily: SF, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
  }
}

// ── List row ─────────────────────────────────────────────────────────
function PlanListRow({ plan, active, onClick }) {
  const counts = plan.step_counts || {}
  const done = (counts.completed || 0) + (counts.skipped || 0)
  const total = counts.total || 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const created = plan.created_at ? new Date(plan.created_at).toLocaleDateString() : ''
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 12,
      border: active ? `2px solid ${R}` : '1px solid #ececef',
      background: active ? `${R}08` : '#fff', cursor: 'pointer', marginBottom: 8,
      fontFamily: SF,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <StatusPill status={plan.status} />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{created}</span>
        {total > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>
            {done}/{total} · {pct}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: BLK, lineHeight: 1.4, marginBottom: 4 }}>
        {plan.goal}
      </div>
      {plan.summary && (
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {plan.summary}
        </div>
      )}
      {total > 0 && (
        <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? GRN : R, transition: 'width 240ms' }} />
        </div>
      )}
    </button>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────
export default function PlansTab({ clientId, agencyId }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_list', client_id: clientId, agency_id: agencyId, status: statusFilter }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setPlans(j.plans || [])
    } catch (e) {
      toast.error(e.message || 'Could not load plans')
    } finally { setLoading(false) }
  }, [clientId, agencyId, statusFilter])

  useEffect(() => { load() }, [load])

  if (!clientId) {
    return <div style={{ ...card, color: '#6b7280' }}>Select a client to view their plans.</div>
  }

  const filters = ['all', 'draft', 'approved', 'running', 'paused', 'completed', 'archived']

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: SF, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={20} color={R} /> Plans
          </div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>
            Goal-shaped workflows that chain research, strategy, generation, and publishing into one approvable plan.
          </div>
        </div>
        <button onClick={() => setShowNew(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
          border: 'none', background: showNew ? '#fff' : '#0a0a0a',
          color: showNew ? BLK : '#fff',
          boxShadow: showNew ? 'inset 0 0 0 1px #ececef' : 'none',
          fontSize: 13, fontWeight: 700, fontFamily: SF, cursor: 'pointer',
        }}>
          {showNew ? <X size={14} /> : <Plus size={14} />}
          {showNew ? 'Cancel' : 'New Plan'}
        </button>
      </div>

      {showNew && (
        <NewPlanForm
          clientId={clientId} agencyId={agencyId}
          onCreated={(id) => { setShowNew(false); setSelectedId(id); load() }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Status filter row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} style={{
            padding: '6px 12px', borderRadius: 999, fontFamily: SF, fontSize: 12, fontWeight: 700,
            border: '1px solid #ececef', cursor: 'pointer',
            background: statusFilter === f ? '#0a0a0a' : '#fff',
            color: statusFilter === f ? '#fff' : BLK,
            textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {/* List + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? 'minmax(280px, 360px) 1fr' : '1fr', gap: 14, alignItems: 'flex-start' }}>
        <div>
          {loading && plans.length === 0 && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: BLK }} />
            </div>
          )}
          {!loading && plans.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>
              <div style={{ marginBottom: 8 }}><Clock size={20} style={{ opacity: 0.5 }} /></div>
              No plans yet. Click <strong>New Plan</strong> to draft one, or ask KotoBrain to build one for you.
            </div>
          )}
          {plans.map(p => (
            <PlanListRow
              key={p.id}
              plan={p}
              active={p.id === selectedId}
              onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
            />
          ))}
        </div>
        {selectedId && (
          <PlanDetail
            key={selectedId}
            planId={selectedId}
            clientId={clientId}
            agencyId={agencyId}
            onChange={load}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
