"use client";
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ChevronRight, ChevronLeft, ExternalLink,
  Circle, CheckCircle, AlertCircle, Loader2,
  Key, Zap, Globe, HardDrive, BarChart2, Settings,
  ArrowRight, Copy, RefreshCw, Monitor, Lock,
  Link2, Server, Shield
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

// ── All connection steps ──────────────────────────────────────────────────────
const SETUP_STEPS = [
  {
    id:       'anthropic',
    label:    'Claude AI',
    sublabel: 'Powers all AI features',
    icon:     Zap,
    color:    ACCENT,
    required: true,
    url:      'https://console.anthropic.com/settings/keys',
    urlLabel: 'Open Anthropic Console',
    envKey:   'NEXT_PUBLIC_ANTHROPIC_API_KEY',
    envLabel: 'Anthropic API Key',
    desc:     'Every AI feature in Koto — review responses, client personas, Scout leads, monthly reports — runs on Claude. You need an API key from Anthropic.',
    tutorial: [
      { label: 'Sign in or create an account', action: 'Go to console.anthropic.com', highlight: 'top-right login button' },
      { label: 'Open API Keys', action: 'Click Settings in the left sidebar, then API Keys', highlight: 'left nav → Settings → API Keys' },
      { label: 'Create a new key', action: 'Click Create Key, name it "Koto", copy the key', highlight: 'Create Key button (top right of the table)' },
      { label: 'Add to Vercel', action: 'Paste as NEXT_PUBLIC_ANTHROPIC_API_KEY in Vercel env vars', highlight: null },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_ANTHROPIC_API_KEY', placeholder: 'sk-ant-api03-...' },
  },
  {
    id:       'supabase',
    label:    'Supabase HardDrive',
    sublabel: 'Stores all your data',
    icon:     HardDrive,
    color:    '#3ecf8e',
    required: true,
    url:      'https://app.supabase.com',
    urlLabel: 'Open Supabase Dashboard',
    envKey:   'NEXT_PUBLIC_SUPABASE_URL',
    envLabel: 'Supabase URL + Keys',
    desc:     'Koto stores clients, reviews, onboarding data, and all agent activity in Supabase. You need your project URL and anon key.',
    tutorial: [
      { label: 'Open your project', action: 'Go to app.supabase.com and click your Koto project', highlight: 'project card' },
      { label: 'Go to Project Settings', action: 'Click the gear icon in the bottom-left sidebar', highlight: 'gear icon in left rail' },
      { label: 'Open API settings', action: 'Click API in the settings menu', highlight: 'API menu item' },
      { label: 'Copy Project URL and anon key', action: 'Copy both values and add to Vercel', highlight: 'Project URL and anon key fields' },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_SUPABASE_URL', placeholder: 'https://xxxx.supabase.co' },
    extraVars: [
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', placeholder: 'eyJ...' },
      { key: 'SUPABASE_SERVICE_KEY', placeholder: 'eyJ... (service_role key)' },
    ],
  },
  {
    id:       'vercel',
    label:    'Vercel (Your Host)',
    sublabel: 'Platform hosting & env vars',
    icon:     Server,
    color:    '#000',
    required: true,
    url:      'https://vercel.com/dashboard',
    urlLabel: 'Open Vercel Dashboard',
    envKey:   'NEXT_PUBLIC_APP_URL',
    desc:     'Make sure your Vercel project has all environment variables set and your deployment is live.',
    tutorial: [
      { label: 'Open your project', action: 'Go to vercel.com and click your Koto project', highlight: 'project card' },
      { label: 'Go to Settings', action: 'Click Settings in the top nav of your project', highlight: 'Settings tab' },
      { label: 'Open Environment Variables', action: 'Click Environment Variables in the left sidebar', highlight: 'Environment Variables menu item' },
      { label: 'Add all required keys', action: 'Add each key from this setup wizard, then redeploy', highlight: 'Add Variable button' },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_APP_URL', placeholder: 'https://your-project.vercel.app' },
  },
  {
    id:       'google_places',
    label:    'Google Places API',
    sublabel: 'Powers Scout live data',
    icon:     Globe,
    color:    '#4285f4',
    required: false,
    url:      'https://console.cloud.google.com/apis/credentials',
    urlLabel: 'Open Google Cloud Console',
    envKey:   'NEXT_PUBLIC_GOOGLE_PLACES_KEY',
    desc:     'Enables Scout to pull real live business data from Google Maps — verified names, ratings, reviews, phone numbers, and websites.',
    tutorial: [
      { label: 'Open Credentials page', action: 'Go to console.cloud.google.com → APIs & Services → Credentials', highlight: 'Credentials in left nav' },
      { label: 'Create an API Key', action: 'Click Create Credentials at the top, choose API Key', highlight: 'Create Credentials button' },
      { label: 'Restrict the key', action: 'Click the key → API restrictions → Select Places API', highlight: 'API restrictions section' },
      { label: 'Copy and add to Vercel', action: 'Copy the key and add as NEXT_PUBLIC_GOOGLE_PLACES_KEY', highlight: null },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_GOOGLE_PLACES_KEY', placeholder: 'AIzaSy...' },
  },
  {
    id:       'google_oauth',
    label:    'Google OAuth',
    sublabel: 'SEO Connect login',
    icon:     Shield,
    color:    '#34a853',
    required: false,
    url:      'https://console.cloud.google.com/apis/credentials',
    urlLabel: 'Open Google Cloud Console',
    envKey:   'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    desc:     'Allows agencies to log in with Google and connect Google Search Console data for the SEO Hub.',
    tutorial: [
      { label: 'Go to Credentials', action: 'console.cloud.google.com → APIs & Services → Credentials', highlight: 'Credentials in left nav' },
      { label: 'Create OAuth 2.0 Client', action: 'Create Credentials → OAuth client ID → Web application', highlight: 'Create Credentials button' },
      { label: 'Add Authorized Origins', action: 'Add your Vercel URL to Authorized JavaScript origins', highlight: 'Authorized JavaScript origins field' },
      { label: 'Add Redirect URIs', action: 'Add your Vercel URL to Authorized redirect URIs too', highlight: 'Authorized redirect URIs field' },
      { label: 'Copy Client ID', action: 'Copy Client ID and add as NEXT_PUBLIC_GOOGLE_CLIENT_ID', highlight: null },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', placeholder: '88526871187-xxx.apps.googleusercontent.com' },
    extraVars: [{ key: 'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET', placeholder: 'GOCSPX-...' }],
  },
  {
    id:       'ghl',
    label:    'GoHighLevel',
    sublabel: 'CRM sync',
    icon:     Link2,
    color:    '#f59e0b',
    required: false,
    url:      'https://marketplace.gohighlevel.com/',
    urlLabel: 'Open GHL Marketplace',
    envKey:   'NEXT_PUBLIC_GHL_CLIENT_ID',
    desc:     'Connects Koto to GoHighLevel for two-way CRM sync — push client onboarding data into GHL, pull contact updates back.',
    tutorial: [
      { label: 'Create a Marketplace App', action: 'Go to marketplace.gohighlevel.com → My Apps → Create App', highlight: 'Create App button' },
      { label: 'Set app type', action: 'Choose Agency app, fill in name and description', highlight: 'App type selector' },
      { label: 'Add redirect URI', action: 'Set redirect URI to your-app.vercel.app/api/integrations/ghl/callback', highlight: 'Redirect URI field' },
      { label: 'Copy Client ID and Secret', action: 'Copy both and add to Vercel env vars', highlight: 'Client ID and Secret fields' },
    ],
    vercelVar: { key: 'NEXT_PUBLIC_GHL_CLIENT_ID', placeholder: 'your-ghl-client-id' },
    extraVars: [{ key: 'GHL_CLIENT_SECRET', placeholder: 'your-ghl-client-secret' }],
  },
]

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = {
    complete: { color:'#16a34a', bg:'#f0fdf4', label:'Complete',   icon: CheckCircle },
    skipped:  { color:'#4b5563', bg:'#f3f4f6', label:'Skipped',    icon: Circle },
    pending:  { color:'#d97706', bg:'#fffbeb', label:'In Progress', icon: AlertCircle },
    todo:     { color:'#4b5563', bg:'#f9fafb', label:'To Do',      icon: Circle },
  }[status] || { color:'#4b5563', bg:'#f9fafb', label:'To Do', icon: Circle }
  const Icon = cfg.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, background:cfg.bg, fontSize:13, fontWeight:700, color:cfg.color }}>
      <Icon size={11}/> {cfg.label}
    </span>
  )
}

// ── Iframe viewer ─────────────────────────────────────────────────────────────
function IframeViewer({ url, step, tutorialStep }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => { setLoaded(false); setError(false) }, [url])

  // Most external sites block iframe embedding (X-Frame-Options)
  // We show the site in a styled preview with a direct link fallback
  const blockedDomains = [
    'console.anthropic.com', 'console.cloud.google.com',
    'app.supabase.com', 'vercel.com', 'marketplace.gohighlevel.com'
  ]
  const isBlocked = blockedDomains.some(d => url.includes(d))

  if (isBlocked) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', background:'#f9fafb' }}>
      {/* Browser chrome */}
      <div style={{ background:'#f3f4f6', borderBottom:'1px solid #e5e7eb', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', gap:6 }}>
          {['#ff5f57','#ffbd2e','#28c840'].map(c=><div key={c} style={{ width:12, height:12, borderRadius:'50%', background:c }}/>)}
        </div>
        <div style={{ flex:1, background:'#fff', borderRadius:8, padding:'5px 12px', fontSize:14, color:'#374151', border:'1px solid #e5e7eb', fontFamily:'monospace' }}>
          {url}
        </div>
        <a href={url} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>
          <ExternalLink size={12}/> Open
        </a>
      </div>

      {/* Preview panel - shows the step context instead of iframe */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', textAlign:'center' }}>
        <div style={{ width:64, height:64, borderRadius:16, background:step.color+'15', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          <step.icon size={28} color={step.color}/>
        </div>
        <div style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:8 }}>Open {step.label}</div>
        <div style={{ fontSize:15, color:'#374151', lineHeight:1.7, maxWidth:380, marginBottom:24 }}>
          This page requires you to be logged into {step.label.split(' ')[0]}. Click Open to launch it in a new tab, then follow the steps on the right.
        </div>

        {/* Current tutorial step callout */}
        {tutorialStep && (
          <div style={{ background:'#fff', borderRadius:14, border:`2px solid ${step.color}`, padding:'16px 20px', maxWidth:420, width:'100%', textAlign:'left', marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:step.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              Current Step
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:6 }}>{tutorialStep.label}</div>
            <div style={{ fontSize:15, color:'#374151', lineHeight:1.6 }}>{tutorialStep.action}</div>
            {tutorialStep.highlight && (
              <div style={{ marginTop:10, padding:'8px 12px', background:step.color+'10', borderRadius:8, fontSize:14, color:step.color, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>
                <AlertCircle size={13}/>
                Look for: <strong>{tutorialStep.highlight}</strong>
              </div>
            )}
          </div>
        )}

        <a href={url} target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 28px', borderRadius:12, background:step.color, color:'#fff', fontSize:15, fontWeight:700, textDecoration:'none', boxShadow:`0 4px 16px ${step.color}40` }}>
          <ExternalLink size={15}/> Open {step.urlLabel || step.label}
        </a>
        <div style={{ fontSize:14, color:'#4b5563', marginTop:12 }}>Opens in a new tab — come back here when done</div>
      </div>
    </div>
  )

  // For non-blocked URLs, try actual iframe
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
      <div style={{ background:'#f3f4f6', borderBottom:'1px solid #e5e7eb', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', gap:6 }}>
          {['#ff5f57','#ffbd2e','#28c840'].map(c=><div key={c} style={{ width:12, height:12, borderRadius:'50%', background:c }}/>)}
        </div>
        <div style={{ flex:1, background:'#fff', borderRadius:8, padding:'5px 12px', fontSize:14, color:'#374151', border:'1px solid #e5e7eb', fontFamily:'monospace' }}>{url}</div>
        <a href={url} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:14, fontWeight:700, textDecoration:'none' }}>
          <ExternalLink size={12}/> New Tab
        </a>
      </div>
      {!loaded && !error && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Loader2 size={24} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/>
        </div>
      )}
      <iframe ref={iframeRef} src={url} onLoad={()=>setLoaded(true)} onError={()=>setError(true)}
        style={{ flex:1, border:'none', display:loaded?'block':'none' }} title={step.label} allow="*"/>
    </div>
  )
}

// ── Env var input row ─────────────────────────────────────────────────────────
function EnvVarRow({ varDef, value, onChange }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyKey() {
    navigator.clipboard.writeText(varDef.key)
    setCopied(true)
    setTimeout(()=>setCopied(false), 2000)
  }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <code style={{ fontSize:14, fontWeight:700, color:'#374151', background:'#f3f4f6', padding:'2px 8px', borderRadius:6, fontFamily:'monospace' }}>
          {varDef.key}
        </code>
        <button onClick={copyKey} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', fontSize:13, cursor:'pointer', color: copied?'#16a34a':'#6b7280' }}>
          {copied ? <CheckCircle size={10}/> : <Copy size={10}/>}
          {copied ? 'Copied' : 'Copy key name'}
        </button>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={varDef.placeholder}
          style={{ flex:1, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${value?'#16a34a':'#e5e7eb'}`, fontSize:15, outline:'none', fontFamily:'monospace', color:'#111', background:'#fff' }}
        />
        <button onClick={()=>setShow(s=>!s)}
          style={{ padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151', display:'flex', alignItems:'center' }}>
          {show ? <Lock size={14}/> : <Key size={14}/>}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgencySetupPage() {
  const navigate    = useNavigate()
  const [activeStep, setActiveStep]   = useState(0)
  const [tutStep, setTutStep]         = useState(0)
  const [statuses, setStatuses]       = useState({})   // stepId -> 'complete'|'skipped'|'pending'|'todo'
  const [envVals, setEnvVals]         = useState({})   // varKey -> value
  const [verifying, setVerifying]     = useState(false)

  const step = SETUP_STEPS[activeStep]
  const totalRequired = SETUP_STEPS.filter(s=>s.required).length
  const totalComplete = SETUP_STEPS.filter(s=>statuses[s.id]==='complete').length
  const progress = Math.round((totalComplete / SETUP_STEPS.length) * 100)

  function setStatus(stepId, status) {
    setStatuses(prev => ({ ...prev, [stepId]: status }))
  }

  function setEnv(key, val) {
    setEnvVals(prev => ({ ...prev, [key]: val }))
  }

  function markComplete() {
    setStatus(step.id, 'complete')
    if (activeStep < SETUP_STEPS.length - 1) {
      setActiveStep(i => i + 1)
      setTutStep(0)
    }
  }

  function markSkipped() {
    setStatus(step.id, 'skipped')
    if (activeStep < SETUP_STEPS.length - 1) {
      setActiveStep(i => i + 1)
      setTutStep(0)
    }
  }

  function goTo(idx) {
    setActiveStep(idx)
    setTutStep(0)
    if (statuses[SETUP_STEPS[idx].id] === 'todo' || !statuses[SETUP_STEPS[idx].id]) {
      setStatus(SETUP_STEPS[idx].id, 'pending')
    }
  }

  // Mark step as pending when first viewed
  useEffect(() => {
    if (!statuses[step.id]) setStatus(step.id, 'pending')
  }, [activeStep])

  const currentTutStep = step.tutorial[tutStep]

  return (
    <div className="page-shell" style={{ display:'flex', minHeight:'100vh', background:'#f2f2f0' }}>
      <Sidebar/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', height:'100vh' }}>

        {/* ── Header ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'14px 24px', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#111' }}>Platform Setup</div>
            <div style={{ fontSize:14, color:'#4b5563' }}>Owner-only — connect backend infrastructure to activate all platform features</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:15, color:'#374151' }}>{totalComplete} / {SETUP_STEPS.length} connected</div>
            <div style={{ width:160, height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, background:ACCENT, borderRadius:3, transition:'width .4s' }}/>
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:ACCENT }}>{progress}%</div>
            {totalComplete >= totalRequired && (
              <button onClick={()=>navigate('/')}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                Go to Dashboard <ArrowRight size={13}/>
              </button>
            )}
          </div>
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* ── Left: step list ── */}
          <div style={{ width:260, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'16px 14px 8px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em' }}>Connection Steps</div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {SETUP_STEPS.map((s, i) => {
                const status  = statuses[s.id] || 'todo'
                const active  = i === activeStep
                const Icon    = s.icon
                return (
                  <button key={s.id} onClick={()=>goTo(i)}
                    style={{ width:'100%', textAlign:'left', padding:'14px 16px', border:'none', borderBottom:'1px solid #f9fafb', background:active?'#f0fbfc':'#fff', cursor:'pointer', borderLeft:`3px solid ${active?ACCENT:'transparent'}`, transition:'all .15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:active?ACCENT+'15':status==='complete'?'#f0fdf4':'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
                        <Icon size={16} color={active?s.color:status==='complete'?'#16a34a':'#9ca3af'}/>
                        {status==='complete' && (
                          <div style={{ position:'absolute', bottom:-3, right:-3, width:14, height:14, borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Check size={8} color="#fff" strokeWidth={3}/>
                          </div>
                        )}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:active?'#111':'#374151', display:'flex', alignItems:'center', gap:6 }}>
                          {s.label}
                          {s.required && <span style={{ fontSize:13, fontWeight:800, color:ACCENT, background:'#f0fbfc', padding:'1px 5px', borderRadius:4, border:`1px solid ${ACCENT}30` }}>REQ</span>}
                        </div>
                        <div style={{ fontSize:13, color:'#4b5563', marginTop:1 }}>{s.sublabel}</div>
                      </div>
                      <StatusPill status={status}/>
                    </div>
                  </button>
                )
              })}
            </div>
            <div style={{ padding:'14px 16px', borderTop:'1px solid #f3f4f6', background:'#f9fafb' }}>
              <button onClick={()=>navigate('/')} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:15, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                Skip for now — go to Dashboard
              </button>
            </div>
          </div>

          {/* ── Center: iframe/preview ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'20px', gap:0, overflow:'hidden' }}>
            <IframeViewer url={step.url} step={step} tutorialStep={currentTutStep}/>
          </div>

          {/* ── Right: tutorial panel ── */}
          <div style={{ width:340, flexShrink:0, background:'#fff', borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {/* Step header */}
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:step.color+'15', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <step.icon size={20} color={step.color}/>
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>{step.label}</div>
                  <div style={{ fontSize:14, color:'#4b5563' }}>{step.sublabel}</div>
                </div>
                <StatusPill status={statuses[step.id]||'pending'}/>
              </div>
              <div style={{ fontSize:15, color:'#374151', lineHeight:1.65 }}>{step.desc}</div>
            </div>

            {/* Tutorial steps */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', flex:'none' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>
                Step-by-Step Guide
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {step.tutorial.map((t, i) => {
                  const done    = i < tutStep
                  const current = i === tutStep
                  return (
                    <button key={i} onClick={()=>setTutStep(i)}
                      style={{ textAlign:'left', padding:'10px 12px', borderRadius:12, border:`1.5px solid ${current?step.color:done?'#e5e7eb':'#f3f4f6'}`, background:current?step.color+'08':done?'#f9fafb':'#fff', cursor:'pointer', transition:'all .15s' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                        <div style={{ width:22, height:22, borderRadius:'50%', background:done?'#16a34a':current?step.color:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                          {done ? <Check size={11} color="#fff" strokeWidth={3}/>
                               : <span style={{ fontSize:13, fontWeight:800, color:current?'#fff':'#9ca3af' }}>{i+1}</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:15, fontWeight:done?500:700, color:done?'#9ca3af':current?'#111':'#374151', textDecoration:done?'line-through':'' }}>{t.label}</div>
                          {current && <div style={{ fontSize:14, color:'#374151', lineHeight:1.5, marginTop:3 }}>{t.action}</div>}
                          {current && t.highlight && (
                            <div style={{ marginTop:6, padding:'6px 10px', background:step.color+'12', borderRadius:7, fontSize:13, color:step.color, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                              <AlertCircle size={11}/> Look for: {t.highlight}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                {tutStep > 0 && (
                  <button onClick={()=>setTutStep(t=>t-1)} style={{ flex:1, padding:'8px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:14, color:'#374151', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <ChevronLeft size={13}/> Back
                  </button>
                )}
                {tutStep < step.tutorial.length - 1 ? (
                  <button onClick={()=>setTutStep(t=>t+1)} style={{ flex:1, padding:'8px', borderRadius:9, border:'none', background:step.color, cursor:'pointer', fontSize:14, color:'#fff', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    Next Step <ChevronRight size={13}/>
                  </button>
                ) : (
                  <button onClick={()=>{ setTutStep(step.tutorial.length-1) }} style={{ flex:1, padding:'8px', borderRadius:9, border:`1.5px solid ${step.color}`, background:'#fff', cursor:'pointer', fontSize:14, color:step.color, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Check size={13}/> All steps done
                  </button>
                )}
              </div>
            </div>

            {/* Env var inputs */}
            <div className="animate-fade-in" style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>
                Vercel Environment Variables
              </div>
              <div style={{ marginBottom:12, padding:'10px 12px', background:'#f9fafb', borderRadius:10, fontSize:14, color:'#374151', lineHeight:1.5 }}>
                Paste your values below to keep track. Then add them to Vercel → Settings → Environment Variables.
              </div>

              {step.vercelVar && (
                <EnvVarRow varDef={step.vercelVar} value={envVals[step.vercelVar.key]} onChange={v=>setEnv(step.vercelVar.key, v)}/>
              )}
              {step.extraVars?.map(v => (
                <EnvVarRow key={v.key} varDef={v} value={envVals[v.key]} onChange={val=>setEnv(v.key, val)}/>
              ))}

              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#f9fafb', color:'#374151', textDecoration:'none', fontSize:14, fontWeight:700, marginTop:4 }}>
                <ExternalLink size={13}/> Open Vercel Environment Variables
              </a>
            </div>

            {/* Bottom actions */}
            <div style={{ padding:'16px 20px', borderTop:'1px solid #f3f4f6', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              <button onClick={markComplete}
                style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <CheckCircle size={16}/>
                Mark as Connected
              </button>
              {!step.required && (
                <button onClick={markSkipped}
                  style={{ width:'100%', padding:'10px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:15, cursor:'pointer' }}>
                  Skip for now
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
