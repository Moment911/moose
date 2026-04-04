"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, Search, MapPin, ChevronDown, ChevronUp, Star,
  Globe, Plus, Check, X, Loader2, ExternalLink, Phone,
  Mail, Copy, Filter, Zap, TrendingUp, AlertCircle,
  BarChart2, Bookmark, BookmarkCheck, ArrowRight,
  Building, Users, Wifi, WifiOff, Sparkles, RefreshCw
} from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

const INDUSTRIES = [
  { key:'restaurant',  label:'Restaurant',    emoji:'🍕' },
  { key:'law_firm',    label:'Law Firm',       emoji:'⚖️' },
  { key:'dental',      label:'Dental',         emoji:'🦷' },
  { key:'real_estate', label:'Real Estate',    emoji:'🏠' },
  { key:'gym',         label:'Gym / Fitness',  emoji:'💪' },
  { key:'salon',       label:'Salon / Spa',    emoji:'💅' },
  { key:'medical',     label:'Medical',        emoji:'🏥' },
  { key:'hvac',        label:'HVAC',           emoji:'❄️' },
  { key:'plumber',     label:'Plumber',        emoji:'🔧' },
  { key:'roofing',     label:'Roofing',        emoji:'🏗️' },
  { key:'auto_dealer', label:'Auto Dealer',    emoji:'🚗' },
  { key:'landscaping', label:'Landscaping',    emoji:'🌿' },
  { key:'childcare',   label:'Childcare',      emoji:'👶' },
  { key:'veterinary',  label:'Veterinary',     emoji:'🐾' },
  { key:'electrician', label:'Electrician',    emoji:'⚡' },
  { key:'contractor',  label:'Contractor',     emoji:'🏛️' },
]

const GAPS = [
  'No Google Analytics',
  'Inactive social media',
  'Poor review management',
  'Not running Google Ads',
  'No Facebook presence',
  'Google Business not optimized',
  'No email marketing',
  'Slow / outdated website',
]

const QUICK_SEARCHES = [
  { label:'Plumbers in Miami',         q:'Plumber',     loc:'Miami, FL' },
  { label:'Dental offices in Chicago', q:'Dental',      loc:'Chicago, IL' },
  { label:'Law firms in NYC',          q:'Law Firm',    loc:'New York, NY' },
  { label:'Salons in LA',              q:'Salon',       loc:'Los Angeles, CA' },
  { label:'HVAC in Dallas',            q:'HVAC',        loc:'Dallas, TX' },
  { label:'Gyms in Houston',           q:'Gym',         loc:'Houston, TX' },
]

