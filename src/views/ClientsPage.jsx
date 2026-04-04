"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit2, MoreHorizontal, Folder, Mail, Phone, Globe, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { getClients, createClient_, updateClient, deleteClient, getProjects } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export default function ClientsPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState({})
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '' })
  const [menuOpen, setMenuOpen] = useState(null)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data } = await getClients(agencyId)
    setClients(data || [])
    const projMap = {}
    for (const c of (data || [])) {
      const { data: p } = await getProjects(c.id)
      projMap[c.id] = p || []
    }
    setProjects(projMap)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    const { data, error } = await createClient_(form.name.trim(), form.email.trim(), agencyId)
    if (error) { toast.error(error.message); return }
    toast.success('Client created')
    setForm({ name: '', email: '', phone: '', website: '' })
    setShowAdd(false)
    loadClients()
  }

  async function handleUpdate(id) {
    const { error } = await updateClient(id, {
      name: form.name.trim(),
      email: form.email.trim(),
    })
    if (error) { toast.error(error.message); return }
    toast.success('Client updated')
    setEditingId(null)
    setForm({ name: '', email: '', phone: '', website: '' })
    loadClients()
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}" and all their projects?`)) return
    const { error } = await deleteClient(id)
    if (error) { toast.error(error.message); return }
    toast.success('Client deleted')
    loadClients()
  }

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
              <p className="text-sm text-gray-500 mt-1">{clients.length} total clients</p>
            </div>
            <button onClick={() => { setShowAdd(true); setForm({ name: '', email: '', phone: '', website: '' }) }}
              className="btn-primary">
              <Plus size={16} /> Add Client
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search clients..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9" />
          </div>

          {/* Add/Edit Modal */}
          {(showAdd || editingId) && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowAdd(false); setEditingId(null) }}>
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{editingId ? 'Edit Client' : 'New Client'}</h2>
                  <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId) } : handleAdd}>
                  <div className="space-y-3">
                    <input type="text" placeholder="Client name *" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="input" autoFocus />
                    <input type="email" placeholder="Email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="input" />
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => { setShowAdd(false); setEditingId(null) }}
                      className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" className="btn-primary flex-1">
                      {editingId ? 'Save Changes' : 'Create Client'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(client => (
              <div key={client.id}
                className="card p-5 hover:shadow-md transition-shadow cursor-pointer group relative"
                onClick={() => navigate(`/clients/${client.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-semibold text-sm">
                      {client.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{client.name}</h3>
                      {client.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail size={11} /> {client.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === client.id ? null : client.id) }}
                      className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={16} className="text-gray-400" />
                    </button>
                    {menuOpen === client.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 w-36"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => {
                          setEditingId(client.id)
                          setForm({ name: client.name || '', email: client.email || '', phone: '', website: '' })
                          setMenuOpen(null)
                        }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                          <Edit2 size={13} /> Edit
                        </button>
                        <button onClick={() => { handleDelete(client.id, client.name); setMenuOpen(null) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Folder size={12} /> {(projects[client.id] || []).length} projects
                  </span>
                  {client.created_at && (
                    <span>Added {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              {search ? 'No clients match your search' : 'No clients yet — add your first one above'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
