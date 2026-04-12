"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, FileText, ClipboardList, Shield, Globe, Zap,
  Plus, Trash2, Edit2, Save, X, ChevronRight, Check,
  Sparkles, Loader2, Copy, Eye, EyeOff, RefreshCw,
  ToggleLeft, ToggleRight, Key, AlertCircle, Users,
  DollarSign, BarChart2, Lock, HardDrive, Building2
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AIThinkingBox from '../components/AIThinkingBox'
import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/ai'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const ACCENT = '#E6007E'
const TEAL   = '#00C2CB'

const SECTIONS = [
  { key:'agencies',    label:'Agencies',               icon:Building2,      desc:'Create, manage, and switch into agency accounts' },
  { key:'users',       label:'Users & Passwords',      icon:Key,            desc:'Create user accounts, set and reset passwords' },
  { key:'features',    label:'Agency Features',        icon:ToggleRight,    desc:'Control which features each agency can access' },
  { key:'onboarding',  label:'Onboarding Templates',  icon:ClipboardList, desc:'Customize what clients fill out' },
  { key:'proposals',   label:'Proposal & SOW Library', icon:FileText,      desc:'Pre-written service templates' },
  { key:'agreements',  label:'Agreement Templates',    icon:Shield,         desc:'Legal terms and clauses' },
  { key:'branding',    label:'Agency Branding',        icon:Globe,          desc:'Colors, logo, white-label' },
  { key:'integrations',label:'Platform Integrations',  icon:Zap,            desc:'API keys and connections' },
  { key:'access',      label:'Access & Permissions',   icon:Lock,           desc:'Team roles and client access' },
]

const FEATURE_GROUPS = [
  { label: 'Core Features', features: [
    { key: 'page_builder', label: 'Page Builder' }, { key: 'wordpress_plugin', label: 'WordPress Plugin' },
    { key: 'seo_hub', label: 'SEO Hub' }, { key: 'reviews', label: 'Reviews' },
    { key: 'review_campaigns', label: 'Review Campaigns' }, { key: 'proposals', label: 'Proposals' },
    { key: 'proposal_library', label: 'Proposal Library' }, { key: 'automations', label: 'Automations' },
    { key: 'tasks', label: 'Tasks' }, { key: 'koto_desk', label: 'KotoDesk' },
    { key: 'help_center', label: 'Help Center' }, { key: 'scout', label: 'Scout' },
    { key: 'pipeline_crm', label: 'Pipeline CRM' }, { key: 'performance_dashboard', label: 'Performance Dashboard' },
  ]},
  { label: 'AI / Premium', features: [
    { key: 'cmo_agent', label: 'CMO Agent' }, { key: 'voice_agent', label: 'Voice Agent (Outbound)' },
    { key: 'answering_service', label: 'Answering Service (Inbound)' },
    { key: 'ai_page_research', label: 'AI Page Research' }, { key: 'ai_script_generation', label: 'AI Script Generation' },
  ]},
  { label: 'Billing', features: [
    { key: 'client_billing', label: 'Client Billing' }, { key: 'credit_system', label: 'Credit System' },
    { key: 'phone_numbers', label: 'Phone Numbers' },
  ]},
  { label: 'Admin', features: [
    { key: 'team_management', label: 'Team Management' }, { key: 'white_label', label: 'White Label' },
    { key: 'custom_domain', label: 'Custom Domain' }, { key: 'api_access', label: 'API Access' },
  ]},
]

