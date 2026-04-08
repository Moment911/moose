"use client";
import { useState, useEffect, useMemo } from 'react'
import { useMobile } from '../../hooks/useMobile'
import { useNavigate } from 'react-router-dom'
import {
  Search, MapPin, Calendar, TrendingUp, Target, BarChart2,
  ChevronRight, Flame, Thermometer, Star, Globe, Phone,
  FileText, Eye, ArrowRight, RefreshCw, Filter, X,
  Sparkles, Loader2, AlertCircle, Clock, HardDrive,
  GitCompare, CheckCircle, ArrowUp, ArrowDown, Minus
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const RED  = '#E6007E'
const TEAL = '#00C2CB'

const TEMP_COLOR = { hot:'#ef4444', warm:'#f59e0b', lukewarm:TEAL, cold:'#6b7280' }
const TEMP_BG    = { hot:'#fef2f2', warm:'#fffbeb', lukewarm:'#e8f9fa', cold:'#f9fafb' }

function ScoreDelta({ a, b }) {
  if (!a || !b) return <Minus size={12} color="#9ca3af"/>
  const d = a - b
  if (d === 0) return <Minus size={12} color="#9ca3af"/>
  return d > 0
    ? <span style={{display:'flex',alignItems:'center',gap:2,color:'#ef4444',fontSize:13,fontWeight:800}}>
        <ArrowUp size={11}/> {d}
      </span>
    : <span style={{display:'flex',alignItems:'center',gap:2,color:'#16a34a',fontSize:13,fontWeight:800}}>
        <ArrowDown size={11}/> {Math.abs(d)}
      </span>
}

// ── Business history card (shows all reports for one business) ────────────────
function BusinessHistory({ name, reports, onCompare, onViewReport }) {
  const sorted  = [...reports].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
  const latest  = sorted[sorted.length - 1]
  const prev    = sorted.length > 1 ? sorted[sorted.length - 2] : null
  const latestScore = latest?.ai_analysis?.opportunityScore || latest?.lead_data?.score || 0
  const prevScore   = prev?.ai_analysis?.opportunityScore   || prev?.lead_data?.score   || 0
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:12}}>
      {/* Header row */}
      <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',cursor:'pointer'}}
        onClick={()=>setExpanded(e=>!e)}>
        <div style={{width:42,height:42,borderRadius:11,background:`${RED}15`,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:16,fontWeight:900,color:RED,flexShrink:0}}>
          {name[0].toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:900,color:'#111',whiteSpace:'nowrap',
            overflow:'hidden',textOverflow:'ellipsis'}}>{name}</div>
          <div style={{fontSize:13,color:'#374151',marginTop:2}}>
            {reports.length} report{reports.length!==1?'s':''} · Last: {new Date(latest.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
          </div>
        </div>

        {/* Score trend */}
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:900,color:latestScore>=75?RED:latestScore>=50?TEAL:'#374151'}}>
              {latestScore}
            </div>
            <div style={{fontSize:13,color:'#9ca3af'}}>current</div>
          </div>
          {prev && (
            <>
              <ScoreDelta a={latestScore} b={prevScore}/>
              <div style={{textAlign:'center',opacity:.5}}>
                <div style={{fontSize:16,fontWeight:700,color:'#374151'}}>{prevScore}</div>
                <div style={{fontSize:13,color:'#9ca3af'}}>prev</div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:8,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onViewReport(latest)}
            style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:9,
              border:'none',background:RED,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <Eye size={11}/> View Latest
          </button>
          {reports.length >= 2 && (
            <button onClick={()=>onCompare(sorted)}
              style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:9,
                border:`1.5px solid ${TEAL}`,background:`${TEAL}10`,color:'#0e7490',
                fontSize:13,fontWeight:700,cursor:'pointer'}}>
              <GitCompare size={11}/> Compare
            </button>
          )}
        </div>

        <ChevronRight size={16} color="#9ca3af"
          style={{transform:expanded?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}/>
      </div>

      {/* Expanded: all reports timeline */}
      {expanded && (
        <div style={{borderTop:'1px solid #f3f4f6',padding:'14px 20px'}}>
          <div style={{fontSize:13,fontWeight:800,color:'#374151',textTransform:'uppercase',
            letterSpacing:'.07em',marginBottom:10}}>Report history</div>
          {sorted.map((rep, i) => {
            const score = rep.ai_analysis?.opportunityScore || rep.lead_data?.score || 0
            const wa    = rep.lead_data?.website_analysis || {}
            const tech  = Object.values(wa.tech||{}).flat()
            return (
              <div key={rep.id} style={{display:'flex',alignItems:'center',gap:14,
                padding:'11px 14px',background:i%2===0?'#f9fafb':'#fff',
                borderRadius:10,marginBottom:6}}>
                <div style={{width:8,height:8,borderRadius:'50%',
                  background:score>=75?RED:score>=50?TEAL:'#d1d5db',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:13,fontWeight:800,color:'#111'}}>
                      {new Date(rep.created_at).toLocaleDateString('en-US',
                        {month:'long',day:'numeric',year:'numeric'})}
                    </span>
                    <span style={{fontSize:13,color:'#9ca3af'}}>
                      {new Date(rep.created_at).toLocaleTimeString('en-US',
                        {hour:'numeric',minute:'2-digit'})}
                    </span>
                  </div>
                  <div style={{fontSize:13,color:'#374151',marginTop:2}}>
                    {rep.google_reviews} reviews · {rep.google_rating}★
                    {tech.length>0 && <> · {tech.slice(0,2).join(', ')}</>}
                    {rep.lead_data?.website_analysis?.success && (
                      <span style={{color:TEAL,marginLeft:6}}>✓ website scanned</span>
                    )}
                  </div>
                </div>
                <div style={{fontSize:18,fontWeight:900,
                  color:score>=75?RED:score>=50?TEAL:'#374151'}}>{score}</div>
                <button onClick={()=>onViewReport(rep)}
                  style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid #e5e7eb',
                    background:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',color:'#374151'}}>
                  View
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Comparison modal ───────────────────────────────────────────────────────────
function CompareModal({ reports, onClose }) {
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState(null)
  const sorted = [...reports].sort((a,b) => new Date(a.created_at)-new Date(b.created_at))
  const oldest = sorted[0]
  const newest = sorted[sorted.length-1]

  async function runComparison() {
    setComparing(true)
    try {
      const prompt =
        'You are a marketing analyst. Compare these two intelligence reports for the same business and identify what changed, improved, worsened, and what opportunities remain. ' +
        'Report A (older - ' + new Date(oldest.created_at).toLocaleDateString() + '): ' +
        'Reviews: ' + oldest.google_reviews + ', Rating: ' + oldest.google_rating + '★, ' +
        'Score: ' + (oldest.ai_analysis?.opportunityScore||0) + '/100, ' +
        'Gaps: ' + (oldest.lead_data?.gaps||[]).join('; ') + '. ' +
        'Summary: ' + (oldest.ai_analysis?.executiveSummary||'') + '. ' +
        '\nReport B (newer - ' + new Date(newest.created_at).toLocaleDateString() + '): ' +
        'Reviews: ' + newest.google_reviews + ', Rating: ' + newest.google_rating + '★, ' +
        'Score: ' + (newest.ai_analysis?.opportunityScore||0) + '/100, ' +
        'Gaps: ' + (newest.lead_data?.gaps||[]).join('; ') + '. ' +
        'Summary: ' + (newest.ai_analysis?.executiveSummary||'') + '. ' +
        '\nReturn JSON: {"overallTrend":"improving/declining/stable","keyChanges":["change1","change2","change3"],"improved":["item1","item2"],"worsened":["item1","item2"],"persistentGaps":["gap1","gap2"],"recommendation":"2 sentence strategic recommendation","urgency":"High/Medium/Low"}'

      const raw = await callClaude(
        'You are a marketing intelligence analyst. Return only raw JSON, no markdown.',
        prompt, 1500
      )
      const clean = raw.replace(/```json|```/g,'').trim()
      const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
      setComparison(JSON.parse(clean.slice(s,e+1)))
    } catch(err) { toast.error('Comparison failed: ' + err.message) }
    setComparing(false)
  }

  const reviewDelta  = newest.google_reviews  - oldest.google_reviews
  const ratingDelta  = (newest.google_rating  - oldest.google_rating).toFixed(1)
  const scoreDelta   = (newest.ai_analysis?.opportunityScore||0) - (oldest.ai_analysis?.opportunityScore||0)
  const daysBetween  = Math.round((new Date(newest.created_at)-new Date(oldest.created_at))/(1000*60*60*24))

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.7)',
      backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:700,
        maxHeight:'90vh',overflow:'auto',boxShadow:'0 32px 80px rgba(0,0,0,.3)'}}>

        {/* Header */}
        <div style={{background: '#ffffff',borderRadius:'20px 20px 0 0',padding:'24px 28px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <GitCompare size={18} color={TEAL}/>
              <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>Comparative Analysis</div>
            </div>
            <button onClick={onClose} style={{border:'none',background:'rgba(255,255,255,.1)',
              color:'#fff',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:13}}>✕</button>
          </div>
          <div style={{fontSize:14,color:'#999999'}}>
            {oldest.business_name} · {reports.length} reports · {daysBetween} days apart
          </div>
        </div>

        <div style={{padding:'24px 28px'}}>
          {/* Side by side snapshot */}
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:16,marginBottom:24,alignItems:'center'}}>
            {[oldest, newest].map((rep, i) => (
              <div key={rep.id} style={{background:i===1?'#f0fbfc':'#f9fafb',borderRadius:14,padding:'18px',
                border:`1.5px solid ${i===1?TEAL+'50':'#e5e7eb'}`}}>
                <div style={{fontSize:13,fontWeight:800,color:i===1?TEAL:'#9ca3af',
                  textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  {i===0?'Report A (Earlier)':'Report B (Latest)'}
                </div>
                <div style={{fontSize:13,color:'#374151',marginBottom:10}}>
                  {new Date(rep.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                </div>
                <div style={{display:'flex',gap:14}}>
                  <div>
                    <div style={{fontSize:24,fontWeight:900,color:'#f59e0b'}}>{rep.google_rating}★</div>
                    <div style={{fontSize:13,color:'#9ca3af'}}>{rep.google_reviews} reviews</div>
                  </div>
                  <div>
                    <div style={{fontSize:24,fontWeight:900,
                      color:(rep.ai_analysis?.opportunityScore||0)>=75?RED:TEAL}}>
                      {rep.ai_analysis?.opportunityScore||rep.lead_data?.score||0}
                    </div>
                    <div style={{fontSize:13,color:'#9ca3af'}}>opp score</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Deltas in middle */}
            <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'center'}}>
              {[
                {label:'Reviews', delta:reviewDelta, up:'more reviews'},
                {label:'Rating',  delta:parseFloat(ratingDelta), up:'better', suffix:'★'},
                {label:'Score',   delta:scoreDelta,  up:'better opp'},
              ].map(d=>(
                <div key={d.label} style={{textAlign:'center'}}>
                  <div style={{fontSize:13,color:'#9ca3af',marginBottom:2}}>{d.label}</div>
                  <div style={{fontSize:16,fontWeight:900,
                    color:d.delta>0?(d.label==='Score'?RED:'#16a34a'):d.delta<0?'#ef4444':'#9ca3af'}}>
                    {d.delta>0?'+':''}{d.delta}{d.suffix||''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Comparison */}
          {!comparison ? (
            <button onClick={runComparison} disabled={comparing}
              style={{width:'100%',padding:'12px',borderRadius:12,border:'none',
                background:RED,color:'#fff',fontSize:15,fontWeight:800,
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                opacity:comparing?.7:1}}>
              {comparing
                ? <><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Running AI analysis…</>
                : <><Sparkles size={16}/> Run Comparative Analysis</>}
            </button>
          ) : (
            <div>
              {/* Trend badge */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
                <div style={{padding:'6px 16px',borderRadius:20,fontWeight:800,fontSize:14,
                  background:comparison.overallTrend==='improving'?'#f0fdf4':
                             comparison.overallTrend==='declining'?'#fef2f2':'#f9fafb',
                  color:comparison.overallTrend==='improving'?'#16a34a':
                        comparison.overallTrend==='declining'?RED:'#374151',
                  border:`1.5px solid ${comparison.overallTrend==='improving'?'#bbf7d0':comparison.overallTrend==='declining'?'#fecaca':'#e5e7eb'}`}}>
                  {comparison.overallTrend==='improving'?'📈 Improving':
                   comparison.overallTrend==='declining'?'📉 Declining':'📊 Stable'}
                </div>
                <div style={{padding:'6px 16px',borderRadius:20,fontWeight:800,fontSize:13,
                  background:comparison.urgency==='High'?`${RED}15`:comparison.urgency==='Medium'?'#fffbeb':'#f9fafb',
                  color:comparison.urgency==='High'?RED:comparison.urgency==='Medium'?'#d97706':'#374151',
                  border:'1.5px solid #e5e7eb'}}>
                  {comparison.urgency} urgency
                </div>
              </div>

              {/* Key changes */}
              {comparison.keyChanges?.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:800,color:'#111',marginBottom:8}}>Key changes</div>
                  {comparison.keyChanges.map((ch,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'8px 12px',
                      background:'#f9fafb',borderRadius:9,marginBottom:6,alignItems:'flex-start'}}>
                      <ArrowRight size={13} color={TEAL} style={{flexShrink:0,marginTop:2}}/>
                      <span style={{fontSize:14,color:'#374151'}}>{ch}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Improved / Worsened */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                {comparison.improved?.length > 0 && (
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:'14px',border:'1px solid #bbf7d0'}}>
                    <div style={{fontSize:13,fontWeight:800,color:'#16a34a',marginBottom:8}}>✓ Improved</div>
                    {comparison.improved.map((it,i)=>(
                      <div key={i} style={{fontSize:13,color:'#374151',marginBottom:4}}>· {it}</div>
                    ))}
                  </div>
                )}
                {comparison.worsened?.length > 0 && (
                  <div style={{background:'#fef2f2',borderRadius:12,padding:'14px',border:`1px solid ${RED}30`}}>
                    <div style={{fontSize:13,fontWeight:800,color:RED,marginBottom:8}}>✗ Worsened</div>
                    {comparison.worsened.map((it,i)=>(
                      <div key={i} style={{fontSize:13,color:'#374151',marginBottom:4}}>· {it}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Persistent gaps */}
              {comparison.persistentGaps?.length > 0 && (
                <div style={{background:'#fffbeb',borderRadius:12,padding:'14px',
                  border:'1px solid #fde68a',marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:800,color:'#d97706',marginBottom:8}}>
                    Persistent gaps (still unaddressed)
                  </div>
                  {comparison.persistentGaps.map((g,i)=>(
                    <div key={i} style={{fontSize:13,color:'#374151',marginBottom:4}}>· {g}</div>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              <div style={{background: '#ffffff',borderRadius:12,padding:'16px 18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <Sparkles size={14} color={TEAL}/>
                  <span style={{fontSize:13,fontWeight:800,color:TEAL}}>Strategic recommendation</span>
                </div>
                <p style={{fontSize:14,color:'#999999',lineHeight:1.7,margin:0}}>
                  {comparison.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ScoutHistoryPage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()

  const [searches, setSearches]     = useState([])
  const [reports,  setReports]      = useState([])
  const [loading,  setLoading]      = useState(true)
  const [tab,      setTab]          = useState('searches')   // searches | businesses | reports
  const [filterQ,  setFilterQ]      = useState('')
  const [compareReports, setCompareReports] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const aid = agencyId || '00000000-0000-0000-0000-000000000099'
    try {
      const [{ data: ss }, { data: rr }] = await Promise.all([
        supabase.from('scout_searches').select('*')
          .eq('agency_id', aid).order('created_at', { ascending: false }).limit(200),
        supabase.from('prospect_reports').select('*')
          .eq('agency_id', aid).order('created_at', { ascending: false }).limit(500),
      ])
      setSearches(ss || [])
      setReports(rr || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  // Group reports by business name for comparison
  const businessGroups = useMemo(() => {
    const groups = {}
    reports.forEach(r => {
      const key = r.business_name?.toLowerCase().trim()
      if (!key) return
      if (!groups[key]) groups[key] = { name: r.business_name, reports: [] }
      groups[key].reports.push(r)
    })
    return Object.values(groups)
      .filter(g => filterQ ? g.name.toLowerCase().includes(filterQ.toLowerCase()) : true)
      .sort((a,b) => new Date(b.reports[0].created_at) - new Date(a.reports[0].created_at))
  }, [reports, filterQ])

  const filteredSearches = useMemo(() =>
    searches.filter(s => !filterQ ||
      s.query?.toLowerCase().includes(filterQ.toLowerCase()) ||
      s.location?.toLowerCase().includes(filterQ.toLowerCase())
    ), [searches, filterQ])

  const filteredReports = useMemo(() =>
    reports.filter(r => !filterQ ||
      r.business_name?.toLowerCase().includes(filterQ.toLowerCase())
    ), [reports, filterQ])

  function replaySearch(s) {
    navigate('/scout', { state: { replayQuery: s.query, replayLocation: s.location, replayMode: s.mode } })
  }

  function viewReport(rep) {
    navigate('/scout/report', {
      state: {
        lead: rep.lead_data || { name: rep.business_name, rating: rep.google_rating, review_count: rep.google_reviews },
        query: rep.search_query || rep.business_type,
        searchId: rep.search_id,
        savedReportId: rep.id,
      }
    })
  }

  const totalLeads = searches.reduce((s,x) => s+(x.result_count||0), 0)
  const hotLeads   = searches.reduce((s,x) => s+((x.stats?.hot)||0), 0)

  const TABS = [
    { key:'searches',   label:'Search History',   count: searches.length },
    { key:'businesses', label:'By Business',       count: businessGroups.length },
    { key:'reports',    label:'All Reports',       count: reports.length },
  ]

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Scout History"
          subtitle={`${searches?.length||0} saved searches`}/>

        <MobileSearch value={filterQ||''} onChange={v=>setFilterQ&&setFilterQ(v)} placeholder="Search history…"/>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
        ) : !searches?.length ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>No scout history yet — run a search in Scout</div>
        ) : (
          <MobileCard style={{margin:'0 16px 16px'}}>
            {(searches||[]).filter(s=>!filterQ||s.query?.toLowerCase().includes(filterQ.toLowerCase())).map((s,i,arr)=>(
              <MobileRow key={s.id}
                onClick={()=>navigate('/scout')}
                borderBottom={i<arr.length-1}
                left={<div style={{width:36,height:36,borderRadius:10,background:'#00C2CB'+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C2CB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>}
                title={s.query||'Search'}
                subtitle={[s.result_count?`${s.result_count} results`:null, s.created_at?new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):null].filter(Boolean).join(' · ')}/>
            ))}
          </MobileCard>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background: '#ffffff',padding:'18px 28px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:900,color: '#111111', margin: 0, letterSpacing:-0.3}}>
                Scout History
              </h1>
              <p style={{fontSize:14,color:'#999999',margin:'3px 0 0'}}>
                {searches.length} searches · {totalLeads.toLocaleString()} leads · {reports.length} reports saved
              </p>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={load}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,
                  border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
                  color:'#999999',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                <RefreshCw size={13}/> Refresh
              </button>
              <button onClick={()=>navigate('/scout')}
                style={{display:'flex',alignItems:'center',gap:7,padding:'8px 18px',borderRadius:10,
                  border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}}>
                <Search size={14}/> New Search
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{display:'flex',gap:28,marginBottom:0}}>
            {[
              {label:'Total searches', value:searches.length},
              {label:'Leads discovered', value:totalLeads.toLocaleString()},
              {label:'Hot leads', value:hotLeads},
              {label:'Reports saved', value:reports.length},
              {label:'Businesses tracked', value:businessGroups.length},
            ].map(s=>(
              <div key={s.label} style={{padding:'10px 0'}}>
                <div style={{fontSize:20,fontWeight:900,color:'#fff',lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:13,color:'#999999',marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:0,marginTop:4}}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{display:'flex',alignItems:'center',gap:6,padding:'11px 20px',border:'none',
                  borderBottom:`2.5px solid ${tab===t.key?RED:'transparent'}`,
                  background:'transparent',color:tab===t.key?'#fff':'rgba(255,255,255,.4)',
                  fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer',transition:'all .15s'}}>
                {t.label}
                <span style={{fontSize:13,fontWeight:800,padding:'1px 7px',borderRadius:20,
                  background:tab===t.key?RED+'40':'rgba(255,255,255,.1)',
                  color:tab===t.key?'#fff':'rgba(255,255,255,.5)'}}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 28px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#f4f4f5',
            borderRadius:10,padding:'8px 14px',maxWidth:400}}>
            <Search size={14} color="#9ca3af"/>
            <input value={filterQ} onChange={e=>setFilterQ(e.target.value)}
              placeholder="Filter by business, search term, location…"
              style={{border:'none',outline:'none',fontSize:14,background:'transparent',
                flex:1,color:'#111'}}/>
            {filterQ && <button onClick={()=>setFilterQ('')}
              style={{border:'none',background:'none',cursor:'pointer',color:'#9ca3af',padding:0}}>
              <X size={13}/>
            </button>}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
              <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (

            <>
              {/* ── SEARCH HISTORY TAB ── */}
              {tab === 'searches' && (
                filteredSearches.length === 0 ? (
                  <div style={{textAlign:'center',padding:'60px 24px'}}>
                    <Search size={40} color="#e5e7eb" style={{margin:'0 auto 16px'}}/>
                    <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:6}}>No searches yet</div>
                    <div style={{fontSize:14,color:'#374151',marginBottom:18}}>
                      Run a Scout search and it will appear here automatically
                    </div>
                    <button onClick={()=>navigate('/scout')}
                      style={{padding:'10px 24px',borderRadius:10,border:'none',
                        background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                      Go to Scout
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {filteredSearches.map(s=>(
                      <div key={s.id} style={{background:'#fff',borderRadius:14,
                        border:'1px solid #e5e7eb',padding:'16px 20px',
                        display:'flex',alignItems:'center',gap:16}}>

                        <div style={{width:42,height:42,borderRadius:11,
                          background:s.mode==='competitor'?'#f5f3ff':s.mode==='market'?'#e8f9fa':`${RED}15`,
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <Search size={18} color={s.mode==='competitor'?'#7c3aed':s.mode==='market'?TEAL:RED}/>
                        </div>

                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                            <div style={{fontSize:15,fontWeight:900,color:'#111'}}>
                              {s.query}
                            </div>
                            {s.location && (
                              <div style={{display:'flex',alignItems:'center',gap:4,
                                fontSize:13,color:'#374151'}}>
                                <MapPin size={11}/>{s.location}
                              </div>
                            )}
                            <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                              background:s.mode==='competitor'?'#f5f3ff':s.mode==='market'?`${TEAL}15`:`${RED}10`,
                              color:s.mode==='competitor'?'#7c3aed':s.mode==='market'?TEAL:RED,
                              textTransform:'capitalize'}}>{s.mode}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:12,fontSize:13,color:'#374151'}}>
                            <span style={{display:'flex',alignItems:'center',gap:4}}>
                              <Clock size={11}/>{new Date(s.created_at).toLocaleDateString('en-US',
                                {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
                            </span>
                            <span>{s.result_count} businesses found</span>
                            {s.stats?.hot > 0 && (
                              <span style={{display:'flex',alignItems:'center',gap:4,color:RED,fontWeight:700}}>
                                <Flame size={11}/>{s.stats.hot} hot leads
                              </span>
                            )}
                            <span style={{padding:'2px 8px',borderRadius:20,fontSize:13,
                              background:s.data_source==='google'?`${TEAL}15`:'#f9fafb',
                              color:s.data_source==='google'?'#0e7490':'#374151',fontWeight:600}}>
                              {s.data_source==='google'?'Google Places':'AI'}
                            </span>
                          </div>
                        </div>

                        {/* Stats pills */}
                        <div style={{display:'flex',gap:8,flexShrink:0}}>
                          {s.stats?.hot > 0 && (
                            <div style={{textAlign:'center',padding:'8px 14px',background:'#fef2f2',borderRadius:10}}>
                              <div style={{fontSize:18,fontWeight:900,color:RED}}>{s.stats.hot}</div>
                              <div style={{fontSize:13,color:'#9ca3af'}}>hot</div>
                            </div>
                          )}
                          {s.stats?.warm > 0 && (
                            <div style={{textAlign:'center',padding:'8px 14px',background:'#fffbeb',borderRadius:10}}>
                              <div style={{fontSize:18,fontWeight:900,color:'#d97706'}}>{s.stats.warm}</div>
                              <div style={{fontSize:13,color:'#9ca3af'}}>warm</div>
                            </div>
                          )}
                          <div style={{textAlign:'center',padding:'8px 14px',background:'#f9fafb',borderRadius:10}}>
                            <div style={{fontSize:18,fontWeight:900,color:'#374151'}}>{s.stats?.avgScore||0}</div>
                            <div style={{fontSize:13,color:'#9ca3af'}}>avg score</div>
                          </div>
                        </div>

                        <div style={{display:'flex',gap:8,flexShrink:0}}>
                          <button onClick={()=>replaySearch(s)}
                            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',
                              borderRadius:9,border:`1.5px solid ${RED}`,background:`${RED}08`,
                              color:RED,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                            <RefreshCw size={12}/> Re-run
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ── BY BUSINESS TAB ── */}
              {tab === 'businesses' && (
                businessGroups.length === 0 ? (
                  <div style={{textAlign:'center',padding:'60px 24px'}}>
                    <HardDrive size={40} color="#e5e7eb" style={{margin:'0 auto 16px'}}/>
                    <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:6}}>
                      No saved reports yet
                    </div>
                    <div style={{fontSize:14,color:'#374151',marginBottom:18}}>
                      Save a report from the Scout search to track businesses over time
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:14,color:'#374151',marginBottom:16}}>
                      {businessGroups.filter(g=>g.reports.length>=2).length} businesses with multiple reports — click Compare to run AI analysis
                    </div>
                    {businessGroups.map(g=>(
                      <BusinessHistory
                        key={g.name}
                        name={g.name}
                        reports={g.reports}
                        onCompare={reps=>setCompareReports(reps)}
                        onViewReport={viewReport}
                      />
                    ))}
                  </>
                )
              )}

              {/* ── ALL REPORTS TAB ── */}
              {tab === 'reports' && (
                filteredReports.length === 0 ? (
                  <div style={{textAlign:'center',padding:'60px 24px'}}>
                    <FileText size={40} color="#e5e7eb" style={{margin:'0 auto 16px'}}/>
                    <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:6}}>No reports saved</div>
                    <div style={{fontSize:14,color:'#374151'}}>
                      Generate a report from any Scout lead and save it to see it here
                    </div>
                  </div>
                ) : (
                  <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                          {['Business','Date','Rating','Reviews','Score','Tech Scanned','Prospect','Actions'].map(h=>(
                            <th key={h} style={{padding:'11px 16px',fontSize:13,fontWeight:800,
                              color:'#111',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map((rep,i)=>{
                          const score  = rep.ai_analysis?.opportunityScore || 0
                          const scanned = rep.lead_data?.website_analysis?.success
                          const tech   = Object.values(rep.lead_data?.website_analysis?.tech||{}).flat()
                          return (
                            <tr key={rep.id}
                              style={{borderBottom:i<filteredReports.length-1?'1px solid #f9fafb':'none'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                              onMouseLeave={e=>e.currentTarget.style.background=''}>
                              <td style={{padding:'13px 16px'}}>
                                <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{rep.business_name}</div>
                                {rep.business_website && (
                                  <div style={{fontSize:13,color:TEAL}}>{rep.business_website.replace(/^https?:\/\//,'').slice(0,30)}</div>
                                )}
                              </td>
                              <td style={{padding:'13px 16px',fontSize:13,color:'#374151',whiteSpace:'nowrap'}}>
                                {new Date(rep.created_at).toLocaleDateString('en-US',
                                  {month:'short',day:'numeric',year:'numeric'})}
                              </td>
                              <td style={{padding:'13px 16px',fontSize:14,fontWeight:700,color:'#f59e0b'}}>
                                {rep.google_rating}★
                              </td>
                              <td style={{padding:'13px 16px',fontSize:14,color:'#374151'}}>
                                {(rep.google_reviews||0).toLocaleString()}
                              </td>
                              <td style={{padding:'13px 16px'}}>
                                <span style={{fontSize:16,fontWeight:900,
                                  color:score>=75?RED:score>=50?TEAL:'#374151'}}>{score}</span>
                              </td>
                              <td style={{padding:'13px 16px'}}>
                                {scanned ? (
                                  <div>
                                    <div style={{display:'flex',alignItems:'center',gap:5,
                                      fontSize:13,fontWeight:700,color:'#16a34a',marginBottom:3}}>
                                      <CheckCircle size={11}/> Scanned
                                    </div>
                                    <div style={{fontSize:13,color:'#374151'}}>
                                      {tech.slice(0,2).join(', ')||'Clean stack'}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{fontSize:13,color:'#9ca3af'}}>Not scanned</span>
                                )}
                              </td>
                              <td style={{padding:'13px 16px',fontSize:13,color:'#374151'}}>
                                {rep.prospect_name ? (
                                  <div>
                                    <div style={{fontWeight:700,color:'#111'}}>{rep.prospect_name}</div>
                                    <div style={{fontSize:13}}>{rep.prospect_email}</div>
                                  </div>
                                ) : (
                                  <span style={{color:'#9ca3af'}}>Not claimed</span>
                                )}
                              </td>
                              <td style={{padding:'13px 16px'}}>
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={()=>viewReport(rep)}
                                    style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',
                                      borderRadius:8,border:'none',background:RED,color:'#fff',
                                      fontSize:13,fontWeight:700,cursor:'pointer'}}>
                                    <Eye size={10}/> View
                                  </button>
                                  <button onClick={()=>{
                                    const url = window.location.origin+'/r/'+rep.token
                                    navigator.clipboard.writeText(url)
                                    toast.success('Link copied!')
                                  }} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',
                                    borderRadius:8,border:`1px solid ${TEAL}`,background:`${TEAL}10`,
                                    color:'#0e7490',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                                    Link
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Compare modal */}
      {compareReports && (
        <CompareModal
          reports={compareReports}
          onClose={()=>setCompareReports(null)}
        />
      )}
    </div>
  )
}
