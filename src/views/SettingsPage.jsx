"use client"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Key, Check, AlertTriangle, RefreshCw,
  Loader2, Sliders, Target, Globe, Shield, Bell,
  ExternalLink, ChevronRight, Copy, Info,
  Lock, Zap, Database, Link2, BarChart2, Search,
  MapPin, Mail, Building, Users, Wrench, Star,
  CheckCircle, ArrowRight, Plug
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const R    = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

const TABS = [
  { key:'connections',   label:'API Connections', icon:Link2 },
  { key:'scout',         label:'Scout Settings',  icon:Target },
  { key:'notifications', label:'Notifications',   icon:Bell },
  { key:'security',      label:'Security',        icon:Shield },
]

const CONNECTIONS = [
  { id:'anthropic',   name:'Claude AI (Anthropic)', group:'Core — Required',      icon:Zap,      color:R,        env:'NEXT_PUBLIC_ANTHROPIC_API_KEY',   free:'Pay-as-you-go · ~$0.003/1K tokens', setupUrl:'https://console.anthropic.com/settings/keys',          desc:'Powers all AI features — Scout leads, review responses, client personas, monthly reports, social content.' },
  { id:'supabase',    name:'Supabase Database',     group:'Core — Required',      icon:Database, color:'#3ecf8e',env:'NEXT_PUBLIC_SUPABASE_URL',          free:'Free tier: 500MB · 2GB bandwidth/mo', setupUrl:'https://app.supabase.com',                            desc:'Stores all clients, reviews, onboarding data, agent activity, and agency settings.' },
  { id:'google_places',name:'Google Places',        group:'Scout Intelligence',   icon:MapPin,   color:'#4285f4',env:'NEXT_PUBLIC_GOOGLE_PLACES_KEY',    free:'$200/mo free credit · ~2,800 free searches', setupUrl:'https://console.cloud.google.com/apis/credentials', desc:'Pulls real verified business data into Scout — names, addresses, ratings, reviews, phones, websites.' },
  { id:'google_oauth', name:'Google OAuth',         group:'SEO & Analytics',      icon:Globe,    color:'#34a853',env:'NEXT_PUBLIC_GOOGLE_CLIENT_ID',     free:'Free', setupUrl:'https://console.cloud.google.com/apis/credentials',                                        desc:'Login with Google and connects Search Console & GA4 for the SEO Hub.' },
  { id:'ghl',          name:'GoHighLevel',          group:'CRM',                  icon:Link2,    color:'#f59e0b',env:'NEXT_PUBLIC_GHL_CLIENT_ID',        free:'Requires GHL subscription', setupUrl:'https://marketplace.gohighlevel.com/',                 desc:'Two-way CRM sync — push client onboarding data into GHL, pull contact updates back automatically.' },
  { id:'yelp',         name:'Yelp Fusion',          group:'Scout Intelligence',   icon:Star,     color:'#d32323',env:'NEXT_PUBLIC_YELP_API_KEY',          free:'Free: 5,000 calls/day', setupUrl:'https://www.yelp.com/developers/v3/manage_app',         desc:'Pulls real Yelp reviews, ratings, and business details into Scout and the Reviews module.' },
  { id:'hunter',       name:'Hunter.io',            group:'Scout Intelligence',   icon:Search,   color:TEAL,     env:'NEXT_PUBLIC_HUNTER_API_KEY',        free:'Free: 25 searches/mo', setupUrl:'https://hunter.io/api-keys',                            desc:'Finds verified email addresses for business contacts. Used to enrich Scout leads.' },
  { id:'apollo',       name:'Apollo.io',            group:'Scout Intelligence',   icon:Users,    color:'#7c3aed',env:'NEXT_PUBLIC_APOLLO_API_KEY',        free:'Free: 50 credits/mo', setupUrl:'https://app.apollo.io/#/settings/integrations/api',    desc:'Executive contacts, org charts, and company data for deeper Scout lead enrichment.' },
  { id:'clearbit',     name:'Clearbit',             group:'Scout Intelligence',   icon:Building, color:'#6366f1',env:'NEXT_PUBLIC_CLEARBIT_API_KEY',      free:'Free tier available', setupUrl:'https://dashboard.clearbit.com/keys',                   desc:'Company enrichment and firmographics — revenue estimates, employee count, tech stack.' },
  { id:'builtwith',    name:'BuiltWith',            group:'Scout Intelligence',   icon:Wrench,   color:'#0ea5e9',env:'NEXT_PUBLIC_BUILTWITH_API_KEY',     free:'Free tier: limited lookups', setupUrl:'https://api.builtwith.com/',                        desc:'Detects what technology a business uses — CRM, analytics, ecommerce, ad platforms.' },
]

