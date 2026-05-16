"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wrench, Zap, RefreshCw, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Koto Design tokens (DESIGN.md) ─────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK     = '#201b51'
const DIM     = '#4a4674'
const MID     = '#6b6789'
const HAIR    = '#e8e6ef'
const SUBHAIR = '#F0ECE8'
const SOFT    = '#f5f3ee'
const PINK    = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const SUCCESS = '#16A34A'
const WARNING = '#D97706'
const DANGER  = '#DC2626'
const INFO    = '#2563EB'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const SEVERITY_META = {
  high:   { label: 'High',   color: DANGER, bg: 'rgba(220, 38, 38, 0.08)' },
  medium: { label: 'Medium', color: WARNING, bg: 'rgba(217, 119, 6, 0.08)' },
  low:    { label: 'Low',    color: MID,    bg: SOFT },
}

const STATUS_META = {
  pending:   { label: 'Pending',   color: MID,     Icon: Clock },
  approved:  { label: 'Approved',  color: INFO,    Icon: CheckCircle2 },
  running:   { label: 'Running',   color: PINK,    Icon: Loader2 },
  completed: { label: 'Completed', color: SUCCESS, Icon: CheckCircle2 },
  failed:    { label: 'Failed',    color: DANGER,  Icon: XCircle },
  rejected:  { label: 'Rejected',  color: MID,     Icon: XCircle },
  snoozed:   { label: 'Snoozed',   color: MID,     Icon: Clock },
}

const SOURCE_LABEL = {
  recommendation:    'Recommendation',
  schema_audit:      'Schema audit',
  technical_deep:    'Technical audit',
  content_inventory: 'Content health',
  eeat_audit:        'E-E-A-T',
  page_diff:         'Page diff',
  manual:            'Manual',
}

const FIX_TYPE_LABEL = {
  regenerate_brief:  'Regenerate brief',
  apply_schema:      'Apply schema',
  add_internal_link: 'Internal linking',
  refresh_content:   'Refresh content',
  mark_done:         'Mark done',
  manual:            'Manual',
}

