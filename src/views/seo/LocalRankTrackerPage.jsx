"use client";
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Search, Target, TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, Star, Globe, Phone, ChevronDown,
  BarChart2, Sparkles, Clock, Plus, History, Grid,
  AlertCircle, Check, ArrowUp, ArrowDown, Calendar,
  DollarSign, Users, Map, Zap, Download
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileRow, MobileTabs } from '../../components/mobile/MobilePage'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

// ── Rank color helper ─────────────────────────────────────────────────────────
function rankColor(rank) {
  if (!rank) return '#e5e7eb'
  if (rank <= 3)  return '#16a34a'
  if (rank <= 7)  return '#22c55e'
  if (rank <= 10) return '#84cc16'
  if (rank <= 15) return '#eab308'
  if (rank <= 20) return '#f97316'
  return '#ef4444'
}
function rankBg(rank) {
  if (!rank) return '#f9fafb'
  if (rank <= 3)  return '#f0fdf4'
  if (rank <= 7)  return '#f0fdf4'
  if (rank <= 10) return '#f7fee7'
  if (rank <= 15) return '#fefce8'
  if (rank <= 20) return '#fff7ed'
  return '#fef2f2'
}
function rankLabel(rank) {
  if (!rank) return '—'
  if (rank <= 3)  return 'Top 3'
  if (rank <= 7)  return 'Top 7'
  if (rank <= 10) return 'Top 10'
  if (rank <= 15) return 'Top 15'
  if (rank <= 20) return 'Top 20'
  return 'Not ranked'
}

