"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ChevronUp, ChevronDown, MoreHorizontal,
  Edit2, Trash2, ExternalLink, Mail, Phone, Globe,
  Users, Filter, X, Check, ArrowRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { getClients, createClient_, updateClient, deleteClient } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

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
    name:'', email:'', phone:'', website:'', industry:'', status:'active'
  })

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
      const { error } = await createClient_(form.name.trim(), form.email.trim(), agencyId)
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
    setForm({ name:'', email:'', phone:'', website:'', industry:'', status:'active' })
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

  const THstyle = (field) => ({
    padding:'11px 14px', fontSize:14, fontWeight:700, color:'#374151',
    textAlign:'left', background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
    cursor:'pointer', userSelect:'none', whiteSpace:'nowrap'
  })

  return (
    <div style={{ display:'flex', height:'100vh', background:'#f4f4f5', overflow:'hidden' }}>
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
            <button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name:'', email:'', phone:'', website:'', industry:'', status:'active' }) }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:11, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 14px ${ACCENT}40` }}>
              <Plus size={16}/> Add Client
            </button>
          </div>

          {/* Add/Edit form */}
          {showAdd && (
            <div className="animate-fade-up" style={{ background:'#fff', borderRadius:16, border:`2px solid ${ACCENT}`, padding:'24px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                <h2 style={{ fontSize:17, fontWeight:800, color:'#111', margin:0 }}>
                  {editingId ? 'Edit Client' : 'New Client'}
                </h2>
                <button onClick={() => { setShowAdd(false); setEditingId(null) }}
                  style={{ border:'none', background:'none', cursor:'pointer', color:'#4b5563', padding:4 }}>
                  <X size={18}/>
                </button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14 }}>
                {[
                  { label:'Client Name *', key:'name', placeholder:'Apex Dental Studio', type:'text' },
                  { label:'Email', key:'email', placeholder:'info@client.com', type:'email' },
                  { label:'Phone', key:'phone', placeholder:'(305) 555-0100', type:'tel' },
                  { label:'Website', key:'website', placeholder:'https://client.com', type:'url' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e=>setF(f.key,e.target.value)}
                      placeholder={f.placeholder}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=ACCENT}
                      onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Industry</label>
                  <select value={form.industry} onChange={e=>setF('industry',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', background:'#fff', boxSizing:'border-box' }}>
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Status</label>
                  <select value={form.status} onChange={e=>setF('status',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', background:'#fff', boxSizing:'border-box' }}>
                    <option value="active">Active</option>
                    <option value="prospect">Prospect</option>
                    <option value="paused">Paused</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={handleSave}
                  style={{ padding:'10px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  {editingId ? 'Save Changes' : 'Add Client'}
                </button>
                <button onClick={() => { setShowAdd(false); setEditingId(null) }}
                  style={{ padding:'10px 18px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:15, cursor:'pointer' }}>
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
            <div className="animate-fade-up" style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
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
                <tbody>
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
                      <td style={{ padding:'14px 14px' }} onClick={e=>e.stopPropagation()}>
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
                              <div style={{ position:'absolute', right:0, top:'100%', marginTop:4, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:50, minWidth:150, padding:4 }}>
                                <button onClick={()=>startEdit(client)}
                                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#374151' }}>
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
