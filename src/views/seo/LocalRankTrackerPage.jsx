"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Search, Target, TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, Star, Globe, Phone, ChevronDown, Map,
  BarChart2, Sparkles, Clock, Plus, Trash2, History, DollarSign, Users,
  AlertCircle, Check, ArrowUp, ArrowDown, Calendar
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileRow, MobileSectionHeader, MobileTabs } from '../../components/mobile/MobilePage'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

function RankBadge({ rank, prev }) {
  if (!rank) return <span style={{ fontSize:13, color:'#9ca3af', fontFamily:FH }}>Not ranked</span>
  const delta = prev && prev !== rank ? prev - rank : null
  const color = rank <= 3 ? '#16a34a' : rank <= 7 ? TEAL : rank <= 15 ? '#f59e0b' : '#9ca3af'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:44, height:44, borderRadius:12, background:color+'15', border:`2px solid ${color}40`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:FH, fontSize:20, fontWeight:900, color }}>
        {rank}
      </div>
      {delta !== null && (
        <div style={{ display:'flex', alignItems:'center', gap:2, fontSize:12, fontWeight:700,
          color:delta>0?'#16a34a':delta<0?RED:'#9ca3af' }}>
          {delta>0?<ArrowUp size={12}/>:delta<0?<ArrowDown size={12}/>:<Minus size={12}/>}
          {Math.abs(delta)}
        </div>
      )}
    </div>
  )
}

const PRICE_LABELS = { PRICE_LEVEL_FREE:'Free', PRICE_LEVEL_INEXPENSIVE:'$', PRICE_LEVEL_MODERATE:'$$', PRICE_LEVEL_EXPENSIVE:'$$$', PRICE_LEVEL_VERY_EXPENSIVE:'$$$$' }

