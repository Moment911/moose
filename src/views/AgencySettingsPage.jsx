"use client";
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileRow, MobileSectionHeader } from '../components/mobile/MobilePage'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Palette, Users, CreditCard, Zap, Shield, Bell,
  Target, Inbox, ClipboardList, FileText, Plug, Settings,
  Key, Globe, HardDrive, MapPin, Link2, Star, Search,
  Wrench, Check, AlertTriangle, ExternalLink, Copy,
  RefreshCw, Loader2, Info, Sliders, Save, Plus,
  Trash2, ChevronRight, ArrowRight, ToggleLeft, ToggleRight,
  Lock, BarChart2, Mail, Send
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES } from '../lib/moosedesk'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

// ── Nav sections ──────────────────────────────────────────────────
const SECTIONS = [
  { key:'agency',       label:'Agency',          icon:Building2, group:'Agency' },
  { key:'branding',     label:'Branding',         icon:Palette,   group:'Agency' },
  { key:'team',         label:'Team & Access',    icon:Users,     group:'Agency' },
  { key:'billing',      label:'Plan & Billing',   icon:CreditCard,group:'Agency' },
  { key:'email',        label:'Email Settings',   icon:Mail,      group:'Agency' },
  { key:'connections',  label:'API Connections',  icon:Plug,      group:'Platform' },
  { key:'notifications',label:'Notifications',    icon:Bell,      group:'Platform' },
  { key:'security',     label:'Security',         icon:Shield,    group:'Platform' },
  { key:'onboarding',   label:'Onboarding',       icon:ClipboardList, group:'Platform' },
  { key:'proposals',    label:'Proposals & SOW',  icon:FileText,  group:'Platform' },
  { key:'scout',        label:'Scout Score',      icon:Target,    group:'Intelligence' },
  { key:'desk',         label:'Support Agents',   icon:Inbox,     group:'Intelligence' },
  { key:'routing',      label:'Ticket Routing',   icon:Settings,  group:'Intelligence' },
]

// ── API Connections data ──────────────────────────────────────────
const CONNECTIONS = [
  { id:'anthropic',    name:'Claude AI',         group:'Core',         icon:Zap,      color:R,        env:'NEXT_PUBLIC_ANTHROPIC_API_KEY',  free:'~$0.003/1K tokens', setupUrl:'https://console.anthropic.com/settings/keys',         desc:'Powers all AI features across the platform.' },
  { id:'supabase',     name:'Supabase',           group:'Core',         icon:HardDrive, color:'#3ecf8e',env:'NEXT_PUBLIC_SUPABASE_URL',         free:'Free tier: 500MB',  setupUrl:'https://app.supabase.com',                            desc:'HardDrive for all clients, tickets, and agency data.' },
  { id:'google_places',name:'Google Places',      group:'Scout',        icon:MapPin,   color:'#4285f4',env:'NEXT_PUBLIC_GOOGLE_PLACES_KEY',   free:'$200/mo credit',    setupUrl:'https://console.cloud.google.com/apis/credentials',  desc:'Real business data for Scout lead searches.' },
  { id:'google_oauth', name:'Google OAuth',       group:'Analytics',    icon:Globe,    color:'#34a853',env:'NEXT_PUBLIC_GOOGLE_CLIENT_ID',    free:'Free',              setupUrl:'https://console.cloud.google.com/apis/credentials',  desc:'Login + Search Console + GA4 for SEO Hub.' },
  { id:'ghl',          name:'GoHighLevel',        group:'CRM',          icon:Link2,    color:'#f59e0b',env:'NEXT_PUBLIC_GHL_CLIENT_ID',       free:'GHL subscription',  setupUrl:'https://marketplace.gohighlevel.com/',                desc:'Two-way CRM sync for contacts and opportunities.' },
  { id:'yelp',         name:'Yelp Fusion',        group:'Scout',        icon:Star,     color:'#d32323',env:'NEXT_PUBLIC_YELP_API_KEY',         free:'5,000 calls/day',   setupUrl:'https://www.yelp.com/developers/v3/manage_app',       desc:'Yelp reviews and ratings in Scout.' },
  { id:'hunter',       name:'Hunter.io',          group:'Scout',        icon:Search,   color:T,        env:'NEXT_PUBLIC_HUNTER_API_KEY',       free:'25 searches/mo',    setupUrl:'https://hunter.io/api-keys',                          desc:'Email finder for Scout lead enrichment.' },
  { id:'apollo',       name:'Apollo.io',          group:'Scout',        icon:Users,    color:'#7c3aed',env:'NEXT_PUBLIC_APOLLO_API_KEY',        free:'50 credits/mo',     setupUrl:'https://app.apollo.io/#/settings/integrations/api',   desc:'Executive contacts and company data.' },
  { id:'google_ads',   name:'Google Ads',         group:'Performance',  icon:BarChart2,color:'#fbbc04',env:'GOOGLE_ADS_DEVELOPER_TOKEN',        free:'Requires Ads account',setupUrl:'https://developers.google.com/google-ads/api/docs/get-started/dev-token', desc:'Ad campaigns, keywords, and AI optimization.' },
  { id:'resend',       name:'Resend (Email)',      group:'Email',        icon:Bell,     color:'#6366f1',env:'RESEND_API_KEY',                    free:'3,000/mo free',     setupUrl:'https://resend.com/api-keys',                         desc:'Transactional email for tickets and reports.' },
]

const WEIGHT_DEFAULTS = { social:25, website:30, gmb:20, reviews:15, ads:10 }
const WEIGHT_LABELS = [
  { key:'social',  label:'Social Media',  desc:'Facebook, Instagram followers and activity' },
  { key:'website', label:'Website & Tech',desc:'Analytics, CRM, CMS, marketing tools' },
  { key:'gmb',     label:'GMB Health',    desc:'Optimization, posts, photos, Q&A' },
  { key:'reviews', label:'Reviews',       desc:'Rating, count, response rate, sentiment' },
  { key:'ads',     label:'Advertising',   desc:'Facebook Pixel, Google Ads, retargeting' },
]
const NOTIFS = [
  { key:'negative_reviews',  label:'New negative reviews',        desc:'1 or 2-star reviews for any client',          on:true  },
  { key:'hot_leads',         label:'Hot Scout leads',             desc:'Leads scoring 75+ in a search',               on:true  },
  { key:'onboarding_done',   label:'Onboarding completed',        desc:'Client finishes their onboarding form',        on:true  },
  { key:'agent_digest',      label:'Agent activity digest',       desc:'Daily summary of AI agent activity',           on:false },
  { key:'team_mentions',     label:'Team mentions',               desc:'Someone mentions you in a comment',            on:true  },
  { key:'perf_alerts',       label:'Performance alerts',          desc:'ROAS drops or spend spikes abnormally',        on:true  },
  { key:'ticket_new',        label:'New support tickets',         desc:'Client submits a KotoDesk ticket',            on:true  },
  { key:'monthly_report',    label:'Monthly report generated',    desc:'AI Report agent sends a client report',        on:false },
]
const SKILLS = ['SEO','Paid Ads','Social Media','Content','Design','Development','Email','Reporting','Billing','Support','Strategy','Video']
const AVATAR_COLORS = [R,'#3b82f6','#16a34a','#d97706','#8b5cf6',T,'#ec4899','#14b8a6']