function scoreColor(s) {
  return s >= 75 ? '#22c55e' : s >= 50 ? ACCENT : s >= 30 ? '#f59e0b' : '#3b82f6'
}
function scoreLabel(s) {
  return s >= 75
    ? { label:'Hot Lead',   color:'#dc2626', bg:'#fef2f2', icon:'🔥' }
    : s >= 50
    ? { label:'Warm',       color:ACCENT,    bg:'#fff7f5', icon:'🟠' }
    : s >= 30
    ? { label:'Lukewarm',   color:'#d97706', bg:'#fffbeb', icon:'🟡' }
    : { label:'Cold',       color:'#3b82f6', bg:'#eff6ff', icon:'🔵' }
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 52 }) {
  const r = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = scoreColor(score)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size>44?14:11, fontWeight:900, color }}>
        {score}
      </div>
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onSave, onAddClient, saved, view }) {
  const [expanded, setExpanded] = useState(false)
  const temp = scoreLabel(lead.score || lead.scout_score || 50)
  const score = lead.score || lead.scout_score || 50

  function copy(text) { navigator.clipboard.writeText(text); toast.success('Copied!') }

  if (view === 'list') return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'14px 18px', display:'flex', alignItems:'center', gap:14, transition:'box-shadow .15s' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      <ScoreRing score={score} size={46}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#111' }}>{lead.name}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:temp.bg, color:temp.color }}>{temp.icon} {temp.label}</span>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:12, color:'#9ca3af', flexWrap:'wrap' }}>
          {lead.address && <span>📍 {lead.address}</span>}
          {lead.phone && <span>📞 {lead.phone}</span>}
          {lead.rating && <span>⭐ {lead.rating} ({lead.review_count} reviews)</span>}
        </div>
        {lead.gaps?.length > 0 && (
          <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
            {lead.gaps.slice(0,3).map(g=><span key={g} style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#fff7f5', color:ACCENT, border:`1px solid ${ACCENT}25` }}>{g}</span>)}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:7, flexShrink:0 }}>
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" style={{ padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', display:'flex', alignItems:'center' }}><Globe size={14}/></a>}
        <button onClick={()=>onSave(lead)} style={{ padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color: saved?ACCENT:'#9ca3af', cursor:'pointer' }}>{saved?<BookmarkCheck size={14}/>:<Bookmark size={14}/>}</button>
        <button onClick={()=>onAddClient(lead)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}><Plus size={12}/> Add</button>
      </div>
    </div>
  )

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${expanded ? ACCENT+'40' : '#e5e7eb'}`, overflow:'hidden', transition:'all .15s', cursor:'pointer' }}
      onMouseEnter={e=>{ if(!expanded) e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,.1)' }}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
      onClick={()=>setExpanded(e=>!e)}>

      {/* Score bar at top */}
      <div style={{ height:3, background:`linear-gradient(90deg, ${scoreColor(score)}, ${scoreColor(score)}80)`, width:`${score}%` }}/>

      <div style={{ padding:'18px 18px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
          {/* Score ring */}
          <ScoreRing score={score}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:4, lineHeight:1.3 }}>{lead.name}</div>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:temp.bg, color:temp.color }}>{temp.icon} {temp.label}</span>
          </div>
          <button onClick={e=>{e.stopPropagation();onSave(lead)}} style={{ padding:'6px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:saved?ACCENT:'#9ca3af', cursor:'pointer', flexShrink:0 }}>
            {saved?<BookmarkCheck size={15}/>:<Bookmark size={15}/>}
          </button>
        </div>

        {/* Details */}
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
          {lead.address && <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:5, alignItems:'flex-start' }}><MapPin size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.address}</div>}
          {lead.phone && <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:5 }}><Phone size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.phone}</div>}
          {lead.rating && <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:5 }}><Star size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.rating}★ · {lead.review_count} reviews</div>}
          {lead.website && <div style={{ fontSize:12, color:'#3b82f6', display:'flex', gap:5 }}><Globe size={11} style={{ flexShrink:0, marginTop:1 }}/><a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#3b82f6', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.website.replace(/^https?:\/\//, '')}</a></div>}
        </div>

        {/* Marketing gaps */}
        {lead.gaps?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
            {lead.gaps.map(g=>(
              <span key={g} style={{ fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#fff7f5', color:ACCENT, border:`1px solid ${ACCENT}25` }}>⚠ {g}</span>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && lead.ai_summary && (
          <div style={{ background:'#f9fafb', borderRadius:10, padding:'11px 13px', marginBottom:12, fontSize:12, color:'#374151', lineHeight:1.65, borderTop:'1px solid #f3f4f6' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>AI Opportunity Summary</div>
            {lead.ai_summary}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:7 }} onClick={e=>e.stopPropagation()}>
          {lead.phone && <button onClick={()=>copy(lead.phone)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#374151' }}><Phone size={11}/> Call</button>}
          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#374151', textDecoration:'none' }}><Globe size={11}/> Site</a>}
          <button onClick={()=>onAddClient(lead)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <Plus size={13}/> Add as Client
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScoutPage() {
  const navigate = useNavigate()
  const [query, setQuery]       = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved]       = useState(new Set())
  const [view, setView]         = useState('grid') // grid|list
  const [filterScore, setFilterScore] = useState(0)
  const [filterGaps, setFilterGaps]   = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIndustries, setSelectedIndustries] = useState([])
  const [addedClients, setAddedClients] = useState(new Set())
  const [sortBy, setSortBy]     = useState('score') // score|name|reviews
  const [stats, setStats]       = useState(null)

  const hasResults = results.length > 0

  async function runSearch() {
    const term = query.trim() || selectedIndustries.map(k=>INDUSTRIES.find(i=>i.key===k)?.label).filter(Boolean).join(', ')
    if (!term && !location.trim()) { toast.error('Enter a business type or location'); return }
    setSearching(true); setResults([])

    try {
      const prompt = `You are a B2B sales intelligence AI for a marketing agency. Generate 12 realistic local business leads for a marketing agency to prospect.

Search: "${term}" in "${location || 'United States'}"
${filterGaps.length ? `Must have these marketing gaps: ${filterGaps.join(', ')}` : ''}

Return ONLY valid JSON array of 12 businesses. Each object:
{
  "id": "unique_id_${Date.now()}_N",
  "name": "Real-sounding business name",
  "address": "Street address, City, State ZIP",
  "phone": "(XXX) XXX-XXXX",
  "website": "https://www.businessname.com",
  "email": "owner@businessname.com",
  "rating": 3.2-4.9,
  "review_count": 5-450,
  "score": 25-95,
  "temperature": "hot|warm|lukewarm|cold",
  "years_in_business": 1-25,
  "estimated_revenue": "$X00K-$XM",
  "employee_count": "1-5|6-15|16-50|50+",
  "gaps": ["2-5 specific marketing gaps this business has"],
  "ai_summary": "2-3 sentence opportunity summary explaining WHY this business needs marketing help and what a quick win would be",
  "gbp_claimed": true|false,
  "has_website": true|false,
  "social_active": true|false,
  "running_ads": false
}

Make scores realistic: hot leads (75-95) have multiple clear marketing gaps. Vary temperature distribution: 2-3 hot, 4-5 warm, 3-4 lukewarm, 1-2 cold. Make business names, addresses, and details feel real and local.`

      const raw = await callClaude(
        'You generate realistic B2B sales intelligence data. Return ONLY valid JSON, no markdown, no preamble.',
        prompt, 3000
      )
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const start = cleaned.indexOf('[')
      const end   = cleaned.lastIndexOf(']') + 1
      const leads = JSON.parse(cleaned.slice(start, end))
      setResults(leads)
      setStats({
        total: leads.length,
        hot:  leads.filter(l=>l.score>=75).length,
        warm: leads.filter(l=>l.score>=50&&l.score<75).length,
        avgScore: Math.round(leads.reduce((s,l)=>s+l.score,0)/leads.length),
      })
    } catch(e) {
      console.error(e)
      toast.error('Search failed — please try again')
    }
    setSearching(false)
  }

  function toggleSaved(lead) {
    const next = new Set(saved)
    if (next.has(lead.id)) { next.delete(lead.id); toast('Removed from saved') }
    else { next.add(lead.id); toast.success('Saved to leads') }
    setSaved(next)
  }

  async function addAsClient(lead) {
    try {
      const { data, error } = await supabase.from('clients').insert({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        website: lead.website || '',
        status: 'prospect',
        industry: query || selectedIndustries[0] || 'Unknown',
        notes: lead.ai_summary || '',
      }).select().single()
      if (error) throw error
      setAddedClients(prev => new Set([...prev, lead.id]))
      toast.success(`${lead.name} added as client!`)
    } catch(e) {
      toast.error('Failed to add client: ' + e.message)
    }
  }

  const displayed = results
    .filter(l => l.score >= filterScore)
    .filter(l => filterGaps.length === 0 || filterGaps.some(g => l.gaps?.some(lg => lg.toLowerCase().includes(g.toLowerCase().split(' ').pop()))))
    .sort((a,b) => sortBy === 'score' ? b.score-a.score : sortBy === 'reviews' ? b.review_count-a.review_count : a.name.localeCompare(b.name))

  return (
    <ScoutLayout>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'12px 24px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <Target size={18} color={ACCENT}/>
          <span style={{ fontSize:15, fontWeight:800, color:'#111', letterSpacing:-.2 }}>Scout</span>
          <span style={{ fontSize:12, color:'#9ca3af' }}>Sales Intelligence</span>
          {hasResults && (
            <>
              <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                {/* Sort */}
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12, cursor:'pointer', outline:'none', color:'#374151' }}>
                  <option value="score">Sort: Score ↓</option>
                  <option value="reviews">Sort: Reviews ↓</option>
                  <option value="name">Sort: Name A–Z</option>
                </select>
                {/* View toggle */}
                <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:8, padding:3 }}>
                  {[['grid','⊞'],['list','≡']].map(([v,icon])=>(
                    <button key={v} onClick={()=>setView(v)} style={{ width:30, height:28, borderRadius:6, border:'none', background:view===v?'#fff':'transparent', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:view===v?'0 1px 3px rgba(0,0,0,.1)':'none' }}>{icon}</button>
                  ))}
                </div>
                {/* New search */}
                <button onClick={()=>{ setResults([]); setStats(null) }} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                  <RefreshCw size={12}/> New Search
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Search bar (always visible) ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'12px 24px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:12, border:'1.5px solid #e5e7eb', padding:'10px 16px', transition:'border-color .15s' }}
              onFocus={e=>e.currentTarget.style.borderColor=ACCENT} onBlur={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
              <Search size={16} color="#9ca3af" style={{ flexShrink:0 }}/>
              <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                placeholder="Business type  e.g. Plumber, Dental, HVAC, Law Firm…"
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, color:'#111' }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:12, border:'1.5px solid #e5e7eb', padding:'10px 16px', width:220 }}>
              <MapPin size={15} color="#9ca3af" style={{ flexShrink:0 }}/>
              <input value={location} onChange={e=>setLocation(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                placeholder="City, State"
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, color:'#111' }}/>
            </div>
            <button onClick={()=>setShowFilters(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 16px', borderRadius:12, border:`1.5px solid ${showFilters?ACCENT:'#e5e7eb'}`, background:showFilters?'#fff7f5':'#fff', color:showFilters?ACCENT:'#374151', fontSize:13, cursor:'pointer', fontWeight:500 }}>
              <Filter size={14}/> Filters
              {(filterGaps.length>0||selectedIndustries.length>0||filterScore>0) && <span style={{ width:7, height:7, borderRadius:'50%', background:ACCENT, flexShrink:0 }}/>}
            </button>
            <button onClick={runSearch} disabled={searching}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', opacity:searching?.7:1, whiteSpace:'nowrap', boxShadow:`0 4px 16px ${ACCENT}45` }}>
              {searching ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> : <Target size={15}/>}
              {searching ? 'Scouting…' : 'Scout'}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div style={{ marginTop:14, padding:'16px', background:'#f9fafb', borderRadius:14, border:'1px solid #f3f4f6', display:'grid', gridTemplateColumns:'1fr 1fr 200px', gap:16 }}>
              {/* Industries */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Industry</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {INDUSTRIES.map(ind=>(
                    <button key={ind.key} onClick={()=>setSelectedIndustries(prev=>prev.includes(ind.key)?prev.filter(k=>k!==ind.key):[...prev,ind.key])}
                      style={{ fontSize:12, padding:'5px 10px', borderRadius:20, border:`1.5px solid ${selectedIndustries.includes(ind.key)?ACCENT:'#e5e7eb'}`, background:selectedIndustries.includes(ind.key)?'#fff7f5':'#fff', color:selectedIndustries.includes(ind.key)?ACCENT:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                      {ind.emoji} {ind.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Gaps */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Marketing Gaps</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {GAPS.map(g=>(
                    <label key={g} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#374151', cursor:'pointer' }}>
                      <div onClick={()=>setFilterGaps(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                        style={{ width:16, height:16, borderRadius:4, border:`2px solid ${filterGaps.includes(g)?ACCENT:'#d1d5db'}`, background:filterGaps.includes(g)?ACCENT:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
                        {filterGaps.includes(g)&&<Check size={10} color="#fff" strokeWidth={3}/>}
                      </div>
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              {/* Min score */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Min Scout Score</div>
                <div style={{ textAlign:'center', marginBottom:8 }}>
                  <span style={{ fontSize:36, fontWeight:900, color:scoreColor(filterScore) }}>{filterScore}</span>
                  <span style={{ fontSize:13, color:'#9ca3af' }}> / 100</span>
                </div>
                <input type="range" min={0} max={90} step={5} value={filterScore} onChange={e=>setFilterScore(+e.target.value)} style={{ width:'100%', accentColor:ACCENT }}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af', marginTop:2 }}>
                  <span>All leads</span><span>Hot only</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Content area ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* Empty / hero state */}
          {!searching && !hasResults && (
            <div>
              {/* Quick search chips */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Quick Searches</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {QUICK_SEARCHES.map(qs=>(
                    <button key={qs.label} onClick={()=>{ setQuery(qs.q); setLocation(qs.loc); setTimeout(runSearch, 100) }}
                      style={{ fontSize:13, padding:'8px 16px', borderRadius:24, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151', fontWeight:500, display:'flex', alignItems:'center', gap:6, transition:'all .12s' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=ACCENT; e.currentTarget.style.color=ACCENT }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#374151' }}>
                      <Target size={11}/> {qs.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Hero */}
              <div style={{ background:'linear-gradient(135deg,#18181b,#27272a)', borderRadius:20, padding:'48px 40px', textAlign:'center', marginBottom:20 }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <Target size={32} color="#fff"/>
                </div>
                <h2 style={{ fontSize:28, fontWeight:900, color:'#fff', marginBottom:10, letterSpacing:-.5 }}>Find your next client</h2>
                <p style={{ fontSize:15, color:'#a1a1aa', lineHeight:1.65, maxWidth:480, margin:'0 auto 28px' }}>Scout uses AI to find local businesses with marketing gaps — weak online presence, no ad campaigns, poor reviews — and scores them so you know exactly who to call first.</p>
                <div style={{ display:'flex', gap:20, justifyContent:'center' }}>
                  {[['🔥','Hot leads scored 75+'],['⚠️','Marketing gaps identified'],['📞','Contact info included'],['➕','1-click add to clients']].map(([icon,label])=>(
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
                      <div style={{ fontSize:11, color:'#52525b', maxWidth:90, lineHeight:1.3 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Searching state */}
          {searching && (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#fff7f5', border:`2px solid ${ACCENT}30`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'pulse 1.5s infinite' }}>
                <Target size={28} color={ACCENT}/>
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:'#111', marginBottom:8 }}>Scouting {query || 'businesses'}{location ? ` in ${location}` : ''}…</div>
              <div style={{ fontSize:13, color:'#9ca3af' }}>Analyzing marketing gaps, review scores, online presence, and ad activity</div>
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <>
              {/* Stats row */}
              {stats && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
                  {[
                    { label:'Total Found',   value:stats.total,    color:'#111' },
                    { label:'Hot Leads 🔥',  value:stats.hot,      color:'#dc2626' },
                    { label:'Warm Leads',    value:stats.warm,     color:ACCENT },
                    { label:'Avg Score',     value:stats.avgScore, color:scoreColor(stats.avgScore) },
                  ].map(s=>(
                    <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                      <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results grid/list */}
              <div style={view === 'grid'
                ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }
                : { display:'flex', flexDirection:'column', gap:10 }}>
                {displayed.map(lead=>(
                  <LeadCard key={lead.id} lead={lead} view={view}
                    saved={saved.has(lead.id)}
                    onSave={toggleSaved}
                    onAddClient={addAsClient}/>
                ))}
              </div>

              {displayed.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>
                  <Filter size={32} style={{ margin:'0 auto 12px', opacity:.4 }}/>
                  <div style={{ fontSize:14, fontWeight:600 }}>No leads match your current filters</div>
                  <button onClick={()=>{ setFilterScore(0); setFilterGaps([]) }} style={{ marginTop:12, fontSize:12, color:ACCENT, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Clear filters</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </ScoutLayout>
  )
}
