import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Users, Edit2, X, ChevronLeft, Check } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function ListsPage() {
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editingList, setEditingList] = useState(null)
  const [showMembers, setShowMembers] = useState(null)
  const [members, setMembers] = useState([])
  const [addContactSearch, setAddContactSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('contact_lists').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('status', 'subscribed').order('email')
    ])
    setLists(l || [])
    setContacts(c || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    const { error } = await supabase.from('contact_lists').insert({ name: form.name.trim(), description: form.description.trim() })
    if (error) { toast.error('Failed to create list'); return }
    toast.success('List created')
    setShowCreate(false); setForm({ name: '', description: '' }); loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this list? Contacts will not be deleted.')) return
    await supabase.from('contact_list_members').delete().eq('list_id', id)
    await supabase.from('contact_lists').delete().eq('id', id)
    toast.success('List deleted'); loadAll()
    if (showMembers === id) setShowMembers(null)
  }

  async function openMembers(listId) {
    setShowMembers(listId)
    const { data } = await supabase.from('contact_list_members').select('contact_id').eq('list_id', listId)
    setMembers((data || []).map(m => m.contact_id))
  }

  async function toggleMember(contactId) {
    if (!showMembers) return
    if (members.includes(contactId)) {
      await supabase.from('contact_list_members').delete().eq('list_id', showMembers).eq('contact_id', contactId)
      setMembers(prev => prev.filter(id => id !== contactId))
      toast.success('Removed from list')
    } else {
      await supabase.from('contact_list_members').insert({ list_id: showMembers, contact_id: contactId })
      setMembers(prev => [...prev, contactId])
      toast.success('Added to list')
    }
  }

  const filtered = lists.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
  const memberList = showMembers ? lists.find(l => l.id === showMembers) : null
  const filteredContacts = contacts.filter(c =>
    !addContactSearch || c.email.toLowerCase().includes(addContactSearch.toLowerCase()) ||
    (c.first_name || '').toLowerCase().includes(addContactSearch.toLowerCase())
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing')} className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Contact Lists</h1>
              <p className="text-sm text-gray-500 mt-0.5">{lists.length} lists</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus size={13} /> New List</button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-sm mb-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <Search size={14} className="text-gray-400" />
            <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search lists..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(list => (
              <div key={list.id} className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><Users size={16} className="text-purple-500" /></div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{list.name}</h3>
                      {list.description && <p className="text-xs text-gray-400">{list.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(list.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
                <p className="text-xs text-gray-400 mb-3">Created {list.created_at ? format(new Date(list.created_at), 'MMM d, yyyy') : 'recently'}</p>
                <button onClick={() => openMembers(list.id)} className="w-full btn-secondary text-xs justify-center"><Users size={12} /> Manage Members</button>
              </div>
            ))}
            {filtered.length === 0 && <div className="col-span-3 py-16 text-center text-sm text-gray-400">No lists found. Create your first list!</div>}
          </div>
        </div>

        {/* Create list modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">New Contact List</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
                <div><label className="text-xs text-gray-500 block mb-1">List Name *</label><input className="input text-sm" placeholder="VIP Clients" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Description</label><input className="input text-sm" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </form>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
                <button onClick={handleCreate} className="btn-primary text-sm">Create List</button>
              </div>
            </div>
          </div>
        )}

        {/* Members modal */}
        {showMembers && memberList && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMembers(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="font-semibold text-gray-900">{memberList.name}</h2>
                  <p className="text-xs text-gray-400">{members.length} members</p>
                </div>
                <button onClick={() => setShowMembers(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5">
                  <Search size={12} className="text-gray-400" />
                  <input className="text-xs bg-transparent outline-none flex-1" placeholder="Search contacts..." value={addContactSearch} onChange={e => setAddContactSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {filteredContacts.map(c => {
                  const isMember = members.includes(c.id)
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50" onClick={() => toggleMember(c.id)}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isMember ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                        {isMember && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{c.first_name ? `${c.first_name} ${c.last_name || ''}` : c.email}</p>
                        <p className="text-xs text-gray-400 truncate">{c.email}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
