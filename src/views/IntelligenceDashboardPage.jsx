"use client"
import { useState, useEffect } from 'react'
import {
  Brain, Clock, TrendingUp, BarChart2, Target, Zap, RefreshCw, Loader2,
  AlertTriangle, ChevronRight, Mail, Phone, DollarSign
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R='#ea2729',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const W='#ffffff',FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",FB="'Raleway','Helvetica Neue',sans-serif"

const API = '/api/intelligence'
async function apiGet(action, params={}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k,v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOURS = [8,9,10,11,12,13,14,15,16,17]

function heatColor(val) {
  if (val >= 20) return '#dc2626'
  if (val >= 15) return '#ea580c'
  if (val >= 10) return '#d97706'
  if (val >= 5) return '#65a30d'
  return '#e5e7eb'
}

const DECAY_COLORS = { fresh:'#16a34a', warm:'#d97706', cooling:'#ea580c', cold:'#dc2626', frozen:'#6366f1', dead:'#6b7280' }
const DECAY_EMOJI = { fresh:'🟢', warm:'🟡', cooling:'🟠', cold:'🔴', frozen:'❄️', dead:'💀' }

export default function IntelligenceDashboardPage() {
  const { agencyId } = useAuth()
  const [tab, setTab] = useState('heatmap')
  const [loading, setLoading] = useState(false)

  // Heatmap state
  const [heatmapData, setHeatmapData] = useState(null)
  const [heatmapBest, setHeatmapBest] = useState(null)
  const [selectedIndustry, setSelectedIndustry] = useState('1711')

  // Decay state
  const [decayData, setDecayData] = useState(null)

  // Velocity state
  const [velocityData, setVelocityData] = useState(null)

  // Debrief state
  const [debriefs, setDebriefs] = useState([])

  async function loadHeatmap() {
    setLoading(true)
    const res = await apiGet('get_heatmap', { sic_code: selectedIndustry })
    setHeatmapData(res.heatmap)
    setHeatmapBest(res.best)
    setLoading(false)
  }

  async function loadDecay() {
    setLoading(true)
    const res = await apiGet('get_decay_dashboard', { agency_id: agencyId })
    setDecayData(res)
    setLoading(false)
  }

  async function loadVelocity() {
    setLoading(true)
    const res = await apiGet('get_velocity_insights', { agency_id: agencyId })
    setVelocityData(res)
    setLoading(false)
  }

  async function loadDebriefs() {
    setLoading(true)
    const res = await apiGet('get_debrief_history', { agency_id: agencyId })
    setDebriefs(res.data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'heatmap') loadHeatmap()
    if (tab === 'decay') loadDecay()
    if (tab === 'velocity') loadVelocity()
    if (tab === 'debrief') loadDebriefs()
  }, [tab, selectedIndustry])

  async function sendDebriefNow() {
    toast.success('Sending debrief...')
    const res = await apiPost({ action: 'send_debrief_now', agency_id: agencyId })
    if (res.sent) toast.success('Debrief sent!'); else toast.error('No calls today to debrief')
  }

  async function runDecayNow() {
    toast.success('Running decay update...')
    await apiPost({ action: 'run_decay_update', agency_id: agencyId })
    toast.success('Decay updated'); loadDecay()
  }

  const TABS = [
    { key:'heatmap', label:'Call Timing', icon:Clock },
    { key:'decay', label:'Lead Decay', icon:AlertTriangle },
    { key:'velocity', label:'Deal Velocity', icon:TrendingUp },
    { key:'debrief', label:'Daily Debrief', icon:Mail },
  ]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        {/* Header */}
        <div style={{ background:BLK, padding:'24px 32px', borderBottom:`3px solid ${R}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:`linear-gradient(135deg,${R},${T})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Brain size={20} color={W} />
            </div>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:W, margin:0 }}>Predictive Intelligence</h1>
              <p style={{ fontFamily:FB, fontSize:12, color:'rgba(255,255,255,.4)', margin:0 }}>Every lead scored. Every call optimized. Every deal tracked.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, padding:'16px 32px 0', borderBottom:'1px solid #e5e7eb' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'10px 18px', fontSize:13, fontWeight:tab===t.key?700:500, fontFamily:FH,
              border:'none', borderBottom:tab===t.key?`2px solid ${R}`:'2px solid transparent',
              background:'none', cursor:'pointer', color:tab===t.key?BLK:'#9ca3af',
            }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'24px 32px' }}>
          {loading && <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={R} style={{ animation:'spin 1s linear infinite' }} /></div>}

          {/* HEATMAP TAB */}
          {tab === 'heatmap' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, cursor:'pointer' }}>
                  {[['1711','Plumbing'],['8021','Dental'],['7699','HVAC'],['1761','Roofing'],['5812','Restaurant'],['8111','Legal'],['8011','Medical'],['6531','Real Estate'],['7532','Auto Repair']].map(([c,n]) => <option key={c} value={c}>{n}</option>)}
                </select>
                <button onClick={loadHeatmap} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>
                  <RefreshCw size={12} style={{ verticalAlign:'middle', marginRight:4 }} /> Refresh
                </button>
              </div>

              {heatmapBest && (
                <div style={{ padding:'14px 20px', background:`${GRN}10`, borderRadius:10, borderLeft:`3px solid ${GRN}`, marginBottom:20, fontSize:13, fontFamily:FB, color:'#374151' }}>
                  <strong>Best time:</strong> {heatmapBest.best_window} ({Math.round(heatmapBest.connection_rate * 100)}% connection, {Math.round(heatmapBest.appointment_rate * 100)}% appointment)
                </div>
              )}

              {/* Heatmap Grid */}
              {heatmapData && (
                <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb', overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%' }}>
                    <thead>
                      <tr>
                        <th style={{ padding:'6px 8px', fontSize:11, fontFamily:FB, color:'#9ca3af', textAlign:'left' }}></th>
                        {HOURS.map(h => <th key={h} style={{ padding:'6px 8px', fontSize:10, fontFamily:FB, color:'#9ca3af', textAlign:'center' }}>{h > 12 ? h-12+'pm' : h+'am'}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2,3,4,5,6,0].map(day => (
                        <tr key={day}>
                          <td style={{ padding:'6px 8px', fontSize:11, fontWeight:600, fontFamily:FH, color:BLK, width:50 }}>{DAYS[day]}</td>
                          {HOURS.map(h => {
                            const val = heatmapData[day]?.[h] || 0
                            return (
                              <td key={h} style={{ padding:3 }}>
                                <div title={`${DAYS[day]} ${h}:00 — ${val}% appt rate`} style={{
                                  width:36, height:28, borderRadius:4, background:heatColor(val),
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:9, fontWeight:700, fontFamily:FB, color:val >= 10 ? W : '#9ca3af',
                                  cursor:'pointer',
                                }}>
                                  {val > 0 ? val + '%' : ''}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display:'flex', gap:12, marginTop:12, fontSize:10, color:'#9ca3af', fontFamily:FB }}>
                    <span><span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:'#dc2626', verticalAlign:'middle', marginRight:4 }} />20%+ appt rate</span>
                    <span><span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:'#ea580c', verticalAlign:'middle', marginRight:4 }} />15-20%</span>
                    <span><span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:'#d97706', verticalAlign:'middle', marginRight:4 }} />10-15%</span>
                    <span><span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:'#65a30d', verticalAlign:'middle', marginRight:4 }} />5-10%</span>
                    <span><span style={{ display:'inline-block', width:12, height:12, borderRadius:2, background:'#e5e7eb', verticalAlign:'middle', marginRight:4 }} />No data</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DECAY TAB */}
          {tab === 'decay' && !loading && decayData && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>Lead Decay Overview</h2>
                <button onClick={runDecayNow} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:R, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                  <RefreshCw size={14} /> Run Decay Update
                </button>
              </div>

              {/* Stage cards */}
              <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
                {(decayData.by_stage || []).map(s => (
                  <div key={s.stage} style={{ flex:1, minWidth:120, padding:'16px 18px', background:W, borderRadius:10, borderTop:`3px solid ${DECAY_COLORS[s.stage] || '#6b7280'}`, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                    <div style={{ fontSize:12, fontWeight:700, fontFamily:FB, color:'#9ca3af', marginBottom:4 }}>{DECAY_EMOJI[s.stage] || ''} {s.stage.charAt(0).toUpperCase() + s.stage.slice(1)}</div>
                    <div style={{ fontSize:28, fontWeight:800, fontFamily:FH, color:BLK }}>{s.count}</div>
                  </div>
                ))}
              </div>

              {decayData.urgent_count > 0 && (
                <div style={{ padding:'14px 20px', background:'#fef2f2', borderRadius:10, borderLeft:`3px solid ${R}`, marginBottom:16, fontSize:13, fontFamily:FB, color:R }}>
                  <AlertTriangle size={14} style={{ verticalAlign:'middle', marginRight:6 }} />
                  <strong>{decayData.urgent_count}</strong> leads need immediate attention
                </div>
              )}

              {decayData.recommended_actions?.length > 0 && (
                <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb' }}>
                  <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 12px' }}>Recommended Actions</h3>
                  {decayData.recommended_actions.map((a, i) => (
                    <div key={i} style={{ padding:'8px 0', borderBottom:i < decayData.recommended_actions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize:13, fontFamily:FB, color:'#374151' }}>
                      <ChevronRight size={12} color={R} style={{ verticalAlign:'middle', marginRight:6 }} />{a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VELOCITY TAB */}
          {tab === 'velocity' && !loading && velocityData && (
            <div>
              <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 20px' }}>Deal Velocity Insights</h2>

              <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                {[
                  { label:'Avg Days to Appt', value:velocityData.avg_days_to_appointment, accent:T },
                  { label:'Avg Days to Close', value:velocityData.avg_days_to_close, accent:AMB },
                  { label:'Total Cycle', value:`${velocityData.avg_total_cycle}d`, accent:R },
                  { label:'Total Won', value:velocityData.total_won, accent:GRN },
                  { label:'Revenue', value:`$${(velocityData.total_revenue || 0).toLocaleString()}`, accent:GRN },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, minWidth:130, padding:'16px 18px', background:W, borderRadius:10, borderTop:`3px solid ${s.accent}`, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                    <div style={{ fontSize:10, fontWeight:700, fontFamily:FB, color:'#9ca3af', textTransform:'uppercase', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:24, fontWeight:800, fontFamily:FH, color:BLK }}>{s.value || 0}</div>
                  </div>
                ))}
              </div>

              {velocityData.winning_opening_lines?.length > 0 && (
                <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb', marginBottom:16 }}>
                  <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 12px' }}>Winning Opening Lines</h3>
                  {velocityData.winning_opening_lines.map((l, i) => (
                    <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13, fontFamily:FB, color:'#374151', fontStyle:'italic' }}>"{l}"</div>
                  ))}
                </div>
              )}

              {velocityData.top_pain_points?.length > 0 && (
                <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb', marginBottom:16 }}>
                  <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 12px' }}>Top Pain Points (Won Deals)</h3>
                  {velocityData.top_pain_points.map((p, i) => (
                    <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13, fontFamily:FB, color:'#374151' }}>
                      <Target size={12} color={R} style={{ verticalAlign:'middle', marginRight:6 }} />{p}
                    </div>
                  ))}
                </div>
              )}

              {velocityData.lost_reasons?.length > 0 && (
                <div style={{ background:W, borderRadius:12, padding:'20px 24px', border:'1px solid #e5e7eb' }}>
                  <h3 style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, margin:'0 0 12px' }}>Why Deals Were Lost</h3>
                  {velocityData.lost_reasons.map((r, i) => (
                    <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13, fontFamily:FB, color:R }}>
                      <AlertTriangle size={12} style={{ verticalAlign:'middle', marginRight:6 }} />{r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEBRIEF TAB */}
          {tab === 'debrief' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>Daily Debrief Emails</h2>
                <button onClick={sendDebriefNow} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, border:'none', background:R, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                  <Mail size={14} /> Send Debrief Now
                </button>
              </div>

              {debriefs.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <Mail size={48} color="#d1d5db" style={{ marginBottom:16 }} />
                  <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 8px' }}>No Debriefs Yet</h3>
                  <p style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>Debrief emails are sent automatically at 8pm. Click "Send Debrief Now" to generate one.</p>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {debriefs.map(d => (
                  <div key={d.id} style={{ padding:'16px 20px', borderRadius:10, background:W, border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:BLK }}>{new Date(d.date_covered + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</div>
                      <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:2 }}>
                        {d.calls_count} calls | {d.appointments_count} appointments | Sent to {d.sent_to}
                      </div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:700, fontFamily:FB, background:GRN+'20', color:GRN }}>{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
