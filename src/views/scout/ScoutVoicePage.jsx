"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing,
  Activity, Clock, TrendingUp, Loader2, RefreshCw,
  Play, Pause, X, Check, ChevronRight, ChevronDown,
  Target, Brain, Sparkles, Radio, Search, Plus, Zap,
  AlertCircle, AlertTriangle, BarChart2, DollarSign, Calendar,
  Users, Shield, FileText, Settings, Hash, Layers, Volume2,
  ArrowUpRight, Copy, Send, ExternalLink, Filter,
  Upload,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, W, FH, FB } from '../../lib/theme'

const API = '/api/scout/voice'

async function apiGet(action, params = {}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, String(v))
  const res = await fetch(url, { credentials: 'include' })
  return res.json()
}
async function apiPost(body) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
  return res.json()
}

// ── Formatting ─────────────────────────────────────────────────
function fmtDur(s) { if (!s) return '0:00'; const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}` }
function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
function fmtMoney(n) {
  if (n == null) return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}
function fmtPhone(n) {
  if (!n) return ''
  const d = String(n).replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return n
}

const STATUS_COLOR = {
  queued: '#6b7280', dialing: AMB, ringing: AMB, ivr: AMB, hold: AMB,
  speaking: GRN, voicemail: T, completed: GRN, failed: R,
  cancelled: '#6b7280', escalated: R, no_answer: '#6b7280',
}

const OUTCOME_COLOR = {
  appointment_set: GRN, qualified: T, callback: AMB, voicemail: T,
  not_interested: '#6b7280', dnc_requested: R, no_answer: '#6b7280',
  gatekeeper: AMB, wrong_contact: '#6b7280',
}

const SENTIMENT_EMOJI = { positive: '😊', Positive: '😊', neutral: '😐', Neutral: '😐', negative: '😟', Negative: '😟' }

// ── Shared small components ───────────────────────────────────
function StatCard({ label, value, icon: Icon, accent = T, sub, loading }) {
  return (
    <div style={{
      background: W, borderRadius: 14, border: '1px solid #e5e7eb',
      padding: 18, position: 'relative', overflow: 'hidden', minWidth: 140,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .75 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1 }}>
            {loading ? '—' : value}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontFamily: FH, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={accent} />
        </div>
      </div>
    </div>
  )
}

function Pill({ label, color = '#6b7280' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
      background: color + '15', color,
    }}>{label}</span>
  )
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <div style={{ background: W, borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} color={T} />}
          <h2 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: 0 }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ label }) {
  return <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: '16px 0' }}>{label}</div>
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'queue', label: 'Queue', icon: Layers },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'questions', label: 'Questions', icon: Hash },
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'setup', label: 'Setup', icon: Settings },
]

export default function ScoutVoicePage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [tab, setTab] = useState('dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: FB }}>
      <Sidebar />
      <main style={{ flex: 1, padding: isMobile ? 14 : 26, maxWidth: 1280, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Scout · Voice</div>
            <h1 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, margin: 0 }}>AI Calling Agent</h1>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0', maxWidth: 640 }}>
              Outbound prospecting that learns every call. Industry-siloed knowledge + global call patterns compose a bespoke system prompt for every dial.
            </p>
          </div>
          <Link to="/scout/dashboard" style={{
            fontSize: 12, fontWeight: 700, color: '#6b7280', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ← Scout dashboard
          </Link>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto',
          borderBottom: '1px solid #e5e7eb', paddingBottom: 0,
        }}>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', background: 'transparent',
                  border: 'none', borderBottom: active ? `2px solid ${T}` : '2px solid transparent',
                  color: active ? BLK : '#6b7280',
                  fontSize: 13, fontWeight: active ? 700 : 600,
                  fontFamily: FH, cursor: 'pointer', whiteSpace: 'nowrap',
                  marginBottom: -1,
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'dashboard' && <DashboardTab agencyId={agencyId} />}
        {tab === 'queue' && <QueueTab agencyId={agencyId} />}
        {tab === 'live' && <LiveTab agencyId={agencyId} />}
        {tab === 'calls' && <CallsTab agencyId={agencyId} />}
        {tab === 'questions' && <QuestionsTab agencyId={agencyId} />}
        {tab === 'brain' && <BrainTab agencyId={agencyId} />}
        {tab === 'analytics' && <AnalyticsTab agencyId={agencyId} />}
        {tab === 'setup' && <SetupTab agencyId={agencyId} />}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ agencyId }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [activeCalls, setActiveCalls] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    if (!agencyId) return
    const load = async () => {
      const [s, a, r] = await Promise.all([
        apiGet('get_stats', { agency_id: agencyId }),
        apiGet('get_active_calls', { agency_id: agencyId }),
        apiGet('get_calls', { agency_id: agencyId, limit: 10 }),
      ])
      setStats(s)
      setActiveCalls(a.data || [])
      setRecent(r.data || [])
      setLoading(false)
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [agencyId])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <StatCard label="Total calls" value={stats?.total_calls ?? 0} icon={Phone} accent={T} loading={loading} />
        <StatCard label="Completed today" value={stats?.completed_today ?? 0} icon={Check} accent={GRN} loading={loading} />
        <StatCard label="Queue depth" value={stats?.queue_depth ?? 0} icon={Layers} accent={AMB} loading={loading} />
        <StatCard label="Active now" value={stats?.active_now ?? 0} icon={Radio} accent={R} loading={loading} />
        <StatCard label="Appts (7d)" value={stats?.appointments_last_7d ?? 0} icon={Calendar} accent={GRN} sub={`${stats?.appointment_rate_last_7d ?? 0}% rate`} loading={loading} />
        <StatCard label="Avg duration" value={fmtDur(stats?.avg_duration_seconds || 0)} icon={Clock} accent={T} loading={loading} />
      </div>

      <Section title="Live calls" icon={Radio} action={
        <Pill label={`${activeCalls.length} active`} color={activeCalls.length ? GRN : '#6b7280'} />
      }>
        {activeCalls.length === 0 ? (
          <Empty label="No active calls right now." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeCalls.map(c => <CallRow key={c.id} call={c} live />)}
          </div>
        )}
      </Section>

      <Section title="Recent calls" icon={Clock}>
        {recent.length === 0 ? (
          <Empty label="No calls yet. Start a campaign or dial from the Queue tab." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map(c => <CallRow key={c.id} call={c} />)}
          </div>
        )}
      </Section>
    </div>
  )
}

function CallRow({ call, live }) {
  const statusColor = STATUS_COLOR[call.status] || '#6b7280'
  const outcomeColor = OUTCOME_COLOR[call.outcome] || '#6b7280'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: live ? '#fff7ed' : W, borderRadius: 10,
      border: `1px solid ${live ? '#fed7aa' : '#eef0f2'}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: statusColor + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {live ? <Radio size={15} color={statusColor} /> : <Phone size={14} color={statusColor} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {call.company_name || call.contact_name || 'Unnamed'}
          </span>
          <Pill label={call.status} color={statusColor} />
          {call.outcome && <Pill label={call.outcome.replace(/_/g, ' ')} color={outcomeColor} />}
          {call.sentiment && <span>{SENTIMENT_EMOJI[call.sentiment] || ''}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {call.industry && <span>{call.industry}</span>}
          {call.biggest_gap && <span>· Gap: {call.biggest_gap}</span>}
          {call.duration_seconds != null && <span>· {fmtDur(call.duration_seconds)}</span>}
          {call.questions_answered != null && <span>· {call.questions_answered} Qs answered</span>}
          <span>· {fmtRelative(call.ended_at || call.started_at || call.created_at)}</span>
        </div>
      </div>
      {call.appointment_set && <Pill label="Appt booked" color={GRN} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════
function QueueTab({ agencyId }) {
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState([])
  const [starting, setStarting] = useState({})

  const load = async () => {
    const r = await apiGet('get_queue', { agency_id: agencyId })
    setQueue(r.data || [])
    setLoading(false)
  }
  useEffect(() => { if (agencyId) load() }, [agencyId])

  async function start(q) {
    setStarting(s => ({ ...s, [q.scout_call_id]: true }))
    const r = await apiPost({ action: 'start_call', call_id: q.scout_call_id })
    setStarting(s => ({ ...s, [q.scout_call_id]: false }))
    if (r.error) toast.error(r.error)
    else { toast.success('Dialing…'); load() }
  }

  async function cancel(q) {
    if (!confirm('Cancel this queued call?')) return
    const r = await apiPost({ action: 'cancel_call', call_id: q.scout_call_id })
    if (r.error) toast.error(r.error)
    else { toast.success('Cancelled'); load() }
  }

  return (
    <Section title={`Queue (${queue.length})`} icon={Layers} action={
      <button onClick={load} style={btnGhost}><RefreshCw size={13} /> Refresh</button>
    }>
      {loading ? <Loader2 className="animate-spin" size={16} /> : queue.length === 0 ? (
        <Empty label="Queue is empty. Send prospects from an opportunity detail page or kick off a campaign." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: W, borderRadius: 10, border: '1px solid #eef0f2' }}>
              <div style={{ width: 28, height: 28, borderRadius: 99, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#4b5563', flexShrink: 0 }}>
                {q.priority || 3}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{q.company_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {q.industry && <span>{q.industry}</span>}
                  {q.contact_phone && <span>· {fmtPhone(q.contact_phone)}</span>}
                  {q.biggest_gap && <span>· Gap: {q.biggest_gap}</span>}
                  <span>· Queued {fmtRelative(q.created_at)}</span>
                </div>
                {q.pitch_angle && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, fontStyle: 'italic' }}>{q.pitch_angle}</div>}
              </div>
              <button onClick={() => start(q)} disabled={starting[q.scout_call_id]} style={btnPrimary}>
                {starting[q.scout_call_id] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Dial
              </button>
              <button onClick={() => cancel(q)} style={btnGhost}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// LIVE
// ═══════════════════════════════════════════════════════════════
function LiveTab({ agencyId }) {
  const [active, setActive] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agencyId) return
    const load = async () => {
      const r = await apiGet('get_active_calls', { agency_id: agencyId })
      setActive(r.data || [])
      setLoading(false)
    }
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [agencyId])

  return (
    <Section title={`Live calls (${active.length})`} icon={Radio}>
      {loading && !active.length ? <Loader2 className="animate-spin" size={16} /> : active.length === 0 ? (
        <Empty label="No calls in progress. Start one from the Queue." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(c => <CallRow key={c.id} call={c} live />)}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// CALLS
// ═══════════════════════════════════════════════════════════════
function CallsTab({ agencyId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    const r = await apiGet('get_calls', { agency_id: agencyId, status: status || undefined, limit: 100 })
    setRows(r.data || [])
    setLoading(false)
  }
  useEffect(() => { if (agencyId) load() }, [agencyId, status])

  async function openDetail(c) {
    const r = await apiGet('get_call', { id: c.id })
    setSelected(r)
  }

  return (
    <div>
      <Section title="Call history" icon={Phone} action={
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="voicemail">Voicemail</option>
            <option value="no_answer">No answer</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={load} style={btnGhost}><RefreshCw size={13} /></button>
        </div>
      }>
        {loading ? <Loader2 className="animate-spin" size={16} /> : rows.length === 0 ? (
          <Empty label="No calls yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(c => (
              <button key={c.id} onClick={() => openDetail(c)} style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                <CallRow call={c} />
              </button>
            ))}
          </div>
        )}
      </Section>

      {selected && (
        <CallDetailModal call={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function CallDetailModal({ call, onClose }) {
  const c = call?.data
  if (!c) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: W, borderRadius: 14, maxWidth: 720, width: '100%', maxHeight: '85vh',
        overflow: 'auto', padding: '24px 26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, margin: 0 }}>{c.company_name}</h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              {c.industry && <span>{c.industry}</span>}
              {c.contact_name && <span> · {c.contact_name}</span>}
              <span> · {fmtRelative(c.ended_at || c.started_at)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <MiniStat label="Status" value={c.status} />
          <MiniStat label="Duration" value={fmtDur(c.duration_seconds || 0)} />
          <MiniStat label="Outcome" value={c.outcome || '—'} />
          <MiniStat label="Appt set" value={c.appointment_set ? 'Yes' : 'No'} />
          <MiniStat label="Sentiment" value={c.sentiment || '—'} />
          <MiniStat label="Qs answered" value={`${c.questions_answered || 0} / ${c.questions_total || 0}`} />
        </div>

        {c.pitch_angle && (
          <div style={{ marginBottom: 14 }}>
            <Label>Pitch angle</Label>
            <div style={{ fontSize: 13, color: '#374151', padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2' }}>{c.pitch_angle}</div>
          </div>
        )}
        {c.biggest_gap && (
          <div style={{ marginBottom: 14 }}>
            <Label>Biggest gap</Label>
            <div style={{ fontSize: 13, color: '#374151', padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>{c.biggest_gap}</div>
          </div>
        )}

        {c.discovery_data && Object.keys(c.discovery_data).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Label>Discovery answers</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(c.discovery_data).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#6b7280', minWidth: 140 }}>{k}</span>
                  <span style={{ color: '#374151' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {c.conversation_intelligence && (
          <div style={{ marginBottom: 14 }}>
            <Label>Conversation intelligence</Label>
            <pre style={{ fontSize: 11, color: '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: 10, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2' }}>
              {JSON.stringify(c.conversation_intelligence, null, 2)}
            </pre>
          </div>
        )}

        {c.transcript && (
          <div style={{ marginBottom: 14 }}>
            <Label>Transcript</Label>
            <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2', maxHeight: 260, overflow: 'auto' }}>
              {c.transcript}
            </pre>
          </div>
        )}

        {c.recording_url && (
          <a href={c.recording_url} target="_blank" rel="noopener noreferrer" style={btnGhost}>
            <Volume2 size={14} /> Open recording
          </a>
        )}
        {c.opportunity_id && (
          <Link to={`/scout/opportunities/${c.opportunity_id}`} style={{ ...btnGhost, marginLeft: 8 }}>
            <ExternalLink size={14} /> Open opportunity
          </Link>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{value}</div>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{children}</div>
}

// ═══════════════════════════════════════════════════════════════
// QUESTIONS
// ═══════════════════════════════════════════════════════════════
function QuestionsTab({ agencyId }) {
  const [data, setData] = useState({ defaults: [], learned: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agencyId) return
    apiGet('get_questions', { agency_id: agencyId }).then(d => { setData(d); setLoading(false) })
  }, [agencyId])

  const learnedByCategory = useMemo(() => {
    const out = {}
    for (const q of data.learned || []) {
      const k = q.question_type || 'other'
      out[k] = out[k] || []
      out[k].push(q)
    }
    return out
  }, [data.learned])

  return (
    <div>
      <Section title="Discovery question library" icon={Hash} action={
        <Pill label={`${(data.learned || []).length} learned · ${(data.defaults || []).length} defaults`} color={T} />
      }>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
          The agent asks the best-performing question for each stage. As calls complete, appointment rates are
          attributed to the questions that led to them — top performers bubble up and the agent prefers them
          on the next call.
        </div>

        {loading ? <Loader2 className="animate-spin" size={16} /> : (
          <>
            {(data.learned || []).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <Label>Learned from your calls (ranked by appointment rate)</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(data.learned || []).slice(0, 20).map(q => (
                    <div key={q.id} style={{ padding: '10px 12px', background: W, borderRadius: 10, border: '1px solid #eef0f2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, fontSize: 13, color: BLK }}>{q.question_text}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6b7280' }}>
                          <span>{q.times_asked || 0} asked</span>
                          <span style={{ color: q.appointment_rate > 30 ? GRN : q.appointment_rate > 15 ? AMB : '#6b7280', fontWeight: 700 }}>{q.appointment_rate || 0}% appt</span>
                        </div>
                      </div>
                      {(q.industry_slug || q.sic_code || q.question_type) && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                          {q.question_type && <span>{q.question_type} · </span>}
                          {q.industry_slug && <span>{q.industry_slug} · </span>}
                          {q.sic_code && <span>SIC {q.sic_code}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Label>Universal defaults (applied when no learned alternative exists)</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(data.defaults || []).map((q, i) => (
                <div key={i} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #eef0f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, fontSize: 13, color: BLK }}>{q.question}</div>
                    <Pill label={q.category} color={T} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// BRAIN (knowledge base)
// ═══════════════════════════════════════════════════════════════
function BrainTab({ agencyId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('')

  useEffect(() => {
    if (!agencyId) return
    setLoading(true)
    apiGet('get_knowledge', { agency_id: agencyId, scope: scope || undefined }).then(r => {
      setRows(r.data || [])
      setLoading(false)
    })
  }, [agencyId, scope])

  const grouped = useMemo(() => {
    const out = { global_pattern: [], industry: [], sic: [], gap: [], company: [], objection: [], other: [] }
    for (const k of rows) {
      (out[k.scope] || out.other).push(k)
    }
    return out
  }, [rows])

  return (
    <Section title="Voice brain" icon={Brain} action={
      <select value={scope} onChange={e => setScope(e.target.value)} style={selectStyle}>
        <option value="">All scopes</option>
        <option value="global_pattern">Global patterns</option>
        <option value="industry">Industry</option>
        <option value="sic">SIC</option>
        <option value="gap">Gap</option>
        <option value="company">Company</option>
        <option value="objection">Objection</option>
      </select>
    }>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
        Industry-siloed knowledge plus universal call patterns. The agent composes these at dial time and gets
        smarter every call.
      </div>

      {loading ? <Loader2 className="animate-spin" size={16} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['global_pattern', 'Global patterns', Sparkles],
            ['industry', 'Industry knowledge', Target],
            ['sic', 'SIC-specific', Hash],
            ['gap', 'Gap-specific', AlertTriangle],
            ['company', 'Company-specific', Users],
            ['objection', 'Objection playbook', Shield],
          ].map(([key, label, Icon]) => {
            const items = grouped[key] || []
            if (items.length === 0) return null
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon size={13} color={T} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: BLK, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
                  <Pill label={`${items.length}`} color='#6b7280' />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.slice(0, 20).map(k => (
                    <div key={k.id} style={{ padding: '10px 12px', background: W, borderRadius: 10, border: '1px solid #eef0f2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, fontSize: 13, color: BLK, lineHeight: 1.45 }}>{k.fact}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {Math.round((k.confidence_score || 0) * 100)}% · {k.times_confirmed || 0}×
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {k.fact_category && <span>{k.fact_category}</span>}
                        {k.scope_value && <span> · {k.scope_value}</span>}
                        {k.direction && k.direction !== 'both' && <span> · {k.direction}</span>}
                        {k.agency_id === null && <span> · platform-wide</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <Empty label="Brain is empty. It fills up as calls complete and post-call analysis extracts facts." />}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
function AnalyticsTab({ agencyId }) {
  const [a, setA] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agencyId) return
    apiGet('get_analytics', { agency_id: agencyId }).then(r => { setA(r); setLoading(false) })
  }, [agencyId])

  if (loading) return <Loader2 className="animate-spin" size={16} />
  if (!a) return <Empty label="No analytics yet." />

  const industries = Object.entries(a.by_industry || {}).sort((x, y) => y[1].total - x[1].total).slice(0, 12)
  const gaps = Object.entries(a.by_gap || {}).sort((x, y) => y[1].total - x[1].total).slice(0, 12)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <StatCard label="Total dialed" value={a.total} icon={Phone} accent={T} />
        <StatCard label="Appointment rate" value={`${a.appointment_rate ?? 0}%`} icon={Calendar} accent={GRN} />
        <StatCard label="Pipeline value" value={fmtMoney(a.pipeline_value)} icon={DollarSign} accent={AMB} />
      </div>

      <Section title="By industry" icon={Target}>
        {industries.length === 0 ? <Empty label="Dial some calls to see industry breakdown." /> : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Industry</th>
                <th style={thStyle}>Calls</th>
                <th style={thStyle}>Completed</th>
                <th style={thStyle}>Appts</th>
                <th style={thStyle}>Appt rate</th>
                <th style={thStyle}>Avg duration</th>
              </tr>
            </thead>
            <tbody>
              {industries.map(([name, v]) => (
                <tr key={name} style={{ borderTop: '1px solid #eef0f2' }}>
                  <td style={tdStyle}>{name}</td>
                  <td style={tdStyle}>{v.total}</td>
                  <td style={tdStyle}>{v.completed}</td>
                  <td style={tdStyle}>{v.appointments}</td>
                  <td style={tdStyle}>{v.total ? Math.round((v.appointments / v.total) * 1000) / 10 : 0}%</td>
                  <td style={tdStyle}>{fmtDur(v.avg_duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="By gap" icon={AlertTriangle}>
        {gaps.length === 0 ? <Empty label="Dial prospects with detected gaps to see which gaps convert best." /> : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Gap</th>
                <th style={thStyle}>Calls</th>
                <th style={thStyle}>Appts</th>
                <th style={thStyle}>Appt rate</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map(([name, v]) => (
                <tr key={name} style={{ borderTop: '1px solid #eef0f2' }}>
                  <td style={tdStyle}>{name}</td>
                  <td style={tdStyle}>{v.total}</td>
                  <td style={tdStyle}>{v.appointments}</td>
                  <td style={tdStyle}>{v.total ? Math.round((v.appointments / v.total) * 1000) / 10 : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════
function SetupTab({ agencyId }) {
  const [areaCode, setAreaCode] = useState('')
  const [agentName, setAgentName] = useState('Scout SDR')
  const [gender, setGender] = useState('male')
  const [voiceId, setVoiceId] = useState('11labs-Adrian')
  const [cadence, setCadence] = useState('natural')
  const [voices, setVoices] = useState([])
  const [cadencePresets, setCadencePresets] = useState(null)
  const [steps, setSteps] = useState([])
  const [running, setRunning] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testProspect, setTestProspect] = useState(null)

  // Ingest state
  const [ingestText, setIngestText] = useState('')
  const [ingestScope, setIngestScope] = useState('global_pattern')
  const [ingestScopeValue, setIngestScopeValue] = useState('')
  const [ingestDirection, setIngestDirection] = useState('both')
  const [ingestSource, setIngestSource] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [lastIngest, setLastIngest] = useState(null)

  // PDF upload state
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfDragging, setPdfDragging] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfResult, setPdfResult] = useState(null)

  useEffect(() => {
    apiGet('get_voice_roster').then(r => setVoices(r.data || []))
    apiGet('get_cadence_presets').then(r => setCadencePresets(r.data || null))
  }, [])

  // Voice picker state extensions
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceGenderFilter, setVoiceGenderFilter] = useState('all') // all | male | female | other
  const [voiceAccentFilter, setVoiceAccentFilter] = useState('all')
  const [playingVoiceId, setPlayingVoiceId] = useState(null)
  const audioRef = useRef(null)

  // Distinct accents from the current catalog for chip filter
  const voiceAccents = useMemo(() => {
    const set = new Set()
    for (const v of voices) if (v.accent) set.add(v.accent)
    return Array.from(set).sort()
  }, [voices])

  const filteredVoices = useMemo(() => {
    const term = voiceSearch.trim().toLowerCase()
    return voices.filter(v => {
      if (voiceGenderFilter !== 'all') {
        const g = String(v.gender || '').toLowerCase()
        if (voiceGenderFilter === 'other') {
          if (g === 'male' || g === 'female') return false
        } else {
          if (g !== voiceGenderFilter) return false
        }
      }
      if (voiceAccentFilter !== 'all' && v.accent !== voiceAccentFilter) return false
      if (term) {
        const hay = `${v.name} ${v.gender} ${v.accent} ${v.style || ''} ${v.sample_note || ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [voices, voiceSearch, voiceGenderFilter, voiceAccentFilter])

  const selectedVoice = useMemo(() => voices.find(v => v.id === voiceId), [voices, voiceId])

  function playVoicePreview(v) {
    if (!v?.preview_audio_url) { toast.error('No preview available for this voice'); return }
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
      const a = new Audio(v.preview_audio_url)
      audioRef.current = a
      a.addEventListener('ended', () => setPlayingVoiceId(null))
      a.addEventListener('error', () => { toast.error('Preview failed to load'); setPlayingVoiceId(null) })
      a.play()
      setPlayingVoiceId(v.id)
    } catch (e) {
      toast.error('Could not play preview')
      setPlayingVoiceId(null)
    }
  }

  function stopVoicePreview() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    setPlayingVoiceId(null)
  }

  async function runSetup() {
    if (!areaCode) { toast.error('Enter an area code'); return }
    setRunning(true); setSteps([])
    const r = await apiPost({
      action: 'setup_scout_voice',
      agency_id: agencyId, area_code: areaCode, agent_name: agentName,
      voice_id: voiceId, cadence_preset: cadence,
    })
    setRunning(false)
    setSteps(r.steps || [])
    if (r.ready) toast.success('Setup complete — ready to dial')
    else toast.error(r.error || 'Setup failed')
  }

  async function loadTestProspects() {
    const r = await apiPost({ action: 'get_test_prospects' })
    setTestProspect((r.data || [])[0] || null)
  }

  async function runTest() {
    if (!testPhone) { toast.error('Enter a test phone number'); return }
    const p = testProspect || { company_name: 'Test Prospect', industry: 'Test', pitch_angle: 'This is a test call.' }
    const r = await apiPost({
      action: 'test_call',
      agency_id: agencyId, to_number: testPhone,
      company_name: p.company_name, industry: p.industry,
      pitch_angle: p.pitch_angle, biggest_gap: p.biggest_gap,
    })
    if (r.error) toast.error(r.error)
    else toast.success('Test call dialing')
  }

  async function ingest() {
    if (!ingestText.trim()) { toast.error('Paste some reference text first'); return }
    setIngesting(true)
    const r = await apiPost({
      action: 'ingest_knowledge',
      agency_id: agencyId,
      text: ingestText,
      scope: ingestScope,
      scope_value: ingestScopeValue || null,
      direction: ingestDirection,
      source_label: ingestSource || null,
    })
    setIngesting(false)
    if (r.error) { toast.error(r.error); return }
    setLastIngest({ inserted: r.inserted || 0, note: r.note || null, at: new Date().toISOString() })
    setIngestText('')
    toast.success(`${r.inserted || 0} fact${r.inserted === 1 ? '' : 's'} ingested`)
  }

  async function uploadPdf() {
    if (!pdfFile) { toast.error('Drop a PDF first'); return }
    if (pdfFile.size > 20 * 1024 * 1024) { toast.error('PDF must be under 20 MB'); return }
    setPdfUploading(true)
    setPdfResult(null)
    try {
      const fd = new FormData()
      fd.append('file', pdfFile)
      fd.append('agency_id', agencyId)
      fd.append('scope', ingestScope)
      if (ingestScopeValue) fd.append('scope_value', ingestScopeValue)
      fd.append('direction', ingestDirection)
      if (ingestSource) fd.append('source_label', ingestSource)
      const res = await fetch('/api/scout/voice/brain/upload', {
        method: 'POST', credentials: 'include', body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      setPdfResult(data)
      setPdfFile(null)
      toast.success(`${data.inserted || 0} fact${data.inserted === 1 ? '' : 's'} extracted from PDF`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPdfUploading(false)
    }
  }

  return (
    <div>
      <Section title="Provision Scout voice agent" icon={Settings}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
          One-click setup: creates the Retell LLM, creates the agent with your chosen voice + cadence,
          provisions a phone number in the area code you pick, and stores the IDs on your agency record.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <label>
            <Label>Agent name</Label>
            <input value={agentName} onChange={e => setAgentName(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <Label>Area code</Label>
            <input value={areaCode} onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="e.g. 305" style={inputStyle} />
          </label>
        </div>

        {/* Voice picker — searchable grid with audio previews */}
        <div style={{ marginBottom: 16 }}>
          <Label>Voice ({voices.length} available)</Label>

          {/* Search + filter row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={voiceSearch}
              onChange={e => setVoiceSearch(e.target.value)}
              placeholder="Search voices by name, accent, or style..."
              style={{ ...inputStyle, maxWidth: 320, flex: 1, minWidth: 200 }}
            />
            {['all', 'male', 'female', 'other'].map(g => {
              const active = voiceGenderFilter === g
              return (
                <button
                  key={g}
                  onClick={() => setVoiceGenderFilter(g)}
                  style={{
                    padding: '6px 12px', borderRadius: 99,
                    background: active ? BLK : W, color: active ? W : '#4b5563',
                    border: active ? 'none' : '1px solid #e5e7eb',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FH,
                    textTransform: 'capitalize',
                  }}
                >{g}</button>
              )
            })}
            {voiceAccents.length > 1 && (
              <select value={voiceAccentFilter} onChange={e => setVoiceAccentFilter(e.target.value)} style={selectStyle}>
                <option value="all">All accents</option>
                {voiceAccents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

          {voices.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: '#9ca3af', background: '#fafbfc', borderRadius: 8, border: '1px solid #eef0f2' }}>
              <Loader2 size={13} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Loading voices from Retell...
            </div>
          ) : filteredVoices.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              No voices match — try widening the filter.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8,
              maxHeight: 360,
              overflowY: 'auto',
              padding: 4,
              border: '1px solid #eef0f2',
              borderRadius: 10,
              background: '#fafbfc',
            }}>
              {filteredVoices.map(v => {
                const active = voiceId === v.id
                const playing = playingVoiceId === v.id
                const gender = String(v.gender || '').toLowerCase()
                const genderColor = gender === 'male' ? T : gender === 'female' ? R : '#6b7280'
                return (
                  <div
                    key={v.id}
                    onClick={() => setVoiceId(v.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: active ? `2px solid ${T}` : '1px solid #e5e7eb',
                      background: active ? T + '08' : W,
                      cursor: 'pointer',
                      transition: 'all .12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.name}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          playing ? stopVoicePreview() : playVoicePreview(v)
                        }}
                        disabled={!v.preview_audio_url}
                        title={!v.preview_audio_url ? 'No preview available' : playing ? 'Stop preview' : 'Play preview'}
                        style={{
                          width: 28, height: 28, borderRadius: 99,
                          background: playing ? R : v.preview_audio_url ? T : '#e5e7eb',
                          color: v.preview_audio_url ? '#fff' : '#9ca3af',
                          border: 'none',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: v.preview_audio_url ? 'pointer' : 'not-allowed',
                          flexShrink: 0,
                        }}
                      >
                        {playing ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 99, background: genderColor + '15', color: genderColor, fontWeight: 700, textTransform: 'capitalize', fontSize: 10 }}>{v.gender || 'neutral'}</span>
                      {v.accent && <span style={{ fontSize: 11 }}>· {v.accent}</span>}
                      {v.style && <span style={{ fontSize: 11 }}>· {v.style}</span>}
                    </div>
                    {v.sample_note && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {v.sample_note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {selectedVoice && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              Selected: <b style={{ color: BLK }}>{selectedVoice.name}</b> ({selectedVoice.gender || 'neutral'}, {selectedVoice.accent || 'unknown accent'})
            </div>
          )}
        </div>

        {/* Cadence preset */}
        <div style={{ marginBottom: 16 }}>
          <Label>Cadence / inflection</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {['relaxed', 'natural', 'energetic', 'formal'].map(preset => {
              const active = cadence === preset
              const meta = cadencePresets?.[preset]
              return (
                <button
                  key={preset}
                  onClick={() => setCadence(preset)}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: active ? BLK + '08' : W, color: BLK,
                    border: active ? `2px solid ${T}` : '1px solid #e5e7eb',
                    cursor: 'pointer', textAlign: 'left', fontFamily: FB,
                  }}
                >
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, textTransform: 'capitalize' }}>{preset}</div>
                  {meta && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      {meta.style}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={runSetup} disabled={running} style={btnPrimary}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Run one-click setup
        </button>
        {steps.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ padding: '8px 12px', background: s.ok ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${s.ok ? '#bbf7d0' : '#fecaca'}`, fontSize: 12 }}>
                {s.ok ? <Check size={12} color={GRN} /> : <X size={12} color={R} />} <b>{s.step}</b> {s.error && `— ${s.error}`}
                {s.phone_number && ` — ${s.phone_number}`}
                {s.agent_id && ` — ${s.agent_id.slice(0, 12)}…`}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Test call" icon={Phone} action={
        <button onClick={loadTestProspects} style={btnGhost}>Load test prospect</button>
      }>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Dial your own phone to hear the agent in action. The agent will use the test prospect context below.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <label>
            <Label>To (your phone, E.164)</Label>
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+13055551234" style={inputStyle} />
          </label>
        </div>
        {testProspect && (
          <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2', fontSize: 13, marginBottom: 12 }}>
            <b>{testProspect.company_name}</b> · {testProspect.industry} · Gap: {testProspect.biggest_gap}<br />
            <i style={{ color: '#6b7280' }}>{testProspect.pitch_angle}</i>
          </div>
        )}
        <button onClick={runTest} style={btnPrimary}><Play size={14} /> Dial test</button>
      </Section>

      <Section title="Ingest reference material" icon={Brain}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
          Upload PDFs or paste text from cold-calling playbooks, objection-handling guides, industry sales
          notes, coaching transcripts. Claude Haiku extracts discrete, actionable facts into the brain so
          every call reads from them at dial time.
        </div>

        {/* PDF drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setPdfDragging(true) }}
          onDragLeave={() => setPdfDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setPdfDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) { if (/\.pdf$/i.test(f.name)) setPdfFile(f); else toast.error('PDF files only') }
          }}
          style={{
            border: `2px dashed ${pdfDragging ? T : '#d1d5db'}`,
            borderRadius: 10,
            padding: 18,
            background: pdfDragging ? T + '08' : '#fafbfc',
            textAlign: 'center',
            marginBottom: 14,
            transition: 'all .15s',
          }}
        >
          <input
            id="scout-brain-pdf-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f) }}
            style={{ display: 'none' }}
          />
          {pdfFile ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>{pdfFile.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{(pdfFile.size / 1024).toFixed(0)} KB</div>
              </div>
              <button onClick={uploadPdf} disabled={pdfUploading} style={btnPrimary}>
                {pdfUploading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Extract facts from PDF
              </button>
              <button onClick={() => setPdfFile(null)} disabled={pdfUploading} style={btnGhost}>
                <X size={12} /> Remove
              </button>
            </div>
          ) : (
            <label htmlFor="scout-brain-pdf-input" style={{ cursor: 'pointer', display: 'block' }}>
              <FileText size={20} color="#9ca3af" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
                Drop a PDF here <span style={{ color: '#9ca3af', fontWeight: 400 }}>or click to pick a file</span>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Max 20 MB · uses the scope + direction settings below</div>
            </label>
          )}
        </div>

        {pdfResult && (
          <div style={{ padding: 10, background: pdfResult.inserted ? '#f0fdf4' : '#fffbeb', border: `1px solid ${pdfResult.inserted ? '#bbf7d0' : '#fde68a'}`, borderRadius: 8, fontSize: 12, color: pdfResult.inserted ? '#047857' : '#92400e', marginBottom: 14 }}>
            <b>{pdfResult.inserted}</b> fact{pdfResult.inserted === 1 ? '' : 's'} extracted
            {pdfResult.extracted_text_chars ? ` · ${pdfResult.extracted_text_chars.toLocaleString()} chars parsed` : ''}
            {pdfResult.note ? ` · ${pdfResult.note}` : ''}
            {pdfResult.blob_url && (
              <>
                {' · '}<a href={pdfResult.blob_url} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'underline' }}>source file</a>
              </>
            )}
            {pdfResult.blob_skipped && (
              <div style={{ marginTop: 4, color: '#9a6b00', fontSize: 11 }}>
                Note: source file was not archived to Blob ({pdfResult.blob_skipped}). Extraction still ran.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label>
            <Label>Scope</Label>
            <select value={ingestScope} onChange={e => setIngestScope(e.target.value)} style={inputStyle}>
              <option value="global_pattern">Global pattern (all calls)</option>
              <option value="industry">Industry-specific</option>
              <option value="sic">SIC-specific</option>
              <option value="gap">Gap-specific</option>
              <option value="objection">Objection playbook</option>
            </select>
          </label>
          <label>
            <Label>Scope value</Label>
            <input
              value={ingestScopeValue}
              onChange={e => setIngestScopeValue(e.target.value)}
              placeholder={ingestScope === 'global_pattern' ? 'leave blank' : ingestScope === 'industry' ? 'e.g. HVAC' : ingestScope === 'sic' ? 'e.g. 1711' : 'value'}
              style={inputStyle}
              disabled={ingestScope === 'global_pattern'}
            />
          </label>
          <label>
            <Label>Direction</Label>
            <select value={ingestDirection} onChange={e => setIngestDirection(e.target.value)} style={inputStyle}>
              <option value="both">Both (inbound + outbound)</option>
              <option value="outbound_only">Outbound only (Scout)</option>
              <option value="inbound_only">Inbound only (Answering)</option>
            </select>
          </label>
          <label>
            <Label>Source label (optional)</Label>
            <input value={ingestSource} onChange={e => setIngestSource(e.target.value)} placeholder="e.g. Fanatical Prospecting ch. 4" style={inputStyle} />
          </label>
        </div>

        <textarea
          value={ingestText}
          onChange={e => setIngestText(e.target.value)}
          placeholder="Paste the reference text here. Can be up to ~60,000 characters — extract the meat of a playbook, a chapter, an industry report, a coaching transcript, etc. Claude will pull out up to 25 high-leverage facts per pass."
          rows={10}
          style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button onClick={ingest} disabled={ingesting || !ingestText.trim()} style={btnPrimary}>
            {ingesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Extract and ingest
          </button>
          {lastIngest && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Last run: <strong>{lastIngest.inserted}</strong> facts ingested {lastIngest.note ? `— ${lastIngest.note}` : ''}
            </span>
          )}
        </div>

        <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2', fontSize: 12, color: '#6b7280' }}>
          <b>Example scopes:</b> for "objections specific to HVAC contractors," set scope=<code>industry</code>, value=<code>HVAC</code>, direction=<code>both</code>. For universal cold-call opening tactics, scope=<code>global_pattern</code>.
        </div>
      </Section>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', background: BLK, color: W,
  border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 700, fontFamily: FH,
  cursor: 'pointer',
}
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', background: W, color: '#4b5563',
  border: '1px solid #e5e7eb', borderRadius: 8,
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer', textDecoration: 'none',
}
const selectStyle = {
  padding: '6px 10px', fontSize: 12, fontWeight: 600,
  borderRadius: 7, border: '1px solid #e5e7eb', background: W, color: '#4b5563',
}
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  borderRadius: 8, border: '1px solid #e5e7eb', background: W,
  fontFamily: FB,
}
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '8px 10px', fontSize: 11,
  fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em',
  borderBottom: '1px solid #eef0f2',
}
const tdStyle = { padding: '8px 10px', color: '#374151' }
