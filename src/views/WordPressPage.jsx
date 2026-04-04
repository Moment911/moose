"use client"
import { useState, useEffect } from 'react'
import { Plus, Search, Globe, Wifi, WifiOff, Trash2, Copy, MoreHorizontal, RefreshCw, X, ExternalLink } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export default function WordPressPage() {
  const { agencyId } = useAuth()
  const [sites, setSites] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)
  const [form, setForm] = useState({ site_name: '', site_url: '', client_id: '' })
  const [clients, setClients] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('moose_wp_sites').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').eq('agency_id', agencyId || '00000000-0000-0000-0000-000000000099').order('name'),
    ])
    setSites(s || [])
    setClients(c || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.site_name.trim() || !form.site_url.trim()) { toast.error('Name and URL required'); return }
    const payload = {
      site_name: form.site_name.trim(),
      site_url: form.site_url.trim().replace(/\/+$/, ''),
    }
    if (form.client_id) payload.client_id = form.client_id
    const { error } = await supabase.from('moose_wp_sites').insert(payload)
    if (error) { toast.error(error.message); return }
    toast.success('Site added')
    setForm({ site_name: '', site_url: '', client_id: '' })
    setShowAdd(false)
    load()
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This will also remove all jobs and reviews for this site.`)) return
    const { error } = await supabase.from('moose_wp_sites').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Site deleted')
    load()
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key)
    toast.success('License key copied')
  }

  const filtered = sites.filter(s =>
    s.site_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.site_url?.toLowerCase().includes(search.toLowerCase()) ||
    s.clients?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WordPress Sites</h1>
              <p className="text-sm text-gray-500 mt-1">{sites.length} connected sites</p>
            </div>
            <button onClick={() => { setShowAdd(true); setForm({ site_name: '', site_url: '', client_id: '' }) }}
              className="btn-primary">
              <Plus size={16} /> Add Site
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search sites..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9" />
          </div>

          {/* Add Modal */}
          {showAdd && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Add WordPress Site</h2>
                  <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleAdd}>
                  <div className="space-y-3">
                    <input type="text" placeholder="Site name *" value={form.site_name}
                      onChange={e => setForm({ ...form, site_name: e.target.value })}
                      className="input" autoFocus />
                    <input type="url" placeholder="https://example.com *" value={form.site_url}
                      onChange={e => setForm({ ...form, site_url: e.target.value })}
                      className="input" />
                    <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
                      className="input">
                      <option value="">No client (optional)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" className="btn-primary flex-1">Add Site</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Sites Table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Site</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">License Key</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Ping</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(site => (
                  <tr key={site.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{site.site_name}</p>
                          <a href={site.site_url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-gray-400 hover:text-brand-500 flex items-center gap-1">
                            {site.site_url} <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{site.clients?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {site.connected ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                          <Wifi size={12} /> Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 text-sm font-medium">
                          <WifiOff size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600 max-w-[140px] truncate">
                          {site.license_key}
                        </code>
                        <button onClick={() => copyKey(site.license_key)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {site.last_ping ? formatDistanceToNow(new Date(site.last_ping), { addSuffix: true }) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === site.id ? null : site.id)}
                          className="p-1 rounded hover:bg-gray-100">
                          <MoreHorizontal size={16} className="text-gray-400" />
                        </button>
                        {menuOpen === site.id && (
                          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 w-36">
                            <button onClick={() => { copyKey(site.license_key); setMenuOpen(null) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                              <Copy size={13} /> Copy Key
                            </button>
                            <button onClick={() => { handleDelete(site.id, site.site_name); setMenuOpen(null) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                {search ? 'No sites match your search' : 'No WordPress sites yet — add your first one above'}
              </div>
            )}
          </div>

          {/* WP Version / Plugin info */}
          {sites.some(s => s.wp_version) && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {sites.filter(s => s.connected).map(site => (
                <div key={site.id} className="card p-4">
                  <p className="font-medium text-sm text-gray-900">{site.site_name}</p>
                  <div className="mt-2 space-y-1 text-sm text-gray-500">
                    {site.wp_version && <p>WordPress {site.wp_version}</p>}
                    {site.plugin_version && <p>Moose Plugin v{site.plugin_version}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
