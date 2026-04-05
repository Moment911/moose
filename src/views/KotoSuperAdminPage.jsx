"use client"
import { useState, useEffect } from 'react'
import {
  AlertCircle, BarChart2, Building2, Check, ChevronRight, Clock, DollarSign, Edit2, ExternalLink, Globe, Loader2, Plus, RefreshCw, Save, Search, Settings, Shield, Sparkles, Star, Tag, ToggleLeft, ToggleRight, Trash2, TrendingUp, Users, Zap
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const PLAN_CFG = {
  starter:    { color:TEAL,   bg:TEAL+'15',   price:297  },
  growth:     { color:RED,    bg:RED+'15',     price:497  },
  agency:     { color:BLK,    bg:'#f3f4f6',   price:997  },
  enterprise: { color:'#8b5cf6', bg:'#f5f3ff', price:1997 },
}

const STATUS_CFG = {
  trial:     { color:AMBER,   bg:'#fffbeb',  label:'Trial' },
  active:    { color:GREEN,   bg:'#f0fdf4',  label:'Active' },
  suspended: { color:RED,     bg:'#fef2f2',  label:'Suspended' },
  cancelled: { color:'#6b7280', bg:'#f3f4f6', label:'Cancelled' },
}

export default function KotoSuperAdminPage() {
  const { user, bypassMode, impersonateAgency, impersonateClient, stopImpersonating, isImpersonating } = useAuth()
  const navigate = useNavigate()
  const [tab,       setTab]       = useState('agencies')
  const [agencies,  setAgencies]  = useState([])
  const [clients,   setClients]   = useState([])
  const [members,   setMembers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(null)
  // Pricing editor
  const [plans,     setPlans]     = useState([])
  const [signupMeta, setSignupMeta] = useState({})
  const [editingPlan, setEditingPlan] = useState(null)
  const [savingPricing, setSavingPricing] = useState(false)
  const [pricingLoaded, setPricingLoaded] = useState(false)
  // Coupons
  const [coupons,      setCoupons]      = useState([])
  const [couponsLoaded,setCouponsLoaded]= useState(false)
  // Marketplace
  const [mpAgencies,   setMpAgencies]   = useState([])
  const [mpAddons,     setMpAddons]     = useState([])
  const [mpRequests,   setMpRequests]   = useState([])
  const [mpLoaded,     setMpLoaded]     = useState(false)
  const [toggling,     setToggling]     = useState({})
  const [showNewCoupon,setShowNewCoupon]= useState(false)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [newCoupon,    setNewCoupon]    = useState({
    code:'', description:'', discount_type:'percent', discount_value:20,
    applies_to:'all', max_uses:'', valid_until:'', trial_days:'', first_month_only:true
  })

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (tab === 'pricing' && !pricingLoaded) loadPricing() }, [tab])
  useEffect(() => { if (tab === 'coupons' && !couponsLoaded) loadCoupons() }, [tab])

  async function loadAll() {
    setLoading(true)
    const [{ data: ags }, { data: cls }, { data: mems }] = await Promise.all([
      supabase.from('agencies').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id,name,agency_id,status,monthly_value,created_at').order('name'),
      supabase.from('agency_members').select('*').order('invited_at', { ascending: false }),
    ])
    setAgencies(ags || [])
    setClients(cls || [])
    setMembers(mems || [])
    setLoading(false)
  }

  async function loadPricing() {
    const { data } = await supabase.from('platform_config').select('key,value').in('key', ['signup_plans','signup_meta'])
    if (data) {
      const plansRow = data.find(r => r.key === 'signup_plans')
      const metaRow  = data.find(r => r.key === 'signup_meta')
      if (plansRow) setPlans(plansRow.value)
      if (metaRow)  setSignupMeta(metaRow.value)
      setPricingLoaded(true)
    }
  }

  async function savePlans(updatedPlans) {
    setSavingPricing(true)
    await supabase.from('platform_config').upsert({ key:'signup_plans', value: updatedPlans, updated_at: new Date().toISOString() })
    setPlans(updatedPlans)
    setEditingPlan(null)
    setSavingPricing(false)
    toast.success('Pricing updated — live on signup page immediately')
  }

  async function saveMeta(updatedMeta) {
    setSavingPricing(true)
    await supabase.from('platform_config').upsert({ key:'signup_meta', value: updatedMeta, updated_at: new Date().toISOString() })
    setSignupMeta(updatedMeta)
    setSavingPricing(false)
    toast.success('Signup page copy updated')
  }

  function updatePlanField(planId, field, value) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, [field]: value } : p))
  }

  function updatePlanFeature(planId, idx, value) {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const features = [...p.features]
      features[idx] = value
      return { ...p, features }
    }))
  }

  function addFeature(planId) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, features: [...p.features, 'New feature'] } : p))
  }

  function removeFeature(planId, idx) {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      return { ...p, features: p.features.filter((_, i) => i !== idx) }
    }))
  }

  // ── Coupon functions ────────────────────────────────────────────────────────
  async function loadCoupons() {
    const { data } = await supabase.from('coupons')
      .select('*, coupon_redemptions(count)')
      .order('created_at', { ascending: false })
    setCoupons(data || [])
    setCouponsLoaded(true)
  }

  async function createCoupon() {
    if (!newCoupon.code.trim() || !newCoupon.discount_value) { toast.error('Code and discount required'); return }
    setSavingCoupon(true)
    const res = await fetch('/api/coupons', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newCoupon,
        code: newCoupon.code.toUpperCase().trim(),
        discount_value: Number(newCoupon.discount_value),
        max_uses: newCoupon.max_uses ? Number(newCoupon.max_uses) : null,
        trial_days: newCoupon.trial_days ? Number(newCoupon.trial_days) : null,
        valid_until: newCoupon.valid_until || null,
      })
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setSavingCoupon(false); return }
    toast.success(`Coupon ${data.coupon.code} created`)
    setCoupons(prev => [data.coupon, ...prev])
    setShowNewCoupon(false)
    setNewCoupon({ code:'', description:'', discount_type:'percent', discount_value:20, applies_to:'all', max_uses:'', valid_until:'', trial_days:'', first_month_only:true })
    setSavingCoupon(false)
  }

  async function toggleCoupon(id, active) {
    await supabase.from('coupons').update({ active: !active }).eq('id', id)
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !active } : c))
    toast.success(active ? 'Coupon deactivated' : 'Coupon activated')
  }

  async function deleteCoupon(id) {
    await fetch('/api/coupons', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setCoupons(prev => prev.filter(c => c.id !== id))
    toast.success('Coupon deleted')
  }

  async function suspendAgency(id) {
    await supabase.from('agencies').update({ status: 'suspended' }).eq('id', id)
    toast.success('Agency suspended')
    loadAll()
  }

  async function activateAgency(id) {
    await supabase.from('agencies').update({ status: 'active' }).eq('id', id)
    toast.success('Agency activated')
    loadAll()
  }

  async function upgradePlan(id, plan) {
    await supabase.from('agencies').update({ plan }).eq('id', id)
    toast.success(`Plan updated to ${plan}`)
    loadAll()
  }

  const filtered = agencies.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.billing_email?.toLowerCase().includes(search.toLowerCase()) ||
    a.slug?.toLowerCase().includes(search.toLowerCase())
  )

  const mrr = agencies
    .filter(a => a.status === 'active')
    .reduce((s, a) => s + (PLAN_CFG[a.plan]?.price || 297), 0)

  const stats = {
    total_agencies: agencies.length,
    active:         agencies.filter(a => a.status === 'active').length,
    trial:          agencies.filter(a => a.status === 'trial').length,
    mrr,
    total_clients:  clients.length,
    total_members:  members.length,
  }

  const TABS = [
    { key:'agencies', label:`Agencies (${agencies.length})`,   icon:Building2 },
    { key:'clients',  label:`All Clients (${clients.length})`, icon:Users },
    { key:'metrics',     label:'Platform Metrics',   icon:BarChart2 },
    { key:'pricing',     label:'Pricing & Signup',   icon:Tag },
    { key:'coupons',     label:'Coupons & Discounts', icon:DollarSign },
    { key:'marketplace', label:'Marketplace',         icon:Sparkles },
  ]

  const agencyClients = (agId) => clients.filter(c => c.agency_id === agId)
  const agencyMembers = (agId) => members.filter(m => m.agency_id === agId)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff' }}>

      {/* Top bar */}
      <div style={{ background:'#111', borderBottom:'1px solid #222', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/koto_logo_white.svg" alt="Koto" style={{ height:28, width:'auto', display:'block' }}/>
          <div>
            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#fff' }}>Koto Super Admin</div>
            <div style={{ fontSize:12, color:'#666' }}>Platform operator view — all agencies</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {bypassMode && (
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:AMBER+'20', color:AMBER, fontFamily:FH }}>
              BYPASS MODE
            </span>
          )}
          <button onClick={loadAll} disabled={loading}
            style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #333', background:'transparent', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Refresh
          </button>
          <button onClick={() => navigate('/master-admin')}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
            Agency Admin →
          </button>
        </div>
      </div>

      {/* MRR stats */}
      <div style={{ background:'#111', borderBottom:'1px solid #1a1a1a', padding:'16px 32px', display:'flex', gap:32 }}>
        {[
          { label:'Total Agencies',  value: stats.total_agencies, color:'#fff' },
          { label:'Active',          value: stats.active,          color:'#4ade80' },
          { label:'Trial',           value: stats.trial,           color:'#fbbf24' },
          { label:'MRR',             value: '$'+stats.mrr.toLocaleString(), color:'#4ade80' },
          { label:'ARR (est.)',      value: '$'+(stats.mrr*12).toLocaleString(), color:'#4ade80' },
          { label:'Total Clients',   value: stats.total_clients,  color:'#fff' },
          { label:'Team Members',    value: stats.total_members,  color:'#fff' },
        ].map((s,i) => (
          <div key={i}>
            <div style={{ fontFamily:FH, fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#555', fontFamily:FH, marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background:'#111', borderBottom:'1px solid #1a1a1a', padding:'0 32px', display:'flex', gap:0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'12px 20px', border:'none', background:'transparent',
              borderBottom: tab===t.key ? `2px solid ${RED}` : '2px solid transparent',
              color: tab===t.key ? '#fff' : '#555', fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
            <t.icon size={13}/> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:'24px 32px', maxWidth:1400, margin:'0 auto' }}>

        {/* AGENCIES TAB */}
        {tab === 'agencies' && (
          <div>
            <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center' }}>
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#111', borderRadius:10, border:'1px solid #222', padding:'9px 14px' }}>
                <Search size={15} color="#555"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search agencies by name, email, or slug…"
                  style={{ border:'none', outline:'none', fontSize:14, flex:1, color:'#fff', background:'transparent' }}/>
              </div>
              <button onClick={() => navigate('/signup')}
                style={{ padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                <Plus size={14}/> New Agency
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {loading ? (
                <div style={{ textAlign:'center', padding:60 }}><Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/></div>
              ) : filtered.length === 0 ? (
                <div style={{ background:'#111', borderRadius:16, border:'1px solid #1a1a1a', padding:'60px 24px', textAlign:'center' }}>
                  <Building2 size={40} color="#333" style={{ margin:'0 auto 16px', display:'block' }}/>
                  <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>
                    {search ? 'No agencies match your search' : 'No agencies yet'}
                  </div>
                  <div style={{ fontSize:14, color:'#555', fontFamily:FB, marginBottom:20 }}>
                    {search ? 'Try a different search term' : 'Create the first agency to get started with multi-tenant mode'}
                  </div>
                  {!search && (
                    <button onClick={() => navigate('/signup')}
                      style={{ padding:'10px 24px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                      Create First Agency →
                    </button>
                  )}
                </div>
              ) : filtered.map(ag => {
                const planCfg   = PLAN_CFG[ag.plan] || PLAN_CFG.starter
                const statusCfg = STATUS_CFG[ag.status] || STATUS_CFG.trial
                const agClients = agencyClients(ag.id)
                const agMembers = agencyMembers(ag.id)
                const isExpanded = selected === ag.id

                return (
                  <div key={ag.id} style={{ background:'#111', borderRadius:14, border:`1px solid ${isExpanded ? RED+'40' : '#1a1a1a'}`, overflow:'hidden', transition:'border-color .15s' }}>
                    <div onClick={() => setSelected(isExpanded ? null : ag.id)}
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 20px', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='#161616'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                      {/* Logo placeholder */}
                      <div style={{ width:40, height:40, borderRadius:11, background: ag.brand_color || RED, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:16, fontWeight:900, color:'#fff', flexShrink:0 }}>
                        {(ag.brand_name || ag.name)?.[0]?.toUpperCase() || '?'}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                          <span style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#fff' }}>{ag.brand_name || ag.name}</span>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:statusCfg.bg, color:statusCfg.color, fontFamily:FH }}>{statusCfg.label}</span>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:planCfg.bg, color:planCfg.color, fontFamily:FH }}>{ag.plan}</span>
                          {ag.status === 'trial' && ag.trial_ends_at && (
                            <span style={{ fontSize:11, color:AMBER, fontFamily:FB }}>
                              Trial ends {new Date(ag.trial_ends_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:12, color:'#555', fontFamily:FB }}>
                          {ag.billing_email || ag.slug} · {agClients.length} clients · {agMembers.length} seats
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontFamily:FH, fontSize:16, fontWeight:900, color:GREEN }}>${planCfg.price}/mo</div>
                          <div style={{ fontSize:11, color:'#555', fontFamily:FH }}>MRR</div>
                        </div>
                        <ChevronRight size={16} color="#555" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition:'.2s' }}/>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop:'1px solid #1a1a1a', padding:'16px 20px', background:'#0d0d0d' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                          <div style={{ background:'#111', borderRadius:10, padding:'12px 14px', border:'1px solid #1a1a1a' }}>
                            <div style={{ fontSize:11, color:'#555', fontFamily:FH, marginBottom:4 }}>AGENCY ID</div>
                            <code style={{ fontSize:11, color:'#888', fontFamily:'monospace', wordBreak:'break-all' }}>{ag.id}</code>
                          </div>
                          <div style={{ background:'#111', borderRadius:10, padding:'12px 14px', border:'1px solid #1a1a1a' }}>
                            <div style={{ fontSize:11, color:'#555', fontFamily:FH, marginBottom:4 }}>CREATED</div>
                            <div style={{ fontSize:13, color:'#ccc', fontFamily:FB }}>{ag.created_at ? new Date(ag.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'}</div>
                          </div>
                          <div style={{ background:'#111', borderRadius:10, padding:'12px 14px', border:'1px solid #1a1a1a' }}>
                            <div style={{ fontSize:11, color:'#555', fontFamily:FH, marginBottom:4 }}>CLIENTS</div>
                            <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:FH }}>{agClients.length} <span style={{ fontSize:12, color:'#555', fontWeight:400 }}>/ {ag.max_clients || 25} max</span></div>
                          </div>
                        </div>

                        {agClients.length > 0 && (
                          <div style={{ marginBottom:14 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:8 }}>Their Clients</div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {agClients.map(cl => (
                                <button key={cl.id}
                                  onClick={() => {
                                    impersonateAgency({ id: ag.id, name: ag.brand_name || ag.name, brand_color: ag.brand_color })
                                    impersonateClient({ id: cl.id, name: cl.name })
                                    navigate('/clients/' + cl.id)
                                  }}
                                  style={{ fontSize:12, padding:'5px 12px', borderRadius:20, background:'#1a1a1a', color:'#ccc', fontFamily:FB, border:'1px solid #333', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
                                  onMouseEnter={e=>{e.currentTarget.style.background='#f59e0b20';e.currentTarget.style.borderColor='#f59e0b';e.currentTarget.style.color='#f59e0b'}}
                                  onMouseLeave={e=>{e.currentTarget.style.background='#1a1a1a';e.currentTarget.style.borderColor='#333';e.currentTarget.style.color='#ccc'}}>
                                  👁 {cl.name}
                                </button>
                              ))}
                            </div>
                            <div style={{ fontSize:11, color:'#444', fontFamily:FB, marginTop:6 }}>Click any client to view their record as the agency sees it</div>
                          </div>
                        )}

                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {/* Impersonate */}
                          <button onClick={() => { impersonateAgency({ id: ag.id, name: ag.brand_name || ag.name, brand_color: ag.brand_color }); navigate('/') }}
                            style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#f59e0b', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                            ⚡ Switch Into Agency
                          </button>
                          {/* Status toggle */}
                          {ag.status !== 'active' ? (
                            <button onClick={() => activateAgency(ag.id)}
                              style={{ padding:'7px 14px', borderRadius:8, border:'none', background:GREEN, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                              <Check size={12}/> Activate
                            </button>
                          ) : (
                            <button onClick={() => suspendAgency(ag.id)}
                              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #333', background:'transparent', color:'#f87171', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                              Suspend
                            </button>
                          )}
                          {['starter','growth','agency'].filter(p => p !== ag.plan).map(p => (
                            <button key={p} onClick={() => upgradePlan(ag.id, p)}
                              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #333', background:'transparent', color:'#ccc', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                              → {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ALL CLIENTS TAB */}
        {tab === 'clients' && (
          <div style={{ background:'#111', borderRadius:16, border:'1px solid #1a1a1a', overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:'#fff' }}>All clients across all agencies</div>
              <span style={{ fontSize:12, color:'#555', fontFamily:FB }}>scoped by agency_id</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0d0d0d' }}>
                  {['Client','Agency','Status','Monthly Value','Created'].map(h => (
                    <th key={h} style={{ padding:'9px 16px', fontSize:11, fontWeight:700, color:'#555', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', fontFamily:FH }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((cl, i) => {
                  const ag = agencies.find(a => a.id === cl.agency_id)
                  return (
                    <tr key={cl.id} style={{ borderTop:'1px solid #1a1a1a' }}>
                      <td style={{ padding:'11px 16px', fontFamily:FH, fontSize:14, fontWeight:600, color:'#fff' }}>{cl.name}</td>
                      <td style={{ padding:'11px 16px' }}>
                        {ag ? (
                          <span style={{ fontSize:12, padding:'2px 8px', borderRadius:20, background:RED+'15', color:RED, fontFamily:FH }}>{ag.name}</span>
                        ) : (
                          <span style={{ fontSize:12, color:'#555', fontFamily:FB }}>No agency</span>
                        )}
                      </td>
                      <td style={{ padding:'11px 16px', fontSize:12, color: cl.status==='active'?GREEN:'#9ca3af', fontFamily:FH, fontWeight:700 }}>{cl.status || 'active'}</td>
                      <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color: cl.monthly_value ? GREEN : '#555', fontFamily:FH }}>
                        {cl.monthly_value ? '$'+parseFloat(cl.monthly_value).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding:'11px 16px', fontSize:12, color:'#555', fontFamily:FB }}>
                        {cl.created_at ? new Date(cl.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* METRICS TAB */}
        {tab === 'metrics' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {[
              { label:'Monthly Recurring Revenue', value:'$'+mrr.toLocaleString(), sub:'from active agencies', color:GREEN, icon:DollarSign },
              { label:'Annual Run Rate', value:'$'+(mrr*12).toLocaleString(), sub:'projected ARR', color:GREEN, icon:TrendingUp },
              { label:'Total Agencies', value:stats.total_agencies, sub:`${stats.active} active, ${stats.trial} trial`, color:'#fff', icon:Building2 },
              { label:'Total End Clients', value:stats.total_clients, sub:'across all agencies', color:'#fff', icon:Users },
              { label:'Avg Clients/Agency', value:agencies.length ? Math.round(clients.length/agencies.length) : 0, sub:'per agency', color:TEAL, icon:BarChart2 },
              { label:'Team Seats Used', value:stats.total_members, sub:'across all agencies', color:'#fff', icon:Users },
            ].map((m,i) => (
              <div key={i} style={{ background:'#111', borderRadius:16, border:'1px solid #1a1a1a', padding:'24px 22px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <m.icon size={18} color={m.color}/>
                  <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em' }}>{m.label}</div>
                </div>
                <div style={{ fontFamily:FH, fontSize:36, fontWeight:900, color:m.color, letterSpacing:'-.03em', lineHeight:1, marginBottom:4 }}>{m.value}</div>
                <div style={{ fontSize:13, color:'#555', fontFamily:FB }}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* PRICING TAB */}
        {tab === 'pricing' && (
          <div>

            {/* Signup page meta */}
            <div style={{ background:'#111', borderRadius:16, border:'1px solid #1a1a1a', padding:'20px 24px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#fff', marginBottom:3 }}>Signup Page Copy</div>
                  <div style={{ fontSize:12, color:'#555', fontFamily:FB }}>Changes go live immediately at /signup</div>
                </div>
                <button onClick={()=>saveMeta(signupMeta)} disabled={savingPricing}
                  style={{ padding:'7px 16px', borderRadius:9, border:'none', background:GREEN, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                  <Save size={13}/> {savingPricing ? 'Saving…' : 'Save Copy'}
                </button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { label:'Headline',       field:'headline',       type:'text' },
                  { label:'Subheadline',    field:'subheadline',    type:'text' },
                  { label:'Trial Days',     field:'trial_days',     type:'number' },
                  { label:'Guarantee Text', field:'guarantee_text', type:'text' },
                  { label:'Hero Badge',     field:'hero_badge',     type:'text' },
                ].map(item => (
                  <div key={item.field}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>{item.label}</label>
                    <input
                      type={item.type || 'text'}
                      value={signupMeta[item.field] || ''}
                      onChange={e => setSignupMeta(prev => ({ ...prev, [item.field]: item.type==='number' ? Number(e.target.value) : e.target.value }))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#2a2a2a'}
                    />
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>Annual Toggle</label>
                  <button onClick={()=>setSignupMeta(prev=>({...prev, show_annual_toggle:!prev.show_annual_toggle}))}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    {signupMeta.show_annual_toggle
                      ? <ToggleRight size={28} color={GREEN}/>
                      : <ToggleLeft size={28} color="#555"/>
                    }
                  </button>
                  <span style={{ fontSize:12, color:'#555', fontFamily:FB }}>{signupMeta.show_annual_toggle ? `${signupMeta.annual_discount_pct||20}% annual discount shown` : 'Monthly only'}</span>
                </div>
              </div>
            </div>

            {/* Plan cards editor */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
              {plans.map(plan => (
                <div key={plan.id} style={{ background:'#111', borderRadius:16, border:`1px solid ${editingPlan===plan.id ? RED+'60' : '#1a1a1a'}`, padding:'18px 20px', transition:'border-color .15s' }}>

                  {/* Plan header */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <div>
                      <input value={plan.name} onChange={e=>updatePlanField(plan.id,'name',e.target.value)}
                        style={{ background:'none', border:'none', outline:'none', fontFamily:FH, fontSize:16, fontWeight:900, color:'#fff', width:120, padding:0 }}/>
                      {plan.popular && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:RED+'20', color:RED, fontFamily:FH, display:'block', marginTop:3, width:'fit-content' }}>
                          {plan.badge || 'Most Popular'}
                        </span>
                      )}
                    </div>
                    <button onClick={()=>setEditingPlan(editingPlan===plan.id?null:plan.id)}
                      style={{ background:'none', border:'1px solid #333', borderRadius:8, padding:'5px 10px', cursor:'pointer', color:'#ccc', fontFamily:FH, fontSize:12, fontWeight:700 }}>
                      {editingPlan===plan.id ? 'Done' : <><Edit2 size={11} style={{marginRight:4}}/>Edit</>}
                    </button>
                  </div>

                  {/* Price */}
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:14 }}>
                    <span style={{ color:'#555', fontSize:18, fontFamily:FH }}>$</span>
                    <input type="number" value={plan.price} onChange={e=>updatePlanField(plan.id,'price',Number(e.target.value))}
                      style={{ background:'none', border:'none', outline:'none', fontFamily:FH, fontSize:36, fontWeight:900, color:GREEN, width:100, padding:0 }}/>
                    <span style={{ color:'#555', fontSize:14, fontFamily:FB }}>/mo</span>
                  </div>

                  {/* Seats + clients */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    <div style={{ background:'#0d0d0d', borderRadius:9, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:'#555', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Team Seats</div>
                      <input type="number" value={plan.seats} onChange={e=>updatePlanField(plan.id,'seats',Number(e.target.value))}
                        style={{ background:'none', border:'none', outline:'none', fontFamily:FH, fontSize:20, fontWeight:900, color:'#fff', width:'100%', padding:0 }}/>
                    </div>
                    <div style={{ background:'#0d0d0d', borderRadius:9, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:'#555', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Max Clients</div>
                      <input type="number" value={plan.clients} onChange={e=>updatePlanField(plan.id,'clients',Number(e.target.value))}
                        style={{ background:'none', border:'none', outline:'none', fontFamily:FH, fontSize:20, fontWeight:900, color:'#fff', width:'100%', padding:0 }}/>
                    </div>
                  </div>

                  {/* CTA button text */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:'#555', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>CTA Button Text</div>
                    <input value={plan.cta || 'Start Free Trial'} onChange={e=>updatePlanField(plan.id,'cta',e.target.value)}
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}/>
                  </div>

                  {/* Popular + badge toggle */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                    <button onClick={()=>updatePlanField(plan.id,'popular',!plan.popular)}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:5 }}>
                      {plan.popular ? <ToggleRight size={22} color={RED}/> : <ToggleLeft size={22} color="#555"/>}
                      <span style={{ fontSize:12, color: plan.popular?RED:'#555', fontFamily:FH, fontWeight:700 }}>Popular badge</span>
                    </button>
                    {plan.popular && (
                      <input value={plan.badge||'Most Popular'} onChange={e=>updatePlanField(plan.id,'badge',e.target.value)}
                        placeholder="Badge text"
                        style={{ flex:1, padding:'4px 8px', borderRadius:7, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#ccc', fontSize:12, outline:'none', fontFamily:FB }}/>
                    )}
                  </div>

                  {/* Features */}
                  <div>
                    <div style={{ fontSize:10, color:'#555', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Features</div>
                    {plan.features.map((feat, fi) => (
                      <div key={fi} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ color:GREEN, flexShrink:0, fontSize:12 }}>✓</span>
                        <input value={feat} onChange={e=>updatePlanFeature(plan.id,fi,e.target.value)}
                          style={{ flex:1, background:'#0d0d0d', border:'1px solid #222', borderRadius:7, padding:'5px 8px', color:'#ccc', fontSize:12, outline:'none', fontFamily:FB }}
                          onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#222'}/>
                        <button onClick={()=>removeFeature(plan.id,fi)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#444', padding:2, flexShrink:0 }}>
                          <X size={13}/>
                        </button>
                      </div>
                    ))}
                    <button onClick={()=>addFeature(plan.id)}
                      style={{ width:'100%', padding:'6px', borderRadius:8, border:'1px dashed #333', background:'transparent', color:'#555', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, marginTop:4 }}>
                      + Add Feature
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Save pricing button */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={loadPricing}
                style={{ padding:'10px 20px', borderRadius:11, border:'1px solid #333', background:'transparent', color:'#ccc', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                Reset to Saved
              </button>
              <button onClick={()=>savePlans(plans)} disabled={savingPricing}
                style={{ padding:'10px 28px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:8, boxShadow:`0 4px 16px ${RED}40` }}>
                <Save size={15}/> {savingPricing ? 'Publishing…' : 'Publish Pricing Changes'}
              </button>
            </div>

            {/* Preview link */}
            <div style={{ marginTop:16, textAlign:'center' }}>
              <a href="/signup" target="_blank"
                style={{ fontSize:13, color:'#555', fontFamily:FB, display:'inline-flex', alignItems:'center', gap:5 }}>
                <ExternalLink size={12}/> Preview signup page →
              </a>
            </div>

          </div>
        )}

        {/* COUPONS TAB */}
        {tab === 'coupons' && (
          <div>

            {/* Header + New Coupon button */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:'#fff' }}>Coupons & Discounts</div>
                <div style={{ fontSize:13, color:'#555', fontFamily:FB, marginTop:2 }}>
                  Create codes that apply at signup. No Stripe dashboard needed.
                </div>
              </div>
              <button onClick={()=>setShowNewCoupon(!showNewCoupon)}
                style={{ padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                <Plus size={14}/> New Coupon
              </button>
            </div>

            {/* New coupon form */}
            {showNewCoupon && (
              <div style={{ background:'#111', borderRadius:16, border:`1px solid ${RED}40`, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:'#fff', marginBottom:16 }}>Create New Coupon</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  {[
                    { label:'Code', field:'code', type:'text', placeholder:'KOTO20', upper:true },
                    { label:'Description', field:'description', type:'text', placeholder:'20% off for partners' },
                    { label:'Discount Value', field:'discount_value', type:'number', placeholder:'20' },
                  ].map(item=>(
                    <div key={item.field}>
                      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>{item.label}</label>
                      <input type={item.type} value={newCoupon[item.field]}
                        onChange={e=>setNewCoupon(prev=>({...prev, [item.field]: item.upper ? e.target.value.toUpperCase() : e.target.value}))}
                        placeholder={item.placeholder}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box', letterSpacing: item.upper ? '.1em' : 'normal' }}
                        onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>Discount Type</label>
                    <select value={newCoupon.discount_type} onChange={e=>setNewCoupon(prev=>({...prev,discount_type:e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}>
                      <option value="percent">Percent (%)</option>
                      <option value="fixed">Fixed ($)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>Applies To</label>
                    <select value={newCoupon.applies_to} onChange={e=>setNewCoupon(prev=>({...prev,applies_to:e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}>
                      <option value="all">All Plans</option>
                      <option value="starter">Starter Only</option>
                      <option value="growth">Growth Only</option>
                      <option value="agency">Agency Only</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>Max Uses (blank=unlimited)</label>
                    <input type="number" value={newCoupon.max_uses} onChange={e=>setNewCoupon(prev=>({...prev,max_uses:e.target.value}))}
                      placeholder="Unlimited"
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>Expires (blank=never)</label>
                    <input type="date" value={newCoupon.valid_until} onChange={e=>setNewCoupon(prev=>({...prev,valid_until:e.target.value}))}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:5 }}>Bonus Trial Days</label>
                    <input type="number" value={newCoupon.trial_days} onChange={e=>setNewCoupon(prev=>({...prev,trial_days:e.target.value}))}
                      placeholder="e.g. 30"
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#fff', fontSize:13, outline:'none', fontFamily:FB, boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <button onClick={()=>setNewCoupon(prev=>({...prev,first_month_only:!prev.first_month_only}))}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
                    {newCoupon.first_month_only ? <ToggleRight size={24} color={RED}/> : <ToggleLeft size={24} color="#555"/>}
                    <span style={{ fontSize:13, color: newCoupon.first_month_only?RED:'#555', fontFamily:FH, fontWeight:700 }}>
                      {newCoupon.first_month_only ? 'First month only' : 'Recurring every month'}
                    </span>
                  </button>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>setShowNewCoupon(false)}
                    style={{ padding:'9px 18px', borderRadius:10, border:'1px solid #333', background:'transparent', color:'#ccc', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    Cancel
                  </button>
                  <button onClick={createCoupon} disabled={savingCoupon}
                    style={{ padding:'9px 24px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                    <Save size={13}/> {savingCoupon ? 'Creating…' : 'Create Coupon'}
                  </button>
                </div>
              </div>
            )}

            {/* Coupon list */}
            {coupons.length === 0 && couponsLoaded ? (
              <div style={{ background:'#111', borderRadius:16, border:'1px solid #1a1a1a', padding:'60px 24px', textAlign:'center' }}>
                <Tag size={36} color="#333" style={{ margin:'0 auto 14px', display:'block' }}/>
                <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#fff', marginBottom:6 }}>No coupons yet</div>
                <div style={{ fontSize:13, color:'#555', fontFamily:FB }}>Create your first coupon to offer discounts at signup</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {coupons.map(coupon => {
                  const uses = coupon.coupon_redemptions?.[0]?.count || 0
                  const expired = coupon.valid_until && new Date(coupon.valid_until) < new Date()
                  const maxed = coupon.max_uses && uses >= coupon.max_uses
                  return (
                    <div key={coupon.id} style={{ background:'#111', borderRadius:14, border:`1px solid ${coupon.active && !expired && !maxed ? '#1a1a1a' : '#333'}`, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                          <code style={{ fontFamily:'monospace', fontSize:16, fontWeight:900, color: coupon.active?'#fff':'#555', letterSpacing:'.1em' }}>{coupon.code}</code>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, fontFamily:FH,
                            background: !coupon.active?'#1a1a1a':expired||maxed?'#1a1a1a':GREEN+'20',
                            color: !coupon.active?'#555':expired||maxed?'#555':GREEN }}>
                            {!coupon.active?'Disabled':expired?'Expired':maxed?'Maxed out':'Active'}
                          </span>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:RED+'20', color:RED, fontFamily:FH }}>
                            {coupon.discount_type==='percent' ? `${coupon.discount_value}% off` : `$${coupon.discount_value} off`}
                            {coupon.first_month_only ? ' · 1st month' : ' · recurring'}
                          </span>
                          {coupon.applies_to !== 'all' && (
                            <span style={{ fontSize:11, color:'#555', fontFamily:FB }}>{coupon.applies_to} only</span>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:14, fontSize:12, color:'#555', fontFamily:FB }}>
                          {coupon.description && <span>{coupon.description}</span>}
                          <span>Used: {uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ' (unlimited)'}</span>
                          {coupon.trial_days && <span>+{coupon.trial_days} bonus days</span>}
                          {coupon.valid_until && <span>Expires: {new Date(coupon.valid_until).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button onClick={()=>toggleCoupon(coupon.id, coupon.active)}
                          style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #333', background:'transparent', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH,
                            color: coupon.active ? '#f87171' : GREEN }}>
                          {coupon.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={()=>deleteCoupon(coupon.id)}
                          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #333', background:'transparent', color:'#555', fontSize:12, cursor:'pointer' }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MARKETPLACE TAB ───────────────────────────────────────────── */}
        {tab === 'marketplace' && (() => {
          if (!mpLoaded) {
            fetch('/api/marketplace', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ action:'all_agencies', agency_id: agencyId, real_agency_id: agencyId }),
            }).then(r=>r.json()).then(data=>{
              setMpAgencies(data.agencies||[])
              setMpAddons(data.agency_addons||[])
              setMpRequests(data.pending_requests||[])
              setMpLoaded(true)
            })
          }
          return (
            <div>
              {/* Pending requests */}
              {mpRequests.length > 0 && (
                <div style={{ background:'#fffbeb', borderRadius:14, border:'1px solid #fde68a', padding:'16px 20px', marginBottom:20 }}>
                  <div style={{ fontFamily:"'Proxima Nova',sans-serif", fontSize:14, fontWeight:800, color:'#92400e', marginBottom:12 }}>
                    ⏳ Pending Add-On Requests ({mpRequests.length})
                  </div>
                  {mpRequests.map(req => (
                    <div key={req.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #fde68a' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Proxima Nova',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>
                          {req.agencies?.name} → {req.addon_key.replace(/_/g,' ')}
                        </div>
                        {req.message && <div style={{ fontSize:12, color:'#6b7280' }}>{req.message}</div>}
                      </div>
                      <button onClick={async()=>{
                        await fetch('/api/marketplace',{method:'POST',headers:{'Content-Type':'application/json'},
                          body:JSON.stringify({action:'toggle',agency_id:agencyId,real_agency_id:agencyId,
                            target_agency_id:req.agency_id,addon_key:req.addon_key,enabled:true})})
                        setMpRequests(p=>p.filter(r=>r.id!==req.id))
                        toast.success('Approved ✓')
                      }}
                        style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Proxima Nova',sans-serif" }}>
                        Approve
                      </button>
                      <button onClick={async()=>{
                        setMpRequests(p=>p.filter(r=>r.id!==req.id))
                      }}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:'#ea2729', fontSize:12, cursor:'pointer' }}>
                        Deny
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-agency add-on matrix */}
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', fontFamily:"'Proxima Nova',sans-serif", fontSize:14, fontWeight:800, color:'#0a0a0a', display:'flex', alignItems:'center', gap:8 }}>
                  Agency Add-On Control Panel
                  <span style={{ fontSize:11, color:'#9ca3af', fontWeight:400 }}>Toggle features per agency</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb' }}>
                        <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:"'Proxima Nova',sans-serif", whiteSpace:'nowrap' }}>Agency</th>
                        {['review_campaigns','scout_pipeline','autonomous_agent','client_portal','rank_tracker','performance_ai','api_access'].map(key => (
                          <th key={key} style={{ padding:'10px 8px', textAlign:'center', fontSize:10, fontWeight:700, color:'#9ca3af', fontFamily:"'Proxima Nova',sans-serif", whiteSpace:'nowrap' }}>
                            {key.replace(/_/g,' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mpAgencies.slice(0,20).map(ag => (
                        <tr key={ag.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                          <td style={{ padding:'10px 16px' }}>
                            <div style={{ fontFamily:"'Proxima Nova',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>{ag.brand_name||ag.name}</div>
                            <div style={{ fontSize:11, color:'#9ca3af', textTransform:'capitalize' }}>{ag.plan}</div>
                          </td>
                          {['review_campaigns','scout_pipeline','autonomous_agent','client_portal','rank_tracker','performance_ai','api_access'].map(key => {
                            const isOn = mpAddons.some(a=>a.agency_id===ag.id&&a.addon_key===key&&a.enabled)
                            const tKey = `${ag.id}:${key}`
                            const loading = toggling[tKey]
                            return (
                              <td key={key} style={{ padding:'10px 8px', textAlign:'center' }}>
                                <button onClick={async()=>{
                                  setToggling(t=>({...t,[tKey]:true}))
                                  await fetch('/api/marketplace',{method:'POST',headers:{'Content-Type':'application/json'},
                                    body:JSON.stringify({action:'toggle',agency_id:agencyId,real_agency_id:agencyId,
                                      target_agency_id:ag.id,addon_key:key,enabled:!isOn})})
                                  setMpAddons(prev => {
                                    const filtered = prev.filter(a=>!(a.agency_id===ag.id&&a.addon_key===key))
                                    return isOn ? filtered : [...filtered,{agency_id:ag.id,addon_key:key,enabled:true}]
                                  })
                                  setToggling(t=>({...t,[tKey]:false}))
                                }}
                                  style={{ width:28, height:28, borderRadius:7, border:'none', background:isOn?'#f0fdf4':'#f3f4f6', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                                  {loading
                                    ? <span style={{ fontSize:10 }}>…</span>
                                    : isOn
                                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  }
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
