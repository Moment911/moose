"use client";
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Star,
  Globe,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  AlertCircle,
  Search,
  ArrowRight,
  Target,
  BarChart2,
  Zap,
  Shield,
  ChevronDown,
  ExternalLink,
  Award,
  Users,
  DollarSign,
  Sparkles,
  Loader2,
  Download,
  Share2,
  ChevronRight,
  Link,
  Check,
  Printer,
  CheckCircle,
  XCircle,
  FileText,
  Clock
} from 'lucide-react'
import { callClaude } from '../../lib/ai'
import { saveProspectReport, updateProspectReport } from '../../lib/supabase'
import { runLeadPipeline, getIndustryBenchmark, calcRevenueImpact } from '../../lib/scoutPipeline'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import AIThinkingBox from '../../components/AIThinkingBox'
import toast, { Toaster } from 'react-hot-toast'

const RED   = '#E6007E'
const TEAL  = '#00C2CB'
const BLACK = '#0a0a0a'

// ── Animated score ring ───────────────────────────────────────────────────────
function Ring({ score=0, size=110, stroke=10 }) {
  const r = (size-stroke)/2, circ = 2*Math.PI*r
  const color = score>=75?'#16a34a':score>=50?TEAL:RED
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ-(score/100)*circ} strokeLinecap="round"
        style={{transition:'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)'}}/>
    </svg>
  )
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <span style={{display:'inline-flex',gap:2}}>
      {[1,2,3,4,5].map(i=>(
        <svg key={i} width="13" height="13" viewBox="0 0 24 24"
          fill={i<=Math.round(rating)?'#f59e0b':'#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color=RED }) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value}%</span>
      </div>
      <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${value}%`,background:color,borderRadius:4,
          transition:'width 1.2s cubic-bezier(.22,1,.36,1)',transitionDelay:'.3s'}}/>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, children, dark=false, style={} }) {
  return (
    <div id={id} style={{background:dark?BLACK:'#fff',padding:'72px 0',...style}}>
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
      <span style={{fontSize:13,fontWeight:800,
        color:light?'rgba(255,255,255,.5)':RED,
        textTransform:'uppercase',letterSpacing:'.1em'}}>{text}</span>
    </div>
  )
}

// ── Pipeline progress UI ──────────────────────────────────────────────────────
function PipelineProgress({ steps }) {
  return (
    <div style={{background:BLACK,borderRadius:20,padding:'28px 32px',margin:'0 0 24px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <TrendingUp size={18} color={TEAL}/>
        <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>
          Building your intelligence report
        </div>
        <div style={{marginLeft:'auto',fontSize:13,color:'#999999'}}>
          {steps.filter(s=>s.done).length}/{steps.length} steps
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {steps.map((step, i) => (
          <div key={step.key} style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
              display:'flex',alignItems:'center',justifyContent:'center',
              background: step.done ? '#16a34a' : step.active ? TEAL : 'rgba(255,255,255,.1)',
              transition:'background .3s'}}>
              {step.done
                ? <Check size={13} color="#fff"/>
                : step.active
                  ? <Loader2 size={13} color="#fff" style={{animation:'spin 1s linear infinite'}}/>
                  : <span style={{fontSize:13,fontWeight:800,color:'#999999'}}>{i+1}</span>
              }
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,
                color: step.done ? '#fff' : step.active ? TEAL : 'rgba(255,255,255,.3)',
                transition:'color .3s'}}>
                {step.label}
              </div>
              {step.active && step.detail && (
                <div style={{fontSize:13,color:'#999999',marginTop:2}}>{step.detail}</div>
              )}
              {step.done && step.result && (
                <div style={{fontSize:13,color:'#999999',marginTop:2}}>{step.result}</div>
              )}
            </div>
            {step.done && (
              <div style={{fontSize:13,fontWeight:700,color:'#16a34a',background:'#16a34a20',
                padding:'2px 8px',borderRadius:20}}>Done</div>
            )}
          </div>
        ))}
      </div>
      {/* Overall progress bar */}
      <div style={{marginTop:20,height:4,background:'rgba(255,255,255,.1)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',background:`linear-gradient(90deg,${TEAL},${RED})`,borderRadius:2,
          width: `${Math.round(steps.filter(s=>s.done).length/steps.length*100)}%`,
          transition:'width .5s ease'}}>
        </div>
      </div>
    </div>
  )
}

const INITIAL_STEPS = [
  { key:'gmb',     label:'Fetching Google Maps data',           detail:'Rating, reviews, hours, business details', done:false, active:false, result:'' },
  { key:'website', label:'Scanning website source code',        detail:'Tech stack, SEO signals, plugins, integrations', done:false, active:false, result:'' },
  { key:'sitemap', label:'Analyzing sitemap & SEO structure',   detail:'Page count, content strategy, URL patterns', done:false, active:false, result:'' },
  { key:'revenue', label:'Calculating revenue opportunity',      detail:'Industry benchmarks, competitor comparison', done:false, active:false, result:'' },
  { key:'claude',  label:'Running AI competitive analysis',      detail:'Gap scoring, keyword opportunities, recommendations', done:false, active:false, result:'' },
]

// ══════════════════════════════════════════════════════════════════════════════
export default function ProspectReportPage() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { agencyId } = useAuth()

  const leadFromState = location.state?.lead || null
  const allLeads       = location.state?.allLeads || []
  const searchQuery    = location.state?.query || ''
  const searchId       = location.state?.searchId || null
  const searchLocation = location.state?.searchLocation || ''

  const [agency,       setAgency]       = useState(null)
  const [enrichedLead, setEnrichedLead] = useState(null)  // lead with full pipeline data
  const [report,       setReport]       = useState(null)  // Claude AI analysis
  const [loading,      setLoading]      = useState(true)
  const [pipelineDone, setPipelineDone] = useState(false)
  const [steps,        setSteps]        = useState(INITIAL_STEPS)
  const [activeSection,setActiveSection]= useState('cover')
  const [savedReport,  setSavedReport]  = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [copied,       setCopied]       = useState(false)

  const r = report  // resolved AI analysis

  useEffect(() => { init() }, [])

  function updateStep(key, patch) {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s))
  }

  async function init() {
    const aid = agencyId || '00000000-0000-0000-0000-000000000099'
    const { data: ag } = await supabase.from('agencies').select('*').eq('id', aid).single()
    setAgency(ag)
    setLoading(false)

    if (!leadFromState) return

    // If pipeline already complete from ScoutPage background run, use it
    if (leadFromState.pipeline_complete && leadFromState.ai_analysis) {
      setEnrichedLead(leadFromState)
      setReport(leadFromState.ai_analysis)
      // Mark all steps done
      setSteps(INITIAL_STEPS.map(s => ({
        ...s, done: true, active: false,
        result: getStepResult(s.key, leadFromState)
      })))
      setPipelineDone(true)
      return
    }

    // Run the full pipeline with live step updates
    await runFullPipeline(ag, leadFromState)
  }

  function getStepResult(key, lead) {
    if (key === 'gmb')     return `${lead.review_count||0} reviews · ${lead.rating||0}★`
    if (key === 'website') {
      const tech = lead.website_analysis?.tech || {}
      const found = Object.values(tech).flat()
      return found.length ? found.slice(0,3).join(', ') : (lead.website ? 'Scanned — no major tech detected' : 'No website')
    }
    if (key === 'sitemap')  return lead.sitemap_pages ? `${lead.sitemap_pages} pages found` : 'No sitemap detected'
    if (key === 'revenue')  return lead.revenue ? `$${Math.round((lead.revenue.annualRevenueAtRisk||0)/1000)}K revenue at risk` : 'Calculated'
    if (key === 'claude')   return `Opportunity score: ${lead.ai_analysis?.opportunityScore||0}/100`
    return 'Complete'
  }

  async function runFullPipeline(ag, lead) {
    // Step 1: GMB Details
    updateStep('gmb', { active: true })
    
    const enriched = await runLeadPipeline(
      lead,
      allLeads.filter(x => x.id !== lead.id),
      searchQuery,
      (msg, pct) => {
        // Map pipeline progress to steps
        if (pct <= 20)       updateStep('gmb',     { active:true,  detail: msg })
        else if (pct <= 40)  { updateStep('gmb', { done:true, active:false, result: getStepResult('gmb', lead) }); updateStep('website', { active:true, detail: msg }) }
        else if (pct <= 55)  { updateStep('website', { done:true, active:false }); updateStep('sitemap', { active:true, detail: msg }) }
        else if (pct <= 65)  { updateStep('sitemap', { done:true, active:false }); updateStep('revenue', { active:true, detail: msg }) }
        else if (pct <= 75)  { updateStep('revenue', { done:true, active:false }); updateStep('claude', { active:true, detail: msg }) }
      }
    )

    // Compute results for step labels
    const wa   = enriched.website_analysis || {}
    const tech = wa.tech || {}
    const techFound = Object.values(tech).flat()
    
    updateStep('gmb',     { done:true, active:false, result: `${enriched.review_count||0} reviews · ${enriched.rating||0}★ · ${enriched.hours?'hours verified':''}` })
    updateStep('website', { done:true, active:false, result: techFound.length ? techFound.slice(0,4).join(', ') : (enriched.website ? 'Scanned — clean stack' : 'No website to scan') })
    updateStep('sitemap', { done:true, active:false, result: enriched.sitemap_pages ? `${enriched.sitemap_pages} pages indexed` : 'No sitemap found' })
    updateStep('revenue', { done:true, active:false, result: enriched.revenue ? `$${Math.round((enriched.revenue.annualRevenueAtRisk||0)/1000)}K revenue at risk identified` : 'Benchmarks calculated' })
    updateStep('claude',  { done:true, active:false, result: enriched.ai_analysis ? `Score: ${enriched.ai_analysis.opportunityScore||0}/100` : 'Analysis complete' })

    setEnrichedLead(enriched)
    if (enriched.ai_analysis) setReport(enriched.ai_analysis)
    setPipelineDone(true)
  }

  async function saveReport() {
    if (saving || savedReport || !pipelineDone) return
    setSaving(true)
    try {
      const aid  = agencyId || '00000000-0000-0000-0000-000000000099'
      const lead = enrichedLead || leadFromState
      const payload = {
        agency_id:        aid,
        business_name:    lead.name,
        business_address: lead.address || '',
        business_phone:   lead.phone   || '',
        business_website: lead.website || '',
        business_type:    (lead.types  || []).join(', '),
        google_rating:    lead.rating  || null,
        google_reviews:   lead.review_count || null,
        place_id:         lead.place_id || null,
        search_id:        searchId,
        search_query:     searchQuery,
        search_location:  searchLocation,
        lead_data:        lead,           // full enriched lead with website_analysis
        ai_analysis:      report || {},   // full Claude analysis
        revenue_data:     lead.revenue || {},
      }
      const { data, error } = await saveProspectReport(payload)
      if (error) throw error
      setSavedReport(data)
      toast.success('Report saved — all real data included!')
    } catch(e) { toast.error('Save failed: ' + e.message) }
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
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' })
    setActiveSection(id)
  }

  if (!leadFromState) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',flexDirection:'column',gap:16}}>
      <AlertCircle size={40} color={RED}/>
      <div style={{fontSize:18,fontWeight:700,color:'#111'}}>No prospect data found</div>
      <button onClick={()=>navigate('/scout')}
        style={{padding:'10px 24px',borderRadius:10,border:'none',
          background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
        Back to Scout
      </button>
    </div>
  )

  const lead    = enrichedLead || leadFromState
  const agName  = agency?.brand_name || agency?.name || 'Your Agency'
  const agColor = agency?.brand_color || RED
  const agEmail = agency?.billing_email || ''
  const agDomain= agency?.brand_domain  || agEmail?.split('@')[1] || ''
  const agLogo  = agency?.brand_logo_url

  const NAV_ITEMS = [
    {id:'cover',     label:'Cover'},
    {id:'overview',  label:'Overview'},
    {id:'gaps',      label:'Gap Analysis'},
    {id:'seo',       label:'SEO & AEO'},
    {id:'solutions', label:'Solutions'},
    {id:'roi',       label:'ROI'},
    {id:'cta',       label:'Next Steps'},
  ]

  return (
    <><Toaster position="top-right"/>
    <div style={{fontFamily:'"DM Sans",system-ui,sans-serif',background:'#f8f8f8',minHeight:'100vh'}}>

      {/* ── Sticky nav ── */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:100,
        background:'rgba(255,255,255,.96)',backdropFilter:'blur(12px)',
        borderBottom:'1px solid #e5e7eb',padding:'0 32px'}}>
        <div style={{maxWidth:1000,margin:'0 auto',display:'flex',alignItems:'center',
          justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            {agLogo
              ? <img src={agLogo} alt={agName} style={{height:26,objectFit:'contain'}}/>
              : <div style={{fontSize:15,fontWeight:900,color:agColor}}>{agName}</div>
            }
            <div style={{width:1,height:18,background:'#e5e7eb'}}/>
            <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>
              Prospect Report: <span style={{color:'#111'}}>{lead.name}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            {NAV_ITEMS.map(n=>(
              <button key={n.id} onClick={()=>scrollTo(n.id)}
                style={{padding:'5px 12px',borderRadius:20,border:'none',
                  background:activeSection===n.id?RED:'transparent',
                  color:activeSection===n.id?'#fff':'#6b7280',
                  fontSize:13,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                {n.label}
              </button>
            ))}
            {!savedReport ? (
              <button onClick={saveReport}
                disabled={saving || !pipelineDone}
                title={!pipelineDone ? 'Wait for pipeline to complete' : ''}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',
                  borderRadius:20,border:'none',
                  background: pipelineDone ? RED : '#e5e7eb',
                  color: pipelineDone ? '#fff' : '#9ca3af',
                  fontSize:13,fontWeight:700,
                  cursor: pipelineDone ? 'pointer' : 'not-allowed',
                  marginLeft:8,opacity:saving?.7:1,
                  boxShadow: pipelineDone ? `0 2px 8px ${RED}40` : 'none',
                  transition:'all .3s'}}>
                {saving
                  ? <><Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> Saving…</>
                  : !pipelineDone
                    ? <><Clock size={11}/> Analyzing…</>
                    : <><Share2 size={11}/> Share Report</>}
              </button>
            ) : (
              <button onClick={copyShareLink}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px',
                  borderRadius:20,border:'none',
                  background:copied?'#16a34a':TEAL,color:'#fff',
                  fontSize:13,fontWeight:700,cursor:'pointer',marginLeft:8,transition:'background .2s'}}>
                {copied ? <><Check size={11}/> Copied!</> : <><Link size={11}/> Copy Link</>}
              </button>
            )}
            <button onClick={()=>window.print()}
              style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',
                borderRadius:20,border:`1.5px solid ${RED}`,background:'#fff',
                color:RED,fontSize:13,fontWeight:700,cursor:'pointer'}}>
              <Printer size={11}/> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── COVER ── */}
      <div id="cover" style={{background:`linear-gradient(135deg,${BLACK} 0%,#1a1a2e 50%,#16213e 100%)`,
        minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',
        position:'relative',overflow:'hidden',paddingTop:56}}>

        <div style={{position:'absolute',inset:0,opacity:.04,
          backgroundImage:`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`}}/>
        <div style={{position:'absolute',top:56,left:0,right:0,height:3,
          background:`linear-gradient(90deg,${RED},${TEAL},${RED})`,
          backgroundSize:'200% 100%',animation:'slide 3s linear infinite'}}/>

        <div style={{maxWidth:1000,margin:'0 auto',padding:'0 48px',width:'100%'}}>

          {/* Agency brand */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:56}}>
            {agLogo
              ? <img src={agLogo} alt={agName} style={{height:36,objectFit:'contain',filter:'brightness(0) invert(1)'}}/>
              : <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>{agName}</div>
            }
            <div style={{width:1,height:22,background:'rgba(255,255,255,.2)'}}/>
            <div style={{fontSize:13,color:'#999999',fontWeight:600}}>Prospect Intelligence Report</div>
          </div>

          {/* Pipeline progress (shown while building) */}
          {!pipelineDone && (
            <PipelineProgress steps={steps}/>
          )}

          {/* Business hero */}
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:48,alignItems:'center'}}>
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:8,
                background:`${RED}20`,border:`1px solid ${RED}40`,
                borderRadius:20,padding:'5px 14px',marginBottom:18}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:RED,
                  animation:'pulse 1.5s infinite'}}/>
                <span style={{fontSize:13,fontWeight:800,color:RED,
                  textTransform:'uppercase',letterSpacing:'.08em'}}>
                  {pipelineDone ? 'Live Intelligence Report' : 'Building report…'}
                </span>
              </div>

              <h1 style={{fontSize:52,fontWeight:900,color:'#fff',lineHeight:1.05,
                letterSpacing:-2,margin:'0 0 14px'}}>{lead.name}</h1>

              <div style={{display:'flex',flexWrap:'wrap',gap:14,marginBottom:24}}>
                {lead.address && (
                  <div style={{display:'flex',alignItems:'center',gap:6,fontSize:14,color:'#999999'}}>
                    <MapPin size={13}/> {lead.address}
                  </div>
                )}
                {lead.phone && (
                  <div style={{display:'flex',alignItems:'center',gap:6,fontSize:14,color:'#999999'}}>
                    <Phone size={13}/> {lead.phone}
                  </div>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',gap:6,fontSize:14,
                      color:TEAL,textDecoration:'none'}}>
                    <Globe size={13}/> {lead.website.replace(/^https?:\/\//,'')}
                  </a>
                )}
              </div>

              {/* Data source indicator */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',
                  borderRadius:20,background:lead._real_data?`${TEAL}20`:'rgba(255,255,255,.08)',
                  border:`1px solid ${lead._real_data?TEAL+'40':'rgba(255,255,255,.1)'}`}}>
                  {lead._real_data
                    ? <><CheckCircle size={12} color={TEAL}/><span style={{fontSize:13,fontWeight:700,color:TEAL}}>Live Google Places data</span></>
                    : <><XCircle size={12} color="#9ca3af"/><span style={{fontSize:13,color:'#9ca3af'}}>Estimated data</span></>
                  }
                </div>
                {lead.website_analysis?.success && (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',
                    borderRadius:20,background:`${TEAL}20`,border:`1px solid ${TEAL}40`}}>
                    <Check size={12} color={TEAL}/>
                    <span style={{fontSize:13,fontWeight:700,color:TEAL}}>Website scanned</span>
                  </div>
                )}
              </div>

              {/* Stats cards */}
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {lead.rating > 0 && (
                  <div style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',
                    borderRadius:14,padding:'14px 18px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:26,fontWeight:900,color:'#f59e0b'}}>{lead.rating}</span>
                      <Stars rating={lead.rating}/>
                    </div>
                    <div style={{fontSize:13,color:'#999999'}}>
                      {(lead.review_count||0).toLocaleString()} Google reviews
                    </div>
                  </div>
                )}
                {(lead.gaps||[]).length > 0 && (
                  <div style={{background:`${RED}15`,border:`1px solid ${RED}40`,borderRadius:14,padding:'14px 18px'}}>
                    <div style={{fontSize:26,fontWeight:900,color:RED}}>{lead.gaps.length}</div>
                    <div style={{fontSize:13,color:'#999999'}}>Marketing gaps identified</div>
                  </div>
                )}
                {r?.opportunityScore && (
                  <div style={{background:'rgba(255,255,255,.07)',border:`1px solid ${TEAL}40`,borderRadius:14,padding:'14px 18px'}}>
                    <div style={{fontSize:26,fontWeight:900,color:TEAL}}>{r.opportunityScore}/100</div>
                    <div style={{fontSize:13,color:'#999999'}}>Opportunity score</div>
                  </div>
                )}
                {lead.revenue?.annualRevenueAtRisk > 0 && (
                  <div style={{background:`${RED}15`,border:`1px solid ${RED}40`,borderRadius:14,padding:'14px 18px'}}>
                    <div style={{fontSize:26,fontWeight:900,color:'#fff'}}>
                      ${Math.round(lead.revenue.annualRevenueAtRisk/1000)}K
                    </div>
                    <div style={{fontSize:13,color:'#999999'}}>Revenue at risk/yr</div>
                  </div>
                )}
              </div>
            </div>

            {/* Score ring */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{position:'relative',width:140,height:140}}>
                <Ring score={r?.opportunityScore||lead.score||50} size={140} stroke={12}/>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:-2}}>
                    {r?.opportunityScore||lead.score||50}
                  </div>
                  <div style={{fontSize:13,color:'#999999',textTransform:'uppercase',letterSpacing:'.06em'}}>Score</div>
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:700,textAlign:'center',
                color:(r?.opportunityScore||lead.score||50)>=75?'#4ade80':
                      (r?.opportunityScore||lead.score||50)>=50?TEAL:'#fbbf24'}}>
                {(r?.opportunityScore||lead.score||50)>=75?'High opportunity':
                 (r?.opportunityScore||lead.score||50)>=50?'Good opportunity':'Moderate opportunity'}
              </div>
            </div>
          </div>

          {/* Report meta */}
          <div style={{borderTop:'1px solid rgba(255,255,255,.08)',marginTop:48,paddingTop:24,
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:13,color:'#999999'}}>
              Prepared by {agName} · {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
            </div>
            <div style={{display:'flex',gap:16,fontSize:13,color:'#999999'}}>
              {agEmail && <span>{agEmail}</span>}
              {agDomain && <span>www.{agDomain}</span>}
            </div>
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:40,color:'#999999'}}>
          <ChevronDown size={22} style={{animation:'bounce 2s infinite'}}/>
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {r && (
        <Section id="overview" dark>
          <SectionLabel text="Executive Overview" light/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'start'}}>
            <div>
              <h2 style={{fontSize:34,fontWeight:900,color:'#fff',letterSpacing:-1,marginBottom:18,lineHeight:1.15}}>
                The opportunity hiding in plain sight
              </h2>
              <p style={{fontSize:16,color:'#999999',lineHeight:1.8,marginBottom:24}}>
                {r.executiveSummary}
              </p>
              {r.revenueAtRisk && (
                <div style={{background:`${RED}20`,border:`1px solid ${RED}40`,
                  borderRadius:14,padding:'18px 22px'}}>
                  <div style={{fontSize:13,fontWeight:800,color:RED,
                    textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                    Estimated revenue at risk annually
                  </div>
                  <div style={{fontSize:30,fontWeight:900,color:'#fff'}}>{r.revenueAtRisk}</div>
                  <div style={{fontSize:13,color:'#999999',marginTop:4}}>
                    being lost to better-positioned competitors
                  </div>
                </div>
              )}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[
                {label:'SEO Score',         value:r.seoScore,            color:RED},
                {label:'AEO Score',          value:r.aeoScore,            color:TEAL},
                {label:'Reputation Score',   value:r.reputationScore,     color:'#f59e0b'},
                {label:'Local Visibility',   value:r.localVisibilityScore,color:'#8b5cf6'},
              ].map(m=>(
                <div key={m.label} style={{background:'rgba(255,255,255,.05)',
                  border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:'18px',textAlign:'center'}}>
                  <div style={{position:'relative',width:70,height:70,margin:'0 auto 10px'}}>
                    <Ring score={m.value||0} size={70} stroke={6}/>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff'}}>{m.value||0}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:'#999999'}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {r.keyFindings?.length > 0 && (
            <div style={{marginTop:40,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {r.keyFindings.slice(0,6).map((f,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,.04)',
                  border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'14px 16px',
                  display:'flex',gap:10,alignItems:'flex-start'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:RED,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:900,color:'#fff',flexShrink:0,marginTop:1}}>{i+1}</div>
                  <span style={{fontSize:14,color:'#999999',lineHeight:1.55}}>{f}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── GAP ANALYSIS ── */}
      {(lead.gaps?.length > 0 || r) && (
        <Section id="gaps">
          <SectionLabel text="Gap Analysis"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
            <div>
              <h2 style={{fontSize:32,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
                Where {lead.name.split(' ')[0]} is losing ground
              </h2>
              <p style={{fontSize:15,color:'#374151',marginBottom:24,lineHeight:1.7}}>
                Our analysis identified {lead.gaps?.length||0} critical gaps costing them customers every day.
              </p>

              {r && (
                <div style={{background:'#f9fafb',borderRadius:14,padding:'20px'}}>
                  <ScoreBar label="Online Visibility"        value={100-(r.localVisibilityScore||50)} color={RED}/>
                  <ScoreBar label="Reputation Management"    value={100-(r.reputationScore||60)}      color={RED}/>
                  <ScoreBar label="SEO Performance"          value={100-(r.seoScore||55)}              color='#f59e0b'/>
                  <ScoreBar label="AI Search (AEO)"          value={100-(r.aeoScore||40)}              color='#8b5cf6'/>
                  <ScoreBar label="Social & Advertising"
                    value={lead.social_active||lead.running_ads?30:72}                                color={TEAL}/>
                </div>
              )}
            </div>

            <div>
              {/* Real gaps from data */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:13,fontWeight:800,color:RED,textTransform:'uppercase',
                  letterSpacing:'.07em',marginBottom:10}}>Identified marketing gaps</div>
                {(lead.gaps||[]).map((g,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,
                    padding:'10px 14px',background:`${RED}08`,borderRadius:10,marginBottom:7,
                    borderLeft:`3px solid ${RED}`}}>
                    <AlertCircle size={14} color={RED} style={{flexShrink:0,marginTop:1}}/>
                    <span style={{fontSize:14,color:'#374151',fontWeight:600}}>{g}</span>
                  </div>
                ))}
              </div>

              {/* Tech stack audit - REAL data from website scan */}
              {lead.website_analysis?.tech !== undefined && (
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:'#374151',textTransform:'uppercase',
                    letterSpacing:'.07em',marginBottom:10}}>
                    Tech stack (scanned from source code)
                  </div>
                  {[
                    {label:'CMS',           value:lead.cms||'Unknown',                            good:!!lead.cms},
                    {label:'SEO Plugin',     value:lead.seo_plugin||'None detected',              good:!!lead.seo_plugin},
                    {label:'Analytics',      value:lead.has_analytics?'Connected':'Not detected', good:lead.has_analytics},
                    {label:'CRM / Email',    value:lead.has_crm?'Connected':'None detected',      good:lead.has_crm},
                    {label:'Call Tracking',  value:lead.has_call_tracking?'Active':'None',         good:lead.has_call_tracking},
                    {label:'Schema Markup',  value:lead.has_local_schema?'LocalBusiness schema':lead.has_schema?'Generic schema':'None', good:lead.has_local_schema},
                    {label:'Facebook Pixel', value:lead.has_pixel?'Active':'None detected',        good:lead.has_pixel},
                    {label:'Booking Tool',   value:lead.booking_software||'None detected',          good:!!lead.booking_software},
                  ].map(item=>(
                    <div key={item.label} style={{display:'flex',alignItems:'center',gap:10,
                      padding:'7px 12px',background:item.good?'#f0fdf4':'#fef2f2',
                      borderRadius:9,marginBottom:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',
                        background:item.good?'#16a34a':RED,flexShrink:0}}/>
                      <div style={{flex:1,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{item.label}</span>
                        <span style={{fontSize:13,color:item.good?'#16a34a':'#374151'}}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                  {lead.sitemap_pages > 0 && (
                    <div style={{marginTop:10,padding:'9px 13px',background:'#f9fafb',
                      borderRadius:9,fontSize:13,color:'#374151'}}>
                      Sitemap: <strong>{lead.sitemap_pages} pages</strong>
                      {lead.sitemap_pages < 10?' — very thin content footprint':
                       lead.sitemap_pages < 30?' — moderate content depth':' — good content coverage'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Competitor threats */}
          {r?.competitorThreats?.length > 0 && (
            <div style={{marginTop:32}}>
              <div style={{fontSize:14,fontWeight:800,color:'#374151',
                textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Competitive threats</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {r.competitorThreats.map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,
                    padding:'10px 14px',background:'#fff7ed',borderRadius:10,
                    borderLeft:'3px solid #f59e0b'}}>
                    <Target size={13} color="#d97706" style={{flexShrink:0,marginTop:2}}/>
                    <span style={{fontSize:14,color:'#374151'}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── SEO & AEO ── */}
      {r && (
        <Section id="seo" style={{background:'#f8f8f8'}}>
          <SectionLabel text="SEO & AEO Analysis"/>
          <h2 style={{fontSize:32,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
            Keyword & AI search opportunities
          </h2>
          <p style={{fontSize:15,color:'#374151',marginBottom:32,lineHeight:1.7}}>
            These are the searches their customers are making — and {lead.name} isn't showing up.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <TrendingUp size={16} color={RED}/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>SEO Gaps</div>
              </div>
              {(r.seoGaps||[]).map((g,i)=>(
                <div key={i} style={{display:'flex',gap:10,padding:'10px 0',
                  borderBottom:i<(r.seoGaps||[]).length-1?'1px solid #f3f4f6':'none',alignItems:'flex-start'}}>
                  <div style={{width:20,height:20,borderRadius:6,background:`${RED}15`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:900,color:RED,flexShrink:0}}>{i+1}</div>
                  <span style={{fontSize:14,color:'#374151'}}>{g}</span>
                </div>
              ))}
            </div>

            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <Sparkles size={16} color='#8b5cf6'/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>AEO / AI Search Gaps</div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:'#8b5cf6',background:'#f5f3ff',
                padding:'3px 10px',borderRadius:20,display:'inline-block',marginBottom:14}}>
                ChatGPT · Perplexity · Google AI
              </div>
              {(r.aeoGaps||[]).map((g,i)=>(
                <div key={i} style={{display:'flex',gap:10,padding:'10px 0',
                  borderBottom:i<(r.aeoGaps||[]).length-1?'1px solid #f3f4f6':'none',alignItems:'flex-start'}}>
                  <Sparkles size={11} color='#8b5cf6' style={{flexShrink:0,marginTop:3}}/>
                  <span style={{fontSize:14,color:'#374151'}}>{g}</span>
                </div>
              ))}
            </div>
          </div>

          {r.keywordOpportunities?.length > 0 && (
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
              <div style={{padding:'16px 22px',borderBottom:'1px solid #f3f4f6',
                display:'flex',alignItems:'center',gap:8}}>
                <Search size={15} color={RED}/>
                <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Keyword Opportunities</div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f9fafb'}}>
                    {['Keyword','Volume','Difficulty','Why It Matters'].map(h=>(
                      <th key={h} style={{padding:'11px 18px',fontSize:13,fontWeight:800,
                        color:'#111',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.keywordOpportunities.slice(0,6).map((kw,i)=>(
                    <tr key={i} style={{borderBottom:i<r.keywordOpportunities.length-1?'1px solid #f9fafb':'none'}}>
                      <td style={{padding:'13px 18px',fontSize:14,fontWeight:800,color:'#111'}}>{kw.keyword}</td>
                      <td style={{padding:'13px 18px',fontSize:14,fontWeight:700,color:RED}}>{kw.volume}</td>
                      <td style={{padding:'13px 18px'}}>
                        <span style={{fontSize:13,fontWeight:800,padding:'3px 10px',borderRadius:20,
                          background:kw.difficulty==='Easy'?'#f0fdf4':kw.difficulty==='Hard'?'#fef2f2':'#fffbeb',
                          color:kw.difficulty==='Easy'?'#16a34a':kw.difficulty==='Hard'?RED:'#d97706'}}>
                          {kw.difficulty}
                        </span>
                      </td>
                      <td style={{padding:'13px 18px',fontSize:13,color:'#374151'}}>{kw.opportunity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ── SOLUTIONS ── */}
      {r && (
        <Section id="solutions" dark>
          <SectionLabel text="Our Solution" light/>
          <h2 style={{fontSize:34,fontWeight:900,color:'#fff',letterSpacing:-1,marginBottom:8}}>
            How {agName} closes every gap
          </h2>
          <p style={{fontSize:15,color:'#999999',marginBottom:36,lineHeight:1.7}}>
            A program designed specifically around {lead.name}'s real situation.
          </p>

          {r.quickWins?.length > 0 && (
            <div style={{marginBottom:36}}>
              <div style={{fontSize:13,fontWeight:800,color:TEAL,textTransform:'uppercase',
                letterSpacing:'.08em',marginBottom:14}}>Quick wins — first 30 days</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                {r.quickWins.map((w,i)=>(
                  <div key={i} style={{background:'rgba(255,255,255,.05)',
                    border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:'16px 18px',
                    display:'grid',gridTemplateColumns:'auto 1fr',gap:12}}>
                    <div style={{width:34,height:34,borderRadius:10,background:`${TEAL}20`,
                      border:`1px solid ${TEAL}40`,display:'flex',alignItems:'center',
                      justifyContent:'center',flexShrink:0}}>
                      <Zap size={15} color={TEAL}/>
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:800,color:'#fff',marginBottom:4}}>{w.action}</div>
                      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:700,
                          color:w.impact==='High'?RED:TEAL,
                          background:w.impact==='High'?`${RED}20`:`${TEAL}20`,
                          padding:'1px 8px',borderRadius:20}}>{w.impact} impact</span>
                        <span style={{fontSize:13,color:'#999999'}}>{w.timeline}</span>
                      </div>
                      <div style={{fontSize:13,color:'#999999',marginTop:5}}>{w.result}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.proposedSolutions?.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {r.proposedSolutions.map((s,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,.04)',
                  border:`1px solid ${i===0?RED+'60':'rgba(255,255,255,.08)'}`,
                  borderRadius:16,padding:'20px',position:'relative',overflow:'hidden'}}>
                  {i===0&&<div style={{position:'absolute',top:0,left:0,right:0,height:3,background:RED}}/>}
                  <div style={{fontSize:13,fontWeight:800,color:i===0?RED:TEAL,marginBottom:8}}>{s.service}</div>
                  <div style={{fontSize:14,color:'#999999',lineHeight:1.6,marginBottom:12}}>{s.description}</div>
                  <div style={{fontSize:13,color:'#999999',paddingTop:12,
                    borderTop:'1px solid rgba(255,255,255,.07)',marginBottom:12}}>
                    Expected: <span style={{color:'#999999',fontWeight:600}}>{s.outcome}</span>
                  </div>
                  <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>{s.price}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── ROI ── */}
      {(r || lead.revenue) && (
        <Section id="roi">
          <SectionLabel text="Return on Investment"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
            <div>
              <h2 style={{fontSize:32,fontWeight:900,color:'#111',letterSpacing:-1,marginBottom:8}}>
                What success looks like
              </h2>
              <p style={{fontSize:15,color:'#374151',lineHeight:1.7,marginBottom:28}}>
                Based on real competitor data and industry benchmarks for this market.
              </p>

              {lead.revenue && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:28}}>
                  {[
                    {label:'Current est. leads/mo',  value:lead.revenue.currentMonthlyLeads,   color:'#374151'},
                    {label:'Potential leads/mo',      value:lead.revenue.optimizedMonthlyLeads, color:TEAL},
                    {label:'Avg job value',           value:'$'+lead.revenue.avgJobValue?.toLocaleString(), color:'#f59e0b'},
                    {label:'Annual revenue at risk',  value:'$'+Math.round((lead.revenue.annualRevenueAtRisk||0)/1000)+'K', color:RED},
                  ].map(m=>(
                    <div key={m.label} style={{background:'#f9fafb',borderRadius:12,border:'1px solid #e5e7eb',padding:'16px'}}>
                      <div style={{fontSize:22,fontWeight:900,color:m.color}}>{m.value}</div>
                      <div style={{fontSize:13,color:'#374151',marginTop:4}}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {r?.roi && Object.entries(r.roi).map(([k,v],i)=>(
                <div key={k} style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:16}}>
                  <div style={{width:42,height:42,borderRadius:11,
                    background:i===0?`${RED}15`:i===1?`${TEAL}15`:'#f3f4f6',
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:900,color:i===0?RED:i===1?TEAL:'#374151'}}>
                      {k.replace('month','M')}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
                      letterSpacing:'.07em',marginBottom:3}}>{k.replace('month','Month ')}</div>
                    <div style={{fontSize:15,fontWeight:700,color:'#111'}}>{v}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:'#f9fafb',borderRadius:20,padding:'28px'}}>
              <div style={{fontSize:13,fontWeight:800,color:'#374151',marginBottom:18,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Growth trajectory</div>
              {[
                {label:'Month 1-2', desc:'Foundation setup',          pct:15, color:RED},
                {label:'Month 3',   desc:'Visibility improving',       pct:35, color:'#f59e0b'},
                {label:'Month 6',   desc:'Consistent lead flow',       pct:65, color:TEAL},
                {label:'Month 12',  desc:'Local market leader',        pct:90, color:'#16a34a'},
              ].map((m,i)=>(
                <div key={i} style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <div>
                      <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{m.label}</span>
                      <span style={{fontSize:13,color:'#374151',marginLeft:8}}>{m.desc}</span>
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
      )}

      {/* ── CTA ── */}
      <Section id="cta" dark style={{background:`linear-gradient(135deg,${BLACK},#1a0a0a)`}}>
        <div style={{textAlign:'center',maxWidth:660,margin:'0 auto'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,
            background:`${RED}20`,border:`1px solid ${RED}40`,
            borderRadius:20,padding:'5px 16px',marginBottom:22}}>
            <Award size={13} color={RED}/>
            <span style={{fontSize:13,fontWeight:800,color:RED,
              textTransform:'uppercase',letterSpacing:'.08em'}}>Ready to grow</span>
          </div>
          <h2 style={{fontSize:42,fontWeight:900,color:'#fff',letterSpacing:-1.5,lineHeight:1.1,marginBottom:18}}>
            Every day without action is a day competitors get stronger.
          </h2>
          {r?.closingStatement && (
            <p style={{fontSize:16,color:'#999999',lineHeight:1.8,marginBottom:36}}>
              {r.closingStatement}
            </p>
          )}
          <div style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',
            borderRadius:18,padding:'28px',marginBottom:32}}>
            <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:12}}>{agName}</div>
            <div style={{display:'flex',justifyContent:'center',gap:22,flexWrap:'wrap'}}>
              {agEmail && (
                <a href={`mailto:${agEmail}`}
                  style={{display:'flex',alignItems:'center',gap:7,fontSize:14,
                    color:TEAL,textDecoration:'none',fontWeight:600}}>
                  <Mail size={14}/>{agEmail}
                </a>
              )}
              {agDomain && (
                <a href={`https://${agDomain}`} target="_blank" rel="noreferrer"
                  style={{display:'flex',alignItems:'center',gap:7,fontSize:14,
                    color:TEAL,textDecoration:'none',fontWeight:600}}>
                  <Globe size={14}/>www.{agDomain}
                </a>
              )}
            </div>
          </div>
          <div style={{display:'flex',gap:14,justifyContent:'center'}}>
            <a href={`mailto:${agEmail}?subject=Ready to grow - ${lead.name}`}
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 32px',
                borderRadius:14,background:RED,color:'#fff',fontSize:16,fontWeight:800,
                textDecoration:'none',boxShadow:`0 6px 24px ${RED}50`}}>
              Get My Free Strategy Call <ArrowRight size={16}/>
            </a>
            <button onClick={()=>window.print()}
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 24px',
                borderRadius:14,border:'1px solid rgba(255,255,255,.2)',background:'transparent',
                color:'#999999',fontSize:15,fontWeight:700,cursor:'pointer'}}>
              <Printer size={15}/> Save as PDF
            </button>
          </div>
          <div style={{marginTop:28,fontSize:13,color:'#999999'}}>
            Report by {agName} · Powered by Koto · Data: Google Places API + live website scan
          </div>
        </div>
      </Section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes slide  { from{background-position:0% 0%} to{background-position:200% 0%} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @media print {
          [style*="position:fixed"],[style*="position:sticky"] { display:none!important; }
          body { background:#fff!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        }
      `}</style>
    </div>
    </>
  )
}
