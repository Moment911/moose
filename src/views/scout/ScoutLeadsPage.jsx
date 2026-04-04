"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Search, Star, Mail, Phone, Trash2, RefreshCw, Filter, ExternalLink } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

function scoreColor(s) { return s >= 75 ? '#22c55e' : s >= 50 ? '#5bc6d0' : s >= 30 ? '#eab308' : '#3b82f6' }

export default function ScoutLeadsPage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [filterTemp, setFilterTemp] = useState('all')

  useEffect(() => { loadLeads() }, [])

  async function loadLeads() {
    const { data } = await supabase.from('contacts').select('*').contains('tags', ['SCOUT Import']).order('created_at', { ascending: false })
    setContacts(data || [])
  }

  const filtered = contacts.filter(c => {
    if (search && !c.company?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTemp !== 'all') {
      const hasTag = (c.tags || []).some(t => t.toLowerCase().includes(filterTemp))
      if (!hasTag) return false
    }
    return true
  })

  const stats = {
    total: contacts.length,
    hot: contacts.filter(c => (c.tags || []).some(t => t.includes('Hot'))).length,
    warm: contacts.filter(c => (c.tags || []).some(t => t.includes('Warm'))).length,
    contacted: contacts.filter(c => c.outreach_status === 'email_sent').length,
  }

  return (
    <ScoutLayout>
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
        <Target size={18} className="text-brand-500" />
        <span className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>SCOUT</span>
        <span className="text-sm text-slate-400 ml-1">My Leads</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            { label: 'Total Leads', value: stats.total, color: '#0F172A' },
            { label: 'Hot Leads', value: stats.hot, color: '#ef4444' },
            { label: 'Warm Leads', value: stats.warm, color: '#5bc6d0' },
            { label: 'Contacted', value: stats.contacted, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 max-w-sm">
            <Search size={14} className="text-slate-400" />
            <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex bg-white rounded-xl border border-slate-200 p-0.5">
            {['all', 'hot', 'warm'].map(t => (
              <button key={t} onClick={() => setFilterTemp(t)} className={`text-sm px-3 py-1.5 rounded-lg capitalize font-medium ${filterTemp === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
            ))}
          </div>
          <button onClick={() => navigate('/scout')} className="btn-primary text-sm" style={{ background: '#5bc6d0' }}><Target size={12} /> New Search</button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ overflowX: 'auto' }}>
          <div className="grid grid-cols-[1fr_120px_80px_100px_80px_60px] gap-3 px-5 py-2.5 bg-slate-50 text-[12px] font-semibold text-slate-500 uppercase tracking-wider border-b">
            <div>Business</div><div>Email</div><div>Score</div><div>Temperature</div><div>Reviews</div><div></div>
          </div>
          {filtered.length === 0 && <div className="py-16 text-center text-sm text-slate-400">{contacts.length === 0 ? 'No SCOUT leads yet. Run a search to find leads!' : 'No leads match your filters'}</div>}
          {filtered.map(c => (
            <div key={c.id} className="grid grid-cols-[1fr_120px_80px_100px_80px_60px] gap-3 px-5 py-3 items-center border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/marketing/contacts/${c.id}`)}>
              <div><p className="text-sm font-medium text-slate-800">{c.company || c.first_name || c.email}</p><p className="text-[13px] text-slate-400">{c.city}{c.state ? `, ${c.state}` : ''}</p></div>
              <span className="text-sm text-slate-500 truncate">{c.email}</span>
              <span className="text-sm font-bold px-2 py-0.5 rounded-full text-center" style={{ background: scoreColor(c.scout_score || 50) + '20', color: scoreColor(c.scout_score || 50) }}>{c.scout_score || '—'}</span>
              <div className="flex flex-wrap gap-0.5">{(c.tags || []).filter(t => t.includes('Lead')).slice(0, 1).map(t => <span key={t} className="text-[12px] bg-red-50 text-brand-600 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
              <span className="text-sm text-slate-500">⭐ {c.scout_review_rating || '—'}</span>
              <button onClick={e => { e.stopPropagation(); navigate(`/marketing/contacts/${c.id}`) }} className="text-slate-400 hover:text-brand-500"><ExternalLink size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </ScoutLayout>
  )
}