// ── Simple rich text editor field ─────────────────────────────────────────
function TemplateField({ label, value, onChange, rows=6, aiContext='' }) {
  const [generating, setGenerating] = useState(false)

  async function aiEnhance() {
    if (!value?.trim()) return
    setGenerating(true)
    try {
      const result = await callClaude(
        'You are an expert marketing agency content writer. Rewrite the following to be more professional, clear, and compelling. Keep the same structure and intent. Return ONLY the rewritten text.',
        `${aiContext ? `Context: ${aiContext}\n` : ''}Content to improve:\n${value}`, 800
      )
      onChange(result)
      toast.success('Enhanced with AI')
    } catch { toast.error('AI unavailable') }
    setGenerating(false)
  }

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <label style={{ fontSize:13, fontWeight:800, color:'#111' }}>{label}</label>
        {value?.trim() && (
          <button onClick={aiEnhance} disabled={generating}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:7, border:'none', background:'#7c3aed', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {generating?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={10}/>} {generating?'Enhancing…':'AI Enhance'}
          </button>
        )}
      </div>
      {generating && <div style={{marginBottom:8}}><AIThinkingBox active={generating} task='proposal' inline/></div>}
      <textarea value={value||''} onChange={e=>onChange(e.target.value)} rows={rows}
        style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, fontFamily:'inherit', lineHeight:1.65, outline:'none', resize:'vertical', color:'#111', boxSizing:'border-box' }}
        onFocus={e=>e.target.style.borderColor=ACCENT}
        onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
    </div>
  )
}

