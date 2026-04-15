"use client"
import { useState, useEffect } from 'react'
import { TrendingUp, Users, Star, Globe, Clock, Camera, Sparkles, Loader2, Search, RefreshCw, ChevronDown, ChevronUp, Target, AlertTriangle, Zap, BarChart2, Award, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../../lib/theme'
const PURPLE = '#8b5cf6'

function ScoreRing({ score, size = 80, label }) {
  const color = score >= 70 ? GREEN : score >= 50 ? AMBER : RED
  const r = size / 2 - 7
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FH, fontSize: size > 70 ? 20 : 14, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        {label && <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FH, textTransform: 'uppercase' }}>{label}</div>}
      </div>
    </div>
  )
}

function StatCompare({ label, client, competitor, higherIsBetter = true }) {
  const clientVal  = parseFloat(client)  || 0
  const compVal    = parseFloat(competitor) || 0
  const clientWins = higherIsBetter ? clientVal >= compVal : clientVal <= compVal
  const diff       = Math.abs(clientVal - compVal)
  const icon       = clientVal === compVal ? <Minus size={12}/> : clientWins ? <ArrowUp size={12}/> : <ArrowDown size={12}/>
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FH, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 900, color: clientWins ? GREEN : RED }}>
          {client}
        </span>
        <span style={{ color: clientWins ? GREEN : RED }}>{icon}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
        vs {competitor}
      </div>
    </div>
  )
}

