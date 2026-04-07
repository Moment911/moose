"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, BarChart2, Check, CheckCircle, ChevronRight,
  Clock, Code2, FileText, Loader2, Play, RefreshCw, Shield, Wrench,
  TrendingUp, X, Zap, Mail, MessageSquare, Phone, ArrowRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const R   = '#ea2729'
const T   = '#5bc6d0'
const BLK = '#0a0a0a'
const GRY = '#f2f2f0'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const TABS = ['Test Runner', 'Error Log', 'Repair Center', 'Communications', 'Reports', 'History']
const TAB_ICONS = [Play, AlertCircle, Wrench, Mail, BarChart2, Clock]
const QA_CSS = `@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`

function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function QAConsolePage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const isMobile = useMobile()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(false)

  // Test Runner state
  const [suites, setSuites] = useState([])
  const [selectedSuites, setSelectedSuites] = useState([])
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [selfHealMode, setSelfHealMode] = useState(false)
  const [deploying, setDeploying] = useState(false)

  // Error Log state
  const [errors, setErrors] = useState([])

  // Repair Center state
  const [repairs, setRepairs] = useState([])

  // Communications state
  const [comms, setComms] = useState([])
  const [commsStats, setCommsStats] = useState({ emails24h: 0, sms24h: 0, failed24h: 0, total24h: 0 })
  const [commsFilter, setCommsFilter] = useState('all')

  // Reports state
  const [metrics, setMetrics] = useState([])
  const [healthScore, setHealthScore] = useState({ health_score: 0, pass_rate: 0, open_errors: 0 })

  // History state
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [runDetails, setRunDetails] = useState([])

  useEffect(() => { loadSuites() }, [])
  useEffect(() => { loadTabData() }, [tab, commsFilter])

  async function loadSuites() {
    try {
      const res = await fetch('/api/qa?action=suites')
      const data = await res.json()
      setSuites(data)
      setSelectedSuites(data.map(s => s.key))
    } catch {}
  }

  async function loadTabData() {
    setLoading(true)
    try {
      if (tab === 1) {
        const res = await fetch('/api/qa?action=errors&resolved=false')
        setErrors(await res.json())
      } else if (tab === 2) {
        const res = await fetch('/api/qa?action=repairs')
        setRepairs(await res.json())
      } else if (tab === 3) {
        const [commsRes, statsRes] = await Promise.all([
          fetch(`/api/qa?action=comms${commsFilter !== 'all' ? `&channel=${commsFilter}` : ''}`),
          fetch('/api/qa?action=comms_stats'),
        ])
        setComms(await commsRes.json())
        setCommsStats(await statsRes.json())
      } else if (tab === 4) {
        const [metricsRes, healthRes] = await Promise.all([
          fetch('/api/qa?action=metrics'),
          fetch('/api/qa?action=health_score'),
        ])
        setMetrics(await metricsRes.json())
        setHealthScore(await healthRes.json())
      } else if (tab === 5) {
        const res = await fetch('/api/qa?action=runs')
        setRuns(await res.json())
      }
    } catch {}
    setLoading(false)
  }

  async function startRun() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_run', suites: selectedSuites }),
      })
      const data = await res.json()
      setRunResult(data)

      if (!data || data.error) {
        toast.error(data?.error || 'Test run failed')
      } else if (data.failed > 0) {
        // Show failure count toast
        toast(`${data.passed}/${data.total} passed — ${data.failed} failed`, { icon: '⚠️' })

        // Auto-heal if enabled
        if (selfHealMode) {
          try {
            const healRes = await fetch('/api/qa', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'auto_heal_run' }),
            })
            const healData = await healRes.json()
            toast.success(`Self-Heal: ${healData.total} errors processed, ${healData.healed} auto-resolved, ${healData.pending} need review`, { duration: 5000 })
          } catch {
            toast.error('Self-heal failed to run')
          }
        }
      } else if (data.total > 0) {
        toast.success(`All ${data.total} tests passed — platform healthy`)
      }
    } catch (e) {
      setRunResult({ error: 'Failed to run tests' })
      toast.error('Failed to run tests')
    }
    setRunning(false)
  }

  async function triggerDeploy() {
    setDeploying(true)
    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_deploy' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Deploy triggered! Check Vercel dashboard.')
      } else {
        toast.error(data.error || 'Deploy failed')
      }
    } catch {
      toast.error('Failed to trigger deploy')
    }
    setDeploying(false)
  }

  async function selfHeal(errorId) {
    try {
      await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'self_heal', error_id: errorId }),
      })
      loadTabData()
    } catch {}
  }

  async function resolveError(errorId) {
    try {
      await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_error', error_id: errorId }),
      })
      loadTabData()
    } catch {}
  }

  async function viewRunDetails(runId) {
    setSelectedRun(runId)
    try {
      const res = await fetch(`/api/qa?action=results&run_id=${runId}`)
      setRunDetails(await res.json())
    } catch {}
  }

  const toggleSuite = (key) => {
    setSelectedSuites(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  /* ── Shared sub-components ────────────────────────────────────────────── */
  function SuiteCheckbox({ suite }) {
    const checked = selectedSuites.includes(suite.key)
    return (
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderRadius: 10, cursor: 'pointer', border: '1px solid #ececea',
        background: checked ? R + '08' : '#fff', transition: 'all .15s',
      }}>
        <input type="checkbox" checked={checked} onChange={() => toggleSuite(suite.key)}
          style={{ accentColor: R }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>{suite.name}</div>
          <div style={{ fontSize: 11, color: '#9a9a96' }}>{suite.testCount} tests</div>
        </div>
      </label>
    )
  }

  function ResultBadge({ status }) {
    const c = status === 'pass' ? GRN : status === 'fail' ? R : status === 'warn' ? AMB : '#6b7280'
    return (
      <span style={{
        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
        background: c + '15', color: c, textTransform: 'uppercase', letterSpacing: '.05em',
      }}>
        {status}
      </span>
    )
  }

  function HealthBar({ score }) {
    const c = score >= 80 ? GRN : score >= 50 ? AMB : R
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#ececea', overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: c, borderRadius: 4, transition: 'width .5s ease' }} />
        </div>
        <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: c }}>{score}%</span>
      </div>
    )
  }

  const channelIcon = (ch) => ch === 'email' ? Mail : ch === 'sms' ? MessageSquare : Phone
  const statusColor = (s) => s === 'delivered' || s === 'sent' ? GRN : s === 'failed' || s === 'bounced' ? R : AMB

  /* ── Tab content ──────────────────────────────────────────────────────── */
  function renderTab() {
    if (tab === 0) return renderTestRunner()
    if (tab === 1) return renderErrorLog()
    if (tab === 2) return renderRepairCenter()
    if (tab === 3) return renderCommunications()
    if (tab === 4) return renderReports()
    if (tab === 5) return renderHistory()
  }

  /* ── Test Runner ──────────────────────────────────────────────────────── */
  function renderTestRunner() {
    return (
      <div>
        {/* Suite selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Test Suites</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedSuites(suites.map(s => s.key))}
                style={{ fontSize: 11, color: T, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Select All</button>
              <button onClick={() => setSelectedSuites([])}
                style={{ fontSize: 11, color: '#9a9a96', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {suites.map(s => <SuiteCheckbox key={s.key} suite={s} />)}
          </div>
        </div>

        {/* Run button */}
        <button onClick={startRun} disabled={running || selectedSuites.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px',
            borderRadius: 10, border: 'none', cursor: running ? 'wait' : 'pointer',
            background: R, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH,
            opacity: running || selectedSuites.length === 0 ? .6 : 1,
            boxShadow: `0 4px 14px ${R}40`, marginBottom: 24,
          }}>
          {running ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
          {running ? 'Running Tests...' : `Run ${selectedSuites.length} Suite${selectedSuites.length !== 1 ? 's' : ''}`}
        </button>

        {/* Results */}
        {runResult && !runResult.error && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
            {/* Summary bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Run Complete</div>
                <HealthBar score={runResult.health_score} />
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, fontFamily: FH, fontWeight: 700 }}>
                <span style={{ color: GRN }}>{runResult.passed} passed</span>
                <span style={{ color: R }}>{runResult.failed} failed</span>
                <span style={{ color: '#9a9a96' }}>{runResult.duration_ms}ms</span>
              </div>
            </div>
            {/* Individual results */}
            <div style={{ padding: '8px 12px' }}>
              {(runResult.results || []).map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                  borderBottom: i < runResult.results.length - 1 ? '1px solid #f8f8f6' : 'none',
                }}>
                  {r.status === 'pass'
                    ? <CheckCircle size={15} color={GRN} />
                    : <X size={15} color={R} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginRight: 8 }}>[{r.suite}]</span>
                    <span style={{ fontSize: 13, color: BLK, fontFamily: FB }}>{r.test_name}</span>
                  </div>
                  <ResultBadge status={r.status} />
                  <span style={{ fontSize: 11, color: '#9a9a96', fontFamily: 'monospace' }}>{r.duration_ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {runResult && runResult.error && (
          <div style={{ background: R + '10', border: `1px solid ${R}30`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ color: R, fontFamily: FH, fontWeight: 700, fontSize: 14 }}>{runResult.error}</div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Error Log ────────────────────────────────────────────────────────── */
  function renderErrorLog() {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Open Errors</div>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: R + '15', color: R }}>{errors.length}</span>
        </div>
        <div style={{ padding: '4px 12px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : errors.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontFamily: FB, fontSize: 13 }}>
              <CheckCircle size={24} color={GRN} style={{ marginBottom: 8 }} /><br />
              No open errors
            </div>
          ) : errors.map(err => (
            <div key={err.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: err.severity === 'critical' ? R : err.severity === 'high' ? '#f97316' : AMB, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontFamily: FB, color: BLK, marginBottom: 4 }}>{err.message}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: '#f2f2f0', color: '#6b7280', textTransform: 'uppercase' }}>{err.suite || 'unknown'}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: (err.severity === 'critical' ? R : AMB) + '15', color: err.severity === 'critical' ? R : AMB, textTransform: 'uppercase' }}>{err.severity}</span>
                  <span style={{ fontSize: 11, color: '#9a9a96' }}>{timeAgo(err.created_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => selfHeal(err.id)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: 'none', background: T + '15', color: T, cursor: 'pointer' }}>
                  <Zap size={11} /> Heal
                </button>
                <button onClick={() => resolveError(err.id)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: 'none', background: GRN + '15', color: GRN, cursor: 'pointer' }}>
                  <Check size={11} /> Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Repair Center ────────────────────────────────────────────────────── */
  function renderRepairCenter() {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Repair History</div>
        </div>
        <div style={{ padding: '4px 12px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : repairs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontFamily: FB, fontSize: 13 }}>
              No repairs yet
            </div>
          ) : repairs.map(rep => {
            const sc = rep.status === 'applied' ? GRN : rep.status === 'failed' ? R : rep.status === 'rolled_back' ? AMB : '#6b7280'
            return (
              <div key={rep.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: sc + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wrench size={14} color={sc} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: FB, color: BLK, marginBottom: 4 }}>{rep.description}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: '#f2f2f0', color: '#6b7280', textTransform: 'uppercase' }}>{rep.repair_type}</span>
                    <ResultBadge status={rep.status} />
                    {rep.auto && <span style={{ fontSize: 10, fontWeight: 700, color: T }}>AUTO</span>}
                    <span style={{ fontSize: 11, color: '#9a9a96' }}>{timeAgo(rep.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Communications ───────────────────────────────────────────────────── */
  function renderCommunications() {
    return (
      <div>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Emails (24h)', value: commsStats.emails24h, icon: Mail, color: T },
            { label: 'SMS (24h)', value: commsStats.sms24h, icon: MessageSquare, color: GRN },
            { label: 'Failed (24h)', value: commsStats.failed24h, icon: AlertCircle, color: R },
            { label: 'Total (24h)', value: commsStats.total24h, icon: Activity, color: BLK },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, opacity: .7, borderRadius: '14px 14px 0 0' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} color={s.color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['all', 'email', 'sms', 'voice'].map(f => (
            <button key={f} onClick={() => setCommsFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: FH,
                background: commsFilter === f ? BLK : '#f2f2f0',
                color: commsFilter === f ? '#fff' : '#6b7280',
              }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Log table */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Communications Log</div>
          </div>
          <div style={{ padding: '4px 12px' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : comms.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontFamily: FB, fontSize: 13 }}>
                No communications logged yet
              </div>
            ) : comms.map(c => {
              const Icon = channelIcon(c.channel)
              const sColor = statusColor(c.status)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: sColor + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={sColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontFamily: FB, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.subject || c.body_preview || c.recipient}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a9a96' }}>
                      {c.channel} to {c.recipient} {c.provider ? `via ${c.provider}` : ''}
                    </div>
                  </div>
                  <ResultBadge status={c.status} />
                  <span style={{ fontSize: 11, color: '#9a9a96', flexShrink: 0 }}>{timeAgo(c.created_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Reports ──────────────────────────────────────────────────────────── */
  function renderReports() {
    return (
      <div>
        {/* Health overview */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 24, marginBottom: 20 }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Platform Health</div>
          <HealthBar score={healthScore.health_score || 0} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pass Rate</div>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK }}>{healthScore.pass_rate || 0}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Open Errors</div>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: healthScore.open_errors > 0 ? R : GRN }}>{healthScore.open_errors || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Last Check</div>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK }}>{timeAgo(healthScore.snapshot_at) || '—'}</div>
            </div>
          </div>
        </div>

        {/* Metrics history */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Health History</div>
          </div>
          <div style={{ padding: '8px 12px' }}>
            {metrics.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontFamily: FB, fontSize: 13 }}>
                No metrics recorded yet. Run a test to generate data.
              </div>
            ) : metrics.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: i < metrics.length - 1 ? '1px solid #f8f8f6' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: (m.health_score >= 80 ? GRN : m.health_score >= 50 ? AMB : R) + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: m.health_score >= 80 ? GRN : m.health_score >= 50 ? AMB : R }}>{m.health_score}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: FH, fontWeight: 700, color: BLK }}>
                    Pass rate: {m.pass_rate}% &middot; {m.open_errors} open errors
                  </div>
                  <div style={{ fontSize: 11, color: '#9a9a96' }}>{timeAgo(m.snapshot_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── History ──────────────────────────────────────────────────────────── */
  function renderHistory() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Runs list */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Test Runs</div>
          </div>
          <div style={{ padding: '4px 12px' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : runs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Play size={24} color="#d0d0cc" style={{ marginBottom: 8 }} />
                <div style={{ color: '#9a9a96', fontFamily: FB, fontSize: 13, marginBottom: 12 }}>
                  No test runs yet
                </div>
                <button onClick={() => { setTab(0) }}
                  style={{ fontSize: 12, fontWeight: 700, color: R, background: R + '10', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: FH }}>
                  Go to Test Runner →
                </button>
              </div>
            ) : runs.map(run => {
              const sc = run.health_score >= 80 ? GRN : run.health_score >= 50 ? AMB : R
              const pct = run.total_tests > 0 ? Math.round((run.passed / run.total_tests) * 100) : 0
              return (
                <div key={run.id} onClick={() => viewRunDetails(run.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 10px',
                    borderBottom: '1px solid #f8f8f6', cursor: 'pointer',
                    background: selectedRun === run.id ? '#f8f8f6' : 'transparent',
                    borderRadius: 8, transition: 'background .12s',
                  }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: sc + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: sc }}>{run.health_score}%</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 700, color: BLK }}>
                        {run.passed}/{run.total_tests} passed
                      </span>
                      {run.failed > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: R + '15', color: R }}>{run.failed} failed</span>
                      )}
                    </div>
                    {/* Pass rate bar */}
                    <div style={{ height: 4, borderRadius: 2, background: '#ececea', overflow: 'hidden', marginBottom: 4, maxWidth: 180 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: sc, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9a9a96' }}>
                      {run.triggered_by} · {run.duration_ms}ms · {timeAgo(run.completed_at || run.started_at)}
                    </div>
                  </div>
                  <ChevronRight size={14} color="#9a9a96" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Run details */}
        {selectedRun && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Run Details</div>
              <button onClick={() => { setSelectedRun(null); setRunDetails([]) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a96' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '4px 12px' }}>
              {runDetails.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: i < runDetails.length - 1 ? '1px solid #f8f8f6' : 'none' }}>
                  {r.status === 'pass' ? <CheckCircle size={15} color={GRN} /> : <X size={15} color={R} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginRight: 6 }}>[{r.suite}]</span>
                    <span style={{ fontSize: 13, fontFamily: FB, color: BLK }}>{r.test_name}</span>
                    {r.message && <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>{r.message}</div>}
                  </div>
                  <ResultBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Main render ──────────────────────────────────────────────────────── */
  return (
    <div className="page-shell" style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: GRY, fontFamily: FB,
    }}>
      <style>{QA_CSS}</style>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: BLK, padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em' }}>
                QA Console
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '4px 0 0', fontFamily: FB }}>
                Platform testing, error tracking, communications monitoring
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Self-heal toggle */}
              <button onClick={() => setSelfHealMode(m => !m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 8, border: selfHealMode ? `1px solid ${GRN}50` : '1px solid rgba(255,255,255,.15)',
                  cursor: 'pointer', background: selfHealMode ? GRN + '18' : 'rgba(255,255,255,.06)',
                  color: selfHealMode ? GRN : 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, fontFamily: FH,
                  transition: 'all .2s',
                }}>
                {selfHealMode && <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, boxShadow: `0 0 8px ${GRN}`, animation: 'pulse 2s infinite' }} />}
                <Shield size={13} />
                Self-Heal {selfHealMode ? 'ON' : 'OFF'}
              </button>
              {/* Deploy button */}
              <button onClick={triggerDeploy} disabled={deploying}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                  borderRadius: 8, border: '1px solid rgba(255,255,255,.15)',
                  cursor: deploying ? 'wait' : 'pointer', background: 'rgba(255,255,255,.06)',
                  color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: 700, fontFamily: FH,
                  opacity: deploying ? 0.5 : 1,
                }}>
                {deploying ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                Deploy
              </button>
              {/* Run all */}
              <button onClick={() => { startRun() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
                }}>
                <Play size={14} /> Quick Run All
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t, i) => {
              const Icon = TAB_ICONS[i]
              return (
                <button key={t} onClick={() => setTab(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: tab === i ? 700 : 500, fontFamily: FH,
                    color: tab === i ? '#fff' : 'rgba(255,255,255,.4)',
                    background: 'transparent',
                    borderBottom: tab === i ? `2px solid ${R}` : '2px solid transparent',
                    transition: 'all .15s',
                  }}>
                  <Icon size={14} />
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {renderTab()}
        </div>
      </div>
    </div>
  )
}
