"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, Search, MapPin, Star, Globe, Plus, Check,
  Loader2, ExternalLink, Phone, Mail, Copy, Filter,
  BarChart2, Bookmark, BookmarkCheck, ArrowRight,
  Sparkles, RefreshCw, Shield, Info, ChevronRight,
  Users, TrendingUp, AlertCircle, Building, Zap,
  BarChart, Eye, Database
} from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import { enrichLeads, SOURCES, confidenceLabel, dataSummary } from '../../lib/scoutEnrich'
import { scoutWithPlaces, placeToLead, hasGoogleKey } from '../../lib/googlePlaces'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

// ── Search modes ──────────────────────────────────────────────────────────────
const SEARCH_MODES = [
  {
    id:    'prospect',
    icon:  Target,
    emoji: '',
    label: 'Find New Clients',
    desc:  'Discover local businesses with marketing gaps to pitch as new agency clients',
    color: ACCENT,
    placeholder_q:   'Plumber, HVAC, Dental, Law Firm…',
    placeholder_loc: 'Miami, FL',
  },
  {
    id:    'competitor',
    icon:  BarChart,
    emoji: '',
    label: 'Competitor Analysis',
    desc:  'Analyze a specific business or industry to understand the competitive landscape in a market',
    color: '#8b5cf6',
    placeholder_q:   'HVAC in Miami (your client\'s industry)',
    placeholder_loc: 'Miami, FL',
  },
  {
    id:    'market',
    icon:  Eye,
    emoji: '',
    label: 'Market Research',
    desc:  'Research any industry or market segment — trends, saturation, opportunity gaps',
    color: '#10b981',
    placeholder_q:   'Restaurant, Retail, SaaS…',
    placeholder_loc: 'Any city or region',
  },
]

const INDUSTRIES = [
  { key:'restaurant',  label:'Restaurant' },
  { key:'law_firm',    label:'Law Firm' },
  { key:'dental',      label:'Dental' },
  { key:'real_estate', label:'Real Estate' },
  { key:'gym',         label:'Gym / Fitness' },
  { key:'salon',       label:'Salon / Spa' },
  { key:'medical',     label:'Medical' },
  { key:'hvac',        label:'HVAC' },
  { key:'plumber',     label:'Plumber' },
  { key:'roofing',     label:'Roofing' },
  { key:'auto_dealer', label:'Auto Dealer' },
  { key:'landscaping', label:'Landscaping' },
  { key:'childcare',   label:'Childcare' },
  { key:'veterinary',  label:'Veterinary' },
  { key:'electrician', label:'Electrician' },
  { key:'contractor',  label:'Contractor' },
]

const GAPS = [
  'No Google Analytics', 'Inactive social media', 'Poor review management',
  'Not running Google Ads', 'No Facebook presence',
  'Google Business not optimized', 'No email marketing', 'Slow / outdated website',
]

const QUICK_SEARCHES = {
  prospect:   [
    { label:'Plumbers in Miami',          q:'Plumber',  loc:'Miami, FL' },
    { label:'Dental offices in Chicago',  q:'Dental',   loc:'Chicago, IL' },
    { label:'HVAC in Dallas',             q:'HVAC',     loc:'Dallas, TX' },
    { label:'Law firms in NYC',           q:'Law Firm', loc:'New York, NY' },
    { label:'Salons in LA',               q:'Salon',    loc:'Los Angeles, CA' },
    { label:'Gyms in Houston',            q:'Gym',      loc:'Houston, TX' },
  ],
  competitor: [
    { label:'HVAC competitors in Miami',   q:'HVAC',    loc:'Miami, FL' },
    { label:'Dental landscape in Chicago', q:'Dental',  loc:'Chicago, IL' },
    { label:'Law firms in Manhattan',      q:'Law Firm',loc:'New York, NY' },
    { label:'Plumber market in Dallas',    q:'Plumber', loc:'Dallas, TX' },
  ],
  market:     [
    { label:'Restaurant market in Miami',  q:'Restaurant', loc:'Miami, FL' },
    { label:'Health & Fitness in LA',      q:'Gym',        loc:'Los Angeles, CA' },
    { label:'Home services in Dallas',     q:'Contractor', loc:'Dallas, TX' },
    { label:'Legal market in Chicago',     q:'Law Firm',   loc:'Chicago, IL' },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s) { return s>=75?'#dc2626':s>=50?ACCENT:s>=30?'#f59e0b':'#3b82f6' }
function tempLabel(s) {
  return s>=75 ? { label:'Hot Lead',  color:'#dc2626', bg:'#fef2f2', icon:'' }
       : s>=50 ? { label:'Warm',      color:ACCENT,    bg:'#fff7f5', icon:'' }
       : s>=30 ? { label:'Lukewarm',  color:'#d97706', bg:'#fffbeb', icon:'' }
       :         { label:'Cold',      color:'#3b82f6', bg:'#eff6ff', icon:'' }
}

function ScoreRing({ score, size=52 }) {
  const r = (size/2) - 5, circ = 2*Math.PI*r, fill = (score/100)*circ
  const color = scoreColor(score)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size>44?14:11, fontWeight:900, color }}>{score}</div>
    </div>
  )
}

