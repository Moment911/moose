"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Loader2, ChevronUp, ChevronDown, MoreHorizontal,
  Edit2, Trash2, ExternalLink, Mail, Phone, Globe,
  Users, Filter, X, Check, ArrowRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getClients, createClient_, updateClient, deleteClient } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobileSearch, MobileRow, MobileSectionHeader, MobileCard, MobileEmpty, MobileButton, MobileTabs } from '../components/mobile/MobilePage'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const STATUS_COLORS = {
  active:   { bg:'#f0fdf4', color:'#16a34a', dot:'#16a34a' },
  prospect: { bg:'#f0fbfc', color:ACCENT,    dot:ACCENT },
  inactive: { bg:'#f9fafb', color:'#4b5563', dot:'#9ca3af' },
  paused:   { bg:'#fffbeb', color:'#d97706', dot:'#d97706' },
}

const INDUSTRIES = [
  'Plumbing','HVAC','Dental','Law Firm','Gym / Fitness','Roofing',
  'Auto Dealer','Landscaping','Restaurant','Real Estate','Medical',
  'Salon / Spa','Childcare','Veterinary','Electrician','Contractor','Other'
]

function StatusDot({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.active
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:14, fontWeight:700, padding:'3px 10px', borderRadius:20, background:cfg.bg, color:cfg.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot, display:'inline-block' }}/>
      {status ? status.charAt(0).toUpperCase()+status.slice(1) : 'Active'}
    </span>
  )
}

