"use client";
import { useState, useEffect } from 'react'
import {
  Phone, Calendar, Clock, Users, Check, X, AlertCircle, Star,
  TrendingUp, ChevronRight, ChevronDown, FileText, Target,
  DollarSign, Loader2, RefreshCw
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const R   = '#E6007E'
const T   = '#00C2CB'
const BLK = '#111111'
const GRY = '#F9F9F9'
const W   = '#ffffff'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const API = '/api/voice'

async function api(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtTime(t) {
  if (!t) return '--'
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  const ampm = hr >= 12 ? 'PM' : 'AM'
  return `${hr % 12 || 12}:${m} ${ampm}`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '$0'
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

/* ── Score color ── */
function scoreColor(score) {
  if (score >= 80) return GRN
  if (score >= 50) return AMB
  return R
}

/* ── Intent badge ── */
function IntentBadge({ level }) {
  const cfg = {
    high:   { label: 'High Intent',   bg: '#dcfce7', color: GRN },
    medium: { label: 'Medium Intent', bg: '#fef3c7', color: AMB },
    low:    { label: 'Low Intent',    bg: '#f3f4f6', color: '#6b7280' },
  }
  const c = cfg[level] || cfg.low
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, fontFamily: FB,
      background: c.bg, color: c.color
    }}>
      {c.label}
    </span>
  )
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, accent = T }) {
  return (
    <div style={{
      flex: 1, minWidth: 180, background: W, borderRadius: 12,
      padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      borderTop: `3px solid ${accent}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: accent + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={16} color={accent} />
        </div>
        <span style={{ fontSize: 11, color: '#888', fontFamily: FB, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: FH, color: BLK }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#999', fontFamily: FB, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ── Appointment Card ── */
function AppointmentCard({ appt, lead, onAction, expanded, onToggle }) {
  const [dealValue, setDealValue] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  const talkingPoints = lead?.ai_talking_points || []
  const painPoint = lead?.prospect_pain_point || ''
  const objection = lead?.prospect_objection || ''
  const transcript = appt.call_transcript || ''
  const score = lead?.lead_score ?? appt.lead_score ?? 0
  const intent = lead?.intent_level || appt.intent_level || 'low'

  async function handleAction(action) {
    setActionLoading(action)
    try {
      const payload = {
        action: 'update_appointment_outcome',
        appointment_id: appt.id,
        outcome: action,
      }
      if (action === 'closed' && dealValue) {
        payload.deal_value = parseFloat(dealValue)
      }
      const res = await api(payload)
      if (res.error) throw new Error(res.error)
      toast.success(
        action === 'closed' ? 'Deal marked as closed!' :
        action === 'rescheduled' ? 'Appointment rescheduled' :
        'Marked as no-show'
      )
      onAction()
    } catch (e) {
      toast.error(e.message || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{
      background: W, borderRadius: 14, padding: 0, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e5e7eb',
      marginBottom: 14
    }}>
      {/* Top bar */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          borderBottom: expanded ? '1px solid #f0f0f0' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#E6007E',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Phone size={18} color={W} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK }}>
              {lead?.prospect_name || appt.prospect_name || 'Unknown Prospect'}
            </div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: FB }}>
              {lead?.prospect_company || appt.prospect_company || ''}
              {(lead?.prospect_company || appt.prospect_company) && ' · '}
              {fmtTime(appt.appointment_time)}
              {appt.duration_minutes ? ` · ${appt.duration_minutes} min` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: scoreColor(score) + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, fontFamily: FH,
            color: scoreColor(score)
          }}>
            {score}
          </div>
          <IntentBadge level={intent} />
          {appt.outcome && (
            <span style={{
              padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, fontFamily: FB,
              background: appt.outcome === 'closed' ? '#dcfce7' : appt.outcome === 'no_show' ? '#fef2f2' : '#fef3c7',
              color: appt.outcome === 'closed' ? GRN : appt.outcome === 'no_show' ? R : AMB
            }}>
              {appt.outcome === 'closed' ? 'Closed' : appt.outcome === 'no_show' ? 'No Show' : 'Rescheduled'}
            </span>
          )}
          {expanded ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          {/* Contact info */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 12, marginBottom: 16, padding: '12px 14px',
            background: '#f9fafb', borderRadius: 10
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', fontFamily: FB, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{lead?.prospect_phone || appt.prospect_phone || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', fontFamily: FB, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{lead?.prospect_email || appt.prospect_email || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', fontFamily: FB, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>{lead?.prospect_company || appt.prospect_company || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', fontFamily: FB, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lead Score</div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: FH, color: scoreColor(score) }}>{score}/100</div>
            </div>
          </div>

          {/* Pain Point */}
          {painPoint && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FB, color: R, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Pain Point
              </div>
              <div style={{ fontSize: 13, fontFamily: FH, color: '#374151', lineHeight: 1.5, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: `3px solid ${R}` }}>
                {painPoint}
              </div>
            </div>
          )}

          {/* Expected Objections */}
          {objection && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FB, color: AMB, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                <Target size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Expected Objections
              </div>
              <div style={{ fontSize: 13, fontFamily: FH, color: '#374151', lineHeight: 1.5, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, borderLeft: `3px solid ${AMB}` }}>
                {objection}
              </div>
            </div>
          )}

          {/* AI Talking Points */}
          {talkingPoints.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FB, color: T, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                <Star size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> AI Talking Points
              </div>
              <div style={{ padding: '10px 14px', background: '#f0fdfa', borderRadius: 8, borderLeft: `3px solid ${T}` }}>
                {talkingPoints.map((tp, i) => (
                  <div key={i} style={{ fontSize: 13, fontFamily: FH, color: '#374151', lineHeight: 1.6, display: 'flex', gap: 6, marginBottom: i < talkingPoints.length - 1 ? 4 : 0 }}>
                    <span style={{ color: T, fontWeight: 700 }}>•</span>
                    <span>{typeof tp === 'string' ? tp : tp.point || tp.text || JSON.stringify(tp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call Transcript */}
          {transcript && (
            <div style={{ marginBottom: 14 }}>
              <div
                onClick={() => setShowTranscript(!showTranscript)}
                style={{
                  fontSize: 12, fontWeight: 600, fontFamily: FB, color: '#6b7280',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 0', userSelect: 'none'
                }}
              >
                <FileText size={13} />
                View Call Transcript
                {showTranscript ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>
              {showTranscript && (
                <div style={{
                  fontSize: 12, fontFamily: 'monospace', color: '#374151',
                  background: '#f9fafb', borderRadius: 8, padding: '12px 14px',
                  maxHeight: 260, overflowY: 'auto', lineHeight: 1.7,
                  border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap'
                }}>
                  {transcript}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!appt.outcome && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Deal value $"
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  style={{
                    width: 120, padding: '8px 10px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 13, fontFamily: FH,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleAction('closed')}
                  disabled={!!actionLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: GRN, color: W, fontSize: 13, fontWeight: 700,
                    fontFamily: FH, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1
                  }}
                >
                  {actionLoading === 'closed' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  Mark as Closed
                </button>
              </div>
              <button
                onClick={() => handleAction('rescheduled')}
                disabled={!!actionLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${AMB}`,
                  background: W, color: AMB, fontSize: 13, fontWeight: 700,
                  fontFamily: FH, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1
                }}
              >
                {actionLoading === 'rescheduled' ? <Loader2 size={14} className="spin" /> : <Calendar size={14} />}
                Reschedule
              </button>
              <button
                onClick={() => handleAction('no_show')}
                disabled={!!actionLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, border: `1px solid #d1d5db`,
                  background: W, color: '#6b7280', fontSize: 13, fontWeight: 700,
                  fontFamily: FH, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1
                }}
              >
                {actionLoading === 'no_show' ? <Loader2 size={14} className="spin" /> : <X size={14} />}
                No Show
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function VoiceCloserPage() {
  const { agencyId } = useAuth()
  const aid = agencyId || (typeof window !== 'undefined' && localStorage.getItem('agency_id')) || null

  const [appointments, setAppointments] = useState([])
  const [leads, setLeads] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const today = todayStr()

  /* ── Fetch appointments + leads ── */
  async function loadData() {
    if (!aid) return
    setLoading(true)
    try {
      // Fetch today's appointments
      const { data: appts, error: apptErr } = await supabase
        .from('koto_voice_appointments')
        .select('*')
        .eq('agency_id', aid)
        .eq('appointment_date', today)
        .order('appointment_time', { ascending: true })

      if (apptErr) throw apptErr

      setAppointments(appts || [])

      // Fetch related leads
      const leadIds = [...new Set((appts || []).map(a => a.lead_id).filter(Boolean))]
      if (leadIds.length > 0) {
        const { data: lds, error: ldErr } = await supabase
          .from('koto_voice_leads')
          .select('*')
          .in('id', leadIds)

        if (ldErr) throw ldErr

        const map = {}
        ;(lds || []).forEach(l => { map[l.id] = l })
        setLeads(map)
      } else {
        setLeads({})
      }
    } catch (e) {
      console.error('Load error:', e)
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  useEffect(() => { loadData() }, [aid])

  /* ── Computed stats ── */
  const closedAppts = appointments.filter(a => a.outcome === 'closed')
  const totalAppts = appointments.length
  const closedCount = closedAppts.length
  const closeRate = totalAppts > 0 ? Math.round((closedCount / totalAppts) * 100) : 0
  const revenueToday = closedAppts.reduce((sum, a) => sum + (a.deal_value || 0), 0)
  const avgDealValue = closedCount > 0 ? Math.round(revenueToday / closedCount) : 0
  const pipelineValue = appointments.filter(a => !a.outcome).reduce((sum, a) => sum + (a.estimated_value || a.deal_value || 0), 0)

  const pendingAppts = appointments.filter(a => !a.outcome)
  const noShowAppts = appointments.filter(a => a.outcome === 'no_show')
  const rescheduledAppts = appointments.filter(a => a.outcome === 'rescheduled')

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ── Header ── */}
        <div style={{
          background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '16px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#E6007E',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Target size={18} color={W} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111', fontFamily: FH }}>Closer Dashboard</h1>
              <p style={{ margin: 0, fontSize: 11, color: '#888', fontFamily: FB }}>{fmtDate(today)}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${T}`,
              background: 'transparent', color: T, fontSize: 13, fontWeight: 600,
              fontFamily: FH, cursor: 'pointer', opacity: refreshing ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard icon={Calendar} label="Today's Appointments" value={totalAppts} sub={`${pendingAppts.length} pending`} accent={T} />
            <StatCard icon={Check} label="Closed Today" value={closedCount} sub={`${noShowAppts.length} no-show, ${rescheduledAppts.length} rescheduled`} accent={GRN} />
            <StatCard icon={TrendingUp} label="Close Rate" value={`${closeRate}%`} sub={`${closedCount} of ${totalAppts} appointments`} accent={AMB} />
            <StatCard icon={DollarSign} label="Revenue Today" value={fmtCurrency(revenueToday)} sub={`Avg deal: ${fmtCurrency(avgDealValue)}`} accent={R} />
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Loader2 size={28} color={T} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* No appointments */}
          {!loading && appointments.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 20px', background: W,
              borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)'
            }}>
              <Calendar size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK, marginBottom: 4 }}>No Appointments Today</div>
              <div style={{ fontSize: 13, color: '#888', fontFamily: FB }}>There are no closer appointments scheduled for today.</div>
            </div>
          )}

          {/* ── Upcoming / Pending Appointments ── */}
          {!loading && pendingAppts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14
              }}>
                <Clock size={16} color={T} />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>
                  Today's Appointments
                </h2>
                <span style={{
                  background: T + '20', color: T, fontSize: 11, fontWeight: 700,
                  fontFamily: FB, padding: '2px 10px', borderRadius: 99
                }}>
                  {pendingAppts.length}
                </span>
              </div>
              {pendingAppts.map(appt => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  lead={leads[appt.lead_id]}
                  onAction={loadData}
                  expanded={expandedId === appt.id}
                  onToggle={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                />
              ))}
            </div>
          )}

          {/* ── Closed Deals Section ── */}
          {!loading && closedAppts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14
              }}>
                <Check size={16} color={GRN} />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>
                  Closed Deals
                </h2>
                <span style={{
                  background: GRN + '20', color: GRN, fontSize: 11, fontWeight: 700,
                  fontFamily: FB, padding: '2px 10px', borderRadius: 99
                }}>
                  {closedAppts.length}
                </span>
              </div>
              <div style={{
                background: W, borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #e5e7eb'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prospect</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Time</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Deal Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedAppts.map(appt => {
                      const ld = leads[appt.lead_id]
                      return (
                        <tr key={appt.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK }}>
                            {ld?.prospect_name || appt.prospect_name || '--'}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>
                            {ld?.prospect_company || appt.prospect_company || '--'}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: FB, color: '#6b7280' }}>
                            {fmtTime(appt.appointment_time)}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 800, fontFamily: FH, color: GRN, textAlign: 'right' }}>
                            {fmtCurrency(appt.deal_value)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Completed (No-show / Rescheduled) ── */}
          {!loading && (noShowAppts.length > 0 || rescheduledAppts.length > 0) && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14
              }}>
                <AlertCircle size={16} color="#6b7280" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>
                  Other Outcomes
                </h2>
              </div>
              {[...noShowAppts, ...rescheduledAppts].map(appt => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  lead={leads[appt.lead_id]}
                  onAction={loadData}
                  expanded={expandedId === appt.id}
                  onToggle={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                />
              ))}
            </div>
          )}

          {/* ── Bottom Stats ── */}
          {!loading && appointments.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 14, marginBottom: 28
            }}>
              {/* Close Rate Trend */}
              <div style={{
                background: W, borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <TrendingUp size={16} color={T} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Close Rate</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, fontFamily: FH, color: BLK }}>{closeRate}%</div>
                <div style={{ fontSize: 12, color: '#888', fontFamily: FB, marginTop: 2 }}>
                  {closedCount} closed out of {totalAppts} total
                </div>
                <div style={{
                  marginTop: 10, height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${closeRate}%`,
                    background: `linear-gradient(90deg,${T},${GRN})`,
                    transition: 'width .4s ease'
                  }} />
                </div>
              </div>

              {/* Avg Deal Value */}
              <div style={{
                background: W, borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <DollarSign size={16} color={GRN} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg Deal Value</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, fontFamily: FH, color: BLK }}>{fmtCurrency(avgDealValue)}</div>
                <div style={{ fontSize: 12, color: '#888', fontFamily: FB, marginTop: 2 }}>
                  Across {closedCount} closed deal{closedCount !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Total Pipeline */}
              <div style={{
                background: W, borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Target size={16} color={R} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FB, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pipeline Value</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, fontFamily: FH, color: BLK }}>{fmtCurrency(pipelineValue)}</div>
                <div style={{ fontSize: 12, color: '#888', fontFamily: FB, marginTop: 2 }}>
                  {pendingAppts.length} pending appointment{pendingAppts.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