function ConfidenceBadge({ lead, small }) {
  const conf = lead._confidence || 60
  const lbl  = lead._confLabel  || { label:'Unverified', color:'#9ca3af', bg:'#f3f4f6' }
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:small?'2px 7px':'3px 9px', borderRadius:20, background:lbl.bg, border:`1px solid ${lbl.color}25` }}>
      <Shield size={small?9:10} color={lbl.color}/>
      <span style={{ fontSize:small?11:12, fontWeight:700, color:lbl.color }}>{conf}%</span>
      {!small && <span style={{ fontSize:13, color:lbl.color, opacity:.8 }}>{lbl.label}</span>}
    </div>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────
function SourceBadge({ realData }) {
  return realData ? (
    <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:4 }}>
      Live Google Data
    </span>
  ) : (
    <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fff7f5', color:ACCENT, border:`1px solid ${ACCENT}25`, display:'inline-flex', alignItems:'center', gap:4 }}>
      AI Estimated
    </span>
  )
}

// ── Provenance panel ──────────────────────────────────────────────────────────
function ProvenancePanel({ lead }) {
  const [open, setOpen] = useState(false)
  if (!lead._provenance) return null
  const conf     = lead._confidence || 60
  const confLabel = lead._confLabel || { label:'Unverified', color:'#9ca3af', bg:'#f3f4f6' }
  const verified  = lead._provenance.filter(p => p.status==='verified')
  const mismatches = lead._provenance.filter(p => p.status==='mismatch')
  const statusIcon  = { verified:'✓', estimated:'·', mismatch:'!', not_found:'-', generated:'·', not_checked:'-', unknown:'?' }
  const statusColor = { verified:'#16a34a', estimated:'#3b82f6', mismatch:'#dc2626', not_found:'#9ca3af', generated:ACCENT, not_checked:'#9ca3af', unknown:'#9ca3af' }

  return (
    <div style={{ marginTop:10, borderTop:'1px solid #f3f4f6', paddingTop:10 }} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:0 }}>
        <Shield size={12} color={confLabel.color}/>
        <span style={{ fontSize:14, fontWeight:700, color:'#374151', flex:1, textAlign:'left' }}>Data Sources & Accuracy</span>
        <span style={{ fontSize:13, fontWeight:700, color:confLabel.color, background:confLabel.bg, padding:'2px 8px', borderRadius:20, border:`1px solid ${confLabel.color}25` }}>
          {conf}% {confLabel.label}
        </span>
        <ChevronRight size={12} color="#9ca3af" style={{ transform:open?'rotate(90deg)':'rotate(0)', transition:'transform .2s' }}/>
      </button>
      {open && (
        <div style={{ marginTop:12, background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6', overflow:'hidden' }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#6b7280' }}>Overall Data Confidence</span>
              <span style={{ fontSize:13, fontWeight:800, color:confLabel.color }}>{conf}%</span>
            </div>
            <div style={{ height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${conf}%`, background:confLabel.color, borderRadius:3 }}/>
            </div>
            <div style={{ fontSize:13, color:'#9ca3af', marginTop:5 }}>
              {lead._real_data ? 'Live data from Google Places API — verified business' :
               verified.length>=2 ? `${verified.length} data points verified locally` :
               'AI-generated — verify before outreach'}
              {mismatches.length>0 && ` · ${mismatches.length} flag${mismatches.length>1?'s':''} detected`}
            </div>
          </div>
          {lead._real_data && (
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', background:'#eff6ff' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1d4ed8', marginBottom:3 }}>Live Google Places Data</div>
              <div style={{ fontSize:13, color:'#374151' }}>Name, address, phone, rating, and reviews pulled in real time from Google Maps. Business is live and operational.</div>
              {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#1d4ed8', display:'inline-flex', alignItems:'center', gap:4, marginTop:4 }}>View on Google Maps ↗</a>}
            </div>
          )}
          {lead._provenance?.map((p,i)=>(
            <div key={i} style={{ padding:'10px 14px', borderBottom:i<lead._provenance.length-1?'1px solid #f3f4f6':'none', display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ fontSize:16, flexShrink:0 }}>{p.source.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#111' }}>{p.source.label}</span>
                  <span style={{ fontSize:12, fontWeight:800, color:statusColor[p.status], background:statusColor[p.status]+'15', padding:'1px 7px', borderRadius:20, textTransform:'uppercase' }}>
                    {statusIcon[p.status]} {p.status.replace('_',' ')}
                  </span>
                  {p.confidence && <span style={{ fontSize:13, color:'#9ca3af', marginLeft:'auto' }}>{p.confidence}%</span>}
                </div>
                <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.5 }}>{p.detail}</div>
                {p.upgrade && <div style={{ fontSize:13, color:ACCENT, marginTop:3, fontStyle:'italic' }}>{p.upgrade}</div>}
              </div>
            </div>
          ))}
          <div style={{ padding:'10px 14px', background:'#fff7f5', borderTop:'1px solid #f3f4f6', display:'flex', gap:8 }}>
            <Info size={12} color={ACCENT} style={{ flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:13, color:'#92400e', lineHeight:1.5 }}>
              {lead._real_data
                ? 'Live data from Google Places API. Phone, address, rating, and review count are verified in real time.'
                : 'AI-generated intelligence cross-referenced against USPS ZIP, NANP area codes, and Census data. Connect Yelp Fusion API for additional verification.'
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, mode, onSave, onAddClient, saved, view }) {
  const [expanded, setExpanded] = useState(false)
  const temp  = tempLabel(lead.score||50)
  const score = lead.score||50

  function copy(text) { navigator.clipboard.writeText(text); toast.success('Copied!') }

  // Competitor mode shows different framing
  const isCompetitor = mode === 'competitor'
  const isMarket     = mode === 'market'

  if (view==='list') return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      <ScoreRing score={score} size={46}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#111' }}>{lead.name}</span>
          {!isMarket && <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:temp.bg, color:temp.color }}>{temp.label}</span>}
          <SourceBadge realData={lead._real_data}/>
          <ConfidenceBadge lead={lead} small/>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:14, color:'#9ca3af', flexWrap:'wrap' }}>
          {lead.address && <span>{lead.address}</span>}
          {lead.phone   && <span>{lead.phone}</span>}
          {lead.rating  > 0 && <span>⭐ {lead.rating} ({lead.review_count} reviews)</span>}
        </div>
        {lead.gaps?.length>0 && (
          <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
            {lead.gaps.slice(0,3).map(g=><span key={g} style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fff7f5', color:ACCENT, border:`1px solid ${ACCENT}25` }}>{g}</span>)}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:7, flexShrink:0 }}>
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" style={{ padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', display:'flex', alignItems:'center' }}><Globe size={14}/></a>}
        {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noreferrer" style={{ padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#4285f4', display:'flex', alignItems:'center' }}><MapPin size={14}/></a>}
        {!isCompetitor && !isMarket && <>
          <button onClick={()=>onSave(lead)} style={{ padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:saved?ACCENT:'#9ca3af', cursor:'pointer' }}>{saved?<BookmarkCheck size={14}/>:<Bookmark size={14}/>}</button>
          <button onClick={()=>onAddClient(lead)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}><Plus size={12}/> Add</button>
        </>}
      </div>
    </div>
  )

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${expanded?ACCENT+'40':'#e5e7eb'}`, overflow:'hidden', cursor:'pointer' }}
      onMouseEnter={e=>{ if(!expanded) e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,.1)' }}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
      onClick={()=>setExpanded(e=>!e)}>
      <div style={{ height:3, background:`linear-gradient(90deg, ${scoreColor(score)}, ${scoreColor(score)}80)`, width:`${score}%` }}/>
      {lead._real_data && <div style={{ height:2, background:'linear-gradient(90deg,#4285f4,#1d4ed8)', width:'100%' }}/>}
      <div style={{ padding:'18px 18px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
          {!isMarket && <ScoreRing score={score}/>}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:4, lineHeight:1.3 }}>{lead.name}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              {!isMarket && <span style={{ fontSize:13, fontWeight:700, padding:'3px 9px', borderRadius:20, background:temp.bg, color:temp.color }}>{temp.label}</span>}
              <SourceBadge realData={lead._real_data}/>
              <ConfidenceBadge lead={lead} small/>
            </div>
          </div>
          {!isCompetitor && !isMarket && (
            <button onClick={e=>{e.stopPropagation();onSave(lead)}} style={{ padding:'6px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:saved?ACCENT:'#9ca3af', cursor:'pointer', flexShrink:0 }}>
              {saved?<BookmarkCheck size={15}/>:<Bookmark size={15}/>}
            </button>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
          {lead.address && <div style={{ fontSize:14, color:'#6b7280', display:'flex', gap:5 }}><MapPin size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.address}</div>}
          {lead.phone   && <div style={{ fontSize:14, color:'#6b7280', display:'flex', gap:5 }}><Phone size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.phone}</div>}
          {lead.rating>0 && <div style={{ fontSize:14, color:'#6b7280', display:'flex', gap:5 }}>
            <Star size={11} style={{ flexShrink:0, marginTop:1 }}/>
            {lead.rating}★ · {lead.review_count.toLocaleString()} reviews
            {lead.review_count < 50 && <span style={{ color:ACCENT, fontWeight:700 }}> — low volume opportunity</span>}
          </div>}
          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:14, color:'#3b82f6', display:'flex', gap:5, textDecoration:'none' }}><Globe size={11} style={{ flexShrink:0, marginTop:1 }}/>{lead.website.replace(/^https?:\/\//,'').slice(0,50)}</a>}
          {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:14, color:'#4285f4', display:'flex', gap:5, textDecoration:'none' }}><MapPin size={11} style={{ flexShrink:0, marginTop:1 }}/>View on Google Maps ↗</a>}
        </div>
        {lead.gaps?.length>0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
            {lead.gaps.map(g=>(
              <span key={g} style={{ fontSize:13, fontWeight:700, padding:'3px 9px', borderRadius:20, background:'#fff7f5', color:ACCENT, border:`1px solid ${ACCENT}25` }}>
                 {g}
              </span>
            ))}
          </div>
        )}
        {expanded && lead.ai_summary && (
          <div style={{ background:'#f9fafb', borderRadius:10, padding:'11px 13px', marginBottom:12, fontSize:14, color:'#374151', lineHeight:1.65, borderTop:'1px solid #f3f4f6' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:13, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>
              {isCompetitor ? 'Competitive Intelligence' : isMarket ? 'Market Insight' : 'AI Opportunity Analysis'}
            </div>
            {lead.ai_summary}
          </div>
        )}
        <ProvenancePanel lead={lead}/>
        <div style={{ display:'flex', gap:7, marginTop:10 }} onClick={e=>e.stopPropagation()}>
          {lead.phone && <button onClick={()=>copy(lead.phone)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#374151' }}><Phone size={11}/> Copy #</button>}
          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#374151', textDecoration:'none' }}><Globe size={11}/> Site</a>}
          {!isCompetitor && !isMarket && (
            <button onClick={()=>onAddClient(lead)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              <Plus size={13}/> Add as Client
            </button>
          )}
          {isCompetitor && <button onClick={()=>onAddClient({...lead, status:'competitor'})} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:8, border:'none', background:'#8b5cf6', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}><BarChart size={13}/> Save Competitor</button>}
        </div>
      </div>
    </div>
  )
}

// ── Market summary card (for market research mode) ────────────────────────────
function MarketSummaryCard({ results, query, location }) {
  const avgRating    = results.filter(r=>r.rating>0).reduce((s,r)=>s+r.rating,0) / (results.filter(r=>r.rating>0).length||1)
  const avgReviews   = Math.round(results.reduce((s,r)=>s+r.review_count,0)/results.length)
  const withWebsite  = results.filter(r=>r.has_website||r.website).length
  const lowReviews   = results.filter(r=>r.review_count<50).length
  const lowRating    = results.filter(r=>r.rating>0&&r.rating<4.0).length
  const hasRealData  = results.some(r=>r._real_data)

  return (
    <div style={{ background:'linear-gradient(135deg,#18181b,#27272a)', borderRadius:16, padding:'22px 24px', marginBottom:20, color:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <BarChart2 size={18} color="#10b981"/>
        <div style={{ fontSize:16, fontWeight:800 }}>Market Overview: {query} in {location}</div>
        {hasRealData && <span style={{ fontSize:13, fontWeight:700, background:'#4285f4', color:'#fff', padding:'2px 8px', borderRadius:20, marginLeft:'auto' }}>Live Google Data</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {[
          { label:'Businesses Found', value:results.length,                color:'#fff' },
          { label:'Avg Google Rating', value:`${avgRating.toFixed(1)}★`,  color:'#f59e0b' },
          { label:'Avg Review Count',  value:avgReviews,                   color:'#60a5fa' },
          { label:'Have Websites',     value:`${withWebsite}/${results.length}`, color:'#34d399' },
          { label:'Low Reviews (<50)', value:lowReviews,                   color:'#f87171', note:'Opportunity' },
        ].map(s=>(
          <div key={s.label} style={{ background:'rgba(255,255,255,.07)', borderRadius:12, padding:'12px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginTop:3, lineHeight:1.3 }}>{s.label}</div>
            {s.note && <div style={{ fontSize:12, color:'#34d399', marginTop:2 }}>↑ {s.note}</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop:14, fontSize:14, color:'rgba(255,255,255,.5)', lineHeight:1.6 }}>
        <strong style={{ color:'rgba(255,255,255,.8)' }}>Key insight:</strong>{' '}
        {lowReviews>results.length*0.5 ? `${lowReviews} of ${results.length} businesses have under 50 reviews — massive review generation opportunity.`
          : lowRating>2 ? `${lowRating} businesses have below 4.0★ rating — reputation management services in high demand.`
          : withWebsite<results.length*0.7 ? `${results.length-withWebsite} businesses lack a website — web design and SEO opportunities.`
          : `Market is relatively mature. Focus on premium services, better targeting, and differentiation.`}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Scout Page
// ══════════════════════════════════════════════════════════════════════════════
export default function ScoutPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode]         = useState('prospect')
  const [query, setQuery]       = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved]       = useState(new Set())
  const [view, setView]         = useState('grid')
  const [filterScore, setFilterScore] = useState(0)
  const [filterGaps, setFilterGaps]   = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIndustries, setSelectedIndustries] = useState([])
  const [addedClients, setAddedClients] = useState(new Set())
  const [sortBy, setSortBy]     = useState('score')
  const [stats, setStats]       = useState(null)
  const [dataSource, setDataSource] = useState(null) // 'google'|'ai'|'mixed'
  const [searchError, setSearchError] = useState(null)

  const modeConfig = SEARCH_MODES.find(m=>m.id===mode) || SEARCH_MODES[0]
  const googleKeyAvailable = hasGoogleKey()

  async function runSearch() {
    const term = query.trim() || selectedIndustries.map(k=>INDUSTRIES.find(i=>i.key===k)?.label).filter(Boolean).join(', ')
    if (!term && !location.trim()) { toast.error('Enter a business type or location'); return }
    setSearching(true); setResults([]); setStats(null); setSearchError(null)

    let leads = []
    let source = 'ai'

    // ── Try Google Places first (real data) ──────────────────────────────────
    if (hasGoogleKey()) {
      try {
        const { leads: googleLeads, error: googleError } = await scoutWithPlaces(term, location || 'United States', { maxResults: 20 })

        if (!googleError && googleLeads.length > 0) {
          leads  = googleLeads
          source = 'google'
          toast.success(`Found ${leads.length} real businesses from Google Maps`)
        } else if (googleError) {
          console.warn('Google Places failed, falling back to AI:', googleError)
        }
      } catch(e) {
        console.warn('Google Places error:', e.message)
      }
    }

    // ── Fallback / supplement with AI ────────────────────────────────────────
    if (leads.length === 0) {
      try {
        const modePromptExtra = mode === 'competitor'
          ? `\nThis is a COMPETITOR ANALYSIS. Focus on showing strengths and weaknesses of each business. For gaps, show what they do well AND where they fall short vs competitors.`
          : mode === 'market'
          ? `\nThis is MARKET RESEARCH. Focus on market saturation, opportunity gaps, pricing signals, and trends rather than individual lead quality.`
          : ''

        const prompt = `You are a B2B sales intelligence AI for a marketing agency. Generate 12 realistic local business leads.

Search: "${term}" in "${location || 'United States'}"
Mode: ${mode === 'prospect' ? 'Find new agency clients' : mode === 'competitor' ? 'Competitor analysis for a market' : 'Market research'}
${filterGaps.length ? `Must have these marketing gaps: ${filterGaps.join(', ')}` : ''}${modePromptExtra}

Return ONLY valid JSON array of 12 businesses. Each:
{
  "id": "unique_${Date.now()}_N",
  "name": "Real-sounding business name",
  "address": "Full street address, City, State ZIP",
  "phone": "(XXX) XXX-XXXX using correct local area code",
  "website": "https://www.businessname.com",
  "email": "owner@businessname.com",
  "rating": 3.2,
  "review_count": 47,
  "score": 78,
  "temperature": "hot",
  "years_in_business": 8,
  "estimated_revenue": "$500K-$1M",
  "employee_count": "6-15",
  "gaps": ["Specific gap 1", "Specific gap 2", "Gap 3"],
  "ai_summary": "2-3 sentence insight about this specific business opportunity",
  "gbp_claimed": true,
  "has_website": true,
  "social_active": false,
  "running_ads": false
}

Use correct area codes for ${location}. Make addresses realistic for ${location}. Score hot leads 75-95 (multiple gaps). Mix: 2-3 hot, 4-5 warm, 3-4 lukewarm, 1-2 cold.`

        const raw = await callClaude(
          'You generate realistic B2B sales intelligence. Return ONLY valid JSON array, no markdown.',
          prompt, 3500
        )
        const cleaned = raw.replace(/```json|```/g,'').trim()
        const start   = cleaned.indexOf('['), end = cleaned.lastIndexOf(']')+1
        leads  = JSON.parse(cleaned.slice(start, end))
        source = 'ai'
      } catch(e) {
        console.error('AI search failed:', e)
        setSearchError(e.message?.includes('API key') || e.message?.includes('not set')
          ? 'AI search requires NEXT_PUBLIC_ANTHROPIC_API_KEY to be set in Vercel environment variables.'
          : `Search failed: ${e.message}`)
        setSearching(false)
        return
      }
    }

    // ── AI-enrich Google leads with summaries ─────────────────────────────────
    if (source === 'google' && leads.length > 0) {
      try {
        const names = leads.slice(0,8).map(l=>l.name).join(', ')
        const summaryPrompt = `For these real ${term} businesses in ${location}, write a 1-sentence marketing opportunity insight for each.
Businesses: ${names}
Return JSON array of objects: [{"name":"Business Name","summary":"1 sentence opportunity insight"}]
Be specific about why each business needs marketing help based on their likely situation.`
        const raw = await callClaude('Return only valid JSON array, no markdown.', summaryPrompt, 1000)
        const cleaned = raw.replace(/```json|```/g,'').trim()
        const summaries = JSON.parse(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']')+1))
        const summaryMap = Object.fromEntries(summaries.map(s=>[s.name, s.summary]))
        leads = leads.map(l=>({ ...l, ai_summary: summaryMap[l.name] || null }))
      } catch(e) {
        // Summaries are optional — don't fail the whole search
      }
    }

    // ── Enrich all leads with provenance/confidence ───────────────────────────
    const enriched = enrichLeads(leads, location || term)
    setResults(enriched)
    setDataSource(source)
    setStats({
      total:    enriched.length,
      hot:      enriched.filter(l=>l.score>=75).length,
      warm:     enriched.filter(l=>l.score>=50&&l.score<75).length,
      avgScore: Math.round(enriched.reduce((s,l)=>s+l.score,0)/enriched.length),
      verified: enriched.filter(l=>l._verified>=2||l._real_data).length,
      realData: enriched.filter(l=>l._real_data).length,
    })
    setSearching(false)
  }

  function toggleSaved(lead) {
    const next = new Set(saved)
    if (next.has(lead.id)) { next.delete(lead.id); toast('Removed') }
    else { next.add(lead.id); toast.success('Saved') }
    setSaved(next)
  }

  async function addAsClient(lead) {
    try {
      const { data, error } = await supabase.from('clients').insert({
        name:     lead.name,
        email:    lead.email || '',
        phone:    lead.phone || '',
        website:  lead.website || '',
        status:   lead.status || 'prospect',
        industry: query || selectedIndustries[0] || '',
        notes:    lead.ai_summary || '',
        agency_id: agencyId || null,
      }).select().single()
      if (error) throw error
      setAddedClients(prev=>new Set([...prev, lead.id]))
      toast.success(`${lead.name} added as client!`)
    } catch(e) {
      toast.error('Failed to add: ' + e.message)
    }
  }

  const displayed = results
    .filter(l=>l.score>=filterScore)
    .filter(l=>filterGaps.length===0||filterGaps.some(g=>l.gaps?.some(lg=>lg.toLowerCase().includes(g.toLowerCase().split(' ').pop()))))
    .sort((a,b)=>sortBy==='score'?b.score-a.score:sortBy==='reviews'?b.review_count-a.review_count:a.name.localeCompare(b.name))

  const hasResults = results.length > 0

  return (
    <ScoutLayout>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'12px 24px', display:'flex', alignItems:'center', gap:12, flexShrink:0, zIndex:10 }}>
          <Target size={18} color={modeConfig.color}/>
          <span style={{ fontSize:15, fontWeight:800, color:'#111' }}>Scout</span>
          <span style={{ fontSize:14, color:'#9ca3af' }}>·</span>
          {/* Mode tabs */}
          <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:10, padding:3 }}>
            {SEARCH_MODES.map(m=>(
              <button key={m.id} onClick={()=>{ setMode(m.id); setResults([]); setStats(null) }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, border:'none', background:mode===m.id?'#fff':'transparent', cursor:'pointer', boxShadow:mode===m.id?'0 1px 3px rgba(0,0,0,.1)':'none', transition:'all .15s' }}>
                <span style={{ fontSize:15 }}></span>
                <span style={{ fontSize:14, fontWeight:mode===m.id?700:500, color:mode===m.id?m.color:'#6b7280', whiteSpace:'nowrap' }}>{m.label}</span>
              </button>
            ))}
          </div>
          {hasResults && (
            <div style={{ display:'flex', gap:8, marginLeft:'auto', alignItems:'center' }}>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, cursor:'pointer', outline:'none' }}>
                <option value="score">Score ↓</option>
                <option value="reviews">Reviews ↓</option>
                <option value="name">Name A–Z</option>
              </select>
              <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:8, padding:3 }}>
                {[['grid','⊞'],['list','≡']].map(([v,icon])=>(
                  <button key={v} onClick={()=>setView(v)} style={{ width:30, height:28, borderRadius:6, border:'none', background:view===v?'#fff':'transparent', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:view===v?'0 1px 3px rgba(0,0,0,.1)':'none' }}>{icon}</button>
                ))}
              </div>
              <button onClick={()=>{setResults([]);setStats(null);setDataSource(null)}} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>
                <RefreshCw size={12}/> New Search
              </button>
            </div>
          )}
        </div>

        {/* ── Mode description ── */}
        {!hasResults && (
          <div style={{ background:modeConfig.color+'08', borderBottom:`1px solid ${modeConfig.color}20`, padding:'10px 24px', flexShrink:0 }}>
            <div style={{ fontSize:15, color:'#374151', display:'flex', alignItems:'center', gap:8 }}>
              <modeConfig.icon size={14} color={modeConfig.color}/>
              <strong style={{ color:modeConfig.color }}>{modeConfig.label}:</strong>
              {modeConfig.desc}
            </div>
          </div>
        )}

        {/* ── Search bar ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'12px 24px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:12, border:'1.5px solid #e5e7eb', padding:'10px 16px' }}>
              <Search size={16} color="#9ca3af" style={{ flexShrink:0 }}/>
              <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                placeholder={modeConfig.placeholder_q}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:15, color:'#111' }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:12, border:'1.5px solid #e5e7eb', padding:'10px 16px', width:200 }}>
              <MapPin size={15} color="#9ca3af" style={{ flexShrink:0 }}/>
              <input value={location} onChange={e=>setLocation(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                placeholder={modeConfig.placeholder_loc}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:15, color:'#111' }}/>
            </div>
            <button onClick={()=>setShowFilters(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 16px', borderRadius:12, border:`1.5px solid ${showFilters?modeConfig.color:'#e5e7eb'}`, background:showFilters?modeConfig.color+'08':'#fff', color:showFilters?modeConfig.color:'#374151', fontSize:15, cursor:'pointer', fontWeight:600 }}>
              <Filter size={14}/> Filters
              {(filterGaps.length>0||selectedIndustries.length>0||filterScore>0)&&<span style={{ width:7,height:7,borderRadius:'50%',background:modeConfig.color,flexShrink:0 }}/>}
            </button>
            <button onClick={runSearch} disabled={searching}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:12, border:'none', background:modeConfig.color, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity:searching?.7:1, boxShadow:`0 4px 16px ${modeConfig.color}45` }}>
              {searching?<Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/>:<modeConfig.icon size={15}/>}
              {searching?'Searching…':'Scout'}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div style={{ marginTop:14, padding:'16px', background:'#f9fafb', borderRadius:14, border:'1px solid #f3f4f6', display:'grid', gridTemplateColumns:'1fr 1fr 200px', gap:16 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Industry</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {INDUSTRIES.map(ind=>(
                    <button key={ind.key} onClick={()=>setSelectedIndustries(prev=>prev.includes(ind.key)?prev.filter(k=>k!==ind.key):[...prev,ind.key])}
                      style={{ fontSize:14, padding:'5px 10px', borderRadius:20, border:`1.5px solid ${selectedIndustries.includes(ind.key)?modeConfig.color:'#e5e7eb'}`, background:selectedIndustries.includes(ind.key)?modeConfig.color+'12':'#fff', color:selectedIndustries.includes(ind.key)?modeConfig.color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Marketing Gaps</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {GAPS.map(g=>(
                    <label key={g} style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, color:'#374151', cursor:'pointer' }}>
                      <div onClick={()=>setFilterGaps(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                        style={{ width:16,height:16,borderRadius:4,border:`2px solid ${filterGaps.includes(g)?modeConfig.color:'#d1d5db'}`,background:filterGaps.includes(g)?modeConfig.color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer' }}>
                        {filterGaps.includes(g)&&<Check size={10} color="#fff" strokeWidth={3}/>}
                      </div>
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Min Score</div>
                <div style={{ textAlign:'center', marginBottom:8 }}>
                  <span style={{ fontSize:36, fontWeight:900, color:scoreColor(filterScore) }}>{filterScore}</span>
                  <span style={{ fontSize:15, color:'#9ca3af' }}>/100</span>
                </div>
                <input type="range" min={0} max={90} step={5} value={filterScore} onChange={e=>setFilterScore(+e.target.value)} style={{ width:'100%', accentColor:modeConfig.color }}/>
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* Error state */}
          {searchError && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', gap:12 }}>
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink:0, marginTop:1 }}/>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#991b1b', marginBottom:4 }}>Search Failed</div>
                <div style={{ fontSize:15, color:'#991b1b' }}>{searchError}</div>
                <div style={{ fontSize:14, color:'#9ca3af', marginTop:6 }}>
                  To fix: Go to Vercel → Settings → Environment Variables → Add <code>NEXT_PUBLIC_ANTHROPIC_API_KEY</code>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!searching && !hasResults && !searchError && (
            <div>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Quick Searches</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {(QUICK_SEARCHES[mode]||QUICK_SEARCHES.prospect).map(qs=>(
                    <button key={qs.label} onClick={()=>{ setQuery(qs.q); setLocation(qs.loc); setTimeout(runSearch,100) }}
                      style={{ fontSize:15, padding:'8px 16px', borderRadius:24, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151', fontWeight:600, display:'flex', alignItems:'center', gap:6, transition:'all .12s' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=modeConfig.color; e.currentTarget.style.color=modeConfig.color }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#374151' }}>
                      <modeConfig.icon size={11}/> {qs.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Data source info */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px', marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:8 }}>Live Google Places Data</div>
                  <div style={{ fontSize:15, color:'#6b7280', lineHeight:1.6 }}>
                    {googleKeyAvailable
                      ? 'Google Places API connected — results will show real businesses with verified ratings, reviews, phone numbers, and websites.'
                      : 'Google Places API key not configured. Add NEXT_PUBLIC_GOOGLE_PLACES_KEY to Vercel for real business data.'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:8 }}>AI Fallback</div>
                  <div style={{ fontSize:15, color:'#6b7280', lineHeight:1.6 }}>When Google Places is unavailable, Claude AI generates market-calibrated leads with ZIP/area code cross-referencing and data confidence scoring.</div>
                </div>
              </div>
              {/* Hero */}
              <div style={{ background:'linear-gradient(135deg,#18181b,#27272a)', borderRadius:20, padding:'40px', textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:modeConfig.color, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:28 }}>
                  </div>
                <h2 style={{ fontSize:26, fontWeight:900, color:'#fff', marginBottom:10, letterSpacing:-.5 }}>{modeConfig.label}</h2>
                <p style={{ fontSize:15, color:'#a1a1aa', lineHeight:1.65, maxWidth:500, margin:'0 auto' }}>{modeConfig.desc}</p>
              </div>
            </div>
          )}

          {/* Searching */}
          {searching && (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:modeConfig.color+'15', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'pulse 1.5s infinite' }}>
                <modeConfig.icon size={28} color={modeConfig.color}/>
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:'#111', marginBottom:8 }}>
                {mode==='competitor'?'Analyzing competitors':'Scouting'} {query||'businesses'}{location?` in ${location}`:''}…
              </div>
              <div style={{ fontSize:15, color:'#9ca3af' }}>
                {dataSource==='google'?'Pulling live data from Google Maps…':'Analyzing marketing gaps, review scores, and online presence…'}
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <>
              {/* Data source banner */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', borderRadius:12, background: stats?.realData>0?'#eff6ff':'#fff7f5', border:`1px solid ${stats?.realData>0?'#bfdbfe':ACCENT+'30'}` }}>
                <Database size={14} color={stats?.realData>0?'#1d4ed8':ACCENT}/>
                <span style={{ fontSize:15, fontWeight:700, color:stats?.realData>0?'#1d4ed8':'#92400e' }}>
                  {stats?.realData>0
                    ? `${stats.realData} live businesses from Google Places · ${results.length-stats.realData} AI-estimated`
                    : `AI-generated leads · cross-referenced against USPS ZIP + NANP area codes`}
                </span>
                <span style={{ marginLeft:'auto', fontSize:13, color:'#9ca3af' }}>{results.length} results for "{query}" in {location}</span>
              </div>

              {/* Market summary (market mode only) */}
              {mode==='market' && <MarketSummaryCard results={results} query={query} location={location}/>}

              {/* Stats */}
              {mode!=='market' && stats && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:18 }}>
                  {[
                    { label:'Total Found',   value:stats.total,                color:'#111' },
                    { label:'Hot Leads',  value:stats.hot,                  color:'#dc2626' },
                    { label:'Warm Leads',    value:stats.warm,                 color:ACCENT },
                    { label:'Avg Score',     value:stats.avgScore,             color:scoreColor(stats.avgScore) },
                    { label:'Data Verified', value:`${stats.verified}/${stats.total}`, color:'#16a34a' },
                  ].map(s=>(
                    <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:13, color:'#9ca3af', marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mismatch warning */}
              {results.some(l=>l._mismatches>0) && (
                <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'10px 16px', marginBottom:14, display:'flex', gap:10, alignItems:'center' }}>
                  <AlertCircle size={14} color="#d97706"/>
                  <div style={{ fontSize:15, color:'#92400e' }}>
                    <strong>{results.filter(l=>l._mismatches>0).length} leads</strong> have data flags (address/phone mismatches). Review before outreach. Click any lead → Data Sources to see details.
                  </div>
                </div>
              )}

              {/* Results grid/list */}
              <div style={view==='grid'
                ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }
                : { display:'flex', flexDirection:'column', gap:10 }}>
                {displayed.map(lead=>(
                  <LeadCard key={lead.id} lead={lead} mode={mode} view={view}
                    saved={saved.has(lead.id)}
                    onSave={toggleSaved}
                    onAddClient={addAsClient}/>
                ))}
              </div>
              {displayed.length===0 && (
                <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>
                  <Filter size={32} style={{ margin:'0 auto 12px', opacity:.4 }}/>
                  <div style={{ fontSize:15, fontWeight:700 }}>No leads match filters</div>
                  <button onClick={()=>{setFilterScore(0);setFilterGaps([])}} style={{ marginTop:12, fontSize:14, color:ACCENT, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Clear filters</button>
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
