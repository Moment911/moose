"use client";
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Shield, Grid3X3, Plus, Trash2, Edit2, Check, X,
  ChevronLeft, Mail, Search, Settings, Layers, Activity,
  BarChart3, MessageSquare, ArrowUpRight, TrendingUp,
  DollarSign, Zap, Star, Target, Building2, FileText,
  RefreshCw, Eye, Lock, Database, Globe, AlertCircle
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getClients, createClient_, updateClient, deleteClient, getProjects } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL   = '#5bc6d0'

export default function AdminPortalPage() {
  const navigate  = useNavigate()
  const { firstName, greeting, agencyId, user } = useAuth()
  const [section, setSection] = useState('dashboard')
  const [clients, setClients] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [proposals, setProposals]     = useState([])
  const [reviews, setReviews]         = useState([])
  const [agencies, setAgencies]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [clientSearch, setClientSearch] = useState('')
  const [agencySearch, setAgencySearch] = useState('')

  useEffect(() => { loadAll() }, [agencyId])

  async function loadAll() {
    setLoading(true)
    const [
      { data: c },
      { data: ag },
      { data: prop },
      { data: rev },
    ] = await Promise.all([
      getClients(agencyId),
      supabase.from('agencies').select('*').order('created_at', { ascending: false }),
      supabase.from('proposals').select('*').eq('agency_id', agencyId || '00000000-0000-0000-0000-000000000099').order('created_at', { ascending: false }),
      supabase.from('moose_review_queue').select('*').order('reviewed_at', { ascending: false }).limit(50),
    ])

    setClients(c || [])
    setAgencies(ag || [])
    setProposals(prop || [])
    setReviews(rev || [])

    const projs = []
    for (const cl of (c || []).slice(0, 20)) {
      const { data } = await getProjects(cl.id)
      projs.push(...(data || []).map(p => ({ ...p, clientName: cl.name })))
    }
    setAllProjects(projs)
    setLoading(false)
  }

  // Platform stats
  const stats = useMemo(() => ({
    totalAgencies:   agencies.length,
    activeAgencies:  agencies.filter(a => a.status === 'active').length,
    totalClients:    clients.length,
    totalProjects:   allProjects.length,
    totalProposals:  proposals.length,
    acceptedProps:   proposals.filter(p => p.status === 'accepted').length,
    totalReviews:    reviews.length,
    pendingReviews:  reviews.filter(r => r.status === 'pending').length,
    mrr:             agencies.reduce((s, a) => s + (a.monthly_price || 0), 0),
    trialAgencies:   agencies.filter(a => a.status === 'trial').length,
    planBreakdown: {
      starter: agencies.filter(a => a.plan === 'starter').length,
      agency:  agencies.filter(a => a.plan === 'growth' || a.plan === 'agency').length,
      scale:   agencies.filter(a => a.plan === 'scale').length,
      pro:     agencies.filter(a => a.plan === 'pro').length,
    }
  }), [agencies, clients, allProjects, proposals, reviews])

  const filteredClients  = useMemo(() =>
    clients.filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch])

  const filteredAgencies = useMemo(() =>
    agencies.filter(a => !agencySearch || a.name?.toLowerCase().includes(agencySearch.toLowerCase()) || a.billing_email?.toLowerCase().includes(agencySearch.toLowerCase())),
    [agencies, agencySearch])

  const NAV = [
    { key:'dashboard', label:'Dashboard',  icon:BarChart3 },
    { key:'agencies',  label:`Agencies (${agencies.length})`, icon:Building2 },
    { key:'clients',   label:`Clients (${clients.length})`, icon:Users },
    { key:'proposals', label:`Proposals (${proposals.length})`, icon:FileText },
    { key:'reviews',   label:`Reviews (${reviews.length})`, icon:Star },
    { key:'platform',  label:'Platform',   icon:Settings },
  ]

  const StatCard = ({ label, value, sub, icon: Icon, color = '#111', accent = false }) => (
    <div className="animate-fade-up hover-lift" style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${accent ? ACCENT+'40' : '#e5e7eb'}`, padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ width:40, height:40, borderRadius:12, background: accent ? ACCENT+'15' : '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={accent ? ACCENT : '#374151'}/>
        </div>
        <ArrowUpRight size={14} color="#d1d5db"/>
      </div>
      <div style={{ fontSize:32, fontWeight:900, color: accent ? ACCENT : '#111', letterSpacing:-1, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:15, fontWeight:700, color:'#111', marginTop:6 }}>{label}</div>
      {sub && <div style={{ fontSize:13, color:'#4b5563', marginTop:2 }}>{sub}</div>}
    </div>
  )

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f4f4f5' }}>
      <Sidebar/>

      {/* Admin inner sidebar */}
      <div style={{ width:220, flexShrink:0, background:'#000', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <button onClick={() => navigate('/')} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,.4)', background:'none', border:'none', cursor:'pointer', marginBottom:14, padding:0 }}>
            <ChevronLeft size={13}/> Back
          </button>
          <div style={{ fontSize:13, fontWeight:700, color:ACCENT, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>
            Admin Portal
          </div>
          <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{greeting}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:2 }}>Platform overview</div>
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:'10px 8px' }}>
          {NAV.map(n => {
            const I = n.icon
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, border:'none', marginBottom:2, cursor:'pointer', background: section===n.key ? ACCENT : 'transparent', color: section===n.key ? '#fff' : 'rgba(255,255,255,.5)', fontSize:14, fontWeight: section===n.key ? 700 : 500, transition:'all .15s', textAlign:'left' }}>
                <I size={15}/> {n.label}
              </button>
            )
          })}
        </nav>
        <div style={{ padding:'14px 16px', borderTop:'1px solid rgba(255,255,255,.08)', fontSize:13, color:'rgba(255,255,255,.25)' }}>
          Koto · Admin
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <div style={{ padding:'28px 32px' }}>
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:28, fontWeight:900, color:'#111', letterSpacing:-0.5, marginBottom:4 }}>
                {greeting}, {firstName}
              </h1>
              <p style={{ fontSize:16, color:'#374151' }}>
                {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · Koto Platform
              </p>
            </div>

            {/* MRR hero */}
            <div style={{ background:'#000', borderRadius:20, padding:'28px 32px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
                  Monthly Recurring Revenue
                </div>
                <div style={{ fontSize:48, fontWeight:900, color:'#fff', letterSpacing:-2, lineHeight:1 }}>
                  ${stats.mrr.toLocaleString()}
                  <span style={{ fontSize:20, color:'rgba(255,255,255,.4)', fontWeight:500 }}>/mo</span>
                </div>
                <div style={{ fontSize:15, color:'rgba(255,255,255,.5)', marginTop:8 }}>
                  {stats.activeAgencies} active agencies · {stats.trialAgencies} on trial
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, textAlign:'right' }}>
                {[
                  { label:'Total agencies', value:stats.totalAgencies, color:TEAL },
                  { label:'Active agencies', value:stats.activeAgencies, color:'#fff' },
                  { label:'Trial agencies', value:stats.trialAgencies, color:'#f59e0b' },
                  { label:'Clients managed', value:stats.totalClients, color:ACCENT },
                ].map(s=>(
                  <div key={s.label} style={{ background:'rgba(255,255,255,.06)', borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
              <StatCard label="Total clients" value={stats.totalClients} sub={`${allProjects.length} projects`} icon={Users} accent/>
              <StatCard label="Proposals" value={stats.totalProposals} sub={`${stats.acceptedProps} accepted`} icon={FileText}/>
              <StatCard label="Reviews" value={stats.totalReviews} sub={`${stats.pendingReviews} pending`} icon={Star}/>
              <StatCard label="Projects" value={allProjects.length} sub="across all clients" icon={Layers}/>
            </div>

            {/* Plan breakdown */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'22px 24px', marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:16 }}>Plan distribution</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { plan:'Starter',   count:stats.planBreakdown.starter, price:'$79',  color:'#6b7280' },
                  { plan:'Agency',    count:stats.planBreakdown.agency,  price:'$147', color:ACCENT },
                  { plan:'Scale',     count:stats.planBreakdown.scale,   price:'$297', color:'#7c3aed' },
                  { plan:'Pro',       count:stats.planBreakdown.pro,     price:'$797', color:'#111' },
                ].map(p=>(
                  <div key={p.plan} style={{ borderRadius:12, border:`2px solid ${p.color}30`, padding:'16px', background:p.color+'08' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:p.color, marginBottom:4 }}>{p.plan} · {p.price}/mo</div>
                    <div style={{ fontSize:32, fontWeight:900, color:'#111' }}>{p.count}</div>
                    <div style={{ fontSize:13, color:'#4b5563', marginTop:2 }}>agencies</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent agencies */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>Recent agencies</div>
                <button onClick={() => setSection('agencies')} style={{ fontSize:13, color:ACCENT, fontWeight:700, border:'none', background:'none', cursor:'pointer' }}>View all</button>
              </div>
              {agencies.slice(0,5).map((ag,i)=>(
                <div key={ag.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom: i<4?'1px solid #f9fafb':'none' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:ag.brand_color||ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:'#fff', flexShrink:0 }}>
                    {(ag.name||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{ag.brand_name||ag.name}</div>
                    <div style={{ fontSize:13, color:'#4b5563' }}>{ag.billing_email} · {ag.plan}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background: ag.status==='active'?TEAL+'20':'#f9fafb', color: ag.status==='active'?'#0e7490':'#4b5563' }}>
                    {ag.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AGENCIES ── */}
        {section === 'agencies' && (
          <div style={{ padding:'28px 32px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#111' }}>All Agencies</h1>
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, padding:'9px 14px', minWidth:280 }}>
                <Search size={15} color="#4b5563"/>
                <input value={agencySearch} onChange={e=>setAgencySearch(e.target.value)}
                  placeholder="Search agencies…" style={{ border:'none', outline:'none', fontSize:15, flex:1, color:'#111' }}/>
              </div>
            </div>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Agency','Plan','Status','MRR','Clients','Joined'].map(h=>(
                      <th key={h} style={{ padding:'12px 16px', fontSize:13, fontWeight:800, color:'#111', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAgencies.map((ag,i)=>(
                    <tr key={ag.id} style={{ borderBottom: i<filteredAgencies.length-1?'1px solid #f3f4f6':'none' }}>
                      <td style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:ag.brand_color||ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>{(ag.name||'?')[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{ag.brand_name||ag.name}</div>
                            <div style={{ fontSize:13, color:'#4b5563' }}>{ag.billing_email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:14, fontWeight:700, color:'#111', textTransform:'capitalize' }}>{ag.plan}</td>
                      <td style={{ padding:'14px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background: ag.status==='active'?TEAL+'20':'#f9fafb', color: ag.status==='active'?'#0e7490':'#4b5563' }}>
                          {ag.status}
                        </span>
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:15, fontWeight:800, color:'#111' }}>${(ag.monthly_price||0).toLocaleString()}</td>
                      <td style={{ padding:'14px 16px', fontSize:15, fontWeight:700, color:'#111' }}>{ag.max_clients}</td>
                      <td style={{ padding:'14px 16px', fontSize:13, color:'#4b5563' }}>{ag.created_at ? format(new Date(ag.created_at), 'MMM d, yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {section === 'clients' && (
          <div style={{ padding:'28px 32px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#111' }}>All Clients</h1>
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, padding:'9px 14px', minWidth:280 }}>
                <Search size={15} color="#4b5563"/>
                <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)}
                  placeholder="Search clients…" style={{ border:'none', outline:'none', fontSize:15, flex:1, color:'#111' }}/>
              </div>
            </div>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Client','Industry','Status','Email','Projects','Added'].map(h=>(
                      <th key={h} style={{ padding:'12px 16px', fontSize:13, fontWeight:800, color:'#111', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((cl,i)=>{
                    const projs = allProjects.filter(p=>p.client_id===cl.id)
                    return (
                      <tr key={cl.id} style={{ borderBottom: i<filteredClients.length-1?'1px solid #f3f4f6':'none', cursor:'pointer' }}
                        onClick={()=>navigate(`/clients/${cl.id}`)}>
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:36, height:36, borderRadius:10, background:ACCENT+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:ACCENT }}>{(cl.name||'?')[0].toUpperCase()}</div>
                            <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{cl.name}</div>
                          </div>
                        </td>
                        <td style={{ padding:'14px 16px', fontSize:14, color:'#374151' }}>{cl.industry||'—'}</td>
                        <td style={{ padding:'14px 16px' }}>
                          <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background: cl.status==='active'?TEAL+'20':'#f9fafb', color: cl.status==='active'?'#0e7490':'#4b5563', textTransform:'capitalize' }}>{cl.status||'active'}</span>
                        </td>
                        <td style={{ padding:'14px 16px', fontSize:13, color:'#374151' }}>{cl.email||'—'}</td>
                        <td style={{ padding:'14px 16px', fontSize:15, fontWeight:700, color:'#111' }}>{projs.length}</td>
                        <td style={{ padding:'14px 16px', fontSize:13, color:'#4b5563' }}>{cl.created_at ? format(new Date(cl.created_at), 'MMM d') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PROPOSALS ── */}
        {section === 'proposals' && (
          <div style={{ padding:'28px 32px' }}>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:20 }}>All Proposals</h1>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Title','Type','Status','Value','Created'].map(h=>(
                      <th key={h} style={{ padding:'12px 16px', fontSize:13, fontWeight:800, color:'#111', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p,i)=>(
                    <tr key={p.id} style={{ borderBottom: i<proposals.length-1?'1px solid #f3f4f6':'none', cursor:'pointer' }}
                      onClick={()=>navigate(`/proposals/${p.id}`)}>
                      <td style={{ padding:'14px 16px', fontSize:15, fontWeight:800, color:'#111' }}>{p.title}</td>
                      <td style={{ padding:'14px 16px', fontSize:14, color:'#374151', textTransform:'capitalize' }}>{p.type}</td>
                      <td style={{ padding:'14px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, textTransform:'capitalize',
                          background: p.status==='accepted'?TEAL+'20':p.status==='draft'?'#f9fafb':'#fff7f5',
                          color: p.status==='accepted'?'#0e7490':p.status==='draft'?'#4b5563':ACCENT }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:15, fontWeight:800, color:'#111' }}>${(p.total_value||0).toLocaleString()}</td>
                      <td style={{ padding:'14px 16px', fontSize:13, color:'#4b5563' }}>{p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REVIEWS ── */}
        {section === 'reviews' && (
          <div style={{ padding:'28px 32px' }}>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:20 }}>All Reviews</h1>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {reviews.map(r=>(
                <div key={r.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#f3f4f6', color:'#374151', textTransform:'capitalize' }}>{r.platform}</span>
                    <span style={{ fontSize:15, color:'#f59e0b', fontWeight:800 }}>{'★'.repeat(r.star_rating||5)}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#111', marginLeft:'auto' }}>{r.reviewer_name}</span>
                    <span style={{ fontSize:13, color:'#4b5563' }}>{r.reviewed_at ? format(new Date(r.reviewed_at), 'MMM d') : ''}</span>
                    <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20,
                      background: r.status==='approved'?TEAL+'20':r.status==='pending'?'#fffbeb':'#f9fafb',
                      color: r.status==='approved'?'#0e7490':r.status==='pending'?'#d97706':'#4b5563' }}>
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize:15, color:'#374151', lineHeight:1.6 }}>{r.review_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PLATFORM ── */}
        {section === 'platform' && (
          <div style={{ padding:'28px 32px' }}>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:20 }}>Platform Settings</h1>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[
                { label:'Bypass auth mode', desc:'BYPASS_AUTH = true in useAuth.jsx. Disable before going live.', icon:Lock, status:'ON', warn:true },
                { label:'Supabase connection', desc:'Database connected and running.', icon:Database, status:'Connected', warn:false },
                { label:'Google Places API', desc:process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY?'API key configured.':'No key set — Scout uses AI fallback.', icon:Globe, status:process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY?'Active':'Missing', warn:!process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY },
                { label:'Claude AI API', desc:process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY?'API key configured.':'No key — AI features disabled.', icon:Zap, status:process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY?'Active':'Missing', warn:!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY },
              ].map(item=>{
                const I = item.icon
                return (
                  <div key={item.label} style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${item.warn?ACCENT+'40':'#e5e7eb'}`, padding:'20px 22px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{ width:38, height:38, borderRadius:10, background: item.warn?ACCENT+'15':TEAL+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <I size={18} color={item.warn?ACCENT:'#0e7490'}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{item.label}</div>
                        <span style={{ fontSize:13, fontWeight:700, padding:'2px 8px', borderRadius:20, background:item.warn?ACCENT+'15':TEAL+'20', color:item.warn?ACCENT:'#0e7490' }}>{item.status}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{item.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <RefreshCw size={24} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
