"use client";
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Target, Search, MapPin, Star, Globe, Plus, Check,
  Loader2, ExternalLink, Phone, Mail, Copy, Filter,
  BarChart2, Bookmark, BookmarkCheck, ArrowRight,
  Sparkles, RefreshCw, Shield, Info, ChevronRight,
  Users, TrendingUp, AlertCircle, Building, Zap,
  BarChart, Eye, HardDrive, Brain, ChevronDown, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import ScoutLayout from './ScoutLayout'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileSearch, MobileCard, MobileEmpty, MobileButton, MobileSectionHeader } from '../../components/mobile/MobilePage'
import { supabase, saveScoutSearch } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import { enrichLeads, SOURCES, confidenceLabel, dataSummary } from '../../lib/scoutEnrich'
import { runLeadPipeline } from '../../lib/scoutPipeline'
import { scoutWithPlaces, placeToLead, hasGoogleKey } from '../../lib/googlePlaces'
import { SIC_CODES } from '../../lib/sicCodes'
import AIThinkingBox from '../../components/AIThinkingBox'

/* ═══════════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Apple-grade enterprise design language
   Brand: #E6007E (accent), #00C2CB (teal), Proxima Nova / Raleway
   ═══════════════════════════════════════════════════════════════════════════════ */
import { R as ACCENT, T as TEAL, FH, FB } from '../../lib/theme'

const CSS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
  @keyframes shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
  .scout-card { transition: all .2s cubic-bezier(.4,0,.2,1); }
  .scout-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,.08); border-color: rgba(230,0,126,.15) !important; }
  .scout-fade-in { animation: fadeIn .4s ease both; }
  .scout-btn { transition: all .15s ease; }
  .scout-btn:hover { transform: translateY(-1px); }
  .scout-btn:active { transform: translateY(0); }
  .scout-input:focus { border-color: ${ACCENT}40 !important; box-shadow: 0 0 0 3px ${ACCENT}08 !important; }
  .scout-seg-btn { transition: all .15s ease; }