// ── Shared components ─────────────────────────────────────────────
const INP = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid #e5e7eb',
  fontSize:14, outline:'none', color:'#0a0a0a', boxSizing:'border-box',
  fontFamily:FB, background:'#fff', transition:'border-color .15s' }

function SectionCard({ title, subtitle, children, action, onAction, actionLabel='Save changes' }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb',
        display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#0a0a0a',
            letterSpacing:'-.02em', marginBottom:2 }}>{title}</div>
          {subtitle && <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>{subtitle}</div>}
        </div>
        {onAction && (
          <button onClick={onAction}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
              borderRadius:9, border:'none', background:R, color:'#fff',
              fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, flexShrink:0 }}>
            <Save size={13}/> {actionLabel}
          </button>
        )}
      </div>
      <div style={{ padding:'20px 22px' }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontFamily:FH, fontSize:14, fontWeight:700,
        color:'#0a0a0a', marginBottom:5 }}>{label}</label>
      {hint && <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button role="switch" aria-checked={on} onClick={()=>onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:'none',
        background:on?R:'#d1d5db', position:'relative', cursor:'pointer',
        flexShrink:0, transition:'background .2s', padding:0 }}>
      <span style={{ position:'absolute', top:3, left:on?23:3,
        width:18, height:18, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,.25)', transition:'left .2s', display:'block' }}/>
    </button>
  )
}