async function api(action, body) {
  const r = await fetch('/api/kotoiq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return r.json()
}

function formatPath(url) {
  if (!url) return ''
  try { return new URL(url).pathname || '/' } catch { return url }
}

function relative(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60);     if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24);     if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─────────────────────────────────────────────────────────────
export default function AutoFixQueueTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [runningBatch, setRunningBatch] = useState(false)
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [statusFilter, setStatusFilter] = useState('open')   // 'open'=pending+approved; or specific
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const refresh = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await api('autofix_list', { client_id: clientId, limit: 300 })
      setItems(res.items || [])
      setCounts(res.counts || {})
    } catch {
      toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { refresh() }, [refresh])

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (statusFilter === 'open') {
        if (i.status !== 'pending' && i.status !== 'approved') return false
      } else if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false
      if (sourceFilter !== 'all' && i.source_type !== sourceFilter) return false
      return true
    })
  }, [items, statusFilter, severityFilter, sourceFilter])

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id))
  const someFilteredSelected = filtered.some(i => selected.has(i.id))

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }

  const runScan = async () => {
    setScanning(true)
    try {
      const r = await api('autofix_scan', { client_id: clientId, agency_id: agencyId })
      if (r.error) throw new Error(r.error)
      const skipped = Number(r.skipped || 0)
      const failed  = Number(r.failed  || 0)
      const parts = [`${r.inserted} new`]
      if (skipped) parts.push(`${skipped} already queued`)
      if (failed)  parts.push(`${failed} failed`)
      const msg = `Scan complete — ${parts.join(', ')}`
      // Surface failures distinctly so silent insert errors don't hide
      if (failed > 0) {
        toast.error(msg + (r.errors?.[0] ? `: ${r.errors[0]}` : ''))
      } else {
        toast.success(msg)
      }
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Scan failed')
    } finally { setScanning(false) }
  }

  const approveSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Nothing selected')
    const r = await api('autofix_approve', { ids })
    if (r.error) return toast.error(r.error)
    toast.success(`Approved ${r.approved} fix${r.approved === 1 ? '' : 'es'}`)
    setSelected(new Set())
    await refresh()
  }
  const rejectSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Nothing selected')
    if (!confirm(`Reject ${ids.length} fix${ids.length === 1 ? '' : 'es'}?`)) return
    const r = await api('autofix_reject', { ids })
    if (r.error) return toast.error(r.error)
    toast.success(`Rejected ${r.rejected}`)
    setSelected(new Set())
    await refresh()
  }
  const snoozeSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Nothing selected')
    const r = await api('autofix_snooze', { ids, days: 7 })
    if (r.error) return toast.error(r.error)
    toast.success(`Snoozed ${r.snoozed} for 7 days`)
    setSelected(new Set())
    await refresh()
  }

  const runApproved = async () => {
    if (!confirm(`Run up to 5 approved fixes now? Each one dispatches an existing engine.`)) return
    setRunningBatch(true)
    try {
      const r = await api('autofix_run', { client_id: clientId, agency_id: agencyId, limit: 5 })
      if (r.error) throw new Error(r.error)
      const okCount = (r.results || []).filter(x => x.ok).length
      const failCount = (r.results || []).filter(x => !x.ok).length
      toast.success(`Ran ${r.ran}: ${okCount} succeeded, ${failCount} failed`)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Batch run failed')
    } finally { setRunningBatch(false) }
  }

  const hasApproved = (counts.approved || 0) > 0

  return (
    <div style={{ fontFamily: BODY, color: INK, paddingBottom: 60 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Wrench size={20} color={PINK} />
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              Auto-Fix Queue
            </h1>
          </div>
          <div style={{ fontSize: 13, color: DIM, maxWidth: 700, lineHeight: 1.5 }}>
            Every fix this client needs, surfaced from audits and recommendations. Approve in batch, then run — each fix dispatches an existing KotoIQ engine.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={refresh} disabled={loading} title="Refresh queue"
            style={ghostButton}>
            <RefreshCw size={14} />
          </button>
          <button onClick={runScan} disabled={scanning || !clientId}
            style={{ ...secondaryButton, opacity: scanning ? 0.6 : 1 }}
            title="Re-scan audits for new findings">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            {scanning ? 'Scanning…' : 'Scan for fixes'}
          </button>
          <button onClick={runApproved} disabled={runningBatch || !hasApproved}
            style={{ ...primaryButton, opacity: (runningBatch || !hasApproved) ? 0.5 : 1 }}
            title={hasApproved ? 'Dispatch up to 5 approved fixes' : 'No approved fixes to run'}>
            {runningBatch ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {runningBatch ? 'Running…' : `Run approved${hasApproved ? ` (${counts.approved})` : ''}`}
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Kpi label="Pending"   value={counts.pending || 0}   accent={MID} />
        <Kpi label="Approved"  value={counts.approved || 0}  accent={INFO} />
        <Kpi label="Running"   value={counts.running || 0}   accent={PINK} />
        <Kpi label="Completed" value={counts.completed || 0} accent={SUCCESS} />
        <Kpi label="Failed"    value={counts.failed || 0}    accent={DANGER} />
        <Kpi label="High sev"  value={counts.high || 0}      accent={DANGER} />
      </div>

      {/* ── Filter bar + batch actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 14px', marginBottom: 12,
        background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
        boxShadow: CARD_SHADOW,
      }}>
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}
          options={[
            ['open', 'Open (pending + approved)'],
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['running', 'Running'],
            ['completed', 'Completed'],
            ['failed', 'Failed'],
            ['rejected', 'Rejected'],
            ['snoozed', 'Snoozed'],
            ['all', 'All'],
          ]} />
        <FilterSelect label="Severity" value={severityFilter} onChange={setSeverityFilter}
          options={[
            ['all', 'All severities'],
            ['high', 'High'],
            ['medium', 'Medium'],
            ['low', 'Low'],
          ]} />
        <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter}
          options={[
            ['all', 'All sources'],
            ['recommendation', 'Recommendation'],
            ['schema_audit', 'Schema audit'],
            ['technical_deep', 'Technical audit'],
            ['content_inventory', 'Content health'],
            ['eeat_audit', 'E-E-A-T'],
          ]} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {someFilteredSelected ? (
            <>
              <span style={{ fontSize: 12, color: DIM }}>{selected.size} selected</span>
              <button onClick={approveSelected} style={miniPrimary}>Approve</button>
              <button onClick={snoozeSelected} style={miniGhost}>Snooze 7d</button>
              <button onClick={rejectSelected} style={miniDanger}>Reject</button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: MID }}>{filtered.length} shown</span>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div style={{
          padding: '60px 24px', textAlign: 'center',
          background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
        }}>
          <Wrench size={28} color={MID} style={{ marginBottom: 14 }} />
          <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 400, color: INK, marginBottom: 6 }}>
            {items.length === 0 ? 'No fixes queued yet' : 'Nothing matches that filter'}
          </div>
          <div style={{ fontSize: 13, color: DIM, marginBottom: 18, maxWidth: 480, margin: '0 auto 18px', lineHeight: 1.55 }}>
            {items.length === 0
              ? 'Click “Scan for fixes” to pull findings from your audits, schema check, content health, and E-E-A-T into one triage queue.'
              : 'Try clearing filters above or running a fresh scan to surface more.'}
          </div>
          {items.length === 0 && (
            <button onClick={runScan} disabled={scanning} style={primaryButton}>
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
              {scanning ? 'Scanning…' : 'Scan for fixes'}
            </button>
          )}
        </div>
      )}

      {/* ── Header row (select-all) ── */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleSelectAll}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: MID, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Select all visible
          </span>
        </div>
      )}

      {/* ── Queue list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(item => (
          <QueueRow
            key={item.id}
            item={item}
            selected={selected.has(item.id)}
            onToggle={() => toggleSelect(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
function Kpi({ label, value, accent }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: `1px solid ${HAIR}`,
      padding: '10px 14px', boxShadow: CARD_SHADOW,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 400, color: accent || INK, letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  )
}

function QueueRow({ item, selected, onToggle }) {
  const [open, setOpen] = useState(false)
  const sev = SEVERITY_META[item.severity] || SEVERITY_META.medium
  const stat = STATUS_META[item.status] || STATUS_META.pending
  const StatusIcon = stat.Icon

  return (
    <div style={{
      background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
      padding: '12px 14px', boxShadow: CARD_SHADOW,
      borderLeft: `3px solid ${sev.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ marginTop: 4, cursor: 'pointer' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: sev.bg, color: sev.color,
              letterSpacing: '.04em', textTransform: 'uppercase',
            }}>
              {sev.label}
            </span>
            <span style={{ fontSize: 11, color: MID }}>
              {SOURCE_LABEL[item.source_type] || item.source_type}
            </span>
            <span style={{ fontSize: 11, color: MID }}>·</span>
            <span style={{ fontSize: 11, color: MID }}>
              {FIX_TYPE_LABEL[item.fix_type] || item.fix_type}
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon size={12} color={stat.color} className={item.status === 'running' ? 'animate-spin' : ''} />
              <span style={{ fontSize: 11, fontWeight: 600, color: stat.color }}>{stat.label}</span>
            </span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.35, marginBottom: 2 }}>
            {item.title}
          </div>

          {item.target_url && (
            <a href={item.target_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: MID, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {formatPath(item.target_url)} <ExternalLink size={9} />
            </a>
          )}

          {(item.detail || item.estimated_impact) && (
            <button onClick={() => setOpen(o => !o)}
              style={{
                marginTop: 6, background: 'transparent', border: 'none', padding: 0,
                color: MID, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: BODY,
              }}>
              {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Details
            </button>
          )}

          {open && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: SOFT, borderRadius: 6, fontSize: 12, color: DIM, lineHeight: 1.5 }}>
              {item.detail && <div style={{ marginBottom: item.estimated_impact ? 6 : 0 }}>{item.detail}</div>}
              {item.estimated_impact && (
                <div><span style={{ color: INK, fontWeight: 600 }}>Impact: </span>{item.estimated_impact}</div>
              )}
              {item.result && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${SUBHAIR}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MID, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    Last run
                  </div>
                  <div style={{ color: item.result.ok ? SUCCESS : DANGER }}>
                    {item.result.message || (item.result.ok ? 'OK' : 'Failed')}
                  </div>
                </div>
              )}
            </div>
          )}

          {(item.completed_at || item.approved_at) && (
            <div style={{ fontSize: 10, color: MID, marginTop: 6 }}>
              {item.completed_at
                ? `Completed ${relative(item.completed_at)}`
                : `Approved ${relative(item.approved_at)}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 8,
      background: SOFT, border: `1px solid ${HAIR}`,
      fontSize: 12, color: DIM, cursor: 'pointer',
    }}>
      <span style={{ color: MID, fontWeight: 500 }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          border: 'none', background: 'transparent', outline: 'none',
          fontFamily: BODY, fontSize: 12, fontWeight: 600, color: INK, cursor: 'pointer',
        }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

// ─── Button primitives ──────────────────────────────────────
const baseBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  border: 'none', borderRadius: 8, padding: '8px 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: BODY,
}
const primaryButton   = { ...baseBtn, background: PINK,  color: '#fff' }
const secondaryButton = { ...baseBtn, background: '#fff', color: INK, border: `1px solid ${HAIR}` }
const ghostButton     = { ...baseBtn, background: '#fff', color: MID, border: `1px solid ${HAIR}`, padding: '8px 10px' }
const miniPrimary = { ...baseBtn, background: PINK, color: '#fff', padding: '5px 10px', fontSize: 11 }
const miniGhost   = { ...baseBtn, background: '#fff', color: INK, border: `1px solid ${HAIR}`, padding: '5px 10px', fontSize: 11 }
const miniDanger  = { ...baseBtn, background: '#fff', color: DANGER, border: `1px solid ${DANGER}40`, padding: '5px 10px', fontSize: 11 }
