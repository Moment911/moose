"use client"
import { useEffect, useState, useRef } from 'react'
import { Layers, CheckCircle, XCircle, Loader2, Play, Users, FileText, RefreshCw, Map, Zap } from 'lucide-react'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const OPERATIONS = [
  { key: 'on_page_audit',    label: 'Run On-Page Audit',       detail: 'Scan every client\'s pages for technical + content issues.', icon: FileText, color: T },
  { key: 'brief_generation', label: 'Generate Content Briefs', detail: 'Top 10 gap keywords per client → AI-written briefs.',      icon: Zap, color: R },
  { key: 'content_refresh',  label: 'Content Refresh',         detail: 'Rebuild content inventory + refresh plan for all.',        icon: RefreshCw, color: AMB },
  { key: 'topical_map',      label: 'Topical Map Update',      detail: 'Regenerate topical authority map across portfolio.',       icon: Map, color: GRN },
  { key: 'full_sync',        label: 'Full Sync',               detail: 'Pull Search Console + GA4 + Ads data for everyone.',       icon: RefreshCw, color: BLK },
]

export default function BulkOperationsTab({ agencyId, clients = [] }) {
  const [operation, setOperation] = useState('on_page_audit')
  const [selectedIds, setSelectedIds] = useState(() => clients.map(c => c.id))
  const [starting, setStarting] = useState(false)
  const [runId, setRunId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  // Sync client selection when clients prop changes
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.length === 0 && clients.length > 0) return clients.map(c => c.id)
      return prev.filter(id => clients.some(c => c.id === id))
    })
  }, [clients])

  // Poll status when a run is active
  useEffect(() => {
    if (!runId) return
    const poll = async () => {
      try {
        const res = await fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_bulk_operation_status', bulk_run_id: runId }),
        })
        const j = await res.json()
        if (res.ok) setStatus(j)
        // Stop polling when everyone is terminal
        if (j?.status === 'complete' || (j?.in_progress === 0 && j?.total > 0)) {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {}
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [runId])

  const toggleClient = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectAll = () => setSelectedIds(clients.map(c => c.id))
  const selectNone = () => setSelectedIds([])

  const startBulk = async () => {
    if (!agencyId) { setError('Agency context missing'); return }
    if (selectedIds.length === 0) { setError('Select at least one client'); return }
    setError(null)
    setStarting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_bulk_operation',
          agency_id: agencyId,
          operation,
          client_ids: selectedIds,
          options: {},
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to start')
      setRunId(j.bulk_run_id)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const selected = OPERATIONS.find(o => o.key === operation)
  const pct = status && status.total ? Math.round(((status.completed + status.failed) / status.total) * 100) : 0

  return (
    <div>
      <HowItWorks tool="bulk_ops" />

      {/* Scope banner */}
      <div style={{
        background: `linear-gradient(135deg, ${T}12, ${T}04)`,
        border: `1px solid #ececef`, borderRadius: 12, padding: '14px 18px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Users size={20} color="#0a0a0a" />
        <div>
          <div style={{ fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>Agency-wide operations</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Run a KotoIQ task across many clients at once. Progress shown per-client, real-time.
          </div>
        </div>
      </div>

      {/* Operation selector */}
      <div style={{ marginBottom: 24 }}>
        <div style={sectionLabel}>Choose operation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {OPERATIONS.map(op => {
            const active = op.key === operation
            const Icon = op.icon
            return (
              <button key={op.key} onClick={() => setOperation(op.key)} style={{
                textAlign: 'left', padding: '16px', borderRadius: 12, cursor: 'pointer',
                border: active ? `2px solid ${op.color}` : '1px solid #e5e7eb',
                background: active ? op.color + '0d' : '#fff',
                transition: 'all .1s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={16} color={op.color} />
                  <div style={{ fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, color: BLK }}>{op.label}</div>
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{op.detail}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={sectionLabel}>Clients ({selectedIds.length} of {clients.length} selected)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={selectAll} style={miniBtn}>Select All</button>
            <button onClick={selectNone} style={miniBtn}>Select None</button>
          </div>
        </div>
        <div style={{
          maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 12,
          background: '#fff', padding: 8,
        }}>
          {clients.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No clients available.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4 }}>
              {clients.map(c => {
                const on = selectedIds.includes(c.id)
                return (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                    cursor: 'pointer', background: on ? '#f0f9ff' : 'transparent',
                    fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                  }}>
                    <input type="checkbox" checked={on} onChange={() => toggleClient(c.id)} />
                    <span style={{ flex: 1, color: BLK, fontWeight: on ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Start button */}
      <button onClick={startBulk} disabled={starting || selectedIds.length === 0 || !agencyId}
        style={{
          padding: '14px 28px', borderRadius: 12, border: 'none',
          background: starting || selectedIds.length === 0 ? '#94a3b8' : (selected?.color || T),
          color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: starting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: starting ? 'none' : `0 6px 18px ${(selected?.color || T)}33`,
          marginBottom: 24,
        }}>
        {starting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
        {starting ? 'Starting…' : `Start Bulk Operation (${selectedIds.length} clients)`}
      </button>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Progress panel */}
      {status && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#0a0a0a" /> Progress
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              {status.completed} complete · {status.failed} failed · {status.in_progress} in progress
            </div>
          </div>
          {/* Bar */}
          <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{
              width: pct + '%', height: '100%',
              background: `linear-gradient(90deg, ${T}, ${GRN})`,
              transition: 'width .4s',
            }} />
          </div>
          {/* Per-client grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
            {(status.clients || []).map((c, i) => {
              const badge = c.status === 'complete' ? { bg: '#dcfce7', fg: GRN, icon: CheckCircle }
                : c.status === 'failed' ? { bg: '#fee2e2', fg: '#dc2626', icon: XCircle }
                : c.status === 'running' ? { bg: '#dbeafe', fg: '#2563eb', icon: Loader2 }
                : { bg: '#f1f5f9', fg: '#64748b', icon: Loader2 }
              const Icon = badge.icon
              const summary = Object.entries(c.result_summary || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')
              return (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb',
                  background: c.status === 'complete' ? '#f0fdf4' : c.status === 'failed' ? '#fef2f2' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 999, background: badge.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={13} color={badge.fg} style={c.status === 'running' || c.status === 'queued' ? { animation: 'spin 1s linear infinite' } : undefined} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.error ? c.error : summary || c.status}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const sectionLabel = {
  fontSize: 12, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#334155',
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10,
}
const miniBtn = {
  padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: BLK,
}
