"use client";
import { useState, useEffect } from 'react'
import { DollarSign, Plus, Trash2, Check, Download, Search, X, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getClients } from '../lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function RevenuePage() {
  const { agencyId } = useAuth()
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ client_id: '', project_id: '', type: 'project', description: '', amount: '', invoice_number: '', due_date: '', status: 'pending', notes: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: r } = await supabase.from('revenue_records').select('*, clients(name), projects(name)').order('created_at', { ascending: false })
    setRecords(r || [])
    const { data: c } = await getClients(agencyId); setClients(c || [])
    const projs = []
    for (const cl of (c || [])) { const { data } = await supabase.from('projects').select('*').eq('client_id', cl.id); projs.push(...(data || []).map(p => ({ ...p, clientName: cl.name }))) }
    setProjects(projs)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.client_id || !form.amount) { toast.error('Client and amount required'); return }
    await supabase.from('revenue_records').insert({ ...form, amount: parseFloat(form.amount), client_id: form.client_id, project_id: form.project_id || null })
    toast.success('Revenue record added'); setShowAdd(false); setForm({ client_id: '', project_id: '', type: 'project', description: '', amount: '', invoice_number: '', due_date: '', status: 'pending', notes: '' }); loadAll()
  }

  async function markPaid(id) {
    await supabase.from('revenue_records').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    toast.success('Marked as paid'); loadAll()
  }

  async function deleteRecord(id) {
    if (!confirm('Delete this record?')) return
    await supabase.from('revenue_records').delete().eq('id', id); loadAll()
  }

  function exportCSV() {
    const headers = 'Client,Project,Type,Amount,Status,Invoice,Due Date,Paid Date,Description\n'
    const rows = filtered.map(r => `"${r.clients?.name || ''}","${r.projects?.name || ''}","${r.type}","${r.amount}","${r.status}","${r.invoice_number || ''}","${r.due_date || ''}","${r.paid_date || ''}","${r.description || ''}"`).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'revenue.csv'; a.click()
    toast.success('Exported!')
  }

  const filtered = records.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search && !(r.clients?.name || '').toLowerCase().includes(search.toLowerCase()) && !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalRevenue = records.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const totalPaid = records.filter(r => r.status === 'paid').reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const totalPending = records.filter(r => r.status === 'pending').reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const thisMonth = records.filter(r => r.created_at && new Date(r.created_at).getMonth() === new Date().getMonth() && new Date(r.created_at).getFullYear() === new Date().getFullYear()).reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        <div style={{ background: '#231f20' }} className="px-4 md:px-8 py-4 md:py-6">
          <h1 className="text-2xl font-bold text-white">Revenue</h1>
          <p className="text-sm text-gray-700 mt-1">Track income across all clients and projects</p>
        </div>

        <div className="px-4 md:px-8 py-4 md:py-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign },
              { label: 'This Month', value: `$${thisMonth.toLocaleString()}`, icon: TrendingUp },
              { label: 'Outstanding', value: `$${totalPending.toLocaleString()}`, icon: Clock, red: totalPending > 0 },
              { label: 'Collected', value: `$${totalPaid.toLocaleString()}`, icon: Check },
            ].map(s => { const I = s.icon; return (
              <div key={s.label} className="card p-5">
                <I size={18} strokeWidth={1.5} className={s.red ? 'text-brand-500' : 'text-brand-500'} />
                <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
                <p className="text-sm text-gray-700 mt-1">{s.label}</p>
              </div>
            )})}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
              <Search size={14} strokeWidth={1.5} className="text-brand-500" />
              <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <div className="ml-auto flex gap-2">
              <button onClick={exportCSV} className="btn-secondary text-sm"><Download size={13} strokeWidth={1.5} /> Export</button>
              <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm"><Plus size={13} /> Add Record</button>
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="card p-5 mb-4">
              <form onSubmit={handleAdd} className="grid grid-cols-4 gap-3 items-end">
                <div><label className="text-sm text-gray-700 block mb-1">Client *</label>
                  <select className="input text-sm" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, project_id: '' }))}>
                    <option value="">Select...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div><label className="text-sm text-gray-700 block mb-1">Project</label>
                  <select className="input text-sm" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} disabled={!form.client_id}>
                    <option value="">None</option>{projects.filter(p => p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div><label className="text-sm text-gray-700 block mb-1">Type</label>
                  <select className="input text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="project">Project Fee</option><option value="hourly">Hourly</option><option value="retainer">Retainer</option><option value="additional_round">Additional Round</option><option value="other">Other</option>
                  </select></div>
                <div><label className="text-sm text-gray-700 block mb-1">Amount ($) *</label>
                  <input className="input text-sm" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="text-sm text-gray-700 block mb-1">Description</label>
                  <input className="input text-sm" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><label className="text-sm text-gray-700 block mb-1">Invoice #</label>
                  <input className="input text-sm" placeholder="INV-001" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
                <div><label className="text-sm text-gray-700 block mb-1">Due Date</label>
                  <input className="input text-sm" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-sm h-[38px]">Save</button>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm h-[38px]">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-[1fr_100px_80px_90px_80px_80px_60px] gap-3 px-4 py-2.5 bg-gray-50 text-[13px] font-semibold text-gray-700 uppercase tracking-wider border-b" style={{ minWidth: 640 }}>
              <div>Client / Description</div><div>Amount</div><div>Type</div><div>Invoice</div><div>Due</div><div>Status</div><div></div>
            </div>
            {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-700">No revenue records</div>}
            {filtered.map(r => (
              <div key={r.id} className="grid grid-cols-[1fr_100px_80px_90px_80px_80px_60px] gap-3 px-4 py-3 items-center border-b border-gray-100 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.clients?.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-700">{r.description || r.projects?.name || ''}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">${parseFloat(r.amount || 0).toLocaleString()}</span>
                <span className="text-sm text-gray-700 capitalize">{r.type?.replace('_', ' ')}</span>
                <span className="text-sm text-gray-700">{r.invoice_number || '—'}</span>
                <span className="text-sm text-gray-700">{r.due_date ? format(new Date(r.due_date), 'MMM d') : '—'}</span>
                <div>
                  {r.status === 'paid' ? (
                    <span className="text-[13px] px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">Paid</span>
                  ) : (
                    <button onClick={() => markPaid(r.id)} className="text-[13px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 hover:bg-green-50 hover:text-green-700 transition-colors cursor-pointer">Pending</button>
                  )}
                </div>
                <button onClick={() => deleteRecord(r.id)} className="text-gray-600 hover:text-brand-500"><Trash2 size={12} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-700 mt-3">{filtered.length} records</p>
        </div>
      </main>
    </div>
  )
}
