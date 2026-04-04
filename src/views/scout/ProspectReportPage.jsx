"use client";
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Star, Globe, Phone, Mail, MapPin, TrendingUp, AlertCircle, Search,
  CheckCircle, ArrowRight, Target, BarChart2, Zap, Shield,
  ChevronDown, ExternalLink, Award, Users, DollarSign,
  Sparkles, Loader2, Download, Share2, ChevronRight, Link, Check, Printer
} from 'lucide-react'
import { callClaude } from '../../lib/ai'
import { saveProspectReport, updateProspectReport } from '../../lib/supabase'
import { runLeadPipeline, getIndustryBenchmark, calcRevenueImpact } from '../../lib/scoutPipeline'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import AIThinkingBox from '../../components/AIThinkingBox'
import toast, { Toaster } from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLACK = '#0a0a0a'
const DARK  = '#111827'

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimCounter({ to, duration=1200, prefix='', suffix='' }) {
  const [val, setVal] = useState(0)
  const ref = useRef()
  useEffect(() => {
    const start = Date.now()
    ref.current = requestAnimationFrame(function tick() {
      const p = Math.min((Date.now()-start)/duration, 1)
      const ease = 1-Math.pow(1-p,3)
      setVal(Math.round(ease*to))
      if (p < 1) ref.current = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(ref.current)
  }, [to])
  return <>{prefix}{val.toLocaleString()}{suffix}</>
}

// ── Score ring ────────────────────────────────────────────────────────────────
function Ring({ score, size=110, stroke=10 }) {
  const r = (size-stroke)/2, circ = 2*Math.PI*r
  const offset = circ - (score/100)*circ
  const color = score>=75?'#16a34a':score>=50?TEAL:RED
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{transition:'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)'}}/>
    </svg>
  )
}

// ── Star rating display ───────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <div style={{display:'flex',gap:2}}>
      {[1,2,3,4,5].map(i=>(
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i<=Math.round(rating)?'#f59e0b':'#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}

// ── Opportunity score bar ─────────────────────────────────────────────────────
function ScoreBar({ label, value, max=100, color=RED }) {
  const pct = Math.round((value/max)*100)
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color:color}}>{pct}%</span>
      </div>
      <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:4,
          transition:'width 1.2s cubic-bezier(.22,1,.36,1)',transitionDelay:'.3s'}}/>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, children, dark=false, style={} }) {
  return (
    <div id={id} style={{
      background: dark ? BLACK : '#fff',
      padding:'72px 0',
      ...style
    }}>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'0 48px'}}>
        {children}
      </div>
    </div>
  )
}