function CompetitorCard({ comp, client, rank }) {
  const [open, setOpen] = useState(false)
  const isLeader = rank === 1
  const color = comp.score >= 70 ? GREEN : comp.score >= 50 ? AMBER : RED
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${open || isLeader ? (isLeader ? AMBER : RED + '40') : '#e5e7eb'}`, overflow: 'hidden', transition: 'border-color .15s' }}>
      <div onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: isLeader ? AMBER + '20' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 13, fontWeight: 900, color: isLeader ? AMBER : '#374151', flexShrink: 0 }}>
          {isLeader ? '👑' : `#${rank}`}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.address}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 900, color: comp.rating >= (client?.rating || 0) ? RED : GREEN }}>
              ★{comp.rating || '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FH }}>{comp.review_count} reviews</div>
          </div>
          <ScoreRing score={comp.score} size={52} label="score"/>
          {open ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 18px', background: '#fafafa' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
            <StatCompare label="Rating"   client={client?.rating   || '—'} competitor={comp.rating      || '—'} />
            <StatCompare label="Reviews"  client={client?.review_count || 0} competitor={comp.review_count} />
            <StatCompare label="Photos"   client={client?.photo_count  || 0} competitor={comp.photo_count} />
            <StatCompare label="Website"  client={client?.has_website ? 'Yes' : 'No'} competitor={comp.has_website ? 'Yes' : 'No'} higherIsBetter={true}/>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {comp.has_website && <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: GREEN, fontFamily: FH, fontWeight: 700 }}>Has website</span>}
            {comp.has_hours   && <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: '#eff6ff', color: '#3b82f6', fontFamily: FH, fontWeight: 700 }}>Hours set</span>}
            {comp.photo_count >= 10 && <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: '#f5f3ff', color: PURPLE, fontFamily: FH, fontWeight: 700 }}>10+ photos</span>}
            {comp.description && <div style={{ width: '100%', fontSize: 12, color: '#6b7280', fontFamily: FB, lineHeight: 1.5, marginTop: 4, fontStyle: 'italic' }}>"{comp.description}"</div>}
          </div>
          {comp.website && (
            <a href={comp.website} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12, color: TEAL, fontFamily: FH, fontWeight: 700 }}>
              <Globe size={12}/> Visit their website
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompetitorIntelPage() {
  const { agencyId }     = useAuth()
  const { selectedClient } = useClient()
  const [clients,     setClients]    = useState([])
  const [clientId,    setClientId]   = useState('')
  const [placeId,     setPlaceId]    = useState('')
  const [extraNames,  setExtraNames] = useState('')
  const [loading,     setLoading]    = useState(false)
  const [step,        setStep]       = useState('')
  const [result,      setResult]     = useState(null)
  const [history,     setHistory]    = useState([])
  const [activeTab,   setActiveTab]  = useState('overview')

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => {
    if (selectedClient) {
      setClientId(selectedClient.id)
      if (selectedClient.google_place_id) setPlaceId(selectedClient.google_place_id)
    }
  }, [selectedClient])
  useEffect(() => { if (clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,google_place_id,city,state').eq('agency_id', agencyId).is('deleted_at', null).order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const { data } = await supabase.from('competitor_snapshots')
      .select('competitor_name,rating,review_count,snapped_at')
      .eq('client_id', clientId)
      .order('snapped_at', { ascending: false })
      .limit(8)
    setHistory(data || [])
  }

  async function runAnalysis() {
    if (!placeId.trim()) { toast.error('Enter a Google Place ID'); return }
    setLoading(true); setResult(null)
    const client = clients.find(c => c.id === clientId)
    const steps  = ['Finding nearby competitors…', 'Fetching competitor profiles…', 'Running AI analysis…', 'Building intelligence report…']
    let si = 0
    const iv = setInterval(() => { si++; if (si < steps.length) setStep(steps[si]) }, 4000)
    setStep(steps[0])
    try {
      const res = await fetch('/api/seo/competitor-intel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:        clientId || null,
          agency_id:        agencyId,
          place_id:         placeId.trim(),
          business_name:    client?.name || '',
          location:         client ? `${client.city || ''} ${client.state || ''}`.trim() : '',
          competitor_names: extraNames.trim() ? extraNames.split(',').map(s => s.trim()).filter(Boolean) : [],
        }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setResult(data)
      toast.success(`Found ${data.competitors?.length || 0} competitors`)
      if (clientId) loadHistory()
    } catch (e) { clearInterval(iv); toast.error('Analysis failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  const intel    = result?.intel
  const client   = result?.client
  const comps    = result?.competitors || []
  const topThreat = intel?.biggest_threat?.name ? comps.find(c => c.name?.toLowerCase().includes(intel.biggest_threat.name?.toLowerCase())) : comps[0]

  const TABS = [
    { key: 'overview',    label: 'Overview' },
    { key: 'competitors', label: `Competitors (${comps.length})` },
    { key: 'actions',     label: 'Action Plan' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart2 size={20} color={TEAL}/> Competitor Intelligence
              </h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0', fontFamily: FB }}>
                Real-time local competitor analysis · AI strategic recommendations
              </p>
            </div>
            <select value={clientId} onChange={e => { setClientId(e.target.value); const cl = clients.find(c => c.id === e.target.value); if (cl?.google_place_id) setPlaceId(cl.google_place_id) }}
              style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: BLK, fontSize: 14, fontFamily: FH, minWidth: 200 }}>
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {result && (
            <div style={{ display: 'flex', gap: 0 }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ padding: '10px 18px', border: 'none', background: 'transparent',
                    borderBottom: activeTab === t.key ? `2.5px solid ${RED}` : '2.5px solid transparent',
                    color: activeTab === t.key ? RED : '#6b7280',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

          {/* Input panel */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Google Place ID</label>
                <input value={placeId} onChange={e => setPlaceId(e.target.value)}
                  placeholder="ChIJ… — from your client's GBP listing"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', color: BLK, boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = TEAL} onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Track specific competitors (optional)</label>
                <input value={extraNames} onChange={e => setExtraNames(e.target.value)}
                  placeholder="Apex Plumbing, Smith HVAC (comma-separated)"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', color: BLK, boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = TEAL} onBlur={e => e.target.style.borderColor = '#e5e7eb'}/>
              </div>
              <button onClick={runAnalysis} disabled={loading || !placeId.trim()}
                style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: RED, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', boxShadow: `0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> : <BarChart2 size={15}/>}
                {loading ? step || 'Analyzing…' : result ? 'Refresh' : 'Analyze Market'}
              </button>
            </div>
          </div>

          {/* Previous snapshot */}
          {history.length > 0 && !result && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 10 }}>
                Last snapshot — {new Date(history[0].snapped_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {history.map((h, i) => (
                  <div key={i} style={{ padding: '6px 12px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>{h.competitor_name}</span>
                    {h.rating && <span style={{ fontSize: 12, color: AMBER, fontFamily: FH }}>★{h.rating}</span>}
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>{h.review_count} reviews</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div>

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div>
                  {/* Client vs Market snapshot */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

                    {/* Client score */}
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18 }}>
                      <ScoreRing score={client?.score || 0} size={90} label="your score"/>
                      <div>
                        <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{client?.name || 'Your Business'}</div>
                        <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 3 }}>
                          ★{client?.rating || '—'} · {client?.review_count} reviews · {client?.photo_count} photos
                        </div>
                        {intel?.competitive_score && (
                          <div style={{ marginTop: 8, fontSize: 12, fontFamily: FH, fontWeight: 700,
                            color: intel.competitive_score >= 70 ? GREEN : intel.competitive_score >= 50 ? AMBER : RED }}>
                            Market position: {intel.competitive_score >= 70 ? 'Strong' : intel.competitive_score >= 50 ? 'Average' : 'Weak'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Market leader */}
                    {intel?.market_leader && (
                      <div style={{ background: AMBER + '10', borderRadius: 16, border: `1px solid ${AMBER}30`, padding: '20px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Award size={16} color={AMBER}/>
                          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: AMBER, textTransform: 'uppercase', letterSpacing: '.07em' }}>Market Leader</div>
                        </div>
                        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4 }}>{intel.market_leader.name}</div>
                        <div style={{ fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.6 }}>{intel.market_leader.why}</div>
                      </div>
                    )}

                    {/* Biggest threat */}
                    {intel?.biggest_threat && (
                      <div style={{ background: RED + '08', borderRadius: 16, border: `1px solid ${RED}20`, padding: '20px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <AlertTriangle size={16} color={RED}/>
                          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Biggest Threat</div>
                        </div>
                        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4 }}>{intel.biggest_threat.name}</div>
                        <div style={{ fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.6 }}>{intel.biggest_threat.reason}</div>
                      </div>
                    )}
                  </div>

                  {/* AI market position */}
                  {intel?.market_position && (
                    <div style={{ background: `linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Sparkles size={15} color={TEAL}/>
                        <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '.07em' }}>AI Market Analysis</span>
                      </div>
                      <div style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', fontFamily: FB, lineHeight: 1.75, marginBottom: 12 }}>{intel.market_position}</div>
                      {intel.biggest_opportunity && (
                        <div style={{ padding: '12px 16px', background: `${TEAL}15`, borderRadius: 10, border: `1px solid ${TEAL}30` }}>
                          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Biggest Opportunity</div>
                          <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB }}>{intel.biggest_opportunity}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Strengths vs Weaknesses */}
                  {(intel?.strengths?.length || intel?.weaknesses?.length) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                        <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: GREEN, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                          <ArrowUp size={14}/> Your Advantages
                        </div>
                        {(intel.strengths || []).map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.5 }}>
                            <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0 }}>✓</span> {s}
                          </div>
                        ))}
                      </div>
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                        <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                          <ArrowDown size={14}/> Where They Beat You
                        </div>
                        {(intel.weaknesses || []).map((w, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.5 }}>
                            <span style={{ color: RED, fontWeight: 700, flexShrink: 0 }}>→</span> {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {intel?.quick_wins?.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                        <Zap size={14} color={AMBER}/>
                        <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK }}>Quick Wins</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {intel.quick_wins.map((w, i) => (
                          <span key={i} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 20, background: AMBER + '15', color: '#92400e', fontFamily: FB, border: `1px solid ${AMBER}30` }}>
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* COMPETITORS TAB */}
              {activeTab === 'competitors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comps.map((comp, i) => (
                    <CompetitorCard key={comp.place_id || i} comp={comp} client={client} rank={i + 1}/>
                  ))}
                </div>
              )}

              {/* ACTION PLAN TAB */}
              {activeTab === 'actions' && (
                <div>
                  {(intel?.recommended_actions || []).length === 0 ? (
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '40px 24px', textAlign: 'center', color: '#6b7280', fontFamily: FB }}>
                      No action plan generated — try running the analysis again
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(intel?.recommended_actions || []).map((action, i) => {
                        const impactColor = action.impact === 'high' ? RED : action.impact === 'medium' ? AMBER : TEAL
                        return (
                          <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: impactColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 14, fontWeight: 900, color: impactColor, flexShrink: 0 }}>
                              {i + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 4 }}>{action.action}</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: impactColor + '15', color: impactColor, fontFamily: FH, fontWeight: 700 }}>
                                  {action.impact} impact
                                </span>
                                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', fontFamily: FH, fontWeight: 700 }}>
                                  {action.effort} effort
                                </span>
                                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#f0f9ff', color: '#0284c7', fontFamily: FH, fontWeight: 700 }}>
                                  {action.timeframe}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {!result && !loading && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '64px 24px', textAlign: 'center' }}>
              <BarChart2 size={44} color="#e5e7eb" style={{ margin: '0 auto 16px', display: 'block' }}/>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Competitor Intelligence Dashboard</div>
              <div style={{ fontSize: 15, color: '#6b7280', fontFamily: FB, maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.7 }}>
                Enter your client's Google Place ID to automatically discover nearby competitors, score them, and get an AI-powered strategic action plan.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, maxWidth: 600, margin: '0 auto' }}>
                {[
                  { icon: Users,    label: 'Up to 10 competitors',    desc: 'Automatically found within 8km' },
                  { icon: BarChart2, label: 'Head-to-head scoring',   desc: 'Rating, reviews, photos, hours' },
                  { icon: Sparkles, label: 'AI strategic analysis',   desc: 'Threats, opportunities, action plan' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '16px', background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                    <item.icon size={20} color={RED} style={{ margin: '0 auto 8px', display: 'block' }}/>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
