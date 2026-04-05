"use client"
import { useState, useEffect } from 'react'
import { Star, CheckCircle, XCircle, AlertCircle, Sparkles, RefreshCw, MapPin, Phone, Globe, Clock, Camera, TrendingUp, Users, ChevronDown, ChevronUp, Loader2, ExternalLink, Shield, Target, Zap } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import ClientSearchSelect from '../../components/ClientSearchSelect'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const GREEN = '#16a34a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

function ScoreRing({ score }) {
  const color = score >= 80 ? GREEN : score >= 60 ? '#f59e0b' : RED
  const r = 54, circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <div style={{ position:'relative', width:140, height:140, flexShrink:0 }}>
      <svg width={140} height={140} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="#f3f4f6" strokeWidth={12}/>
        <circle cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset .6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:FH, fontSize:36, fontWeight:900, color, letterSpacing:'-.03em', lineHeight:1 }}>{score}</div>
        <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em' }}>/100</div>
      </div>
    </div>
  )
}

function CheckRow({ item, pass }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #f9fafb' }}>
      <div style={{ flexShrink:0, marginTop:1 }}>
        {pass
          ? <CheckCircle size={16} color={GREEN}/>
          : <XCircle size={16} color={RED}/>
        }
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:700, color: pass?'#111':'#374151', fontFamily:FH }}>{item.label}</div>
        {!pass && item.fix && (
          <div style={{ fontSize:13, color:'#6b7280', marginTop:2, fontFamily:FB, lineHeight:1.5 }}>→ {item.fix}</div>
        )}
      </div>
      {!pass && item.weight >= 8 && (
        <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:20, background:RED+'15', color:RED, fontFamily:FH, flexShrink:0 }}>High priority</span>
      )}
    </div>
  )
}