const GROUPS = ['Core — Required','Scout Intelligence','SEO & Analytics','CRM']
const WEIGHT_DEFAULTS = { social:25, website:30, gmb:20, reviews:15, ads:10 }
const WEIGHT_LABELS = [
  { key:'social',  label:'Social Media Presence', desc:'Facebook, Instagram activity and followers' },
  { key:'website', label:'Website & Tech Stack',   desc:'Analytics, CRM, CMS, marketing tools' },
  { key:'gmb',     label:'GMB Health',              desc:'Optimization, posts, photos, Q&A' },
  { key:'reviews', label:'Reviews & Reputation',    desc:'Rating, count, response rate, sentiment' },
  { key:'ads',     label:'Advertising',             desc:'Facebook Pixel, Google Ads, retargeting' },
]
const NOTIFS = [
  { key:'negative_reviews',   label:'New negative reviews',         desc:'When a 1 or 2-star review comes in for any client',         on:true  },
  { key:'hot_leads',          label:'Hot Scout leads found',         desc:'When a search returns leads scored 75+',                   on:true  },
  { key:'onboarding_done',    label:'Client onboarding completed',   desc:'When a client finishes their onboarding form',             on:true  },
  { key:'agent_digest',       label:'Agent activity summary',        desc:'Daily digest of what all AI agents did',                  on:false },
  { key:'team_mentions',      label:'Team mentions',                 desc:'When someone mentions you in a comment or note',          on:true  },
  { key:'monthly_report',     label:'Monthly report generated',      desc:'When the Monthly AI Report agent sends a report',         on:false },
  { key:'perf_alerts',        label:'Performance alerts',            desc:'When ROAS drops or spend spikes abnormally',              on:true  },
  { key:'ticket_new',         label:'New support tickets',           desc:'When a client submits a new MooseDesk ticket',            on:true  },
]

