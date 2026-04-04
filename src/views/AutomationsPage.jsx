"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft, Zap, Play, Pause, Trash2, Mail, Clock, Users, ArrowRight, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const TRIGGER_TYPES = [
  { key: 'new_contact', label: 'New Contact Added', icon: Users, desc: 'When a new contact is added' },
  { key: 'form_submit', label: 'Form Submitted', icon: Mail, desc: 'When a review form is submitted' },
  { key: 'project_created', label: 'Project Created', icon: Zap, desc: 'When a new project is created' },
  { key: 'schedule', label: 'Scheduled', icon: Clock, desc: 'Run at a specific time' },
]

const ACTION_TYPES = [
  { key: 'send_email', label: 'Send Email', desc: 'Send a campaign email' },
  { key: 'add_to_list', label: 'Add to List', desc: 'Add contact to a list' },
  { key: 'wait', label: 'Wait', desc: 'Delay before next action' },
  { key: 'notify', label: 'Notify Team', desc: 'Send internal notification' },
]

export default function AutomationsPage() {
  const navigate = useNavigate()
  const [automations, setAutomations] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', trigger: '', actions: [] })

  useEffect(() => { loadAutomations() }, [])

  async function loadAutomations() {
    try {
      const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
      setAutomations(data || [])
    } catch { setAutomations([]) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.trigger) { toast.error('Name and trigger required'); return }
    try {
      const { error } = await supabase.from('automations').insert({
        name: form.name.trim(), trigger_type: form.trigger, actions: form.actions, status: 'paused'
      })
      if (error) throw error
      toast.success('Automation created'); setShowCreate(false); setForm({ name: '', trigger: '', actions: [] }); loadAutomations()
    } catch (e) {
      toast.error('Failed to create automation')
    }
  }

  async function toggleStatus(auto) {
    const newStatus = auto.status === 'active' ? 'paused' : 'active'
    try {
      await supabase.from('automations').update({ status: newStatus }).eq('id', auto.id)
      toast.success(newStatus === 'active' ? 'Automation activated' : 'Automation paused')
      loadAutomations()
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this automation?')) return
    try {
      await supabase.from('automations').delete().eq('id', id)
      toast.success('Deleted'); loadAutomations()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
              <p className="text-sm text-gray-700 mt-0.5">Set up email workflows triggered by events</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus size={13} /> New Automation</button>
          </div>

          {automations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Zap size={40} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-700 mb-1">No automations yet</h3>
              <p className="text-sm text-gray-700 mb-4">Create your first automation to send emails automatically when events occur.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus size={13} /> Create Automation</button>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map(auto => (
                <div key={auto.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${auto.status === 'active' ? 'bg-green-50' : 'bg-gray-100'}`}>
                    <Zap size={18} className={auto.status === 'active' ? 'text-green-500' : 'text-gray-700'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{auto.name}</h3>
                    <p className="text-sm text-gray-700">Trigger: {TRIGGER_TYPES.find(t => t.key === auto.trigger_type)?.label || auto.trigger_type} &middot; {(auto.actions || []).length} actions</p>
                  </div>
                  <span className={`text-[13px] px-2.5 py-1 rounded-full font-medium ${auto.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{auto.status}</span>
                  <button onClick={() => toggleStatus(auto)} className={`p-2 rounded-lg transition-colors ${auto.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`} title={auto.status === 'active' ? 'Pause' : 'Activate'}>
                    {auto.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => handleDelete(auto.id)} className="text-gray-600 hover:text-red-500 p-2"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">New Automation</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-700 hover:text-gray-600"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
                <div><label className="text-sm text-gray-700 block mb-1">Automation Name *</label><input className="input text-sm" placeholder="Welcome new contacts" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
                <div>
                  <label className="text-sm text-gray-700 block mb-2">Trigger *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRIGGER_TYPES.map(t => {
                      const I = t.icon
                      return (
                        <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, trigger: t.key }))}
                          className={`text-left p-3 rounded-xl border transition-all ${form.trigger === t.key ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <I size={16} className={form.trigger === t.key ? 'text-brand-500 mb-1' : 'text-gray-700 mb-1'} />
                          <p className="text-sm font-medium text-gray-800">{t.label}</p>
                          <p className="text-[13px] text-gray-700">{t.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-700 block mb-2">Actions</label>
                  {(form.actions || []).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700 flex-1">{ACTION_TYPES.find(t => t.key === a)?.label || a}</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))} className="text-gray-600 hover:text-red-500"><X size={12} /></button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5">
                    {ACTION_TYPES.filter(a => !(form.actions || []).includes(a.key)).map(a => (
                      <button key={a.key} type="button" onClick={() => setForm(f => ({ ...f, actions: [...(f.actions || []), a.key] }))}
                        className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">{a.label}</button>
                    ))}
                  </div>
                </div>
              </form>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="text-sm text-gray-700 px-3 py-1.5">Cancel</button>
                <button onClick={handleCreate} className="btn-primary text-sm">Create Automation</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
