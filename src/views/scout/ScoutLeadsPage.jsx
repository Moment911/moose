"use client";
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Search, Star, Mail, Phone, Trash2, RefreshCw, Filter, ExternalLink, Radio, CheckSquare, Square, Loader2 } from 'lucide-react'
import ScoutLayout from './ScoutLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

function scoreColor(s) { return s >= 75 ? '#22c55e' : s >= 50 ? '#00C2CB' : s >= 30 ? '#eab308' : '#3b82f6' }

export default function ScoutLeadsPage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [filterTemp, setFilterTemp] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [queueing, setQueueing] = useState(false)

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

  const selectableIds = useMemo(() => filtered.filter(c => c.phone).map(c => c.id), [filtered])
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => {
      if (allSelected) return new Set()
      return new Set(selectableIds)
    })
  }

  async function bulkQueueForAICall() {
    if (!agencyId) { toast.error('No agency context'); return }
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setQueueing(true)
    const rows = contacts.filter(c => selected.has(c.id) && c.phone)
    let ok = 0, fail = 0
    for (const c of rows) {
      try {
        const res = await fetch('/api/scout/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'queue_call',
            agency_id: agencyId,
            company_name: c.company || c.first_name || 'Unknown',
            contact_name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
            contact_phone: c.phone,
            industry: c.scout_industry || null,
            sic_code: c.scout_sic_code || null,
            pitch_angle: c.scout_gap_summary || null,
            biggest_gap: c.scout_biggest_gap || null,
            priority: (c.tags || []).some(t => /hot/i.test(t)) ? 1 : 3,
            trigger_mode: 'bulk',
          }),
        })
        if (res.ok) ok += 1; else fail += 1
      } catch { fail += 1 }
    }
    setQueueing(false)
    setSelected(new Set())
    if (fail === 0) toast.success(`${ok} added to Scout voice queue`)
    else if (ok === 0) toast.error(`Queue failed for all ${fail} leads`)
    else toast.success(`${ok} queued, ${fail} failed`)
    if (ok > 0) setTimeout(() => navigate('/scout/voice'), 600)
  }

  const stats = {
    total: contacts.length,
    hot: contacts.filter(c => (c.tags || []).some(t => t.includes('Hot'))).length,
    warm: contacts.filter(c => (c.tags || []).some(t => t.includes('Warm'))).length,
    contacted: contacts.filter(c => c.outreach_status === 'email_sent').length,
  }

  return (
    <ScoutLayout>
      <div className="page-shell h-14 bg-white border-b border-slate-200 px-6 flex items-center gap-3 flex-shrink-0">
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
            { label: 'Warm Leads', value: stats.warm, color: '#00C2CB' },
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
          <button onClick={() => navigate('/scout')} className="btn-primary text-sm" style={{ background: '#00C2CB' }}><Target size={12} /> New Search</button>
        </div>

        {/* Bulk action bar — only visible when items are selected */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl" style={{ background: '#0F172A', color: '#fff' }}>
            <div className="text-sm font-semibold">
              {selected.size} selected
              <span className="text-slate-400 text-[13px] font-normal ml-2">
                ({Array.from(selected).filter(id => contacts.find(c => c.id === id)?.phone).length} with phone)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(new Set())} className="text-sm text-slate-300 hover:text-white px-3 py-1.5">Clear</button>
              <button
                onClick={bulkQueueForAICall}
                disabled={queueing}
                className="text-sm font-bold px-4 py-1.5 rounded-lg inline-flex items-center gap-2"
                style={{ background: '#E6007E', color: '#fff', opacity: queueing ? 0.6 : 1, cursor: queueing ? 'wait' : 'pointer' }}
              >
                {queueing ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
                Queue for AI call
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ overflowX: 'auto' }}>
          <div className="grid grid-cols-[32px_1fr_120px_80px_100px_80px_60px] gap-3 px-5 py-2.5 bg-slate-50 text-[13px] font-semibold text-slate-500 uppercase tracking-wider border-b">
            <button onClick={toggleAll} className="text-slate-400 hover:text-slate-700" title={allSelected ? 'Deselect all' : 'Select all with phone'}>
              {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            </button>
            <div>Business</div><div>Email</div><div>Score</div><div>Temperature</div><div>Reviews</div><div></div>
          </div>
          {filtered.length === 0 && <div className="py-16 text-center text-sm text-slate-400">{contacts.length === 0 ? 'No SCOUT leads yet. Run a search to find leads!' : 'No leads match your filters'}</div>}
          {filtered.map(c => {
            const isSelected = selected.has(c.id)
            const hasPhone = !!c.phone
            return (
              <div
                key={c.id}
                className="grid grid-cols-[32px_1fr_120px_80px_100px_80px_60px] gap-3 px-5 py-3 items-center border-b border-slate-50 hover:bg-slate-50"
                style={{ background: isSelected ? '#fff0f7' : undefined }}
              >
                <button
                  onClick={() => hasPhone && toggle(c.id)}
                  disabled={!hasPhone}
                  title={hasPhone ? (isSelected ? 'Deselect' : 'Select for bulk queue') : 'No phone — cannot queue for AI call'}
                  className={hasPhone ? 'text-slate-400 hover:text-brand-500' : 'text-slate-200 cursor-not-allowed'}
                >
                  {isSelected ? <CheckSquare size={15} className="text-brand-500" /> : <Square size={15} />}
                </button>
                <div className="cursor-pointer" onClick={() => navigate(`/marketing/contacts/${c.id}`)}>
                  <p className="text-sm font-medium text-slate-800">{c.company || c.first_name || c.email}</p>
                  <p className="text-[13px] text-slate-400">{c.city}{c.state ? `, ${c.state}` : ''}{c.phone ? ` · ${c.phone}` : ''}</p>
                </div>
                <span className="text-sm text-slate-500 truncate">{c.email}</span>
                <span className="text-sm font-bold px-2 py-0.5 rounded-full text-center" style={{ background: scoreColor(c.scout_score || 50) + '20', color: scoreColor(c.scout_score || 50) }}>{c.scout_score || '—'}</span>
                <div className="flex flex-wrap gap-0.5">{(c.tags || []).filter(t => t.includes('Lead')).slice(0, 1).map(t => <span key={t} className="text-[13px] bg-red-50 text-brand-600 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
                <span className="text-sm text-slate-500">⭐ {c.scout_review_rating || '—'}</span>
                <button onClick={e => { e.stopPropagation(); navigate(`/marketing/contacts/${c.id}`) }} className="text-slate-400 hover:text-brand-500"><ExternalLink size={13} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </ScoutLayout>
  )
}
