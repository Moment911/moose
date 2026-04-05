"use client"
import { useState, useEffect } from 'react'
import { Building2, Users, DollarSign, TrendingUp, Shield, Search, Plus, RefreshCw, Loader2, Check, X, ExternalLink, ChevronRight, Star, Zap, Clock, AlertCircle, BarChart2, Globe } from 'lucide-react'
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

  useEffect(() => { loadAll() }, [])

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
    { key:'metrics',  label:'Platform Metrics',                icon:BarChart2 },
  ]

  const agencyClients = (agId) => clients.filter(c => c.agency_id === agId)
  const agencyMembers = (agId) => members.filter(m => m.agency_id === agId)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff' }}>

      {/* Top bar */}
      <div style={{ background:'#111', borderBottom:'1px solid #222', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:RED, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:16, fontWeight:900, color:'#fff' }}>K</div>
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

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
