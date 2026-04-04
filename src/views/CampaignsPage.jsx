"use client";
"use client";
import { useState, useEffect } from 'react'
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing')} className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-0.5">{stats.total} campaigns &middot; {stats.totalEmails} emails sent</p>
            </div>
            <button onClick={() => navigate('/marketing/campaigns/new')} className="btn-primary text-sm"><Plus size={13} /> New Campaign</button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Search size={14} className="text-gray-400" />
              <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex bg-white rounded-xl border border-gray-200 p-0.5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {['all', 'draft', 'sent', 'scheduled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`text-sm px-3 py-1.5 rounded-lg capitalize font-medium ${filterStatus === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Campaign list */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
            <div className="grid grid-cols-[1fr_100px_80px_80px_120px_60px] gap-3 px-5 py-3 bg-gray-50/50 text-[13px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <div>Campaign</div><div>Status</div><div>Sent</div><div>Opens</div><div>Date</div><div></div>
            </div>
            {filtered.length === 0 && <div className="py-16 text-center text-sm text-gray-400">No campaigns found</div>}
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_100px_80px_80px_120px_60px] gap-3 px-5 py-3.5 items-center border-b border-gray-50 hover:bg-gray-50/50 group">
                <div className="cursor-pointer" onClick={() => navigate(`/marketing/campaigns/${c.id}`)}>
                  <p className="text-sm font-medium text-gray-900">{c.name || 'Untitled'}</p>
                  <p className="text-sm text-gray-400 truncate">{c.subject || 'No subject'}</p>
                </div>
                <span className={`text-[13px] px-2 py-0.5 rounded-full font-medium w-fit ${c.status === 'sent' ? 'bg-green-50 text-green-700' : c.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>{c.status}</span>
                <span className="text-sm text-gray-500">{c.total_sent || 0}</span>
                <span className="text-sm text-gray-500">{c.total_opened || 0}</span>
                <span className="text-sm text-gray-400">{c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : ''}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => navigate(`/marketing/campaigns/${c.id}`)} className="text-gray-400 hover:text-gray-700" title="Edit"><Edit2 size={12} /></button>
                  <button onClick={() => handleDuplicate(c)} className="text-gray-400 hover:text-gray-700" title="Duplicate"><Copy size={12} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