`

// ── Search modes ──────────────────────────────────────────────────────────────
const SEARCH_MODES = [
  {
    id:    'prospect',
    icon:  Target,
    label: 'Prospect',
    desc:  'Discover local businesses with marketing gaps',
    color: ACCENT,
    placeholder_q:   'Plumber, HVAC, Dental, Law Firm…',
    placeholder_loc: 'Miami, FL',
  },
  {
    id:    'sweep',
    icon:  MapPin,
    label: 'City Sweep',
    desc:  'Search every city in a state via Census data',
    color: '#0ea5e9',
    placeholder_q:   'General Contractor, Plumber, HVAC…',
    placeholder_loc: 'FL, TX, CA…  (2-letter state code)',
  },
  {
    id:    'competitor',
    icon:  BarChart,
    label: 'Competitors',
    desc:  'Analyze the competitive landscape in any market',
    color: '#8b5cf6',
    placeholder_q:   'HVAC in Miami (your client\'s industry)',
    placeholder_loc: 'Miami, FL',
  },
  {
    id:    'market',
    icon:  Eye,
    label: 'Market Intel',
    desc:  'Research trends, saturation, and opportunity gaps',
    color: '#10b981',
    placeholder_q:   'Restaurant, Retail, SaaS…',
    placeholder_loc: 'Any city or region',
  },
]

const INDUSTRIES = [
  { key:'restaurant',  label:'Restaurant' },  { key:'law_firm',    label:'Law Firm' },
  { key:'dental',      label:'Dental' },       { key:'real_estate', label:'Real Estate' },
  { key:'gym',         label:'Gym / Fitness' },{ key:'salon',       label:'Salon / Spa' },
  { key:'medical',     label:'Medical' },      { key:'hvac',        label:'HVAC' },
  { key:'plumber',     label:'Plumber' },      { key:'roofing',     label:'Roofing' },
  { key:'auto_dealer', label:'Auto Dealer' },  { key:'landscaping', label:'Landscaping' },
  { key:'childcare',   label:'Childcare' },    { key:'veterinary',  label:'Veterinary' },
  { key:'electrician', label:'Electrician' },  { key:'contractor',  label:'Contractor' },
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
  sweep: [
    { label:'All plumbers in Florida',       q:'Plumber',          loc:'FL' },
    { label:'All HVAC in Texas',             q:'HVAC',             loc:'TX' },
    { label:'All dental offices in Georgia', q:'Dental',           loc:'GA' },
    { label:'All contractors in New York',   q:'General Contractor',loc:'NY' },
  ],
  competitor: [
    { label:'HVAC competitors in Miami',   q:'HVAC',    loc:'Miami, FL' },
    { label:'Dental landscape in Chicago', q:'Dental',  loc:'Chicago, IL' },
    { label:'Law firms in Manhattan',      q:'Law Firm',loc:'New York, NY' },
    { label:'Plumber market in Dallas',    q:'Plumber', loc:'Dallas, TX' },
  ],
  market: [
    { label:'Restaurant market in Miami',  q:'Restaurant', loc:'Miami, FL' },
    { label:'Health & Fitness in LA',      q:'Gym',        loc:'Los Angeles, CA' },
    { label:'Home services in Dallas',     q:'Contractor', loc:'Dallas, TX' },
    { label:'Legal market in Chicago',     q:'Law Firm',   loc:'Chicago, IL' },
  ],
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS — Refined, minimal, Apple-like
   ═══════════════════════════════════════════════════════════════════════════════ */

function scoreColor(s) { return s>=75?'#ef4444':s>=50?ACCENT:s>=30?'#f59e0b':'#94a3b8' }

function ScoreRing({ score, size=48 }) {
  const r = (size/2) - 4, circ = 2*Math.PI*r, fill = (score/100)*circ
  const color = scoreColor(score)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, fontWeight:800, color, fontFamily:FB, letterSpacing:'-.02em' }}>{score}</div>
    </div>
  )
}

function TechBadge({ label }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
      background:'#f0fdf4', color:'#15803d', letterSpacing:'.02em',
      display:'inline-flex', alignItems:'center', gap:3 }}>
      <Check size={8} strokeWidth={3}/> {label}
    </span>
  )
}

function MissingBadge({ label }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
      background:'#fef2f2', color:'#dc2626', letterSpacing:'.02em',
      display:'inline-flex', alignItems:'center', gap:3 }}>
      <X size={8} strokeWidth={3}/> {label}
    </span>
  )
}

function RevenueChip({ revenue }) {
  if (!revenue?.annualRevenueAtRisk || revenue.annualRevenueAtRisk < 1000) return null
  const v = revenue.annualRevenueAtRisk
  const fmt = v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : '$' + Math.round(v/1000) + 'k'
  return (
    <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:6,
      background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa',
      display:'inline-flex', alignItems:'center', gap:3, letterSpacing:'.01em' }}>
      {fmt}/yr at risk
    </span>
  )
}

// ── Provenance panel ──────────────────────────────────────────────────────────
function ProvenancePanel({ lead }) {
  const [open, setOpen] = useState(false)
  if (!lead._provenance) return null
  const conf      = lead._confidence || 60
  const confLabel = lead._confLabel || { label:'Unverified', color:'#64748b', bg:'#f8fafc' }
  const statusColor = { verified:'#16a34a', estimated:'#3b82f6', mismatch:'#dc2626', not_found:'#94a3b8', generated:ACCENT, not_checked:'#94a3b8', unknown:'#94a3b8' }

  return (
    <div style={{ marginTop:10, borderTop:'1px solid #f1f5f9', paddingTop:10 }} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:0 }}>
        <Shield size={11} color={confLabel.color}/>
        <span style={{ fontSize:12, fontWeight:700, color:'#475569', flex:1, textAlign:'left', fontFamily:FH }}>Data Sources</span>
        <span style={{ fontSize:11, fontWeight:700, color:confLabel.color, background:confLabel.bg, padding:'2px 8px', borderRadius:6, border:`1px solid ${confLabel.color}20` }}>
          {conf}% {confLabel.label}
        </span>
        <ChevronRight size={11} color="#94a3b8" style={{ transform:open?'rotate(90deg)':'rotate(0)', transition:'transform .2s' }}/>
      </button>
      {open && (
        <div style={{ marginTop:10, background:'#f8fafc', borderRadius:10, border:'1px solid #f1f5f9', overflow:'hidden' }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#475569' }}>Confidence</span>
              <span style={{ fontSize:11, fontWeight:800, color:confLabel.color }}>{conf}%</span>
            </div>
            <div style={{ height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${conf}%`, background:confLabel.color, borderRadius:2, transition:'width .6s ease' }}/>
            </div>
          </div>
          {lead._provenance?.map((p,i)=>(
            <div key={i} style={{ padding:'8px 12px', borderBottom:i<lead._provenance.length-1?'1px solid #f1f5f9':'none', display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#1e293b' }}>{p.source.label}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:statusColor[p.status], textTransform:'uppercase', letterSpacing:'.04em' }}>
                    {p.status.replace('_',' ')}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'#475569', lineHeight:1.4 }}>{p.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, mode, onSave, onAddClient, onReport, onStartDiscovery, saved, view }) {
  const [expanded, setExpanded] = useState(false)
  const score = lead.score||50
  const temp = score>=75 ? { label:'Hot', color:'#ef4444', bg:'#fef2f2' }
             : score>=50 ? { label:'Warm', color:ACCENT, bg:'#fdf2f8' }
             : score>=30 ? { label:'Lukewarm', color:'#d97706', bg:'#fffbeb' }
             :             { label:'Cold', color:'#64748b', bg:'#f8fafc' }
  const pipelineDone = lead.pipeline_complete
  const isCompetitor = mode === 'competitor'
  const isMarket     = mode === 'market'

  function copy(text) { navigator.clipboard.writeText(text); toast.success('Copied') }

  function copyOutreach() {
    const gaps = []
    if (!lead.has_website && !lead.website) gaps.push('no website')
    if ((lead.review_count||0) < 20) gaps.push('few online reviews')
    if ((lead.rating||0) < 4.2 && lead.rating) gaps.push('low review rating')
    const gapLine = gaps.length ? 'I noticed ' + gaps.slice(0,2).join(' and ') + ', and thought there might be an opportunity to help.' : 'I came across your business and wanted to reach out.'
    const email = ['Subject: Quick question for ' + lead.name,'','Hi ' + (lead.name?.split(' ')[0] || 'there') + ',','',gapLine,'','We help local businesses like yours get more visibility online — more Google reviews, better search rankings, and a stronger online presence.','','Would you be open to a quick 15-minute call to see if we could help?','','Best,','[Your Name]'].join('\n')
    navigator.clipboard.writeText(email); toast.success('Outreach email copied!')
  }

  const techBadges = pipelineDone ? [
    { label: lead.cms || null, present: !!lead.cms },
    { label: lead.seo_plugin || null, present: !!lead.seo_plugin },
    { label: 'CRM', present: lead.has_crm },
    { label: 'Analytics', present: lead.has_analytics },
    { label: 'Call Tracking', present: lead.has_call_tracking },
    { label: 'Schema', present: lead.has_schema },
    { label: lead.booking_software||null, present: !!lead.booking_software },
  ].filter(b => b.label) : []

  const missingBadges = pipelineDone ? [
    { label: 'No Analytics',     show: !lead.has_analytics && lead.website },
    { label: 'No Schema',        show: !lead.has_schema && lead.website },
    { label: 'No CRM',           show: !lead.has_crm && lead.website },
    { label: 'No Call Tracking',  show: !lead.has_call_tracking && lead.website },
  ].filter(b => b.show) : []

  // ── List view ──
  if (view==='list') return (
    <div className="scout-card" style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}
      onClick={()=>setExpanded(e=>!e)}>
      {!isMarket && <ScoreRing score={score} size={42}/>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#0f172a', fontFamily:FH }}>{lead.name}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:temp.bg, color:temp.color }}>{temp.label}</span>
          {lead._real_data && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:'#eff6ff', color:'#2563eb' }}>LIVE</span>}
        </div>
        <div style={{ display:'flex', gap:10, fontSize:12, color:'#64748b' }}>
          {lead.address && <span>{lead.address}</span>}
          {lead.rating > 0 && <span>{lead.rating} ({lead.review_count})</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="scout-btn" style={{ width:32, height:32, borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', textDecoration:'none' }}><Globe size={13}/></a>}
        {!isCompetitor && !isMarket && (
          <button onClick={e=>{e.stopPropagation();onAddClient(lead)}} className="scout-btn" style={{ height:32, padding:'0 14px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:FH }}><Plus size={11}/> Add</button>
        )}
      </div>
    </div>
  )

  // ── Grid card ──
  return (
    <div className="scout-card" style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden', cursor:'pointer' }}
      onClick={()=>setExpanded(e=>!e)}>
      {/* Score indicator */}
      <div style={{ height:2, background:`linear-gradient(90deg, ${scoreColor(score)}, transparent)`, width:`${score}%` }}/>

      <div style={{ padding:'18px 20px 16px' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
          {!isMarket && <ScoreRing score={score}/>}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', fontFamily:FH, letterSpacing:'-.02em', marginBottom:4, lineHeight:1.2 }}>{lead.name}</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background:temp.bg, color:temp.color, letterSpacing:'.02em' }}>{temp.label}</span>
              {lead._real_data && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'#eff6ff', color:'#2563eb', letterSpacing:'.03em' }}>LIVE DATA</span>}
              {lead.revenue?.annualRevenueAtRisk > 5000 && <RevenueChip revenue={lead.revenue}/>}
            </div>
          </div>
          {!isCompetitor && !isMarket && (
            <button onClick={e=>{e.stopPropagation();onSave(lead)}} className="scout-btn"
              style={{ padding:6, borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:saved?ACCENT:'#cbd5e1', cursor:'pointer' }}>
              {saved?<BookmarkCheck size={14}/>:<Bookmark size={14}/>}
            </button>
          )}
        </div>

        {/* Contact */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12, paddingLeft:2 }}>
          {lead.address && <div style={{ fontSize:12, color:'#64748b', display:'flex', gap:7, alignItems:'center' }}><MapPin size={10} color="#94a3b8"/>{lead.address}</div>}
          {lead.phone && <div style={{ fontSize:12, color:'#64748b', display:'flex', gap:7, alignItems:'center' }}><Phone size={10} color="#94a3b8"/>{lead.phone}</div>}
          {lead.rating>0 && <div style={{ fontSize:12, color:'#64748b', display:'flex', gap:7, alignItems:'center' }}>
            <Star size={10} color="#f59e0b"/>
            <span style={{ fontWeight:700, color:'#334155' }}>{lead.rating}</span>
            <span style={{ color:'#94a3b8' }}>{lead.review_count?.toLocaleString()} reviews</span>
            {lead.review_count < 50 && <span style={{ fontSize:10, fontWeight:700, color:ACCENT }}>low volume</span>}
          </div>}
          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:12, color:'#3b82f6', display:'flex', gap:7, alignItems:'center', textDecoration:'none' }}><Globe size={10}/>{lead.website.replace(/^https?:\/\//,'').replace(/\/$/,'').slice(0,35)}</a>}
        </div>

        {/* Tech stack */}
        {pipelineDone && (techBadges.some(b=>b.present) || missingBadges.length > 0) && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5 }}>
              Tech Stack{lead.cms ? ` · ${lead.cms}` : ''}
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {techBadges.filter(b=>b.present).map(b=><TechBadge key={b.label} label={b.label}/>)}
              {missingBadges.map(b=><MissingBadge key={b.label} label={b.label}/>)}
            </div>
          </div>
        )}

        {/* Gaps */}
        {lead.gaps?.length>0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
            {lead.gaps.slice(0, expanded ? 99 : 3).map(g=>(
              <span key={g} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0' }}>{g}</span>
            ))}
          </div>
        )}

        {/* Revenue opportunity */}
        {pipelineDone && lead.revenue?.annualRevenueAtRisk > 0 && (
          <div style={{ background:'#fffbeb', borderRadius:10, padding:'10px 12px', marginBottom:10, border:'1px solid #fef3c7' }}>
            <div style={{ fontSize:9, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Revenue Opportunity</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {[
                { label:'Current', value:'$' + Math.round((lead.revenue.revenuePerClientYr||0) * (lead.revenue.currentMonthlyLeads||0) * 12 / 1000) + 'k' },
                { label:'Optimized', value:'$' + Math.round((lead.revenue.annualRevenueGain||0)/1000) + 'k' },
                { label:'At Risk', value:'$' + Math.round((lead.revenue.annualRevenueAtRisk||0)/1000) + 'k', hl:true },
              ].map(m=>(
                <div key={m.label} style={{ textAlign:'center', background:'#fff', borderRadius:8, padding:'6px 4px', border:m.hl?'1px solid #fbbf24':'1px solid #fef3c7' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:m.hl?'#c2410c':'#78350f', fontFamily:FB }}>{m.value}</div>
                  <div style={{ fontSize:9, color:'#a16207', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI summary */}
        {expanded && lead.ai_summary && (
          <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px', marginBottom:10, fontSize:12, color:'#475569', lineHeight:1.6 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>
              {isCompetitor ? 'Competitive Intel' : isMarket ? 'Market Insight' : 'Opportunity Analysis'}
            </div>
            {lead.ai_summary}
          </div>
        )}

        {/* Pipeline indicator */}
        {!pipelineDone && lead._real_data && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:TEAL, marginBottom:8 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:TEAL, animation:'pulse 1s infinite' }}/>
            Analyzing tech stack...
          </div>
        )}

        <ProvenancePanel lead={lead}/>

        {/* Actions */}
        <div style={{ display:'flex', gap:6, marginTop:12, borderTop:'1px solid #f1f5f9', paddingTop:12 }} onClick={e=>e.stopPropagation()}>
          {lead.phone && <button onClick={()=>copy(lead.phone)} className="scout-btn" style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#475569', fontFamily:FH }}><Phone size={10}/> Phone</button>}
          {!isCompetitor && !isMarket && (
            <button onClick={()=>onAddClient(lead)} className="scout-btn" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'7px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <Plus size={11}/> Add as Client
            </button>
          )}
          {isCompetitor && <button onClick={()=>onAddClient({...lead, status:'competitor'})} className="scout-btn" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'7px', borderRadius:8, border:'none', background:'#8b5cf6', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}><BarChart size={11}/> Save</button>}
          <button onClick={copyOutreach} className="scout-btn" style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#475569', fontFamily:FH }}><Mail size={10}/></button>
          <button onClick={()=>onReport&&onReport(lead)} className="scout-btn" style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${ACCENT}30`, background:`${ACCENT}06`, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:ACCENT, fontFamily:FH }}><Sparkles size={10}/> Report</button>
          {onStartDiscovery && (
            <button onClick={()=>onStartDiscovery(lead)} className="scout-btn" style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${TEAL}40`, background:`${TEAL}08`, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:TEAL, fontFamily:FH }}><Brain size={10}/></button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Market summary ────────────────────────────────────────────────────────────
function MarketSummaryCard({ results, query, location }) {
  const avgRating  = results.filter(r=>r.rating>0).reduce((s,r)=>s+r.rating,0) / (results.filter(r=>r.rating>0).length||1)
  const avgReviews = Math.round(results.reduce((s,r)=>s+r.review_count,0)/results.length)
  const withWebsite= results.filter(r=>r.has_website||r.website).length
  const lowReviews = results.filter(r=>r.review_count<50).length
  const lowRating  = results.filter(r=>r.rating>0&&r.rating<4.0).length

  return (
    <div style={{ background:'#0f172a', borderRadius:14, padding:'24px', marginBottom:20, color:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'#10b98120', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BarChart2 size={16} color="#10b981"/>
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:800, fontFamily:FH, letterSpacing:'-.01em' }}>Market Overview</div>
          <div style={{ fontSize:11, color:'#64748b' }}>{query} in {location}</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {[
          { label:'Found', value:results.length, color:'#fff' },
          { label:'Avg Rating', value:`${avgRating.toFixed(1)}`, color:'#f59e0b' },
          { label:'Avg Reviews', value:avgReviews, color:'#60a5fa' },
          { label:'Have Sites', value:`${withWebsite}/${results.length}`, color:'#34d399' },
          { label:'Low Reviews', value:lowReviews, color:'#f87171' },
        ].map(s=>(
          <div key={s.label} style={{ background:'rgba(255,255,255,.06)', borderRadius:10, padding:'12px 8px', textAlign:'center', border:'1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize:18, fontWeight:900, color:s.color, fontFamily:FB, letterSpacing:'-.03em' }}>{s.value}</div>
            <div style={{ fontSize:9, color:'#64748b', marginTop:3, textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:14, fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>
        {lowReviews>results.length*0.5 ? `${lowReviews} of ${results.length} businesses have under 50 reviews — review generation opportunity.`
          : lowRating>2 ? `${lowRating} businesses below 4.0 — reputation management in demand.`
          : withWebsite<results.length*0.7 ? `${results.length-withWebsite} lack a website — web design opportunities.`
          : `Mature market. Focus on premium services and differentiation.`}
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN SCOUT PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function ScoutPage() {
  const { agencyId } = useAuth()
  const navigate      = useNavigate()
  const routeLocation = useLocation()
  const [mode, setMode]         = useState('prospect')
  const [query, setQuery]       = useState(() => routeLocation.state?.replayQuery || '')
  const [location, setLocation] = useState(() => routeLocation.state?.replayLocation || '')
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
  const [dataSource, setDataSource] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [pipelineProgress, setPipelineProgress] = useState(null)
  const [currentSearchId, setCurrentSearchId] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [sweepMeta, setSweepMeta] = useState(null)
  const [sweepCounties, setSweepCounties] = useState('')

  const modeConfig = SEARCH_MODES.find(m=>m.id===mode) || SEARCH_MODES[0]
  const ModeIcon = modeConfig.icon

  // ── State codes ─────────────────────────────────────────────────────────────
  const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR'])
  const STATE_NAMES = {florida:'FL',texas:'TX',california:'CA',newyork:'NY',georgia:'GA',illinois:'IL',ohio:'OH',pennsylvania:'PA',virginia:'VA',northcarolina:'NC',newjersey:'NJ',michigan:'MI',washington:'WA',arizona:'AZ',massachusetts:'MA',tennessee:'TN',indiana:'IN',missouri:'MO',maryland:'MD',wisconsin:'WI',colorado:'CO',minnesota:'MN',southcarolina:'SC',alabama:'AL',louisiana:'LA',kentucky:'KY',oregon:'OR',oklahoma:'OK',connecticut:'CT',utah:'UT',iowa:'IA',nevada:'NV',arkansas:'AR',mississippi:'MS',kansas:'KS',newmexico:'NM',nebraska:'NE',idaho:'ID',westvirginia:'WV',hawaii:'HI',newhampshire:'NH',maine:'ME',montana:'MT',rhodeisland:'RI',delaware:'DE',southdakota:'SD',northdakota:'ND',alaska:'AK',vermont:'VT',wyoming:'WY'}

  function parseStateCode(raw) {
    const trimmed = raw.trim()
    if (trimmed.includes(',')) {
      const after = trimmed.split(',').pop().trim().toUpperCase().replace(/[^A-Z]/g, '')
      if (after.length === 2 && US_STATES.has(after)) return after
    }
    const upper = trimmed.toUpperCase().replace(/[^A-Z]/g, '')
    if (upper.length === 2 && US_STATES.has(upper)) return upper
    const normalized = trimmed.toLowerCase().replace(/\s+/g, '')
    if (STATE_NAMES[normalized]) return STATE_NAMES[normalized]
    return null
  }

  // ── Sweep search ────────────────────────────────────────────────────────────
  async function runSweepSearch() {
    const term = query.trim() || selectedIndustries.map(k=>INDUSTRIES.find(i=>i.key===k)?.label).filter(Boolean).join(', ')
    const stateCode = parseStateCode(location)
    if (!term) { toast.error('Enter an industry or business type'); return }
    if (!stateCode) { toast.error('Enter a valid US state'); return }
    setSearching(true); setResults([]); setStats(null); setSearchError(null); setSweepMeta(null)
    const counties = sweepCounties.split(',').map(s => s.trim()).filter(Boolean)
    toast(`Sweeping ${counties.length ? counties.length + ' counties' : 'all cities'} in ${stateCode}...`, { duration: 8000 })
    try {
      const res = await fetch('/api/scout/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'run_sweep', state:stateCode, counties:counties.length?counties:undefined, industry_keywords:term.split(',').map(s=>s.trim()).filter(Boolean), agency_id:agencyId||'00000000-0000-0000-0000-000000000099', max_results:500, max_municipalities:150 }) })
      const data = await res.json()
      if (!res.ok || data.error) { setSearchError(data.error || 'Sweep failed'); setSearching(false); return }
      setSweepMeta({ municipalities_searched:data.municipalities_searched, municipalities_total:data.municipalities_total, geo_provenance:data.geo_provenance })
      const mapped = (data.leads || []).map((l, i) => ({ id:l.google_place_id||`sweep-${i}`, name:l.business_name, address:l.address||'', phone:l.phone||'', website:l.website||'', email:'', rating:l.google_rating, review_count:l.google_review_count, score:l.opportunity_score||50, temperature:l.opportunity_score>=75?'Hot Lead':l.opportunity_score>=50?'Warm':'Lukewarm', gaps:[], ai_summary:l.opportunity_explanation||'', place_id:l.google_place_id, maps_url:l.google_profile_url, city:l.city, state:l.state, _real_data:true, _confidence:85, _confLabel:{label:'Verified',color:'#16a34a',bg:'#f0fdf4'}, _provenance:[] }))
      const enriched = enrichLeads(mapped, stateCode)
      setResults(enriched); setDataSource('google')
      setStats({ total:enriched.length, hot:enriched.filter(l=>l.score>=75).length, warm:enriched.filter(l=>l.score>=50&&l.score<75).length, avgScore:enriched.length>0?Math.round(enriched.reduce((s,l)=>s+l.score,0)/enriched.length):0, verified:enriched.length, realData:enriched.length })
      setCurrentSearchId(data.search_id)
      toast.success(`Found ${enriched.length} businesses across ${data.municipalities_searched} cities`)
    } catch (e) { setSearchError(e.message || 'Sweep failed') }
    setSearching(false)
  }

  // ── Main search ─────────────────────────────────────────────────────────────
  async function runSearch() {
    if (mode === 'sweep') return runSweepSearch()
    const term = query.trim() || selectedIndustries.map(k=>INDUSTRIES.find(i=>i.key===k)?.label).filter(Boolean).join(', ')
    if (!term && !location.trim()) { toast.error('Enter a business type or location'); return }
    setSearching(true); setResults([]); setStats(null); setSearchError(null)
    const loc = location.trim() || 'United States'
    let leads = [], source = 'ai'

    if (hasGoogleKey()) {
      try {
        const { leads: googleLeads, error: googleError } = await scoutWithPlaces(term, loc, { maxResults: 20 })
        if (!googleError && googleLeads.length > 0) { leads = googleLeads; source = 'google' }
        else if (googleError) console.warn('Google Places failed:', googleError)
      } catch(e) { console.warn('Google Places error:', e.message) }
    }
    if (leads.length === 0) { setSearchError('No businesses found for "' + term + '" in ' + loc + '.'); setSearching(false); return }

    if (leads.length > 0) {
      try {
        const businessList = leads.slice(0, 12).map((l, i) => (i+1) + '. ' + l.name + (l.rating ? ' | Rating: ' + l.rating + '/5' : '') + (l.review_count ? ' | Reviews: ' + l.review_count : '') + (l.website ? ' | Has website' : ' | No website') + (l.phone ? ' | Has phone' : ' | No phone') + (l.address ? ' | ' + l.address : '')).join('\n')
        const modeContext = mode==='competitor' ? 'You are doing competitor analysis. Rate competitive threat and identify strategic weaknesses.' : mode==='market' ? 'You are doing market research. Rate market saturation and identify segment opportunities.' : 'You are scoring marketing agency prospects. High score = needs marketing help most urgently.'
        const enrichPrompt = 'You are a marketing intelligence analyst. ' + modeContext + ' Here are ' + leads.slice(0,12).length + ' real ' + term + ' businesses in ' + loc + ':\n\n' + businessList + '\n\nFor each business return a JSON array. Each object: {"name":"exact name from list","ai_summary":"one plain sentence about their biggest marketing opportunity - no quotes or apostrophes","estimated_revenue":"range like $500K-$1M","employee_count":"range like 5-15","running_ads":true or false,"social_active":true or false,"email":"guessed email like info@businessdomain.com","extra_gaps":["gap1","gap2"]}. Return ONLY the JSON array. No markdown.'
        const raw2 = await callClaude('You are a B2B marketing intelligence analyst. Return only a raw JSON array starting with [ ending with ]. No markdown.', enrichPrompt, 2500)
        let cleaned2 = raw2.replace(/```json|```/g, '').trim()
        const s2 = cleaned2.indexOf('['), e2 = cleaned2.lastIndexOf(']')
        if (s2 !== -1 && e2 !== -1) {
          cleaned2 = cleaned2.slice(s2, e2 + 1)
          let enrichments; try { enrichments = JSON.parse(cleaned2) } catch(_) { enrichments = JSON.parse(cleaned2.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')) }
          const enrichMap = {}; enrichments.forEach(e => { if (e.name) enrichMap[e.name] = e })
          leads = leads.map(l => { const en = enrichMap[l.name] || {}; return { ...l, ai_summary:en.ai_summary||l.ai_summary||null, estimated_revenue:en.estimated_revenue||l.estimated_revenue||null, employee_count:en.employee_count||l.employee_count||null, running_ads:en.running_ads!=null?en.running_ads:l.running_ads, social_active:en.social_active!=null?en.social_active:l.social_active, email:en.email||l.email||'', gaps:l.gaps.length>0?[...new Set([...l.gaps,...(en.extra_gaps||[])])].slice(0,4):(en.extra_gaps||l.gaps) } })
          source = leads.some(l => l._real_data) ? 'mixed' : source
        }
      } catch(e) { console.warn('AI enrichment failed:', e.message) }
    }

    const enriched = enrichLeads(leads, loc)
    const finalStats = { total:enriched.length, hot:enriched.filter(l=>l.score>=75).length, warm:enriched.filter(l=>l.score>=50&&l.score<75).length, avgScore:Math.round(enriched.reduce((s,l)=>s+l.score,0)/enriched.length), verified:enriched.filter(l=>l._verified>=2||l._real_data).length, realData:enriched.filter(l=>l._real_data).length }
    setResults(enriched); setDataSource(source); setStats(finalStats); setSearching(false)

    try {
      const { data: savedSearch } = await saveScoutSearch({ agency_id:agencyId||'00000000-0000-0000-0000-000000000099', query:term, location:loc, mode, result_count:enriched.length, results:enriched.map(l=>({id:l.id,name:l.name,address:l.address,phone:l.phone,website:l.website,rating:l.rating,review_count:l.review_count,score:l.score,temperature:l.temperature,gaps:l.gaps,ai_summary:l.ai_summary,place_id:l.place_id,_real_data:l._real_data})), stats:finalStats, data_source:source })
      if (savedSearch) setCurrentSearchId(savedSearch.id)
    } catch(e) { console.warn('Search history save failed:', e.message) }

    enriched.slice(0, 3).forEach(async (lead, i) => {
      setTimeout(async () => {
        try {
          const enriched2 = await runLeadPipeline(lead, enriched.filter(x=>x.id!==lead.id), term, (msg, pct) => { if (i === 0) setPipelineProgress({ msg, pct }) })
          setResults(prev => prev.map(r => r.id === lead.id ? { ...r, ...enriched2 } : r))
          if (i === 0) setPipelineProgress(null)
        } catch(e) { console.warn('Pipeline failed for', lead.name, e.message) }
      }, i * 800)
    })
  }

  function toggleSaved(lead) {
    const next = new Set(saved)
    if (next.has(lead.id)) { next.delete(lead.id); toast('Removed') } else { next.add(lead.id); toast.success('Saved') }
    setSaved(next)
  }

  async function startDiscoveryFromProspect(lead) {
    toast.loading('Creating discovery...', { id: 'disc-start' })
    try {
      const res = await fetch('/api/discovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'create_from_scout', agency_id:agencyId, prospect:{ id:lead.id, prospect_company:lead.name||lead.business_name, company_name:lead.name||lead.business_name, industry:lead.types?.[0]||'', city:lead.city||lead.address||'', phone:lead.phone||'', website:lead.website||'', summary:lead.ai_summary||'' } }) }).then(r=>r.json())
      if (res?.data?.engagement_id) { toast.success('Discovery created', { id:'disc-start' }); navigate('/discovery') }
      else toast.error(res?.error || 'Failed', { id:'disc-start' })
    } catch { toast.error('Request failed', { id:'disc-start' }) }
  }

  async function addAsClient(lead) {
    try {
      const searchTerms = [lead.types?.[0], query, ...selectedIndustries].filter(Boolean).join(' ').toLowerCase()
      const matchedSIC = SIC_CODES.find(s => s.keywords.split(', ').some(kw => searchTerms.includes(kw.toLowerCase())) || s.label.toLowerCase().split(' ').some(w => w.length > 4 && searchTerms.includes(w)))
      const { data, error } = await supabase.from('clients').insert({ name:lead.name, email:lead.email||'', phone:lead.phone||'', website:lead.website||'', status:'prospect', industry:matchedSIC?.label||selectedIndustries[0]||'', sic_code:matchedSIC?.code||null, notes:lead.ai_summary||'', agency_id:agencyId||null }).select().single()
      if (error) throw error
      if (data?.id) {
        await supabase.from('client_profiles').upsert({ client_id:data.id, business_name:lead.name, phone:lead.phone||'', website:lead.website||'', address:{formatted:lead.address||''}, google_data:{place_id:lead.place_id||'',rating:lead.rating||null,review_count:lead.review_count||0,maps_url:lead.maps_url||''}, seo_data:{cms:lead.cms||null,seo_plugin:lead.seo_plugin||null,has_analytics:lead.has_analytics||false,has_schema:lead.has_schema||false,has_crm:lead.has_crm||false,has_call_tracking:lead.has_call_tracking||false,sitemap_pages:lead.sitemap_pages||0,page_title:lead.page_title||''}, scout_data:{opportunity_score:lead.score||null,gaps:lead.gaps||[],revenue_at_risk:lead.revenue?.annualRevenueAtRisk||null,ai_summary:lead.ai_summary||'',searched_at:new Date().toISOString()} }, { onConflict:'client_id' }).catch(()=>{})
      }
      setAddedClients(prev => new Set([...prev, lead.id]))
      toast.success(`${lead.name} added!`)
      if (data?.id) setTimeout(() => navigate(`/clients/${data.id}`), 800)
    } catch(e) { toast.error('Failed: ' + e.message) }
  }

  const displayed = results
    .filter(l=>l.score>=filterScore)
    .filter(l=>filterGaps.length===0||filterGaps.some(g=>l.gaps?.some(lg=>lg.toLowerCase().includes(g.toLowerCase().split(' ').pop()))))
    .sort((a,b)=>sortBy==='score'?b.score-a.score:sortBy==='reviews'?b.review_count-a.review_count:a.name.localeCompare(b.name))

  const hasResults = results.length > 0
  const isMobile = useMobile()

  /* ═══════════════════════════════════════════════════════════════════════════
     MOBILE
     ═══════════════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Scout" subtitle={modeConfig.desc}/>
        <div style={{padding:'8px 16px 0'}}>
          <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:6}}>
            {SEARCH_MODES.map(m=>(
              <button key={m.id} onClick={()=>{setMode(m.id);setResults([]);setStats(null)}}
                style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,border:mode===m.id?`1.5px solid ${m.color}30`:'1.5px solid #e2e8f0',background:mode===m.id?`${m.color}06`:'#fff',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                <m.icon size={11} color={mode===m.id?m.color:'#94a3b8'}/>
                <span style={{fontSize:12,fontWeight:mode===m.id?700:500,color:mode===m.id?m.color:'#64748b',fontFamily:FH}}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:'8px 16px'}}>
          <div style={{display:'flex',gap:8}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={modeConfig.placeholder_q} onKeyDown={e=>{if(e.key==='Enter')runSearch()}}
              style={{flex:1,padding:'10px 12px',borderRadius:10,border:'1.5px solid #e2e8f0',fontSize:15,outline:'none',color:'#0f172a',fontFamily:FH,background:'#fff'}}/>
            <button onClick={runSearch} disabled={searching}
              style={{width:44,height:44,borderRadius:10,border:'none',background:modeConfig.color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,opacity:searching?.6:1}}>
              {searching?<Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/>:<Search size={16}/>}
            </button>
          </div>
          {!hasResults && <input value={location} onChange={e=>setLocation(e.target.value)} placeholder={modeConfig.placeholder_loc} onKeyDown={e=>{if(e.key==='Enter')runSearch()}}
            style={{width:'100%',marginTop:8,padding:'10px 12px',borderRadius:10,border:'1.5px solid #e2e8f0',fontSize:15,outline:'none',color:'#0f172a',fontFamily:FH,background:'#fff',boxSizing:'border-box'}}/>}
        </div>
        {searching && <div style={{padding:'48px 0',textAlign:'center'}}><Loader2 size={24} color={modeConfig.color} style={{margin:'0 auto',animation:'spin 1s linear infinite'}}/><div style={{fontSize:13,color:'#94a3b8',marginTop:12,fontFamily:FH}}>Scanning...</div></div>}
        {!searching && !hasResults && !query && (
          <div style={{padding:'40px 24px',textAlign:'center'}}>
            <div style={{width:56,height:56,borderRadius:14,background:`${modeConfig.color}10`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><ModeIcon size={24} color={modeConfig.color}/></div>
            <div style={{fontFamily:FB,fontSize:20,fontWeight:800,color:'#0f172a',letterSpacing:'-.02em',marginBottom:6}}>{modeConfig.label}</div>
            <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.6}}>{modeConfig.desc}</div>
          </div>
        )}
        {hasResults && !searching && (
          <div style={{padding:'4px 16px 16px',display:'flex',flexDirection:'column',gap:8}}>
            <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.12em',fontFamily:FH,padding:'4px 0'}}>{results.length} results</div>
            {results.map((lead,i)=>{
              const s = lead.score||0, sc = s>=70?'#ef4444':s>=40?'#f59e0b':'#94a3b8'
              return (
                <div key={lead.id||i} className="scout-card" style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px',borderLeft:`3px solid ${sc}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.name||lead.business_name}</div>
                      <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{lead.address||lead.city}</div>
                    </div>
                    <div style={{textAlign:'center',flexShrink:0}}><div style={{fontFamily:FB,fontSize:20,fontWeight:900,color:sc,lineHeight:1}}>{s}</div><div style={{fontSize:9,color:'#94a3b8',fontWeight:700,textTransform:'uppercase'}}>score</div></div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                    {lead.rating>0 && <span style={{fontSize:11,color:'#f59e0b',fontWeight:700}}>★ {lead.rating}</span>}
                    {lead.review_count>0 && <span style={{fontSize:11,color:'#94a3b8'}}>({lead.review_count})</span>}
                    {lead.phone && <span style={{fontSize:11,color:'#64748b'}}>{lead.phone}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <style>{CSS}</style>
      </MobilePage>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     DESKTOP
     ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <ScoutLayout>
      <style>{CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#f8fafc' }}>

        {/* ── Header bar ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 28px', height:56, display:'flex', alignItems:'center', gap:16, flexShrink:0, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:`${modeConfig.color}10`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ModeIcon size={14} color={modeConfig.color}/>
            </div>
            <span style={{ fontSize:15, fontWeight:800, color:'#0f172a', fontFamily:FH, letterSpacing:'-.02em' }}>Scout</span>
          </div>

          {/* Segmented control */}
          <div style={{ display:'flex', background:'#f1f5f9', borderRadius:10, padding:3, gap:2 }}>
            {SEARCH_MODES.map(m=>(
              <button key={m.id} onClick={()=>{ setMode(m.id); setResults([]); setStats(null) }} className="scout-seg-btn"
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8,
                  border:mode===m.id?'1px solid #e2e8f0':'1px solid transparent',
                  background:mode===m.id?'#fff':'transparent',
                  boxShadow:mode===m.id?'0 1px 3px rgba(0,0,0,.06)':'none',
                  cursor:'pointer' }}>
                <m.icon size={12} color={mode===m.id?m.color:'#94a3b8'}/>
                <span style={{ fontSize:12, fontWeight:mode===m.id?700:500, color:mode===m.id?'#0f172a':'#64748b', fontFamily:FH }}>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Right controls */}
          {hasResults && (
            <div style={{ display:'flex', gap:8, marginLeft:'auto', alignItems:'center' }}>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:12, cursor:'pointer', outline:'none', fontFamily:FH, color:'#475569', background:'#fff' }}>
                <option value="score">Score</option>
                <option value="reviews">Reviews</option>
                <option value="name">Name</option>
              </select>
              <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:2 }}>
                {[['grid','Grid'],['list','List']].map(([v,label])=>(
                  <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 10px', borderRadius:6, border:'none', background:view===v?'#fff':'transparent', fontSize:11, fontWeight:view===v?700:500, cursor:'pointer', color:view===v?'#0f172a':'#64748b', boxShadow:view===v?'0 1px 2px rgba(0,0,0,.06)':'none', fontFamily:FH }}>{label}</button>
                ))}
              </div>
              <button onClick={()=>{setResults([]);setStats(null);setDataSource(null)}} className="scout-btn"
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:11, cursor:'pointer', color:'#475569', fontFamily:FH, fontWeight:600 }}>
                <RefreshCw size={11}/> New
              </button>
            </div>
          )}
        </div>

        {/* ── Search bar ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'12px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, background:'#f8fafc', borderRadius:10, border:'1.5px solid #e2e8f0', padding:'10px 16px' }}>
              <Search size={15} color="#94a3b8" style={{ flexShrink:0 }}/>
              <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                className="scout-input" placeholder={modeConfig.placeholder_q}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, color:'#0f172a', fontFamily:FH }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f8fafc', borderRadius:10, border:'1.5px solid #e2e8f0', padding:'10px 16px', width:200 }}>
              <MapPin size={14} color="#94a3b8" style={{ flexShrink:0 }}/>
              <input value={location} onChange={e=>setLocation(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                className="scout-input" placeholder={modeConfig.placeholder_loc}
                style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, color:'#0f172a', fontFamily:FH }}/>
            </div>
            {mode === 'sweep' && (
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f8fafc', borderRadius:10, border:'1.5px solid #e2e8f0', padding:'10px 16px', width:240 }}>
                <Building size={14} color="#94a3b8" style={{ flexShrink:0 }}/>
                <input value={sweepCounties} onChange={e=>setSweepCounties(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                  className="scout-input" placeholder="Counties (optional)"
                  style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:FH }}/>
              </div>
            )}
            <button onClick={()=>setShowFilters(s=>!s)} className="scout-btn"
              style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${showFilters?modeConfig.color+'30':'#e2e8f0'}`, background:showFilters?`${modeConfig.color}06`:'#fff', color:showFilters?modeConfig.color:'#475569', fontSize:12, cursor:'pointer', fontWeight:600, fontFamily:FH }}>
              <Filter size={13}/> Filters
              {(filterGaps.length>0||selectedIndustries.length>0||filterScore>0) && <div style={{ width:5, height:5, borderRadius:'50%', background:modeConfig.color }}/>}
            </button>
            <button onClick={runSearch} disabled={searching} className="scout-btn"
              style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 22px', borderRadius:10, border:'none', background:modeConfig.color, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:searching?.6:1, fontFamily:FH, letterSpacing:'-.01em' }}>
              {searching?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Search size={14}/>}
              {searching?'Scanning...':'Scout'}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="scout-fade-in" style={{ marginTop:12, padding:'16px', background:'#f8fafc', borderRadius:12, border:'1px solid #f1f5f9', display:'grid', gridTemplateColumns:'1fr 1fr 180px', gap:16 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Industry</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {INDUSTRIES.map(ind=>(
                    <button key={ind.key} onClick={()=>setSelectedIndustries(prev=>prev.includes(ind.key)?prev.filter(k=>k!==ind.key):[...prev,ind.key])}
                      style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${selectedIndustries.includes(ind.key)?modeConfig.color+'40':'#e2e8f0'}`, background:selectedIndustries.includes(ind.key)?`${modeConfig.color}08`:'#fff', color:selectedIndustries.includes(ind.key)?modeConfig.color:'#475569', cursor:'pointer', fontWeight:600, fontFamily:FH }}>
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Gaps</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {GAPS.map(g=>(
                    <label key={g} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#475569', cursor:'pointer', fontFamily:FH }}>
                      <div onClick={()=>setFilterGaps(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                        style={{ width:15, height:15, borderRadius:4, border:`1.5px solid ${filterGaps.includes(g)?modeConfig.color:'#cbd5e1'}`, background:filterGaps.includes(g)?modeConfig.color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
                        {filterGaps.includes(g)&&<Check size={9} color="#fff" strokeWidth={3}/>}
                      </div>
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Min Score</div>
                <div style={{ textAlign:'center', marginBottom:8 }}>
                  <span style={{ fontSize:32, fontWeight:900, color:scoreColor(filterScore), fontFamily:FB, letterSpacing:'-.03em' }}>{filterScore}</span>
                  <span style={{ fontSize:12, color:'#94a3b8' }}>/100</span>
                </div>
                <input type="range" min={0} max={90} step={5} value={filterScore} onChange={e=>setFilterScore(+e.target.value)} style={{ width:'100%', accentColor:modeConfig.color }}/>
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* Error */}
          {searchError && (
            <div className="scout-fade-in" style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'16px 18px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' }}>
              <AlertCircle size={16} color="#dc2626" style={{ flexShrink:0, marginTop:1 }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#991b1b', fontFamily:FH, marginBottom:2 }}>No Results</div>
                <div style={{ fontSize:12, color:'#991b1b' }}>{searchError}</div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!searching && !hasResults && !searchError && (
            <div className="scout-fade-in">
              {/* Quick searches */}
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12, fontFamily:FH }}>Quick Searches</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8 }}>
                  {(QUICK_SEARCHES[mode]||QUICK_SEARCHES.prospect).map(qs=>(
                    <button key={qs.label} onClick={()=>{ setQuery(qs.q); setLocation(qs.loc); setTimeout(runSearch,100) }} className="scout-btn"
                      style={{ fontSize:12, padding:'12px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', color:'#475569', fontWeight:600, fontFamily:FH, display:'flex', alignItems:'center', gap:7, textAlign:'left' }}>
                      <ModeIcon size={12} color={modeConfig.color} style={{flexShrink:0}}/> {qs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero */}
              <div style={{ background:'#0f172a', borderRadius:16, padding:'56px 40px', textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:`${modeConfig.color}15`, border:`1px solid ${modeConfig.color}25`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
                  <ModeIcon size={28} color={modeConfig.color}/>
                </div>
                <h2 style={{ fontSize:24, fontWeight:800, color:'#fff', fontFamily:FB, letterSpacing:'-.03em', marginBottom:8 }}>{modeConfig.label}</h2>
                <p style={{ fontSize:14, color:'#64748b', lineHeight:1.6, maxWidth:400, margin:'0 auto' }}>{modeConfig.desc}</p>
              </div>
            </div>
          )}

          {/* Searching */}
          {searching && (
            <div style={{ padding:'32px 20px' }}>
              <AIThinkingBox active={searching} task='scout'
                label={mode==='competitor'?'Analyzing competitors':mode==='market'?'Researching market':'Scouting leads'}/>
            </div>
          )}

          {/* Results */}
          {hasResults && !searching && (
            <div className="scout-fade-in">
              {/* Pipeline progress */}
              {pipelineProgress && (
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', marginBottom:12, background:`${TEAL}08`, borderRadius:10, border:`1px solid ${TEAL}20` }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:TEAL, animation:'pulse 1s infinite', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#0e7490', fontFamily:FH }}>{pipelineProgress.msg}</div>
                    <div style={{ height:3, background:'#e2e8f0', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pipelineProgress.pct}%`, background:TEAL, borderRadius:2, transition:'width .4s ease' }}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Data source */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:sweepMeta?8:14, padding:'8px 12px', borderRadius:8, background:'#f0f9ff', border:'1px solid #e0f2fe' }}>
                <HardDrive size={12} color="#0284c7"/>
                <span style={{ fontSize:11, fontWeight:700, color:'#0369a1', fontFamily:FH }}>
                  {dataSource==='mixed' ? `${stats?.realData||0} verified businesses + AI enrichment` : `${results.length} verified businesses from Google Maps`}
                </span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'#64748b' }}>{query} in {location}</span>
              </div>

              {/* Sweep provenance */}
              {sweepMeta && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'8px 12px', borderRadius:8, background:'#eff6ff', border:'1px solid #dbeafe' }}>
                  <MapPin size={12} color="#2563eb"/>
                  <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', fontFamily:FH }}>
                    {sweepMeta.municipalities_searched}/{sweepMeta.municipalities_total} municipalities
                  </span>
                  {sweepMeta.geo_provenance?.source_name && (
                    <span style={{ fontSize:10, color:'#64748b' }}>
                      Source: {sweepMeta.geo_provenance.source_url ? <a href={sweepMeta.geo_provenance.source_url} target="_blank" rel="noreferrer" style={{color:'#2563eb',textDecoration:'underline'}}>{sweepMeta.geo_provenance.source_name}</a> : sweepMeta.geo_provenance.source_name}
                    </span>
                  )}
                </div>
              )}

              {/* Market summary */}
              {mode==='market' && <MarketSummaryCard results={results} query={query} location={location}/>}

              {/* Stats */}
              {mode!=='market' && stats && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:18 }}>
                  {[
                    { label:'Total',    value:stats.total,    color:'#0f172a', top:'#e2e8f0' },
                    { label:'Hot',      value:stats.hot,      color:'#ef4444', top:'#ef4444' },
                    { label:'Warm',     value:stats.warm,     color:ACCENT,    top:ACCENT },
                    { label:'Avg Score',value:stats.avgScore,  color:scoreColor(stats.avgScore), top:scoreColor(stats.avgScore) },
                    { label:'Verified', value:`${stats.verified}/${stats.total}`, color:'#16a34a', top:'#16a34a' },
                  ].map(s=>(
                    <div key={s.label} className="scout-card" style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', borderTop:`2px solid ${s.top}`, padding:'14px 12px', cursor:'default' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color, fontFamily:FB, letterSpacing:'-.03em' }}>{s.value}</div>
                      <div style={{ fontSize:9, fontWeight:800, color:'#94a3b8', marginTop:3, textTransform:'uppercase', letterSpacing:'.1em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mismatch warning */}
              {results.some(l=>l._mismatches>0) && (
                <div style={{ background:'#fffbeb', border:'1px solid #fef3c7', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', gap:8, alignItems:'center' }}>
                  <AlertCircle size={13} color="#d97706"/>
                  <span style={{ fontSize:11, color:'#92400e', fontFamily:FH }}><strong>{results.filter(l=>l._mismatches>0).length}</strong> leads have data flags. Check Data Sources per lead.</span>
                </div>
              )}

              {/* Results grid/list */}
              <div style={view==='grid'
                ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:12 }
                : { display:'flex', flexDirection:'column', gap:8 }}>
                {displayed.map(lead=>(
                  <LeadCard key={lead.id} lead={lead} mode={mode} view={view}
                    saved={saved.has(lead.id)} onSave={toggleSaved} onAddClient={addAsClient}
                    onReport={l=>navigate('/scout/report', {state:{lead:l,allLeads:results,query,searchId:currentSearchId,searchLocation:location}})}
                    onStartDiscovery={startDiscoveryFromProspect}/>
                ))}
              </div>
              {displayed.length===0 && (
                <div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>
                  <Filter size={28} style={{ margin:'0 auto 12px', opacity:.3 }}/>
                  <div style={{ fontSize:13, fontWeight:700, fontFamily:FH }}>No leads match filters</div>
                  <button onClick={()=>{setFilterScore(0);setFilterGaps([])}} style={{ marginTop:10, fontSize:12, color:ACCENT, background:'none', border:'none', cursor:'pointer', fontFamily:FH, fontWeight:600 }}>Clear filters</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ScoutLayout>
  )
}
