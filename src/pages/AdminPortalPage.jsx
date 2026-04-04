import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Shield, Grid3X3, Plus, Trash2, Edit2, Check, X, ChevronLeft, Mail, UserPlus, Search, ChevronDown, ChevronRight, Settings, Layers, Activity, BarChart3, FileImage, MessageSquare, Clock, ArrowUpRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getClients, createClient_, updateClient, deleteClient, getProjects, sendEmailSummary, getActivity } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const ROLES = [
  { key: 'owner', label: 'Owner', cls: 'bg-brand-50 text-brand-700' },
  { key: 'manager', label: 'Manager', cls: 'bg-blue-50 text-blue-700' },
  { key: 'designer', label: 'Designer', cls: 'bg-purple-50 text-purple-700' },
  { key: 'viewer', label: 'Viewer', cls: 'bg-gray-100 text-gray-600' },
]
const ACCESS_ROLES = [
  { key: 'none', label: 'No Access', cls: 'text-gray-400 bg-gray-50' },
  { key: 'viewer', label: 'Viewer', cls: 'text-blue-600 bg-blue-50' },
  { key: 'commenter', label: 'Commenter', cls: 'text-purple-600 bg-purple-50' },
  { key: 'editor', label: 'Editor', cls: 'text-amber-600 bg-amber-50' },
  { key: 'manager', label: 'Manager', cls: 'text-brand-600 bg-brand-50' },
]

const PAGE_SIZE = 25

