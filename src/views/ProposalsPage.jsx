"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, Search, Filter, Send, CheckCircle,
  Clock, Eye, XCircle, ArrowRight, MoreHorizontal,
  Copy, Trash2, Edit, TrendingUp, DollarSign,
  AlertCircle, ChevronDown, Shield, Layers
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileSearch, MobileCard, MobileRow, MobileEmpty, MobileSectionHeader, MobileTabs } from '../components/mobile/MobilePage'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: '#4b5563', bg: '#f9fafb', icon: Edit },
  sent:      { label: 'Sent',      color: '#3b82f6', bg: '#eff6ff', icon: Send },
  viewed:    { label: 'Viewed',    color: '#d97706', bg: '#fffbeb', icon: Eye },
  accepted:  { label: 'Accepted',  color: '#0e7490', bg: '#e8f9fa', icon: CheckCircle },
  declined:  { label: 'Declined',  color: '#dc2626', bg: '#fef2f2', icon: XCircle },
  agreement: { label: 'Agreement', color: '#7c3aed', bg: '#f5f3ff', icon: FileText },
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  const Icon = cfg.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background:cfg.bg, color:cfg.color }}>
      <Icon size={10} strokeWidth={2.5}/> {cfg.label}
    </span>
  )
}

function fmt(n) { return n ? `$${Number(n).toLocaleString()}` : '—' }

