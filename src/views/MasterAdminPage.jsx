"use client"
import { useState, useEffect } from 'react'
import { Users, Building2, BarChart2, Database, Shield, Search, Plus, RefreshCw, Loader2, ChevronRight, TrendingUp, Star, Globe, Check, AlertCircle, ExternalLink, Zap, DollarSign, Eye } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const STATUS_CFG = {
  active:   { bg:'#f0fdf4', color:GREEN,  dot:GREEN },
  prospect: { bg:'#fef2f2', color:RED,    dot:RED },
  inactive: { bg:'#f3f4f6', color:'#6b7280', dot:'#9ca3af' },
  paused:   { bg:'#fffbeb', color:'#d97706', dot:'#d97706' },
}

export default function MasterAdminPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [tab,         setTab]         = useState('clients')
  const [clients,     setClients]     = useState([])
  const [agencies,    setAgencies]    = useState([])
  const [reviews,     setReviews]     = useState([])
  const [tickets,     setTickets]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [envStatus,   setEnvStatus]   = useState(null)
  const [checkingEnv, setCheckingEnv] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: cls },
      { data: ags },
      { data: revs },
      { data: tix },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('agencies').select('*').order('name'),
      supabase.from('reviews').select('id,client_id,rating,is_responded,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('desk_tickets').select('id,client_id,status,priority,created_at').order('created_at', { ascending: false }).limit(100),
    ])
    setClients(cls || [])
    setAgencies(ags || [])
    setReviews(revs || [])
    setTickets(tix || [])
    setLoading(false)
  }

  async function checkEnvVars() {
    setCheckingEnv(true)
    try {
      const res = await fetch('/api/debug')
      const data = await res.json()
      setEnvStatus(data)
    } catch(e) { toast.error('Could not reach debug endpoint') }
    setCheckingEnv(false)
  }

  const filteredClients = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total_clients:   clients.length,
    active_clients:  clients.filter(c => c.status === 'active' || !c.status).length,
    total_reviews:   reviews.length,
    unanswered:      reviews.filter(r => !r.is_responded).length,
    avg_rating:      reviews.filter(r => r.rating).length
      ? Math.round(reviews.filter(r => r.rating).reduce((s,r)=>s+r.rating,0) / reviews.filter(r=>r.rating).length * 10) / 10
      : null,
    open_tickets:    tickets.filter(t => !['resolved','closed'].includes(t.status)).length,
    total_agencies:  agencies.length,
    monthly_revenue: clients.filter(c=>c.monthly_value).reduce((s,c)=>s+(parseFloat(c.monthly_value)||0),0),
  }

  const TABS = [
    { key:'clients',  label:`Clients (${clients.length})`,   icon:Users },
    { key:'agencies', label:`Agencies (${agencies.length})`, icon:Building2 },
    { key:'reviews',  label:`Reviews (${reviews.length})`,   icon:Star },
    { key:'system',   label:'System Health',                  icon:Database },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:14 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <Shield size={20} color={RED}/> Master Admin
              </h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>
                All clients, agencies, and system data in one place
              </p>
            </div>
            <button onClick={loadAll} disabled={loading}
              style={{ padding:'8px 14px', borderRadius:9, border:'1px solid rgba(255,255,255,.2)', background:'transparent', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Refresh
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display:'flex', gap:20, paddingBottom:14, overflowX:'auto' }}>
            {[
              { label:'Total Clients',   value: stats.total_clients,   color:'#fff' },
              { label:'Active',          value: stats.active_clients,  color:'#4ade80' },
              { label:'MRR',             value: stats.monthly_revenue ? '$'+stats.monthly_revenue.toLocaleString() : '—', color:'#4ade80' },
              { label:'Reviews',         value: stats.total_reviews,   color:'#fff' },
              { label:'Avg Rating',      value: stats.avg_rating ? '★'+stats.avg_rating : '—', color:'#fbbf24' },
              { label:'Need Response',   value: stats.unanswered,      color: stats.unanswered > 0 ? '#f87171' : '#4ade80' },
              { label:'Open Tickets',    value: stats.open_tickets,    color: stats.open_tickets > 0 ? '#fbbf24' : '#4ade80' },
              { label:'Agencies',        value: stats.total_agencies,  color:'#fff' },
            ].map((s,i)=>(
              <div key={i} style={{ flexShrink:0 }}>
                <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', fontFamily:FH, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0 }}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{ padding:'10px 18px', border:'none', background:'transparent',
                  borderBottom:tab===t.key?`2.5px solid ${RED}`:'2.5px solid transparent',
                  color:tab===t.key?'#fff':'rgba(255,255,255,.35)',
                  fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                <t.icon size={12}/> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* CLIENTS TAB */}
          {tab === 'clients' && (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:'9px 14px' }}>
                  <Search size={15} color="#9ca3af"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search clients by name, email, or industry…"
                    style={{ border:'none', outline:'none', fontSize:14, flex:1, color:BLK, background:'transparent' }}/>
                </div>
                <button onClick={()=>navigate('/clients')}
                  style={{ padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                  <Plus size={14}/> Add Client
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={RED} style={{animation:'spin 1s linear infinite'}}/></div>
              ) : (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{filteredClients.length} clients</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>Click any client to open their record</div>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb' }}>
                        {['Client','Industry','Status','Monthly Value','Reviews','Tickets','Actions'].map((h,i)=>(
                          <th key={h} style={{ padding:'9px 16px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', fontFamily:FH }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((cl,i) => {
                        const cfg = STATUS_CFG[cl.status] || STATUS_CFG.active
                        const clReviews = reviews.filter(r=>r.client_id===cl.id)
                        const clTickets = tickets.filter(t=>t.client_id===cl.id && !['resolved','closed'].includes(t.status))
                        return (
                          <tr key={cl.id} style={{ borderTop:'1px solid #f9fafb', cursor:'pointer' }}
                            onClick={()=>navigate(`/clients/${cl.id}`)}
                            onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{ padding:'11px 16px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <div style={{ width:32, height:32, borderRadius:8, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:13, fontWeight:800, color:cfg.color, flexShrink:0 }}>
                                  {cl.name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{cl.name}</div>
                                  <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{cl.email || cl.website || ''}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:13, color:'#374151', fontFamily:FB }}>{cl.industry || '—'}</td>
                            <td style={{ padding:'11px 16px' }}>
                              <span style={{ fontSize:12, fontWeight:700, padding:'3px 9px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:FH }}>
                                <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:cfg.dot, marginRight:5, verticalAlign:'middle' }}/>
                                {cl.status || 'active'}
                              </span>
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color: cl.monthly_value ? GREEN : '#9ca3af', fontFamily:FH }}>
                              {cl.monthly_value ? '$'+parseFloat(cl.monthly_value).toLocaleString() : '—'}
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              {clReviews.length > 0 ? (
                                <span style={{ fontSize:12, fontFamily:FH }}>
                                  <span style={{ color:'#f59e0b' }}>★</span>
                                  {clReviews.filter(r=>r.rating).length > 0
                                    ? (clReviews.filter(r=>r.rating).reduce((s,r)=>s+r.rating,0)/clReviews.filter(r=>r.rating).length).toFixed(1)
                                    : '—'
                                  } ({clReviews.length})
                                </span>
                              ) : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              {clTickets.length > 0
                                ? <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#fffbeb', color:'#d97706', fontFamily:FH }}>{clTickets.length} open</span>
                                : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>
                              }
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              <div style={{ display:'flex', gap:6 }} onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>navigate(`/clients/${cl.id}`)}
                                  style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:'#374151', fontFamily:FH }}>
                                  Open
                                </button>
                                <button onClick={()=>navigate(`/seo/gbp-audit`)}
                                  style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:RED, fontFamily:FH }}>
                                  GBP
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredClients.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                            {search ? 'No clients match your search' : 'No clients yet — click Add Client to get started'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AGENCIES TAB */}
          {tab === 'agencies' && (
            <div>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                  {agencies.length} agenc{agencies.length===1?'y':'ies'} in database
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb' }}>
                      {['Agency','Plan','Billing Email','Agency ID','Created'].map(h=>(
                        <th key={h} style={{ padding:'9px 16px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', fontFamily:FH }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map((ag,i)=>(
                      <tr key={ag.id} style={{ borderTop:'1px solid #f9fafb' }}>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{ag.name || ag.brand_name || 'Unnamed'}</div>
                          <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{ag.slug}</div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ fontSize:12, fontWeight:700, padding:'3px 9px', borderRadius:20, fontFamily:FH,
                            background: ag.plan==='agency'?RED+'15':ag.plan==='growth'?TEAL+'15':'#f3f4f6',
                            color: ag.plan==='agency'?RED:ag.plan==='growth'?TEAL:'#6b7280' }}>
                            {ag.plan || 'starter'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:13, color:'#374151', fontFamily:FB }}>{ag.billing_email || '—'}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <code style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{ag.id}</code>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:12, color:'#9ca3af', fontFamily:FB }}>
                          {ag.created_at ? new Date(ag.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REVIEWS TAB */}
          {tab === 'reviews' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:16 }}>
                {[
                  { label:'Total Reviews',    value: reviews.length,                                 color:BLK },
                  { label:'Avg Rating',       value: stats.avg_rating ? '★'+stats.avg_rating : '—', color:'#f59e0b' },
                  { label:'Need Response',    value: stats.unanswered,                              color: stats.unanswered>0?RED:GREEN },
                  { label:'Response Rate',    value: reviews.length ? Math.round((reviews.filter(r=>r.is_responded).length/reviews.length)*100)+'%' : '—', color:GREEN },
                ].map((s,i)=>(
                  <div key={i} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                    <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{s.label}</div>
                    <div style={{ fontFamily:FH, fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px', textAlign:'center' }}>
                <Star size={32} color="#e5e7eb" style={{ margin:'0 auto 12px', display:'block' }}/>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:BLK, marginBottom:6 }}>Manage reviews per client</div>
                <div style={{ fontSize:14, color:'#9ca3af', fontFamily:FB, marginBottom:16 }}>Select a client in the Clients tab, then go to Reviews to see and respond to their Google reviews.</div>
                <button onClick={()=>navigate('/reviews')} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  Open Reviews Page →
                </button>
              </div>
            </div>
          )}

          {/* SYSTEM TAB */}
          {tab === 'system' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Env var check */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>Environment Variables</div>
                  <button onClick={checkEnvVars} disabled={checkingEnv}
                    style={{ padding:'7px 14px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                    {checkingEnv ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : <Zap size={12}/>}
                    {checkingEnv ? 'Checking…' : 'Check Now'}
                  </button>
                </div>
                {envStatus ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      { label:'ANTHROPIC_API_KEY (server)',      ok: envStatus.has_anthropic,        value: envStatus.has_anthropic ? envStatus.anthropic_preview : 'NOT SET ← add this to Vercel' },
                      { label:'NEXT_PUBLIC_ANTHROPIC_API_KEY',   ok: envStatus.has_anthropic_public, value: envStatus.has_anthropic_public ? '✓ set' : 'NOT SET' },
                      { label:'NEXT_PUBLIC_GOOGLE_PLACES_KEY',   ok: envStatus.has_google_places,    value: envStatus.has_google_places ? '✓ set' : 'NOT SET' },
                      { label:'NEXT_PUBLIC_SUPABASE_URL',        ok: envStatus.has_supabase_url,     value: envStatus.has_supabase_url ? '✓ set' : 'NOT SET' },
                      { label:'SUPABASE_SERVICE_ROLE_KEY',       ok: envStatus.has_supabase_service, value: envStatus.has_supabase_service ? '✓ set' : 'NOT SET — needed for auto-migrate' },
                    ].map((item,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:9, background: item.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${item.ok?'#bbf7d0':'#fecaca'}` }}>
                        {item.ok ? <Check size={15} color={GREEN}/> : <AlertCircle size={15} color={RED}/>}
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color: item.ok?'#15803d':RED }}>{item.label}</div>
                          <div style={{ fontSize:12, color: item.ok?'#166534':'#991b1b', fontFamily:FB }}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                    {!envStatus.has_anthropic && (
                      <div style={{ padding:'12px 16px', background:'#fffbeb', borderRadius:10, border:'1px solid #fde68a', fontSize:13, color:'#92400e', fontFamily:FB }}>
                        <strong>Fix:</strong> Go to Vercel → Settings → Environment Variables → Add <code style={{fontFamily:'monospace', background:'rgba(0,0,0,.06)', padding:'1px 5px', borderRadius:4}}>ANTHROPIC_API_KEY</code> with your Claude API key value. Then redeploy.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize:14, color:'#9ca3af', fontFamily:FB }}>Click "Check Now" to verify all API keys and env vars are configured correctly.</div>
                )}
              </div>

              {/* Quick links */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14 }}>Quick Links</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[
                    { label:'Database Setup',    path:'/db-setup',         icon:Database, color:TEAL },
                    { label:'Agency Settings',   path:'/agency-settings',  icon:Building2, color:'#8b5cf6' },
                    { label:'Billing',           path:'/billing',          icon:DollarSign, color:GREEN },
                    { label:'KotoDesk',          path:'/desk',             icon:Users, color:RED },
                    { label:'SEO Hub',           path:'/seo',              icon:BarChart2, color:RED },
                    { label:'Platform Admin',    path:'/platform-admin',   icon:Shield, color:'#374151' },
                  ].map((item,i)=>(
                    <button key={i} onClick={()=>navigate(item.path)}
                      style={{ padding:'12px 14px', borderRadius:11, border:'1px solid #e5e7eb', background:'#fafafa', cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
                      <item.icon size={18} color={item.color}/>
                      <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{item.label}</span>
                      <ChevronRight size={13} color="#9ca3af" style={{ marginLeft:'auto' }}/>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