function SortIcon({ field, sortKey, sortDir }) {
  if (sortKey !== field) return <ChevronUp size={12} color="#d1d5db"/>
  return sortDir === 'asc' ? <ChevronUp size={12} color={ACCENT}/> : <ChevronDown size={12} color={ACCENT}/>
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const { agencyId, firstName } = useAuth()
  const { refreshClients } = useClient()

  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [sortKey, setSortKey]   = useState('name')
  const [sortDir, setSortDir]   = useState('asc')
  const [showAdd, setShowAdd]   = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    name:'', email:'', phone:'', website:'', industry:'', status:'active',
    address:'', city:'', state:'', zip:'', notes:'', monthly_value:''
  })
  const [bizSearch,    setBizSearch]    = useState('')
  const [bizResults,   setBizResults]   = useState([])
  const [bizSearching, setBizSearching] = useState(false)
  const [bizSearched,  setBizSearched]  = useState(false)
  const [bizDebug,     setBizDebug]     = useState(null)

  useEffect(() => { load() }, [agencyId])

  async function load() {
    setLoading(true)
    const { data } = await getClients(agencyId)
    setClients(data || [])
    setLoading(false)
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (editingId) {
      const { error } = await updateClient(editingId, form)
      if (error) { toast.error(error.message); return }
      toast.success('Client updated')
    } else {
      const { error } = await supabase.from('clients').insert({
        name:          form.name.trim(),
        email:         form.email.trim() || null,
        phone:         form.phone.trim() || null,
        website:       form.website.trim() || null,
        industry:      form.industry || null,
        status:        form.status || 'active',
        address:       form.address || null,
        city:          form.city || null,
        state:         form.state || null,
        zip:           form.zip || null,
        notes:         form.notes || null,
        monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null,
        agency_id:     agencyId,
      }).select().single()
      if (error) {
        if (error.message?.includes('foreign key') || error.message?.includes('agency_id')) {
          toast.error('Run the seed SQL in Supabase first — see supabase/migrations/20260411_fix_fk_and_seed.sql')
        } else {
          toast.error(error.message)
        }
        return
      }
      // Update with extra fields
      if (form.phone || form.website || form.industry || form.status !== 'active') {
        const { data: latest } = await getClients(agencyId)
        const newest = latest?.find(c => c.name === form.name.trim())
        if (newest) await updateClient(newest.id, { phone:form.phone, website:form.website, industry:form.industry, status:form.status })
      }
      toast.success('Client added')
    }
    setShowAdd(false); setEditingId(null)
    setForm({ name:'', email:'', phone:'', website:'', industry:'', status:'active', address:'', city:'', state:'', zip:'', notes:'', monthly_value:'' }); setBizResults([]); setBizSearch(''); setBizSearched(false)
    await load()
    await refreshClients()
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await deleteClient(id)
    toast.success('Deleted')
    await load()
    await refreshClients()
    setMenuOpen(null)
  }

  function startEdit(client) {
    setEditingId(client.id)
    setForm({ name:client.name||'', email:client.email||'', phone:client.phone||'',
      website:client.website||'', industry:client.industry||'', status:client.status||'active' })
    setShowAdd(true)
    setMenuOpen(null)
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = clients
    .filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) || c.industry?.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchIndustry = industryFilter === 'all' || c.industry === industryFilter
      return matchSearch && matchStatus && matchIndustry
    })
    .sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase()
      const bv = (b[sortKey] || '').toString().toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  const industries = [...new Set(clients.map(c => c.industry).filter(Boolean))]
  const isMobile = useMobile()

  /* ─────────────── MOBILE ─────────────── */
  if (isMobile) {
    const statuses = ['all','active','prospect','inactive','paused']
    return (
      <MobilePage padded={false}>
        {/* Header */}
        <div style={{ background:'#0a0a0a', padding:'16px 16px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h1 style={{ fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em' }}>Clients</h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'2px 0 0' }}>
                {clients.length} total · {clients.filter(c=>c.status==='active').length} active
              </p>
            </div>
            <button onClick={()=>{setEditingId(null);setForm({name:'',email:'',phone:'',website:'',industry:'',status:'active'});setShowAdd(true)}}
              style={{ width:40, height:40, borderRadius:12, background:'#ea2729', border:'none', color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', WebkitTapHighlightColor:'transparent' }}>
              <Plus size={20}/>
            </button>
          </div>
        </div>

        {/* Search */}
        <MobileSearch value={search} onChange={setSearch} placeholder="Search clients…"/>

        {/* Status filter tabs */}
        <div style={{ display:'flex', overflowX:'auto', background:'#fff', borderBottom:'1px solid #ececea', scrollbarWidth:'none' }}>
          {statuses.map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              style={{ flexShrink:0, padding:'0 16px', height:42, border:'none',
                borderBottom:`2.5px solid ${statusFilter===s?'#ea2729':'transparent'}`,
                background:'transparent', color:statusFilter===s?'#ea2729':'#9a9a96',
                fontSize:14, fontWeight:statusFilter===s?700:500, cursor:'pointer',
                fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", whiteSpace:'nowrap' }}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>

        {/* Add/Edit form */}
        {showAdd && (
          <div style={{ margin:'12px 16px', background:'#fff', borderRadius:14, border:'2px solid #ea2729', padding:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", fontSize:16, fontWeight:800, color:'#0a0a0a' }}>
                {editingId ? 'Edit Client' : 'New Client'}
              </span>
              <button onClick={()=>{setShowAdd(false);setEditingId(null)}} style={{ background:'none', border:'none', cursor:'pointer', color:'#9a9a96' }}>
                <X size={18}/>
              </button>
            </div>
            {[{label:'Name *',key:'name',type:'text',placeholder:'Apex Dental'},{label:'Email',key:'email',type:'email',placeholder:'info@client.com'},{label:'Phone',key:'phone',type:'tel',placeholder:'(305) 555-0100'},{label:'Website',key:'website',type:'url',placeholder:'https://client.com'}].map(f=>(
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ fontSize:13, fontWeight:700, color:'#0a0a0a', display:'block', marginBottom:4, fontFamily:"'Proxima Nova','Nunito Sans',sans-serif" }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e=>setF(f.key,e.target.value)} placeholder={f.placeholder}
                  style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, outline:'none', color:'#0a0a0a', boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor='#ea2729'} onBlur={e=>e.target.style.borderColor='#ececea'}/>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:13, fontWeight:700, color:'#0a0a0a', display:'block', marginBottom:4, fontFamily:"'Proxima Nova','Nunito Sans',sans-serif" }}>Status</label>
              <select value={form.status} onChange={e=>setF('status',e.target.value)}
                style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #ececea', fontSize:16, color:'#0a0a0a', background:'#fff' }}>
                <option value="active">Active</option><option value="prospect">Prospect</option>
                <option value="paused">Paused</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <MobileButton label={editingId?'Save Changes':'Add Client'} onPress={handleSave}/>
              <MobileButton label="Cancel" onPress={()=>{setShowAdd(false);setEditingId(null)}} secondary/>
            </div>
          </div>
        )}

        {/* Client list */}
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#9a9a96' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <MobileEmpty icon={Users} title="No clients found"
            body={search ? 'Try a different search' : 'Add your first client to get started'}
            action={!search && <MobileButton label="Add Client" onPress={()=>{setShowAdd(true);setEditingId(null)}}/>}/>
        ) : (
          <MobileCard style={{ margin:'12px 16px' }}>
            {filtered.map((cl,i)=>{
              const cfg = STATUS_COLORS[cl.status]||STATUS_COLORS.active
              return (
                <MobileRow key={cl.id}
                  onClick={()=>navigate(`/clients/${cl.id}`)}
                  borderBottom={i<filtered.length-1}
                  left={<div style={{ width:38, height:38, borderRadius:10, background:cfg.bg, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", fontSize:15, fontWeight:800, color:cfg.color }}>
                    {cl.name[0].toUpperCase()}
                  </div>}
                  title={cl.name}
                  subtitle={[cl.industry, cl.phone].filter(Boolean).join(' · ')}
                  badge={<span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:"'Proxima Nova','Nunito Sans',sans-serif", flexShrink:0 }}>{cl.status||'active'}</span>}/>
              )
            })}
          </MobileCard>
        )}
      </MobilePage>
    )
  }

  const THstyle = (field) => ({
    padding:'11px 14px', fontSize:14, fontWeight:700, color:'#374151',
    textAlign:'left', background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
    cursor:'pointer', userSelect:'none', whiteSpace:'nowrap'
  })

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', background:'#f4f4f5', overflow:'hidden' }}>
      <Sidebar/>

      <main style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 28px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#111', margin:0 }}>{firstName ? `${firstName}'s Clients` : 'Clients'}</h1>
              <p style={{ fontSize:15, color:'#4b5563', margin:'4px 0 0' }}>
                {clients.length} total · {clients.filter(c=>c.status==='active').length} active
              </p>
            </div>
            <button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name:'', email:'', phone:'', website:'', industry:'', status:'active', address:'', city:'', state:'', zip:'', notes:'', monthly_value:'' }); setBizResults([]); setBizSearch(''); setBizSearched(false) }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:11, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 14px ${ACCENT}40` }}>
              <Plus size={16}/> Add Client
            </button>
          </div>

          {/* Add/Edit form */}
          {showAdd && (
            <div style={{ background:'#fff', borderRadius:16, border:`2px solid ${ACCENT}`, padding:'24px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', margin:0 }}>
                  {editingId ? 'Edit Client' : 'New Client'}
                </h2>
                <button onClick={()=>{setShowAdd(false);setEditingId(null);setBizResults([]);setBizSearch('')}}
                  style={{ border:'none', background:'none', cursor:'pointer', color:'#4b5563', padding:4 }}>
                  <X size={18}/>
                </button>
              </div>

              {/* Google Places search — only on add, not edit */}
              {!editingId && (
                <div style={{ marginBottom:18, padding:'14px 16px', background:'#f0fbfc', borderRadius:12, border:'1px solid #5bc6d040' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0e7490', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                    🔍 Search Google to auto-fill client details
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={bizSearch} onChange={e=>setBizSearch(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&searchBusiness(bizSearch)}
                      placeholder="e.g. Apex Dental Boca Raton FL"
                      style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111' }}
                      onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                    <button onClick={()=>searchBusiness(bizSearch)} disabled={bizSearching||!bizSearch.trim()}
                      style={{ padding:'9px 16px', borderRadius:9, border:'none', background:TEAL, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                      {bizSearching ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <Search size={13}/>}
                      {bizSearching ? '…' : 'Search'}
                    </button>
                  </div>
                  {bizResults.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                      {bizResults.map((biz,i)=>(
                        <div key={i}
                          onClick={()=>autofillFromGoogle(biz)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', cursor:'pointer', background:'#fff', transition:'all .1s' }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=ACCENT;e.currentTarget.style.background='#fef2f2'}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='#fff'}}>
                          {biz.photo && <img src={biz.photo} alt="" style={{ width:36, height:36, borderRadius:7, objectFit:'cover', flexShrink:0 }} onError={e=>e.target.style.display='none'}/>}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>{biz.name}</div>
                            <div style={{ fontSize:12, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{biz.address}</div>
                          </div>
                          {biz.rating && <div style={{ fontSize:12, color:'#f59e0b', fontWeight:700, flexShrink:0 }}>★{biz.rating} ({biz.review_count})</div>}
                          <div style={{ fontSize:12, color:ACCENT, fontWeight:700, flexShrink:0 }}>Fill →</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {bizSearched && bizResults.length===0 && !bizSearching && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:13, color:'#9ca3af', marginBottom:6 }}>No results — fill in details manually below</div>
                      {bizDebug && (
                        <div style={{ fontSize:11, fontFamily:'monospace', background:'#1a1a2e', color:'#a3e635', padding:'10px 14px', borderRadius:9, wordBreak:'break-all', lineHeight:1.8 }}>
                          <div style={{ color:'#94a3b8', marginBottom:4, fontFamily:'sans-serif', fontSize:11, fontWeight:700 }}>DEBUG — API response:</div>
                          {JSON.stringify(bizDebug, null, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Core fields */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  { label:'Client Name *', key:'name', placeholder:'Apex Dental Studio', type:'text' },
                  { label:'Email',         key:'email', placeholder:'info@client.com',   type:'email' },
                  { label:'Phone',         key:'phone', placeholder:'(305) 555-0100',    type:'tel' },
                  { label:'Website',       key:'website', placeholder:'https://client.com', type:'url' },
                  { label:'Monthly Value ($)', key:'monthly_value', placeholder:'2500',  type:'number' },
                ].map(f=>(
                  <div key={f.key}>
                    <label style={{ fontSize:13, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]||''} onChange={e=>setF(f.key,e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=ACCENT} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Industry</label>
                  <select value={form.industry} onChange={e=>setF('industry',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, color:'#111', background:'#fff', boxSizing:'border-box' }}>
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Address fields */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  { label:'Street Address', key:'address', placeholder:'123 Main St',  type:'text' },
                  { label:'City',           key:'city',    placeholder:'Miami',         type:'text' },
                  { label:'State / ZIP',    key:'state',   placeholder:'FL',            type:'text' },
                ].map(f=>(
                  <div key={f.key}>
                    <label style={{ fontSize:13, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]||''} onChange={e=>setF(f.key,e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=ACCENT} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  </div>
                ))}
              </div>

              {/* Status + Notes */}
              <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Status</label>
                  <select value={form.status} onChange={e=>setF('status',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, color:'#111', background:'#fff' }}>
                    <option value="active">Active</option>
                    <option value="prospect">Prospect</option>
                    <option value="paused">Paused</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Notes</label>
                  <input value={form.notes||''} onChange={e=>setF('notes',e.target.value)}
                    placeholder="Any important context about this client…"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}
                    onFocus={e=>e.target.style.borderColor=ACCENT} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                </div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={handleSave}
                  style={{ padding:'10px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  {editingId ? 'Save Changes' : 'Add Client'}
                </button>
                <button onClick={()=>{setShowAdd(false);setEditingId(null);setBizResults([]);setBizSearch('')}}
                  style={{ padding:'10px 20px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search + filters */}
          <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, padding:'9px 14px' }}>
              <Search size={15} color="#9ca3af"/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search by name, email, phone, industry…"
                style={{ border:'none', outline:'none', fontSize:15, background:'transparent', flex:1, color:'#111' }}/>
              {search && <button onClick={()=>setSearch('')} style={{ border:'none', background:'none', cursor:'pointer', color:'#4b5563', padding:2 }}><X size={13}/></button>}
            </div>

            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:11, border:'1.5px solid #e5e7eb', fontSize:15, background:'#fff', color:'#374151', outline:'none', cursor:'pointer' }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
            </select>

            <select value={industryFilter} onChange={e=>setIndustryFilter(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:11, border:'1.5px solid #e5e7eb', fontSize:15, background:'#fff', color:'#374151', outline:'none', cursor:'pointer' }}>
              <option value="all">All industries</option>
              {industries.map(i=><option key={i} value={i}>{i}</option>)}
            </select>

            {(search || statusFilter !== 'all' || industryFilter !== 'all') && (
              <button onClick={()=>{ setSearch(''); setStatusFilter('all'); setIndustryFilter('all') }}
                style={{ padding:'9px 14px', borderRadius:11, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:15, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                <X size={13}/> Clear
              </button>
            )}

            <div style={{ fontSize:15, color:'#4b5563', marginLeft:'auto' }}>
              {filtered.length} of {clients.length} clients
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#4b5563', fontSize:15 }}>Loading clients…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <Users size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
              <div style={{ fontSize:17, fontWeight:800, color:'#111', marginBottom:6 }}>
                {clients.length === 0 ? 'No clients yet' : 'No clients match your filters'}
              </div>
              <div style={{ fontSize:15, color:'#4b5563', marginBottom:20 }}>
                {clients.length === 0 ? 'Add your first client to get started.' : 'Try adjusting your search or filters.'}
              </div>
              {clients.length === 0 && (
                <button onClick={() => setShowAdd(true)}
                  style={{ padding:'10px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  Add First Client
                </button>
              )}
            </div>
          ) : (
            <div className="animate-fade-up" style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'visible', position:'relative' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderRadius:'16px 16px 0 0' }}>
                    {[
                      { key:'name',     label:'Client Name' },
                      { key:'industry', label:'Industry' },
                      { key:'status',   label:'Status' },
                      { key:'email',    label:'Contact' },
                    ].map(col => (
                      <th key={col.key} style={THstyle(col.key)} onClick={() => toggleSort(col.key)}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          {col.label}
                          <SortIcon field={col.key} sortKey={sortKey} sortDir={sortDir}/>
                        </div>
                      </th>
                    ))}
                    <th style={{ ...THstyle(''), cursor:'default', width:100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ position:'relative' }}>
                  {filtered.map((client, i) => (
                    <tr key={client.id}
                      style={{ borderBottom: i < filtered.length-1 ? '1px solid #f3f4f6' : 'none', cursor:'pointer', transition:'background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#fafafa'; e.currentTarget.style.transform='translateX(2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.transform='' }}
                      onClick={() => navigate(`/clients/${client.id}`)}>

                      {/* Name */}
                      <td style={{ padding:'14px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:38, height:38, borderRadius:10, background:ACCENT+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:ACCENT, flexShrink:0 }}>
                            {(client.name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{client.name}</div>
                            {client.website && (
                              <a href={client.website} target="_blank" rel="noreferrer"
                                onClick={e=>e.stopPropagation()}
                                style={{ fontSize:13, color:'#4b5563', display:'flex', alignItems:'center', gap:3, textDecoration:'none' }}>
                                <Globe size={10}/> {client.website.replace(/^https?:\/\//,'').slice(0,30)}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Industry */}
                      <td style={{ padding:'14px 14px' }}>
                        <span style={{ fontSize:15, color:'#374151', fontWeight:600 }}>
                          {client.industry || <span style={{ color:'#d1d5db' }}>—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding:'14px 14px' }}>
                        <StatusDot status={client.status}/>
                      </td>

                      {/* Contact */}
                      <td style={{ padding:'14px 14px' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {client.email && (
                            <a href={`mailto:${client.email}`} onClick={e=>e.stopPropagation()}
                              style={{ fontSize:14, color:'#374151', display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
                              <Mail size={11}/> {client.email}
                            </a>
                          )}
                          {client.phone && (
                            <a href={`tel:${client.phone}`} onClick={e=>e.stopPropagation()}
                              style={{ fontSize:14, color:'#374151', display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
                              <Phone size={11}/> {client.phone}
                            </a>
                          )}
                          {!client.email && !client.phone && <span style={{ fontSize:14, color:'#d1d5db' }}>No contact info</span>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding:'14px 14px', position:'relative', overflow:'visible' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={() => navigate(`/clients/${client.id}`)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:4 }}>
                            Open <ArrowRight size={11}/>
                          </button>
                          <div style={{ position:'relative' }}>
                            <button onClick={() => setMenuOpen(menuOpen===client.id ? null : client.id)}
                              style={{ padding:'5px 7px', borderRadius:7, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#4b5563', display:'flex', alignItems:'center' }}>
                              <MoreHorizontal size={14}/>
                            </button>
                            {menuOpen===client.id && (
                              <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.15)', zIndex:9999, minWidth:160, padding:4 }}>
                                <button onClick={()=>startEdit(client)}
                                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:14, color:'#374151', borderRadius:8, transition:'background .1s' }} onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                                  <Edit2 size={13}/> Edit
                                </button>
                                <button onClick={()=>handleDelete(client.id, client.name)}
                                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#dc2626' }}>
                                  <Trash2 size={13}/> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

  async function searchBusiness(query) {
    if (!query.trim()) return
    setBizSearching(true); setBizResults([]); setBizSearched(false); setBizDebug(null)
    try {
      const res = await fetch('/api/places/search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      setBizDebug(data)
      if (data.error) toast.error(data.error)
      setBizResults(data.results || [])
      setBizSearched(true)
    } catch(e) {
      setBizDebug({ error: e.message })
      toast.error('Search failed: ' + e.message)
    }
    setBizSearching(false)
  }

  function autofillFromGoogle(biz) {
    const parts = (biz.address || '').split(',').map(s => s.trim())
    const stateZip = (parts[2] || '').trim().split(' ')
    setForm(prev => ({
      ...prev,
      name:    prev.name || biz.name || '',
      phone:   prev.phone || '',
      website: prev.website || '',
      address: parts[0] || '',
      city:    parts[1] || '',
      state:   stateZip[0] || '',
      zip:     stateZip[1] || '',
    }))
    setBizResults([]); setBizSearch('')
    toast.success('Auto-filled from Google Maps!')
  }