export default function AdminPortalPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState('dashboard')
  const [clients, setClients] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [staff, setStaff] = useState([])
  const [access, setAccess] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  // Search & pagination
  const [clientSearch, setClientSearch] = useState('')
  const [clientPage, setClientPage] = useState(0)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectPage, setProjectPage] = useState(0)
  const [staffSearch, setStaffSearch] = useState('')

  // Forms
  const [showAddClient, setShowAddClient] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('designer')
  const [editingClient, setEditingClient] = useState(null)
  const [editClientName, setEditClientName] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [expandedClient, setExpandedClient] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: c } = await getClients()
    setClients(c || [])
    const projs = []
    for (const cl of (c || [])) { const { data } = await getProjects(cl.id); projs.push(...(data || []).map(p => ({ ...p, clientName: cl.name }))) }
    setAllProjects(projs)
    try { const { data } = await supabase.from('staff_members').select('*').order('created_at'); setStaff(data || []) } catch {}
    try { const { data } = await supabase.from('staff_client_access').select('*'); setAccess(data || []) } catch {}
    // Load recent activity from all clients
    try {
      const ids = (c || []).map(x => x.id)
      if (ids.length) { const { data } = await supabase.from('activity_log').select('*').in('project_id', projs.map(p => p.id)).order('created_at', { ascending: false }).limit(20); setActivity(data || []) }
    } catch {}
    setLoading(false)
  }

  // Filtered/paginated data
  const filteredClients = useMemo(() => clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())), [clients, clientSearch])
  const pagedClients = filteredClients.slice(clientPage * PAGE_SIZE, (clientPage + 1) * PAGE_SIZE)
  const clientPages = Math.ceil(filteredClients.length / PAGE_SIZE)

  const filteredProjects = useMemo(() => allProjects.filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.clientName.toLowerCase().includes(projectSearch.toLowerCase())), [allProjects, projectSearch])
  const pagedProjects = filteredProjects.slice(projectPage * PAGE_SIZE, (projectPage + 1) * PAGE_SIZE)

  const filteredStaff = useMemo(() => staff.filter(s => !staffSearch || (s.name || '').toLowerCase().includes(staffSearch.toLowerCase()) || s.email.toLowerCase().includes(staffSearch.toLowerCase())), [staff, staffSearch])

  // Stats
  const totalOpen = allProjects.reduce((a, p) => a, 0) // simplified
  const activeStaff = staff.filter(s => s.active).length

  // Handlers
  async function handleAddClient(e) { e.preventDefault(); if (!clientName.trim()) return; await createClient_(clientName.trim(), clientEmail.trim() || null); toast.success('Client created'); setClientName(''); setClientEmail(''); setShowAddClient(false); loadAll() }
  async function handleUpdateClient(e) { e.preventDefault(); await updateClient(editingClient, { name: editClientName.trim(), email: editClientEmail.trim() || null }); toast.success('Updated'); setEditingClient(null); loadAll() }
  async function handleDeleteClient(id) { if (!confirm('Delete client and all their data?')) return; await deleteClient(id); toast.success('Deleted'); loadAll() }
  async function handleAddStaff(e) { e.preventDefault(); if (!newEmail.trim()) return; try { await supabase.from('staff_members').insert({ email: newEmail.trim(), name: newName.trim() || null, role: newRole }); toast.success('Staff added'); setNewEmail(''); setNewName(''); setShowAddStaff(false); loadAll() } catch (err) { toast.error(err?.message || 'Failed') } }
  async function handleDeleteStaff(s) { if (!confirm(`Remove ${s.name || s.email}?`)) return; await supabase.from('staff_members').delete().eq('id', s.id); toast.success('Removed'); loadAll() }
  async function handleSetAccessRole(staffId, clientId, role) {
    const existing = access.find(a => a.staff_id === staffId && a.client_id === clientId)
    if (role === 'none') { if (existing) await supabase.from('staff_client_access').delete().eq('id', existing.id) }
    else if (existing) await supabase.from('staff_client_access').update({ role, can_view: true, can_comment: ['commenter','editor','manager'].includes(role), can_upload: ['editor','manager'].includes(role), can_manage: role === 'manager' }).eq('id', existing.id)
    else await supabase.from('staff_client_access').insert({ staff_id: staffId, client_id: clientId, role, can_view: true, can_comment: ['commenter','editor','manager'].includes(role), can_upload: ['editor','manager'].includes(role), can_manage: role === 'manager' })
    try { const { data } = await supabase.from('staff_client_access').select('*'); setAccess(data || []) } catch {}
  }

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'clients', label: `Clients (${clients.length})`, icon: Users },
    { key: 'projects', label: `Projects (${allProjects.length})`, icon: Layers },
    { key: 'staff', label: `Staff (${staff.length})`, icon: Shield },
    { key: 'access', label: 'Access Matrix', icon: Grid3X3 },
    { key: 'activity', label: 'Audit Log', icon: Activity },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Admin sidebar */}
        <div className="hidden md:flex w-52 bg-gray-50 border-r border-gray-200 flex-col flex-shrink-0">
          <div className="px-4 py-5 border-b border-gray-200">
            <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-2"><ChevronLeft size={12} /> Dashboard</button>
            <h2 className="text-base font-bold text-gray-900">Admin Portal</h2>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {NAV.map(n => { const I = n.icon; return (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${section === n.key ? 'bg-white text-gray-900 shadow-sm border border-gray-200 font-medium' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
                <I size={15} strokeWidth={1.5} className={section === n.key ? 'text-brand-500' : 'text-gray-400'} /> {n.label}
              </button>
            )})}
          </nav>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-white">
          {loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div> : (
            <div className="p-6">

              {/* DASHBOARD */}
              {section === 'dashboard' && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
                  <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                      { label: 'Clients', value: clients.length, icon: Users },
                      { label: 'Projects', value: allProjects.length, icon: Layers },
                      { label: 'Staff', value: activeStaff, icon: Shield },
                      { label: 'Activity', value: activity.length, icon: Activity },
                    ].map(s => { const I = s.icon; return (
                      <div key={s.label} className="card p-5">
                        <I size={18} strokeWidth={1.5} className="text-brand-500 mb-2" />
                        <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                        <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                      </div>
                    )})}
                  </div>
                  <div className="flex gap-3 mb-8">
                    <button onClick={() => { setSection('clients'); setShowAddClient(true) }} className="btn-primary text-sm"><Plus size={14} /> Add Client</button>
                    <button onClick={() => { setSection('staff'); setShowAddStaff(true) }} className="btn-secondary text-sm"><UserPlus size={14} /> Add Staff</button>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Activity size={14} strokeWidth={1.5} className="text-brand-500" /> Recent Activity</h2>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {activity.slice(0, 15).map(a => (
                      <div key={a.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.action === 'comment' || a.action === 'round_submitted' ? 'bg-brand-500' : 'bg-gray-300'}`} />
                        <span className="text-gray-800 truncate flex-1"><span className="font-medium">{a.actor}</span> — {a.detail}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{a.created_at && formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                      </div>
                    ))}
                    {activity.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No recent activity</div>}
                  </div>
                </div>
              )}

              {/* CLIENTS */}
              {section === 'clients' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-gray-900">Clients <span className="text-gray-400 font-normal text-base">({filteredClients.length})</span></h1>
                    <button onClick={() => setShowAddClient(!showAddClient)} className="btn-primary text-sm"><Plus size={14} /> Add Client</button>
                  </div>
                  {showAddClient && (
                    <div className="card p-4 mb-4"><form onSubmit={handleAddClient} className="flex gap-3 items-end">
                      <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Name *</label><input className="input text-sm" placeholder="Company" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus /></div>
                      <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Email</label><input className="input text-sm" type="email" placeholder="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></div>
                      <button type="submit" className="btn-primary text-sm h-[38px]">Create</button>
                      <button type="button" onClick={() => setShowAddClient(false)} className="btn-secondary text-sm h-[38px]">Cancel</button>
                    </form></div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
                      <Search size={14} strokeWidth={1.5} className="text-brand-500" />
                      <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search clients..." value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientPage(0) }} />
                    </div>
                    <span className="text-xs text-gray-400">{filteredClients.length} results</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_180px_80px_120px_100px] gap-4 px-4 py-2.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b">
                      <div>Client</div><div>Email</div><div>Projects</div><div>Created</div><div>Actions</div>
                    </div>
                    {pagedClients.map(c => (
                      <div key={c.id}>
                        {editingClient === c.id ? (
                          <form onSubmit={handleUpdateClient} className="grid grid-cols-[1fr_180px_80px_120px_100px] gap-4 px-4 py-2.5 items-center border-b border-gray-100">
                            <input className="input text-sm py-1" value={editClientName} onChange={e => setEditClientName(e.target.value)} autoFocus />
                            <input className="input text-sm py-1" value={editClientEmail} onChange={e => setEditClientEmail(e.target.value)} />
                            <div /><div />
                            <div className="flex gap-1"><button type="submit" className="text-green-600"><Check size={14} /></button><button type="button" onClick={() => setEditingClient(null)} className="text-gray-400"><X size={14} /></button></div>
                          </form>
                        ) : (
                          <div className={`grid grid-cols-[1fr_180px_80px_120px_100px] gap-4 px-4 py-2.5 items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expandedClient === c.id ? 'bg-gray-50' : ''}`}
                            onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)}>
                            <div className="flex items-center gap-2">
                              {expandedClient === c.id ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                              <span className="text-sm font-medium text-gray-900">{c.name}</span>
                            </div>
                            <span className="text-sm text-gray-500 truncate">{c.email || '—'}</span>
                            <span className="text-sm text-gray-500">{allProjects.filter(p => p.client_id === c.id).length}</span>
                            <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'MMM d yyyy')}</span>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEditingClient(c.id); setEditClientName(c.name); setEditClientEmail(c.email || '') }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Edit2 size={12} /></button>
                              <button onClick={() => navigate(`/client/${c.id}`)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ArrowUpRight size={12} /></button>
                              <button onClick={() => handleDeleteClient(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-brand-500"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        )}
                        {expandedClient === c.id && (
                          <div className="bg-gray-50 px-8 py-3 border-b border-gray-200">
                            {/* Slack channel for client */}
                            <div className="flex items-center gap-3 mb-3">
                              <label className="text-xs text-gray-500">Slack Channel:</label>
                              <input className="input text-xs py-1 w-64" placeholder="https://app.slack.com/client/T00/C00..." value={c.slack_channel_url || ''}
                                onChange={e => { supabase.from('clients').update({ slack_channel_url: e.target.value.trim() || null }).eq('id', c.id) }}
                                onBlur={e => { supabase.from('clients').update({ slack_channel_url: e.target.value.trim() || null }).eq('id', c.id); loadAll() }} />
                              {c.slack_channel_url && <a href={c.slack_channel_url} target="_blank" rel="noreferrer" className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"><MessageSquare size={11} /> Open Slack</a>}
                            </div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Projects</p>
                            {allProjects.filter(p => p.client_id === c.id).map(p => (
                              <div key={p.id} className="flex items-center gap-3 py-1.5 text-sm cursor-pointer hover:text-brand-600" onClick={() => navigate(`/project/${p.id}`)}>
                                <span className="text-gray-700">{p.name}</span>
                                <span className="text-xs text-gray-400">{p.project_type || 'other'}</span>
                              </div>
                            ))}
                            {allProjects.filter(p => p.client_id === c.id).length === 0 && <p className="text-xs text-gray-400">No projects</p>}
                          </div>
                        )}
                      </div>
                    ))}
                    {pagedClients.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No clients found</div>}
                  </div>
                  {clientPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button onClick={() => setClientPage(Math.max(0, clientPage - 1))} disabled={clientPage === 0} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30">Prev</button>
                      {Array.from({ length: clientPages }).map((_, i) => (
                        <button key={i} onClick={() => setClientPage(i)} className={`w-8 h-8 rounded-lg text-sm ${clientPage === i ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{i + 1}</button>
                      ))}
                      <button onClick={() => setClientPage(Math.min(clientPages - 1, clientPage + 1))} disabled={clientPage >= clientPages - 1} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30">Next</button>
                    </div>
                  )}
                </div>
              )}

              {/* PROJECTS */}
              {section === 'projects' && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-4">Projects <span className="text-gray-400 font-normal text-base">({filteredProjects.length})</span></h1>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
                      <Search size={14} strokeWidth={1.5} className="text-brand-500" />
                      <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search projects..." value={projectSearch} onChange={e => { setProjectSearch(e.target.value); setProjectPage(0) }} />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px_80px_80px_80px_90px] gap-4 px-4 py-2.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b">
                      <div>Project</div><div>Client</div><div>Type</div><div>Round</div><div>Files</div><div>Actions</div>
                    </div>
                    {pagedProjects.map(p => (
                      <div key={p.id} className="grid grid-cols-[1fr_120px_80px_80px_80px_90px] gap-4 px-4 py-2.5 items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/project/${p.id}`)}>
                        <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                        <span className="text-xs text-gray-500 truncate">{p.clientName}</span>
                        <span className="text-xs text-gray-400">{p.project_type || '—'}</span>
                        <span className="text-xs text-gray-400">{p.max_rounds || 2}</span>
                        <span className="text-xs text-gray-400">—</span>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => navigate(`/project/${p.id}`)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ArrowUpRight size={12} /></button>
                        </div>
                      </div>
                    ))}
                    {pagedProjects.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No projects found</div>}
                  </div>
                </div>
              )}

              {/* STAFF */}
              {section === 'staff' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-gray-900">Staff <span className="text-gray-400 font-normal text-base">({staff.length})</span></h1>
                    <button onClick={() => setShowAddStaff(!showAddStaff)} className="btn-primary text-sm"><UserPlus size={14} /> Add Staff</button>
                  </div>
                  {showAddStaff && (
                    <div className="card p-4 mb-4"><form onSubmit={handleAddStaff} className="flex gap-3 items-end flex-wrap">
                      <div className="flex-1 min-w-[160px]"><label className="text-xs text-gray-500 block mb-1">Email *</label><input className="input text-sm" type="email" placeholder="staff@agency.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
                      <div className="w-36"><label className="text-xs text-gray-500 block mb-1">Name</label><input className="input text-sm" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} /></div>
                      <div className="w-32"><label className="text-xs text-gray-500 block mb-1">Role</label><select className="input text-sm" value={newRole} onChange={e => setNewRole(e.target.value)}>{ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
                      <button type="submit" className="btn-primary text-sm h-[38px]">Add</button>
                      <button type="button" onClick={() => setShowAddStaff(false)} className="btn-secondary text-sm h-[38px]">Cancel</button>
                    </form></div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
                      <Search size={14} strokeWidth={1.5} className="text-brand-500" />
                      <input className="text-sm bg-transparent outline-none flex-1" placeholder="Search staff..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_180px_100px_80px_80px_80px] gap-4 px-4 py-2.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b">
                      <div>Name</div><div>Email</div><div>Role</div><div>Clients</div><div>Status</div><div>Actions</div>
                    </div>
                    {filteredStaff.map(s => {
                      const role = ROLES.find(r => r.key === s.role) || ROLES[3]
                      const clientCount = access.filter(a => a.staff_id === s.id && a.can_view).length
                      return (
                        <div key={s.id} className="grid grid-cols-[1fr_180px_100px_80px_80px_80px] gap-4 px-4 py-2.5 items-center border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/employees/${s.id}`)}>
                            <div className="w-7 h-7 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{(s.name || s.email)[0].toUpperCase()}</div>
                            <span className="text-sm font-medium text-gray-900">{s.name || '—'}</span>
                          </div>
                          <span className="text-sm text-gray-500 truncate">{s.email}</span>
                          <select value={s.role} onChange={e => { supabase.from('staff_members').update({ role: e.target.value }).eq('id', s.id).then(() => loadAll()) }}
                            className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${role.cls}`}>
                            {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                          </select>
                          <span className="text-xs text-gray-500">{clientCount}</span>
                          <button onClick={() => { supabase.from('staff_members').update({ active: !s.active }).eq('id', s.id).then(() => loadAll()) }}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.active ? 'Active' : 'Off'}</button>
                          <button onClick={() => handleDeleteStaff(s)} className="text-gray-400 hover:text-brand-500"><Trash2 size={13} strokeWidth={1.5} /></button>
                        </div>
                      )
                    })}
                    {filteredStaff.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No staff found</div>}
                  </div>
                </div>
              )}

              {/* ACCESS MATRIX */}
              {section === 'access' && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Access Matrix</h1>
                  <p className="text-sm text-gray-500 mb-1">Set access levels for each staff member per client.</p>
                  <div className="flex gap-2 mb-4 text-xs">{ACCESS_ROLES.map(r => <span key={r.key} className={`px-2 py-0.5 rounded-full ${r.cls}`}>{r.label}</span>)}</div>
                  {staff.filter(s => s.active).length === 0 ? <div className="card py-16 text-center text-sm text-gray-400">Add staff first</div> : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-auto max-h-[70vh]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[160px]">Staff</th>
                            {clients.map(c => <th key={c.id} className="px-2 py-3 text-xs font-semibold text-gray-500 text-center min-w-[110px]">{c.name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {staff.filter(s => s.active).map(s => (
                            <tr key={s.id} className="border-b border-gray-100">
                              <td className="px-4 py-2.5 font-medium text-gray-900 sticky left-0 bg-white">
                                <div className="text-sm">{s.name || s.email}</div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(ROLES.find(r => r.key === s.role) || ROLES[3]).cls}`}>{s.role}</span>
                              </td>
                              {clients.map(c => {
                                const a = access.find(x => x.staff_id === s.id && x.client_id === c.id)
                                const current = a?.role || (a?.can_view ? 'viewer' : 'none')
                                return (
                                  <td key={c.id} className="px-2 py-2 text-center">
                                    <select value={current} onChange={e => handleSetAccessRole(s.id, c.id, e.target.value)}
                                      className={`text-[10px] px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${(ACCESS_ROLES.find(r => r.key === current) || ACCESS_ROLES[0]).cls}`}>
                                      {ACCESS_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                                    </select>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AUDIT LOG */}
              {section === 'activity' && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-4">Audit Log</h1>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <div className="grid grid-cols-[120px_1fr_100px] gap-4 px-4 py-2.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b">
                      <div>Time</div><div>Activity</div><div>Type</div>
                    </div>
                    {activity.map(a => (
                      <div key={a.id} className="grid grid-cols-[120px_1fr_100px] gap-4 px-4 py-3 text-sm hover:bg-gray-50">
                        <span className="text-xs text-gray-400">{a.created_at && format(new Date(a.created_at), 'MMM d, h:mm a')}</span>
                        <span className="text-gray-800 truncate"><span className="font-medium">{a.actor}</span> — {a.detail}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${a.action === 'comment' ? 'bg-gray-100 text-gray-600' : a.action === 'round_submitted' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{a.action}</span>
                      </div>
                    ))}
                    {activity.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No activity logged</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
