"use client"
import { useState, useMemo } from 'react'
import { X, Search, ArrowRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, logActivity } from '../../lib/supabase'

/**
 * Move a proof project to a different client. This is a real
 * reassignment — we update projects.client_id server-side and log
 * the change to activity so downstream filters (CRM views, client
 * dashboards, file lists) catch up on the next refresh.
 *
 * Props:
 *   project       — the current project row (must include id + client_id)
 *   clients       — the full clients list from ClientContext
 *   currentClient — the currently-linked client row (for "Currently: X")
 *   onClose       — close without changes
 *   onReassigned  — (newClient) => void, called on success so the parent can refresh
 */
export default function ReassignClientModal({ project, clients, currentClient, onClose, onReassigned }) {
  const [query, setQuery] = useState('')
  const [targetId, setTargetId] = useState(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? clients.filter(c => (c.name || '').toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q))
      : clients
    // Put the current client last — no one wants to "reassign" to the
    // client they're already on.
    return list.slice().sort((a, b) => {
      if (a.id === currentClient?.id) return 1
      if (b.id === currentClient?.id) return -1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [clients, query, currentClient?.id])

  async function handleReassign() {
    if (!targetId || targetId === currentClient?.id || saving) return
    const next = clients.find(c => c.id === targetId)
    if (!next) return

    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({ client_id: targetId })
      .eq('id', project.id)

    if (error) {
      toast.error('Could not reassign: ' + (error.message || 'unknown error'))
      setSaving(false)
      return
    }

    try {
      await logActivity({
        project_id: project.id,
        action: 'client_reassigned',
        detail: `Moved from ${currentClient?.name || 'unassigned'} → ${next.name}`,
        actor: 'Admin',
      })
    } catch { /* non-fatal */ }

    toast.success(`Moved to ${next.name}`)
    setSaving(false)
    onReassigned?.(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card w-full max-w-md shadow-2xl"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Reassign this proof</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Currently linked to <span className="font-semibold text-gray-700">{currentClient?.name || '(unassigned)'}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              className="input text-sm pl-8"
              placeholder="Search clients by name or industry…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 pb-2 flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              No clients match "{query}".
            </div>
          )}
          <div className="flex flex-col gap-1">
            {filtered.map(c => {
              const isCurrent = c.id === currentClient?.id
              const selected  = c.id === targetId
              return (
                <button
                  key={c.id}
                  disabled={isCurrent}
                  onClick={() => setTargetId(c.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all flex items-center gap-3 ${
                    selected ? 'border-brand-500 bg-brand-50' :
                    isCurrent ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' :
                    'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || '(no name)'}</div>
                    {c.industry && <div className="text-[12px] text-gray-500 truncate">{c.industry}</div>}
                  </div>
                  {isCurrent && <span className="text-[11px] font-semibold text-gray-500">Current</span>}
                  {selected && !isCurrent && <Check size={14} className="text-brand-600" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleReassign}
            disabled={!targetId || targetId === currentClient?.id || saving}
            className="btn-primary"
          >
            {saving ? 'Moving…' : <>Move proof <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
