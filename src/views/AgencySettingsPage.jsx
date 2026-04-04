"use client";
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { Save, Plus, Trash2, Copy, Check, Users, CreditCard, Globe, Palette, Shield, Zap, Mail, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'
const INP = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', background:'#fff', color:'#111', boxSizing:'border-box' }

const TABS = [
  { id:'general',  label:'General',   icon:Globe },
  { id:'branding', label:'Branding',  icon:Palette },
  { id:'team',     label:'Team',      icon:Users },
  { id:'billing',  label:'Billing',   icon:CreditCard },
  { id:'features', label:'Features',  icon:Zap },
  { id:'security', label:'Security',  icon:Shield },
]

const PLAN_DETAILS = {
  starter: { name:'Starter', price:297, seats:3, clients:25, color:'#6b7280' },
  growth:  { name:'Growth',  price:497, seats:10, clients:100, color:ACCENT },
  pro:     { name:'Pro',     price:897, seats:25, clients:500, color:'#8b5cf6' },
  enterprise: { name:'Enterprise', price:null, seats:'∞', clients:'∞', color:'#111' },
}

export default function AgencySettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('general')
  const [agency, setAgency] = useState(null)
  const [members, setMembers] = useState([])
  const [features, setFeatures] = useState(null)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: memberData } = await supabase.from('agency_members').select('agency_id, role').eq('user_id', user?.id).single()
    if (!memberData) return
    const agencyId = memberData.agency_id
    const [{ data: ag }, { data: mem }, { data: feat }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', agencyId).single(),
      supabase.from('agency_members').select('*, user:user_id(email)').eq('agency_id', agencyId),
      supabase.from('agency_features').select('*').eq('agency_id', agencyId).single(),
    ])
    setAgency(ag); setMembers(mem||[]); setFeatures(feat)
  }

  async function saveAgency() {
    setSaving(true)
    await supabase.from('agencies').update({ ...agency, updated_at: new Date().toISOString() }).eq('id', agency.id)
    toast.success('Settings saved'); setSaving(false)
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return
    await supabase.from('agency_invitations').insert({ agency_id: agency.id, email: inviteEmail, role: inviteRole, invited_by: user.id })
    toast.success(`Invitation sent to ${inviteEmail}`)
    setInviteEmail('')
  }

  function copyPortalLink() {
    const link = `${window.location.origin}/signup?ref=${agency?.slug}`
    navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast.success('Referral link copied!')
  }

  if (!agency) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:14, color:'#9ca3af' }}>Loading agency settings…</div>
      </div>
    </div>
  )

  const plan = PLAN_DETAILS[agency.plan] || PLAN_DETAILS.starter

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        {/* Header */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'18px 28px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>Agency Settings</h1>
            <p style={{ fontSize:12, color:'#9ca3af', margin:'3px 0 0' }}>{agency.name} · {plan.name} Plan</p>
          </div>
          <button onClick={saveAgency} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?.7:1 }}>
            <Save size={13}/> {saving?'Saving…':'Save Changes'}
          </button>
        </div>

        <div style={{ display:'flex', maxWidth:1100, margin:'0 auto', padding:'24px 28px', gap:24 }}>
          {/* Tab sidebar */}
          <div style={{ width:200, flexShrink:0 }}>
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:tab===t.id?'#fff7f5':'transparent', border:'none', cursor:'pointer', color:tab===t.id?ACCENT:'#374151', fontWeight:tab===t.id?700:500, fontSize:13, borderLeft:`3px solid ${tab===t.id?ACCENT:'transparent'}`, textAlign:'left' }}>
                  <t.icon size={14}/> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex:1 }}>

            {/* General */}
            {tab==='general'&&(
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px' }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:20 }}>General Settings</h2>
                <div style={{ display:'grid', gap:16 }}>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Agency Name</label><input value={agency.name||''} onChange={e=>setAgency(a=>({...a,name:e.target.value}))} style={INP}/></div>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Slug (subdomain)</label>
                    <div style={{ display:'flex', alignItems:'center', borderRadius:10, border:'1.5px solid #e5e7eb', overflow:'hidden' }}>
                      <input value={agency.slug||''} onChange={e=>setAgency(a=>({...a,slug:e.target.value}))} style={{ ...INP, border:'none', borderRadius:0, flex:1 }}/>
                      <span style={{ padding:'11px 14px', background:'#f9fafb', fontSize:13, color:'#9ca3af', borderLeft:'1px solid #e5e7eb' }}>.mooseai.com</span>
                    </div>
                  </div>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Billing Email</label><input type="email" value={agency.billing_email||''} onChange={e=>setAgency(a=>({...a,billing_email:e.target.value}))} style={INP}/></div>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Custom Domain <span style={{ fontSize:11, color:'#9ca3af', fontWeight:400 }}>(Pro+ only)</span></label><input value={agency.brand_domain||''} onChange={e=>setAgency(a=>({...a,brand_domain:e.target.value}))} placeholder="app.youragency.com" style={INP} disabled={agency.plan==='starter'}/></div>
                </div>
                {/* Referral link */}
                <div style={{ marginTop:24, background:'#f9fafb', borderRadius:12, padding:'16px 18px', border:'1px solid #f3f4f6' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:6 }}>Your Referral Link</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>Share this to earn 20% recurring commission on referred agencies</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input readOnly value={`${window.location.origin}/signup?ref=${agency.slug}`} style={{ ...INP, flex:1, fontSize:12, color:'#9ca3af', background:'#fff' }}/>
                    <button onClick={copyPortalLink} style={{ padding:'10px 14px', borderRadius:9, border:`1.5px solid ${ACCENT}`, background:'#fff', color:ACCENT, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:5 }}>
                      {copied?<><Check size={12}/> Copied!</>:<><Copy size={12}/> Copy</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Branding */}
            {tab==='branding'&&(
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px' }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:6 }}>White-Label Branding</h2>
                <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20 }}>Your clients will see your brand, not Moose AI</p>
                <div style={{ display:'grid', gap:16 }}>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Brand Name (shown to clients)</label><input value={agency.brand_name||''} onChange={e=>setAgency(a=>({...a,brand_name:e.target.value}))} placeholder={agency.name} style={INP}/></div>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Logo URL</label>
                    <input value={agency.brand_logo_url||''} onChange={e=>setAgency(a=>({...a,brand_logo_url:e.target.value}))} placeholder="https://youragency.com/logo.png" style={INP}/>
                    {agency.brand_logo_url&&<img src={agency.brand_logo_url} alt="logo preview" style={{ marginTop:8, height:48, objectFit:'contain', border:'1px solid #e5e7eb', borderRadius:8, padding:8, background:'#f9fafb' }} onError={e=>e.target.style.display='none'}/>}
                  </div>
                  <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Brand Color</label>
                    <div style={{ display:'flex', gap:10 }}>
                      <input type="color" value={agency.brand_color||ACCENT} onChange={e=>setAgency(a=>({...a,brand_color:e.target.value}))} style={{ width:46, height:44, borderRadius:9, border:'1.5px solid #e5e7eb', padding:3, cursor:'pointer' }}/>
                      <input value={agency.brand_color||ACCENT} onChange={e=>setAgency(a=>({...a,brand_color:e.target.value}))} style={{ ...INP, flex:1, fontFamily:'monospace' }}/>
                    </div>
                    {/* Color preview */}
                    <div style={{ marginTop:10, padding:'12px 16px', borderRadius:10, background:'#f9fafb', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:agency.brand_color||ACCENT }}/>
                      <div style={{ fontSize:13, color:'#374151' }}>Buttons, highlights, and accent colors across the platform</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Team */}
            {tab==='team'&&(
              <div>
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px', marginBottom:16 }}>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:4 }}>Team Members</h2>
                  <p style={{ fontSize:13, color:'#9ca3af', marginBottom:18 }}>{members.length} of {plan.seats} seats used</p>
                  {members.map(m=>(
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>{m.user?.email?.[0]?.toUpperCase()||'?'}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>{m.user?.email}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{m.accepted_at?'Active':'Pending'}</div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:m.role==='owner'?'#fff7f5':m.role==='admin'?'#eff6ff':'#f3f4f6', color:m.role==='owner'?ACCENT:m.role==='admin'?'#1d4ed8':'#6b7280' }}>{m.role}</span>
                      {m.user_id!==user?.id&&<button onClick={async()=>{ await supabase.from('agency_members').delete().eq('id',m.id); loadData(); toast.success('Member removed') }} style={{ padding:'5px 8px', borderRadius:7, border:'none', background:'#fef2f2', color:'#dc2626', cursor:'pointer' }}><Trash2 size={13}/></button>}
                    </div>
                  ))}
                </div>
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px' }}>
                  <h3 style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:14 }}>Invite Team Member</h3>
                  <div style={{ display:'flex', gap:10 }}>
                    <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@youragency.com" style={{ ...INP, flex:1 }}/>
                    <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} style={{ ...INP, width:120, cursor:'pointer' }}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={inviteMember} style={{ padding:'11px 18px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 }}><Plus size={14}/></button>
                  </div>
                </div>
              </div>
            )}

            {/* Billing */}
            {tab==='billing'&&(
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px' }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:20 }}>Billing & Plan</h2>
                <div style={{ background:`linear-gradient(135deg, ${plan.color}10, transparent)`, border:`1.5px solid ${plan.color}30`, borderRadius:14, padding:'20px 22px', marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#111' }}>{plan.name} Plan</div>
                      <div style={{ fontSize:13, color:'#6b7280' }}>{plan.seats} seats · {plan.clients} clients · {agency.status==='trial'?'Free trial':'Active'}</div>
                    </div>
                    {plan.price&&<div style={{ fontSize:28, fontWeight:900, color:plan.color }}>${plan.price}<span style={{ fontSize:13, fontWeight:500, color:'#9ca3af' }}>/mo</span></div>}
                  </div>
                  <button style={{ padding:'8px 18px', borderRadius:9, border:`1.5px solid ${plan.color}`, background:'#fff', color:plan.color, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    Upgrade Plan
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[
                    { label:'Seats Used', value:`${members.length}/${plan.seats}` },
                    { label:'Clients', value:`—/${plan.clients}` },
                    { label:'Trial Ends', value:agency.trial_ends_at?new Date(agency.trial_ends_at).toLocaleDateString():'N/A' },
                  ].map(s=>(
                    <div key={s.label} style={{ background:'#f9fafb', borderRadius:10, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:20, fontWeight:800, color:'#111' }}>{s.value}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            {tab==='features'&&features&&(
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 26px' }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:6 }}>AI Features</h2>
                <p style={{ fontSize:13, color:'#9ca3af', marginBottom:20 }}>Toggle which AI features are active for your agency</p>
                {[
                  { key:'ai_personas', label:'AI Persona Builder', desc:'Generate ideal customer personas from onboarding data', plans:['starter','growth','pro'] },
                  { key:'ai_social_posts', label:'AI Social Planner', desc:'Auto-generate and schedule social media posts', plans:['growth','pro'] },
                  { key:'ai_review_responses', label:'AI Review Response Bot', desc:'Automatically respond to Google and Yelp reviews', plans:['growth','pro'] },
                  { key:'ai_lead_qualifier', label:'AI Lead Qualifier', desc:'SMS-based lead qualification and appointment booking', plans:['pro'] },
                  { key:'white_label', label:'White-Label Branding', desc:'Remove all Moose AI branding from the client experience', plans:['growth','pro'] },
                  { key:'api_access', label:'API Access', desc:'Programmatic access to all agency data and AI features', plans:['pro'] },
                ].map(f=>{
                  const available = f.plans.includes(agency.plan)
                  return (
                    <div key={f.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color: available?'#111':'#9ca3af' }}>{f.label}</div>
                        <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{f.desc}</div>
                        {!available&&<div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginTop:3 }}>Requires {f.plans[0]} plan</div>}
                      </div>
                      <div onClick={()=>available&&setFeatures(prev=>({...prev,[f.key]:!prev[f.key]}))}
                        style={{ width:40, height:22, borderRadius:11, background:features[f.key]&&available?ACCENT:'#d1d5db', cursor:available?'pointer':'not-allowed', position:'relative', transition:'background .2s', flexShrink:0 }}>
                        <div style={{ position:'absolute', top:3, left:features[f.key]&&available?20:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                      </div>
                    </div>
                  )
                })}
                <button onClick={async()=>{ await supabase.from('agency_features').update(features).eq('agency_id',agency.id); toast.success('Features updated') }}
                  style={{ marginTop:16, padding:'10px 20px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Save Feature Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