export default function PlatformAdminPage() {
  const navigate = useNavigate()
  const { agencyId, firstName, agencyName, isOwner } = useAuth()
  const [section, setSection] = useState('onboarding')
  const [saving, setSaving]   = useState(false)

  // Agency features state
  const [featAgencies, setFeatAgencies] = useState([])
  const [featExpanded, setFeatExpanded] = useState(null)
  const [featData, setFeatData] = useState({})
  const [featSaving, setFeatSaving] = useState(false)

  // Onboarding template state
  const [onboardingFields, setOnboardingFields] = useState([])
  const [onboardingIntro, setOnboardingIntro]   = useState('')
  const [onboardingTitle, setOnboardingTitle]   = useState('')
  const [loadingOnboarding, setLoadingOnboarding] = useState(false)

  // Service modules (proposals)
  const [modules, setModules] = useState([])
  const [editingModule, setEditingModule] = useState(null)
  const [moduleForm, setModuleForm] = useState({ name:'', category:'general', description:'', price:0, price_type:'monthly', timeline:'' })

  // Agreement templates
  const [agreementTerms, setAgreementTerms] = useState('')
  const [paymentTerms, setPaymentTerms]     = useState('')
  const [revisionPolicy, setRevisionPolicy] = useState('')
  const [ipTerms, setIpTerms]               = useState('')

  // Agency branding
  const [brand, setBrand] = useState({ name:'', color:'#E6007E', logo_url:'', domain:'' })

  // Platform keys
  const [keys, setKeys] = useState({ anthropic:'', google_places:'', google_client_id:'' })
  const [showKeys, setShowKeys] = useState({})

  useEffect(() => { loadAll() }, [agencyId])

  async function loadAll() {
    if (!agencyId) return
    setLoadingOnboarding(true)

    const [{ data: mods }, { data: ag }, { data: settings }] = await Promise.all([
      supabase.from('service_modules').select('*').eq('agency_id', agencyId).order('sort_order'),
      supabase.from('agencies').select('*').eq('id', agencyId).single(),
      supabase.from('agency_features').select('*').eq('agency_id', agencyId).single(),
    ])

    setModules(mods || [])
    if (ag) {
      setBrand({ name: ag.brand_name||ag.name||'', color: ag.brand_color||ACCENT, logo_url: ag.brand_logo_url||'', domain: ag.brand_domain||'' })
      // Load saved templates from agency metadata
      const meta = ag.metadata || {}
      setOnboardingIntro(meta.onboarding_intro || '')
      setOnboardingTitle(meta.onboarding_title || 'Tell us about your business')
      setAgreementTerms(meta.agreement_terms || '')
      setPaymentTerms(meta.payment_terms || '')
      setRevisionPolicy(meta.revision_policy || '')
      setIpTerms(meta.ip_terms || '')
    }
    setLoadingOnboarding(false)
  }

  async function saveSection() {
    setSaving(true)
    if (section === 'branding') {
      await supabase.from('agencies').update({
        brand_name: brand.name, brand_color: brand.color,
        brand_logo_url: brand.logo_url, brand_domain: brand.domain,
      }).eq('id', agencyId)
      toast.success('Branding saved')
    }
    if (section === 'agreements' || section === 'onboarding') {
      // Save to agency metadata jsonb
      const { data: ag } = await supabase.from('agencies').select('metadata').eq('id', agencyId).single()
      const meta = ag?.metadata || {}
      await supabase.from('agencies').update({
        metadata: {
          ...meta,
          onboarding_intro: onboardingIntro,
          onboarding_title: onboardingTitle,
          agreement_terms:  agreementTerms,
          payment_terms:    paymentTerms,
          revision_policy:  revisionPolicy,
          ip_terms:         ipTerms,
        }
      }).eq('id', agencyId)
      toast.success('Templates saved')
    }
    setSaving(false)
  }

  async function saveModule() {
    if (!moduleForm.name.trim()) return
    if (editingModule) {
      await supabase.from('service_modules').update({ ...moduleForm, updated_at: new Date().toISOString() }).eq('id', editingModule)
      toast.success('Module updated')
    } else {
      await supabase.from('service_modules').insert({ ...moduleForm, agency_id: agencyId, sort_order: modules.length })
      toast.success('Module added')
    }
    setEditingModule(null)
    setModuleForm({ name:'', category:'general', description:'', price:0, price_type:'monthly', timeline:'' })
    const { data } = await supabase.from('service_modules').select('*').eq('agency_id', agencyId).order('sort_order')
    setModules(data||[])
  }

  async function deleteModule(id) {
    if (!confirm('Delete this service module?')) return
    await supabase.from('service_modules').delete().eq('id', id)
    setModules(m => m.filter(x=>x.id!==id))
    toast.success('Deleted')
  }

  function startEditModule(m) {
    setEditingModule(m.id)
    setModuleForm({ name:m.name, category:m.category||'general', description:m.description||'', price:m.price||0, price_type:m.price_type||'monthly', timeline:m.timeline||'' })
  }

  const CATEGORIES = ['reputation','local_seo','web','social','paid_ads','retainer','general','seo','email','video']

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f4f4f5' }}>
      <Sidebar/>

      {/* Inner admin nav */}
      <div style={{ width:240, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:13, fontWeight:800, color:ACCENT, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Platform Admin</div>
          <div style={{ fontSize:20, fontWeight:900, color:'#111' }}>Agency Controls</div>
          <div style={{ fontSize:13, color:'#374151', marginTop:2 }}>{agencyName}</div>
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:'10px 10px' }}>
          {SECTIONS.map(s => {
            const I = s.icon
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'11px 12px', borderRadius:11, border:'none', marginBottom:3, cursor:'pointer', background: section===s.key?ACCENT+'10':'transparent', borderLeft: section===s.key?`3px solid ${ACCENT}`:'3px solid transparent', color: section===s.key?ACCENT:'#374151', fontSize:14, fontWeight: section===s.key?800:600, transition:'all .15s', textAlign:'left' }}>
                <I size={16} color={section===s.key?ACCENT:'#374151'}/>
                <div>
                  <div>{s.label}</div>
                  <div style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{s.desc}</div>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main */}
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:820, margin:'0 auto', padding:'28px 32px' }}>

          {/* Section header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#111', margin:0 }}>
                {SECTIONS.find(s=>s.key===section)?.label}
              </h1>
              <p style={{ fontSize:14, color:'#374151', margin:'4px 0 0' }}>
                {SECTIONS.find(s=>s.key===section)?.desc}
              </p>
            </div>
            {['onboarding','agreements','branding'].includes(section) && (
              <button onClick={saveSection} disabled={saving}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 20px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {saving?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Save size={13}/>} Save Changes
              </button>
            )}
          </div>

          {/* ── ONBOARDING TEMPLATES ── */}
          {section === 'onboarding' && (
            <div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'22px 24px', marginBottom:14 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:14 }}>Onboarding form customization</div>
                <TemplateField label="Form Title" value={onboardingTitle} onChange={setOnboardingTitle} rows={2}/>
                <TemplateField label="Welcome Message / Introduction" value={onboardingIntro} onChange={setOnboardingIntro} rows={5}
                  aiContext="This is the introduction shown to new clients when they fill out the onboarding questionnaire"/>
                <div style={{ padding:'12px 14px', background:'#f0fbfc', borderRadius:10, border:`1px solid ${TEAL}40`, fontSize:14, color:'#0e7490' }}>
                  The full onboarding form fields (business info, services, competitors, goals, access) are built into the platform. The above controls the messaging and introduction clients see.
                </div>
              </div>
            </div>
          )}

          {/* ── SERVICE MODULES (Proposals) ── */}
          {section === 'proposals' && (
            <div>
              {/* Add/edit form */}
              <div style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${ACCENT}30`, padding:'20px 24px', marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:14 }}>
                  {editingModule ? 'Edit service module' : 'Add new service module'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Service name</label>
                    <input value={moduleForm.name} onChange={e=>setModuleForm(f=>({...f,name:e.target.value}))}
                      placeholder="e.g. Google Ads Management"
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Category</label>
                    <select value={moduleForm.category} onChange={e=>setModuleForm(f=>({...f,category:e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', background:'#fff', boxSizing:'border-box' }}>
                      {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1).replace('_',' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Price ($)</label>
                    <input type="number" value={moduleForm.price} onChange={e=>setModuleForm(f=>({...f,price:+e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Billing type</label>
                    <select value={moduleForm.price_type} onChange={e=>setModuleForm(f=>({...f,price_type:e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', background:'#fff', boxSizing:'border-box' }}>
                      <option value="monthly">Monthly</option>
                      <option value="one_time">One-time</option>
                      <option value="hourly">Hourly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Timeline</label>
                    <input value={moduleForm.timeline} onChange={e=>setModuleForm(f=>({...f,timeline:e.target.value}))}
                      placeholder="e.g. Ongoing, 4-6 weeks"
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Description</label>
                  <textarea value={moduleForm.description} onChange={e=>setModuleForm(f=>({...f,description:e.target.value}))} rows={3}
                    placeholder="Describe what this service includes and the value it delivers…"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, fontFamily:'inherit', lineHeight:1.65, outline:'none', resize:'vertical', color:'#111', boxSizing:'border-box' }}/>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={saveModule}
                    style={{ padding:'9px 20px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <Save size={13}/> {editingModule?'Update':'Add Module'}
                  </button>
                  {editingModule && (
                    <button onClick={() => { setEditingModule(null); setModuleForm({ name:'', category:'general', description:'', price:0, price_type:'monthly', timeline:'' }) }}
                      style={{ padding:'9px 16px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:14, cursor:'pointer' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Modules list */}
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>Service library ({modules.length} modules)</div>
                </div>
                {modules.length === 0 ? (
                  <div style={{ padding:'40px 24px', textAlign:'center', color:'#374151', fontSize:14 }}>No modules yet — add your first service above</div>
                ) : modules.map((m,i)=>(
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom: i<modules.length-1?'1px solid #f9fafb':'none' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{m.name}</div>
                      <div style={{ fontSize:13, color:'#374151', marginTop:2 }}>{m.category} · ${(m.price||0).toLocaleString()} {m.price_type==='monthly'?'/mo':m.price_type==='one_time'?'one-time':m.price_type}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => startEditModule(m)}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:4 }}>
                        <Edit2 size={12}/> Edit
                      </button>
                      <button onClick={() => deleteModule(m.id)}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid #fecaca', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#dc2626', display:'flex', alignItems:'center', gap:4 }}>
                        <Trash2 size={12}/> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AGREEMENT TEMPLATES ── */}
          {section === 'agreements' && (
            <div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'22px 24px' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:4 }}>Default agreement terms</div>
                <div style={{ fontSize:14, color:'#374151', marginBottom:16 }}>These become the default "Terms & Conditions" section in all new proposals and agreements. Each can still be edited per-proposal.</div>
                <TemplateField label="General Terms & Conditions" value={agreementTerms} onChange={setAgreementTerms} rows={7}
                  aiContext="Agency service agreement terms and conditions"/>
                <TemplateField label="Payment Terms" value={paymentTerms} onChange={setPaymentTerms} rows={4}
                  aiContext="Agency payment policy and billing terms"/>
                <TemplateField label="Revision Policy" value={revisionPolicy} onChange={setRevisionPolicy} rows={4}
                  aiContext="Creative revision rounds policy"/>
                <TemplateField label="Intellectual Property" value={ipTerms} onChange={setIpTerms} rows={4}
                  aiContext="IP rights and ownership upon payment"/>
              </div>
            </div>
          )}

          {/* ── BRANDING ── */}
          {section === 'branding' && (
            <div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'22px 24px' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:16 }}>White-label settings</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {[
                    { label:'Agency / Brand name', key:'name', placeholder:'Unified Marketing Group' },
                    { label:'Primary domain (white-label)', key:'domain', placeholder:'dashboard.youragency.com' },
                    { label:'Logo URL', key:'logo_url', placeholder:'https://youragency.com/logo.png' },
                  ].map(f=>(
                    <div key={f.key} style={{ gridColumn: f.key==='logo_url'?'1/-1':undefined }}>
                      <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>{f.label}</label>
                      <input value={brand[f.key]||''} onChange={e=>setBrand(b=>({...b,[f.key]:e.target.value}))}
                        placeholder={f.placeholder}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Brand color</label>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="color" value={brand.color||ACCENT} onChange={e=>setBrand(b=>({...b,color:e.target.value}))}
                        style={{ width:44, height:44, borderRadius:9, border:'1.5px solid #e5e7eb', cursor:'pointer' }}/>
                      <input value={brand.color||ACCENT} onChange={e=>setBrand(b=>({...b,color:e.target.value}))}
                        style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', fontFamily:'monospace', color:'#111' }}/>
                      <div style={{ width:36, height:36, borderRadius:9, background:brand.color||ACCENT }}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {section === 'integrations' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'anthropic', label:'Anthropic Claude AI', desc:'Powers AI Suggest, proposal writing, review responses', env:'NEXT_PUBLIC_ANTHROPIC_API_KEY', link:'https://console.anthropic.com' },
                { key:'google_places', label:'Google Places API', desc:'Live business data in Scout search', env:'NEXT_PUBLIC_GOOGLE_PLACES_KEY', link:'https://console.cloud.google.com' },
                { key:'google_client_id', label:'Google OAuth Client ID', desc:'Search Console, Analytics, Ads connections', env:'NEXT_PUBLIC_GOOGLE_CLIENT_ID', link:'https://console.cloud.google.com' },
              ].map(item=>(
                <div key={item.key} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 22px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:ACCENT+'15', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Key size={17} color={ACCENT}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{item.label}</div>
                      <div style={{ fontSize:13, color:'#374151' }}>{item.desc}</div>
                    </div>
                    <a href={item.link} target="_blank" rel="noreferrer"
                      style={{ fontSize:13, color:ACCENT, fontWeight:700, textDecoration:'none' }}>Get key →</a>
                  </div>
                  <div style={{ background:'#f9fafb', borderRadius:9, padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#374151', border:'1px solid #f3f4f6' }}>
                    Set <strong>{item.env}</strong> in Vercel → Project → Settings → Environment Variables
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACCESS ── */}
          {section === 'agencies' && (
            <AgenciesPanel />
          )}

          {section === 'users' && (
            <UsersPanel />
          )}

          {section === 'access' && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'22px 24px' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:6 }}>Role-based access</div>
              <div style={{ fontSize:14, color:'#374151', marginBottom:16 }}>Control what team members and clients can see and do</div>
              {[
                { role:'Owner', perms:['Full platform access','Billing and plan','Invite team','Delete clients','Admin portal'], color:ACCENT },
                { role:'Manager', perms:['All clients','All projects','Proposals','Reviews','Scout'], color:'#7c3aed' },
                { role:'Designer', perms:['Assigned clients only','Projects and files','No billing or admin'], color:TEAL },
                { role:'Viewer', perms:['View-only access','No editing or creation'], color:'#374151' },
              ].map(r=>(
                <div key={r.role} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ fontSize:13, fontWeight:800, padding:'4px 12px', borderRadius:20, background:r.color+'15', color:r.color, flexShrink:0, marginTop:2 }}>{r.role}</span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {r.perms.map(p=>(
                      <span key={p} style={{ fontSize:13, padding:'3px 10px', borderRadius:20, background:'#f3f4f6', color:'#374151' }}>{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'features' && (
            <AgencyFeaturesPanel
              agencies={featAgencies} setAgencies={setFeatAgencies}
              expanded={featExpanded} setExpanded={setFeatExpanded}
              featData={featData} setFeatData={setFeatData}
              saving={featSaving} setSaving={setFeatSaving}
            />
          )}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ── Agencies Panel — create, manage, switch into agencies ────────────── */
function AgenciesPanel() {
  const { impersonateAgency } = useAuth()
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name:'', owner_name:'', owner_email:'', owner_password:'', plan:'starter' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'list_agencies' }) }).then(r=>r.json())
    setAgencies(res.agencies || res || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.name) { toast.error('Agency name required'); return }
    setCreating(true)
    try {
      // 1. Create the agency
      const agRes = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create_agency', name:form.name, owner_name:form.owner_name, owner_email:form.owner_email, plan:form.plan, send_welcome_email:true })
      }).then(r=>r.json())
      if (agRes.error) { toast.error(agRes.error); setCreating(false); return }

      // 2. Create the owner user account with password
      if (form.owner_email && form.owner_password) {
        const userRes = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'create_user', email:form.owner_email, password:form.owner_password, first_name:form.owner_name?.split(' ')[0], last_name:form.owner_name?.split(' ').slice(1).join(' '), agency_id:agRes.id, role:'owner' })
        }).then(r=>r.json())
        if (userRes.error) toast.error('Agency created but user failed: ' + userRes.error)
        else toast.success('Agency + user created')
      } else {
        toast.success('Agency created (no user account — add one in Users tab)')
      }
      setShowCreate(false)
      setForm({ name:'', owner_name:'', owner_email:'', owner_password:'', plan:'starter' })
      load()
    } catch (e) { toast.error(e.message) }
    setCreating(false)
  }

  function switchTo(ag) {
    impersonateAgency({ id: ag.id, name: ag.brand_name || ag.name })
    toast.success(`Switched to ${ag.brand_name || ag.name}`)
    navigate('/')
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#999' }}>Loading agencies…</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>{agencies.length} Agencies</div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          <Plus size={14}/> New Agency
        </button>
      </div>

      {showCreate && (
        <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:12 }}>Create New Agency</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>Agency Name *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Momenta Marketing" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Plan</label>
              <select value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})} style={inp}>
                <option value="starter">Starter ($297/mo)</option>
                <option value="growth">Growth ($597/mo)</option>
                <option value="agency">Agency ($997/mo)</option>
                <option value="enterprise">Enterprise ($1,997/mo)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Owner Name</label>
              <input value={form.owner_name} onChange={e=>setForm({...form,owner_name:e.target.value})} placeholder="John Smith" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Owner Email</label>
              <input value={form.owner_email} onChange={e=>setForm({...form,owner_email:e.target.value})} placeholder="john@agency.com" style={inp}/>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Set Password (leave blank to skip user creation)</label>
              <input type="password" value={form.owner_password} onChange={e=>setForm({...form,owner_password:e.target.value})} placeholder="Minimum 6 characters" style={inp}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={handleCreate} disabled={creating || !form.name}
              style={{ padding:'8px 20px', borderRadius:8, border:'none', background:form.name ? ACCENT : '#e5e7eb', color:'#fff', fontSize:13, fontWeight:700, cursor:form.name?'pointer':'not-allowed' }}>
              {creating ? 'Creating…' : 'Create Agency'}
            </button>
            <button onClick={()=>setShowCreate(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {agencies.map(ag => (
        <div key={ag.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>{ag.brand_name || ag.name}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{ag.owner_email || '—'} · {ag.plan || 'starter'} · {ag.status || 'active'}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>switchTo(ag)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid '+TEAL+'40', background:'#fff', color:TEAL, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Switch Into →
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Users & Passwords Panel ─────────────────────────────────────────── */
function UsersPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pwUserId, setPwUserId] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email:'', password:'', first_name:'', last_name:'', agency_id:'', role:'owner' })
  const [agencies, setAgencies] = useState([])
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [uRes, aRes] = await Promise.all([
      fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'list_users' }) }).then(r=>r.json()),
      fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'list_agencies' }) }).then(r=>r.json()),
    ])
    setUsers(uRes.users || [])
    setAgencies(aRes.agencies || aRes || [])
    setLoading(false)
  }

  async function setPassword(userId) {
    if (!newPw || newPw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    const res = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'set_password', user_id:userId, new_password:newPw })
    }).then(r=>r.json())
    if (res.error) toast.error(res.error)
    else { toast.success('Password updated'); setPwUserId(null); setNewPw('') }
  }

  async function sendReset(email) {
    const res = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'send_password_reset', email })
    }).then(r=>r.json())
    if (res.error) toast.error(res.error)
    else toast.success(res.message || 'Reset email sent')
  }

  async function handleCreate() {
    if (!form.email || !form.password) { toast.error('Email and password required'); return }
    setCreating(true)
    const res = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'create_user', ...form })
    }).then(r=>r.json())
    if (res.error) toast.error(res.error)
    else { toast.success('User created'); setShowCreate(false); setForm({ email:'', password:'', first_name:'', last_name:'', agency_id:'', role:'owner' }); load() }
    setCreating(false)
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#999' }}>Loading users…</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>{users.length} Users</div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:TEAL, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          <Plus size={14}/> New User
        </button>
      </div>

      {showCreate && (
        <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:12 }}>Create User Account</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Email *</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="user@agency.com" style={inp}/></div>
            <div><label style={lbl}>Password *</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min 6 characters" style={inp}/></div>
            <div><label style={lbl}>First Name</label><input value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} style={inp}/></div>
            <div><label style={lbl}>Last Name</label><input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} style={inp}/></div>
            <div>
              <label style={lbl}>Assign to Agency</label>
              <select value={form.agency_id} onChange={e=>setForm({...form,agency_id:e.target.value})} style={inp}>
                <option value="">No agency</option>
                {agencies.map(a=><option key={a.id} value={a.id}>{a.brand_name||a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Role</label>
              <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={inp}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Staff</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={handleCreate} disabled={creating || !form.email || !form.password}
              style={{ padding:'8px 20px', borderRadius:8, border:'none', background:TEAL, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
            <button onClick={()=>setShowCreate(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {users.map(u => (
        <div key={u.id} style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>{u.first_name ? `${u.first_name} ${u.last_name||''}` : u.email}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>
                {u.email}
                {u.agency ? ` · ${u.agency.name} (${u.agency.role})` : ' · No agency'}
                {u.last_sign_in_at ? ` · Last login ${new Date(u.last_sign_in_at).toLocaleDateString()}` : ' · Never logged in'}
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>{ setPwUserId(pwUserId===u.id?null:u.id); setNewPw('') }}
                style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:pwUserId===u.id?'#f3f4f6':'#fff', color:'#374151', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <Key size={11}/> Set Password
              </button>
              <button onClick={()=>sendReset(u.email)}
                style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <RefreshCw size={11}/> Send Reset
              </button>
            </div>
          </div>
          {pwUserId === u.id && (
            <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password (min 6 chars)"
                onKeyDown={e=>e.key==='Enter'&&setPassword(u.id)}
                style={{ flex:1, padding:'7px 10px', borderRadius:6, border:'1.5px solid #e5e7eb', fontSize:13 }}/>
              <button onClick={()=>setPassword(u.id)} disabled={!newPw||newPw.length<6}
                style={{ padding:'7px 14px', borderRadius:6, border:'none', background:newPw?.length>=6?ACCENT:'#e5e7eb', color:'#fff', fontSize:12, fontWeight:700, cursor:newPw?.length>=6?'pointer':'not-allowed' }}>
                Save Password
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const lbl = { display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }
const inp = { width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, boxSizing:'border-box', background:'#fff' }

/* ── Agency Features Panel (inline sub-component) ──────────────────────── */
function AgencyFeaturesPanel({ agencies, setAgencies, expanded, setExpanded, featData, setFeatData, saving, setSaving }) {
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadAgencies() }, [])

  async function loadAgencies() {
    setLoading(true)
    try {
      const res = await fetch('/api/permissions?action=get_all_agency_features')
      const data = await res.json()
      if (Array.isArray(data)) setAgencies(data)
    } catch {}
    setLoading(false)
  }

  async function toggleExpand(agencyId) {
    if (expanded === agencyId) { setExpanded(null); return }
    setExpanded(agencyId)
    const existing = agencies.find(a => a.agency_id === agencyId)
    if (existing) {
      setFeatData(existing)
    }
  }

  function toggleFeature(key) {
    setFeatData(d => ({ ...d, [key]: !d[key] }))
  }

  async function saveFeatures(agencyId) {
    setSaving(true)
    try {
      const features = {}
      FEATURE_GROUPS.forEach(g => g.features.forEach(f => { features[f.key] = !!featData[f.key] }))
      await fetch('/api/permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_agency_features', agency_id: agencyId, features }),
      })
      toast.success('Features saved')
      loadAgencies()
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  async function applyPlanDefaults(agencyId, plan) {
    setSaving(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_plan_defaults', agency_id: agencyId, plan }),
      })
      const data = await res.json()
      if (data.agency_id) { setFeatData(data); toast.success(`${plan} defaults applied`) }
      else toast.error(data.error || 'Failed')
      loadAgencies()
    } catch { toast.error('Failed') }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} color="#999" style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div>
      {agencies.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>No agencies found</div>
      ) : agencies.map(a => {
        const name = a.agencies?.brand_name || a.agencies?.name || a.agency_id?.slice(0, 8)
        const plan = a.agencies?.plan || 'starter'
        const isExpanded = expanded === a.agency_id
        const enabledCount = FEATURE_GROUPS.reduce((sum, g) => sum + g.features.filter(f => a[f.key]).length, 0)
        const totalCount = FEATURE_GROUPS.reduce((sum, g) => sum + g.features.length, 0)

        return (
          <div key={a.agency_id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 10, overflow: 'hidden' }}>
            <button onClick={() => toggleExpand(a.agency_id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', border: 'none', cursor: 'pointer', background: isExpanded ? '#f9fafb' : '#fff', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{name}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: plan === 'agency' ? ACCENT + '15' : plan === 'growth' ? TEAL + '15' : '#f3f4f6', color: plan === 'agency' ? ACCENT : plan === 'growth' ? TEAL : '#6b7280', textTransform: 'uppercase' }}>{plan}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{enabledCount}/{totalCount} features</span>
                <ChevronRight size={14} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
              </div>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f3f4f6' }}>
                {/* Plan preset buttons */}
                <div style={{ display: 'flex', gap: 8, padding: '14px 0', borderBottom: '1px solid #f3f4f6', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, lineHeight: '28px' }}>Apply plan defaults:</span>
                  {['starter', 'growth', 'agency'].map(p => (
                    <button key={p} onClick={() => applyPlanDefaults(a.agency_id, p)} disabled={saving}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textTransform: 'uppercase', color: p === 'agency' ? ACCENT : p === 'growth' ? TEAL : '#6b7280' }}>
                      {p}
                    </button>
                  ))}
                </div>

                {/* Feature toggles by group */}
                {FEATURE_GROUPS.map(g => (
                  <div key={g.label} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{g.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {g.features.map(f => (
                        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: featData[f.key] ? '#dcfce7' : '#f9fafb', border: featData[f.key] ? '1px solid #bbf7d0' : '1px solid #e5e7eb', transition: 'all .15s' }}>
                          <input type="checkbox" checked={!!featData[f.key]} onChange={() => toggleFeature(f.key)}
                            style={{ accentColor: '#16a34a', width: 16, height: 16 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: featData[f.key] ? '#111' : '#6b7280' }}>{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button onClick={() => saveFeatures(a.agency_id)} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