function CompetitorCard({ comp, clientRating, clientReviews, clientPhotos }) {
  const ratingBetter = comp.rating > (clientRating || 0)
  const reviewsBetter = comp.review_count > (clientReviews || 0)
  return (
    <div style={{ background:'#f9fafb', borderRadius:12, padding:'12px 14px', border:'1px solid #e5e7eb' }}>
      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{comp.name}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color: ratingBetter?RED:GREEN }}>{comp.rating || '—'}★</div>
          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Rating</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color: reviewsBetter?RED:GREEN }}>{comp.review_count}</div>
          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Reviews</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:'#374151' }}>{comp.photo_count}</div>
          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Photos</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap' }}>
        {comp.has_website && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#f0fdf4', color:GREEN, fontFamily:FH, fontWeight:700 }}>Has website</span>}
        {comp.has_hours   && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#eff6ff', color:'#3b82f6', fontFamily:FH, fontWeight:700 }}>Hours set</span>}
        {!comp.has_hours  && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#fef2f2', color:RED, fontFamily:FH, fontWeight:700 }}>No hours</span>}
      </div>
    </div>
  )
}

export default function GBPAuditPage() {
  const { agencyId } = useAuth()
  const { selectedClient } = useClient()
  const [clients,    setClients]    = useState([])
  const [clientId,   setClientId]   = useState('')
  const [placeId,    setPlaceId]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [history,    setHistory]    = useState([])
  const [showAll,    setShowAll]    = useState(false)
  const [step,       setStep]       = useState('')

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => {
    if (selectedClient) {
      setClientId(selectedClient.id)
      if (selectedClient.google_place_id) setPlaceId(selectedClient.google_place_id)
    }
  }, [selectedClient])
  useEffect(() => { if (clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,google_place_id').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const { data } = await supabase.from('gbp_audits').select('id,score,business_name,audited_at').eq('client_id', clientId).order('audited_at', { ascending: false }).limit(5)
    setHistory(data || [])
  }

  async function runAudit() {
    if (!placeId.trim()) { toast.error('Enter a Google Place ID'); return }
    setLoading(true); setResult(null)
    setStep('Fetching Google Business Profile…')
    try {
      setStep('Analyzing profile & competitors…')
      const res = await fetch('/api/seo/gbp-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: placeId.trim(), client_id: clientId || null, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStep('Running AI analysis…')
      setResult(data)
      toast.success(`GBP Score: ${data.score}/100`)
      loadHistory()
    } catch (e) { toast.error('Audit failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  const client = clients.find(c => c.id === clientId)
  const scoreColor = result ? (result.score >= 80 ? GREEN : result.score >= 60 ? '#f59e0b' : RED) : RED
  const visibleFails = showAll ? result?.fails : result?.fails?.slice(0, 5)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:16 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <MapPin size={20} color={RED}/> GBP Audit
              </h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>
                Score your Google Business Profile and outperform competitors
              </p>
            </div>
            <ClientSearchSelect
              value={clientId}
              onChange={(id, cl) => {
                setClientId(id)
                setPlaceId(cl.google_place_id)
              }}
            />
          </div>
          {history.length > 0 && (
            <div style={{ display:'flex', gap:8, paddingBottom:14, overflowX:'auto' }}>
              {history.map((h,i)=>(
                <div key={h.id} style={{ padding:'5px 12px', borderRadius:20, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color: h.score>=80?'#4ade80':h.score>=60?'#fbbf24':'#f87171' }}>{h.score}</span>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:FB }}>{new Date(h.audited_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* Input panel */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px', marginBottom:20 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>
                  Google Place ID
                </label>
                <input value={placeId} onChange={e=>setPlaceId(e.target.value)}
                  placeholder="ChIJ... — find it at google.com/maps → share → copy link"
                  onKeyDown={e=>e.key==='Enter'&&runAudit()}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>
              {clientId && !placeId && (
                <a href="/reviews" style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${TEAL}`, color:TEAL, fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                  Find Place ID →
                </a>
              )}
              <button onClick={runAudit} disabled={loading||!placeId.trim()}
                style={{ padding:'9px 24px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap', boxShadow:`0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> : <Target size={15}/>}
                {loading ? step || 'Auditing…' : 'Run GBP Audit'}
              </button>
            </div>
            {!placeId && clientId && (
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:8, fontFamily:FB }}>
                Tip: Go to Reviews page, search for this client, and the Place ID will be saved automatically.
              </div>
            )}
          </div>

          {result && (
            <div>
              {/* Score + summary row */}
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:16, marginBottom:16 }}>
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 28px', display:'flex', alignItems:'center', gap:24 }}>
                  <ScoreRing score={result.score}/>
                  <div>
                    <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:BLK, marginBottom:3 }}>{result.business_name}</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:10 }}>{result.address}</div>
                    <div style={{ display:'flex', gap:16 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:'#f59e0b' }}>★{result.rating || '—'}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Rating</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:BLK }}>{result.review_count}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Reviews</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:BLK }}>{result.photo_count}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>Photos</div>
                      </div>
                    </div>
                  </div>
                </div>

                {result.ai && (
                  <div style={{ background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius:16, padding:'20px 24px', display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <Sparkles size={16} color={TEAL}/>
                      <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em' }}>AI Assessment</span>
                    </div>
                    <div style={{ fontSize:14, color:'rgba(255,255,255,.85)', fontFamily:FB, lineHeight:1.7 }}>{result.ai.overall_assessment}</div>
                    {result.ai.biggest_opportunity && (
                      <div style={{ background:'rgba(234,39,41,.15)', borderRadius:10, padding:'10px 14px', border:`1px solid ${RED}30` }}>
                        <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:RED, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Biggest Opportunity</div>
                        <div style={{ fontSize:13, color:'rgba(255,255,255,.8)', fontFamily:FB }}>{result.ai.biggest_opportunity}</div>
                      </div>
                    )}
                    {result.ai.quick_wins?.length > 0 && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {result.ai.quick_wins.map((w, i) => (
                          <span key={i} style={{ fontSize:12, padding:'4px 10px', borderRadius:20, background:'rgba(91,198,208,.15)', color:TEAL, fontFamily:FH, border:`1px solid ${TEAL}30` }}>
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Main content: checks + competitors + strategy */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

                {/* Checks panel */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:4 }}>Profile Checklist</div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:14 }}>
                    {result.passes.length} passing · {result.fails.length} to fix
                  </div>

                  {result.fails.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:RED, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>
                        Needs attention
                      </div>
                      {visibleFails.map((f, i) => <CheckRow key={i} item={f} pass={false}/>)}
                      {result.fails.length > 5 && (
                        <button onClick={()=>setShowAll(!showAll)}
                          style={{ display:'flex', alignItems:'center', gap:4, marginTop:8, fontSize:13, color:RED, background:'none', border:'none', cursor:'pointer', fontWeight:700, fontFamily:FH }}>
                          {showAll ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                          {showAll ? 'Show less' : `Show ${result.fails.length-5} more`}
                        </button>
                      )}
                    </div>
                  )}

                  {result.passes.length > 0 && (
                    <div>
                      <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:GREEN, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>
                        All good ✓
                      </div>
                      {result.passes.map((p, i) => <CheckRow key={i} item={{label:p}} pass={true}/>)}
                    </div>
                  )}
                </div>

                {/* Competitors panel */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {result.competitors?.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:4 }}>Nearby Competitors</div>
                      <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:14 }}>Within 5km — red = they beat you, green = you beat them</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {result.competitors.map((comp, i) => (
                          <CompetitorCard key={i} comp={comp} clientRating={result.rating} clientReviews={result.review_count} clientPhotos={result.photo_count}/>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.ai?.vs_competitors && (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <Users size={15} color={TEAL}/>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Competitive Position</div>
                      </div>
                      <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.65, marginBottom:10 }}>{result.ai.vs_competitors}</div>
                      {result.ai.estimated_rank_impact && (
                        <div style={{ padding:'10px 14px', background:TEAL+'10', borderRadius:10, border:`1px solid ${TEAL}30` }}>
                          <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Rank Impact</div>
                          <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{result.ai.estimated_rank_impact}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Strategy panels */}
              {(result.ai?.review_strategy || result.ai?.photo_strategy) && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {result.ai?.review_strategy && (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <Star size={15} color='#f59e0b'/>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Review Strategy</div>
                      </div>
                      <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.65 }}>{result.ai.review_strategy}</div>
                    </div>
                  )}
                  {result.ai?.photo_strategy && (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <Camera size={15} color='#8b5cf6'/>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Photo Strategy</div>
                      </div>
                      <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.65 }}>{result.ai.photo_strategy}</div>
                    </div>
                  )}
                </div>
              )}

              {/* External link */}
              {result.maps_url && (
                <div style={{ marginTop:16, textAlign:'center' }}>
                  <a href={result.maps_url} target="_blank" rel="noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:TEAL, fontFamily:FH, fontWeight:700, textDecoration:'none' }}>
                    <ExternalLink size={13}/> View on Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <MapPin size={44} color="#e5e7eb" style={{ margin:'0 auto 16px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>GBP Audit & Optimizer</div>
              <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB, maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
                Enter a Google Place ID to get a full audit: profile completeness score, competitor comparison, and AI-generated action plan to improve your local map pack ranking.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, maxWidth:600, margin:'32px auto 0' }}>
                {[
                  { icon:Shield, label:'Profile Score', desc:'12-point completeness check' },
                  { icon:Users, label:'Competitor Intel', desc:'vs 4 nearby businesses' },
                  { icon:Sparkles, label:'AI Action Plan', desc:'Specific steps ranked by impact' },
                ].map((item,i)=>(
                  <div key={i} style={{ padding:'16px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
                    <item.icon size={20} color={RED} style={{ margin:'0 auto 8px', display:'block' }}/>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:3 }}>{item.label}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{item.desc}</div>
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