function SectionLabel({ text, light=false }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
      <div style={{width:32,height:2,background:RED}}/>
      <span style={{fontSize:11,fontWeight:800,color:light?'rgba(255,255,255,.5)':RED,
        textTransform:'uppercase',letterSpacing:'.1em'}}>{text}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ProspectReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { agencyId } = useAuth()

  const lead    = location.state?.lead || null
  const allLeads = location.state?.allLeads || []
  const searchQuery = location.state?.query || ''

  const [agency,   setAgency]   = useState(null)
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeSection, setActiveSection] = useState('cover')
  const [savedReport, setSavedReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Resolved report: use live state or pre-analyzed lead data
  const r = report || lead?.ai_analysis || null

  useEffect(() => { init() }, [])

  async function init() {
    // Load agency branding
    const aid = agencyId || '00000000-0000-0000-0000-000000000099'
    const { data: ag } = await supabase.from('agencies').select('*').eq('id', aid).single()
    setAgency(ag)

    if (lead) {
      setLoading(false)
      generateReport(ag, lead)
    } else {
      setLoading(false)
    }
  }

  async function generateReport(ag, l) {
    // If the lead already has pipeline data from Scout, use it directly
    if (l.pipeline_complete && l.ai_analysis) {
      setReport(l.ai_analysis)
      setGenerating(false)
      return
    }
    setGenerating(true)
    try {
      const agName = ag?.brand_name || ag?.name || 'Your Marketing Agency'
      const prompt =
        'You are a senior marketing strategist writing a comprehensive prospect analysis report. ' +
        'Business: ' + l.name + ' | Address: ' + l.address + ' | Rating: ' + (l.rating||'unknown') + '/5' +
        ' | Reviews: ' + (l.review_count||0) + ' | Website: ' + (l.website||'none') + ' | Industry: ' + searchQuery +
        ' | Marketing gaps identified: ' + (l.gaps||[]).join(', ') +
        ' | AI summary: ' + (l.ai_summary||'') +
        '\n\nGenerate a detailed marketing opportunity report with these exact JSON keys: ' +
        '{"executiveSummary":"3 sentence compelling summary of opportunity","opportunityScore":number 0-100,' +
        '"revenueAtRisk":"estimated annual revenue being lost to competitors like $50000",' +
        '"seoScore":number 0-100,"aeoScore":number 0-100,"reputationScore":number 0-100,' +
        '"localVisibilityScore":number 0-100,' +
        '"keyFindings":["finding1","finding2","finding3","finding4","finding5"],' +
        '"seoGaps":["gap1","gap2","gap3","gap4"],' +
        '"aeoGaps":["gap1","gap2","gap3"],' +
        '"keywordOpportunities":[{"keyword":"keyword phrase","volume":"monthly searches like 880/mo","difficulty":"Easy or Medium or Hard","opportunity":"why this matters"}],' +
        '"competitorThreats":["threat1","threat2","threat3"],' +
        '"quickWins":[{"action":"specific action","impact":"High or Medium","timeline":"e.g. 2 weeks","result":"expected outcome"}],' +
        '"proposedSolutions":[{"service":"service name","description":"what it does","outcome":"specific measurable result","price":"range like $297-497/mo"}],' +
        '"roi":{"month3":"result by month 3","month6":"result by month 6","month12":"result by month 12"},' +
        '"closingStatement":"2 sentence compelling reason to act now"}. ' +
        'The agency offering these services is ' + agName + '. Be specific and data-driven. Use real business context. No generic fluff.'

      const raw = await callClaude(
        'You are an expert marketing analyst. Return ONLY a raw JSON object starting with { ending with }. No markdown.',
        prompt, 3000
      )
      let cleaned = raw.replace(/```json|```/g,'').trim()
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
      if (s !== -1 && e !== -1) {
        cleaned = cleaned.slice(s, e+1)
        try { setReport(JSON.parse(cleaned)) }
        catch(_) { setReport(JSON.parse(cleaned.replace(/,\s*}/g,'}').replace(/,\s*]/g,']'))) }
      }
    } catch(err) {
      console.error('Report generation failed:', err)
    }
    setGenerating(false)
  }

  async function saveReport() {
    if (saving || savedReport) return
    setSaving(true)
    try {
      const aid = agencyId || '00000000-0000-0000-0000-000000000099'
      const payload = {
        agency_id:        aid,
        business_name:    lead.name,
        business_address: lead.address || '',
        business_phone:   lead.phone || '',
        business_website: lead.website || '',
        business_type:    (lead.types || []).join(', '),
        google_rating:    lead.rating || null,
        google_reviews:   lead.review_count || null,
        place_id:         lead.place_id || null,
        lead_data:        lead,
        ai_analysis:      report || lead.ai_analysis || {},
        revenue_data:     lead.revenue || {},
      }
      const { data, error } = await saveProspectReport(payload)
      if (error) throw error
      setSavedReport(data)
      toast.success('Report saved — shareable link ready!')
    } catch(e) {
      toast.error('Save failed: ' + e.message)
    }
    setSaving(false)
  }

  function copyShareLink() {
    if (!savedReport) return
    const url = window.location.origin + '/r/' + savedReport.token
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    toast.success('Link copied!')
  }

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({behavior:'smooth', block:'start'})
    setActiveSection(id)
  }

  if (!lead) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <AlertCircle size={40} color={RED}/>
      <div style={{fontSize:18,fontWeight:700,color:'#111'}}>No prospect data found</div>
      <button onClick={()=>navigate('/scout')} style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
        Back to Scout
      </button>
    </div>
  )

  const agName    = agency?.brand_name || agency?.name || 'Your Agency'
  const agColor   = agency?.brand_color || RED
  const agEmail   = agency?.billing_email || 'hello@youragency.com'
  const agDomain  = agency?.brand_domain || agency?.billing_email?.split('@')[1] || 'youragency.com'
  const agLogo    = agency?.brand_logo_url

  const NAV_ITEMS = [
    {id:'cover',    label:'Cover'},
    {id:'overview', label:'Overview'},
    {id:'gaps',     label:'Gap Analysis'},
    {id:'seo',      label:'SEO & AEO'},
    {id:'solutions',label:'Our Solution'},
    {id:'roi',      label:'ROI'},
    {id:'cta',      label:'Next Steps'},
  ]

  return (
    <><Toaster position="top-right"/>
    <div style={{fontFamily:'"DM Sans", system-ui, -apple-system, sans-serif', background:'#f8f8f8', minHeight:'100vh'}}>

      {/* ── Sticky nav ── */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,.95)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e5e7eb',padding:'0 32px'}}>
        <div style={{maxWidth:1000,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {agLogo ? (
              <img src={agLogo} alt={agName} style={{height:28,objectFit:'contain'}}/>
            ) : (
              <div style={{fontSize:15,fontWeight:900,color:agColor,letterSpacing:-0.3}}>{agName}</div>
            )}
            <div style={{width:1,height:20,background:'#e5e7eb'}}/>
            <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>
              Prospect Report: <span style={{color:'#111'}}>{lead.name}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {NAV_ITEMS.map(n=>(
              <button key={n.id} onClick={()=>scrollTo(n.id)}
                style={{padding:'5px 12px',borderRadius:20,border:'none',background:activeSection===n.id?RED:'transparent',
                  color:activeSection===n.id?'#fff':'#6b7280',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                {n.label}
              </button>
            ))}
            {!savedReport ? (
              <button onClick={saveReport} disabled={saving || !r}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:20,
                  border:'none',background:r?RED:'#e5e7eb',color:r?'#fff':'#9ca3af',
                  fontSize:12,fontWeight:700,cursor:r?'pointer':'default',marginLeft:8,
                  boxShadow:r?`0 2px 8px ${RED}40`:'none',opacity:saving?.7:1}}>
                {saving
                  ? <><Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> Saving…</>
                  : <><Share2 size={11}/> Share Report</>}
              </button>
            ) : (
              <button onClick={copyShareLink}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:20,
                  border:'none',background:copied?'#16a34a':TEAL,color:'#fff',
                  fontSize:12,fontWeight:700,cursor:'pointer',marginLeft:8,transition:'background .2s'}}>
                {copied ? <><Check size={11}/> Copied!</> : <><Link size={11}/> Copy Link</>}
              </button>
            )}
            <button onClick={()=>window.print()}
              style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:20,
                border:`1.5px solid ${RED}`,background:'#fff',color:RED,
                fontSize:12,fontWeight:700,cursor:'pointer'}}>
              <Printer size={11}/> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── COVER PAGE ── */}
      <div id="cover" style={{background:`linear-gradient(135deg, ${BLACK} 0%, #1a1a2e 50%, #16213e 100%)`,
        minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',
        position:'relative',overflow:'hidden',paddingTop:56}}>

        {/* Background pattern */}
        <div style={{position:'absolute',inset:0,opacity:.04,backgroundImage:`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}/>

        {/* Red accent top bar */}
        <div style={{position:'absolute',top:56,left:0,right:0,height:3,background:`linear-gradient(90deg,${RED},${TEAL},${RED})`,backgroundSize:'200% 100%',animation:'slide 3s linear infinite'}}/>

        <div style={{maxWidth:1000,margin:'0 auto',padding:'0 48px',width:'100%'}}>

          {/* Agency brand */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:64}}>
            {agLogo ? (
              <img src={agLogo} alt={agName} style={{height:40,objectFit:'contain',filter:'brightness(0) invert(1)'}}/>
            ) : (
              <div style={{fontSize:20,fontWeight:900,color:'#fff',letterSpacing:-0.5}}>{agName}</div>
            )}
            <div style={{width:1,height:24,background:'rgba(255,255,255,.2)'}}/>
            <div style={{fontSize:13,color:'rgba(255,255,255,.5)',fontWeight:600}}>Prospect Intelligence Report</div>
          </div>

          {/* Business name + score */}
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:48,alignItems:'center'}}>
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(234,39,41,.15)',
                border:'1px solid rgba(234,39,41,.3)',borderRadius:20,padding:'5px 14px',marginBottom:20}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:RED,animation:'pulse 1.5s infinite'}}/>
                <span style={{fontSize:12,fontWeight:800,color:RED,textTransform:'uppercase',letterSpacing:'.08em'}}>
                  Live Intelligence Report
                </span>
              </div>

              <h1 style={{fontSize:56,fontWeight:900,color:'#fff',lineHeight:1.05,letterSpacing:-2,margin:'0 0 16px'}}>
                {lead.name}
              </h1>

              <div style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:28}}>
                {lead.address && (
                  <div style={{display:'flex',alignItems:'center',gap:7,fontSize:14,color:'rgba(255,255,255,.55)'}}>
                    <MapPin size={14}/> {lead.address}
                  </div>
                )}
                {lead.phone && (
                  <div style={{display:'flex',alignItems:'center',gap:7,fontSize:14,color:'rgba(255,255,255,.55)'}}>
                    <Phone size={14}/> {lead.phone}
                  </div>
                )}
                {lead.website && (
                  <div style={{display:'flex',alignItems:'center',gap:7,fontSize:14,color:TEAL}}>
                    <Globe size={14}/> {lead.website.replace(/^https?:\/\//,'')}
                  </div>
                )}
              </div>

              <div style={{display:'flex',gap:20}}>
                {lead.rating > 0 && (
                  <div style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',
                    borderRadius:12,padding:'14px 20px'}}>
                    <div style={{fontSize:28,fontWeight:900,color:'#f59e0b',letterSpacing:-1}}>{lead.rating}</div>
                    <Stars rating={lead.rating}/>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.4)',marginTop:4}}>{(lead.review_count||0).toLocaleString()} reviews</div>
                  </div>
                )}
                <div style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',
                  borderRadius:12,padding:'14px 20px'}}>
                  <div style={{fontSize:28,fontWeight:900,color:RED,letterSpacing:-1}}>{(lead.gaps||[]).length}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:4}}>Marketing gaps</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>identified by AI</div>
                </div>
                {(report||lead.ai_analysis) && (
                  <div style={{background:'rgba(255,255,255,.06)',border:`1px solid ${RED}40`,
                    borderRadius:12,padding:'14px 20px'}}>
                    <div style={{fontSize:28,fontWeight:900,color:TEAL,letterSpacing:-1}}>{(report||lead.ai_analysis).opportunityScore}</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:4}}>Opportunity score</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>/100</div>
                  </div>
                )}
                {lead.revenue && (
                  <div style={{background:'rgba(255,255,255,.06)',border:`1px solid ${TEAL}40`,
                    borderRadius:12,padding:'14px 20px'}}>
                    <div style={{fontSize:22,fontWeight:900,color:'#fff',letterSpacing:-1}}>${Math.round(lead.revenue.annualRevenueAtRisk/1000)}K</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:4}}>Revenue at risk</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.3)'}}>per year</div>
                  </div>
                )}
              </div>
            </div>

            {/* Score ring */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{position:'relative',width:140,height:140}}>
                <Ring score={report?.opportunityScore||lead.score||50} size={140} stroke={12}/>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:-2}}>
                    {report?.opportunityScore||lead.score||50}
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.4)',textTransform:'uppercase',letterSpacing:'.06em'}}>Score</div>
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:
                (report?.opportunityScore||lead.score||50)>=75?'#4ade80':
                (report?.opportunityScore||lead.score||50)>=50?TEAL:'#fbbf24',
                textAlign:'center'}}>
                {(report?.opportunityScore||lead.score||50)>=75?'High opportunity':
                 (report?.opportunityScore||lead.score||50)>=50?'Good opportunity':'Moderate opportunity'}
              </div>
            </div>
          </div>

          {/* Report meta */}
          <div style={{borderTop:'1px solid rgba(255,255,255,.08)',marginTop:56,paddingTop:28,
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:13,color:'rgba(255,255,255,.3)'}}>
              Prepared by {agName} · {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
            </div>
            <div style={{display:'flex',gap:16,fontSize:13,color:'rgba(255,255,255,.4)'}}>
              {agEmail && <span>{agEmail}</span>}
              {agDomain && <span>www.{agDomain}</span>}
            </div>
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:48,color:'rgba(255,255,255,.2)'}}>
          <ChevronDown size={24} style={{animation:'bounce 2s infinite'}}/>
        </div>
      </div>

      {/* ── AI THINKING ── */}
      {generating && (
        <div style={{background:'#f8f8f8',padding:'32px 48px'}}>
          <div style={{maxWidth:1000,margin:'0 auto'}}>
            <AIThinkingBox active={generating} task='analysis' label='Building your comprehensive prospect report'/>
          </div>
        </div>
      )}

      {r && (<>

        {/* ── OVERVIEW ── */}
        <Section id="overview" dark>
          <SectionLabel text="Executive Overview" light/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'start'}}>
            <div>
              <h2 style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:-1,marginBottom:20,lineHeight:1.15}}>
                The opportunity hiding in plain sight
              </h2>
              <p style={{fontSize:16,color:'rgba(255,255,255,.65)',lineHeight:1.8,marginBottom:24}}>
                {r.executiveSummary}
              </p>
              {r.revenueAtRisk && (
                <div style={{background:`linear-gradient(135deg,${RED}20,${RED}08)`,border:`1px solid ${RED}40`,
                  borderRadius:14,padding:'20px 24px'}}>
                  <div style={{fontSize:12,fontWeight:800,color:RED,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                    Estimated revenue at risk
                  </div>
                  <div style={{fontSize:32,fontWeight:900,color:'#fff',letterSpacing:-1}}>{r.revenueAtRisk}</div>
                  <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginTop:4}}>being lost to competitors annually</div>
                </div>
              )}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[
                {label:'SEO Score',         value:r.seoScore,           color:RED},
                {label:'AEO Score',          value:r.aeoScore,           color:TEAL},
                {label:'Reputation Score',   value:r.reputationScore,    color:'#f59e0b'},
                {label:'Local Visibility',   value:r.localVisibilityScore,color:'#8b5cf6'},
              ].map(m=>(
                <div key={m.label} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',
                  borderRadius:14,padding:'20px',textAlign:'center'}}>
                  <div style={{position:'relative',width:80,height:80,margin:'0 auto 12px'}}>
                    <Ring score={m.value} size={80} stroke={7}/>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:20,fontWeight:900,color:'#fff'}}>{m.value}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,.5)'}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key findings */}
          {r.keyFindings?.length > 0 && (
            <div style={{marginTop:48,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {r.keyFindings.slice(0,6).map((f,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',
                  borderRadius:12,padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{width:24,height:24,borderRadius:'50%',background:RED,display:'flex',
                    alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#fff',flexShrink:0,marginTop:1}}>
                    {i+1}
                  </div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,.7)',lineHeight:1.6}}>{f}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── GAP ANALYSIS ── */}
        <Section id="gaps">
          <SectionLabel text="Gap Analysis"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48}}>
            <div>
              <h2 style={{fontSize:34,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
                Where {lead.name.split(' ')[0]} is losing ground
              </h2>
              <p style={{fontSize:15,color:'#374151',marginBottom:32,lineHeight:1.7}}>
                Our analysis identified {(lead.gaps||[]).length + (r.seoGaps?.length||0)} critical gaps that are costing them customers and revenue every day.
              </p>

              {/* Gap bars */}
              <div style={{background:'#f9fafb',borderRadius:16,padding:'24px'}}>
                <ScoreBar label="Online Visibility"       value={100-(r.localVisibilityScore||50)} color={RED}/>
                <ScoreBar label="Reputation Management"   value={100-(r.reputationScore||60)}      color={RED}/>
                <ScoreBar label="SEO Performance"         value={100-(r.seoScore||55)}              color='#f59e0b'/>
                <ScoreBar label="AEO / AI Search Readiness" value={100-(r.aeoScore||40)}           color='#8b5cf6'/>
                <ScoreBar label="Social & Ad Presence"
                  value={lead.social_active||lead.running_ads?35:75} color={TEAL}/>
              </div>
            </div>

            <div>
              {/* Current gaps from data */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:800,color:RED,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>
                  Identified marketing gaps
                </div>
                {(lead.gaps||[]).map((g,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 14px',
                    background:`${RED}08`,borderRadius:10,marginBottom:8,borderLeft:`3px solid ${RED}`}}>
                    <AlertCircle size={15} color={RED} style={{flexShrink:0,marginTop:1}}/>
                    <span style={{fontSize:14,color:'#374151',fontWeight:600}}>{g}</span>
                  </div>
                ))}
              </div>

              {/* Tech stack gaps */}
              {lead.website_analysis?.tech && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:800,color:'#374151',textTransform:'uppercase',
                    letterSpacing:'.07em',marginBottom:12}}>Tech stack audit</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {label:'CMS', value: lead.cms||'Unknown', good: !!lead.cms},
                      {label:'SEO Plugin', value: lead.seo_plugin||'None detected', good: !!lead.seo_plugin},
                      {label:'Analytics', value: lead.has_analytics?'Connected':'Not detected', good: lead.has_analytics},
                      {label:'CRM', value: lead.has_crm?'Connected':'None detected', good: lead.has_crm},
                      {label:'Call Tracking', value: lead.has_call_tracking?'Active':'None detected', good: lead.has_call_tracking},
                      {label:'Schema Markup', value: lead.has_schema?(lead.has_local_schema?'LocalBusiness schema':'Generic schema'):'None', good: lead.has_local_schema},
                      {label:'Facebook Pixel', value: lead.has_pixel?'Active':'None', good: lead.has_pixel},
                      {label:'Booking Software', value: lead.booking_software||'None detected', good: !!lead.booking_software},
                    ].map(item=>(
                      <div key={item.label} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
                        background:item.good?'#f0fdf4':'#fef2f2',borderRadius:9}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:item.good?'#16a34a':RED,flexShrink:0}}/>
                        <div>
                          <div style={{fontSize:11,fontWeight:800,color:'#374151'}}>{item.label}</div>
                          <div style={{fontSize:12,color:item.good?'#16a34a':'#374151'}}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {lead.sitemap_pages > 0 && (
                    <div style={{marginTop:10,padding:'10px 14px',background:'#f9fafb',borderRadius:9,fontSize:13,color:'#374151'}}>
                      Sitemap: <strong>{lead.sitemap_pages} pages indexed</strong>
                      {lead.sitemap_pages < 10 ? ' — very thin content footprint' : 
                       lead.sitemap_pages < 30 ? ' — moderate content depth' : ' — good content coverage'}
                    </div>
                  )}
                </div>
              )}
              {/* Competitor threats */}
              {report?.competitorThreats?.length > 0 && (
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>
                    Competitive threats
                  </div>
                  {r.competitorThreats.map((t,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',
                      background:'#fff7ed',borderRadius:10,marginBottom:7,borderLeft:'3px solid #f59e0b'}}>
                      <Target size={14} color="#d97706" style={{flexShrink:0,marginTop:1}}/>
                      <span style={{fontSize:14,color:'#374151'}}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── SEO & AEO ── */}
        <Section id="seo" style={{background:'#f8f8f8'}}>
          <SectionLabel text="SEO & AEO Analysis"/>
          <h2 style={{fontSize:34,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
            Keyword & AI search opportunities
          </h2>
          <p style={{fontSize:15,color:'#374151',marginBottom:36,lineHeight:1.7}}>
            These are the searches their ideal customers are making right now — and {lead.name} isn't showing up.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:36}}>
            {/* SEO gaps */}
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <TrendingUp size={18} color={RED}/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>SEO Gaps</div>
              </div>
              {(r.seoGaps||[]).map((g,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',
                  borderBottom:i<(r.seoGaps||[]).length-1?'1px solid #f3f4f6':'none'}}>
                  <div style={{width:20,height:20,borderRadius:6,background:`${RED}15`,display:'flex',
                    alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:900,color:RED}}>{i+1}</span>
                  </div>
                  <span style={{fontSize:14,color:'#374151',fontWeight:500}}>{g}</span>
                </div>
              ))}
            </div>

            {/* AEO gaps */}
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <Sparkles size={18} color='#8b5cf6'/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>AEO / AI Search Gaps</div>
                <span style={{fontSize:10,fontWeight:800,color:'#8b5cf6',background:'#f5f3ff',
                  padding:'2px 8px',borderRadius:20,border:'1px solid #e9d5ff'}}>ChatGPT · Perplexity · Gemini</span>
              </div>
              {(r.aeoGaps||[]).map((g,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',
                  borderBottom:i<(r.aeoGaps||[]).length-1?'1px solid #f3f4f6':'none'}}>
                  <div style={{width:20,height:20,borderRadius:6,background:'#f5f3ff',display:'flex',
                    alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Sparkles size={10} color='#8b5cf6'/>
                  </div>
                  <span style={{fontSize:14,color:'#374151',fontWeight:500}}>{g}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword opportunities table */}
          {r.keywordOpportunities?.length > 0 && (
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
              <div style={{padding:'18px 24px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:10}}>
                <Search size={16} color={RED}/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Keyword Opportunities</div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f9fafb'}}>
                    {['Keyword','Monthly Searches','Difficulty','Why It Matters'].map(h=>(
                      <th key={h} style={{padding:'11px 20px',fontSize:12,fontWeight:800,color:'#111',
                        textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.keywordOpportunities.slice(0,6).map((kw,i)=>(
                    <tr key={i} style={{borderBottom:i<r.keywordOpportunities.length-1?'1px solid #f9fafb':'none'}}>
                      <td style={{padding:'14px 20px',fontSize:14,fontWeight:800,color:'#111'}}>{kw.keyword}</td>
                      <td style={{padding:'14px 20px',fontSize:14,fontWeight:700,color:RED}}>{kw.volume}</td>
                      <td style={{padding:'14px 20px'}}>
                        <span style={{fontSize:12,fontWeight:800,padding:'3px 10px',borderRadius:20,
                          background:kw.difficulty==='Easy'?'#f0fdf4':kw.difficulty==='Hard'?'#fef2f2':'#fffbeb',
                          color:kw.difficulty==='Easy'?'#16a34a':kw.difficulty==='Hard'?RED:'#d97706'}}>
                          {kw.difficulty}
                        </span>
                      </td>
                      <td style={{padding:'14px 20px',fontSize:13,color:'#374151'}}>{kw.opportunity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── SOLUTIONS ── */}
        <Section id="solutions" dark>
          <SectionLabel text="Our Solution" light/>
          <h2 style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:-1,marginBottom:8}}>
            How {agName} closes every gap
          </h2>
          <p style={{fontSize:15,color:'rgba(255,255,255,.55)',marginBottom:40,lineHeight:1.7}}>
            A tailored program designed specifically for {lead.name}'s situation.
          </p>

          {/* Quick wins */}
          {r.quickWins?.length > 0 && (
            <div style={{marginBottom:40}}>
              <div style={{fontSize:13,fontWeight:800,color:TEAL,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>
                Quick wins — first 30 days
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                {r.quickWins.map((w,i)=>(
                  <div key={i} style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',
                    borderRadius:14,padding:'18px 20px',display:'grid',gridTemplateColumns:'auto 1fr',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:TEAL+'20',border:`1px solid ${TEAL}40`,
                      display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Zap size={16} color={TEAL}/>
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:800,color:'#fff',marginBottom:4}}>{w.action}</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:11,fontWeight:700,color:w.impact==='High'?RED:TEAL,
                          background:w.impact==='High'?`${RED}20`:`${TEAL}20`,padding:'1px 8px',borderRadius:20}}>
                          {w.impact} impact
                        </span>
                        <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>{w.timeline}</span>
                      </div>
                      <div style={{fontSize:13,color:'rgba(255,255,255,.5)',marginTop:5}}>{w.result}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed services */}
          {r.proposedSolutions?.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {r.proposedSolutions.map((s,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,.04)',border:`1px solid ${i===0?RED+'60':'rgba(255,255,255,.08)'}`,
                  borderRadius:16,padding:'22px',position:'relative',overflow:'hidden'}}>
                  {i===0 && <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:RED}}/>}
                  <div style={{fontSize:13,fontWeight:800,color:i===0?RED:TEAL,marginBottom:8}}>{s.service}</div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,.65)',lineHeight:1.6,marginBottom:12}}>{s.description}</div>
                  <div style={{fontSize:13,color:'rgba(255,255,255,.45)',marginBottom:14,
                    paddingTop:12,borderTop:'1px solid rgba(255,255,255,.07)'}}>
                    Expected: <span style={{color:'rgba(255,255,255,.7)',fontWeight:600}}>{s.outcome}</span>
                  </div>
                  <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>{s.price}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── REVENUE MODEL ── */}
        {lead.revenue && (
          <Section id="roi" style={{background:'#f8f8f8'}}>
            <SectionLabel text="Revenue Opportunity Model"/>
            <h2 style={{fontSize:34,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
              The real numbers
            </h2>
            <p style={{fontSize:15,color:'#374151',lineHeight:1.7,marginBottom:32}}>
              Based on real Google data, competitor benchmarks, and industry averages for {searchQuery||'this category'}.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
              {[
                {label:'Current monthly leads (est.)', value:lead.revenue.currentMonthlyLeads, suffix:'', color:RED},
                {label:'Potential monthly leads', value:lead.revenue.optimizedMonthlyLeads, suffix:'', color:TEAL},
                {label:'Avg job value', value:'$'+lead.revenue.avgJobValue.toLocaleString(), suffix:'', color:'#f59e0b'},
                {label:'Annual revenue at risk', value:'$'+Math.round(lead.revenue.annualRevenueAtRisk/1000)+'K', suffix:'', color:RED},
              ].map(m=>(
                <div key={m.label} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'20px',textAlign:'center'}}>
                  <div style={{fontSize:28,fontWeight:900,color:m.color,letterSpacing:-1}}>{m.value}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginTop:6}}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:16,border:`1.5px solid ${TEAL}40`,padding:'24px',
              display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,textAlign:'center'}}>
              {[
                {label:'Month 3 projection', value:'$'+Math.round(lead.revenue.monthlyRevenueGain*0.4).toLocaleString()+'/mo', sub:'additional revenue'},
                {label:'Month 6 projection', value:'$'+Math.round(lead.revenue.monthlyRevenueGain*0.75).toLocaleString()+'/mo', sub:'growing momentum'},
                {label:'Month 12 projection', value:'$'+lead.revenue.monthlyRevenueGain.toLocaleString()+'/mo', sub:'full program results'},
              ].map(m=>(
                <div key={m.label}>
                  <div style={{fontSize:26,fontWeight:900,color:'#111'}}>{m.value}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginTop:4}}>{m.label}</div>
                  <div style={{fontSize:12,color:'#9ca3af'}}>{m.sub}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── ROI ── */}
        <Section id="roi">
          <SectionLabel text="Return on Investment"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
            <div>
              <h2 style={{fontSize:34,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
                What success looks like
              </h2>
              <p style={{fontSize:15,color:'#374151',lineHeight:1.7,marginBottom:32}}>
                Based on comparable businesses in {searchQuery||'this industry'}, here's what a structured marketing program delivers.
              </p>
              {r.roi && Object.entries(r.roi).map(([k,v],i)=>(
                <div key={k} style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:18}}>
                  <div style={{width:44,height:44,borderRadius:12,
                    background:i===0?`${RED}15`:i===1?`${TEAL}15`:'#f3f4f6',
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:900,color:i===0?RED:i===1?TEAL:'#374151'}}>
                      {k.replace('month','M')}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
                      letterSpacing:'.07em',marginBottom:3}}>{k.replace('month','Month ')}</div>
                    <div style={{fontSize:15,fontWeight:700,color:'#111'}}>{v}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual timeline */}
            <div style={{background:'#f9fafb',borderRadius:20,padding:'32px'}}>
              <div style={{fontSize:13,fontWeight:800,color:'#374151',marginBottom:20,textTransform:'uppercase',letterSpacing:'.06em'}}>
                Growth trajectory
              </div>
              {[
                {label:'Month 1-2', desc:'Foundation: GBP, reviews, SEO setup', pct:15, color:RED},
                {label:'Month 3',   desc:'Visibility improving, leads starting', pct:35, color:'#f59e0b'},
                {label:'Month 6',   desc:'Consistent lead flow, ranking gains',  pct:65, color:TEAL},
                {label:'Month 12',  desc:'Market leader position in local search',pct:90, color:'#16a34a'},
              ].map((m,i)=>(
                <div key={i} style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <div>
                      <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{m.label}</span>
                      <span style={{fontSize:12,color:'#374151',marginLeft:8}}>{m.desc}</span>
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:m.color}}>{m.pct}%</span>
                  </div>
                  <div style={{height:10,background:'#e5e7eb',borderRadius:5,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${m.pct}%`,background:m.color,borderRadius:5,
                      transition:'width 1.2s cubic-bezier(.22,1,.36,1)'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── CTA ── */}
        <Section id="cta" dark style={{background:`linear-gradient(135deg, ${BLACK}, #1a0a0a)`}}>
          <div style={{textAlign:'center',maxWidth:680,margin:'0 auto'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,background:`${RED}20`,
              border:`1px solid ${RED}40`,borderRadius:20,padding:'5px 16px',marginBottom:24}}>
              <Award size={13} color={RED}/>
              <span style={{fontSize:12,fontWeight:800,color:RED,textTransform:'uppercase',letterSpacing:'.08em'}}>
                Ready to grow
              </span>
            </div>

            <h2 style={{fontSize:44,fontWeight:900,color:'#fff',letterSpacing:-1.5,lineHeight:1.1,marginBottom:20}}>
              Every day without action is a day competitors get stronger.
            </h2>

            <p style={{fontSize:16,color:'rgba(255,255,255,.55)',lineHeight:1.8,marginBottom:40}}>
              {r.closingStatement}
            </p>

            {/* Agency contact */}
            <div style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',
              borderRadius:20,padding:'32px',marginBottom:36}}>
              <div style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:4}}>{agName}</div>
              <div style={{display:'flex',justifyContent:'center',gap:24,flexWrap:'wrap',marginTop:12}}>
                {agEmail && (
                  <a href={'mailto:'+agEmail} style={{display:'flex',alignItems:'center',gap:7,fontSize:14,color:TEAL,textDecoration:'none',fontWeight:600}}>
                    <Mail size={14}/>{agEmail}
                  </a>
                )}
                {agDomain && (
                  <a href={'https://'+agDomain} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',gap:7,fontSize:14,color:TEAL,textDecoration:'none',fontWeight:600}}>
                    <Globe size={14}/>www.{agDomain}
                  </a>
                )}
              </div>
            </div>

            <div style={{display:'flex',gap:14,justifyContent:'center'}}>
              <a href={'mailto:'+agEmail+'?subject=Ready to grow - '+lead.name}
                style={{display:'inline-flex',alignItems:'center',gap:8,padding:'16px 36px',borderRadius:14,
                  background:RED,color:'#fff',fontSize:16,fontWeight:800,textDecoration:'none',
                  boxShadow:`0 8px 32px ${RED}50`}}>
                Get My Free Strategy Call <ArrowRight size={16}/>
              </a>
              <button onClick={()=>window.print()}
                style={{display:'inline-flex',alignItems:'center',gap:8,padding:'16px 28px',borderRadius:14,
                  border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'rgba(255,255,255,.7)',
                  fontSize:15,fontWeight:700,cursor:'pointer'}}>
                <Download size={15}/> Save Report
              </button>
            </div>

            <div style={{marginTop:32,fontSize:13,color:'rgba(255,255,255,.2)'}}>
              Report prepared by {agName} · AI-powered by Moose · {new Date().toLocaleDateString()}
            </div>
          </div>
        </Section>

      </>)}

      {/* Loading state if no report yet */}
      {!report && !generating && (
        <Section id="overview">
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <Sparkles size={40} color={RED} style={{margin:'0 auto 16px'}}/>
            <div style={{fontSize:18,fontWeight:800,color:'#111',marginBottom:8}}>Report not generated yet</div>
            <button onClick={()=>generateReport(agency,lead)}
              style={{padding:'11px 24px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
              Generate Report
            </button>
          </div>
        </Section>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slide { from{background-position:0% 0%} to{background-position:200% 0%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
        @media print {
          .no-print, nav { display:none!important; }
          body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          #cover { min-height:100vh; page-break-after:always; }
          #overview, #gaps, #seo, #solutions, #roi, #cta { page-break-inside:avoid; }
        }

      `}</style>
    </div>
    </>
  )
}