function PillToggle({ label, active, onChange }) {
  return (
    <button onClick={()=>onChange(!active)}
      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px',
        borderRadius:20, border:'none', cursor:'pointer', transition:'all .15s',
        background:active?R:'#f9fafb', color:active?'#fff':'#374151',
        fontSize:13, fontWeight:700, fontFamily:FH }}>
      {active ? <Check size={11}/> : <span style={{ width:11, height:11, borderRadius:'50%', background:'#d1d5db', display:'inline-block' }}/>}
      {label}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function AgencySettingsPage() {
  const navigate   = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [searchParams] = useSearchParams()
  const isMobile = useMobile()
  const [section, setSection] = useState(searchParams.get('section')||'agency')
  const [saving,  setSaving]  = useState(false)

  // Agency / branding
  const [agency, setAgency]   = useState({ name:'', slug:'', billing_email:'', brand_domain:'',
    brand_name:'', brand_color:R, brand_logo_url:'', plan:'growth', metadata:{} })

  // Email
  const [emailSettings, setEmailSettings] = useState({ sender_name:'', sender_email:'', reply_to_email:'', support_email:'', billing_email:'', noreply_email:'', email_signature:'', email_domain_verified:false })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailTesting, setEmailTesting] = useState(false)
  const [domainVerifying, setDomainVerifying] = useState(false)
  // Team
  const [members, setMembers] = useState([])

  // Notifications
  const [notifs, setNotifs]   = useState(Object.fromEntries(NOTIFS.map(n=>[n.key,n.on])))

  // Scout weights
  const [weights, setWeights] = useState({...WEIGHT_DEFAULTS})

  // Desk agents + routing
  const [agents,  setAgents]  = useState([])
  const [rules,   setRules]   = useState([])
  const [newAgent,setNewAgent]= useState({ name:'', email:'', role:'agent', hourly_rate:0, skills:[], avatar_color:R })
  const [newRule, setNewRule] = useState({ name:'', match_category:[], match_keywords:'', match_priority:[], auto_reply:'', is_active:true })

  // API connections
  const [testResult, setTestResult] = useState({})
  const [testing,    setTesting]    = useState({})

  // Onboarding / proposals
  const [onboardingTitle, setOnboardingTitle] = useState('Tell us about your business')
  const [onboardingIntro, setOnboardingIntro] = useState('')
  const [onboardingPhone, setOnboardingPhone] = useState('')
  const [onboardingAgentId, setOnboardingAgentId] = useState('')
  const [creatingOnboardingAgent, setCreatingOnboardingAgent] = useState(false)
  const [testFrom, setTestFrom] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testResult2, setTestResult2] = useState(null)
  const [testing2, setTesting2] = useState(false)
  const [modules, setModules] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  const [copied, setCopied] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => { loadAll() }, [aid])

  async function loadAll() {
    setLoadingData(true)
    try {
      const [
        {data:ag}, {data:mem}, {data:mods},
        {data:aa}, {data:rr}
      ] = await Promise.all([
        supabase.from('agencies').select('*').eq('id', aid).single(),
        supabase.from('agency_members').select('*, user:user_id(email)').eq('agency_id', aid),
        supabase.from('service_modules').select('*').eq('agency_id', aid).order('sort_order'),
        supabase.from('desk_agents').select('*').eq('agency_id', aid).order('created_at'),
        supabase.from('desk_routing_rules').select('*').eq('agency_id', aid).order('priority'),
      ])
      if (ag) {
        setAgency(ag)
        const meta = ag.metadata || {}
        setOnboardingTitle(meta.onboarding_title || 'Tell us about your business')
        setOnboardingIntro(meta.onboarding_intro || '')
        setOnboardingPhone(ag.onboarding_phone_number || '')
        setOnboardingAgentId(ag.onboarding_agent_id || '')
        setEmailSettings({ sender_name:ag.sender_name||'', sender_email:ag.sender_email||'', reply_to_email:ag.reply_to_email||'', support_email:ag.support_email||'', billing_email:ag.billing_email||'', noreply_email:ag.noreply_email||'', email_signature:ag.email_signature||'', email_domain_verified:ag.email_domain_verified||false })
      }
      setMembers(mem||[])
      setModules(mods||[])
      setAgents(aa||[])
      setRules(rr||[])
    } catch(e) { console.warn(e) }
    setLoadingData(false)
  }

  async function saveAgency() {
    setSaving(true)
    await supabase.from('agencies').update({
      name: agency.name, slug: agency.slug,
      billing_email: agency.billing_email, brand_domain: agency.brand_domain,
    }).eq('id', aid)
    toast.success('Agency settings saved')
    setSaving(false)
  }

  async function saveBranding() {
    setSaving(true)
    await supabase.from('agencies').update({
      brand_name:     agency.brand_name,
      brand_color:    agency.brand_color,
      brand_logo_url: agency.brand_logo_url,
      custom_domain:  agency.custom_domain  || null,
      support_email:  agency.support_email  || null,
    }).eq('id', aid)
    toast.success('Branding saved ✓')
    setSaving(false)
  }

  async function saveOnboarding() {
    setSaving(true)
    const {data:ag} = await supabase.from('agencies').select('metadata').eq('id', aid).single()
    const meta = ag?.metadata || {}
    // Save both the template copy AND the onboarding phone number on the same
    // click so the user doesn't have to hunt for a separate save button.
    await supabase.from('agencies').update({
      metadata: { ...meta, onboarding_title: onboardingTitle, onboarding_intro: onboardingIntro },
      onboarding_phone_number: onboardingPhone.trim() || null,
    }).eq('id', aid)
    toast.success('Onboarding settings saved')
    setSaving(false)
  }

  async function runTestLookup() {
    if (!testFrom.trim() || !testTo.trim()) { toast.error('Enter both numbers'); return }
    setTesting2(true)
    setTestResult2(null)
    try {
      const res = await fetch('/api/onboarding/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_lookup',
          from_number: testFrom.trim(),
          to_number: testTo.trim(),
        }),
      })
      const json = await res.json()
      setTestResult2(json)
    } catch (e) {
      toast.error('Lookup failed')
    } finally {
      setTesting2(false)
    }
  }

  async function createOnboardingAgent() {
    if (!aid) return
    setCreatingOnboardingAgent(true)
    try {
      const res = await fetch('/api/onboarding/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_onboarding_agent', agency_id: aid }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to create agent')
      } else {
        setOnboardingAgentId(json.agent_id || '')
        toast.success('Onboarding Retell agent created — now assign a phone number to it in Retell')
      }
    } catch (e) {
      toast.error('Failed to create agent')
    } finally {
      setCreatingOnboardingAgent(false)
    }
  }

  async function addAgent() {
    if (!newAgent.name.trim() || !newAgent.email.trim()) { toast.error('Name and email required'); return }
    setSaving(true)
    const {error} = await supabase.from('desk_agents').insert({ agency_id:aid, ...newAgent, hourly_rate:parseFloat(newAgent.hourly_rate)||0 })
    if (error) toast.error(error.message)
    else { toast.success('Agent added'); setNewAgent({name:'',email:'',role:'agent',hourly_rate:0,skills:[],avatar_color:R}); loadAll() }
    setSaving(false)
  }

  async function deleteAgent(id) {
    if (!confirm('Remove this agent?')) return
    await supabase.from('desk_agents').delete().eq('id',id)
    setAgents(prev=>prev.filter(a=>a.id!==id))
    toast.success('Agent removed')
  }

  async function updateAgent(id, field, value) {
    await supabase.from('desk_agents').update({[field]:value}).eq('id',id)
    setAgents(prev=>prev.map(a=>a.id===id?{...a,[field]:value}:a))
  }

  async function addRule() {
    if (!newRule.name.trim()) { toast.error('Rule name required'); return }
    setSaving(true)
    const {error} = await supabase.from('desk_routing_rules').insert({
      agency_id:aid, ...newRule,
      match_keywords: newRule.match_keywords ? newRule.match_keywords.split(',').map(k=>k.trim()).filter(Boolean) : [],
      priority: rules.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Rule saved'); setNewRule({name:'',match_category:[],match_keywords:'',match_priority:[],auto_reply:'',is_active:true}); loadAll() }
    setSaving(false)
  }

  async function testConn(conn) {
    setTesting(t=>({...t,[conn.id]:true}))
    setTestResult(r=>({...r,[conn.id]:null}))
    await new Promise(r=>setTimeout(r,700))
    const pass = !!process.env[conn.env]
    setTestResult(r=>({...r,[conn.id]:pass?'pass':'fail'}))
    setTesting(t=>({...t,[conn.id]:false}))
    pass ? toast.success(conn.name+' connected') : toast.error(conn.name+': key not configured in Vercel')
  }

  const connGroups = [...new Set(CONNECTIONS.map(c=>c.group))]
  const totalWeight = Object.values(weights).reduce((a,b)=>a+b,0)

  // ── Section renderer ────────────────────────────────────────────
  function renderSection() {
    switch(section) {

      case 'agency': return (
        <SectionCard title="Agency Settings" subtitle="Your agency name, slug, and billing details" onAction={saveAgency}>
          <Field label="Agency Name"><input value={agency.name||''} onChange={e=>setAgency(a=>({...a,name:e.target.value}))} style={INP} placeholder="Unified Marketing Group"/></Field>
          <Field label="Slug" hint="Used in your referral link and portal URL"><input value={agency.slug||''} onChange={e=>setAgency(a=>({...a,slug:e.target.value}))} style={INP} placeholder="unified-marketing"/></Field>
          <Field label="Billing Email"><input type="email" value={agency.billing_email||''} onChange={e=>setAgency(a=>({...a,billing_email:e.target.value}))} style={INP} placeholder="billing@youragency.com"/></Field>
          <Field label="Custom Domain" hint="Pro plan only — white-label portal domain"><input value={agency.brand_domain||''} onChange={e=>setAgency(a=>({...a,brand_domain:e.target.value}))} style={INP} placeholder="app.youragency.com"/></Field>
          <div style={{ marginTop:8, background:'#f9fafb', borderRadius:11, padding:'14px 16px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:4 }}>Referral Link</div>
            <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:8 }}>Earn 20% recurring commission on referred agencies</div>
            <div style={{ display:'flex', gap:8 }}>
              <input readOnly value={`${appUrl}/signup?ref=${agency.slug||''}`} style={{...INP,flex:1,color:'#6b7280',fontSize:13}}/>
              <button onClick={()=>{navigator.clipboard.writeText(`${appUrl}/signup?ref=${agency.slug||''}`);setCopied(true);setTimeout(()=>setCopied(false),2000)}}
                style={{ padding:'9px 14px', borderRadius:9, border:`1px solid ${R}`, background:'#fff', color:R, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, flexShrink:0, display:'flex', alignItems:'center', gap:5 }}>
                {copied?<><Check size={12}/> Copied</>:<><Copy size={12}/> Copy</>}
              </button>
            </div>
          </div>
        </SectionCard>
      )

      case 'branding': return (
        <SectionCard title="White-Label Branding" subtitle="Your clients see your brand, not Koto" onAction={saveBranding}>

          {/* Live preview */}
          <div style={{ marginBottom:20, borderRadius:14, border:'2px solid #f0f0ee', overflow:'hidden' }}>
            <div style={{ background:'#f9fafb', padding:'8px 14px', fontSize:12, fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.08em' }}>Live Portal Preview</div>
            <div style={{ background: agency.brand_color||R, padding:'18px 20px', display:'flex', alignItems:'center', gap:12 }}>
              {agency.brand_logo_url
                ? <img src={agency.brand_logo_url} alt="logo" style={{height:32,maxWidth:140,objectFit:'contain'}} onError={e=>e.currentTarget.style.display='none'}/>
                : <div style={{fontFamily:FH,fontSize:18,fontWeight:900,color:'#fff',letterSpacing:'-.03em'}}>{agency.brand_name||agency.name||'Your Agency'}</div>
              }
              <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                {['Dashboard','Reports','Reviews'].map(tab=>(
                  <div key={tab} style={{padding:'5px 12px',borderRadius:20,background:'rgba(255,255,255,.18)',color:'#fff',fontSize:12,fontWeight:700}}>{tab}</div>
                ))}
              </div>
            </div>
            <div style={{ padding:'14px 20px', background:'#fff', display:'flex', gap:12 }}>
              {[['⭐ 4.8','Avg Rating'],['24','Reviews'],['92','SEO Score']].map(([v,l])=>(
                <div key={l} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1px solid #f0f0ee',textAlign:'center'}}>
                  <div style={{fontWeight:900,fontSize:18,color:agency.brand_color||R}}>{v}</div>
                  <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Name */}
          <Field label="Brand Name" hint="Shown to clients instead of 'Koto'">
            <input value={agency.brand_name||''} onChange={e=>setAgency(a=>({...a,brand_name:e.target.value}))} style={INP} placeholder={agency.name||'Your Agency'}/>
          </Field>

          {/* Logo upload */}
          <Field label="Logo" hint="Upload file or paste URL — shown in client portal header">
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <label style={{padding:'8px 14px',borderRadius:9,border:'1.5px solid #e5e7eb',cursor:'pointer',fontSize:13,fontWeight:700,color:'#374151',background:'#f9f9f7',display:'inline-flex',alignItems:'center',gap:6,flexShrink:0}}>
                📁 Upload File
                <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 500000) { alert('Logo must be under 500KB'); return }
                  const reader = new FileReader()
                  reader.onload = ev => setAgency(a=>({...a,brand_logo_url:ev.target.result}))
                  reader.readAsDataURL(file)
                }}/>
              </label>
              <span style={{fontSize:12,color:'#9ca3af',flexShrink:0}}>or URL</span>
              <input
                value={agency.brand_logo_url?.startsWith('data:') ? '' : (agency.brand_logo_url||'')}
                onChange={e=>setAgency(a=>({...a,brand_logo_url:e.target.value}))}
                style={{...INP,flex:1}} placeholder="https://youragency.com/logo.png"/>
            </div>
            {agency.brand_logo_url && (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px',background:'#f9fafb',borderRadius:9,border:'1px solid #e5e7eb'}}>
                <img src={agency.brand_logo_url} alt="preview" style={{height:36,maxWidth:180,objectFit:'contain'}} onError={e=>e.currentTarget.style.display='none'}/>
                <button onClick={()=>setAgency(a=>({...a,brand_logo_url:''}))}
                  style={{marginLeft:'auto',fontSize:12,color:'#9ca3af',background:'none',border:'none',cursor:'pointer',padding:'4px 8px'}}>
                  ✕ Remove
                </button>
              </div>
            )}
          </Field>

          {/* Brand color */}
          <Field label="Brand Color" hint="Primary color for buttons, headers, and accents">
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <input type="color" value={agency.brand_color||R}
                onChange={e=>setAgency(a=>({...a,brand_color:e.target.value}))}
                style={{width:46,height:40,borderRadius:9,border:'1px solid #e5e7eb',padding:3,cursor:'pointer',flexShrink:0}}/>
              <input value={agency.brand_color||R}
                onChange={e=>setAgency(a=>({...a,brand_color:e.target.value}))}
                style={{...INP,flex:1,fontFamily:'monospace'}}/>
            </div>
            <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
              {['#E6007E','#00C2CB','#0a0a0a','#7c3aed','#2563eb','#16a34a','#d97706','#db2777'].map(col=>(
                <button key={col} onClick={()=>setAgency(a=>({...a,brand_color:col}))}
                  style={{width:26,height:26,borderRadius:6,background:col,border:agency.brand_color===col?'3px solid #fff':agency.brand_color===col?'3px solid #333':'2px solid transparent',
                  boxShadow:agency.brand_color===col?'0 0 0 2px '+col:'none',cursor:'pointer',outline:'none'}}/>
              ))}
            </div>
          </Field>

          {/* Custom domain */}
          <Field label="Custom Portal Domain" hint="Optional — clients visit your domain instead of hellokoto.com">
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input value={agency.custom_domain||''} onChange={e=>setAgency(a=>({...a,custom_domain:e.target.value,_domain_verified:null}))}
                style={{...INP,flex:1}} placeholder="portal.youragency.com"/>
              <button
                onClick={async ()=>{
                  if (!agency.custom_domain) return
                  setAgency(a=>({...a,_domain_verifying:true}))
                  try {
                    const r = await fetch('/api/agency/white-label', {
                      method:'POST',
                      headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ action:'verify_domain', agency_id: agency.id, domain: agency.custom_domain }),
                    })
                    const d = await r.json()
                    setAgency(a=>({...a,_domain_verifying:false,_domain_verified:d.verified,_domain_target:d.cname_target}))
                  } catch {
                    setAgency(a=>({...a,_domain_verifying:false,_domain_verified:false}))
                  }
                }}
                disabled={!agency.custom_domain || agency._domain_verifying}
                style={{padding:'10px 16px',borderRadius:9,border:'1.5px solid #e5e7eb',background:'#f9f9f7',fontSize:13,fontWeight:700,color:'#374151',cursor: agency.custom_domain ? 'pointer' : 'not-allowed',whiteSpace:'nowrap',flexShrink:0}}>
                {agency._domain_verifying ? 'Checking…' : 'Verify DNS'}
              </button>
            </div>
            {agency.custom_domain && (
              <div style={{marginTop:6,padding:'8px 12px',borderRadius:8,background:'#f0fdf4',border:'1px solid #bbf7d0',fontSize:13,color:'#166534'}}>
                Point <code style={{fontFamily:'monospace',background:'#dcfce7',padding:'1px 5px',borderRadius:4}}>{agency.custom_domain}</code> CNAME → <code style={{fontFamily:'monospace',background:'#dcfce7',padding:'1px 5px',borderRadius:4}}>hellokoto.com</code> in your DNS settings.
              </div>
            )}
            {agency._domain_verified === true && (
              <div style={{marginTop:6,padding:'8px 12px',borderRadius:8,background:'#ecfdf5',border:'1px solid #a7f3d0',fontSize:13,color:'#065f46'}}>
                ✓ Verified — CNAME points to <code style={{fontFamily:'monospace'}}>{agency._domain_target}</code>
              </div>
            )}
            {agency._domain_verified === false && (
              <div style={{marginTop:6,padding:'8px 12px',borderRadius:8,background:'#fef2f2',border:'1px solid #fecaca',fontSize:13,color:'#991b1b'}}>
                ✗ Not verified yet. {agency._domain_target ? `CNAME currently points to ${agency._domain_target}.` : 'No CNAME record found.'} DNS changes can take up to 24 hours to propagate.
              </div>
            )}
          </Field>

          {/* Support email */}
          <Field label="Client-Facing Support Email" hint="Reply-to for automated emails sent to your clients">
            <input value={agency.support_email||''} onChange={e=>setAgency(a=>({...a,support_email:e.target.value}))}
              style={INP} placeholder="support@youragency.com"/>
          </Field>

        </SectionCard>
      )

      case 'team': return (
        <SectionCard title="Team & Access" subtitle="Manage who has access to your Koto platform">
          {members.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {members.map(m=>(
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f9fafb', borderRadius:11, border:'1px solid #e5e7eb' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:R, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:FH, fontSize:14, fontWeight:700, color:'#fff' }}>
                    {(m.user?.email||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{m.user?.email}</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, textTransform:'capitalize' }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#6b7280', fontSize:14, fontFamily:FB, marginBottom:12 }}>No team members yet</div>
          )}
          <button onClick={()=>navigate('/agency-settings')}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px',
              borderRadius:10, border:`1px solid ${R}`, background:R,
              color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
            <Users size={14}/> Manage Full Team Settings
          </button>
        </SectionCard>
      )

      case 'email': return (
        <SectionCard title="Email Settings" subtitle="Configure how emails are sent on behalf of your agency">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
            {[{k:'sender_name',l:'Sender Name',p:'Your Agency'},{k:'sender_email',l:'From Email',p:'hello@youragency.com'},{k:'reply_to_email',l:'Reply-To',p:'support@youragency.com'},{k:'support_email',l:'Support Email',p:'support@youragency.com'},{k:'billing_email',l:'Billing Email',p:'billing@youragency.com'},{k:'noreply_email',l:'No-Reply',p:'noreply@youragency.com'}].map(f=>(
              <div key={f.k}><label style={{fontSize:12,fontWeight:700,color:'#6b7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{f.l}</label>
              <input value={emailSettings[f.k]||''} onChange={e=>setEmailSettings(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:14,outline:'none',boxSizing:'border-box'}}/></div>
            ))}
          </div>
          <div style={{marginBottom:16}}><label style={{fontSize:12,fontWeight:700,color:'#6b7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Email Signature</label>
          <textarea value={emailSettings.email_signature||''} onChange={e=>setEmailSettings(p=>({...p,email_signature:e.target.value}))} rows={4} placeholder="Your signature" style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:14,outline:'none',boxSizing:'border-box',resize:'vertical'}}/></div>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:emailSettings.email_domain_verified?'#f0fdf4':'#f9fafb',borderRadius:10,border:'1px solid '+(emailSettings.email_domain_verified?'#bbf7d0':'#e5e7eb'),marginBottom:16}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:emailSettings.email_domain_verified?'#16a34a':'#9ca3af'}}/>
            <span style={{fontSize:13,fontWeight:600,color:emailSettings.email_domain_verified?'#16a34a':'#6b7280'}}>{emailSettings.email_domain_verified?'Domain verified':emailSettings.sender_email?'Domain not verified':'Set sender email first'}</span>
            {emailSettings.sender_email&&!emailSettings.email_domain_verified&&<button onClick={async()=>{setDomainVerifying(true);try{const r=await fetch('/api/agency',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify_email_domain',agency_id:aid})});const d=await r.json();d.domain_id?toast.success('Domain registered — add DNS records'):toast.error(d.error||'Failed')}catch{toast.error('Failed')}setDomainVerifying(false)}} disabled={domainVerifying} style={{marginLeft:'auto',padding:'6px 14px',borderRadius:8,border:'none',background:'#00C2CB15',color:'#00C2CB',fontSize:12,fontWeight:700,cursor:'pointer'}}>{domainVerifying?'Verifying...':'Verify Domain'}</button>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={async()=>{setEmailSaving(true);try{await fetch('/api/agency',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_email_settings',agency_id:aid,...emailSettings})});toast.success('Saved')}catch{toast.error('Failed')}setEmailSaving(false)}} disabled={emailSaving} style={{padding:'10px 20px',borderRadius:10,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              {emailSaving?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Save size={14}/>} Save
            </button>
            <button onClick={async()=>{setEmailTesting(true);try{const r=await fetch('/api/agency',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send_test_email',agency_id:aid})});const d=await r.json();d.success?toast.success('Test email sent!'):toast.error(d.error||'Failed')}catch{toast.error('Failed')}setEmailTesting(false)}} disabled={emailTesting} style={{padding:'10px 20px',borderRadius:10,border:'1px solid #00C2CB',background:'#00C2CB10',color:'#00C2CB',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              {emailTesting?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Send size={14}/>} Test Email
            </button>
          </div>
        </SectionCard>
      )

      case 'billing': return (
        <SectionCard title="Plan & Billing" subtitle="Your current plan and usage limits">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Current Plan', value:(agency.plan||'growth').charAt(0).toUpperCase()+(agency.plan||'growth').slice(1) },
              { label:'Clients', value:`${members.length} / unlimited` },
              { label:'Status', value:'Active', green:true },
            ].map(s=>(
              <div key={s.label} style={{ background:'#f9fafb', borderRadius:11, padding:'14px 16px', border:'1px solid #e5e7eb', textAlign:'center' }}>
                <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:s.green?'#16a34a':'#0a0a0a', letterSpacing:'-.02em' }}>{s.value}</div>
                <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <a href="https://hellokoto.com/billing" target="_blank" rel="noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px',
              borderRadius:10, border:`1px solid ${R}`, background:'#fff',
              color:R, fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
            <ExternalLink size={14}/> Manage Subscription
          </a>
        </SectionCard>
      )

      case 'connections': return (
        <div>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
            padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a', marginBottom:6 }}>
                {CONNECTIONS.filter(c=>!!process.env[c.env]).length} of {CONNECTIONS.length} connections configured
              </div>
              <div style={{ height:5, background:'#f9fafb', borderRadius:3, overflow:'hidden', maxWidth:240 }}>
                <div style={{ height:'100%', borderRadius:3, background:R, transition:'width .4s',
                  width:`${(CONNECTIONS.filter(c=>!!process.env[c.env]).length/CONNECTIONS.length)*100}%` }}/>
              </div>
            </div>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px',
                borderRadius:10, border:'1px solid #e5e7eb', background:'#fff',
                color:'#374151', fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
              <ExternalLink size={13}/> Vercel Env Vars
            </a>
          </div>
          {connGroups.map(grp=>(
            <div key={grp} style={{ marginBottom:20 }}>
              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#6b7280',
                textTransform:'uppercase', letterSpacing:'.09em', marginBottom:10 }}>{grp}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
                {CONNECTIONS.filter(c=>c.group===grp).map(conn=>{
                  const ok = !!process.env[conn.env]
                  const Icon = conn.icon
                  return (
                    <div key={conn.id} style={{ background:'#fff', borderRadius:12,
                      border:`1px solid ${ok?conn.color+'35':'#e5e7eb'}`, padding:'16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:11, marginBottom:10 }}>
                        <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                          background:conn.color+'15', border:`1px solid ${conn.color}25`,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Icon size={17} color={conn.color}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{conn.name}</span>
                            {ok
                              ? <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, padding:'1px 8px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', display:'flex', alignItems:'center', gap:4 }}><Check size={10} strokeWidth={3}/> Connected</span>
                              : <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, padding:'1px 8px', borderRadius:20, background:'#fffbeb', color:'#d97706', display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={10}/> Not set</span>}
                          </div>
                          <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{conn.free}</div>
                        </div>
                      </div>
                      <div style={{ background:'#f9fafb', borderRadius:7, padding:'6px 10px', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                        <code style={{ fontSize:12, color:'#374151', fontFamily:'monospace', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conn.env}</code>
                        <button onClick={()=>{navigator.clipboard.writeText(conn.env);toast.success('Copied!')}} style={{ padding:'2px 8px', borderRadius:5, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:12, color:'#6b7280', fontFamily:FH, fontWeight:600, flexShrink:0, display:'flex', alignItems:'center', gap:3 }}>
                          <Copy size={10}/> Copy
                        </button>
                      </div>
                      <div style={{ display:'flex', gap:7 }}>
                        <a href={conn.setupUrl} target="_blank" rel="noreferrer"
                          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                            padding:'7px', borderRadius:8, border:`1px solid ${ok?'#e5e7eb':conn.color}`,
                            background:ok?'#fff':conn.color+'08', color:ok?'#374151':conn.color,
                            fontSize:13, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
                          <ExternalLink size={11}/> {ok?'Manage':'Get Key'}
                        </a>
                        <button onClick={()=>testConn(conn)} disabled={testing[conn.id]}
                          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff',
                            cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, fontFamily:FH,
                            color: testResult[conn.id]==='pass'?'#16a34a': testResult[conn.id]==='fail'?R: '#6b7280' }}>
                          {testing[conn.id] ? <Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={11}/>}
                          Test
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )

      case 'notifications': return (
        <SectionCard title="Notification Preferences" subtitle="Choose what you want to be alerted about">
          {NOTIFS.map((n,i)=>(
            <div key={n.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 0', borderBottom:i<NOTIFS.length-1?'1px solid #e5e7eb':'none' }}>
              <div style={{ flex:1, paddingRight:20 }}>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:2 }}>{n.label}</div>
                <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{n.desc}</div>
              </div>
              <Toggle on={notifs[n.key]} onChange={()=>{ setNotifs(p=>({...p,[n.key]:!p[n.key]})); toast.success('Saved') }}/>
            </div>
          ))}
        </SectionCard>
      )

      case 'security': return (
        <SectionCard title="Security" subtitle="Authentication and access controls">
          {[
            { label:'Two-factor authentication', desc:'Require 2FA for all team members', icon:Shield, action:'Configure', href:null },
            { label:'Team access management',    desc:'Roles, permissions, and seats',    icon:Users,  action:'Team Settings', href:'/agency-settings' },
            { label:'API key rotation',          desc:'Rotate Vercel environment variables', icon:Key, action:'Open Vercel', href:'https://vercel.com/dashboard' },
            { label:'Audit log',                 desc:'All changes across the platform',  icon:BarChart2, action:'View log', href:'/admin' },
          ].map((item,i)=>{
            const I = item.icon
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 0', borderBottom:i<3?'1px solid #e5e7eb':'none' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'#f9fafb', border:'1px solid #e5e7eb', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <I size={15} color="#6b7280"/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{item.label}</div>
                  <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{item.desc}</div>
                </div>
                {item.href?.startsWith('http') ? (
                  <a href={item.href} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, textDecoration:'none', fontFamily:FH, whiteSpace:'nowrap' }}><ExternalLink size={11}/> {item.action}</a>
                ) : item.href ? (
                  <button onClick={()=>navigate(item.href)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap' }}><ChevronRight size={11}/> {item.action}</button>
                ) : (
                  <button onClick={()=>toast('Coming soon')} style={{ padding:'7px 13px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>{item.action}</button>
                )}
              </div>
            )
          })}
        </SectionCard>
      )

      case 'onboarding': return (
        <SectionCard title="Onboarding Template" subtitle="Customize what clients fill out when they first connect" onAction={saveOnboarding}>
          <Field label="Form Title"><input value={onboardingTitle} onChange={e=>setOnboardingTitle(e.target.value)} style={INP}/></Field>
          <Field label="Introduction Text" hint="Shown above the form to new clients">
            <textarea value={onboardingIntro} onChange={e=>setOnboardingIntro(e.target.value)} rows={4}
              style={{...INP,resize:'vertical',lineHeight:1.65}}
              placeholder="We'd love to learn more about your business so we can hit the ground running…"/>
          </Field>
          <div style={{ padding:'14px 16px', background:'#f9fafb', borderRadius:11, border:'1px solid #e5e7eb' }}>
            <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:4 }}>Default fields collected</div>
            <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.65 }}>
              Business name · Industry · Website · Phone · Service area · Key goals · Monthly budget · Who's the decision maker
            </div>
          </div>

          {/* ── Voice Onboarding sub-section ── */}
          <div style={{
            marginTop: 16,
            padding: '16px 18px',
            background: '#f0fffe',
            borderRadius: 12,
            border: '1.5px solid #00C2CB40',
          }}>
            <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: '#0a0a0a', marginBottom: 4 }}>
              📞 Voice Onboarding
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
              Let clients complete their onboarding by phone. A Retell AI agent asks every question, saves answers in real time, and hands off to your team when the call ends. One phone number per agency.
            </div>

            <Field label="Onboarding phone number" hint="The Retell-backed number clients call to start a voice onboarding session. Must be assigned to your onboarding agent in Retell.">
              <input
                value={onboardingPhone}
                onChange={(e) => setOnboardingPhone(e.target.value)}
                placeholder="+1 (555) 555-0199"
                style={INP}
              />
            </Field>

            {onboardingAgentId ? (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                fontSize: 12,
                color: '#166534',
                fontFamily: 'ui-monospace,monospace',
              }}>
                ✓ Retell agent linked — <code>{onboardingAgentId}</code>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={createOnboardingAgent}
                  disabled={creatingOnboardingAgent}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 9,
                    border: 'none',
                    background: '#00C2CB',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: creatingOnboardingAgent ? 'default' : 'pointer',
                    fontFamily: FH,
                    opacity: creatingOnboardingAgent ? 0.7 : 1,
                  }}
                >
                  {creatingOnboardingAgent ? 'Creating…' : '+ Create Retell Onboarding Agent'}
                </button>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
                  This creates a dedicated agent in Retell with the <code>save_answer</code> tool wired up. After creating, assign your chosen phone number to the agent inside the Retell dashboard.
                </div>
              </div>
            )}

            {/* Caller resolution tester — shows exactly how the webhook
                would route a hypothetical inbound call. Useful for
                verifying the onboarding number + a client's phone before
                going live. */}
            <div style={{
              marginTop: 16, paddingTop: 16,
              borderTop: '1px solid #00C2CB30',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                🔎 Test caller lookup
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 10 }}>
                Enter a caller's phone and your onboarding line number to verify the webhook will resolve them to the right client. No call is placed.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                <input
                  value={testFrom}
                  onChange={(e) => setTestFrom(e.target.value)}
                  placeholder="Caller from_number (+1 555…)"
                  style={INP}
                />
                <input
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="Onboarding line to_number"
                  style={INP}
                />
                <button
                  onClick={runTestLookup}
                  disabled={testing2}
                  style={{
                    padding: '9px 16px', borderRadius: 9, border: 'none',
                    background: '#111', color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    cursor: testing2 ? 'default' : 'pointer', fontFamily: FH,
                    opacity: testing2 ? 0.7 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {testing2 ? 'Looking up…' : 'Test'}
                </button>
              </div>

              {testResult2 && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: testResult2.resolved?.client_id ? '#f0fdf4' : testResult2.resolved?.agency_id ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${testResult2.resolved?.client_id ? '#bbf7d0' : testResult2.resolved?.agency_id ? '#fde68a' : '#fecaca'}`,
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#111',
                }}>
                  {testResult2.resolved?.client_id ? (
                    <>
                      <div style={{ fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                        ✓ Resolved to {testResult2.client?.name || testResult2.resolved.client_id}
                      </div>
                      <div style={{ color: '#166534', fontSize: 11 }}>
                        Agency: {testResult2.agency?.brand_name || testResult2.agency?.name}
                        {' · via '}
                        <code>{testResult2.resolved.source}</code>
                      </div>
                    </>
                  ) : testResult2.resolved?.agency_id ? (
                    <>
                      <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
                        ⚠️ Agency found but no client matched this phone
                      </div>
                      <div style={{ color: '#92400e', fontSize: 11 }}>
                        Agency: {testResult2.agency?.brand_name || testResult2.agency?.name}. Add <code>{testResult2.normalized?.from}</code> to a client's phone or owner_phone field to match next time.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>
                        ✗ No agency matches this onboarding line
                      </div>
                      <div style={{ color: '#991b1b', fontSize: 11 }}>
                        Double-check the number above matches your <code>onboarding_phone_number</code> field exactly — we normalize by stripping non-digits and the leading 1.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )

      case 'proposals': return (
        <SectionCard title="Service Modules & SOW Library" subtitle="Pre-built services you can add to proposals">
          {modules.length === 0 ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:'#6b7280', fontSize:14, fontFamily:FB }}>
              No service modules yet — add your first below
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {modules.map(m=>(
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'#f9fafb', borderRadius:11, border:'1px solid #e5e7eb' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{m.name}</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{m.category} · ${m.price}/{m.price_type}</div>
                  </div>
                  <button onClick={async()=>{ if(!confirm('Delete?'))return; await supabase.from('service_modules').delete().eq('id',m.id); loadAll() }}
                    style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #fecaca', background:'#fef2f2', color:R, cursor:'pointer', display:'flex', alignItems:'center' }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px' }}>
            <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:12 }}>Add Service Module</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <Field label="Name"><input placeholder="SEO Management" value={''} style={INP} onChange={()=>{}}/></Field>
              <Field label="Monthly Price"><input type="number" placeholder="1500" value={''} style={INP} onChange={()=>{}}/></Field>
            </div>
            <button onClick={()=>navigate('/proposals')} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:`1px solid ${R}`, background:R, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <ArrowRight size={13}/> Manage in Proposals
            </button>
          </div>
        </SectionCard>
      )

      case 'scout': return (
        <SectionCard title="Scout Score Weights" subtitle="Adjust how each factor contributes to the lead opportunity score">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:totalWeight===100?'#16a34a':R, letterSpacing:'-.03em' }}>
              {totalWeight}% total {totalWeight!==100&&<span style={{fontSize:14,fontWeight:600}}>(must equal 100)</span>}
            </div>
            <button onClick={()=>{setWeights({...WEIGHT_DEFAULTS});toast.success('Reset')}}
              style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151', fontFamily:FH, fontWeight:600 }}>Reset</button>
          </div>
          {WEIGHT_LABELS.map(w=>(
            <div key={w.key} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{w.label}</div>
                  <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{w.desc}</div>
                </div>
                <span style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:R, minWidth:44, textAlign:'right' }}>{weights[w.key]}%</span>
              </div>
              <input type="range" min={0} max={50} value={weights[w.key]}
                onChange={e=>setWeights(p=>({...p,[w.key]:+e.target.value}))}
                style={{ width:'100%', accentColor:R }}/>
            </div>
          ))}
        </SectionCard>
      )

      case 'desk': return (
        <div>
          <SectionCard title="Support Agents" subtitle="Team members who handle KotoDesk tickets">
            {agents.length===0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#6b7280', fontSize:14, fontFamily:FB, marginBottom:12 }}>No agents yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {agents.map(a=>(
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f9fafb', borderRadius:11, border:'1px solid #e5e7eb' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:a.avatar_color||R, flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:13, fontWeight:700, color:'#fff' }}>
                      {a.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{a.name}</div>
                      <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{a.email} · {a.role} · ${a.hourly_rate||0}/hr</div>
                    </div>
                    <Toggle on={a.is_active} onChange={v=>updateAgent(a.id,'is_active',v)}/>
                    <button onClick={()=>deleteAgent(a.id)} style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #fecaca', background:'#fef2f2', color:R, cursor:'pointer', display:'flex', alignItems:'center' }}><Trash2 size={13}/></button>
                  </div>
                ))}
              </div>
            )}
            {/* Add agent */}
            <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px' }}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:12 }}>Add Agent</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <Field label="Name"><input value={newAgent.name} onChange={e=>setNewAgent(a=>({...a,name:e.target.value}))} style={INP} placeholder="Sarah Johnson"/></Field>
                <Field label="Email"><input type="email" value={newAgent.email} onChange={e=>setNewAgent(a=>({...a,email:e.target.value}))} style={INP} placeholder="sarah@agency.com"/></Field>
                <Field label="Role">
                  <select value={newAgent.role} onChange={e=>setNewAgent(a=>({...a,role:e.target.value}))} style={INP}>
                    <option value="agent">Agent</option>
                    <option value="senior">Senior Agent</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </Field>
                <Field label="Hourly Rate ($)"><input type="number" value={newAgent.hourly_rate} onChange={e=>setNewAgent(a=>({...a,hourly_rate:e.target.value}))} style={INP} placeholder="75"/></Field>
              </div>
              <Field label="Skills">
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {SKILLS.map(s=>(
                    <PillToggle key={s} label={s} active={newAgent.skills.includes(s)}
                      onChange={()=>setNewAgent(a=>({...a,skills:a.skills.includes(s)?a.skills.filter(x=>x!==s):[...a.skills,s]}))}/>
                  ))}
                </div>
              </Field>
              <button onClick={addAgent} disabled={saving}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:9, border:'none', background:R, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <Plus size={13}/> Add Agent
              </button>
            </div>
          </SectionCard>
        </div>
      )

      case 'routing': return (
        <SectionCard title="Ticket Routing Rules" subtitle="Auto-assign tickets to agents based on conditions">
          {rules.length===0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'#6b7280', fontSize:14, fontFamily:FB, marginBottom:12 }}>No rules yet — tickets will be unassigned by default</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {rules.map(r=>(
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f9fafb', borderRadius:11, border:`1px solid ${r.is_active?T+'40':'#e5e7eb'}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:2 }}>{r.name}</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>
                      {r.match_category?.length>0 && `Category: ${r.match_category.join(', ')} · `}
                      {r.match_keywords?.length>0 && `Keywords: ${r.match_keywords.join(', ')} · `}
                      Priority {r.priority}
                    </div>
                  </div>
                  <Toggle on={r.is_active} onChange={()=>{ supabase.from('desk_routing_rules').update({is_active:!r.is_active}).eq('id',r.id); setRules(prev=>prev.map(x=>x.id===r.id?{...x,is_active:!x.is_active}:x)) }}/>
                  <button onClick={async()=>{ if(!confirm('Delete?'))return; await supabase.from('desk_routing_rules').delete().eq('id',r.id); loadAll() }}
                    style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #fecaca', background:'#fef2f2', color:R, cursor:'pointer', display:'flex', alignItems:'center' }}><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px' }}>
            <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a', marginBottom:12 }}>Add Routing Rule</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <Field label="Rule Name"><input value={newRule.name} onChange={e=>setNewRule(r=>({...r,name:e.target.value}))} style={INP} placeholder="Billing tickets → Sarah"/></Field>
              <Field label="Keywords (comma-separated)"><input value={newRule.match_keywords} onChange={e=>setNewRule(r=>({...r,match_keywords:e.target.value}))} style={INP} placeholder="invoice, payment, billing"/></Field>
            </div>
            <Field label="Match Categories">
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(CATEGORIES||['general','billing','technical','seo','ads','content','design','social']).map(c=>(
                  <PillToggle key={c} label={c} active={newRule.match_category.includes(c)}
                    onChange={()=>setNewRule(r=>({...r,match_category:r.match_category.includes(c)?r.match_category.filter(x=>x!==c):[...r.match_category,c]}))}/>
                ))}
              </div>
            </Field>
            <Field label="Auto-Reply (optional)"><textarea value={newRule.auto_reply} onChange={e=>setNewRule(r=>({...r,auto_reply:e.target.value}))} rows={2} style={{...INP,resize:'vertical'}} placeholder="Thanks for reaching out! We'll respond within 2 hours…"/></Field>
            <button onClick={addRule} disabled={saving}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:9, border:'none', background:R, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <Plus size={13}/> Add Rule
            </button>
          </div>
        </SectionCard>
      )

      default: return null
    }
  }

  /* ─── MOBILE ─── */
  if (isMobile) {
    const mSections = SECTIONS.filter(s => s.group === {
      'Agency':'Agency','Platform':'Platform','Intelligence':'Intelligence'
    }[s.group] || true)

    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Settings" subtitle="All agency settings"/>

        {/* Section list */}
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {['Agency','Platform','Intelligence'].map(group=>{
            const items = SECTIONS.filter(s=>s.group===group)
            return (
              <div key={group}>
                <MobileSectionHeader title={group}/>
                <MobileCard style={{margin:'0 16px 12px'}}>
                  {items.map((s,i)=>{
                    const I = s.icon
                    return (
                      <MobileRow key={s.key}
                        onClick={()=>setSection(s.key)}
                        borderBottom={i<items.length-1}
                        left={<div style={{width:36,height:36,borderRadius:10,background:section===s.key?'#E6007E':'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <I size={16} color={section===s.key?'#fff':'#374151'}/>
                        </div>}
                        title={s.label}/>
                    )
                  })}
                </MobileCard>
              </div>
            )
          })}
        </div>

        {/* Current section content */}
        {section && (
          <div style={{padding:'0 16px 24px'}}>
            <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:17,fontWeight:800,color:'#0a0a0a',padding:'8px 0 12px',letterSpacing:'-.02em'}}>
              {SECTIONS.find(s=>s.key===section)?.label}
            </div>
            {renderSection()}
          </div>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f9fafb', fontFamily:FB }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'0 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'20px 0 16px' }}>
            <div style={{ width:32, height:32, borderRadius:9, background:R, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Settings size={16} color="#fff"/>
            </div>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color: '#111111', margin: 0, letterSpacing:'-.03em' }}>Agency Settings</h1>
              <p style={{ fontSize:14, color: '#999999', margin:0, fontFamily:FB }}>All platform settings in one place</p>
            </div>
          </div>
          <div style={{ height:1, background: '#F5F5F5' }}/>
        </div>

        {/* Body: left nav + content */}
        <div style={{ flex:1, overflow:'hidden', display:'grid', gridTemplateColumns:'220px 1fr' }}>

          {/* Left nav */}
          <div style={{ background:'#fff', borderRight:'1px solid #e5e7eb', overflowY:'auto', padding:'16px 10px' }}>
            {['Agency','Platform','Intelligence'].map(group=>{
              const items = SECTIONS.filter(s=>s.group===group)
              return (
                <div key={group} style={{ marginBottom:8 }}>
                  <div style={{ padding:'8px 10px 4px', fontFamily:FH, fontSize:12, fontWeight:700,
                    color:'#d0d0cc', textTransform:'uppercase', letterSpacing:'.1em' }}>{group}</div>
                  {items.map(s=>{
                    const I = s.icon
                    const active = section===s.key
                    return (
                      <button key={s.key} onClick={()=>setSection(s.key)}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9,
                          padding:'8px 10px', borderRadius:9, border:'none',
                          background:active?R+'12':'transparent',
                          color:active?R:'#374151',
                          fontSize:14, fontWeight:active?700:500,
                          cursor:'pointer', fontFamily:FH, textAlign:'left',
                          transition:'all .12s', marginBottom:1,
                          borderLeft:`2.5px solid ${active?R:'transparent'}` }}
                        onMouseEnter={e=>{ if(!active){e.currentTarget.style.background='#f9fafb';e.currentTarget.style.color='#0a0a0a'}}}
                        onMouseLeave={e=>{ if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#374151'}}}>
                        <I size={14} style={{ flexShrink:0 }}/> {s.label}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Content */}
          <div style={{ overflowY:'auto', padding:'24px 28px' }}>
            {loadingData ? (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
                <Loader2 size={24} color={R} style={{ animation:'spin 1s linear infinite' }}/>
              </div>
            ) : renderSection()}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}