"use client";
import { useState, useEffect } from 'react'
import { useMobile } from '../hooks/useMobile'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Send, Edit2, Copy, Eye, ChevronLeft, MoreHorizontal } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function CampaignsPage() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { loadCampaigns() }, [])

  async function loadCampaigns() {
    const { data } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false })
    setCampaigns(data || [])
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('email_campaigns').delete().eq('id', id)
    toast.success('Campaign deleted'); loadCampaigns()
  }

  async function handleDuplicate(camp) {
    const { id, created_at, sent_at, total_sent, total_opened, ...rest } = camp
    const { error } = await supabase.from('email_campaigns').insert({ ...rest, name: `${rest.name} (copy)`, status: 'draft' })
    if (error) { toast.error('Failed to duplicate'); return }
    toast.success('Campaign duplicated'); loadCampaigns()
  }

  const filtered = campaigns.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.subject?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: campaigns.length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    totalEmails: campaigns.reduce((a, c) => a + (c.total_sent || 0), 0),
  }

  const isMobile = useMobile()
  const [mSearch, setMSearch] = useState('')
  const [mSts, setMSts] = useState('all')

  /* ─── MOBILE ─── */
  if (isMobile) {
    const stsTabs = [
      {key:'all',    label:'All'},
      {key:'active', label:'Active'},
      {key:'draft',  label:'Draft'},
      {key:'sent',   label:'Sent'},
    ]
    const fCampaigns = (campaigns||[])
      .filter(c=>mSts==='all'||c.status===mSts)
      .filter(c=>!mSearch||c.name?.toLowerCase().includes(mSearch.toLowerCase()))
    const stsColor = s=>({active:'#16a34a',draft:'#9a9a96',sent:'#ea2729',paused:'#f59e0b'})[s]||'#9a9a96'
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Campaigns" subtitle={`${campaigns?.length||0} campaigns`}
          action={<button onClick={()=>navigate('/campaigns/builder')}
            style={{width:38,height:38,borderRadius:11,background:'#ea2729',border:'none',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>}/>
        <MobileSearch value={mSearch} onChange={setMSearch} placeholder="Search campaigns…"/>
        <MobileTabs tabs={stsTabs} active={mSts} onChange={setMSts}/>
        {fCampaigns.length===0 ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>No campaigns found</div>
        ) : (
          <MobileCard style={{margin:'12px 16px'}}>
            {fCampaigns.map((cam,i)=>(
              <MobileRow key={cam.id}
                onClick={()=>navigate(`/campaigns/builder/${cam.id}`)}
                borderBottom={i<fCampaigns.length-1}
                left={<div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,marginTop:4,background:stsColor(cam.status)}}/>}
                title={cam.name||'Untitled'}
                subtitle={[cam.type||'Email', cam.list_name].filter(Boolean).join(' · ')}
                badge={<span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:20,background:stsColor(cam.status)+'15',color:stsColor(cam.status),fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",flexShrink:0,textTransform:'capitalize'}}>{cam.status||'draft'}</span>}/>
            ))}
          </MobileCard>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-700 mt-0.5">{stats.total} campaigns &middot; {stats.totalEmails} emails sent</p>
            </div>
            <button onClick={() => navigate('/marketing/campaigns/new')} className="btn-primary text-sm"><Plus size={13} /> New Campaign</button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Search size={14} className="text-gray-700" />
              <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex bg-white rounded-xl border border-gray-200 p-0.5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {['all', 'draft', 'sent', 'scheduled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`text-sm px-3 py-1.5 rounded-lg capitalize font-medium ${filterStatus === s ? 'bg-gray-900 text-white' : 'text-gray-700 hover:text-gray-700'}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Campaign list */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
            <div className="grid grid-cols-[1fr_100px_80px_80px_120px_60px] gap-3 px-5 py-3 bg-gray-50/50 text-[13px] font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-100">
              <div>Campaign</div><div>Status</div><div>Sent</div><div>Opens</div><div>Date</div><div></div>
            </div>
            {filtered.length === 0 && <div className="py-16 text-center text-sm text-gray-700">No campaigns found</div>}
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_100px_80px_80px_120px_60px] gap-3 px-5 py-3.5 items-center border-b border-gray-50 hover:bg-gray-50/50 group">
                <div className="cursor-pointer" onClick={() => navigate(`/marketing/campaigns/${c.id}`)}>
                  <p className="text-sm font-medium text-gray-900">{c.name || 'Untitled'}</p>
                  <p className="text-sm text-gray-700 truncate">{c.subject || 'No subject'}</p>
                </div>
                <span className={`text-[13px] px-2 py-0.5 rounded-full font-medium w-fit ${c.status === 'sent' ? 'bg-green-50 text-green-700' : c.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>{c.status}</span>
                <span className="text-sm text-gray-700">{c.total_sent || 0}</span>
                <span className="text-sm text-gray-700">{c.total_opened || 0}</span>
                <span className="text-sm text-gray-700">{c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : ''}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => navigate(`/marketing/campaigns/${c.id}`)} className="text-gray-700 hover:text-gray-700" title="Edit"><Edit2 size={12} /></button>
                  <button onClick={() => handleDuplicate(c)} className="text-gray-700 hover:text-gray-700" title="Duplicate"><Copy size={12} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-700 hover:text-red-500" title="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