// ── Heatmap Grid component ────────────────────────────────────────────────────
function HeatmapGrid({ gridResults, gridSize, summary, keyword, targetBusiness }) {
  const [hovered, setHovered] = useState(null)
  if (!gridResults?.length) return null

  // Build 2D grid from flat results
  const half = Math.floor(gridSize / 2)
  const grid = []
  for (let row = -half; row <= half; row++) {
    const rowCells = []
    for (let col = -half; col <= half; col++) {
      const cell = gridResults.find(r => r.row === row && r.col === col)
      rowCells.push(cell || { row, col, rank: null })
    }
    grid.push(rowCells)
  }

  const cellSize = gridSize <= 3 ? 90 : gridSize <= 5 ? 70 : 56

  return (
    <div>
      {/* Legend */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em' }}>
          Rank Legend
        </div>
        {[
          { label:'#1-3', color:'#16a34a' },
          { label:'#4-7', color:'#22c55e' },
          { label:'#8-10', color:'#84cc16' },
          { label:'#11-15', color:'#eab308' },
          { label:'#16-20', color:'#f97316' },
          { label:'Not found', color:'#e5e7eb' },
        ].map(l => (
          <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:14, height:14, borderRadius:4, background:l.color }}/>
            <span style={{ fontSize:12, color:'#374151', fontFamily:FH }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:'inline-block', position:'relative' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display:'flex', gap:4, marginBottom:4 }}>
            {row.map((cell, ci) => {
              const isCenter = cell.row === 0 && cell.col === 0
              const bg = rankBg(cell.rank)
              const color = rankColor(cell.rank)
              const isHovered = hovered?.row === cell.row && hovered?.col === cell.col
              return (
                <div key={ci}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: cellSize, height: cellSize,
                    borderRadius: 10,
                    background: bg,
                    border: isCenter
                      ? `2px solid ${BLK}`
                      : isHovered
                      ? `2px solid ${color}`
                      : `1.5px solid ${color}40`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform .1s, box-shadow .1s',
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isHovered ? `0 4px 16px ${color}40` : 'none',
                    position: 'relative',
                  }}>
                  {isCenter && (
                    <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)',
                      fontSize:9, fontWeight:800, background:BLK, color:'#fff',
                      padding:'1px 5px', borderRadius:20, whiteSpace:'nowrap', fontFamily:FH }}>
                      CENTER
                    </div>
                  )}
                  <div style={{
                    fontFamily: FH,
                    fontSize: cell.rank ? (cellSize <= 56 ? 18 : 22) : 16,
                    fontWeight: 900,
                    color: color,
                    lineHeight: 1,
                  }}>
                    {cell.rank ? `#${cell.rank}` : '—'}
                  </div>
                  {cell.rank && (
                    <div style={{ fontSize: 9, color: color, fontFamily: FH, fontWeight: 700, marginTop: 2, opacity: .8 }}>
                      {rankLabel(cell.rank)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
            background: BLK, color: '#fff', borderRadius: 12,
            padding: '10px 14px', fontSize: 12, fontFamily: FH,
            minWidth: 200, zIndex: 10, pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,.3)',
          }}>
            <div style={{ fontWeight: 800, marginBottom: 4, color: rankColor(hovered.rank) }}>
              {hovered.rank ? `Ranked #${hovered.rank}` : 'Not found in top 20'}
            </div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginBottom: 4 }}>
              Grid position: row {hovered.row > 0 ? '+' : ''}{hovered.row}, col {hovered.col > 0 ? '+' : ''}{hovered.col}
            </div>
            {hovered.top3?.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
                Top results here:<br/>
                {hovered.top3.slice(0, 3).map((n, i) => (
                  <span key={i} style={{ display:'block', marginTop:1 }}>
                    {i+1}. {n.length > 25 ? n.slice(0,25)+'…' : n}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary stats below grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:16 }}>
        {[
          { label:'Avg Rank',     value: summary.avg_rank ? `#${summary.avg_rank}` : '—',    color: rankColor(summary.avg_rank) },
          { label:'Best Rank',    value: summary.best_rank ? `#${summary.best_rank}` : '—',  color: rankColor(summary.best_rank) },
          { label:'Visibility',   value: summary.ranked_cells + '/' + summary.total_cells,    color: TEAL },
          { label:'Coverage',     value: summary.coverage_pct + '%',                          color: summary.coverage_pct > 60 ? '#16a34a' : summary.coverage_pct > 30 ? '#eab308' : RED },
        ].map((s, i) => (
          <div key={i} style={{ background:'#f9fafb', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Trend Chart component ─────────────────────────────────────────────────────
function TrendChart({ history, targetBusiness, keyword }) {
  if (!history?.length) return null

  const scans = [...history]
    .filter(h => h.target_rank)
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
    .slice(-12)  // last 12 scans

  if (scans.length < 2) return (
    <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>
      Run at least 2 scans to see rank trends
    </div>
  )

  const ranks = scans.map(s => s.target_rank)
  const maxRank = Math.max(...ranks, 20)
  const minRank = 1
  const chartH = 160
  const chartW = 520
  const padL = 36, padR = 16, padT = 16, padB = 32

  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB

  // Convert rank to Y (rank 1 = top = 0, rank 20 = bottom = plotH)
  const rankToY = (r) => padT + ((r - minRank) / (maxRank - minRank)) * plotH
  const idxToX  = (i) => padL + (i / (scans.length - 1)) * plotW

  // Build SVG path
  const points = scans.map((s, i) => `${idxToX(i)},${rankToY(s.target_rank)}`)
  const path = `M ${points.join(' L ')}`

  // Area fill
  const areaPath = `M ${idxToX(0)},${rankToY(scans[0].target_rank)} L ${points.join(' L ')} L ${idxToX(scans.length-1)},${chartH-padB} L ${idxToX(0)},${chartH-padB} Z`

  const latestRank = scans[scans.length-1].target_rank
  const firstRank  = scans[0].target_rank
  const trend      = firstRank - latestRank  // positive = improved

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
          Rank Trend — {keyword}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20,
          background: trend > 0 ? '#f0fdf4' : trend < 0 ? '#fef2f2' : '#f9fafb',
          color: trend > 0 ? '#16a34a' : trend < 0 ? RED : '#9ca3af',
          fontSize: 12, fontWeight: 800, fontFamily: FH }}>
          {trend > 0 ? <ArrowUp size={12}/> : trend < 0 ? <ArrowDown size={12}/> : <Minus size={12}/>}
          {trend > 0 ? `↑${trend} positions improved` : trend < 0 ? `↓${Math.abs(trend)} positions dropped` : 'No change'}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow:'visible' }}>
        {/* Grid lines */}
        {[1,5,10,15,20].filter(r => r <= maxRank).map(r => (
          <g key={r}>
            <line x1={padL} y1={rankToY(r)} x2={chartW-padR} y2={rankToY(r)}
              stroke="#f3f4f6" strokeWidth="1"/>
            <text x={padL-4} y={rankToY(r)+4} textAnchor="end"
              fontSize="10" fill="#9ca3af" fontFamily={FH}>
              #{r}
            </text>
          </g>
        ))}
        {/* Area */}
        <path d={areaPath} fill={`${TEAL}15`}/>
        {/* Line */}
        <path d={path} fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Points */}
        {scans.map((s, i) => (
          <g key={i}>
            <circle cx={idxToX(i)} cy={rankToY(s.target_rank)} r="5"
              fill="#fff" stroke={rankColor(s.target_rank)} strokeWidth="2.5"/>
            {/* Date label */}
            <text x={idxToX(i)} y={chartH-padB+14} textAnchor="middle"
              fontSize="9" fill="#9ca3af" fontFamily={FH}>
              {new Date(s.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            </text>
          </g>
        ))}
        {/* Latest rank label */}
        <text x={idxToX(scans.length-1)+8} y={rankToY(latestRank)+4}
          fontSize="11" fontWeight="800" fill={rankColor(latestRank)} fontFamily={FH}>
          #{latestRank}
        </text>
      </svg>
    </div>
  )
}

// ── Compact result row ────────────────────────────────────────────────────────
const PRICE_LABELS = { PRICE_LEVEL_FREE:'Free', PRICE_LEVEL_INEXPENSIVE:'$', PRICE_LEVEL_MODERATE:'$$', PRICE_LEVEL_EXPENSIVE:'$$$', PRICE_LEVEL_VERY_EXPENSIVE:'$$$$' }

function ResultRow({ result, targetBusiness, expanded, onToggle }) {
  const isTarget = targetBusiness && result.name?.toLowerCase().includes(targetBusiness.toLowerCase())
  const color = rankColor(result.rank)
  return (
    <div style={{ borderBottom:'1px solid #f3f4f6',
      background:isTarget?RED+'06':'transparent',
      borderLeft:isTarget?`3px solid ${RED}`:'3px solid transparent' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', cursor:'pointer' }}
        onClick={onToggle}>
        <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
          background:isTarget?RED:rankBg(result.rank),
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:FH, fontSize:13, fontWeight:900,
          color:isTarget?'#fff':color, border:`1px solid ${color}30` }}>
          {result.rank}
        </div>
        {result.photos?.[0] && (
          <img src={result.photos[0]} alt={result.name}
            style={{ width:34, height:34, borderRadius:7, objectFit:'cover', flexShrink:0 }}
            onError={e=>e.target.style.display='none'}/>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:isTarget?RED:BLK }}>{result.name}</span>
            {isTarget && <span style={{ fontSize:10, background:RED, color:'#fff', padding:'1px 5px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>CLIENT</span>}
            {result.is_open_now===true  && <span style={{ fontSize:10, background:'#f0fdf4', color:'#16a34a', padding:'1px 5px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>Open</span>}
            {result.is_open_now===false && <span style={{ fontSize:10, background:'#fef2f2', color:RED, padding:'1px 5px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>Closed</span>}
            {result.price_level && <span style={{ fontSize:10, color:'#9ca3af', fontFamily:FH }}>{PRICE_LABELS[result.price_level]||''}</span>}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.address}</div>
        </div>
        <div style={{ flexShrink:0, textAlign:'right' }}>
          {result.rating && (
            <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, justifyContent:'flex-end' }}>
              <Star size={10} color="#f59e0b" fill="#f59e0b"/>
              <span style={{ fontWeight:700, color:'#374151' }}>{result.rating}</span>
            </div>
          )}
          <div style={{ fontSize:11, color:'#9ca3af' }}>{result.review_count?.toLocaleString()}</div>
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          {result.website && <a href={result.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#9ca3af' }}><Globe size={12}/></a>}
          {result.maps_url && <a href={result.maps_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#4285f4' }}><MapPin size={12}/></a>}
        </div>
        <ChevronDown size={13} color="#d0d0cc" style={{ flexShrink:0, transform:expanded?'rotate(180deg)':'none', transition:'transform .2s' }}/>
      </div>
      {expanded && (
        <div style={{ padding:'0 20px 12px', borderTop:'1px solid #f9fafb' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
            {result.hours?.length > 0 && (
              <div style={{ background:'#f9fafb', borderRadius:9, padding:'10px 12px' }}>
                <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Hours</div>
                {result.hours.map((h,i) => <div key={i} style={{ fontSize:11, color:'#374151', lineHeight:1.8 }}>{h}</div>)}
              </div>
            )}
            {result.photos?.length > 1 && (
              <div>
                <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Photos</div>
                <div style={{ display:'flex', gap:5 }}>
                  {result.photos.slice(0,3).map((url,i) => (
                    <img key={i} src={url} alt="" style={{ width:60, height:60, borderRadius:7, objectFit:'cover' }}
                      onError={e=>e.target.style.display='none'}/>
                  ))}
                </div>
              </div>
            )}
            {result.editorial && (
              <div style={{ gridColumn:'1/-1', background:TEAL+'10', borderRadius:9, padding:'9px 12px', border:`1px solid ${TEAL}30` }}>
                <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Google Summary</div>
                <div style={{ fontSize:12, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>"{result.editorial}"</div>
              </div>
            )}
            {result.phone && <div style={{ fontSize:12, color:'#374151', display:'flex', alignItems:'center', gap:5 }}><Phone size={11} color="#9ca3af"/>{result.phone}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LocalRankTrackerPage() {
  const { agencyId } = useAuth()
  const navigate     = useNavigate()
  const isMobile     = useMobile()

  // Form state
  const [keyword,   setKeyword]   = useState('')
  const [location,  setLocation]  = useState('')
  const [targetBiz, setTargetBiz] = useState('')
  const [radiusKm,  setRadiusKm]  = useState(16)
  const [clientId,  setClientId]  = useState('')

  // Tab
  const [tab, setTab] = useState('scan') // scan | grid | history | tracked

  // Single scan
  const [scanning,   setScanning]   = useState(false)
  const [results,    setResults]     = useState(null)
  const [expandedRow,setExpandedRow] = useState(null)

  // Grid scan
  const [gridSize,    setGridSize]    = useState(3)
  const [spacingKm,   setSpacingKm]   = useState(1.5)
  const [gridLoading, setGridLoading] = useState(false)
  const [gridResults, setGridResults] = useState(null)

  // Data
  const [clients, setClients]   = useState([])
  const [history, setHistory]   = useState([])
  const [tracked, setTracked]   = useState([])
  const [gridHistory, setGridHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => {
    if (clientId) { loadHistory(); loadTracked(); loadGridHistory() }
  }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,industry')
      .eq('agency_id', agencyId || '').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase.from('local_rank_scans').select('*')
      .eq('client_id', clientId).order('scanned_at', { ascending:false }).limit(60)
    setHistory(data || [])
    setHistoryLoading(false)
  }

  async function loadGridHistory() {
    const { data } = await supabase.from('local_rank_grid_scans').select('*')
      .eq('client_id', clientId).order('scanned_at', { ascending:false }).limit(20)
    setGridHistory(data || [])
  }

  async function loadTracked() {
    const { data } = await supabase.from('local_rank_scans')
      .select('keyword,location,target_business,target_rank,scanned_at')
      .eq('client_id', clientId).order('scanned_at', { ascending:false })
    if (!data) return
    const seen = new Set()
    const unique = data.filter(d => {
      const key = `${d.keyword}|${d.location}`
      if (seen.has(key)) return false
      seen.add(key); return true
    })
    setTracked(unique.slice(0, 20))
  }

  async function runScan() {
    if (!keyword.trim() || !location.trim()) { toast.error('Enter a keyword and location'); return }
    setScanning(true); setResults(null)
    try {
      const res = await fetch('/api/seo/local-rank', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          keyword:keyword.trim(), location:location.trim(),
          target_business:targetBiz.trim()||undefined,
          radius_km:radiusKm, include_ai:true, include_details:true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data)
      if (clientId) {
        await supabase.from('local_rank_scans').insert({
          client_id:clientId, agency_id:agencyId,
          keyword:data.keyword, location:data.location,
          target_business:data.target_business||null,
          radius_km:data.radius_km, target_rank:data.target_rank,
          total_results:data.total_results, results:data.google_local,
          ai_analysis:data.ai_analysis||{}, scanned_at:data.searched_at,
        })
        loadHistory(); loadTracked()
      }
      toast.success(`Found ${data.total_results} businesses${data.target_rank?` · ${targetBiz||'client'} ranked #${data.target_rank}`:''}`)
    } catch(e) { toast.error('Scan failed: ' + e.message) }
    setScanning(false)
  }

  async function runGridScan() {
    if (!keyword.trim() || !location.trim() || !targetBiz.trim()) {
      toast.error('Keyword, location, and business name are all required for grid scan')
      return
    }
    setGridLoading(true); setGridResults(null)
    toast.loading(`Scanning ${gridSize}×${gridSize} grid (${gridSize*gridSize} points)…`, { id:'grid' })
    try {
      const res = await fetch('/api/seo/grid-scan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          keyword:keyword.trim(), location:location.trim(),
          target_business:targetBiz.trim(),
          grid_size:gridSize, spacing_km:spacingKm, search_radius_km:2,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGridResults(data)
      toast.success(`Grid scan complete · avg rank #${data.summary.avg_rank||'—'} · ${data.summary.coverage_pct}% coverage`, { id:'grid' })
      if (clientId) {
        await supabase.from('local_rank_grid_scans').insert({
          client_id:clientId, agency_id:agencyId,
          keyword:data.keyword, center_location:data.location,
          center_lat:data.geocoded?.lat, center_lng:data.geocoded?.lng,
          target_business:data.target_business,
          grid_size:data.grid_size, grid_spacing_km:data.spacing_km,
          grid_results:data.grid_results, avg_rank:data.summary.avg_rank,
          best_rank:data.summary.best_rank, worst_rank:data.summary.worst_rank,
          ranked_cells:data.summary.ranked_cells, total_cells:data.summary.total_cells,
          scanned_at:data.scanned_at,
        })
        loadGridHistory()
      }
    } catch(e) { toast.error('Grid scan failed: ' + e.message, { id:'grid' }) }
    setGridLoading(false)
  }

  // Get scan history for a specific keyword (for trend chart)
  const keywordHistory = history.filter(h =>
    h.keyword?.toLowerCase() === keyword.toLowerCase() &&
    h.location?.toLowerCase() === location.toLowerCase()
  )

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    const mTabs = [
      { key:'scan',    label:'Scan' },
      { key:'grid',    label:'Grid' },
      { key:'history', label:'History', count:history.length },
    ]
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Local Rank Tracker" subtitle="Google Maps rank tracking"/>
        <MobileTabs tabs={mTabs} active={tab} onChange={setTab}/>

        {tab==='scan' && (
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            <select value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, color:BLK, background:'#fff' }}>
              <option value="">Select client (optional)</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {['keyword','location','targetBiz'].map((field, i) => (
              <input key={field} value={field==='keyword'?keyword:field==='location'?location:targetBiz}
                onChange={e=>field==='keyword'?setKeyword(e.target.value):field==='location'?setLocation(e.target.value):setTargetBiz(e.target.value)}
                placeholder={['e.g. plumber, dentist…','e.g. Miami FL, Boca Raton…','Client business name to highlight'][i]}
                style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, outline:'none', color:BLK, boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#ececea'}/>
            ))}
            <button onClick={runScan} disabled={scanning||!keyword.trim()||!location.trim()}
              style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {scanning?<><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Scanning…</>:<><Target size={16}/> Scan</>}
            </button>
            {results && (
              <>
                <div style={{ background:RED+'10', border:`1px solid ${RED}30`, borderRadius:12, padding:'14px', textAlign:'center' }}>
                  <div style={{ fontFamily:FH, fontSize:32, fontWeight:900, color:rankColor(results.target_rank) }}>
                    {results.target_rank?`#${results.target_rank}`:'Not found'}
                  </div>
                  <div style={{ fontSize:13, color:'#374151' }}>{targetBiz} in Google Maps</div>
                </div>
                <MobileCard style={{ margin:0 }}>
                  {results.google_local?.slice(0,10).map((r,i) => {
                    const isTgt = targetBiz && r.name?.toLowerCase().includes(targetBiz.toLowerCase())
                    return (
                      <div key={i} style={{ padding:'10px 14px', borderBottom:i<9?'1px solid #f2f2f0':'none',
                        background:isTgt?RED+'08':'transparent', borderLeft:isTgt?`3px solid ${RED}`:'3px solid transparent' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:28, height:28, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:isTgt?RED:rankBg(r.rank), fontFamily:FH, fontSize:12, fontWeight:800, color:isTgt?'#fff':rankColor(r.rank) }}>{r.rank}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:isTgt?RED:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                            {r.rating && <div style={{ fontSize:12, color:'#9a9a96' }}>★ {r.rating} ({r.review_count})</div>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </MobileCard>
              </>
            )}
          </div>
        )}

        {tab==='grid' && (
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ background:'#fffbeb', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400e', fontFamily:FB }}>
              Grid scanning works best on desktop for the full heatmap view
            </div>
            {gridResults && (
              <div style={{ background:'#fff', borderRadius:12, padding:'14px', border:'1px solid #e5e7eb' }}>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:10 }}>
                  {gridResults.grid_size}×{gridResults.grid_size} Grid Results
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Avg Rank', value:gridResults.summary.avg_rank?`#${gridResults.summary.avg_rank}`:'—', color:rankColor(gridResults.summary.avg_rank) },
                    { label:'Best Rank', value:gridResults.summary.best_rank?`#${gridResults.summary.best_rank}`:'—', color:rankColor(gridResults.summary.best_rank) },
                    { label:'Coverage', value:gridResults.summary.coverage_pct+'%', color:TEAL },
                    { label:'Visibility', value:`${gridResults.summary.ranked_cells}/${gridResults.summary.total_cells}`, color:'#374151' },
                  ].map((s,i) => (
                    <div key={i} style={{ background:'#f9fafb', borderRadius:8, padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{s.label}</div>
                      <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={runGridScan} disabled={gridLoading||!keyword.trim()||!location.trim()||!targetBiz.trim()}
              style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:'#7c3aed', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {gridLoading?<><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Scanning grid…</>:<><Grid size={16}/> Run {gridSize}×{gridSize} Grid</>}
            </button>
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
                {history.map((h,i) => (
                  <MobileRow key={h.id} borderBottom={i<history.length-1}
                    onClick={()=>{ setKeyword(h.keyword); setLocation(h.location); setTargetBiz(h.target_business||''); setTab('scan') }}
                    left={<div style={{ width:36, height:36, borderRadius:9, background:rankBg(h.target_rank), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:14, fontWeight:900, color:rankColor(h.target_rank) }}>
                      {h.target_rank?`#${h.target_rank}`:'?'}
                    </div>}
                    title={h.keyword}
                    subtitle={`${h.location} · ${new Date(h.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}/>
                ))}
              </MobileCard>
            )}
          </>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </MobilePage>
    )
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  const TABS = [
    { key:'scan',    label:'Single Scan',   icon:Search },
    { key:'grid',    label:'Grid Heatmap',  icon:Grid   },
    { key:'trend',   label:'Rank Trends',   icon:TrendingUp },
    { key:'history', label:'Scan History',  icon:History },
    { key:'tracked', label:'Tracked Keywords', icon:Target },
  ]

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
              <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>
                Google Maps rank tracking · Grid heatmaps · Trend analysis
              </p>
            </div>
            <select value={clientId} onChange={e=>setClientId(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH, minWidth:200 }}>
              <option value="">All clients</option>
              {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:0, marginTop:16 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{ padding:'11px 18px', border:'none', background:'transparent',
                  borderBottom:`2.5px solid ${tab===t.key?RED:'transparent'}`,
                  color:tab===t.key?'#fff':'rgba(255,255,255,.35)', fontSize:13,
                  fontWeight:tab===t.key?700:500, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6, fontFamily:FH }}>
                <t.icon size={13}/> {t.label}
                {t.key==='history'&&history.length>0&&<span style={{fontSize:10,background:RED,color:'#fff',padding:'1px 5px',borderRadius:20,marginLeft:2}}>{history.length}</span>}
                {t.key==='grid'&&<span style={{fontSize:10,background:'#7c3aed',color:'#fff',padding:'1px 5px',borderRadius:20,marginLeft:2}}>NEW</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* Shared form bar — shown on scan + grid tabs */}
          {(tab==='scan'||tab==='grid') && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto auto', gap:10, alignItems:'end' }}>
                <div>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Keyword *</label>
                  <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="e.g. plumber, dentist"
                    onKeyDown={e=>e.key==='Enter'&&(tab==='scan'?runScan():runGridScan())}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, outline:'none', color:BLK, boxSizing:'border-box' }}
                    onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                </div>
                <div>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Location *</label>
                  <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Miami FL"
                    onKeyDown={e=>e.key==='Enter'&&(tab==='scan'?runScan():runGridScan())}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, outline:'none', color:BLK, boxSizing:'border-box' }}
                    onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                </div>
                <div>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Business Name *</label>
                  <input value={targetBiz} onChange={e=>setTargetBiz(e.target.value)} placeholder="Client name to track"
                    onKeyDown={e=>e.key==='Enter'&&(tab==='scan'?runScan():runGridScan())}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, outline:'none', color:BLK, boxSizing:'border-box' }}
                    onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                </div>
                {tab==='scan' && (
                  <div>
                    <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Radius</label>
                    <select value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))}
                      style={{ padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:BLK, background:'#fff' }}>
                      {[5,10,16,25,50].map(r=><option key={r} value={r}>{r}km</option>)}
                    </select>
                  </div>
                )}
                {tab==='grid' && (
                  <div style={{ display:'flex', gap:8 }}>
                    <div>
                      <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Grid</label>
                      <select value={gridSize} onChange={e=>setGridSize(Number(e.target.value))}
                        style={{ padding:'9px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:BLK, background:'#fff' }}>
                        <option value={3}>3×3 (9)</option>
                        <option value={5}>5×5 (25)</option>
                        <option value={7}>7×7 (49)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Spacing</label>
                      <select value={spacingKm} onChange={e=>setSpacingKm(Number(e.target.value))}
                        style={{ padding:'9px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:BLK, background:'#fff' }}>
                        <option value={0.5}>0.5km</option>
                        <option value={1}>1km</option>
                        <option value={1.5}>1.5km</option>
                        <option value={2}>2km</option>
                        <option value={3}>3km</option>
                        <option value={5}>5km</option>
                      </select>
                    </div>
                  </div>
                )}
                <button
                  onClick={tab==='scan'?runScan:runGridScan}
                  disabled={(tab==='scan'?scanning:gridLoading)||!keyword.trim()||!location.trim()||(tab==='grid'&&!targetBiz.trim())}
                  style={{ padding:'9px 20px', borderRadius:10, border:'none',
                    background:tab==='grid'?'#7c3aed':RED, color:'#fff',
                    fontSize:14, fontWeight:700, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
                    opacity:(tab==='scan'?scanning:gridLoading)||!keyword.trim()||!location.trim()?.6:1,
                    boxShadow:`0 3px 12px ${tab==='grid'?'#7c3aed':'#ea2729'}40` }}>
                  {(tab==='scan'?scanning:gridLoading)
                    ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>
                    : tab==='grid' ? <Grid size={14}/> : <Target size={14}/>}
                  {tab==='scan'
                    ? (scanning?'Scanning…':'Run Scan')
                    : (gridLoading?`Scanning ${gridSize}×${gridSize}…`:`Run ${gridSize}×${gridSize} Grid`)}
                </button>
              </div>
            </div>
          )}

          {/* ── SINGLE SCAN ─────────────────────────────────────────────── */}
          {tab==='scan' && (
            <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:20, alignItems:'start' }}>
              {/* Quick rescan sidebar */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {tracked.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>Quick Rescan</div>
                    {tracked.slice(0,6).map((t,i) => (
                      <button key={i}
                        onClick={()=>{ setKeyword(t.keyword); setLocation(t.location); setTargetBiz(t.target_business||'') }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                          border:'none', borderBottom:i<Math.min(tracked.length,6)-1?'1px solid #f9fafb':'none',
                          background:'transparent', cursor:'pointer', textAlign:'left' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{ width:28, height:28, borderRadius:7, background:rankBg(t.target_rank),
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:FH, fontSize:11, fontWeight:900, color:rankColor(t.target_rank), flexShrink:0 }}>
                          {t.target_rank?`#${t.target_rank}`:'?'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>{t.keyword}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.location}</div>
                        </div>
                        <RefreshCw size={11} color="#d0d0cc"/>
                      </button>
                    ))}
                  </div>
                )}

                {/* Trend mini-chart in sidebar when we have history */}
                {keywordHistory.length >= 2 && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px' }}>
                    <TrendChart history={keywordHistory} targetBusiness={targetBiz} keyword={keyword}/>
                  </div>
                )}
              </div>

              {/* Main results panel */}
              <div>
                {!results && !scanning && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                    <MapPin size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                    <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8, letterSpacing:'-.02em' }}>Track Local Rankings</div>
                    <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, maxWidth:360, margin:'0 auto 20px' }}>
                      See exactly where your client ranks on Google Maps for any keyword in any location.
                    </div>
                    <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                      {['Use Grid tab for geographic heatmap','Compare vs competitors','Track rank changes over time'].map((tip,i) => (
                        <span key={i} style={{ fontSize:12, background:'#f9fafb', color:'#374151', padding:'4px 10px', borderRadius:20, fontFamily:FH }}>✓ {tip}</span>
                      ))}
                    </div>
                  </div>
                )}

                {scanning && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                    <div style={{ width:56, height:56, borderRadius:16, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                      <Target size={28} color={RED}/>
                    </div>
                    <div style={{ fontFamily:FH, fontSize:16, fontWeight:700, color:BLK, marginBottom:4 }}>Scanning Google Maps…</div>
                    <div style={{ fontSize:14, color:'#9ca3af', fontFamily:FB }}>Fetching live rankings + AI analysis</div>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}

                {results && (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {/* KPI row */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                      {[
                        { label:'Client Rank',      value:results.target_rank?`#${results.target_rank}`:'Not found', color:rankColor(results.target_rank) },
                        { label:'Total Results',     value:results.total_results, color:BLK },
                        { label:'Avg Rating',        value:results.competitive_stats?.avg_rating?`★${results.competitive_stats.avg_rating}`:'—', color:'#f59e0b' },
                        { label:'Top 3 Avg Reviews', value:results.competitive_stats?.top3_avg_reviews?.toLocaleString()||'—', color:'#374151' },
                        { label:'Open Now',          value:results.competitive_stats?.open_now_count!=null?`${results.competitive_stats.open_now_count}/${results.total_results}`:'—', color:'#16a34a' },
                      ].map((s,i) => (
                        <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 14px' }}>
                          <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{s.label}</div>
                          <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:s.color, letterSpacing:'-.02em', lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Map embed */}
                    {results.geocoded_location && (
                      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                        <div style={{ padding:'10px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:6 }}>
                          <MapPin size={13} color={TEAL}/>
                          <span style={{ fontFamily:FH, fontSize:12, fontWeight:600, color:'#0e7490' }}>
                            {results.geocoded_location.formatted} · {results.search_mode==='nearby'?'Nearby Search':'Text Search'}
                          </span>
                        </div>
                        <iframe title="Local Rank Map" width="100%" height="280" loading="lazy"
                          style={{ border:'none', display:'block' }}
                          src={`https://www.google.com/maps/embed/v1/search?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY||process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY||''}&q=${encodeURIComponent((keyword||'')+' '+(location||''))}&center=${results.geocoded_location.lat},${results.geocoded_location.lng}&zoom=12`}/>
                      </div>
                    )}

                    {/* Results table */}
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>
                          Google Maps — "{results.keyword}" in {results.location}
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>
                          {new Date(results.searched_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                        </div>
                      </div>
                      {results.google_local.map((r,i) => (
                        <ResultRow key={i} result={r} targetBusiness={results.target_business}
                          expanded={expandedRow===i} onToggle={()=>setExpandedRow(expandedRow===i?null:i)}/>
                      ))}
                    </div>

                    {/* AI analysis */}
                    {results.ai_analysis && (
                      <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${TEAL}40`, overflow:'hidden' }}>
                        <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                          <div style={{ width:30, height:30, borderRadius:8, background:TEAL+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Sparkles size={14} color={TEAL}/>
                          </div>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>AI Analysis</div>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:TEAL+'20', color:TEAL, fontFamily:FH }}>Claude</span>
                          {results.ai_analysis.rank_difficulty && (
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, fontFamily:FH, marginLeft:'auto',
                              background:results.ai_analysis.rank_difficulty==='easy'?'#f0fdf4':results.ai_analysis.rank_difficulty==='medium'?'#fffbeb':'#fef2f2',
                              color:results.ai_analysis.rank_difficulty==='easy'?'#16a34a':results.ai_analysis.rank_difficulty==='medium'?'#d97706':RED }}>
                              {results.ai_analysis.rank_difficulty?.replace('_',' ')} competition
                            </span>
                          )}
                        </div>
                        <div style={{ padding:'16px 20px' }}>
                          {results.ai_analysis.overall_assessment && (
                            <p style={{ fontSize:14, color:'#374151', lineHeight:1.7, margin:'0 0 14px', fontFamily:FB }}>{results.ai_analysis.overall_assessment}</p>
                          )}
                          {results.ai_analysis.recommendations?.length > 0 && (
                            <div style={{ marginBottom:14 }}>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Recommendations</div>
                              {results.ai_analysis.recommendations.map((rec,i) => (
                                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:i<results.ai_analysis.recommendations.length-1?'1px solid #f9fafb':'none' }}>
                                  <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, flexShrink:0, marginTop:1, fontFamily:FH, textTransform:'uppercase',
                                    background:rec.priority==='high'?RED+'15':rec.priority==='medium'?'#fffbeb':'#f3f4f6',
                                    color:rec.priority==='high'?RED:rec.priority==='medium'?'#d97706':'#6b7280' }}>{rec.priority}</span>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:2 }}>{rec.action}</div>
                                    <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{rec.impact}</div>
                                  </div>
                                  <span style={{ fontSize:11, color:'#9ca3af', flexShrink:0, fontFamily:FH, fontWeight:600 }}>{rec.effort} effort</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {results.ai_analysis.quick_wins?.length > 0 && (
                            <div style={{ background:'#f0fdf4', borderRadius:9, padding:'10px 14px', border:'1px solid #bbf7d0' }}>
                              <div style={{ fontFamily:FH, fontSize:11, fontWeight:800, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Quick Wins This Week</div>
                              {results.ai_analysis.quick_wins.map((w,i) => (
                                <div key={i} style={{ fontSize:13, color:'#15803d', fontFamily:FB, padding:'3px 0', display:'flex', alignItems:'flex-start', gap:6 }}>
                                  <Check size={12} color="#16a34a" style={{ flexShrink:0, marginTop:2 }}/> {w}
                                </div>
                              ))}
                            </div>
                          )}
                          {results.ai_analysis.estimated_time_to_rank && (
                            <div style={{ marginTop:10, fontSize:13, color:'#6b7280', fontFamily:FB, display:'flex', alignItems:'center', gap:6 }}>
                              <Clock size={12}/> Est. time to rank: <strong style={{ color:BLK }}>{results.ai_analysis.estimated_time_to_rank}</strong>
                            </div>
                          )}
                          {results.ai_analysis.review_strategy && (
                            <div style={{ marginTop:8, background:'#fffbeb', borderRadius:9, padding:'9px 12px', border:'1px solid #fde68a', fontSize:13, color:'#374151', fontFamily:FB }}>
                              <strong style={{ fontFamily:FH, color:'#d97706' }}>Reviews: </strong>{results.ai_analysis.review_strategy}
                            </div>
                          )}
                          {results.ai_analysis.competitive_gap && (
                            <div style={{ marginTop:8, background:'#fef2f2', borderRadius:9, padding:'10px 14px', border:`1px solid ${RED}30`, display:'flex', gap:14, alignItems:'center' }}>
                              <div style={{ textAlign:'center', flexShrink:0 }}>
                                <div style={{ fontFamily:FH, fontSize:22, fontWeight:900, color:RED }}>{results.ai_analysis.competitive_gap.review_gap>0?'+'+results.ai_analysis.competitive_gap.review_gap:results.ai_analysis.competitive_gap.review_gap}</div>
                                <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FH }}>reviews to catch #1</div>
                              </div>
                              <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{results.ai_analysis.competitive_gap.summary}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GRID HEATMAP ──────────────────────────────────────────────── */}
          {tab==='grid' && (
            <div>
              {!gridResults && !gridLoading && (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                  <Grid size={44} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                  <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8, letterSpacing:'-.02em' }}>Geographic Rank Heatmap</div>
                  <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, maxWidth:440, margin:'0 auto 20px' }}>
                    Scan a grid of GPS points around your client's location and see exactly where they rank across different neighborhoods — just like BrightLocal.
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
                    {['3×3 = 9 scan points','5×5 = 25 scan points','7×7 = 49 scan points'].map((tip,i) => (
                      <span key={i} style={{ fontSize:12, background:'#f5f3ff', color:'#7c3aed', padding:'4px 10px', borderRadius:20, fontFamily:FH }}>⬡ {tip}</span>
                    ))}
                  </div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>
                    Fill in keyword, location, and business name above, then click Run Grid
                  </div>
                </div>
              )}

              {gridLoading && (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:16, background:'#f5f3ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <Grid size={28} color="#7c3aed"/>
                  </div>
                  <div style={{ fontFamily:FH, fontSize:16, fontWeight:700, color:BLK, marginBottom:6 }}>
                    Scanning {gridSize}×{gridSize} grid…
                  </div>
                  <div style={{ fontSize:14, color:'#9ca3af', fontFamily:FB, marginBottom:16 }}>
                    Searching {gridSize*gridSize} locations — this takes about {Math.round(gridSize*gridSize*0.3)} seconds
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <Loader2 size={24} color="#7c3aed" style={{animation:'spin 1s linear infinite'}}/>
                  </div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {gridResults && !gridLoading && (
                <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:20, alignItems:'start' }}>
                  {/* Heatmap */}
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:4 }}>
                      {gridResults.grid_size}×{gridResults.grid_size} Grid — "{gridResults.keyword}" in {gridResults.location}
                    </div>
                    <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:16 }}>
                      {gridResults.spacing_km}km spacing · {gridResults.scanned_at && new Date(gridResults.scanned_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                    </div>
                    <HeatmapGrid
                      gridResults={gridResults.grid_results}
                      gridSize={gridResults.grid_size}
                      summary={gridResults.summary}
                      keyword={gridResults.keyword}
                      targetBusiness={gridResults.target_business}
                    />
                  </div>

                  {/* Right panel: analysis + history */}
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {/* Interpretation card */}
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:12 }}>Visibility Analysis</div>
                      <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.7, marginBottom:12 }}>
                        {gridResults.target_business} appears in{' '}
                        <strong style={{ color:gridResults.summary.coverage_pct>60?'#16a34a':gridResults.summary.coverage_pct>30?'#d97706':RED }}>
                          {gridResults.summary.ranked_cells} of {gridResults.summary.total_cells} areas
                        </strong>
                        {' '}({gridResults.summary.coverage_pct}% coverage) with an average rank of{' '}
                        <strong style={{ color:rankColor(gridResults.summary.avg_rank) }}>
                          #{gridResults.summary.avg_rank||'—'}
                        </strong>.
                        {gridResults.summary.coverage_pct < 30 && ' Low visibility — the business is only ranking in a small part of its service area.'}
                        {gridResults.summary.coverage_pct >= 30 && gridResults.summary.coverage_pct < 70 && ' Moderate visibility — ranking in some areas, weak in others.'}
                        {gridResults.summary.coverage_pct >= 70 && ' Strong visibility across the service area.'}
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {gridResults.summary.best_rank <= 3 && (
                          <span style={{ fontSize:12, background:'#f0fdf4', color:'#16a34a', padding:'4px 10px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>
                            ✓ Top 3 in best areas
                          </span>
                        )}
                        {gridResults.summary.coverage_pct < 50 && (
                          <span style={{ fontSize:12, background:'#fef2f2', color:RED, padding:'4px 10px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>
                            ⚠ Weak geographic coverage
                          </span>
                        )}
                        {gridResults.summary.avg_rank && gridResults.summary.avg_rank <= 5 && (
                          <span style={{ fontSize:12, background:'#f0fdf4', color:'#16a34a', padding:'4px 10px', borderRadius:20, fontFamily:FH, fontWeight:700 }}>
                            Strong avg rank #{gridResults.summary.avg_rank}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Past grid scans for this keyword */}
                    {gridHistory.filter(g=>g.keyword===keyword&&g.center_location===location).length > 1 && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:10 }}>Grid History</div>
                        {gridHistory.filter(g=>g.keyword===keyword&&g.center_location===location).slice(0,5).map((g,i) => (
                          <div key={g.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 0', borderBottom:i<4?'1px solid #f9fafb':'none' }}>
                            <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:rankColor(g.avg_rank), minWidth:40 }}>
                              #{g.avg_rank||'—'}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, color:'#374151', fontFamily:FH, fontWeight:600 }}>Avg rank</div>
                              <div style={{ fontSize:11, color:'#9ca3af' }}>{g.grid_size}×{g.grid_size} · {g.ranked_cells}/{g.total_cells} cells</div>
                            </div>
                            <div style={{ fontSize:11, color:'#9ca3af' }}>
                              {new Date(g.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TREND CHART ───────────────────────────────────────────────── */}
          {tab==='trend' && (
            <div>
              {tracked.length === 0 ? (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                  <TrendingUp size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                  <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK, marginBottom:6 }}>No trend data yet</div>
                  <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>Run scans regularly to build rank trend history</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {/* One trend card per unique keyword+location combo */}
                  {tracked.map((t, idx) => {
                    const kHistory = history.filter(h =>
                      h.keyword?.toLowerCase()===t.keyword?.toLowerCase() &&
                      h.location?.toLowerCase()===t.location?.toLowerCase() &&
                      h.target_rank
                    ).sort((a,b) => new Date(a.scanned_at) - new Date(b.scanned_at))
                    if (kHistory.length < 2) return null
                    const latest = kHistory[kHistory.length-1]
                    const first  = kHistory[0]
                    const trend  = first.target_rank - latest.target_rank
                    return (
                      <div key={idx} style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                          <div style={{ width:44, height:44, borderRadius:12, background:rankBg(latest.target_rank), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:17, fontWeight:900, color:rankColor(latest.target_rank) }}>
                            #{latest.target_rank}
                          </div>
                          <div>
                            <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>{t.keyword}</div>
                            <div style={{ fontSize:12, color:'#9ca3af' }}>{t.location} · {kHistory.length} scans</div>
                          </div>
                          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
                            background:trend>0?'#f0fdf4':trend<0?'#fef2f2':'#f9fafb',
                            color:trend>0?'#16a34a':trend<0?RED:'#9ca3af',
                            fontSize:13, fontWeight:800, fontFamily:FH }}>
                            {trend>0?<ArrowUp size={13}/>:trend<0?<ArrowDown size={13}/>:<Minus size={13}/>}
                            {trend>0?`+${trend} improved`:trend<0?`${trend} dropped`:'No change'}
                          </div>
                        </div>
                        <TrendChart history={kHistory} targetBusiness={t.target_business} keyword={t.keyword}/>
                      </div>
                    )
                  }).filter(Boolean)}
                </div>
              )}
            </div>
          )}

          {/* ── SCAN HISTORY ──────────────────────────────────────────────── */}
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
                        {['Date','Keyword','Location','Rank','Results',''].map((h,i) => (
                          <th key={i} style={{ padding:'10px 16px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:i>=3?'center':'left', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h,i) => (
                        <tr key={h.id} style={{ borderTop:'1px solid #f9fafb' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'11px 16px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>
                            {new Date(h.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
                          </td>
                          <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:BLK }}>{h.keyword}</td>
                          <td style={{ padding:'11px 16px', fontSize:13, color:'#374151' }}>{h.location}</td>
                          <td style={{ padding:'11px 16px', textAlign:'center' }}>
                            {h.target_rank ? (
                              <span style={{ fontFamily:FH, fontSize:15, fontWeight:900, color:rankColor(h.target_rank) }}>#{h.target_rank}</span>
                            ) : <span style={{ color:'#9ca3af', fontSize:13 }}>—</span>}
                          </td>
                          <td style={{ padding:'11px 16px', fontSize:13, color:'#374151', textAlign:'center' }}>{h.total_results}</td>
                          <td style={{ padding:'11px 16px', textAlign:'center' }}>
                            <button onClick={()=>{ setKeyword(h.keyword); setLocation(h.location); setTargetBiz(h.target_business||''); setTab('scan') }}
                              style={{ padding:'4px 10px', borderRadius:7, border:`1px solid ${RED}`, background:'transparent', color:RED, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:3 }}>
                              <RefreshCw size={10}/> Rescan
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

          {/* ── TRACKED KEYWORDS ──────────────────────────────────────────── */}
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
                        {['Keyword','Location','Last Rank','Business','Trend','Last Scanned',''].map((h,i) => (
                          <th key={i} style={{ padding:'10px 16px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tracked.map((t,i) => {
                        const kHistory = history.filter(h => h.keyword?.toLowerCase()===t.keyword?.toLowerCase() && h.target_rank)
                          .sort((a,b) => new Date(a.scanned_at) - new Date(b.scanned_at))
                        const prevRank  = kHistory.length >= 2 ? kHistory[kHistory.length-2].target_rank : null
                        const trend     = prevRank && t.target_rank ? prevRank - t.target_rank : null
                        return (
                          <tr key={i} style={{ borderTop:'1px solid #f9fafb' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:BLK }}>{t.keyword}</td>
                            <td style={{ padding:'11px 16px', fontSize:13, color:'#374151' }}>{t.location}</td>
                            <td style={{ padding:'11px 16px' }}>
                              {t.target_rank ? (
                                <span style={{ fontFamily:FH, fontSize:16, fontWeight:900, color:rankColor(t.target_rank) }}>#{t.target_rank}</span>
                              ) : <span style={{ color:'#9ca3af', fontSize:13 }}>Not found</span>}
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:13, color:'#374151' }}>{t.target_business||'—'}</td>
                            <td style={{ padding:'11px 16px' }}>
                              {trend !== null ? (
                                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, fontFamily:FH,
                                  color:trend>0?'#16a34a':trend<0?RED:'#9ca3af' }}>
                                  {trend>0?<ArrowUp size={12}/>:trend<0?<ArrowDown size={12}/>:<Minus size={12}/>}
                                  {Math.abs(trend)}
                                </span>
                              ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:12, color:'#9ca3af' }}>
                              {new Date(t.scanned_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              <button onClick={()=>{ setKeyword(t.keyword); setLocation(t.location); setTargetBiz(t.target_business||''); setTab('scan') }}
                                style={{ padding:'4px 10px', borderRadius:7, border:`1px solid ${RED}`, background:'transparent', color:RED, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:3 }}>
                                <RefreshCw size={10}/> Rescan
                              </button>
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
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