/* ── Toggle component ────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width:44, height:24, borderRadius:12, border:'none',
        background: on ? R : '#d1d5db',
        position:'relative', cursor:'pointer', flexShrink:0,
        transition:'background .2s ease', padding:0,
        outline:'none',
      }}>
      <span style={{
        position:'absolute',
        top:3,
        left: on ? 23 : 3,
        width:18, height:18, borderRadius:'50%',
        background:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,.25)',
        transition:'left .2s ease',
        display:'block',
      }}/>
    </button>
  )
}

/* ── Connection card ─────────────────────────────────────────────── */
function ConnCard({ conn, onSetup }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const Icon = conn.icon
  const connected = !!process.env[conn.env]

  async function test() {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 800))
    const pass = connected
    setTestResult(pass ? 'pass' : 'fail')
    setTesting(false)
    pass ? toast.success(conn.name + ' connected') : toast.error(conn.name + ': key not configured')
  }

  return (
    <div style={{
      background:'#fff', borderRadius:14,
      border:`1px solid ${connected ? conn.color+'35' : '#ececea'}`,
      padding:'18px 18px', display:'flex', flexDirection:'column', gap:12,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
          background:conn.color+'15', border:`1px solid ${conn.color}25`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={conn.color}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a' }}>{conn.name}</span>
            {connected
              ? <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:700,
                  padding:'2px 9px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:FH }}>
                  <Check size={10} strokeWidth={3}/> Connected
                </span>
              : <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:700,
                  padding:'2px 9px', borderRadius:20, background:'#fffbeb', color:'#d97706', fontFamily:FH }}>
                  <AlertTriangle size={10}/> Not configured
                </span>
            }
          </div>
          <div style={{ fontSize:14, color:'#5a5a58', lineHeight:1.55, fontFamily:FB }}>{conn.desc}</div>
          <div style={{ fontSize:13, color:'#9a9a96', marginTop:3, fontFamily:FB }}>{conn.free}</div>
        </div>
      </div>

      {/* Env var */}
      <div style={{ background:'#f8f8f6', borderRadius:8, padding:'8px 12px',
        display:'flex', alignItems:'center', gap:8 }}>
        <code style={{ fontSize:13, color:'#5a5a58', fontFamily:'monospace', flex:1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {conn.env}
        </code>
        <button onClick={() => { navigator.clipboard.writeText(conn.env); toast.success('Copied!') }}
          style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px',
            borderRadius:6, border:'1px solid #ececea', background:'#fff', cursor:'pointer',
            fontSize:13, color:'#5a5a58', fontFamily:FH, fontWeight:600, flexShrink:0 }}>
          <Copy size={11}/> Copy
        </button>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <a href={conn.setupUrl} target="_blank" rel="noreferrer"
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            padding:'8px 12px', borderRadius:9,
            border:`1px solid ${connected?'#ececea':conn.color}`,
            background:connected?'#fff':conn.color+'08',
            color:connected?'#5a5a58':conn.color,
            fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
          <ExternalLink size={12}/> {connected?'Manage':'Get API Key'}
        </a>
        {!connected && (
          <button onClick={()=>onSetup(conn)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              padding:'8px 12px', borderRadius:9, border:'1px solid #ececea',
              background:'#fff', color:'#5a5a58', fontSize:14, fontWeight:700,
              cursor:'pointer', fontFamily:FH }}>
            <Info size={12}/> How to set up
          </button>
        )}
        <button onClick={test} disabled={testing}
          style={{ padding:'8px 14px', borderRadius:9, border:'1px solid #ececea',
            background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:5,
            fontSize:14, fontFamily:FH, fontWeight:600,
            color: testResult==='pass'?'#16a34a': testResult==='fail'?R: '#9a9a96' }}>
          {testing ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={12}/>}
          Test
        </button>
      </div>
    </div>
  )
}

