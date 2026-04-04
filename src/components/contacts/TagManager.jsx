"use client";
import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Tag, X, Merge, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const TAG_COLORS = [
  '#ea2729', '#ec4899', '#5bc6d0', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#6b7280', '#1a1a1a',
  '#fca5a5', '#f9a8d4', '#fdba74', '#fde047', '#86efac', '#99f6e4', '#93c5fd', '#c4b5fd', '#d1d5db', '#f5f5f5',
]

export default function TagManager({ open, contacts }) {
  const [tags, setTags] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', color: TAG_COLORS[0], description: '' })
  const [editing, setEditing] = useState(null)

  useEffect(() => { if (open) loadTags() }, [open])

  async function loadTags() {
    // Build tag usage from contacts' tags arrays
    const tagMap = {}
    ;(contacts || []).forEach(c => {
      ;(c.tags || []).forEach(t => {
        if (!tagMap[t]) tagMap[t] = { name: t, count: 0, color: TAG_COLORS[Math.abs(hashStr(t)) % TAG_COLORS.length] }
        tagMap[t].count++
      })
    })
    // Also try loading from contact_tags table
    try {
      const { data } = await supabase.from('contact_tags').select('*').order('name')
      if (data) {
        data.forEach(t => {
          if (tagMap[t.name]) { tagMap[t.name].id = t.id; tagMap[t.name].color = t.color || tagMap[t.name].color; tagMap[t.name].description = t.description }
          else tagMap[t.name] = { id: t.id, name: t.name, count: 0, color: t.color || TAG_COLORS[0], description: t.description }
        })
      }
    } catch {}
    setTags(Object.values(tagMap).sort((a, b) => b.count - a.count))
  }

  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h }

  async function handleCreate(e) {
    e?.preventDefault()
    if (!form.name.trim()) { toast.error('Tag name required'); return }
    try {
      await supabase.from('contact_tags').upsert({ name: form.name.trim(), color: form.color, description: form.description.trim() }, { onConflict: 'name' })
      toast.success('Tag created'); setShowCreate(false); setForm({ name: '', color: TAG_COLORS[0], description: '' }); loadTags()
    } catch (e) {
      // Table may not exist yet, just add locally
      toast.success('Tag saved locally')
      setTags(prev => [...prev, { name: form.name.trim(), color: form.color, count: 0, description: form.description.trim() }])
      setShowCreate(false); setForm({ name: '', color: TAG_COLORS[0], description: '' })
    }
  }

  async function handleDelete(tag) {
    if (!confirm(`Remove tag "${tag.name}" from ${tag.count} contacts?`)) return
    // Remove from all contacts
    const updates = (contacts || []).filter(c => (c.tags || []).includes(tag.name))
    for (const c of updates) {
      await supabase.from('contacts').update({ tags: (c.tags || []).filter(t => t !== tag.name) }).eq('id', c.id)
    }
    if (tag.id) await supabase.from('contact_tags').delete().eq('id', tag.id).catch(() => {})
    toast.success('Tag deleted'); loadTags()
  }

  async function handleRename(tag, newName) {
    if (!newName.trim() || newName === tag.name) { setEditing(null); return }
    const updates = (contacts || []).filter(c => (c.tags || []).includes(tag.name))
    for (const c of updates) {
      const newTags = (c.tags || []).map(t => t === tag.name ? newName.trim() : t)
      await supabase.from('contacts').update({ tags: newTags }).eq('id', c.id)
    }
    if (tag.id) await supabase.from('contact_tags').update({ name: newName.trim() }).eq('id', tag.id).catch(() => {})
    toast.success('Tag renamed'); setEditing(null); loadTags()
  }

  const filtered = tags.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  if (!open) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-xs" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Search size={14} className="text-gray-400" />
          <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search tags..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus size={13} /> New Tag</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="grid grid-cols-[auto_1fr_80px_60px] gap-3 px-5 py-2.5 bg-gray-50/50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
          <div></div><div>Tag</div><div>Contacts</div><div></div>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No tags found</div>}
        {filtered.map(tag => (
          <div key={tag.name} className="grid grid-cols-[auto_1fr_80px_60px] gap-3 px-5 py-3 items-center border-b border-gray-50 hover:bg-gray-50/50 group">
            <div className="w-4 h-4 rounded-full border border-gray-200" style={{ background: tag.color }} />
            <div>
              {editing === tag.name ? (
                <input className="text-sm border border-gray-200 rounded px-2 py-0.5" defaultValue={tag.name} autoFocus
                  onBlur={e => handleRename(tag, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(tag, e.target.value); if (e.key === 'Escape') setEditing(null) }} />
              ) : (
                <span className="text-sm font-medium text-gray-900">{tag.name}</span>
              )}
              {tag.description && <p className="text-[10px] text-gray-400">{tag.description}</p>}
            </div>
            <span className="text-sm text-gray-500">{tag.count}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(tag.name)} className="text-gray-400 hover:text-gray-700"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(tag)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create tag modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">New Tag</h3></div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
              <div><label className="text-xs text-gray-500 block mb-1">Name *</label><input className="input text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Description</label><input className="input text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </form>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
              <button onClick={handleCreate} className="btn-primary text-sm">Create Tag</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable tag autocomplete input
export function TagAutocomplete({ value = [], onChange, contacts, placeholder }) {
  const [input, setInput] = useState('')
  const [showDrop, setShowDrop] = useState(false)

  // Derive all known tags from contacts
  const allTags = [...new Set((contacts || []).flatMap(c => c.tags || []))]
  const suggestions = allTags.filter(t => !value.includes(t) && (!input || t.toLowerCase().includes(input.toLowerCase()))).slice(0, 8)

  function addTag(tag) {
    if (!value.includes(tag)) onChange([...value, tag])
    setInput(''); setShowDrop(false)
  }

  function removeTag(tag) { onChange(value.filter(t => t !== tag)) }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full">
            {t}<button onClick={() => removeTag(t)} className="hover:text-brand-900"><X size={9} /></button>
          </span>
        ))}
      </div>
      <input className="input text-sm w-full" placeholder={placeholder || 'Add tag...'} value={input}
        onChange={e => { setInput(e.target.value); setShowDrop(true) }}
        onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 200)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) { e.preventDefault(); addTag(input.trim()) }
        }} />
      {showDrop && (suggestions.length > 0 || input.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map(t => (
            <button key={t} onMouseDown={() => addTag(t)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Tag size={11} className="text-gray-400" />{t}
            </button>
          ))}
          {input.trim() && !allTags.includes(input.trim()) && (
            <button onMouseDown={() => addTag(input.trim())} className="w-full text-left px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 flex items-center gap-2">
              <Plus size={11} /> Create "{input.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