function ResultRow({ result, targetBusiness, expanded, onToggle }) {
  const isTarget = targetBusiness && result.name?.toLowerCase().includes(targetBusiness.toLowerCase())
  const rankColor = result.rank<=3?'#16a34a':result.rank<=7?TEAL:result.rank<=15?'#f59e0b':'#9ca3af'
  return (
    <div style={{ borderBottom:'1px solid #f3f4f6', background:isTarget?RED+'06':'transparent',
      borderLeft:isTarget?`3px solid ${RED}`:'3px solid transparent' }}>
      {/* Main row */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 20px', cursor:'pointer' }}
        onClick={onToggle}>
        {/* Rank */}
        <div style={{ width:32, height:32, borderRadius:9, background:isTarget?RED:rankColor+'18', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:FH, fontSize:14, fontWeight:900, color:isTarget?'#fff':rankColor }}>
          {result.rank}
        </div>
        {/* Photo thumbnail */}
        {result.photos?.[0] ? (
          <img src={result.photos[0]} alt={result.name}
            style={{ width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0, border:'1px solid #f3f4f6' }}
            onError={e=>e.target.style.display='none'}/>
        ) : (
          <div style={{ width:36, height:36, borderRadius:8, background:'#f3f4f6', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Globe size={14} color="#d0d0cc"/>
          </div>
        )}
        {/* Name + address */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:isTarget?RED:BLK }}>{result.name}</span>
            {isTarget && <span style={{ fontSize:10, background:RED, color:'#fff', padding:'1px 6px', borderRadius:20, fontFamily:FH, fontWeight:700, flexShrink:0 }}>CLIENT</span>}
            {result.is_open_now === true  && <span style={{ fontSize:10, background:'#f0fdf4', color:'#16a34a', padding:'1px 6px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>Open</span>}
            {result.is_open_now === false && <span style={{ fontSize:10, background:'#fef2f2', color:RED,      padding:'1px 6px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>Closed</span>}
            {result.price_level && <span style={{ fontSize:10, color:'#9ca3af', fontFamily:FH }}>{PRICE_LABELS[result.price_level]||''}</span>}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.address}</div>
        </div>
        {/* Rating + review count */}
        <div style={{ flexShrink:0, textAlign:'right' }}>
          {result.rating && (
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, justifyContent:'flex-end' }}>
              <Star size={11} color="#f59e0b" fill="#f59e0b"/>
              <span style={{ fontWeight:700, color:'#374151' }}>{result.rating}</span>
            </div>
          )}
          <div style={{ fontSize:11, color:'#9ca3af' }}>{result.review_count?.toLocaleString()} reviews</div>
        </div>
        {/* Links */}
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {result.website && <a href={result.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#9ca3af' }}><Globe size={13}/></a>}
          {result.maps_url && <a href={result.maps_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#4285f4' }}><MapPin size={13}/></a>}
        </div>
        {/* Expand chevron */}
        <ChevronDown size={14} color="#d0d0cc" style={{ flexShrink:0, transform:expanded?'rotate(180deg)':'none', transition:'transform .2s' }}/>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ padding:'0 20px 14px 20px', borderTop:'1px solid #f9fafb' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10 }}>
            {/* Hours */}
            {result.hours?.length > 0 && (
              <div style={{ background:'#f9fafb', borderRadius:9, padding:'10px 12px' }}>
                <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Hours</div>
                {result.hours.map((h,i)=>(
                  <div key={i} style={{ fontSize:12, color:'#374151', lineHeight:1.8 }}>{h}</div>
                ))}
              </div>
            )}
            {/* Photos row */}
            {result.photos?.length > 1 && (
              <div>
                <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Photos</div>
                <div style={{ display:'flex', gap:6 }}>
                  {result.photos.slice(0,3).map((url,i)=>(
                    <img key={i} src={url} alt="" style={{ width:64, height:64, borderRadius:8, objectFit:'cover', border:'1px solid #e5e7eb' }}
                      onError={e=>e.target.style.display='none'}/>
                  ))}
                </div>
              </div>
            )}
            {/* Editorial summary */}
            {result.editorial && (
              <div style={{ gridColumn:'1/-1', background:TEAL+'10', borderRadius:9, padding:'10px 12px', border:`1px solid ${TEAL}30` }}>
                <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Google Summary</div>
                <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>"{result.editorial}"</div>
              </div>
            )}
            {/* Phone + type */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {result.phone && <div style={{ fontSize:12, color:'#374151', display:'flex', alignItems:'center', gap:6 }}><Phone size={11} color="#9ca3af"/>{result.phone}</div>}
              {result.type_label && <div style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}><Globe size={11} color="#9ca3af"/>{result.type_label}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LocalRankTrackerPage() {
  const { agencyId } = useAuth()
  const navigate     = useNavigate()
  const isMobile     = useMobile()

  // Form
  const [keyword,  setKeyword]  = useState('')
  const [location, setLocation] = useState('')
  const [targetBiz,setTargetBiz]= useState('')
  const [radiusKm, setRadiusKm] = useState(16)
  const [clientId, setClientId] = useState('')

  // Data
  const [clients,  setClients]  = useState([])
  const [scanning, setScanning] = useState(false)
  const [results,  setResults]  = useState(null)
  const [history,  setHistory]  = useState([])
  const [tab,      setTab]      = useState('search') // search | history
  const [historyLoading, setHistoryLoading] = useState(false)

  // Tracked keywords (saved searches for a client)
  const [tracked,  setTracked]  = useState([])
  const [expandedRow,   setExpandedRow]   = useState(null)
  const [marketData,    setMarketData]    = useState(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [showMap,       setShowMap]       = useState(false)
  const [ppcKeywords,   setPpcKeywords]   = useState(null)
  const [ppcLoading,    setPpcLoading]    = useState(false)

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => { if (clientId) { loadHistory(); loadTracked() } }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,industry')
      .eq('agency_id', agencyId || '').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase.from('local_rank_scans').select('*')
      .eq('client_id', clientId).order('scanned_at', { ascending:false }).limit(50)
    setHistory(data || [])
    setHistoryLoading(false)
  }

  async function loadTracked() {
    // Load distinct keyword+location combos for this client
    const { data } = await supabase.from('local_rank_scans').select('keyword,location,target_business,target_rank,scanned_at')
      .eq('client_id', clientId).order('scanned_at', { ascending:false })
    if (!data) return
    // Deduplicate by keyword+location, keep most recent
    const seen = new Set()
    const unique = data.filter(d => {
      const key = `${d.keyword}|${d.location}`
      if (seen.has(key)) return false
      seen.add(key); return true
    })
    setTracked(unique.slice(0, 20))
  }

  async function fetchMarketDensity(kw, loc) {
    if (!kw || !loc) return
    setMarketLoading(true)
    try {
      // Map keyword to Google place type
      const typeMap = {
        plumber:'plumber', plumbing:'plumber', hvac:'hvac_contractor',
        dentist:'dentist', dental:'dentist', roofing:'roofing_contractor',
        roofer:'roofing_contractor', lawyer:'lawyer', attorney:'lawyer',
        landscaping:'landscaping', landscaper:'landscaping',
        electrician:'electrician', contractor:'general_contractor',
        restaurant:'restaurant', mechanic:'auto_repair', gym:'gym',
        salon:'beauty_salon', spa:'spa', chiropractor:'chiropractor',
        pediatrician:'pediatrician', accountant:'accounting',
      }
      const lc = kw.toLowerCase()
      const placeType = Object.entries(typeMap).find(([k]) => lc.includes(k))?.[1] || lc.replace(/\s+/g,'_')
      const res = await fetch('/api/seo/market-density', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: loc, business_type: placeType, place_types: [placeType], radius_km: radiusKm }),
      })
      const data = await res.json()
      if (!data.error) setMarketData(data)
    } catch(e) { console.warn('Market density:', e.message) }
    setMarketLoading(false)
  }

  async function generatePPCKeywords(scanResults) {
    if (!scanResults || !targetBiz) return
    setPpcLoading(true)
    try {
      const top5 = scanResults.google_local?.slice(0,5).map(r => r.name).join(', ')
      const geo  = scanResults.geocoded_location
      const res  = await fetch('/api/seo/ppc-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword:            scanResults.keyword,
          location:           scanResults.location,
          target_business:    targetBiz,
          target_rank:        scanResults.target_rank,
          top_competitors:    top5,
          market_assessment:  marketData?.summary?.market_assessment,
        }),
      })
      const d = await res.json()
      const text = d.content?.[0]?.text || ''
      try {
        const clean = text.replace(/\`\`\`json|\`\`\`/g,'').trim()
        setPpcKeywords(JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1)))
      } catch { setPpcKeywords({ ad_headline_ideas: [], service_keywords: [], campaign_strategy: text }) }
    } catch(e) { console.warn('PPC keywords:', e.message) }
    setPpcLoading(false)
  }

  async function runScan() {
    if (!keyword.trim() || !location.trim()) {
      toast.error('Enter a keyword and location')
      return
    }
    setScanning(true)
    setResults(null)
    try {
      const res = await fetch('/api/seo/local-rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword:         keyword.trim(),
          location:        location.trim(),
          target_business: targetBiz.trim() || undefined,
          radius_km:       radiusKm,
          include_ai:      true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data)
      setTab('search')
      // Auto-fetch market density
      fetchMarketDensity(keyword.trim(), location.trim())

      // Save to history if client selected
      if (clientId) {
        await supabase.from('local_rank_scans').insert({
          client_id:       clientId,
          agency_id:       agencyId,
          keyword:         data.keyword,
          location:        data.location,
          target_business: data.target_business || null,
          radius_km:       data.radius_km,
          target_rank:     data.target_rank,
          total_results:   data.total_results,
          results:         data.google_local,
          ai_analysis:     data.ai_analysis || {},
          scanned_at:      data.searched_at,
        })
        loadHistory()
        loadTracked()
      }
      toast.success(`Found ${data.total_results} businesses${data.target_rank ? ` · ${targetBiz} ranked #${data.target_rank}` : ''}`)
    } catch(e) {
      toast.error('Scan failed: ' + e.message)
    }
    setScanning(false)
  }

  async function rescan(scan) {
    setKeyword(scan.keyword)
    setLocation(scan.location)
    setTargetBiz(scan.target_business || '')
    setTab('search')
    // Auto-run
    setTimeout(() => runScan(), 100)
  }

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    const mTabs = [
      { key:'search',  label:'Search' },
      { key:'history', label:'History', count:history.length },
    ]
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Local Rank Tracker" subtitle="Track local search rankings"/>
        <MobileTabs tabs={mTabs} active={tab} onChange={setTab}/>

        {tab==='search' && (
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {/* Client */}
            <select value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, color:BLK, background:'#fff' }}>
              <option value="">Select client (optional)</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Keyword + Location */}
            <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="e.g. plumber, dentist, HVAC..."
              style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, outline:'none', color:BLK, boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#ececea'}/>
            <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Miami FL, Boca Raton Florida"
              style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, outline:'none', color:BLK, boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#ececea'}/>
            <input value={targetBiz} onChange={e=>setTargetBiz(e.target.value)} placeholder="Client business name (to highlight)"
              style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, outline:'none', color:BLK, boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#ececea'}/>

            <button onClick={runScan} disabled={scanning||!keyword.trim()||!location.trim()}
              style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:RED, color:'#fff',
                fontSize:15, fontWeight:700, cursor:scanning?'not-allowed':'pointer',
                fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity:scanning||!keyword.trim()||!location.trim()?.6:1 }}>
              {scanning?<><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Scanning…</>:<><Target size={16}/> Run Scan</>}
            </button>

            {/* Results */}
            {results && (
              <>
                {results.target_rank && (
                  <div style={{ background:RED+'10', border:`1px solid ${RED}30`, borderRadius:12, padding:'14px', textAlign:'center' }}>
                    <div style={{ fontFamily:FH, fontSize:28, fontWeight:900, color:RED }}>#{results.target_rank}</div>
                    <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{targetBiz} in Google Maps</div>
                  </div>
                )}
                <MobileCard style={{ margin:0 }}>
                  {results.google_local.slice(0,10).map((r,i)=>(
                    <div key={i} style={{ padding:'10px 14px', borderBottom:i<9?'1px solid #f2f2f0':'none',
                      background:targetBiz&&r.name?.toLowerCase().includes(targetBiz.toLowerCase())?RED+'08':'transparent',
                      borderLeft:targetBiz&&r.name?.toLowerCase().includes(targetBiz.toLowerCase())?`3px solid ${RED}`:'3px solid transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:28, height:28, borderRadius:8, flexShrink:0,
                          background:targetBiz&&r.name?.toLowerCase().includes(targetBiz.toLowerCase())?RED:'#f2f2f0',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:FH, fontSize:13, fontWeight:800,
                          color:targetBiz&&r.name?.toLowerCase().includes(targetBiz.toLowerCase())?'#fff':'#6b7280' }}>
                          {r.rank}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                          {r.rating && <div style={{ fontSize:12, color:'#9a9a96' }}>★ {r.rating} ({r.review_count})</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </MobileCard>
                {results.ai_analysis?.overall_assessment && (
                  <MobileCard style={{ padding:'14px', borderLeft:`3px solid ${TEAL}` }}>
                    <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL,
                      textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>AI Analysis</div>
                    <p style={{ fontSize:14, color:'#374151', lineHeight:1.65, margin:'0 0 10px', fontFamily:FB }}>
                      {results.ai_analysis.overall_assessment}
                    </p>
                    {results.ai_analysis.quick_wins?.length > 0 && (
                      <div>
                        <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Quick Wins:</div>
                        {results.ai_analysis.quick_wins.map((w,i)=>(
                          <div key={i} style={{ fontSize:13, color:'#374151', padding:'6px 0', borderBottom:i<results.ai_analysis.quick_wins.length-1?'1px solid #f2f2f0':'none', fontFamily:FB }}>
                            → {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </MobileCard>
                )}
              </>
            )}
          </div>
        )}

        {tab==='history' && (
          <>
            {historyLoading ? (
              <div style={{ padding:40, textAlign:'center', color:'#9a9a96' }}>Loading…</div>
            ) : history.length===0 ? (
              <div style={{ padding:'40px 24px', textAlign:'center', color:'#9a9a96', fontSize:14 }}>No scans yet</div>
            ) : (
              <MobileCard style={{ margin:'12px 16px' }}>
                {history.map((h,i)=>(
                  <MobileRow key={h.id} borderBottom={i<history.length-1}
                    onClick={()=>rescan(h)}
                    left={<div style={{ width:36, height:36, borderRadius:9, background:h.target_rank?h.target_rank<=3?'#f0fdf4':h.target_rank<=10?'#f0fbfc':'#f2f2f0':'#fef2f2',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      fontFamily:FH, fontSize:15, fontWeight:900,
                      color:h.target_rank?h.target_rank<=3?'#16a34a':h.target_rank<=10?TEAL:'#9a9a96':RED }}>
                      {h.target_rank?`#${h.target_rank}`:'?'}
                    </div>}
                    title={h.keyword}
                    subtitle={`${h.location} · ${new Date(h.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}/>
                ))}
              </MobileCard>
            )}
          </>
        )}
      </MobilePage>
    )
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'0 32px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 0 0' }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:24, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em' }}>
                Local Rank Tracker
              </h1>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:'4px 0 0', fontFamily:FB }}>
                Track Google Maps rankings — real data, AI-powered insights
              </p>
            </div>
            {/* Client selector */}
            <select value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)',
                background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH, minWidth:200 }}>
              <option value="">All clients</option>
              {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
            </select>
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', gap:0, marginTop:16 }}>
            {[{key:'search',label:'New Scan',icon:Search},{key:'history',label:'Scan History',icon:History},{key:'tracked',label:'Tracked Keywords',icon:Target}].map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{ padding:'12px 20px', border:'none', background:'transparent',
                  borderBottom:`2.5px solid ${tab===t.key?RED:'transparent'}`,
                  color:tab===t.key?'#fff':'rgba(255,255,255,.35)', fontSize:13, fontWeight:tab===t.key?700:500,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:FH }}>
                <t.icon size={13}/> {t.label}
                {t.key==='history'&&history.length>0&&<span style={{fontSize:10,background:RED,color:'#fff',padding:'1px 5px',borderRadius:20,marginLeft:2}}>{history.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* ── NEW SCAN ── */}
          {tab==='search' && (
            <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:20, alignItems:'start' }}>

              {/* Search form */}
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                    Search Parameters
                  </div>
                  <div style={{ padding:'20px' }}>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Keyword *</label>
                      <input value={keyword} onChange={e=>setKeyword(e.target.value)}
                        placeholder="e.g. plumber, dentist, roofing contractor"
                        onKeyDown={e=>e.key==='Enter'&&runScan()}
                        style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Location *</label>
                      <input value={location} onChange={e=>setLocation(e.target.value)}
                        placeholder="e.g. Miami FL, Boca Raton Florida"
                        onKeyDown={e=>e.key==='Enter'&&runScan()}
                        style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Client Business Name</label>
                      <input value={targetBiz} onChange={e=>setTargetBiz(e.target.value)}
                        placeholder="Highlight their listing in results"
                        style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                    </div>
                    <div style={{ marginBottom:20 }}>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Search Radius</label>
                      <select value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))}
                        style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, color:BLK, background:'#fff' }}>
                        <option value={5}>5 km (~3 miles)</option>
                        <option value={10}>10 km (~6 miles)</option>
                        <option value={16}>16 km (~10 miles)</option>
                        <option value={25}>25 km (~15 miles)</option>
                        <option value={50}>50 km (~30 miles)</option>
                      </select>
                    </div>
                    <button onClick={runScan} disabled={scanning||!keyword.trim()||!location.trim()}
                      style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:RED, color:'#fff',
                        fontSize:15, fontWeight:700, cursor:scanning?'not-allowed':'pointer', fontFamily:FH,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        opacity:scanning||!keyword.trim()||!location.trim()?.6:1,
                        boxShadow:`0 4px 14px ${RED}40` }}>
                      {scanning?<><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Scanning Google Maps…</>:<><Target size={16}/> Run Local Scan</>}
                    </button>
                  </div>
                </div>

                {/* Tracked keywords quick-rerun */}
                {tracked.length>0 && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', marginTop:14, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>
                      Quick Rescan
                    </div>
                    {tracked.slice(0,5).map((t,i)=>(
                      <button key={i} onClick={()=>{ setKeyword(t.keyword); setLocation(t.location); setTargetBiz(t.target_business||'') }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
                          border:'none', borderBottom:i<Math.min(tracked.length,5)-1?'1px solid #f9fafb':'none',
                          background:'transparent', cursor:'pointer', textAlign:'left', transition:'background .1s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{ width:28, height:28, borderRadius:8, background:t.target_rank?t.target_rank<=3?'#f0fdf4':'#f0fbfc':'#fef2f2',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          fontFamily:FH, fontSize:12, fontWeight:800,
                          color:t.target_rank?t.target_rank<=3?'#16a34a':TEAL:RED }}>
                          {t.target_rank?`#${t.target_rank}`:'?'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{t.keyword}</div>
                          <div style={{ fontSize:12, color:'#9ca3af' }}>{t.location}</div>
                        </div>
                        <RefreshCw size={13} color="#d0d0cc"/>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Results panel */}
              <div>
                {!results && !scanning && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                    <MapPin size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                    <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8, letterSpacing:'-.02em' }}>
                      Track Local Rankings
                    </div>
                    <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, maxWidth:360, margin:'0 auto' }}>
                      Enter a keyword and location to see who's ranking on Google Maps and where your client stands.
                    </div>
                  </div>
                )}

                {scanning && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                    <div style={{ width:56, height:56, borderRadius:16, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                      <Target size={28} color={RED} style={{ animation:'pulse 1s infinite' }}/>
                    </div>
                    <div style={{ fontFamily:FH, fontSize:16, fontWeight:700, color:BLK, marginBottom:4 }}>Scanning Google Maps…</div>
                    <div style={{ fontSize:14, color:'#9ca3af', fontFamily:FB }}>Fetching rankings + running AI analysis</div>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
                  </div>
                )}

                {results && (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                    {/* Embedded Google Map */}
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:0 }}>
                      <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>
                          <Map size={14} color={RED}/> Live Map
                        </div>
                        <button onClick={()=>setShowMap(!showMap)}
                          style={{ fontSize:12, color:RED, background:'none', border:`1px solid ${RED}30`, borderRadius:8, padding:'4px 10px', cursor:'pointer', fontFamily:FH, fontWeight:700 }}>
                          {showMap ? 'Hide Map' : 'Show Map'}
                        </button>
                      </div>
                      {showMap && results.geocoded_location && (
                        <iframe
                          title="Local Map"
                          width="100%" height="320" loading="lazy"
                          style={{ border:'none', display:'block' }}
                          src={`https://www.google.com/maps/embed/v1/search?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY||process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY||''}&q=${encodeURIComponent(results.keyword+' '+results.location)}&center=${results.geocoded_location.lat},${results.geocoded_location.lng}&zoom=12`}
                        />
                      )}
                    </div>

                    {/* Rank highlight */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                      {[
                        { label:'Client Rank',    value:results.target_rank?`#${results.target_rank}`:'Not found', color:results.target_rank?results.target_rank<=3?'#16a34a':results.target_rank<=7?TEAL:RED:RED },
                        { label:'Avg Rating',      value:results.competitive_stats?.avg_rating?`★${results.competitive_stats.avg_rating}`:'—', color:'#f59e0b' },
                        { label:'Avg Reviews',     value:results.competitive_stats?.avg_reviews?.toLocaleString()||'—', color:'#374151' },
                        { label:'Top 3 Avg Reviews', value:results.competitive_stats?.top3_avg_reviews?.toLocaleString()||'—', color:BLK },
                        { label:'Open Now',        value:results.competitive_stats?.open_now_count!=null?`${results.competitive_stats.open_now_count}/${results.total_results}`:'—', color:'#16a34a' },
                      ].map((stat,i)=>(
                        <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                          <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{stat.label}</div>
                          <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:stat.color, letterSpacing:'-.02em', lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Results table */}
                    {/* Market Density Panel */}
                    {(marketLoading || marketData) && (
                      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:0 }}>
                        <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:8 }}>
                          <BarChart2 size={14} color={RED}/>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>Market Density Analysis</div>
                          <span style={{ fontSize:11, fontFamily:FH, fontWeight:700, marginLeft:'auto',
                            padding:'2px 8px', borderRadius:20,
                            background:marketData?.summary?.market_assessment==='highly_saturated'?'#fef2f2':marketData?.summary?.market_assessment==='competitive'?'#fffbeb':marketData?.summary?.market_assessment==='moderate'?'#f0fbfc':'#f0fdf4',
                            color:marketData?.summary?.market_assessment==='highly_saturated'?RED:marketData?.summary?.market_assessment==='competitive'?'#d97706':marketData?.summary?.market_assessment==='moderate'?TEAL:'#16a34a' }}>
                            {marketData?.summary?.market_assessment?.replace('_',' ')||'Loading…'}
                          </span>
                        </div>
                        {marketLoading ? (
                          <div style={{ padding:'20px', display:'flex', alignItems:'center', gap:8, color:'#9ca3af', fontSize:13, fontFamily:FH }}>
                            <Loader2 size={14} color={RED} style={{animation:'spin 1s linear infinite'}}/> Analyzing market density…
                          </div>
                        ) : marketData?.summary && (
                          <div style={{ padding:'16px 20px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                              {[
                                { label:'Total Competitors', value:marketData.summary.total_competitors, icon:Users, color:'#374151' },
                                { label:'4★+ Rated',         value:marketData.summary.high_rated_count,  icon:Star,   color:'#f59e0b' },
                                { label:'Within 5km',        value:marketData.summary.nearby_5km,        icon:MapPin, color:TEAL },
                                { label:'Quality Gap',       value:marketData.summary.quality_gap_pct+'%', icon:TrendingUp, color:marketData.summary.quality_gap_pct>40?'#16a34a':RED },
                              ].map((s,i) => (
                                <div key={i} style={{ background:'#f9fafb', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{s.label}</div>
                                  <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>
                              {marketData.summary.density_per_sq_km} businesses per km² ·{' '}
                              {marketData.summary.opportunity_level === 'high' ?
                                `${marketData.summary.quality_gap_pct}% of competitors have under 4★ — significant quality opportunity.` :
                                `${marketData.summary.high_rated_count} of ${marketData.summary.total_competitors} competitors have 4★+.`}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Geocoded location */}
                    {results.geocoded_location && (
                      <div style={{ background:'#f0fbfc', border:`1px solid ${TEAL}40`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <MapPin size={13} color={TEAL}/>
                        <span style={{ fontSize:13, color:'#0e7490', fontFamily:FH, fontWeight:600 }}>
                          Searching near: {results.geocoded_location.formatted}
                        </span>
                        <span style={{ fontSize:11, color:TEAL, marginLeft:'auto', fontFamily:FH }}>
                          {results.search_mode === 'nearby' ? 'Nearby Search (precise)' : 'Text Search'}
                        </span>
                      </div>
                    )}
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                          Google Maps Results — "{results.keyword}" in {results.location}
                        </div>
                        <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>
                          {new Date(results.searched_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                        </div>
                      </div>
                      {results.google_local.map((r,i)=>(
                        <ResultRow key={i} result={r} targetBusiness={results.target_business} index={i} expanded={expandedRow===i} onToggle={()=>setExpandedRow(expandedRow===i?null:i)}/>
                      ))}
                    </div>

                    {/* AI Analysis */}
                    {results.ai_analysis && (
                      <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${TEAL}40`, overflow:'hidden' }}>
                        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:9, background:TEAL+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Sparkles size={15} color={TEAL}/>
                          </div>
                          <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>AI Analysis</div>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:TEAL+'20', color:TEAL, fontFamily:FH }}>Claude</span>
                          {results.ai_analysis.rank_difficulty && (
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                              background:results.ai_analysis.rank_difficulty==='easy'?'#f0fdf4':results.ai_analysis.rank_difficulty==='medium'?'#fffbeb':results.ai_analysis.rank_difficulty==='hard'?'#fef3c7':'#fef2f2',
                              color:results.ai_analysis.rank_difficulty==='easy'?'#16a34a':results.ai_analysis.rank_difficulty==='medium'?'#d97706':results.ai_analysis.rank_difficulty==='hard'?'#d97706':RED,
                              fontFamily:FH, marginLeft:'auto' }}>
                              {results.ai_analysis.rank_difficulty?.replace('_',' ')} competition
                            </span>
                          )}
                        </div>
                        <div style={{ padding:'18px 20px' }}>
                          {results.ai_analysis.overall_assessment && (
                            <p style={{ fontSize:14, color:'#374151', lineHeight:1.7, margin:'0 0 16px', fontFamily:FB }}>
                              {results.ai_analysis.overall_assessment}
                            </p>
                          )}

                          {results.ai_analysis.recommendations?.length>0 && (
                            <div style={{ marginBottom:16 }}>
                              <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Recommendations</div>
                              {results.ai_analysis.recommendations.map((rec,i)=>(
                                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:i<results.ai_analysis.recommendations.length-1?'1px solid #f9fafb':'none' }}>
                                  <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:20, flexShrink:0, marginTop:1,
                                    background:rec.priority==='high'?RED+'15':rec.priority==='medium'?'#fffbeb':'#f3f4f6',
                                    color:rec.priority==='high'?RED:rec.priority==='medium'?'#d97706':'#6b7280',
                                    fontFamily:FH, textTransform:'uppercase' }}>
                                    {rec.priority}
                                  </span>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:2 }}>{rec.action}</div>
                                    <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{rec.impact}</div>
                                  </div>
                                  <span style={{ fontSize:11, color:'#9ca3af', flexShrink:0, fontFamily:FH, fontWeight:600 }}>{rec.effort} effort</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {results.ai_analysis.quick_wins?.length>0 && (
                            <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 16px', border:'1px solid #bbf7d0' }}>
                              <div style={{ fontFamily:FH, fontSize:12, fontWeight:800, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Quick Wins This Week</div>
                              {results.ai_analysis.quick_wins.map((w,i)=>(
                                <div key={i} style={{ fontSize:13, color:'#15803d', fontFamily:FB, padding:'4px 0', display:'flex', alignItems:'flex-start', gap:6 }}>
                                  <Check size={13} color="#16a34a" style={{ flexShrink:0, marginTop:2 }}/>
                                  {w}
                                </div>
                              ))}
                            </div>
                          )}

                          {results.ai_analysis.estimated_time_to_rank && (
                            <div style={{ marginTop:12, fontSize:13, color:'#6b7280', fontFamily:FB, display:'flex', alignItems:'center', gap:6 }}>
                              <Clock size={13}/> Estimated time to rank: <strong style={{ color:BLK }}>{results.ai_analysis.estimated_time_to_rank}</strong>
                            </div>
                          )}
                          {results.ai_analysis.review_strategy && (
                            <div style={{ marginTop:10, background:'#fffbeb', borderRadius:9, padding:'10px 14px', border:'1px solid #fde68a' }}>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Review Strategy</div>
                              <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{results.ai_analysis.review_strategy}</div>
                            </div>
                          )}
                          {results.ai_analysis.hours_insight && (
                            <div style={{ marginTop:10, fontSize:13, color:'#6b7280', fontFamily:FB, display:'flex', alignItems:'flex-start', gap:6 }}>
                              <Clock size={13} style={{ marginTop:2, flexShrink:0 }}/> <span>{results.ai_analysis.hours_insight}</span>
                            </div>
                          )}
                          {results.ai_analysis.competitive_gap && (
                            <div style={{ marginTop:10, background:'#fef2f2', borderRadius:9, padding:'10px 14px', border:`1px solid ${RED}30`, display:'flex', gap:16 }}>
                              <div style={{ textAlign:'center' }}>
                                <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:RED }}>{results.ai_analysis.competitive_gap.review_gap>0?'+'+results.ai_analysis.competitive_gap.review_gap:results.ai_analysis.competitive_gap.review_gap}</div>
                                <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FH }}>reviews to catch #1</div>
                              </div>
                              <div style={{ fontSize:13, color:'#374151', fontFamily:FB, flex:1 }}>{results.ai_analysis.competitive_gap.summary}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* PPC Keywords Panel */}
                    <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid #f59e0b40`, overflow:'hidden' }}>
                      <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background:'#fffbeb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <DollarSign size={15} color="#d97706"/>
                        </div>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>PPC & Google Ads Intelligence</div>
                        {!ppcKeywords && !ppcLoading && (
                          <button onClick={()=>generatePPCKeywords(results)}
                            style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:9, border:'none', background:'#f59e0b', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                            <Sparkles size={12}/> Generate PPC Ideas
                          </button>
                        )}
                      </div>
                      {ppcLoading && (
                        <div style={{ padding:'24px', textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          <Loader2 size={14} color="#d97706" style={{animation:'spin 1s linear infinite'}}/> Generating keyword ideas…
                        </div>
                      )}
                      {ppcKeywords && (
                        <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
                          {/* Headlines */}
                          {ppcKeywords.ad_headline_ideas?.length > 0 && (
                            <div>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Ad Headlines</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {ppcKeywords.ad_headline_ideas.map((h,i) => (
                                  <span key={i} style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'5px 10px', fontSize:13, fontFamily:FH, fontWeight:600, color:'#92400e' }}>{h}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Service keywords */}
                          {ppcKeywords.service_keywords?.length > 0 && (
                            <div>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Service Keywords</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {ppcKeywords.service_keywords.map((k,i) => (
                                  <span key={i} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'4px 10px', fontSize:12, fontFamily:FH, color:'#15803d' }}>{k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Long tail */}
                          {ppcKeywords.long_tail_keywords?.length > 0 && (
                            <div>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Long-Tail Keywords</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {ppcKeywords.long_tail_keywords.map((k,i) => (
                                  <span key={i} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'4px 10px', fontSize:12, fontFamily:FH, color:'#1d4ed8' }}>{k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Negatives */}
                          {ppcKeywords.negative_keywords?.length > 0 && (
                            <div>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Negative Keywords</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {ppcKeywords.negative_keywords.map((k,i) => (
                                  <span key={i} style={{ background:'#fef2f2', border:`1px solid ${RED}30`, borderRadius:8, padding:'4px 10px', fontSize:12, fontFamily:FH, color:RED }}>−{k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Strategy + CPC */}
                          <div style={{ background:'#f9fafb', borderRadius:10, padding:'12px 16px' }}>
                            {ppcKeywords.target_cpc_range && (
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#374151', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                                <DollarSign size={13} color="#d97706"/> Estimated CPC: {ppcKeywords.target_cpc_range}
                              </div>
                            )}
                            {ppcKeywords.campaign_strategy && (
                              <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{ppcKeywords.campaign_strategy}</div>
                            )}
                          </div>
                          {/* Ad descriptions */}
                          {ppcKeywords.ad_description_ideas?.length > 0 && (
                            <div>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Ad Descriptions</div>
                              {ppcKeywords.ad_description_ideas.map((d,i) => (
                                <div key={i} style={{ fontSize:13, color:'#374151', fontFamily:FB, padding:'6px 0', borderBottom:i<ppcKeywords.ad_description_ideas.length-1?'1px solid #f3f4f6':'none' }}>"{d}"</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {!ppcKeywords && !ppcLoading && (
                        <div style={{ padding:'16px 20px', fontSize:13, color:'#9ca3af', fontFamily:FB }}>
                          Generate AI-powered keyword suggestions, ad copy ideas, and campaign strategy based on your local competitor data.
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab==='history' && (
            <div>
              {historyLoading ? (
                <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={RED} style={{animation:'spin 1s linear infinite'}}/></div>
              ) : history.length===0 ? (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                  <History size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                  <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK, marginBottom:6 }}>No scan history yet</div>
                  <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>Select a client and run a scan to start tracking</div>
                </div>
              ) : (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                        {['Date','Keyword','Location','Rank','Results',''].map((h,i)=>(
                          <th key={i} style={{ padding:'11px 16px', fontSize:12, fontWeight:700, color:'#6b7280', textAlign:i>=3?'center':'left', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h,i)=>(
                        <tr key={h.id} style={{ borderTop:'1px solid #f9fafb' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#374151', whiteSpace:'nowrap' }}>
                            {new Date(h.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:BLK }}>{h.keyword}</td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#374151' }}>{h.location}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center' }}>
                            {h.target_rank ? (
                              <span style={{ fontFamily:FH, fontSize:16, fontWeight:900,
                                color:h.target_rank<=3?'#16a34a':h.target_rank<=7?TEAL:h.target_rank<=15?'#d97706':RED }}>
                                #{h.target_rank}
                              </span>
                            ) : <span style={{ color:'#9ca3af', fontSize:13 }}>—</span>}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#374151', textAlign:'center' }}>{h.total_results}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center' }}>
                            <button onClick={()=>rescan(h)}
                              style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${RED}`, background:'transparent',
                                color:RED, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH,
                                display:'flex', alignItems:'center', gap:4 }}>
                              <RefreshCw size={11}/> Rescan
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TRACKED KEYWORDS ── */}
          {tab==='tracked' && (
            <div>
              {tracked.length===0 ? (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                  <Target size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                  <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK, marginBottom:6 }}>No tracked keywords</div>
                  <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>Run scans to build your keyword tracking list</div>
                </div>
              ) : (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                        {['Keyword','Location','Last Rank','Business','Last Scanned',''].map((h,i)=>(
                          <th key={i} style={{ padding:'11px 16px', fontSize:12, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tracked.map((t,i)=>(
                        <tr key={i} style={{ borderTop:'1px solid #f9fafb' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:BLK }}>{t.keyword}</td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#374151' }}>{t.location}</td>
                          <td style={{ padding:'12px 16px' }}>
                            {t.target_rank ? (
                              <span style={{ fontFamily:FH, fontSize:16, fontWeight:900,
                                color:t.target_rank<=3?'#16a34a':t.target_rank<=7?TEAL:t.target_rank<=15?'#d97706':RED }}>
                                #{t.target_rank}
                              </span>
                            ) : <span style={{ color:'#9ca3af', fontSize:13 }}>Not found</span>}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#374151' }}>{t.target_business||'—'}</td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'#9ca3af' }}>
                            {new Date(t.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <button onClick={()=>{ setKeyword(t.keyword); setLocation(t.location); setTargetBiz(t.target_business||''); setTab('search') }}
                              style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${RED}`, background:'transparent',
                                color:RED, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH,
                                display:'flex', alignItems:'center', gap:4 }}>
                              <RefreshCw size={11}/> Rescan
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
