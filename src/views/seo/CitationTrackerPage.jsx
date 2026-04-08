"use client"
import { useState, useEffect } from 'react'
import { MapPin, CheckCircle, XCircle, AlertTriangle, Sparkles, Loader2, ExternalLink, RefreshCw, Search, Shield, Star, TrendingUp, Clock } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const RED    = '#E6007E'
const TEAL   = '#00C2CB'
const BLK = '#111111'
const GREEN  = '#16a34a'
const AMBER  = '#f59e0b'
const PURPLE = '#8b5cf6'
const FH     = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB     = "'Raleway','Helvetica Neue',sans-serif"

const CATEGORY_COLOR = {
  primary:   { color: RED,    bg: RED+'15',    label: 'Primary' },
  trust:     { color: PURPLE, bg: PURPLE+'15', label: 'Trust' },
  secondary: { color: TEAL,   bg: TEAL+'15',   label: 'Secondary' },
}

function ScoreRing({ score, size=120 }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  const r = (size/2) - 10, circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset .8s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:FH, fontSize:size>100?34:22, fontWeight:900, color, lineHeight:1 }}>{score}</div>
        <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>/100</div>
      </div>
    </div>
  )
}

function DirectoryRow({ dir }) {
  const catCfg = CATEGORY_COLOR[dir.category] || CATEGORY_COLOR.secondary
  const hasNAPIssue = dir.found && (dir.name_match === false || dir.phone_match === false || dir.address_match === false)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom:'1px solid #f9fafb' }}
      onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

      {/* Status icon */}
      <div style={{ flexShrink:0 }}>
        {dir.found
          ? hasNAPIssue
            ? <AlertTriangle size={16} color={AMBER}/>
            : <CheckCircle size={16} color={GREEN}/>
          : <XCircle size={16} color={RED}/>
        }
      </div>

      {/* Directory info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <span style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{dir.directory}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:catCfg.bg, color:catCfg.color, fontFamily:FH }}>{catCfg.label}</span>
          {hasNAPIssue && (
            <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:AMBER+'15', color:AMBER, fontFamily:FH }}>NAP Issue</span>
          )}
        </div>
        {dir.found && (
          <div style={{ display:'flex', gap:8, fontSize:11, color:'#9ca3af', fontFamily:FH }}>
            {[
              { label:'Name', ok: dir.name_match },
              { label:'Phone', ok: dir.phone_match },
              { label:'Address', ok: dir.address_match },
            ].map(n => (
              <span key={n.label} style={{ color: n.ok === false ? RED : n.ok === true ? GREEN : '#9ca3af', fontWeight: n.ok === false ? 700 : 400 }}>
                {n.ok === false ? '✗' : n.ok === true ? '✓' : '?'} {n.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Weight indicator */}
      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
        {Array.from({length:5}).map((_,i) => (
          <div key={i} style={{ width:4, height:12, borderRadius:2, background: i < Math.round(dir.weight/2) ? (dir.found ? GREEN : RED) : '#e5e7eb' }}/>
        ))}
      </div>

      {/* Link or fix button */}
      <div style={{ flexShrink:0 }}>
        {dir.found && dir.listing_url ? (
          <a href={dir.listing_url} target="_blank" rel="noreferrer"
            style={{ fontSize:12, color:TEAL, fontWeight:700, fontFamily:FH, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
            View <ExternalLink size={11}/>
          </a>
        ) : !dir.found ? (
          <a href={dir.directory_url} target="_blank" rel="noreferrer"
            style={{ fontSize:12, fontWeight:700, fontFamily:FH, textDecoration:'none', padding:'4px 10px', borderRadius:7, background:RED+'15', color:RED, display:'flex', alignItems:'center', gap:4 }}>
            Add listing
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default function CitationTrackerPage() {
  const { agencyId } = useAuth()
  const { selectedClient } = useClient()
  const [clients,   setClients]   = useState([])
  const [clientId,  setClientId]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState('')
  const [result,    setResult]    = useState(null)
  const [filter,    setFilter]    = useState('all')
  const [history,   setHistory]   = useState([])

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => { if (selectedClient) setClientId(selectedClient.id) }, [selectedClient])
  useEffect(() => { if (clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,phone,city,state,address').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const { data } = await supabase.from('citation_checks')
      .select('directory,found,checked_at')
      .eq('client_id', clientId)
      .order('checked_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

  async function runCheck() {
    if (!clientId) { toast.error('Select a client first'); return }
    const client = clients.find(c => c.id === clientId)
    if (!client?.city && !client?.address) {
      toast.error('Client needs an address or city — edit the client record first')
      return
    }
    setLoading(true); setResult(null)
    const steps = ['Checking Google Business Profile…','Checking Yelp, Facebook, BBB…','Checking secondary directories…','Running AI analysis…']
    let si = 0
    const iv = setInterval(() => { si++; if(si<steps.length) setStep(steps[si]) }, 4000)
    setStep(steps[0])
    try {
      const res = await fetch('/api/seo/citation-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setResult(data)
      toast.success(`Citation check complete — ${data.score}/100`)
      loadHistory()
    } catch(e) { clearInterval(iv); toast.error('Check failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  const client = clients.find(c => c.id === clientId)
  const dirs = result?.directories || []
  const filtered = filter === 'all' ? dirs
    : filter === 'found'   ? dirs.filter(d => d.found)
    : filter === 'missing' ? dirs.filter(d => !d.found)
    : filter === 'issues'  ? dirs.filter(d => d.found && (d.name_match===false||d.phone_match===false||d.address_match===false))
    : dirs.filter(d => d.category === filter)

  const missingPrimary = dirs.filter(d => d.category==='primary' && !d.found)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:14 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color: '#111111', margin: 0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <MapPin size={20} color={RED}/> Citation Tracker
              </h1>
              <p style={{ fontSize:13, color:'#999999', margin:'3px 0 0', fontFamily:FB }}>
                20 directories · NAP consistency · AI action plan
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
                style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH, minWidth:200 }}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
              </select>
              <button onClick={runCheck} disabled={loading||!clientId}
                style={{ padding:'9px 20px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:7, boxShadow:`0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Search size={14}/>}
                {loading ? step||'Checking…' : result ? 'Re-check' : 'Run Check'}
              </button>
            </div>
          </div>

          {/* History bar */}
          {history.length > 0 && !result && (
            <div style={{ paddingBottom:12, fontSize:12, color:'#999999', fontFamily:FB }}>
              Last check: {history.filter(h=>h.found).length}/{history.length} found on {new Date(history[0]?.checked_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* Missing NAP warning */}
          {clientId && client && !client.city && !client.address && (
            <div style={{ background:'#fffbeb', borderRadius:14, border:'1px solid #fde68a', padding:'14px 18px', marginBottom:16, display:'flex', gap:10 }}>
              <AlertTriangle size={18} color={AMBER} style={{ flexShrink:0, marginTop:1 }}/>
              <div>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#92400e' }}>Client needs address info</div>
                <div style={{ fontSize:13, color:'#78350f', fontFamily:FB }}>Go to Clients → {client.name} → add city, state, phone, and address for accurate citation checking.</div>
              </div>
            </div>
          )}

          {result && (
            <div>
              {/* Score summary row */}
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:16, marginBottom:16 }}>

                {/* Score ring */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px', display:'flex', alignItems:'center', gap:20 }}>
                  <ScoreRing score={result.score}/>
                  <div>
                    <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, marginBottom:3 }}>{result.client_name}</div>
                    <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:10 }}>
                      {result.nap.city}{result.nap.state ? ', '+result.nap.state : ''}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                      {[
                        { label:'Found',    value:result.found_count,   color:GREEN },
                        { label:'Missing',  value:result.missing_count, color:RED   },
                        { label:'NAP Issues', value:result.nap_issues_count, color:AMBER },
                      ].map((s,i) => (
                        <div key={i} style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:FH, fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI summary */}
                {result.ai && (
                  <div style={{ background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius:16, padding:'18px 22px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                      <Sparkles size={14} color={TEAL}/>
                      <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em' }}>AI Assessment</span>
                    </div>
                    <div style={{ fontSize:14, color:'#999999', fontFamily:FB, lineHeight:1.7, marginBottom:10 }}>{result.ai.summary}</div>
                    {result.ai.quick_win && (
                      <div style={{ background:`${RED}15`, borderRadius:9, padding:'9px 12px', border:`1px solid ${RED}30` }}>
                        <span style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:RED }}>Quick Win: </span>
                        <span style={{ fontSize:13, color:'#999999', fontFamily:FB }}>{result.ai.quick_win}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Primary directories status */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px', minWidth:200 }}>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:12 }}>Primary Directories</div>
                  <div style={{ fontFamily:FH, fontSize:32, fontWeight:900, color: missingPrimary.length===0?GREEN:RED, marginBottom:6 }}>
                    {result.primary_score}
                  </div>
                  <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginBottom:10 }}>primary directories found</div>
                  {missingPrimary.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {missingPrimary.map(d=>(
                        <a key={d.directory} href={d.directory_url} target="_blank" rel="noreferrer"
                          style={{ fontSize:12, color:RED, fontWeight:700, fontFamily:FH, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                          + Add to {d.directory}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI priorities + ranking impact */}
              {result.ai && (result.ai.top_priorities?.length > 0 || result.ai.estimated_ranking_impact) && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                  {result.ai.top_priorities?.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:10 }}>Top Priorities</div>
                      {result.ai.top_priorities.map((p,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                          <div style={{ width:22, height:22, borderRadius:7, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:12, fontWeight:900, color:RED, flexShrink:0 }}>{i+1}</div>
                          <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.5 }}>{p}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.ai.estimated_ranking_impact && (
                    <div style={{ background:`${TEAL}10`, borderRadius:14, border:`1px solid ${TEAL}30`, padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <TrendingUp size={15} color={TEAL}/>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Ranking Impact</div>
                      </div>
                      <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.65 }}>{result.ai.estimated_ranking_impact}</div>
                      {result.ai.score_context && (
                        <div style={{ marginTop:10, fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.5 }}>{result.ai.score_context}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Directory list */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {/* Filter tabs */}
                <div style={{ display:'flex', borderBottom:'1px solid #f3f4f6', overflowX:'auto' }}>
                  {[
                    { key:'all',       label:`All (${dirs.length})` },
                    { key:'missing',   label:`Missing (${dirs.filter(d=>!d.found).length})`, color:RED },
                    { key:'issues',    label:`NAP Issues (${dirs.filter(d=>d.found&&(d.name_match===false||d.phone_match===false||d.address_match===false)).length})`, color:AMBER },
                    { key:'found',     label:`Found (${dirs.filter(d=>d.found).length})`, color:GREEN },
                    { key:'primary',   label:'Primary' },
                    { key:'secondary', label:'Secondary' },
                  ].map(tab => (
                    <button key={tab.key} onClick={()=>setFilter(tab.key)}
                      style={{ padding:'11px 16px', border:'none', background:'transparent', whiteSpace:'nowrap',
                        borderBottom:filter===tab.key?`2px solid ${tab.color||RED}`:'2px solid transparent',
                        color:filter===tab.key?(tab.color||RED):'#9ca3af', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div>
                  {filtered.map((dir,i) => <DirectoryRow key={i} dir={dir}/>)}
                </div>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <MapPin size={44} color="#e5e7eb" style={{ margin:'0 auto 16px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>Citation Tracker</div>
              <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB, maxWidth:500, margin:'0 auto 28px', lineHeight:1.7 }}>
                Check your client's business listings across 20 top directories. Find missing citations, catch NAP inconsistencies, and get an AI-prioritized fix list.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, maxWidth:700, margin:'0 auto' }}>
                {[
                  { icon:'📍', label:'20 Directories',    desc:'Google, Yelp, BBB, Apple Maps, YP and more' },
                  { icon:'🔍', label:'NAP Check',          desc:'Name, phone, address consistency per listing' },
                  { icon:'⚡', label:'Missing Citations',  desc:'Direct links to add each missing listing' },
                  { icon:'🤖', label:'AI Priority List',   desc:'Ranked action plan to improve local rankings' },
                ].map((item,i)=>(
                  <div key={i} style={{ padding:'16px 12px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>{item.icon}</div>
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
