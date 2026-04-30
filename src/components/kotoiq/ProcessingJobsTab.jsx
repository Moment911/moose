"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Clock, Loader2, CheckCircle, XCircle, AlertCircle, Play, Pause, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'queued', label: 'Queued' },
  { key: 'complete', label: 'Complete' },
  { key: 'failed', label: 'Failed' },
]

function StatusBadge({ status }) {
  const cfg = {
    complete: { color: GRN, icon: CheckCircle, label: 'Complete' },
    completed: { color: GRN, icon: CheckCircle, label: 'Complete' },
    running: { color: T, icon: Loader2, label: 'Running' },
    queued: { color: AMB, icon: Pause, label: 'Queued' },
    failed: { color: R, icon: XCircle, label: 'Failed' },
    error: { color: R, icon: XCircle, label: 'Error' },
  }[status] || { color: '#8e8e93', icon: Clock, label: status || 'Unknown' }
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
      background: cfg.color + '14', color: cfg.color,
    }}>
      <Icon size={11} style={status === 'running' ? { animation: 'spin 1s linear infinite' } : {}} />
      {cfg.label}
    </span>
  )
}

function elapsed(startedAt, completedAt) {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const s = Math.floor((end - start) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export default function ProcessingJobsTab({ clientId, agencyId }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [tick, setTick] = useState(0)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const body = { action: 'get_processing_jobs', client_id: clientId }
      if (statusFilter !== 'all') body.status = statusFilter
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      setJobs(j.jobs || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [clientId, statusFilter])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5s when a job is running — and tick every 1s to refresh elapsed
  const anyRunning = jobs.some(j => j.status === 'running')
  useEffect(() => {
    if (!anyRunning) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(() => {
      load()
      setTick(t => t + 1)
    }, 5000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [anyRunning, load])

  // Live-elapsed ticker (1s) when running jobs exist
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [anyRunning])

  return (
    <div>
      <HowItWorks tool="jobs" />

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={30} color={T} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Background Jobs</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Live visibility into long-running processing jobs across every engine.</div>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
          fontSize: 12, fontWeight: 700, color: '#1f1f22', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${statusFilter === f.key ? T : '#ececef'}`,
            background: statusFilter === f.key ? '#f1f1f6' : '#fff',
            color: statusFilter === f.key ? T : '#6b6b70',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div style={card}>
        {loading && jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color={T} /></div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#1f1f22', fontSize: 13 }}>
            <Clock size={32} color="#d1d5db" style={{ marginBottom: 8 }} /><br />
            No jobs found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.slice(0, 50).map((j, i) => {
              const total = Number(j.total_urls || 0)
              const processed = Number(j.processed_urls || 0)
              const pct = total > 0 ? Math.min(100, Math.round(processed / total * 100)) : 0
              const hasErrors = j.errors?.length > 0 || j.error_count > 0
              const isOpen = expanded === j.id
              return (
                <div key={j.id || i} style={{
                  border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff',
                }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : j.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, alignItems: 'center',
                      width: '100%', padding: '12px 14px', background: isOpen ? '#f9f9fb' : '#fff',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: T, background: '#f1f1f6',
                          padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.04em',
                        }}>{j.engine || 'engine'}</span>
                        <StatusBadge status={j.status} />
                        {hasErrors && <span style={{ fontSize: 11, color: R, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}><AlertCircle size={11} /> errors</span>}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6b6b70' }}>
                        Started {j.started_at ? new Date(j.started_at).toLocaleString() : (j.created_at ? new Date(j.created_at).toLocaleString() : '—')}
                      </div>
                    </div>

                    <div style={{ minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#1f1f22', fontWeight: 700, marginBottom: 3 }}>
                        <span>{processed.toLocaleString()} / {total.toLocaleString()}</span>
                        <span>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: '#f1f1f6', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: j.status === 'failed' ? R : j.status === 'complete' || j.status === 'completed' ? GRN : T, transition: 'width .3s' }} />
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#1f1f22', fontFamily: FH, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                      {elapsed(j.started_at || j.created_at, j.completed_at)}
                    </div>

                    <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                      {isOpen ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
                    </div>

                    <span style={{ display: 'none' }}>{tick}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '12px 14px', background: '#fafafb', borderTop: '1px solid #e5e7eb' }}>
                      {j.metadata && Object.keys(j.metadata).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#1f1f22', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Metadata</div>
                          <pre style={{
                            margin: 0, padding: 10, background: '#0f172a', color: '#e2e8f0',
                            fontSize: 11, fontFamily: 'Menlo,Monaco,monospace', borderRadius: 6,
                            overflow: 'auto', maxHeight: 180,
                          }}>{JSON.stringify(j.metadata, null, 2)}</pre>
                        </div>
                      )}
                      {Array.isArray(j.errors) && j.errors.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Errors ({j.errors.length})</div>
                          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#1f1f22', maxHeight: 200, overflowY: 'auto' }}>
                            {j.errors.map((err, k) => <li key={k}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>)}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 11, color: '#6b6b70', fontWeight: 600 }}>
                        <span>Batch: {j.batch_size ?? '—'}</span>
                        <span>Concurrency: {j.concurrency ?? '—'}</span>
                        {j.completed_at && <span>Completed: {new Date(j.completed_at).toLocaleString()}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