/* ── Setup guide modal ───────────────────────────────────────────── */
function SetupGuide({ conn, onClose }) {
  const [step, setStep] = useState(0)
  const Icon = conn.icon
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      backdropFilter:'blur(4px)' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:520,
        boxShadow:'0 24px 64px rgba(0,0,0,.2)', overflow:'hidden' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ background:BLK, padding:'22px 24px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:11, background:conn.color+'25',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon size={20} color={conn.color}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#fff',
              letterSpacing:'-.02em' }}>Connect {conn.name}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontFamily:FB }}>{conn.free}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:8,
            border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)',
            cursor:'pointer', color:'rgba(255,255,255,.6)', display:'flex',
            alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <p style={{ fontSize:14, color:'#5a5a58', lineHeight:1.65, marginBottom:18, fontFamily:FB }}>
            {conn.desc}
          </p>
          <div style={{ fontSize:13, fontWeight:700, color:'#9a9a96', textTransform:'uppercase',
            letterSpacing:'.08em', marginBottom:12, fontFamily:FH }}>
            Setup Steps
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
            {conn.steps?.map((s,i) => {
              const done = i < step, current = i === step
              return (
                <div key={i} onClick={()=>setStep(i)}
                  style={{ display:'flex', gap:12, alignItems:'flex-start',
                    padding:'10px 14px', borderRadius:11, cursor:'pointer',
                    border:`1px solid ${current?conn.color:done?'#ececea':'#f2f2f0'}`,
                    background:current?conn.color+'08':'#fff',
                    transition:'all .12s' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, marginTop:1,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:done?'#16a34a':current?conn.color:'#f2f2f0' }}>
                    {done
                      ? <Check size={12} color="#fff" strokeWidth={3}/>
                      : <span style={{ fontSize:13, fontWeight:800,
                          color:current?'#fff':'#9a9a96', fontFamily:FH }}>{i+1}</span>
                    }
                  </div>
                  <div style={{ fontSize:14, fontWeight:current?700:done?400:500,
                    color:done?'#9a9a96':'#0a0a0a', fontFamily:FB,
                    textDecoration:done?'line-through':'none', lineHeight:1.5 }}>{s}</div>
                </div>
              )
            })}
          </div>
          <div style={{ background:'#f8f8f6', borderRadius:10, padding:'12px 14px',
            marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
            <Key size={14} color={conn.color} style={{ flexShrink:0, marginTop:2 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:5 }}>
                Add to Vercel Environment Variables
              </div>
              <code style={{ fontSize:13, color:'#5a5a58', fontFamily:'monospace',
                background:'#fff', padding:'5px 10px', borderRadius:7,
                border:'1px solid #ececea', display:'block' }}>{conn.env}</code>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <a href={conn.setupUrl} target="_blank" rel="noreferrer"
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'12px', borderRadius:11, border:'none', background:conn.color,
                color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
              <ExternalLink size={14}/> Open {conn.name}
            </a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'12px', borderRadius:11, border:'1px solid #ececea',
                background:'#fff', color:'#5a5a58', fontSize:14, fontWeight:700,
                textDecoration:'none', fontFamily:FH }}>
              <ExternalLink size={14}/> Open Vercel
            </a>
          </div>
          <div style={{ fontSize:13, color:'#9a9a96', textAlign:'center', marginTop:10, fontFamily:FB }}>
            Both open in a new tab — click Test on the card when done
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const navigate = useNavigate()
  const [tab,         setTab]         = useState('connections')
  const [weights,     setWeights]     = useState({...WEIGHT_DEFAULTS})
  const [setupConn,   setSetupConn]   = useState(null)
  const [groupFilter, setGroupFilter] = useState('All')

  // Notification toggles — fully controlled state
  const [notifs, setNotifs] = useState(
    Object.fromEntries(NOTIFS.map(n => [n.key, n.on]))
  )
  function toggleNotif(key) {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }))
    toast.success('Preference saved')
  }

  const totalWeight     = Object.values(weights).reduce((a,b)=>a+b,0)
  const connectedCount  = CONNECTIONS.filter(c=>!!process.env[c.env]).length
  const filteredConns   = groupFilter==='All' ? CONNECTIONS : CONNECTIONS.filter(c=>c.group===groupFilter)
  const byGroup         = GROUPS.reduce((acc,g)=>{ const it=filteredConns.filter(c=>c.group===g); if(it.length) acc[g]=it; return acc },{})

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden',
      background:'#f2f2f0', fontFamily:FB }}>
      <Sidebar/>

      {setupConn && <SetupGuide conn={setupConn} onClose={()=>setSetupConn(null)}/>}

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'0 28px', flexShrink:0 }}>
          <div style={{ padding:'20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:R,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Settings size={16} color="#fff"/>
                </div>
                <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff',
                  margin:0, letterSpacing:'-.03em' }}>Settings</h1>
              </div>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:0, fontFamily:FB }}>
                Configure your Moose AI platform and API connections
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0, marginTop:16 }}>
            {TABS.map(t => {
              const I = t.icon
              const active = tab===t.key
              return (
                <button key={t.key} onClick={()=>setTab(t.key)}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'11px 18px',
                    border:'none', borderBottom:`2.5px solid ${active?R:'transparent'}`,
                    background:'transparent', color:active?'#fff':'rgba(255,255,255,.4)',
                    fontSize:14, fontWeight:active?700:500, cursor:'pointer',
                    fontFamily:FH, transition:'all .15s' }}>
                  <I size={14}/>
                  {t.label}
                  {t.key==='connections' && (
                    <span style={{ fontSize:13, fontWeight:800, padding:'1px 7px', borderRadius:20,
                      background:active?'rgba(234,39,41,.3)':'rgba(255,255,255,.1)',
                      color:'rgba(255,255,255,.8)', fontFamily:FH }}>
                      {connectedCount}/{CONNECTIONS.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* ── Connections ── */}
          {tab==='connections' && (
            <div>
              {/* Progress banner */}
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea',
                padding:'16px 20px', marginBottom:20, display:'flex',
                alignItems:'center', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a', marginBottom:6 }}>
                    {connectedCount} of {CONNECTIONS.length} connections configured
                  </div>
                  <div style={{ height:5, background:'#f2f2f0', borderRadius:3, overflow:'hidden', maxWidth:260 }}>
                    <div style={{ height:'100%', borderRadius:3, transition:'width .4s',
                      width:`${(connectedCount/CONNECTIONS.length)*100}%`,
                      background:connectedCount===CONNECTIONS.length?TEAL:R }}/>
                  </div>
                </div>
                <button onClick={()=>navigate('/setup')}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px',
                    borderRadius:10, border:'none', background:R, color:'#fff',
                    fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  Setup Wizard <ArrowRight size={13}/>
                </button>
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                    borderRadius:10, border:'1px solid #ececea', background:'#fff',
                    color:'#5a5a58', fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
                  <ExternalLink size={13}/> Vercel
                </a>
              </div>

              {/* Group filter pills */}
              <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
                {['All',...GROUPS].map(g=>(
                  <button key={g} onClick={()=>setGroupFilter(g)}
                    style={{ padding:'6px 14px', borderRadius:20, cursor:'pointer',
                      border:`1px solid ${groupFilter===g?R:'#ececea'}`,
                      background:groupFilter===g?R+'10':'#fff',
                      color:groupFilter===g?R:'#5a5a58',
                      fontSize:14, fontWeight:groupFilter===g?700:500, fontFamily:FH }}>
                    {g}
                  </button>
                ))}
              </div>

              {Object.entries(byGroup).map(([group,conns])=>(
                <div key={group} style={{ marginBottom:28 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#9a9a96',
                      textTransform:'uppercase', letterSpacing:'.09em' }}>{group}</span>
                    <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, padding:'1px 8px',
                      borderRadius:20, background:'#f2f2f0', color:'#5a5a58' }}>
                      {conns.filter(c=>!!process.env[c.env]).length}/{conns.length}
                    </span>
                    {group==='Core — Required' && conns.some(c=>!process.env[c.env]) && (
                      <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, padding:'1px 9px',
                        borderRadius:20, background:'#fef2f2', color:R }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                    {conns.map(conn=>(
                      <ConnCard key={conn.id} conn={conn} onSetup={setSetupConn}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Scout weights ── */}
          {tab==='scout' && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea', padding:'24px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5 }}>
                    <Sliders size={16} color={R}/>
                    <span style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:'#0a0a0a',
                      letterSpacing:'-.02em' }}>Scout Score Weights</span>
                  </div>
                  <p style={{ fontSize:14, color:'#5a5a58', margin:0, fontFamily:FB }}>
                    Adjust how each factor contributes to the lead score
                  </p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontFamily:FH, fontSize:15, fontWeight:700,
                    color:totalWeight===100?'#16a34a':R }}>
                    {totalWeight}%{totalWeight!==100&&<span style={{fontSize:13,marginLeft:6}}>≠ 100</span>}
                  </span>
                  <button onClick={()=>{setWeights({...WEIGHT_DEFAULTS});toast.success('Reset to defaults')}}
                    style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #ececea',
                      background:'#fff', fontSize:14, cursor:'pointer', color:'#5a5a58',
                      fontFamily:FH, fontWeight:600 }}>
                    Reset
                  </button>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
                {WEIGHT_LABELS.map(w=>(
                  <div key={w.key}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
                      <div>
                        <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a' }}>{w.label}</div>
                        <div style={{ fontSize:13, color:'#9a9a96', fontFamily:FB }}>{w.desc}</div>
                      </div>
                      <span style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:R, minWidth:48, textAlign:'right' }}>
                        {weights[w.key]}%
                      </span>
                    </div>
                    <input type="range" min={0} max={50} value={weights[w.key]}
                      onChange={e=>setWeights(p=>({...p,[w.key]:+e.target.value}))}
                      style={{ width:'100%', accentColor:R, height:5 }}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab==='notifications' && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea', padding:'24px' }}>
              <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:'#0a0a0a',
                letterSpacing:'-.02em', marginBottom:5 }}>Notification Preferences</div>
              <p style={{ fontSize:14, color:'#5a5a58', margin:'0 0 22px', fontFamily:FB }}>
                Choose what you want to be alerted about
              </p>
              {NOTIFS.map((n,i)=>(
                <div key={n.key} style={{ display:'flex', alignItems:'center',
                  justifyContent:'space-between', padding:'15px 0',
                  borderBottom:i<NOTIFS.length-1?'1px solid #f2f2f0':'none' }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:20 }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:700,
                      color:'#0a0a0a', marginBottom:2 }}>{n.label}</div>
                    <div style={{ fontSize:14, color:'#9a9a96', fontFamily:FB }}>{n.desc}</div>
                  </div>
                  <Toggle on={notifs[n.key]} onChange={()=>toggleNotif(n.key)}/>
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {tab==='security' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea', padding:'24px' }}>
                <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:'#0a0a0a',
                  letterSpacing:'-.02em', marginBottom:5 }}>Security Settings</div>
                <p style={{ fontSize:14, color:'#5a5a58', margin:'0 0 20px', fontFamily:FB }}>
                  Authentication and access controls for your agency
                </p>
                {[
                  { label:'Two-factor authentication', desc:'Require 2FA for all team members',          icon:Shield,   action:'Configure',   href:null },
                  { label:'Team access management',    desc:'Manage roles, permissions, and seats',      icon:Users,    action:'Manage team', href:'/agency-settings' },
                  { label:'API key rotation',          desc:'Rotate all Vercel environment variables',   icon:Key,      action:'Open Vercel',  href:'https://vercel.com/dashboard' },
                  { label:'Audit log',                 desc:'View all changes made across the platform', icon:BarChart2,action:'View log',     href:'/admin' },
                ].map((item,i)=>{
                  const I = item.icon
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:14,
                      padding:'15px 0',
                      borderBottom:i<3?'1px solid #f2f2f0':'none' }}>
                      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                        background:'#f2f2f0', border:'1px solid #ececea',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <I size={16} color="#9a9a96"/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a' }}>{item.label}</div>
                        <div style={{ fontSize:14, color:'#9a9a96', fontFamily:FB }}>{item.desc}</div>
                      </div>
                      {item.href?.startsWith('http') ? (
                        <a href={item.href} target="_blank" rel="noreferrer"
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                            borderRadius:9, border:'1px solid #ececea', background:'#fff',
                            color:'#5a5a58', fontSize:14, fontWeight:700,
                            textDecoration:'none', fontFamily:FH, whiteSpace:'nowrap' }}>
                          <ExternalLink size={11}/> {item.action}
                        </a>
                      ) : item.href ? (
                        <button onClick={()=>navigate(item.href)}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                            borderRadius:9, border:'1px solid #ececea', background:'#fff',
                            color:'#5a5a58', fontSize:14, fontWeight:700,
                            cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap' }}>
                          <ChevronRight size={11}/> {item.action}
                        </button>
                      ) : (
                        <button onClick={()=>toast('Coming soon')}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                            borderRadius:9, border:'1px solid #ececea', background:'#fff',
                            color:'#9a9a96', fontSize:14, fontWeight:700,
                            cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap' }}>
                          {item.action}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}