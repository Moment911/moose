"use client"
import { useState, useEffect } from 'react'
import {
  Shield, Phone, Plus, RefreshCw, Loader2, Check, X, Clock, Users,
  BarChart2, FileText, ChevronRight, ChevronDown, Settings, Search,
  AlertTriangle, Zap, Target, Activity, DollarSign, ArrowUpRight,
  Radio, Play, Pause, PhoneOff, Globe, Brain, Hash, Layers, Filter,
  TrendingUp, AlertCircle, CheckCircle, Send, Copy, ArrowLeft
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const W = '#ffffff'
const API = '/api/vob'

async function apiGet(action, params = {}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
}

const card = { background: W, borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }
const cardInner = { ...card, padding: '20px 24px' }

const STATUS_COLORS = {
  queued: { bg: '#f3f4f6', color: '#6b7280', label: 'Queued' },
  dialing: { bg: T + '12', color: T, label: 'Dialing' },
  ivr: { bg: AMB + '12', color: AMB, label: 'IVR' },
  hold: { bg: '#fef3c7', color: '#92400e', label: 'On Hold' },
  speaking: { bg: GRN + '12', color: GRN, label: 'Speaking' },
  completed: { bg: GRN + '12', color: GRN, label: 'Complete' },
  failed: { bg: R + '12', color: R, label: 'Failed' },
  escalated: { bg: R + '12', color: R, label: 'Escalated' },
  cancelled: { bg: '#f3f4f6', color: '#9ca3af', label: 'Cancelled' },
}

const PRIORITY_COLORS = {
  1: { bg: R + '12', color: R, label: 'URGENT' },
  2: { bg: AMB + '12', color: AMB, label: 'HIGH' },
  3: { bg: T + '12', color: T, label: 'MEDIUM' },
  5: { bg: '#f3f4f6', color: '#6b7280', label: 'NORMAL' },
}

export default function VOBAgentPage() {
  const { agencyId } = useAuth()
  // Persist tab in URL so it survives refresh
  const [tab, setTab] = (() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const initial = params?.get('tab') || 'dashboard'
    const [t, setter] = useState(initial)
    const wrappedSet = (v) => {
      setter(v)
      const url = new URL(window.location.href)
      url.searchParams.set('tab', v)
      window.history.replaceState({}, '', url.toString())
    }
    return [t, wrappedSet]
  })()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [calls, setCalls] = useState([])
  const [queue, setQueue] = useState([])
  const [carriers, setCarriers] = useState([])
  const [questions, setQuestions] = useState([])
  const [activeCalls, setActiveCalls] = useState([])
  const [knowledge, setKnowledge] = useState([])

  // Modals
  const [showQueueModal, setShowQueueModal] = useState(false)
  const [newCall, setNewCall] = useState({ patient_id: '', carrier_name: '', level_of_care: 'RTC', priority: 5 })
  const [qFilter, setQFilter] = useState('all')
  const [qSearch, setQSearch] = useState('')
  const [selectedCall, setSelectedCall] = useState(null)

  useEffect(() => { loadAll() }, [])

  // Auto-refresh active calls
  useEffect(() => {
    if (tab !== 'live' && tab !== 'dashboard') return
    const interval = setInterval(() => {
      apiGet('get_active_calls', { agency_id: agencyId }).then(r => setActiveCalls(r.data || []))
    }, 5000)
    return () => clearInterval(interval)
  }, [tab, agencyId])

  async function loadAll() {
    setLoading(true)
    const [statsRes, callsRes, queueRes, carriersRes, questionsRes, activeRes, knowledgeRes] = await Promise.all([
      apiGet('get_stats', { agency_id: agencyId }),
      apiGet('get_calls', { agency_id: agencyId }),
      apiGet('get_queue', { agency_id: agencyId }),
      apiGet('get_carriers', { agency_id: agencyId }),
      apiGet('get_questions'),
      apiGet('get_active_calls', { agency_id: agencyId }),
      apiGet('get_knowledge', { agency_id: agencyId }),
    ])
    setStats(statsRes)
    setCalls(callsRes.data || [])
    setQueue(queueRes.data || [])
    setCarriers(carriersRes.data || [])
    setQuestions(questionsRes.data || [])
    setActiveCalls(activeRes.data || [])
    setKnowledge(knowledgeRes.data || [])
    setLoading(false)
  }

  async function queueCall() {
    if (!newCall.patient_id || !newCall.carrier_name) { toast.error('Patient ID and carrier required'); return }
    const res = await apiPost({ action: 'queue_call', agency_id: agencyId, ...newCall })
    if (res.success) { toast.success('Call queued'); setShowQueueModal(false); setNewCall({ patient_id: '', carrier_name: '', level_of_care: 'RTC', priority: 5 }); loadAll() }
    else toast.error(res.error || 'Failed')
  }

  async function startCall(callId) {
    toast('Initiating call...')
    const res = await apiPost({ action: 'start_call', agency_id: agencyId, call_id: callId })
    if (res.success) { toast.success('Call initiated'); loadAll() }
    else toast.error(res.error || 'Failed to start call')
  }

  async function cancelCall(callId) {
    const res = await apiPost({ action: 'cancel_call', call_id: callId })
    if (res.success) { toast.success('Call cancelled'); loadAll() }
  }

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    const data = await apiGet('get_analytics', { agency_id: agencyId })
    if (data && !data.error) setAnalytics(data)
    setAnalyticsLoading(false)
  }

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: Activity },
    { key: 'queue', label: `Queue${queue.length ? ` (${queue.length})` : ''}`, icon: Layers },
    { key: 'live', label: `Live${activeCalls.length ? ` (${activeCalls.length})` : ''}`, icon: Radio },
    { key: 'results', label: 'VOB Results', icon: FileText },
    { key: 'carriers', label: 'Carriers', icon: Globe },
    { key: 'questions', label: 'Question Bank', icon: Hash },
    { key: 'knowledge', label: 'Knowledge Base', icon: Brain },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'library', label: 'Call Library', icon: Phone },
    { key: 'setup', label: 'Test & Setup', icon: Settings },
  ]

  const [setupStatus, setSetupStatus] = useState(null)
  const [settingUp, setSettingUp] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testCarrier, setTestCarrier] = useState('')
  const [testLoc, setTestLoc] = useState('RTC')
  const [testCalling, setTestCalling] = useState(false)
  const [npiInput, setNpiInput] = useState('')

  async function runSetup() {
    setSettingUp(true)
    const res = await apiPost({ action: 'setup_vob', agency_id: agencyId, area_code: '561', npi: npiInput || undefined })
    if (res.success) {
      toast.success('VOB system ready!')
      setSetupStatus(res)
    } else {
      toast.error(res.error || 'Setup failed')
      setSetupStatus(res)
    }
    setSettingUp(false)
  }

  async function makeTestCall() {
    if (!testNumber) { toast.error('Enter a phone number to call'); return }
    setTestCalling(true)
    const res = await apiPost({ action: 'test_call', agency_id: agencyId, to_number: testNumber, test_carrier: testCarrier || 'Test Call', test_loc: testLoc })
    if (res.success) {
      toast.success(`Calling ${testNumber}...`)
      loadAll()
    } else {
      toast.error(res.error || 'Call failed')
    }
    setTestCalling(false)
  }

  // Group questions by category
  const questionsByCategory = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})

  const completedCalls = calls.filter(c => c.status === 'completed')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: W, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ background: W, borderBottom: '1px solid #e5e7eb', padding: '28px 40px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#0a5c44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={22} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
                  VOB Agent
                </h1>
                <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 2 }}>
                  Insurance Benefits Verification &middot; RCM Intelligence
                  {activeCalls.length > 0 && (
                    <span style={{ marginLeft: 12, color: GRN, fontWeight: 700, fontFamily: FH }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GRN, marginRight: 4, animation: 'pulse 1.5s infinite' }} />
                      {activeCalls.length} live
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={loadAll} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: W, cursor: 'pointer' }}>
                <RefreshCw size={16} color="#6b7280" />
              </button>
              <button onClick={() => setShowQueueModal(true)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10,
                border: 'none', background: '#0a5c44', color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
              }}>
                <Phone size={15} /> Run VOB Call
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Calls', value: stats.total_calls || 0, accent: T, icon: Phone },
              { label: 'Completed Today', value: stats.completed_today || 0, accent: GRN, icon: CheckCircle },
              { label: 'Queue Depth', value: stats.queue_depth || 0, accent: AMB, icon: Layers },
              { label: 'Success Rate', value: `${stats.success_rate || 0}%`, accent: '#0a5c44', icon: TrendingUp },
              { label: 'Escalated', value: stats.escalated || 0, accent: R, icon: AlertTriangle },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 18px', background: W, borderRadius: 12, border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.accent, opacity: 0.6 }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: s.accent + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={16} color={s.accent} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '12px 20px', fontSize: 14,
                fontWeight: tab === t.key ? 700 : 500, fontFamily: FH,
                border: 'none', borderBottom: tab === t.key ? '2px solid #0a5c44' : '2px solid transparent',
                background: 'none', cursor: 'pointer', color: tab === t.key ? BLK : '#9ca3af',
              }}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 48px' }}>

          {/* ══ DASHBOARD ══════════════════════════════════════════ */}
          {tab === 'dashboard' && (
            <div>
              {/* Active calls */}
              {activeCalls.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {activeCalls.map(call => {
                    const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued
                    return (
                      <div key={call.id} style={{
                        padding: '16px 20px', borderRadius: 14, marginBottom: 10,
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0f9ff 100%)', border: '1px solid #a7f3d0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, animation: 'pulse 1.5s infinite' }} />
                            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: '#0a5c44' }}>
                              Live — {call.carrier_name} · {call.patient_id}
                            </span>
                          </div>
                          <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', fontFamily: FB }}>
                          <span>LOC: {call.level_of_care || 'N/A'}</span>
                          <span>Q: {call.questions_answered || 0}/{call.questions_total || 20}</span>
                          {call.duration_seconds > 0 && <span>{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Recent calls + Carrier performance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                {/* Recent calls table */}
                <div style={{ ...card }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Phone size={16} color={T} />
                      <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Recent VOB Calls</span>
                    </div>
                    <button onClick={() => setTab('results')} style={{ fontSize: 12, fontWeight: 700, color: T, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH }}>
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Patient', 'Carrier', 'LOC', 'Status', 'Duration', 'Q\'s', ''].map(h => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calls.slice(0, 8).map(call => {
                          const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued
                          return (
                            <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{call.patient_id}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', fontFamily: FB }}>{call.carrier_name}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', fontFamily: FB }}>{call.level_of_care || '—'}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', fontFamily: FB }}>
                                {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', fontFamily: FB }}>
                                {call.questions_answered || 0}/{call.questions_total || 20}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <button onClick={() => { setSelectedCall(call); setTab('results') }} style={{
                                  padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W,
                                  fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: BLK,
                                }}>View</button>
                              </td>
                            </tr>
                          )
                        })}
                        {calls.length === 0 && (
                          <tr><td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', fontSize: 14, color: '#9ca3af', fontFamily: FB }}>No calls yet — queue your first VOB call</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Carrier performance */}
                <div style={{ ...cardInner }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Globe size={16} color="#0a5c44" />
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Carrier Directory</span>
                  </div>
                  {carriers.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{c.carrier_name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>{c.phone_number}</div>
                      </div>
                      {c.bh_carveout && (
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, fontFamily: FH, background: AMB + '12', color: AMB }}>BH Carveout</span>
                      )}
                      {c.best_time_to_call && (
                        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>{c.best_time_to_call}</span>
                      )}
                    </div>
                  ))}
                  {carriers.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No carriers loaded</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ QUEUE ══════════════════════════════════════════════ */}
          {tab === 'queue' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Layers size={18} color={T} />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Call Queue</span>
                </div>
                <button onClick={() => setShowQueueModal(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                  border: 'none', background: '#0a5c44', color: W, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                }}>
                  <Plus size={14} /> Add to Queue
                </button>
              </div>
              <div style={{ ...card }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Priority', 'Patient', 'Carrier', 'LOC', 'Mode', 'Status', 'Attempts', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(q => {
                      const pr = PRIORITY_COLORS[q.priority] || PRIORITY_COLORS[5]
                      const st = STATUS_COLORS[q.status] || STATUS_COLORS.queued
                      return (
                        <tr key={q.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: pr.bg, color: pr.color }}>{pr.label}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{q.patient_id}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{q.carrier_name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{q.level_of_care || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: FH, background: '#f3f4f6', color: '#6b7280' }}>{q.trigger_mode}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{q.attempts}/{q.max_attempts}</td>
                          <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                            {q.status === 'pending' && (
                              <>
                                <button onClick={() => startCall(q.vob_call_id)} style={{
                                  padding: '4px 12px', borderRadius: 6, border: 'none', background: '#0a5c44', color: W,
                                  fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                                }}>Start</button>
                                <button onClick={() => cancelCall(q.vob_call_id)} style={{
                                  padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W,
                                  fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280',
                                }}>Cancel</button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {queue.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '48px 14px', textAlign: 'center', fontSize: 14, color: '#9ca3af', fontFamily: FB }}>Queue is empty</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ LIVE CALLS ═════════════════════════════════════════ */}
          {tab === 'live' && (
            <div>
              {activeCalls.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Radio size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>No Active Calls</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB }}>Start a call from the queue to see real-time monitoring here.</p>
                </div>
              ) : activeCalls.map(call => (
                <div key={call.id} style={{ ...cardInner, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: GRN, animation: 'pulse 1s infinite' }} />
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: '#0a5c44' }}>
                        {call.carrier_name} — {call.patient_id}
                      </span>
                      <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH, background: (STATUS_COLORS[call.status] || {}).bg, color: (STATUS_COLORS[call.status] || {}).color }}>
                        {(STATUS_COLORS[call.status] || {}).label}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: '#6b7280' }}>
                      {call.questions_answered || 0} / {call.questions_total || 20} questions
                    </span>
                  </div>
                  {/* VOB data grid */}
                  {call.vob_data && Object.keys(call.vob_data).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(call.vob_data).map(([field, value]) => (
                        <div key={field} style={{ padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em' }}>{field.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a5c44', fontFamily: FB, marginTop: 2 }}>{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ VOB RESULTS ════════════════════════════════════════ */}
          {tab === 'results' && (
            <VOBResultsTab
              calls={calls}
              questions={questions}
              selectedCall={selectedCall}
              setSelectedCall={setSelectedCall}
              agencyId={agencyId}
              onRefresh={loadAll}
            />
          )}

          {/* ══ CARRIERS ═══════════════════════════════════════════ */}
          {tab === 'carriers' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Globe size={18} color="#0a5c44" />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Carrier IVR Maps</span>
                <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, marginLeft: 'auto' }}>{carriers.length} carriers</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {carriers.map(c => (
                  <div key={c.id} style={{ ...cardInner }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>{c.carrier_name}</div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {c.phone_number}</span>
                          {c.best_time_to_call && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {c.best_time_to_call}</span>}
                          {c.call_count > 0 && <span>{c.call_count} calls</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {c.bh_carveout && (
                          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: AMB + '12', color: AMB }}>
                            BH → {c.bh_carveout}
                          </span>
                        )}
                        {c.success_rate > 0 && (
                          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: c.success_rate >= 80 ? GRN + '12' : AMB + '12', color: c.success_rate >= 80 ? GRN : AMB }}>
                            {c.success_rate}%
                          </span>
                        )}
                      </div>
                    </div>
                    {/* IVR Map */}
                    {c.ivr_map && c.ivr_map.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>IVR Navigation Path</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {c.ivr_map.map((step, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ padding: '6px 12px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FH }}>{step.prompt}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0a5c44', fontFamily: FH }}>{step.action}</div>
                              </div>
                              {i < c.ivr_map.length - 1 && <ChevronRight size={14} color="#d1d5db" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ QUESTION BANK ══════════════════════════════════════ */}
          {tab === 'questions' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Hash size={18} color={T} />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Question Bank</span>
                  <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>{questions.length} questions · {Object.keys(questionsByCategory).length} categories</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 10, top: 9 }} />
                    <input value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Search questions..."
                      style={{ padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, width: 220, outline: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Category pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                <button onClick={() => setQFilter('all')} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: FH,
                  border: qFilter === 'all' ? '1.5px solid #0a5c44' : '1px solid #e5e7eb',
                  background: qFilter === 'all' ? '#ecfdf5' : W, color: qFilter === 'all' ? '#0a5c44' : '#6b7280', cursor: 'pointer',
                }}>All ({questions.length})</button>
                {Object.entries(questionsByCategory).map(([cat, qs]) => (
                  <button key={cat} onClick={() => setQFilter(cat)} style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: FH,
                    border: qFilter === cat ? '1.5px solid #0a5c44' : '1px solid #e5e7eb',
                    background: qFilter === cat ? '#ecfdf5' : W, color: qFilter === cat ? '#0a5c44' : '#6b7280', cursor: 'pointer',
                  }}>{cat} ({qs.length})</button>
                ))}
              </div>

              {/* Questions table */}
              <div style={{ ...card }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Category', 'Question', 'Field', 'Type', 'Priority'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {questions
                      .filter(q => qFilter === 'all' || q.category === qFilter)
                      .filter(q => !qSearch || q.question.toLowerCase().includes(qSearch.toLowerCase()) || q.field.toLowerCase().includes(qSearch.toLowerCase()))
                      .map(q => (
                        <tr key={q.field} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af', fontFamily: FH }}>{q.order}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: FH, background: '#f3f4f6', color: '#6b7280' }}>{q.category}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: BLK, fontFamily: FB, maxWidth: 400 }}>{q.question}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <code style={{ fontSize: 11, fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, color: '#6b7280' }}>{q.field}</code>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', fontFamily: FB }}>{q.type}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH,
                              background: q.priority === 1 ? R + '12' : q.priority === 2 ? AMB + '12' : '#f3f4f6',
                              color: q.priority === 1 ? R : q.priority === 2 ? AMB : '#9ca3af',
                            }}>{q.priority === 1 ? 'Must Get' : q.priority === 2 ? 'Important' : 'Nice to have'}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ KNOWLEDGE BASE ═════════════════════════════════════ */}
          {tab === 'knowledge' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Brain size={18} color={T} />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Knowledge Base</span>
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH, background: GRN + '12', color: GRN }}>Zero PII</span>
              </div>
              {knowledge.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Brain size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>Knowledge Base Empty</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, maxWidth: 440, margin: '0 auto' }}>
                    The AI agent learns from every call. Carrier IVR paths, answer patterns, and rep behaviors will populate here as calls are made.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {knowledge.map(k => (
                    <div key={k.id} style={{ ...cardInner, borderLeft: `4px solid ${k.knowledge_type === 'ivr_path' ? T : k.knowledge_type === 'answer_pattern' ? GRN : AMB}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK }}>{k.title || k.carrier_name}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: FH, background: '#f3f4f6', color: '#6b7280' }}>{k.knowledge_type}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, lineHeight: 1.6 }}>
                        {typeof k.content === 'string' ? k.content : JSON.stringify(k.content)}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                        <span>Confidence: {Math.round((k.confidence || 0) * 100)}%</span>
                        <span>Confirmed: {k.times_confirmed}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ANALYTICS ══════════════════════════════════════════ */}
          {tab === 'analytics' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BarChart2 size={18} color={T} />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Analytics</span>
                </div>
                <button onClick={loadAnalytics} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                  border: '1px solid #e5e7eb', background: W, fontSize: 13, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: BLK,
                }}>
                  <RefreshCw size={13} /> {analytics ? 'Refresh' : 'Load Analytics'}
                </button>
              </div>

              {!analytics && !analyticsLoading && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <button onClick={loadAnalytics} style={{
                    padding: '12px 28px', borderRadius: 10, border: 'none', background: '#0a5c44', color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                  }}>Load Analytics</button>
                </div>
              )}

              {analyticsLoading && (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <Loader2 size={28} color={BLK} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}

              {analytics && (
                <div>
                  {/* KPI Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                      { label: 'Total Calls', value: analytics.totals?.total_calls || 0, accent: T },
                      { label: 'Success Rate', value: `${analytics.totals?.overall_success_rate || 0}%`, accent: GRN },
                      { label: 'Avg Duration', value: `${Math.round((analytics.totals?.avg_duration || 0) / 60)}m`, accent: AMB },
                      { label: 'Avg Hold Time', value: `${Math.round((analytics.totals?.avg_hold || 0) / 60)}m`, accent: R },
                    ].map(s => (
                      <div key={s.label} style={{ ...cardInner, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.accent, opacity: 0.6 }} />
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: BLK, marginTop: 6 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    {/* Carrier Performance */}
                    <div style={{ ...cardInner }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <Globe size={16} color="#0a5c44" />
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Carrier Performance</span>
                      </div>
                      {(analytics.carrier_stats || []).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < (analytics.carrier_stats?.length || 0) - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 100 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{c.carrier}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>{c.total_calls} calls · avg {Math.round(c.avg_duration / 60)}m</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ width: `${c.success_rate}%`, height: '100%', borderRadius: 3, background: c.success_rate >= 80 ? GRN : c.success_rate >= 60 ? AMB : R }} />
                            </div>
                          </div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH,
                            background: c.success_rate >= 80 ? GRN + '12' : c.success_rate >= 60 ? AMB + '12' : R + '12',
                            color: c.success_rate >= 80 ? GRN : c.success_rate >= 60 ? AMB : R,
                          }}>{c.success_rate}%</span>
                        </div>
                      ))}
                      {(!analytics.carrier_stats || analytics.carrier_stats.length === 0) && (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No carrier data yet</div>
                      )}
                    </div>

                    {/* Hold Time by Carrier */}
                    <div style={{ ...cardInner }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <Clock size={16} color={AMB} />
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Avg Hold Time by Carrier</span>
                      </div>
                      {(analytics.carrier_stats || []).map((c, i) => {
                        const holdMin = Math.round(c.avg_hold / 60)
                        const maxHold = Math.max(...(analytics.carrier_stats || []).map(x => x.avg_hold), 1)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < (analytics.carrier_stats?.length || 0) - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ width: 120, fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{c.carrier}</div>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ width: `${(c.avg_hold / maxHold) * 100}%`, height: '100%', borderRadius: 4, background: holdMin > 15 ? R : holdMin > 8 ? AMB : GRN }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: holdMin > 15 ? R : holdMin > 8 ? AMB : GRN, minWidth: 40, textAlign: 'right' }}>{holdMin}m</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    {/* Denial Risk Distribution */}
                    <div style={{ ...cardInner }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <AlertTriangle size={16} color={R} />
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Denial Risk</span>
                      </div>
                      {[
                        { label: 'Low Risk (<30%)', value: analytics.denial_distribution?.low || 0, color: GRN },
                        { label: 'Medium (30-60%)', value: analytics.denial_distribution?.medium || 0, color: AMB },
                        { label: 'High Risk (>60%)', value: analytics.denial_distribution?.high || 0, color: R },
                      ].map(d => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 13, fontFamily: FB, color: BLK }}>{d.label}</span>
                          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: d.color }}>{d.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Daily Volume */}
                    <div style={{ ...cardInner, gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <TrendingUp size={16} color={T} />
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Daily Call Volume</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                        {(analytics.daily_volume || []).slice(-30).map((d, i) => {
                          const maxVol = Math.max(...(analytics.daily_volume || []).map(x => x.total), 1)
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, height: 100, justifyContent: 'flex-end' }}>
                                <div style={{
                                  height: `${(d.total / maxVol) * 100}%`, borderRadius: 3,
                                  background: d.completed === d.total ? GRN : T, minHeight: d.total > 0 ? 4 : 0,
                                }} title={`${d.date}: ${d.total} calls, ${d.completed} completed`} />
                              </div>
                              {i % 5 === 0 && <div style={{ fontSize: 8, color: '#9ca3af', fontFamily: FH }}>{d.date?.slice(5)}</div>}
                            </div>
                          )
                        })}
                      </div>
                      {(!analytics.daily_volume || analytics.daily_volume.length === 0) && (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No daily data yet</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ REVENUE FORECAST ═══════════════════════════════════ */}
          {tab === 'revenue' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <DollarSign size={18} color="#0a5c44" />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Revenue Forecast</span>
                  <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>Based on completed VOB data</span>
                </div>
                {!analytics && (
                  <button onClick={loadAnalytics} style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0a5c44', color: W,
                    fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                  }}>Load Data</button>
                )}
              </div>

              {analytics?.revenue ? (
                <div>
                  {/* Revenue summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                    <div style={{ ...cardInner, background: '#0a5c44', border: 'none' }}>
                      <div style={{ fontSize: 11, fontFamily: FH, fontWeight: 600, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Est. Gross Revenue</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FH, color: W, marginTop: 8, lineHeight: 1 }}>
                        ${(analytics.revenue.total_gross || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 6 }}>From {analytics.revenue.per_call?.length || 0} completed VOBs</div>
                    </div>
                    <div style={{ ...cardInner }}>
                      <div style={{ fontSize: 11, fontFamily: FH, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Est. Net Revenue</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FH, color: '#0a5c44', marginTop: 8, lineHeight: 1 }}>
                        ${(analytics.revenue.total_net || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>After coinsurance + deductible</div>
                    </div>
                    <div style={{ ...cardInner }}>
                      <div style={{ fontSize: 11, fontFamily: FH, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Avg Per VOB</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FH, color: T, marginTop: 8, lineHeight: 1 }}>
                        ${analytics.revenue.per_call?.length > 0 ? Math.round(analytics.revenue.total_net / analytics.revenue.per_call.length).toLocaleString() : '0'}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Net per completed call</div>
                    </div>
                  </div>

                  {/* Per-call revenue table */}
                  {analytics.revenue.per_call?.length > 0 && (
                    <div style={{ ...card }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DollarSign size={16} color="#0a5c44" />
                        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Per-Call Revenue Forecast</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Carrier', 'Gross', 'Net', 'Denial Risk'].map(h => (
                              <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.revenue.per_call.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{r.carrier}</td>
                              <td style={{ padding: '10px 14px', fontSize: 14, fontFamily: FB, color: '#6b7280' }}>${(r.gross || 0).toLocaleString()}</td>
                              <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, fontFamily: FH, color: '#0a5c44' }}>${(r.net || 0).toLocaleString()}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{
                                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH,
                                  background: r.denial_risk < 30 ? GRN + '12' : r.denial_risk < 60 ? AMB + '12' : R + '12',
                                  color: r.denial_risk < 30 ? GRN : r.denial_risk < 60 ? AMB : R,
                                }}>{r.denial_risk < 30 ? 'Low' : r.denial_risk < 60 ? 'Medium' : 'High'} {r.denial_risk}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <DollarSign size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>No Revenue Data Yet</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, maxWidth: 440, margin: '0 auto', marginBottom: 20 }}>
                    Revenue forecasts are calculated automatically after VOB calls complete with benefit data.
                  </p>
                  <button onClick={loadAnalytics} style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none', background: '#0a5c44', color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                  }}>Load Analytics</button>
                </div>
              )}
            </div>
          )}
          {/* ══ CALL LIBRARY ═════════════════════════════════════ */}
          {tab === 'library' && (
            <CallLibrary calls={calls} questions={questions} />
          )}

          {/* ══ TEST & SETUP ═════════════════════════════════════ */}
          {tab === 'setup' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Settings size={18} color={T} />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Test & Setup</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Setup Panel */}
                <div style={{ ...cardInner }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Zap size={16} color="#0a5c44" />
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>One-Click Setup</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginBottom: 16, lineHeight: 1.6 }}>
                    Creates the Retell AI agent, provisions an outbound phone number, and configures everything needed to make VOB calls.
                  </p>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Provider NPI (optional)</label>
                    <input value={npiInput} onChange={e => setNpiInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="1234567890"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>

                  <button onClick={runSetup} disabled={settingUp} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', borderRadius: 10, border: 'none', background: '#0a5c44', color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: settingUp ? 0.5 : 1,
                  }}>
                    {settingUp ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                    {settingUp ? 'Setting up...' : 'Setup VOB System'}
                  </button>

                  {setupStatus && (
                    <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: setupStatus.success ? '#ecfdf5' : '#fef2f2', border: `1px solid ${setupStatus.success ? '#a7f3d0' : '#fecaca'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: setupStatus.success ? '#0a5c44' : R, marginBottom: 8 }}>
                        {setupStatus.success ? 'Setup Complete' : 'Setup Failed'}
                      </div>
                      {setupStatus.steps?.map((step, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={12} color={GRN} /> {step}
                        </div>
                      ))}
                      {setupStatus.phone_number && (
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#0a5c44', marginTop: 8 }}>
                          Outbound number: {setupStatus.phone_number}
                        </div>
                      )}
                      {setupStatus.agent_id && (
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 4 }}>
                          Agent ID: <code style={{ fontFamily: 'monospace', fontSize: 10, background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{setupStatus.agent_id}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Test Call Panel */}
                <div style={{ ...cardInner }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Phone size={16} color={T} />
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Make Test Call</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginBottom: 16, lineHeight: 1.6 }}>
                    Enter any phone number to test the VOB agent. The AI will call, introduce itself, and attempt to verify benefits. All calls are recorded and transcripts are processed into the knowledge base.
                  </p>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Phone Number to Call</label>
                    <input value={testNumber} onChange={e => setTestNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Carrier Name (test)</label>
                      <input value={testCarrier} onChange={e => setTestCarrier(e.target.value)}
                        placeholder="e.g. Aetna"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Level of Care</label>
                      <select value={testLoc} onChange={e => setTestLoc(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box', background: W }}>
                        {['Detox', 'RTC', 'PHP', 'IOP', 'Outpatient', 'Test'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={makeTestCall} disabled={testCalling} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', borderRadius: 10, border: 'none', background: T, color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: testCalling ? 0.5 : 1,
                  }}>
                    {testCalling ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={16} />}
                    {testCalling ? 'Calling...' : 'Call Now'}
                  </button>

                  <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>What happens:</div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, lineHeight: 1.7 }}>
                      1. AI calls the number you enter<br />
                      2. Introduces itself as your billing dept<br />
                      3. Attempts IVR navigation + asks VOB questions<br />
                      4. Call recorded + transcript saved<br />
                      5. Claude analyzes transcript → knowledge base<br />
                      6. Carrier insights auto-extracted
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent test calls */}
              {calls.filter(c => c.trigger_mode === 'test').length > 0 && (
                <div style={{ ...card, marginTop: 24 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Activity size={16} color={T} />
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Test Call History</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['ID', 'To', 'Carrier', 'Status', 'Duration', 'Questions', 'Recording', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calls.filter(c => c.trigger_mode === 'test').map(call => {
                        const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued
                        return (
                          <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{call.patient_id}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{call.to_number || '—'}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{call.carrier_name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>
                              {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>
                              {call.questions_answered || 0}/{call.questions_total || 20}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {call.recording_url ? (
                                <a href={call.recording_url} target="_blank" rel="noopener noreferrer" style={{
                                  padding: '3px 10px', borderRadius: 6, background: T + '12', color: T,
                                  fontSize: 11, fontWeight: 700, fontFamily: FH, textDecoration: 'none',
                                }}>Play</a>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <button onClick={() => { setSelectedCall(call); setTab('results') }} style={{
                                padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W,
                                fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: BLK,
                              }}>View VOB</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Queue Modal ────────────────────────────────────────── */}
        {showQueueModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: W, borderRadius: 16, padding: 32, width: 520, maxWidth: '95vw' }}>
              <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 20px' }}>Queue VOB Call</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Patient ID (hashed)</label>
                  <input value={newCall.patient_id} onChange={e => setNewCall(p => ({ ...p, patient_id: e.target.value }))}
                    placeholder="PT-00001" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Carrier</label>
                  <select value={newCall.carrier_name} onChange={e => setNewCall(p => ({ ...p, carrier_name: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box', background: W }}>
                    <option value="">Select carrier...</option>
                    {carriers.map(c => <option key={c.id} value={c.carrier_name}>{c.carrier_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Level of Care</label>
                  <select value={newCall.level_of_care} onChange={e => setNewCall(p => ({ ...p, level_of_care: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box', background: W }}>
                    {['Detox', 'RTC', 'PHP', 'IOP', 'Outpatient', 'Detox/RTC', 'PHP/IOP'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Priority</label>
                  <select value={newCall.priority} onChange={e => setNewCall(p => ({ ...p, priority: parseInt(e.target.value) }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box', background: W }}>
                    <option value={1}>Urgent</option>
                    <option value={2}>High</option>
                    <option value={3}>Medium</option>
                    <option value={5}>Normal</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button onClick={() => setShowQueueModal(false)} style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #e5e7eb', background: W, fontSize: 14, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
                <button onClick={queueCall} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#0a5c44', color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>Queue Call</button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   VOB RESULTS TAB — All calls database with editable UB-04 form viewer
   ══════════════════════════════════════════════════════════════════════════ */
function VOBResultsTab({ calls, questions, selectedCall, setSelectedCall, agencyId, onRefresh }) {
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')

  // UB-04 field groups for visual form layout
  const UB04_SECTIONS = [
    { title: 'Plan Information', fields: ['plan_status', 'plan_type', 'group_name', 'plan_year', 'erisa_aca', 'bh_carveout', 'bh_administrator'] },
    { title: 'Member Verification', fields: ['member_verified', 'pcp_referral', 'cob_status', 'hsa_fsa', 'case_manager'] },
    { title: 'Deductible', fields: ['ded_individual_in', 'ded_individual_out', 'ded_met', 'ded_separate_bh', 'ded_per_admission', 'ded_family'] },
    { title: 'Out-of-Pocket & Cost Share', fields: ['oop_max_in', 'oop_max_out', 'oop_met', 'coinsurance_in', 'coinsurance_out', 'copay_inpatient', 'copay_php_iop', 'copay_outpatient'] },
    { title: 'Residential & Detox Coverage', fields: ['detox_covered', 'rtc_covered', 'rtc_days_authorized', 'rtc_days_used', 'medical_necessity', 'mat_covered'] },
    { title: 'PHP & IOP Coverage', fields: ['php_covered', 'iop_covered', 'php_iop_days_used', 'telehealth_iop'] },
    { title: 'Outpatient Coverage', fields: ['op_therapy_covered', 'op_group_covered', 'op_psych_eval', 'op_family_therapy'] },
    { title: 'Prior Authorization', fields: ['pa_required', 'pa_phone', 'pa_turnaround', 'pa_initial_days', 'pa_retro', 'pa_portal'] },
    { title: 'CPT Code Coverage', fields: ['cpt_h0010', 'cpt_h0018', 'cpt_h0019', 'cpt_h2036', 'cpt_h0035', 'cpt_h0015', 'cpt_90837', 'cpt_uds'] },
    { title: 'Claims & Network', fields: ['timely_filing', 'claim_form', 'payer_id', 'in_network_npi', 'oon_reimbursement', 'sca_available'] },
    { title: 'Reference & Verification', fields: ['ref_number', 'rep_name', 'call_timestamp'] },
  ]

  async function saveField(callId, field, value) {
    const res = await fetch('/api/vob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_vob_field', call_id: callId, field, value }),
    }).then(r => r.json())
    if (res.success) {
      // Update local state
      selectedCall.vob_data = { ...selectedCall.vob_data, [field]: value }
      setSelectedCall({ ...selectedCall })
      setEditingField(null)
      toast.success('Field updated')
    }
  }

  if (selectedCall) {
    const st = STATUS_COLORS[selectedCall.status] || STATUS_COLORS.queued
    const vob = selectedCall.vob_data || {}
    const answeredCount = Object.keys(vob).filter(k => !k.startsWith('_')).length

    return (
      <div>
        <button onClick={() => setSelectedCall(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, fontFamily: FH, fontWeight: 700, marginBottom: 20, padding: 0 }}>
          <ArrowLeft size={15} /> All Calls
        </button>

        {/* Header */}
        <div style={{ ...cardInner, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0 }}>
                {selectedCall.patient_id} — {selectedCall.carrier_name}
              </h2>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 6 }}>
                <span>LOC: {selectedCall.level_of_care || '—'}</span>
                {selectedCall.duration_seconds > 0 && <span>Duration: {Math.floor(selectedCall.duration_seconds / 60)}m {selectedCall.duration_seconds % 60}s</span>}
                {selectedCall.rep_name && <span>Rep: {selectedCall.rep_name}</span>}
                {selectedCall.reference_number && <span>Ref#: {selectedCall.reference_number}</span>}
                {selectedCall.recording_url && (
                  <a href={selectedCall.recording_url} target="_blank" rel="noopener noreferrer" style={{ color: T, fontWeight: 700, textDecoration: 'none' }}>Play Recording</a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: '#0a5c44' }}>{answeredCount} / {questions.length} fields</span>
              <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((answeredCount / Math.max(questions.length, 1)) * 100)}%`, height: '100%', borderRadius: 3, background: '#0a5c44', transition: 'width .3s' }} />
          </div>
        </div>

        {/* UB-04 Form Sections */}
        {UB04_SECTIONS.map(section => {
          const sectionAnswered = section.fields.filter(f => vob[f]).length
          return (
            <div key={section.title} style={{ ...cardInner, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>{section.title}</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FH, color: sectionAnswered === section.fields.length ? GRN : '#9ca3af' }}>
                  {sectionAnswered}/{section.fields.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {section.fields.map(field => {
                  const val = vob[field]
                  const q = questions.find(q => q.field === field)
                  const isEditing = editingField === `${selectedCall.id}_${field}`

                  return (
                    <div key={field} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: val ? '#ecfdf5' : '#fafafa',
                      border: `1px solid ${isEditing ? T : val ? '#a7f3d0' : '#e5e7eb'}`,
                      cursor: 'pointer', transition: 'border-color .12s',
                    }}
                      onClick={() => { if (!isEditing) { setEditingField(`${selectedCall.id}_${field}`); setEditValue(val || '') } }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                        {field.replace(/_/g, ' ')}
                      </div>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input value={editValue} onChange={e => setEditValue(e.target.value)}
                            autoFocus onKeyDown={e => { if (e.key === 'Enter') saveField(selectedCall.id, field, editValue); if (e.key === 'Escape') setEditingField(null) }}
                            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: `1px solid ${T}`, fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                            onClick={e => e.stopPropagation()} />
                          <button onClick={e => { e.stopPropagation(); saveField(selectedCall.id, field, editValue) }}
                            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#0a5c44', color: W, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: val ? 600 : 400, color: val ? '#0a5c44' : '#d1d5db', fontFamily: FB, minHeight: 18 }}>
                          {val || '—'}
                        </div>
                      )}
                      {q && !isEditing && (
                        <div style={{ fontSize: 10, color: '#c4c4be', fontFamily: FB, marginTop: 3, lineHeight: 1.3 }}>
                          {q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Transcript */}
        {selectedCall.transcript && (
          <div style={{ ...cardInner, marginTop: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK, marginBottom: 12 }}>Call Transcript</div>
            <div style={{ fontSize: 13, fontFamily: FB, color: '#6b7280', lineHeight: 1.8, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {selectedCall.transcript}
            </div>
          </div>
        )}

        {/* Post-call analysis */}
        {selectedCall.post_call_analysis && (
          <div style={{ ...cardInner, marginTop: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK, marginBottom: 12 }}>AI Analysis</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {selectedCall.post_call_analysis.call_summary && (
                <div style={{ gridColumn: 'span 2', fontSize: 14, color: BLK, fontFamily: FB, lineHeight: 1.6, padding: '12px 16px', background: '#f9fafb', borderRadius: 8 }}>
                  {selectedCall.post_call_analysis.call_summary}
                </div>
              )}
              {selectedCall.post_call_analysis.denial_risk_score != null && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: selectedCall.post_call_analysis.denial_risk_score < 30 ? GRN + '08' : selectedCall.post_call_analysis.denial_risk_score < 60 ? AMB + '08' : R + '08', border: `1px solid ${selectedCall.post_call_analysis.denial_risk_score < 30 ? GRN : selectedCall.post_call_analysis.denial_risk_score < 60 ? AMB : R}20` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>Denial Risk</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: selectedCall.post_call_analysis.denial_risk_score < 30 ? GRN : selectedCall.post_call_analysis.denial_risk_score < 60 ? AMB : R, marginTop: 4 }}>
                    {selectedCall.post_call_analysis.denial_risk_score}%
                  </div>
                </div>
              )}
              {selectedCall.post_call_analysis.completeness_score != null && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>Completeness</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: T, marginTop: 4 }}>{selectedCall.post_call_analysis.completeness_score}%</div>
                </div>
              )}
            </div>
            {selectedCall.post_call_analysis.denial_risk_factors?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', marginBottom: 6 }}>Risk Factors</div>
                {selectedCall.post_call_analysis.denial_risk_factors.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: R, fontFamily: FB, padding: '3px 0' }}>• {f}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── All Calls Table ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={18} color={T} />
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>All VOB Calls</span>
          <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>{calls.length} total</span>
        </div>
      </div>
      <div style={{ ...card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Patient', 'Carrier', 'LOC', 'Status', 'Mode', 'Duration', 'Fields', 'Ref #', 'Recording', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map(call => {
              const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued
              const answered = Object.keys(call.vob_data || {}).filter(k => !k.startsWith('_')).length
              return (
                <tr key={call.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setSelectedCall(call)}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = W}>
                  <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{call.patient_id}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{call.carrier_name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>{call.level_of_care || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontFamily: FH, color: '#6b7280' }}>{call.trigger_mode || 'manual'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>
                    {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: answered > 0 ? '#0a5c44' : '#9ca3af', fontWeight: answered > 0 ? 700 : 400 }}>
                    {answered > 0 ? `${answered} filled` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FB, color: T }}>{call.reference_number || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {call.recording_url ? (
                      <a href={call.recording_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ padding: '3px 10px', borderRadius: 6, background: T + '12', color: T, fontSize: 11, fontWeight: 700, fontFamily: FH, textDecoration: 'none' }}>Play</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={e => { e.stopPropagation(); setSelectedCall(call) }}
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W, fontSize: 12, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: BLK }}>
                      View / Edit
                    </button>
                  </td>
                </tr>
              )
            })}
            {calls.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '48px 14px', textAlign: 'center', fontSize: 14, color: '#9ca3af', fontFamily: FB }}>No calls yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   CALL LIBRARY — Full recap of every call, organized by facility/client
   ══════════════════════════════════════════════════════════════════════════ */

const DUMMY_FACILITIES = [
  { id: 'fac-001', name: 'Sunrise Recovery Center', city: 'Fort Lauderdale', state: 'FL' },
  { id: 'fac-002', name: 'Palm Beach Treatment', city: 'West Palm Beach', state: 'FL' },
  { id: 'fac-003', name: 'Coastal Behavioral Health', city: 'Miami', state: 'FL' },
  { id: 'fac-004', name: 'Serenity Springs', city: 'Boca Raton', state: 'FL' },
  { id: 'fac-005', name: 'Harbor Recovery', city: 'Delray Beach', state: 'FL' },
]

function CallLibrary({ calls, questions }) {
  const [selectedCall, setSelectedCall] = useState(null)
  const [groupBy, setGroupBy] = useState('facility')

  const enrichedCalls = calls.map((c, i) => ({
    ...c,
    facility: DUMMY_FACILITIES[i % DUMMY_FACILITIES.length],
  }))

  const completedCalls = enrichedCalls.filter(c => ['completed', 'escalated', 'failed'].includes(c.status))

  const grouped = completedCalls.reduce((acc, c) => {
    const key = groupBy === 'facility' ? c.facility.name : c.carrier_name
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  if (selectedCall) {
    const call = selectedCall
    const vob = call.vob_data || {}
    const analysis = call.post_call_analysis || {}
    const answeredCount = Object.keys(vob).filter(k => !k.startsWith('_')).length
    const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued

    return (
      <div>
        <button onClick={() => setSelectedCall(null)} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b7280', fontSize: 13, fontFamily: FH, fontWeight: 700, marginBottom: 20, padding: 0,
        }}>
          <ArrowLeft size={15} /> Back to Library
        </button>

        {/* Call Header */}
        <div style={{ ...cardInner, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0 }}>
                Call Recap — {call.carrier_name}
              </h2>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 6, flexWrap: 'wrap' }}>
                <span>Patient: {call.patient_id}</span>
                <span>Facility: {call.facility?.name}</span>
                <span>LOC: {call.level_of_care || '—'}</span>
                {call.duration_seconds > 0 && <span>Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>}
                {call.rep_name && <span>Rep: {call.rep_name}</span>}
                {call.reference_number && <span>Ref#: {call.reference_number}</span>}
                <span>{new Date(call.created_at).toLocaleString()}</span>
              </div>
            </div>
            <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((answeredCount / Math.max(questions.length, 1)) * 100)}%`, height: '100%', borderRadius: 4, background: '#0a5c44' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#0a5c44' }}>{answeredCount} / {questions.length} fields</span>
          </div>

          {/* Audio Player */}
          {call.recording_url ? (
            <div style={{ padding: '16px 20px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0a5c44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={18} color={W} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>Call Recording</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                    {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : 'Duration unknown'}
                  </div>
                </div>
              </div>
              <audio controls src={call.recording_url} style={{ width: '100%', height: 40 }} />
            </div>
          ) : (
            <div style={{ padding: '14px 18px', background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#9ca3af', fontFamily: FB, textAlign: 'center' }}>
              No recording available for this call
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left — Analysis + VOB */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {analysis.call_summary && (
              <div style={{ ...cardInner }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Brain size={16} color={T} />
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>AI Analysis</span>
                </div>
                <p style={{ fontSize: 14, color: BLK, fontFamily: FB, lineHeight: 1.7, margin: '0 0 16px' }}>{analysis.call_summary}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {analysis.completeness_score != null && (
                    <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: T }}>{analysis.completeness_score}%</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>Complete</div>
                    </div>
                  )}
                  {analysis.denial_risk_score != null && (
                    <div style={{ padding: '12px', background: analysis.denial_risk_score < 30 ? GRN + '08' : R + '08', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: analysis.denial_risk_score < 30 ? GRN : R }}>{analysis.denial_risk_score}%</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>Denial Risk</div>
                    </div>
                  )}
                  {call.hold_time_seconds > 0 && (
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: AMB }}>{Math.round(call.hold_time_seconds / 60)}m</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>Hold Time</div>
                    </div>
                  )}
                </div>
                {analysis.denial_risk_factors?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', marginBottom: 6 }}>Risk Factors</div>
                    {analysis.denial_risk_factors.map((f, i) => (
                      <div key={i} style={{ fontSize: 13, color: R, fontFamily: FB, padding: '3px 0' }}>• {f}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {call.revenue_forecast && (
              <div style={{ ...cardInner }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <DollarSign size={16} color="#0a5c44" />
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Revenue Estimate</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '14px', background: '#ecfdf5', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: '#0a5c44' }}>${(call.revenue_forecast.gross || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH, textTransform: 'uppercase' }}>Gross</div>
                  </div>
                  <div style={{ padding: '14px', background: '#f0f9ff', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FH, color: T }}>${(call.revenue_forecast.net || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH, textTransform: 'uppercase' }}>Net</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...cardInner }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <FileText size={16} color={T} />
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>VOB Answers ({answeredCount})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(vob).filter(([k]) => !k.startsWith('_')).map(([field, value]) => (
                  <div key={field} style={{ padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em' }}>{field.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0a5c44', fontFamily: FB, marginTop: 2 }}>{String(value)}</div>
                  </div>
                ))}
              </div>
              {answeredCount === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No answers captured</div>}
            </div>
          </div>

          {/* Right — Transcript */}
          <div style={{ ...cardInner, height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Activity size={16} color={AMB} />
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Full Transcript</span>
            </div>
            {call.transcript ? (
              <div style={{ fontSize: 13, fontFamily: FB, color: '#374151', lineHeight: 1.9, maxHeight: 600, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {call.transcript}
              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No transcript available</div>
            )}
            {call.ivr_log?.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK, marginBottom: 10 }}>IVR Navigation Log</div>
                {call.ivr_log.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', fontSize: 11, fontWeight: 700, fontFamily: FH, color: '#6b7280' }}>Step {i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FB, color: '#0a5c44' }}>{step.action}</span>
                    {step.description && <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>— {step.description}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Phone size={18} color="#0a5c44" />
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Call Library</span>
          <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>{completedCalls.length} calls</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['facility', 'carrier'].map(g => (
            <button key={g} onClick={() => setGroupBy(g)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FH,
              border: groupBy === g ? '1.5px solid #0a5c44' : '1px solid #e5e7eb',
              background: groupBy === g ? '#ecfdf5' : W, color: groupBy === g ? '#0a5c44' : '#6b7280', cursor: 'pointer',
              textTransform: 'capitalize',
            }}>By {g}</button>
          ))}
        </div>
      </div>

      {completedCalls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Phone size={28} color="#d1d5db" />
          </div>
          <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>No Completed Calls Yet</h3>
          <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB }}>Completed VOB calls will appear here with full recaps, recordings, and analysis.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([groupName, groupCalls]) => (
          <div key={groupName} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0a5c44' + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {groupBy === 'facility' ? <Shield size={16} color="#0a5c44" /> : <Globe size={16} color="#0a5c44" />}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>{groupName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                  {groupCalls.length} call{groupCalls.length !== 1 ? 's' : ''}
                  {groupBy === 'facility' && groupCalls[0]?.facility && ` · ${groupCalls[0].facility.city}, ${groupCalls[0].facility.state}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupCalls.map(call => {
                const st = STATUS_COLORS[call.status] || STATUS_COLORS.queued
                const answered = Object.keys(call.vob_data || {}).filter(k => !k.startsWith('_')).length
                return (
                  <div key={call.id} onClick={() => setSelectedCall(call)} style={{
                    ...cardInner, cursor: 'pointer', transition: 'box-shadow .15s, transform .15s',
                    borderLeft: `4px solid ${call.status === 'completed' ? '#0a5c44' : call.status === 'escalated' ? R : AMB}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: call.recording_url ? '#0a5c44' + '12' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {call.recording_url ? <Phone size={18} color="#0a5c44" /> : <PhoneOff size={18} color="#9ca3af" />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK }}>{call.patient_id}</span>
                            <span style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>→ {call.carrier_name}</span>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: st.bg, color: st.color }}>{st.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af', fontFamily: FB, marginTop: 4 }}>
                            <span>{call.level_of_care || '—'}</span>
                            {call.duration_seconds > 0 && <span>{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>}
                            <span>{answered > 0 ? `${answered} fields` : 'No data'}</span>
                            {call.recording_url && <span style={{ color: T, fontWeight: 600 }}>Recording</span>}
                            <span>{new Date(call.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} color="#d1d5db" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
