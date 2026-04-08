"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing,
  Activity, Clock, TrendingUp, Loader2, RefreshCw, Shield,
  BarChart2, Play, ExternalLink, AlertCircle, Check, Zap,
  ArrowUp, ArrowDown, Calendar, Volume2, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function fmtDur(s) { if (!s) return '0:00'; const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}` }
function timeAgo(d) { if (!d) return ''; const diff = Date.now()-new Date(d).getTime(); const m = Math.floor(diff/60000); if (m<1) return 'just now'; if (m<60) return `${m}m ago`; const h = Math.floor(m/60); if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago` }
function fmtPhone(n) { if (!n) return ''; const d = n.replace(/\D/g,''); if (d.length===11&&d[0]==='1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`; if (d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; return n }

const OUTCOME_COLORS = { completed: GRN, answered: GRN, appointment: '#7c3aed', voicemail: AMB, no_answer: '#6b7280', transferred: T, emergency: R, in_progress: GRN, ringing: AMB, initiated: AMB, stopped: R }
const SENTIMENT_EMOJI = { positive: '😊', neutral: '😐', negative: '😟', frustrated: '😤' }

function StatCard({ label, value, icon: Icon, accent = T, sub, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden', flex: 1, minWidth: 140 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, lineHeight: 1 }}>{loading ? '—' : value}</div>
          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
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
              <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#111111', margin: 0, letterSpacing: '-.03em' }}>Live Call Monitor</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: activeCalls.length > 0 ? GRN + '20' : 'rgba(255,255,255,.08)', padding: '4px 12px', borderRadius: 20, border: activeCalls.length > 0 ? `1px solid ${GRN}40` : '1px solid rgba(255,255,255,.1)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCalls.length > 0 ? GRN : '#6b7280', animation: activeCalls.length > 0 ? 'pulse-live 2s infinite' : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: activeCalls.length > 0 ? GRN : 'rgba(255,255,255,.4)', fontFamily: FH }}>
                  {activeCalls.length > 0 ? `${activeCalls.length} Live` : 'No Active Calls'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastUpdate && <span style={{ fontSize: 11, color: '#999999' }}>Updated {timeAgo(lastUpdate)}</span>}
              <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#F5F5F5', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FH }}>
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
            <StatCard label="Appointments" value={stats.appointments_today} icon={Calendar} accent={'#7c3aed'} loading={loading} />
          </div>

          {/* Active Calls */}
          {activeCalls.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${GRN}30`, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GRN}20`, background: GRN + '06', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: GRN, animation: 'pulse-live 2s infinite' }} />
                  <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Active Calls</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: GRN + '15', color: GRN }}>{activeCalls.length} live</span>
              </div>
              <div style={{ padding: '8px 12px' }}>
                {activeCalls.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: c.direction === 'inbound' ? GRN + '15' : R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.direction === 'inbound' ? <PhoneIncoming size={16} color={GRN} /> : <PhoneOutgoing size={16} color={R} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{c.contact_name || c.contact_phone || 'Unknown'}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: c.direction === 'inbound' ? GRN + '15' : R + '15', color: c.direction === 'inbound' ? GRN : R, textTransform: 'uppercase' }}>{c.direction}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9a9a96' }}>{fmtPhone(c.contact_phone)} {c.agent_name ? `· ${c.agent_name}` : ''}</div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: GRN }}>{fmtDur(c.duration_seconds || 0)}</div>
                    <button onClick={() => stopCall(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: R + '15', color: R, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FH }}>
                      <PhoneOff size={12} /> Stop
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Webhook Status + Retell Config */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Webhook Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {webhook.retell_configured ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}
                  <span style={{ fontSize: 13, color: webhook.retell_configured ? GRN : R, fontWeight: 600 }}>
                    Retell API key {webhook.retell_configured ? 'configured' : 'not configured'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {webhook.last_received ? <Check size={14} color={GRN} /> : <AlertCircle size={14} color={AMB} />}
                  <span style={{ fontSize: 13, color: webhook.last_received ? '#374151' : AMB, fontWeight: 600 }}>
                    Last webhook: {webhook.last_received ? timeAgo(webhook.last_received) : 'Never received'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9a9a96', marginTop: 4 }}>
                  Webhook URL:
                </div>
                <code style={{ fontSize: 12, background: '#f3f4f6', padding: '8px 12px', borderRadius: 8, color: BLK, wordBreak: 'break-all', fontWeight: 600 }}>
                  {webhook.webhook_url || 'https://hellokoto.com/api/voice'}
                </code>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12 }}>Configure Retell</div>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 12 }}>
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
                    <span style={{ fontSize: 12, color: item.done ? '#374151' : '#9ca3af', fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <a href="https://app.retellai.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: BLK, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, textDecoration: 'none' }}>
                Open Retell Dashboard <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Recent Calls Table */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Recent Calls</div>
              <span style={{ fontSize: 12, color: '#9a9a96' }}>{recentCalls.length} calls</span>
            </div>
            {recentCalls.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13, fontFamily: FB }}>
                <Phone size={24} color="#d0d0cc" style={{ marginBottom: 8 }} /><br />
                No calls yet. Make a call from the dial pad or configure Retell to start seeing data.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                      {['', 'Type', 'Agent', 'Contact', 'Phone', 'Duration', 'Outcome', 'Sentiment', 'Time', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: FH, fontSize: 10, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
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
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: c.direction === 'inbound' ? GRN + '12' : R + '12', color: c.direction === 'inbound' ? GRN : R, textTransform: 'uppercase' }}>{c.type}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#6b7280' }}>{c.agent || '—'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: BLK }}>{c.contact || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{fmtPhone(c.phone)}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{fmtDur(c.duration)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: oc + '15', color: oc, textTransform: 'uppercase' }}>{c.outcome}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 16 }}>{SENTIMENT_EMOJI[c.sentiment] || '😐'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#9a9a96' }}>{timeAgo(c.created_at)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {c.recording_url && (
                              <a href={c.recording_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T, fontWeight: 700, textDecoration: 'none' }}>
                                <Play size={11} /> Play
                              </a>
                            )}
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
