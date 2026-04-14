"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing,
  Activity, Clock, TrendingUp, Loader2, RefreshCw, Shield,
  BarChart2, Play, ExternalLink, AlertCircle, Check, Zap,
  ArrowUp, ArrowDown, Calendar, Volume2, X, Trash2
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

function fmtDur(s) { if (!s) return '0:00'; const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}` }
function timeAgo(d) { if (!d) return ''; const diff = Date.now()-new Date(d).getTime(); const m = Math.floor(diff/60000); if (m<1) return 'just now'; if (m<60) return `${m}m ago`; const h = Math.floor(m/60); if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago` }
function fmtPhone(n) { if (!n) return ''; const d = n.replace(/\D/g,''); if (d.length===11&&d[0]==='1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`; if (d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; return n }

const OUTCOME_COLORS = { completed: GRN, answered: GRN, appointment: '#00C2CB', voicemail: AMB, no_answer: '#6b7280', transferred: T, emergency: R, in_progress: GRN, ringing: AMB, initiated: AMB, stopped: R }
const SENTIMENT_EMOJI = { positive: '😊', neutral: '😐', negative: '😟', frustrated: '😤' }

function StatCard({ label, value, icon: Icon, accent = T, sub, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden', flex: 1, minWidth: 140 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1 }}>{loading ? '—' : value}</div>
          <div style={{ fontSize: 13, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ score, size = 80, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 85 ? GRN : score >= 70 ? AMB : score >= 40 ? T : '#6b7280'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: FH, fontSize: size * 0.28, fontWeight: 800, fill: color }}>
        {score}
      </text>
    </svg>
  )
}

function LiveCallCard({ call: c, onStop }) {
  const [tab, setTab] = useState('score')
  const [score, setScore] = useState(null)
  const [research, setResearch] = useState(null)
  const [routing, setRouting] = useState(null)
  const [elapsed, setElapsed] = useState(c.duration_seconds || 0)
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [loadingRouting, setLoadingRouting] = useState(false)
  const timerRef = useRef(null)
  const scoreRef = useRef(null)

  // Live elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Poll score every 30s
  useEffect(() => {
    fetchScore()
    scoreRef.current = setInterval(fetchScore, 30000)
    return () => clearInterval(scoreRef.current)
  }, [])

  // Fetch research/routing when tab switches
  useEffect(() => {
    if (tab === 'research' && !research) fetchResearch()
    if (tab === 'routing' && !routing) fetchRouting()
  }, [tab])

  async function fetchScore() {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_call_score', call_id: c.id }),
      })
      const data = await res.json()
      if (!data.error) setScore(data)
    } catch {}
  }

  async function fetchResearch() {
    setLoadingResearch(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_call_research', call_id: c.id }),
      })
      const data = await res.json()
      if (!data.error) setResearch(data.research)
    } catch {}
    setLoadingResearch(false)
  }

  async function fetchRouting() {
    setLoadingRouting(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_live_routing', call_id: c.id }),
      })
      const data = await res.json()
      if (!data.error) setRouting(data.routing)
    } catch {}
    setLoadingRouting(false)
  }

  const alertLabel = score?.score >= 85 ? '🔥 OFFER TRANSFER' : score?.score >= 70 ? '⚡ ALERT CLOSER' : null
  const alertColor = score?.score >= 85 ? R : score?.score >= 70 ? AMB : null

  return (
    <div style={{ padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
      {/* Call header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: alertLabel || tab !== 'score' ? 10 : 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.direction === 'inbound' ? GRN + '15' : R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {c.direction === 'inbound' ? <PhoneIncoming size={16} color={GRN} /> : <PhoneOutgoing size={16} color={R} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: BLK, fontFamily: FH }}>{c.contact_name || c.contact_phone || 'Unknown'}</span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: c.direction === 'inbound' ? GRN + '15' : R + '15', color: c.direction === 'inbound' ? GRN : R, textTransform: 'uppercase' }}>{c.direction}</span>
            {alertLabel && (
              <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: alertColor + '15', color: alertColor, animation: 'pulse-live 2s infinite' }}>{alertLabel}</span>
            )}
          </div>
          <div style={{ fontSize: 14, color: '#9a9a96' }}>{fmtPhone(c.contact_phone)} {c.agent_name ? `· ${c.agent_name}` : ''}</div>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: GRN }}>{fmtDur(elapsed)}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['score', 'research', 'routing'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, fontFamily: FH,
              background: tab === t ? BLK : '#f3f4f6', color: tab === t ? '#fff' : '#6b7280', cursor: 'pointer', textTransform: 'capitalize',
            }}>{t === 'routing' ? 'Next Move' : t}</button>
          ))}
        </div>
        <button onClick={() => onStop(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: R + '15', color: R, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH }}>
          <PhoneOff size={12} /> Stop
        </button>
      </div>

      {/* Score tab */}
      {tab === 'score' && score && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0 4px 50px' }}>
          <ScoreRing score={score.score} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 14, color: '#6b7280' }}><Clock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Duration: <strong>{fmtDur(score.duration)}</strong></div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>Sentiment: <strong>{SENTIMENT_EMOJI[score.sentiment] || '😐'} {score.sentiment || 'neutral'}</strong></div>
            <div style={{ fontSize: 14, color: '#6b7280' }}><Calendar size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Appointment: <strong>{score.appointment_set ? '✅ Yes' : '—'}</strong></div>
          </div>
        </div>
      )}

      {/* Research tab */}
      {tab === 'research' && (
        <div style={{ padding: '8px 0 4px 50px' }}>
          {loadingResearch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a9a96', fontSize: 14 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading research...
            </div>
          ) : research ? (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {research.talking_points?.length > 0 && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Talking Points</div>
                  {research.talking_points.map((tp, i) => (
                    <div key={i} style={{ fontSize: 14, color: '#374151', padding: '3px 0', borderBottom: '1px solid #f8f8f6' }}>• {tp}</div>
                  ))}
                </div>
              )}
              {research.battle_cards?.length > 0 && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: AMB, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Battle Cards</div>
                  {research.battle_cards.map((bc, i) => (
                    <div key={i} style={{ fontSize: 14, color: '#374151', padding: '3px 0', borderBottom: '1px solid #f8f8f6' }}>⚔️ {bc}</div>
                  ))}
                </div>
              )}
              {research.red_flags?.length > 0 && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>Red Flags</div>
                  {research.red_flags.map((rf, i) => (
                    <div key={i} style={{ fontSize: 14, color: '#374151', padding: '3px 0', borderBottom: '1px solid #f8f8f6' }}>🚩 {rf}</div>
                  ))}
                </div>
              )}
              {!research.talking_points?.length && !research.battle_cards?.length && !research.red_flags?.length && (
                <div style={{ fontSize: 14, color: '#9a9a96' }}>No research data available for this lead.</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: '#9a9a96' }}>No research data available.</div>
          )}
        </div>
      )}

      {/* Routing tab */}
      {tab === 'routing' && (
        <div style={{ padding: '8px 0 4px 50px' }}>
          {loadingRouting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a9a96', fontSize: 14 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing conversation...
            </div>
          ) : routing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Stage + Engagement */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', textTransform: 'uppercase', fontFamily: FH }}>{routing.conversation_stage}</span>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: routing.engagement_signal === 'hot' ? GRN + '15' : routing.engagement_signal === 'cooling' ? R + '15' : routing.engagement_signal === 'warm' ? AMB + '15' : '#f3f4f6', color: routing.engagement_signal === 'hot' ? GRN : routing.engagement_signal === 'cooling' ? R : routing.engagement_signal === 'warm' ? AMB : '#6b7280', textTransform: 'uppercase', fontFamily: FH }}>
                  {routing.engagement_signal === 'hot' ? '🔥' : routing.engagement_signal === 'cooling' ? '❄️' : routing.engagement_signal === 'warm' ? '⚡' : '😐'} {routing.engagement_signal}
                </span>
              </div>

              {/* Suggested Pivot */}
              {routing.suggested_pivot && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: routing.engagement_signal === 'hot' ? GRN + '08' : routing.engagement_signal === 'cooling' ? R + '08' : '#f9fafb', border: `1px solid ${routing.engagement_signal === 'hot' ? GRN + '25' : routing.engagement_signal === 'cooling' ? R + '25' : '#e5e7eb'}` }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>🎯</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'uppercase', letterSpacing: '.02em', marginBottom: 2 }}>Suggested Pivot</div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{routing.suggested_pivot}</div>
                  </div>
                </div>
              )}

              {/* Next Questions */}
              {routing.next_questions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>💡 Ask Next</div>
                  {routing.next_questions.map((q, i) => (
                    <div key={i} style={{ padding: '8px 12px', marginBottom: 4, borderRadius: 8, background: '#f9fafb', border: '1px solid #ececea' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: BLK }}>"{q.question_text}"</span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: q.urgency === 'high' ? R + '15' : q.urgency === 'medium' ? AMB + '15' : '#f3f4f6', color: q.urgency === 'high' ? R : q.urgency === 'medium' ? AMB : '#6b7280', textTransform: 'uppercase' }}>{q.urgency}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9a9a96' }}>{q.rationale}{q.appointment_rate > 0 ? ` · ${q.appointment_rate}% appt rate` : ''}{q.times_asked > 0 ? ` · asked ${q.times_asked}x` : ''}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Battle Cards */}
              {routing.battle_cards?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>⚔️ Competitor Detected</div>
                  {routing.battle_cards.map((bc, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #ececea', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FH, color: BLK, textTransform: 'capitalize' }}>{bc.competitor}</span>
                        <span style={{ fontSize: 12, color: '#9a9a96', fontStyle: 'italic' }}>"{bc.detected_in}"</span>
                      </div>
                      {bc.talking_points.map((tp, j) => (
                        <div key={j} style={{ fontSize: 13, color: '#6b7280', padding: '2px 0' }}>• {tp}</div>
                      ))}
                      <div style={{ fontSize: 13, color: GRN, fontWeight: 600, marginTop: 4 }}>↪ {bc.pivot_question}</div>
                      <div style={{ fontSize: 13, color: BLK, fontStyle: 'italic', background: '#f9fafb', padding: '6px 10px', borderRadius: 6, marginTop: 4 }}>🎯 Probe: "{bc.weakness_to_probe}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: '#9a9a96' }}>No routing data available.</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function VoiceLiveMonitorPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activeCalls, setActiveCalls] = useState([])
  const [recentCalls, setRecentCalls] = useState([])
  const [stats, setStats] = useState({ total_today: 0, active_now: 0, answered_rate: 0, appointments_today: 0, outbound_today: 0, inbound_today: 0 })
  const [webhook, setWebhook] = useState({ retell_configured: false, last_received: null, webhook_url: '' })
  const refreshRef = useRef(null)

  useEffect(() => {
    fetchData()
    refreshRef.current = setInterval(fetchData, 5000)
    return () => clearInterval(refreshRef.current)
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_live_calls' }),
      })
      const data = await res.json()
      if (!data.error) {
        setActiveCalls(data.active_calls || [])
        setRecentCalls(data.recent_calls || [])
        setStats(data.stats || stats)
        setWebhook(data.webhook || webhook)
        setLastUpdate(new Date())
      }
    } catch {}
    setLoading(false)
  }

  async function deleteCall(callId) {
    if (!confirm('Delete this call record? This cannot be undone.')) return
    try {
      await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_call', call_id: callId }),
      })
      setRecentCalls(rs => rs.filter(c => c.id !== callId))
      toast.success('Call deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  async function clearOldCallHistory() {
    if (!confirm('Permanently delete all calls older than 30 days?')) return
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_call_history' }),
      }).then(r => r.json())
      toast.success(`Deleted ${res?.deleted || 0} old calls`)
      fetchData()
    } catch {
      toast.error('Clear failed')
    }
  }

  async function stopCall(callId) {
    try {
      await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_call', call_id: callId }),
      })
      toast.success('Call stopped')
      fetchData()
    } catch { toast.error('Failed to stop call') }
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#111111', margin: 0, letterSpacing: '-.03em' }}>Live Call Monitor</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: activeCalls.length > 0 ? GRN + '20' : 'rgba(255,255,255,.08)', padding: '4px 12px', borderRadius: 20, border: activeCalls.length > 0 ? `1px solid ${GRN}40` : '1px solid rgba(255,255,255,.1)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCalls.length > 0 ? GRN : '#6b7280', animation: activeCalls.length > 0 ? 'pulse-live 2s infinite' : 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: activeCalls.length > 0 ? GRN : 'rgba(255,255,255,.4)', fontFamily: FH }}>
                  {activeCalls.length > 0 ? `${activeCalls.length} Live` : 'No Active Calls'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastUpdate && <span style={{ fontSize: 13, color: '#999999' }}>Updated {timeAgo(lastUpdate)}</span>}
              <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#F5F5F5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Calls Today" value={stats.total_today} icon={Phone} accent={T} sub={`↑${stats.outbound_today} out · ↓${stats.inbound_today} in`} loading={loading} />
            <StatCard label="Active Now" value={stats.active_now} icon={Activity} accent={stats.active_now > 0 ? GRN : '#6b7280'} loading={loading} />
            <StatCard label="Answer Rate" value={`${stats.answered_rate}%`} icon={TrendingUp} accent={stats.answered_rate >= 50 ? GRN : AMB} loading={loading} />
            <StatCard label="Appointments" value={stats.appointments_today} icon={Calendar} accent={'#00C2CB'} loading={loading} />
          </div>

          {/* Active Calls */}
          {activeCalls.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${GRN}30`, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GRN}20`, background: GRN + '06', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: GRN, animation: 'pulse-live 2s infinite' }} />
                  <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: BLK }}>Active Calls</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: GRN + '15', color: GRN }}>{activeCalls.length} live</span>
              </div>
              <div style={{ padding: '8px 12px' }}>
                {activeCalls.map(c => (
                  <LiveCallCard key={c.id} call={c} onStop={stopCall} />
                ))}
              </div>
            </div>
          )}

          {/* Webhook Status + Retell Config */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12 }}>Webhook Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {webhook.retell_configured ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}
                  <span style={{ fontSize: 15, color: webhook.retell_configured ? GRN : R, fontWeight: 600 }}>
                    Retell API key {webhook.retell_configured ? 'configured' : 'not configured'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {webhook.last_received ? <Check size={14} color={GRN} /> : <AlertCircle size={14} color={AMB} />}
                  <span style={{ fontSize: 15, color: webhook.last_received ? '#374151' : AMB, fontWeight: 600 }}>
                    Last webhook: {webhook.last_received ? timeAgo(webhook.last_received) : 'Never received'}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#9a9a96', marginTop: 4 }}>
                  Webhook URL:
                </div>
                <code style={{ fontSize: 14, background: '#f3f4f6', padding: '8px 12px', borderRadius: 8, color: BLK, wordBreak: 'break-all', fontWeight: 600 }}>
                  {webhook.webhook_url || 'https://hellokoto.com/api/voice'}
                </code>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12 }}>Configure Retell</div>
              <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 12 }}>
                To see live call data, configure your webhook URL in the Retell dashboard:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {[
                  { done: webhook.retell_configured, label: 'Retell API key configured' },
                  { done: !!webhook.last_received, label: 'Webhook URL configured in Retell' },
                  { done: false, label: 'Phone number purchased' },
                  { done: false, label: 'First call made' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.done ? <Check size={13} color={GRN} /> : <div style={{ width: 13, height: 13, borderRadius: 3, border: '1.5px solid #d1d5db' }} />}
                    <span style={{ fontSize: 14, color: item.done ? '#374151' : '#9ca3af', fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <a href="https://app.retellai.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH, textDecoration: 'none' }}>
                Open Retell Dashboard <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Recent Calls Table */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: BLK }}>Recent Calls</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, color: '#9a9a96' }}>{recentCalls.length} calls</span>
                <button
                  onClick={clearOldCallHistory}
                  style={{
                    background: '#fff', border: '1px solid #ececea', borderRadius: 7,
                    padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#6b7280',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                  title="Delete calls older than 30 days"
                >
                  <Trash2 size={11} /> Clear &gt; 30 days
                </button>
              </div>
            </div>
            {recentCalls.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 15, fontFamily: FB }}>
                <Phone size={24} color="#d0d0cc" style={{ marginBottom: 8 }} /><br />
                No calls yet. Make a call from the dial pad or configure Retell to start seeing data.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                      {(isMobile
                        ? ['', 'Contact', 'Duration', '']
                        : ['', 'Type', 'Agent', 'Contact', 'Phone', 'Duration', 'Outcome', 'Sentiment', 'Time', '']
                      ).map((h, i) => (
                        <th key={`${h}-${i}`} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: FH, fontSize: 12, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map(c => {
                      const oc = OUTCOME_COLORS[c.outcome] || '#6b7280'
                      return (
                        <tr key={`${c.direction}-${c.id}`} style={{ borderBottom: '1px solid #f8f8f6' }}>
                          <td style={{ padding: '10px 12px' }}>
                            {c.direction === 'inbound' ? <ArrowDown size={14} color={GRN} /> : <ArrowUp size={14} color={R} />}
                          </td>
                          {!isMobile && (
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: c.direction === 'inbound' ? GRN + '12' : R + '12', color: c.direction === 'inbound' ? GRN : R, textTransform: 'uppercase' }}>{c.type}</span>
                            </td>
                          )}
                          {!isMobile && (
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{c.agent || '—'}</td>
                          )}
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: BLK }}>{c.contact || '—'}</td>
                          {!isMobile && (
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 14 }}>{fmtPhone(c.phone)}</td>
                          )}
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmtDur(c.duration)}</td>
                          {!isMobile && (
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: oc + '15', color: oc, textTransform: 'uppercase' }}>{c.outcome}</span>
                            </td>
                          )}
                          {!isMobile && (
                            <td style={{ padding: '10px 12px', fontSize: 18 }}>{SENTIMENT_EMOJI[c.sentiment] || '😐'}</td>
                          )}
                          {!isMobile && (
                            <td style={{ padding: '10px 12px', fontSize: 13, color: '#9a9a96' }}>{timeAgo(c.created_at)}</td>
                          )}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {c.recording_url && (
                                <a href={c.recording_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: T, fontWeight: 700, textDecoration: 'none' }}>
                                  <Play size={11} /> Play
                                </a>
                              )}
                              <button
                                onClick={() => deleteCall(c.id)}
                                title="Delete call"
                                style={{
                                  background: 'none', border: 'none', padding: isMobile ? 10 : 4, cursor: 'pointer',
                                  color: '#9ca3af', display: 'flex', alignItems: 'center', minWidth: isMobile ? 44 : 'auto', minHeight: isMobile ? 44 : 'auto',
                                  justifyContent: 'center',
                                }}
                                onMouseEnter={ev => ev.currentTarget.style.color = '#dc2626'}
                                onMouseLeave={ev => ev.currentTarget.style.color = '#9ca3af'}
                              >
                                <Trash2 size={isMobile ? 14 : 12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse-live{0%,100%{opacity:1;box-shadow:0 0 0 0 ${GRN}60}50%{opacity:.7;box-shadow:0 0 0 8px ${GRN}00}}`}</style>
    </div>
  )
}
