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

const ACCENT = '#ea2729'
const TEAL   = '#5bc6d0'

const SECTIONS = [
  { key:'onboarding',  label:'Onboarding Templates',  icon:ClipboardList, desc:'Customize what clients fill out' },
  { key:'proposals',   label:'Proposal & SOW Library', icon:FileText,      desc:'Pre-written service templates' },
  { key:'agreements',  label:'Agreement Templates',    icon:Shield,         desc:'Legal terms and clauses' },
  { key:'branding',    label:'Agency Branding',        icon:Globe,          desc:'Colors, logo, white-label' },
  { key:'integrations',label:'Platform Integrations',  icon:Zap,            desc:'API keys and connections' },
  { key:'access',      label:'Access & Permissions',   icon:Lock,           desc:'Team roles and client access' },
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
  const [brand, setBrand] = useState({ name:'', color:'#ea2729', logo_url:'', domain:'' })

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

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
