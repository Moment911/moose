"use client";
import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { supabase, sendEmailSummary } from '../lib/supabase'
import toast from 'react-hot-toast'

const PROJECT_TYPES = [
  { key: 'website', label: 'Website Redesign', emoji: '\ud83c\udf10', desc: 'Multi-page website review' },
  { key: 'mobile', label: 'Mobile App', emoji: '\ud83d\udcf1', desc: 'Mobile screens & flows' },
  { key: 'brand', label: 'Brand Identity', emoji: '\ud83c\udfa8', desc: 'Logo, colors, typography' },
  { key: 'email', label: 'Email Campaign', emoji: '\ud83d\udce7', desc: 'Email templates & layouts' },
  { key: 'print', label: 'Print / Collateral', emoji: '\ud83d\udcc4', desc: 'Brochures, flyers, cards' },
  { key: 'social', label: 'Social Media', emoji: '\ud83c\udfac', desc: 'Posts, stories, ads' },
  { key: 'presentation', label: 'Presentation', emoji: '\ud83d\udcca', desc: 'Slide deck review' },
  { key: 'other', label: 'Other', emoji: '\ud83d\udcc1', desc: 'Custom project' },
]

export default function NewProjectModal({ clientId, clientName, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('website')
  const [clientEmail, setClientEmail] = useState('')
  const [maxRounds, setMaxRounds] = useState(2)
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Enter a project name'); return }
    setCreating(true)
    try {
      const { data, error } = await supabase.from('projects').insert({
        client_id: clientId,
        name: name.trim(),
        project_type: type,
        client_email: clientEmail.trim() || null,
        max_rounds: maxRounds,
      }).select().single()
      if (error) throw error

      // Send invite email if client email provided
      if (clientEmail.trim() && data) {
        try {
          await sendEmailSummary({
            type: 'client_invite',
            project_name: data.name,
            project_type: PROJECT_TYPES.find(t => t.key === type)?.label || type,
            client_name: clientName,
            client_email: clientEmail.trim(),
            review_url: `${window.location.origin}/project/${data.id}`,
            max_rounds: maxRounds,
          })
          toast.success('Invite email sent!')
        } catch (e) {
          // Email send is best-effort, don't block project creation
        }
      }

      toast.success('Project created!')
      onCreated(data)
    } catch (e) {
      toast.error('Failed to create project')
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Project name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Project Name</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              placeholder="e.g. Homepage Redesign" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          {/* Project type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Project Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PROJECT_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    type === t.key
                      ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <span className="text-lg">{t.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.label}</p>
                    <p className="text-[13px] text-gray-500">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Client email */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Client Email (optional)</label>
            <div className="flex gap-2">
              <input className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                type="email" placeholder="client@company.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
              {clientEmail && <div className="flex items-center text-sm text-gray-400"><Send size={11} className="mr-1" /> Will send invite</div>}
            </div>
          </div>

          {/* Max rounds */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Revision Rounds</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setMaxRounds(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                    maxRounds === n ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{n}</button>
              ))}
            </div>
            <p className="text-[13px] text-gray-400 mt-1">Number of feedback rounds included for this client</p>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
          <button onClick={handleSubmit} disabled={creating || !name.trim()}
            className="bg-brand-500 text-white text-sm font-medium px-5 py-2 rounded-xl hover:bg-brand-600 disabled:opacity-40 transition-colors">
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