export default function ProposalsPage() {
  const navigate = useNavigate()
  const { agencyId, firstName } = useAuth()
  const { clients } = useClient()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [menuOpen, setMenuOpen]   = useState(null)

  useEffect(() => { load() }, [agencyId])

  async function load() {
    if (!agencyId) return
    const { data } = await supabase
      .from('proposals')
      .select('*, clients(name, industry)')
      .eq('agency_id', agencyId)
      .order('updated_at', { ascending: false })
    setProposals(data || [])
    setLoading(false)
  }

  async function createNew() {
    const { data, error } = await supabase.from('proposals').insert({
      agency_id: agencyId,
      title: 'New Proposal',
      status: 'draft',
      type: 'proposal',
    }).select().single()
    if (error) { toast.error('Failed to create'); return }
    navigate(`/proposals/${data.id}`)
  }

  async function duplicate(p) {
    const { data } = await supabase.from('proposals').insert({
      agency_id: agencyId,
      client_id: p.client_id,
      title: `${p.title} (copy)`,
      status: 'draft',
      type: p.type,
      intro: p.intro,
      executive_summary: p.executive_summary,
      terms: p.terms,
    }).select().single()
    if (!data) return
    const { data: sections } = await supabase.from('proposal_sections').select('*').eq('proposal_id', p.id)
    if (sections?.length) {
      await supabase.from('proposal_sections').insert(sections.map(s => ({ ...s, id: undefined, proposal_id: data.id })))
    }
    toast.success('Duplicated')
    load()
    setMenuOpen(null)
  }

  async function deleteProposal(id) {
    if (!confirm('Delete this proposal?')) return
    await supabase.from('proposals').delete().eq('id', id)
    toast.success('Deleted')
    load()
    setMenuOpen(null)
  }

  const filtered = proposals.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.clients?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total:    proposals.length,
    sent:     proposals.filter(p => ['sent','viewed'].includes(p.status)).length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    value:    proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_value || 0), 0),
  }

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  const [mobileStatus, setMobileStatus] = useState('all')
  if (isMobile) {
    const TYPE_COLORS = { proposal:'#ea2729', agreement:'#7c3aed', sow:'#16a34a', other:'#9a9a96' }
    const mobileFiltered = mobileStatus==='all' ? proposals : proposals.filter(p=>p.status===mobileStatus)
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Proposals"
          subtitle={`${proposals.length} total`}
          action={<button onClick={()=>navigate('/proposals/new')}
            style={{width:38,height:38,borderRadius:11,background:'#ea2729',border:'none',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
            <Plus size={20}/>
          </button>}/>

        <div style={{display:'flex',overflowX:'auto',background:'#fff',borderBottom:'1px solid #ececea',scrollbarWidth:'none'}}>
          {['all','draft','sent','signed','declined'].map(s=>(
            <button key={s} onClick={()=>setMobileStatus(s)}
              style={{flexShrink:0,padding:'0 16px',height:42,border:'none',
                borderBottom:`2.5px solid ${mobileStatus===s?'#ea2729':'transparent'}`,
                background:'transparent',color:mobileStatus===s?'#ea2729':'#9a9a96',
                fontSize:14,fontWeight:mobileStatus===s?700:500,cursor:'pointer',
                fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",whiteSpace:'nowrap'}}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
        ) : mobileFiltered.length===0 ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>
            No proposals found
          </div>
        ) : (
          <MobileCard style={{margin:'12px 16px'}}>
            {mobileFiltered.map((p,i)=>{
              const color = TYPE_COLORS[p.type]||'#9a9a96'
              const sts = p.status
              const stsBg = sts==='signed'?'#f0fdf4':sts==='sent'?'#f0fbfc':sts==='declined'?'#fef2f2':'#f2f2f0'
              const stsColor = sts==='signed'?'#16a34a':sts==='sent'?'#0e7490':sts==='declined'?'#ea2729':'#9a9a96'
              return (
                <MobileRow key={p.id}
                  onClick={()=>navigate(`/proposals/${p.id}`)}
                  borderBottom={i<filtered.length-1}
                  left={<div style={{width:38,height:38,borderRadius:10,background:color+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <FileText size={17} color={color}/>
                  </div>}
                  title={p.title||'Untitled'}
                  subtitle={[p.client_name, p.total_value?`$${Number(p.total_value).toLocaleString()}`:null].filter(Boolean).join(' · ')}
                  badge={<span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:stsBg,color:stsColor,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",flexShrink:0,textTransform:'capitalize'}}>{sts||'draft'}</span>}/>
              )
            })}
          </MobileCard>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', background:'#f4f4f5', overflow:'hidden' }}>
      <Sidebar/>
      <main style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 28px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:900, color:'#111', marginBottom:4 }}>{firstName ? `${firstName}'s Proposals` : 'Proposals & Agreements'}</h1>
              <p style={{ fontSize:15, color:'#4b5563' }}>Build proposals, convert to agreements, collect e-signatures</p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => navigate('/proposals/modules')}
                style={{ padding:'9px 18px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:7 }}>
                <FileText size={14}/> Service Library
              </button>
              <button onClick={createNew}
                style={{ padding:'9px 18px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:`0 4px 14px ${ACCENT}40` }}>
                <Plus size={14}/> New Proposal
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'Total proposals', value:stats.total, icon:FileText, color:'#374151' },
              { label:'Awaiting response', value:stats.sent, icon:Clock, color:'#3b82f6' },
              { label:'Accepted', value:stats.accepted, icon:CheckCircle, color:'#16a34a' },
              { label:'Closed revenue', value:fmt(stats.value), icon:DollarSign, color:ACCENT },
            ].map(s => {
              const I = s.icon
              return (
                <div key={s.label} className="animate-fade-up hover-lift" style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <I size={16} color={s.color}/>
                    <span style={{ fontSize:14, color:'#4b5563' }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize:24, fontWeight:900, color:'#111' }}>{s.value}</div>
                </div>
              )
            })}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:18, alignItems:'center' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 14px' }}>
              <Search size={14} color="#9ca3af"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search proposals or clients…"
                style={{ border:'none', outline:'none', fontSize:15, background:'transparent', flex:1, color:'#111' }}/>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {['all','draft','sent','viewed','accepted','agreement'].map(s => (
                <button key={s} onClick={()=>setStatusFilter(s)}
                  style={{ padding:'7px 14px', borderRadius:20, border:`1.5px solid ${statusFilter===s?ACCENT:'#e5e7eb'}`, background:statusFilter===s?'#f0fbfc':'#fff', color:statusFilter===s?ACCENT:'#6b7280', fontSize:14, fontWeight:statusFilter===s?700:500, cursor:'pointer', textTransform:'capitalize' }}>
                  {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#4b5563' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <FileText size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
              <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:6 }}>
                {proposals.length === 0 ? 'No proposals yet' : 'No proposals match your filters'}
              </div>
              <div style={{ fontSize:15, color:'#4b5563', marginBottom:20 }}>
                {proposals.length === 0 ? 'Create your first proposal using your service library or from scratch.' : 'Try adjusting your search or filter.'}
              </div>
              {proposals.length === 0 && (
                <button onClick={createNew} style={{ padding:'10px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  Create First Proposal
                </button>
              )}
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              {filtered.map((p, i) => (
                <div key={p.id}
                  style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', borderBottom: i < filtered.length-1 ? '1px solid #f9fafb' : 'none', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}
                  onClick={() => navigate(`/proposals/${p.id}`)}>

                  {/* Type icon */}
                  <div style={{ width:40, height:40, borderRadius:10, background: p.type==='agreement'?'#f5f3ff': p.type==='sow'?'#f0fdf4':'#f0fbfc', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FileText size={18} color={p.type==='agreement'?'#7c3aed':p.type==='sow'?'#16a34a':ACCENT}/>
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                      <span style={{ fontSize:15, fontWeight:700, color:'#111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:340 }}>{p.title}</span>
                      <StatusPill status={p.status}/>
                      <span style={{ fontSize:13, color:'#4b5563', background:'#f3f4f6', padding:'2px 8px', borderRadius:20, textTransform:'capitalize' }}>{p.type}</span>
                    </div>
                    <div style={{ fontSize:14, color:'#4b5563' }}>
                      {p.clients?.name ? <span style={{ color:'#374151' }}>{p.clients.name}</span> : <span style={{ color:'#d1d5db' }}>No client selected</span>}
                      {p.clients?.industry && <> · {p.clients.industry}</>}
                      {p.valid_until && <> · Valid until {new Date(p.valid_until).toLocaleDateString()}</>}
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{fmt(p.total_value)}</div>
                    <div style={{ fontSize:13, color:'#4b5563' }}>{new Date(p.updated_at).toLocaleDateString()}</div>
                  </div>

                  {/* Menu */}
                  <div style={{ position:'relative' }} onClick={e=>e.stopPropagation()}>
                    <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===p.id?null:p.id)}}
                      style={{ padding:7, borderRadius:8, border:'none', background:'none', cursor:'pointer', color:'#4b5563' }}>
                      <MoreHorizontal size={16}/>
                    </button>
                    {menuOpen===p.id && (
                      <div style={{ position:'absolute', right:0, top:'100%', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:50, minWidth:170, padding:4 }}>
                        <button onClick={()=>navigate(`/proposals/${p.id}`)}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#374151' }}>
                          <Edit size={13}/> Open & Edit
                        </button>
                        {p.status === 'accepted' && (
                          <button onClick={()=>navigate(`/proposals/${p.id}?convert=agreement`)}
                            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#7c3aed' }}>
                            <FileText size={13}/> Convert to Agreement
                          </button>
                        )}
                        <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/p/${p.public_token}`); toast.success('Link copied!'); setMenuOpen(null) }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#374151' }}>
                          <Copy size={13}/> Copy Client Link
                        </button>
                        <button onClick={()=>duplicate(p)}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#374151' }}>
                          <Copy size={13}/> Duplicate
                        </button>
                        <div style={{ height:'0.5px', background:'#f3f4f6', margin:'4px 0' }}/>
                        <button onClick={()=>deleteProposal(p.id)}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px', border:'none', background:'none', cursor:'pointer', fontSize:15, color:'#dc2626' }}>
                          <Trash2 size={13}/> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <ArrowRight size={14} color="#d1d5db"/>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
