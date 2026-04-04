"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Star, Globe, Phone, Mail, MapPin, TrendingUp, AlertCircle,
  CheckCircle, ArrowRight, Target, BarChart2, Zap, Shield,
  ChevronDown, Award, DollarSign, Sparkles, Loader2,
  Edit3, Save, X, Plus, Minus, User, Lock, Eye, EyeOff,
  Printer, Share2, TrendingDown, RefreshCw, Search
} from 'lucide-react'
import { supabase, getProspectReport, updateProspectReport, claimProspectReport } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import toast, { Toaster } from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLACK = '#0a0a0a'

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

// ── Score ring ────────────────────────────────────────────────────────────────
function Ring({ score=0, size=100, stroke=9 }) {
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

// ── Editable field ────────────────────────────────────────────────────────────
function EditableNum({ value, onChange, prefix='$', suffix='', label, hint }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  function commit() { onChange(Number(draft)||0); setEditing(false) }
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.4)',
        textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>{label}</div>
      {editing ? (
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="number" value={draft} onChange={e=>setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e=>e.key==='Enter'&&commit()}
            autoFocus style={{width:100,padding:'4px 8px',borderRadius:7,border:`1.5px solid ${TEAL}`,
              fontSize:20,fontWeight:900,color:'#111',outline:'none'}}/>
          <button onClick={commit} style={{border:'none',background:TEAL,color:'#fff',
            borderRadius:7,padding:'4px 8px',cursor:'pointer',fontSize:12,fontWeight:700}}>✓</button>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'baseline',gap:6,cursor:'pointer',group:'true'}}
          onClick={()=>{setDraft(value);setEditing(true)}}>
          <span style={{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:-1}}>
            {prefix}{Number(value).toLocaleString()}{suffix}
          </span>
          <Edit3 size={13} color='rgba(255,255,255,.3)'/>
        </div>
      )}
      {hint && <div style={{fontSize:11,color:'rgba(255,255,255,.35)',marginTop:2}}>{hint}</div>}
    </div>
  )
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate({ report, agency, onClaimed }) {
  const [mode, setMode]         = useState('signup') // signup | login | google
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const agName  = agency?.brand_name || agency?.name || 'Your Agency'
  const agColor = agency?.brand_color || RED

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all fields'); return
    }
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { data: { first_name: name.trim().split(' ')[0], full_name: name.trim() } }
      })
      if (authError) throw authError
      const userId = authData.user?.id
      await claimProspectReport(report.id, {
        name: name.trim(), email: email.trim(),
        phone: phone.trim(), company: report.business_name,
        prospect_id: userId
      })
      toast.success('Account created! Welcome.')
      onClaimed({ name: name.trim(), email: email.trim(), userId })
    } catch(e) { toast.error(e.message) }
    setLoading(false)
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { toast.error('Enter email and password'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password: password.trim()
      })
      if (error) throw error
      const userId = data.user?.id
      await claimProspectReport(report.id, {
        name: data.user?.user_metadata?.full_name || email.split('@')[0],
        email: email.trim(), phone: '', company: '',
        prospect_id: userId
      })
      onClaimed({ name: data.user?.user_metadata?.first_name || '', email: email.trim(), userId })
    } catch(e) { toast.error(e.message) }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      })
    } catch(e) { toast.error(e.message); setLoading(false) }
  }

  const INP = {
    width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb',
    fontSize:15, outline:'none', color:'#111', boxSizing:'border-box', fontFamily:'inherit'
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.75)',
      backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:440,overflow:'hidden',
        boxShadow:'0 32px 80px rgba(0,0,0,.3)'}}>

        {/* Header */}
        <div style={{background:BLACK,padding:'28px 32px 24px'}}>
          {agency?.brand_logo_url ? (
            <img src={agency.brand_logo_url} alt={agName}
              style={{height:32,objectFit:'contain',marginBottom:16,filter:'brightness(0) invert(1)'}}/>
          ) : (
            <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:16}}>{agName}</div>
          )}
          <h2 style={{fontSize:22,fontWeight:900,color:'#fff',margin:'0 0 6px',letterSpacing:-0.3}}>
            Your free intelligence report is ready
          </h2>
          <p style={{fontSize:14,color:'rgba(255,255,255,.55)',margin:0}}>
            Create a free account to access the full analysis for <strong style={{color:'#fff'}}>{report.business_name}</strong> — and customize the numbers to match your situation.
          </p>
        </div>

        {/* Form */}
        <div style={{padding:'24px 32px 28px'}}>
          {/* Mode toggle */}
          <div style={{display:'flex',gap:0,background:'#f3f4f6',borderRadius:10,padding:3,marginBottom:20}}>
            {[['signup','Create Account'],['login','Sign In']].map(([m,l])=>(
              <button key={m} onClick={()=>setMode(m)}
                style={{flex:1,padding:'8px',borderRadius:8,border:'none',
                  background:mode===m?'#fff':'transparent',
                  color:mode===m?'#111':'#6b7280',fontSize:14,fontWeight:mode===m?700:500,
                  cursor:'pointer',boxShadow:mode===m?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
                {l}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button onClick={handleGoogle} disabled={loading}
            style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',
              gap:10,padding:'12px',borderRadius:12,border:'1.5px solid #e5e7eb',
              background:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginBottom:16,
              color:'#374151',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#4285F4';e.currentTarget.style.background='#f8f9ff'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='#fff'}}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
              <path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.86.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.54 10.74l7.14-5.55z"/>
              <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.09 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.26l7.34 5.7C13.42 13.62 18.27 9.75 24 9.75z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
            <span style={{fontSize:13,color:'#9ca3af'}}>or</span>
            <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {mode==='signup' && (
              <>
                <input value={name} onChange={e=>setName(e.target.value)}
                  placeholder="Your full name" style={INP}/>
                <input value={phone} onChange={e=>setPhone(e.target.value)}
                  placeholder="Phone number (optional)" style={INP} type="tel"/>
              </>
            )}
            <input value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" style={INP} type="email"/>
            <div style={{position:'relative'}}>
              <input value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Password" type={showPw?'text':'password'} style={{...INP,paddingRight:44}}/>
              <button onClick={()=>setShowPw(s=>!s)} type="button"
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                  border:'none',background:'none',cursor:'pointer',color:'#9ca3af',padding:0}}>
                {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
          </div>

          <button onClick={mode==='signup'?handleSignup:handleLogin} disabled={loading}
            style={{width:'100%',marginTop:16,padding:'13px',borderRadius:12,border:'none',
              background:agColor,color:'#fff',fontSize:16,fontWeight:800,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              boxShadow:`0 4px 16px ${agColor}40`,opacity:loading?.7:1}}>
            {loading ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> : null}
            {loading ? 'Loading…' : mode==='signup' ? 'Create Free Account & View Report' : 'Sign In & View Report'}
          </button>

          <p style={{fontSize:12,color:'#9ca3af',textAlign:'center',marginTop:12,lineHeight:1.6}}>
            By continuing you agree to our terms. Your information is used only to deliver this report and for {agName} to contact you about marketing services.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Revenue calculator panel (prospect editable) ──────────────────────────────
function RevenueCalculator({ report, customizations, onChange }) {
  const rv = report.revenue_data || {}
  const ai = report.ai_analysis  || {}

  const [monthlyAdBudget, setMonthlyAdBudget] = useState(customizations.monthlyAdBudget || 1500)
  const [avgJobValue,     setAvgJobValue]     = useState(customizations.avgJobValue     || rv.avgJobValue || 500)
  const [closeRate,       setCloseRate]       = useState(customizations.closeRate       || 25)
  const [currentLeads,    setCurrentLeads]    = useState(customizations.currentLeads    || rv.currentMonthlyLeads || 8)

  useEffect(() => {
    onChange({ monthlyAdBudget, avgJobValue, closeRate, currentLeads })
  }, [monthlyAdBudget, avgJobValue, closeRate, currentLeads])

  // Calculate outcomes
  const costPerClick  = 4.5  // avg local service CPC
  const monthlyClicks = Math.round(monthlyAdBudget / costPerClick)
  const landingConv   = 0.08  // 8% landing page conversion
  const newLeadsFromAds = Math.round(monthlyClicks * landingConv)
  const totalLeads    = currentLeads + newLeadsFromAds
  const newClients    = Math.round(totalLeads * (closeRate/100))
  const monthlyRev    = newClients * avgJobValue
  const annualRev     = monthlyRev * 12
  const roas          = monthlyAdBudget > 0 ? (monthlyRev / monthlyAdBudget).toFixed(1) : '∞'

  // Lost revenue (gaps)
  const reviewGapImpact  = (rv.annualRevenueAtRisk || 0)
  const adImpact         = annualRev - (currentLeads * (closeRate/100) * avgJobValue * 12)

  const Slider = ({ value, onChange: onC, min, max, step=1, prefix='$', suffix='' }) => (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:13,fontWeight:800,color:'#fff'}}>{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onC(Number(e.target.value))}
        style={{width:'100%',accentColor:TEAL,cursor:'pointer'}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(255,255,255,.3)'}}>
        <span>{prefix}{min.toLocaleString()}</span><span>{prefix}{max.toLocaleString()}</span>
      </div>
    </div>
  )

  return (
    <div style={{background:BLACK,borderRadius:20,overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'rgba(234,39,41,.15)',border:'1px solid rgba(234,39,41,.3)',
        borderRadius:'20px 20px 0 0',padding:'20px 24px',display:'flex',alignItems:'center',gap:10}}>
        <TrendingUp size={18} color={RED}/>
        <div>
          <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>Revenue Impact Calculator</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.5)'}}>Adjust the numbers to match your real situation</div>
        </div>
        <div style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:TEAL,
          background:`${TEAL}20`,padding:'3px 10px',borderRadius:20,border:`1px solid ${TEAL}40`}}>
          Interactive
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
        {/* Inputs */}
        <div style={{padding:'24px',borderRight:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,.4)',
            textTransform:'uppercase',letterSpacing:'.08em',marginBottom:18}}>Your inputs</div>
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.7)',marginBottom:8}}>
                Monthly ad budget
              </div>
              <Slider value={monthlyAdBudget} onChange={setMonthlyAdBudget} min={500} max={10000} step={250}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.7)',marginBottom:8}}>
                Average job / sale value
              </div>
              <Slider value={avgJobValue} onChange={setAvgJobValue} min={100} max={25000} step={50}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.7)',marginBottom:8}}>
                Current close rate: <span style={{color:TEAL}}>{closeRate}%</span>
              </div>
              <Slider value={closeRate} onChange={setCloseRate} min={5} max={80} step={5} prefix='' suffix='%'/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.7)',marginBottom:8}}>
                Current monthly leads
              </div>
              <Slider value={currentLeads} onChange={setCurrentLeads} min={1} max={200} step={1} prefix=''/>
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div style={{padding:'24px'}}>
          <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,.4)',
            textTransform:'uppercase',letterSpacing:'.08em',marginBottom:18}}>Projected results</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[
              {label:'New leads from ads/mo',    value:newLeadsFromAds,                   suffix:'',    color:'#fff'},
              {label:'Total monthly leads',       value:totalLeads,                        suffix:'',    color:TEAL},
              {label:'New clients/mo',            value:newClients,                        suffix:'',    color:TEAL},
              {label:'Additional monthly revenue',value:'$'+monthlyRev.toLocaleString(),   suffix:'',    color:'#fff'},
              {label:'Additional annual revenue', value:'$'+annualRev.toLocaleString(),    suffix:'',    color:RED},
              {label:'Ad ROAS',                   value:roas+'x',                          suffix:'',    color:'#f59e0b'},
            ].map(m=>(
              <div key={m.label} style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',padding:'10px 14px',background:'rgba(255,255,255,.04)',
                borderRadius:10}}>
                <span style={{fontSize:13,color:'rgba(255,255,255,.6)'}}>{m.label}</span>
                <span style={{fontSize:16,fontWeight:900,color:m.color}}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Revenue at risk */}
          {reviewGapImpact > 0 && (
            <div style={{marginTop:16,padding:'14px',background:`${RED}15`,
              borderRadius:12,border:`1px solid ${RED}40`}}>
              <div style={{fontSize:12,fontWeight:800,color:RED,marginBottom:4}}>
                Annual revenue at risk (current gaps)
              </div>
              <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>
                ${reviewGapImpact.toLocaleString()}
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,.4)',marginTop:2}}>
                being lost to better-positioned competitors
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PUBLIC REPORT PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function PublicReportPage() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [report,   setReport]   = useState(null)
  const [agency,   setAgency]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [claimed,  setClaimed]  = useState(false)
  const [prospect, setProspect] = useState(null)
  const [customizations, setCustomizations] = useState({})
  const [activeTab, setActiveTab] = useState('overview')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [token])

  // Handle Google OAuth redirect
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !claimed && report) {
        const userId = session.user.id
        await claimProspectReport(report.id, {
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
          email: session.user.email,
          phone: '', company: report.business_name,
          prospect_id: userId
        })
        setProspect({ name: session.user.user_metadata?.first_name || '', email: session.user.email })
        setClaimed(true)
      }
    })
  }, [report, claimed])

  async function load() {
    const { data, error } = await getProspectReport(token)
    if (error || !data) { setLoading(false); return }

    // Track view
    await updateProspectReport(data.id, {
      views: (data.views||0) + 1,
      last_viewed_at: new Date().toISOString()
    })

    setReport(data)
    setCustomizations(data.customizations || {})

    // Load agency branding
    if (data.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('*').eq('id', data.agency_id).single()
      if (ag) setAgency(ag)
    }

    // Check if already claimed
    const { data: { session } } = await supabase.auth.getSession()
    if (session || data.prospect_email) {
      setClaimed(true)
      if (session) setProspect({ name: session.user.user_metadata?.first_name || '', email: session.user.email })
      else if (data.prospect_name) setProspect({ name: data.prospect_name, email: data.prospect_email })
    }

    setLoading(false)
  }

  async function saveCustomizations(newCustom) {
    if (!report) return
    setCustomizations(newCustom)
    setSaving(true)
    try {
      await updateProspectReport(report.id, { customizations: newCustom })
    } catch {}
    setSaving(false)
  }

  function handleClaimed(info) {
    setClaimed(true)
    setProspect(info)
    toast.success(`Welcome, ${info.name || info.email}! You now have full access.`)
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',background:BLACK,flexDirection:'column',gap:16}}>
      <div style={{width:48,height:48,borderRadius:'50%',border:`3px solid ${RED}`,
        borderTopColor:'transparent',animation:'spin 1s linear infinite'}}/>
      <div style={{fontSize:16,fontWeight:700,color:'rgba(255,255,255,.5)'}}>
        Loading your report…
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!report) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',background:BLACK,flexDirection:'column',gap:14}}>
      <AlertCircle size={40} color={RED}/>
      <div style={{fontSize:20,fontWeight:800,color:'#fff'}}>Report not found</div>
      <div style={{fontSize:15,color:'rgba(255,255,255,.4)'}}>This link may have expired or been removed.</div>
    </div>
  )

  const ai   = report.ai_analysis  || {}
  const rv   = report.revenue_data || {}
  const lead = report.lead_data    || {}
  const agName  = agency?.brand_name || agency?.name || 'Your Agency'
  const agColor = agency?.brand_color || RED
  const agEmail = agency?.billing_email || ''
  const agDomain = agency?.brand_domain || (agEmail?.split('@')[1]) || ''

  const TABS = ['overview','gaps','seo','revenue','solutions']

  return (
    <div style={{fontFamily:'"DM Sans",system-ui,sans-serif',background:'#f0f0f2',minHeight:'100vh'}}>
      <Toaster position="top-right"/>

      {/* Auth gate */}
      {!claimed && (
        <AuthGate report={report} agency={agency} onClaimed={handleClaimed}/>
      )}

      {/* ── Sticky header ── */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(10,10,10,.97)',
        backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'0 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',
          justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            {agency?.brand_logo_url ? (
              <img src={agency.brand_logo_url} alt={agName}
                style={{height:24,objectFit:'contain',filter:'brightness(0) invert(1)'}}/>
            ) : (
              <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{agName}</div>
            )}
            <div style={{width:1,height:16,background:'rgba(255,255,255,.15)'}}/>
            <div style={{fontSize:13,color:'rgba(255,255,255,.45)',fontWeight:600}}>
              {report.business_name} · Intelligence Report
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {prospect && (
              <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginRight:4}}>
                {prospect.name || prospect.email}
              </div>
            )}
            {saving && <div style={{fontSize:12,color:TEAL}}>Saving…</div>}
            <button onClick={()=>window.print()}
              style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:20,
                border:`1px solid ${agColor}50`,background:'transparent',color:agColor,
                fontSize:12,fontWeight:700,cursor:'pointer'}}>
              <Printer size={11}/> Download PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',gap:0}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              style={{padding:'10px 18px',border:'none',borderBottom:`2.5px solid ${activeTab===t?agColor:'transparent'}`,
                background:'transparent',color:activeTab===t?'#fff':'rgba(255,255,255,.4)',
                fontSize:14,fontWeight:activeTab===t?800:600,cursor:'pointer',
                textTransform:'capitalize',transition:'all .15s'}}>
              {t === 'seo' ? 'SEO & AEO' : t === 'revenue' ? 'Revenue Model' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px 80px'}}>

        {/* ── Hero ── */}
        <div style={{background:BLACK,borderRadius:20,padding:'36px 40px',marginBottom:20,
          position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,
            background:`linear-gradient(90deg,${agColor},${TEAL},${agColor})`,
            backgroundSize:'200% 100%',animation:'barSlide 3s linear infinite'}}/>

          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:32,alignItems:'start'}}>
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:8,
                background:`${agColor}20`,border:`1px solid ${agColor}40`,
                borderRadius:20,padding:'4px 14px',marginBottom:16}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:agColor,
                  animation:'pulse 1.5s infinite'}}/>
                <span style={{fontSize:12,fontWeight:800,color:agColor,
                  textTransform:'uppercase',letterSpacing:'.08em'}}>Live Intelligence Report</span>
              </div>
              <h1 style={{fontSize:42,fontWeight:900,color:'#fff',letterSpacing:-1.5,
                lineHeight:1.05,margin:'0 0 14px'}}>{report.business_name}</h1>
              <div style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:20}}>
                {report.business_address && (
                  <span style={{display:'flex',alignItems:'center',gap:6,fontSize:14,color:'rgba(255,255,255,.5)'}}>
                    <MapPin size={13}/> {report.business_address}
                  </span>
                )}
                {report.business_phone && (
                  <span style={{display:'flex',alignItems:'center',gap:6,fontSize:14,color:'rgba(255,255,255,.5)'}}>
                    <Phone size={13}/> {report.business_phone}
                  </span>
                )}
                {report.business_website && (
                  <a href={report.business_website} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',gap:6,fontSize:14,color:TEAL,textDecoration:'none'}}>
                    <Globe size={13}/> {report.business_website.replace(/^https?:\/\//,'')}
                  </a>
                )}
              </div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {report.google_rating > 0 && (
                  <div style={{background:'rgba(255,255,255,.07)',borderRadius:12,padding:'12px 18px',
                    border:'1px solid rgba(255,255,255,.1)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:24,fontWeight:900,color:'#f59e0b'}}>{report.google_rating}</span>
                      <Stars rating={report.google_rating}/>
                    </div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>
                      {(report.google_reviews||0).toLocaleString()} Google reviews
                    </div>
                  </div>
                )}
                {ai.opportunityScore && (
                  <div style={{background:'rgba(255,255,255,.07)',borderRadius:12,padding:'12px 18px',
                    border:`1px solid ${agColor}40`}}>
                    <div style={{fontSize:24,fontWeight:900,color:agColor}}>{ai.opportunityScore}/100</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>Opportunity score</div>
                  </div>
                )}
                {rv.annualRevenueAtRisk > 0 && (
                  <div style={{background:`${RED}15`,borderRadius:12,padding:'12px 18px',
                    border:`1px solid ${RED}40`}}>
                    <div style={{fontSize:24,fontWeight:900,color:RED}}>
                      ${Math.round(rv.annualRevenueAtRisk/1000)}K
                    </div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>Revenue at risk/yr</div>
                  </div>
                )}
              </div>
            </div>

            {/* Score ring */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
              <div style={{position:'relative',width:120,height:120}}>
                <Ring score={ai.opportunityScore||50} size={120} stroke={11}/>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:32,fontWeight:900,color:'#fff',lineHeight:1}}>
                    {ai.opportunityScore||50}
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>/ 100</div>
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:700,textAlign:'center',
                color:(ai.opportunityScore||50)>=75?'#4ade80':(ai.opportunityScore||50)>=50?TEAL:'#fbbf24'}}>
                {(ai.opportunityScore||50)>=75?'High opportunity':'Good opportunity'}
              </div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.3)',textAlign:'center'}}>
                {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
              </div>
            </div>
          </div>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {ai.executiveSummary && (
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'24px 28px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <Sparkles size={16} color={agColor}/>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Executive Summary</div>
                </div>
                <p style={{fontSize:16,color:'#374151',lineHeight:1.8,margin:0}}>{ai.executiveSummary}</p>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[
                {label:'SEO Score',          value:ai.seoScore||0,          color:RED},
                {label:'AEO / AI Search',    value:ai.aeoScore||0,          color:'#8b5cf6'},
                {label:'Reputation Score',   value:ai.reputationScore||0,   color:'#f59e0b'},
                {label:'Local Visibility',   value:ai.localVisibilityScore||0,color:TEAL},
              ].map(m=>(
                <div key={m.label} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                  padding:'20px',textAlign:'center'}}>
                  <div style={{position:'relative',width:70,height:70,margin:'0 auto 10px'}}>
                    <Ring score={m.value} size={70} stroke={6}/>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:18,fontWeight:900,color:'#111'}}>{m.value}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{m.label}</div>
                </div>
              ))}
            </div>

            {ai.keyFindings?.length > 0 && (
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:14}}>Key findings</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {ai.keyFindings.map((f,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'11px 14px',
                      background:'#f9fafb',borderRadius:10,alignItems:'flex-start'}}>
                      <div style={{width:22,height:22,borderRadius:'50%',background:agColor,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,fontWeight:900,color:'#fff',flexShrink:0,marginTop:1}}>{i+1}</div>
                      <span style={{fontSize:14,color:'#374151',lineHeight:1.55}}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GAPS TAB ── */}
        {activeTab === 'gaps' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:14}}>Marketing gaps</div>
                {(lead.gaps||[]).map((g,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 14px',
                    background:`${RED}08`,borderRadius:10,marginBottom:8,borderLeft:`3px solid ${RED}`,
                    alignItems:'flex-start'}}>
                    <AlertCircle size={14} color={RED} style={{flexShrink:0,marginTop:2}}/>
                    <span style={{fontSize:14,color:'#374151',fontWeight:600}}>{g}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:14}}>Tech stack audit</div>
                {[
                  {label:'CMS',           value:lead.cms||'Unknown',                         good:!!lead.cms},
                  {label:'SEO Plugin',    value:lead.seo_plugin||'None detected',             good:!!lead.seo_plugin},
                  {label:'Analytics',     value:lead.has_analytics?'Connected':'Not detected',good:lead.has_analytics},
                  {label:'CRM',           value:lead.has_crm?'Connected':'None detected',     good:lead.has_crm},
                  {label:'Call Tracking', value:lead.has_call_tracking?'Active':'None',        good:lead.has_call_tracking},
                  {label:'Schema Markup', value:lead.has_local_schema?'LocalBusiness':'None',  good:lead.has_local_schema},
                  {label:'Booking Tool',  value:lead.booking_software||'None detected',        good:!!lead.booking_software},
                  {label:'Facebook Pixel',value:lead.has_pixel?'Active':'None',                good:lead.has_pixel},
                ].map(item=>(
                  <div key={item.label} style={{display:'flex',alignItems:'center',gap:10,
                    padding:'8px 12px',background:item.good?'#f0fdf4':'#fef2f2',
                    borderRadius:9,marginBottom:7}}>
                    <div style={{width:8,height:8,borderRadius:'50%',
                      background:item.good?'#16a34a':RED,flexShrink:0}}/>
                    <div style={{flex:1,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{item.label}</span>
                      <span style={{fontSize:13,color:item.good?'#16a34a':'#374151'}}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {ai.techGaps?.length > 0 && (
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:14}}>Missing tools costing you leads</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  {ai.techGaps.map((g,i)=>(
                    <div key={i} style={{padding:'12px 14px',background:'#fff7f5',borderRadius:11,
                      border:`1px solid ${RED}20`,display:'flex',gap:10,alignItems:'flex-start'}}>
                      <X size={13} color={RED} style={{flexShrink:0,marginTop:2}}/>
                      <span style={{fontSize:13,color:'#374151'}}>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SEO TAB ── */}
        {activeTab === 'seo' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <TrendingUp size={16} color={RED}/>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>SEO Gaps</div>
                </div>
                {(ai.seoGaps||[]).map((g,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 0',
                    borderBottom:i<(ai.seoGaps||[]).length-1?'1px solid #f3f4f6':'none',alignItems:'flex-start'}}>
                    <div style={{width:20,height:20,borderRadius:6,background:`${RED}15`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,
                      fontWeight:900,color:RED,flexShrink:0}}>{i+1}</div>
                    <span style={{fontSize:14,color:'#374151'}}>{g}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <Sparkles size={16} color='#8b5cf6'/>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>AEO / AI Search Gaps</div>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:'#8b5cf6',marginBottom:12,
                  background:'#f5f3ff',padding:'5px 10px',borderRadius:20,display:'inline-block'}}>
                  ChatGPT · Perplexity · Google AI Overviews
                </div>
                {(ai.aeoGaps||[]).map((g,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 0',
                    borderBottom:i<(ai.aeoGaps||[]).length-1?'1px solid #f3f4f6':'none',alignItems:'flex-start'}}>
                    <Sparkles size={12} color='#8b5cf6' style={{flexShrink:0,marginTop:2}}/>
                    <span style={{fontSize:14,color:'#374151'}}>{g}</span>
                  </div>
                ))}
              </div>
            </div>

            {ai.keywordOpportunities?.length > 0 && (
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                <div style={{padding:'16px 22px',borderBottom:'1px solid #f3f4f6',
                  display:'flex',alignItems:'center',gap:8}}>
                  <Search size={15} color={RED}/>
                  <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Keyword Opportunities</div>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      {['Keyword','Volume','Difficulty','Opportunity'].map(h=>(
                        <th key={h} style={{padding:'11px 18px',fontSize:12,fontWeight:800,
                          color:'#111',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ai.keywordOpportunities.slice(0,8).map((kw,i)=>(
                      <tr key={i} style={{borderBottom:i<ai.keywordOpportunities.length-1?'1px solid #f9fafb':'none'}}>
                        <td style={{padding:'13px 18px',fontSize:14,fontWeight:800,color:'#111'}}>{kw.keyword}</td>
                        <td style={{padding:'13px 18px',fontSize:14,fontWeight:700,color:RED}}>{kw.volume}</td>
                        <td style={{padding:'13px 18px'}}>
                          <span style={{fontSize:12,fontWeight:800,padding:'3px 10px',borderRadius:20,
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
          </div>
        )}

        {/* ── REVENUE MODEL TAB ── */}
        {activeTab === 'revenue' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px',marginBottom:4}}>
              <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:6}}>Customize for your situation</div>
              <p style={{fontSize:14,color:'#374151',margin:0,lineHeight:1.7}}>
                The numbers below are based on real Google data and industry benchmarks. Adjust the sliders to match your actual job values, close rate, and budget to see your true revenue opportunity.
              </p>
            </div>
            <RevenueCalculator report={report} customizations={customizations} onChange={saveCustomizations}/>
          </div>
        )}

        {/* ── SOLUTIONS TAB ── */}
        {activeTab === 'solutions' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {ai.quickWins?.length > 0 && (
              <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:'22px 24px'}}>
                <div style={{fontSize:15,fontWeight:900,color:'#111',marginBottom:14}}>Quick wins — first 30 days</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {ai.quickWins.map((w,i)=>(
                    <div key={i} style={{padding:'14px',background:`${TEAL}08`,borderRadius:12,
                      border:`1px solid ${TEAL}30`,display:'flex',gap:12,alignItems:'flex-start'}}>
                      <div style={{width:34,height:34,borderRadius:10,background:`${TEAL}20`,
                        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Zap size={15} color={TEAL}/>
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:'#111',marginBottom:4}}>{w.action}</div>
                        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,
                            background:w.impact==='High'?`${RED}15`:`${TEAL}15`,
                            color:w.impact==='High'?RED:TEAL}}>{w.impact} impact</span>
                          <span style={{fontSize:11,color:'#9ca3af'}}>{w.timeline}</span>
                        </div>
                        <div style={{fontSize:12,color:'#374151',marginTop:5}}>{w.result}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ai.proposedSolutions?.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
                {ai.proposedSolutions.map((s,i)=>(
                  <div key={i} style={{background:'#fff',borderRadius:16,
                    border:`1.5px solid ${i===0?agColor+'60':'#e5e7eb'}`,padding:'22px',
                    position:'relative',overflow:'hidden'}}>
                    {i===0 && <div style={{position:'absolute',top:0,left:0,right:0,
                      height:3,background:agColor}}/>}
                    <div style={{fontSize:14,fontWeight:800,color:i===0?agColor:TEAL,marginBottom:8}}>{s.service}</div>
                    <div style={{fontSize:14,color:'#374151',lineHeight:1.6,marginBottom:12}}>{s.description}</div>
                    <div style={{fontSize:13,color:'#6b7280',paddingTop:12,
                      borderTop:'1px solid #f3f4f6',marginBottom:12}}>
                      Expected: <strong style={{color:'#374151'}}>{s.outcome}</strong>
                    </div>
                    <div style={{fontSize:20,fontWeight:900,color:'#111'}}>{s.price}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{background:BLACK,borderRadius:20,padding:'40px',marginTop:20,textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,
            background:`${agColor}20`,border:`1px solid ${agColor}40`,
            borderRadius:20,padding:'5px 16px',marginBottom:20}}>
            <Award size={13} color={agColor}/>
            <span style={{fontSize:12,fontWeight:800,color:agColor,
              textTransform:'uppercase',letterSpacing:'.08em'}}>Ready to grow</span>
          </div>
          <h2 style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:-1,
            lineHeight:1.15,margin:'0 0 16px'}}>
            Every day without action is revenue left on the table.
          </h2>
          {ai.closingStatement && (
            <p style={{fontSize:16,color:'rgba(255,255,255,.55)',lineHeight:1.8,
              maxWidth:600,margin:'0 auto 32px'}}>{ai.closingStatement}</p>
          )}
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <a href={`mailto:${agEmail}?subject=Ready to grow — ${report.business_name}&body=Hi, I reviewed my intelligence report and I'm ready to discuss growing my business.`}
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 32px',
                borderRadius:14,background:agColor,color:'#fff',fontSize:16,fontWeight:800,
                textDecoration:'none',boxShadow:`0 6px 24px ${agColor}50`}}>
              Get My Free Strategy Call <ArrowRight size={16}/>
            </a>
            {agDomain && (
              <a href={`https://${agDomain}`} target="_blank" rel="noreferrer"
                style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 24px',
                  borderRadius:14,border:'1px solid rgba(255,255,255,.2)',background:'transparent',
                  color:'rgba(255,255,255,.7)',fontSize:15,fontWeight:700,textDecoration:'none'}}>
                <Globe size={15}/> Visit {agName}
              </a>
            )}
          </div>
          <div style={{marginTop:28,display:'flex',justifyContent:'center',gap:24,
            fontSize:13,color:'rgba(255,255,255,.3)'}}>
            {agEmail && <span>{agEmail}</span>}
            {agDomain && <span>www.{agDomain}</span>}
            <span>Powered by Moose AI</span>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes barSlide { from{background-position:0%} to{background-position:200%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @media print {
          body { background:#fff!important; }
          [style*="position:sticky"],[style*="position:fixed"] { display:none!important; }
        }
      `}</style>
    </div>
  )
}
