import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Plus, ChevronRight, ChevronDown, LayoutGrid, LogOut, Folder, FolderOpen, Trash2, Edit2, MoreHorizontal, HelpCircle, BookOpen, CheckSquare, Shield, Calendar, Users, MessageSquare, DollarSign, Plug, Palette, Megaphone, Target, TrendingUp, Link2, Zap, Puzzle } from 'lucide-react'
import { getClients, getProjects, signOut, createClient_, updateClient, deleteClient, updateProject, deleteProject } from '../lib/supabase'
import NewProjectModal from './NewProjectModal'
import toast from 'react-hot-toast'

const HELP_ITEMS = [
  { q: 'How do I create a project?', a: 'Expand a client in the sidebar, click "New project", pick a type, and set revision rounds.' },
  { q: 'How do clients leave feedback?', a: 'Set the project to Public or Password in Access settings, copy the review link, and send it to your client.' },
  { q: 'How do revision rounds work?', a: 'Clients add comments, then click "Submit Changes". Each submission counts as one round. You set the max rounds per project.' },
  { q: 'How do I use the Design Canvas?', a: 'Open a project and click "New Canvas". Drag components, draw freehand, upload images. Press L for layers, G for grid.' },
  { q: 'How do I use the Email Designer?', a: 'Open a project and click "New Email". Add blocks (header, text, image, button), edit properties, then export as HTML.' },
  { q: 'How do I mark changes as done?', a: 'Go to the Rounds tab in your project, click "Done" on a round, then "Notify" to email the client.' },
  { q: 'What is the AI Assistant?', a: 'Open any file review and click the wand icon. It can summarize feedback, suggest copy, recommend layout changes, and more.' },
  { q: 'How do I manage team access?', a: 'Go to the Team tab in any project. Add members by email with roles: Admin, Staff, Client, or Viewer.' },
]

function SidebarHelp() {
  const [open, setOpen] = useState(false)
  const [openQ, setOpenQ] = useState(null)
  return (
    <>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors w-full">
        <HelpCircle size={13} /> Help & FAQ
      </button>
      {open && (
        <div className="mx-1 mb-1 bg-white/5 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider flex items-center gap-1"><BookOpen size={9} /> How to use</p>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {HELP_ITEMS.map((item, i) => (
              <div key={i}>
                <button onClick={() => setOpenQ(openQ === i ? null : i)} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between">
                  <span>{item.q}</span>
                  <ChevronRight size={9} className={`text-gray-500 transition-transform ${openQ === i ? 'rotate-90' : ''}`} />
                </button>
                {openQ === i && <p className="px-3 pb-2 text-[10px] text-gray-400 leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Sidebar({ activeClientId, activeProjectId, onRefresh }) {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState({})
  const [expanded, setExpanded] = useState({})
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newProjectClientId, setNewProjectClientId] = useState(null)
  const [editingClient, setEditingClient] = useState(null)
  const [editClientName, setEditClientName] = useState('')
  const [editingProject, setEditingProject] = useState(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [contextMenu, setContextMenu] = useState(null) // { type, id, x, y }
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => { loadClients() }, [onRefresh])
  useEffect(() => { function close() { setContextMenu(null) }; window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [])

  async function loadClients() {
    const { data } = await getClients()
    if (data) {
      setClients(data)
      if (activeClientId) { setExpanded(e => ({ ...e, [activeClientId]: true })); loadProjects(activeClientId) }
    }
  }

  async function loadProjects(clientId) {
    const { data } = await getProjects(clientId)
    if (data) setProjects(p => ({ ...p, [clientId]: data }))
  }

  function toggleClient(clientId) {
    const next = !expanded[clientId]
    setExpanded(e => ({ ...e, [clientId]: next }))
    if (next && !projects[clientId]) loadProjects(clientId)
  }

  async function handleAddClient(e) {
    e.preventDefault()
    if (!newClientName.trim()) return
    const { data, error } = await createClient_(newClientName.trim(), newClientEmail.trim())
    if (error) { toast.error('Failed to create client'); return }
    toast.success('Client created!')
    setNewClientName(''); setNewClientEmail(''); setShowNewClient(false)
    loadClients(); navigate(`/client/${data.id}`)
  }

  async function handleRenameClient(e) {
    e.preventDefault()
    if (!editClientName.trim()) return
    await updateClient(editingClient, { name: editClientName.trim() })
    toast.success('Client renamed'); setEditingClient(null); loadClients()
  }

  async function handleDeleteClient(id) {
    const c = clients.find(x => x.id === id)
    if (!confirm(`Delete client "${c?.name}" and ALL their projects? This cannot be undone.`)) return
    await deleteClient(id)
    toast.success('Client deleted'); loadClients()
    if (activeClientId === id) navigate('/')
  }

  async function handleRenameProject(e) {
    e.preventDefault()
    if (!editProjectName.trim()) return
    const { data } = await updateProject(editingProject, { name: editProjectName.trim() })
    toast.success('Project renamed'); setEditingProject(null)
    if (data) loadProjects(data.client_id)
  }

  async function handleDeleteProject(id, clientId) {
    if (!confirm('Delete this project and all its files?')) return
    await deleteProject(id)
    toast.success('Project deleted'); loadProjects(clientId)
    if (activeProjectId === id) navigate(`/client/${clientId}`)
  }

  async function handleSignOut() { await signOut(); navigate('/login') }

  function handleContextMenu(e, type, id) {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ type, id, x: e.clientX, y: e.clientY })
  }

  return (
    <aside className="hidden md:flex w-56 flex-col h-full flex-shrink-0" style={{ background: '#231f20' }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-none">Lucy</div>
            <div className="text-gray-500 text-[10px] mt-0.5">by Momenta</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <Link to="/" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><LayoutGrid size={15} className={location.pathname === '/' ? 'text-brand-500' : ''} /> Dashboard</Link>

        <Link to="/messages" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/messages' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><MessageSquare size={15} className={location.pathname === '/messages' ? 'text-brand-500' : ''} /> Messages</Link>

        <Link to="/tasks" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/tasks' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><CheckSquare size={15} className={location.pathname === '/tasks' ? 'text-brand-500' : ''} /> Tasks</Link>

        <Link to="/calendar" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/calendar' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><Calendar size={15} className={location.pathname === '/calendar' ? 'text-brand-500' : ''} /> Calendar</Link>

        <Link to="/marketing" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname.startsWith('/marketing') ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><Megaphone size={15} className={location.pathname.startsWith('/marketing') ? 'text-brand-500' : ''} /> E-Marketing</Link>

        <Link to="/revenue" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/revenue' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><DollarSign size={15} className={location.pathname === '/revenue' ? 'text-brand-500' : ''} /> Revenue</Link>

        <Link to="/employees" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname.startsWith('/employees') ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><Users size={15} className={location.pathname.startsWith('/employees') ? 'text-brand-500' : ''} /> Team</Link>

        <Link to="/integrations" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/integrations' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><Plug size={15} className={location.pathname === '/integrations' ? 'text-brand-500' : ''} /> Integrations</Link>

        <Link to="/admin" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          location.pathname === '/admin' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}><Shield size={15} className={location.pathname === '/admin' ? 'text-brand-500' : ''} /> Admin</Link>

        {/* SCOUT */}
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[9px] text-gray-500 uppercase font-semibold tracking-wider px-3 mb-1">Intelligence</p>
          <Link to="/scout" className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            location.pathname.startsWith('/scout') ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}>
            <Target size={15} className={location.pathname.startsWith('/scout') ? 'text-orange-500' : ''} />
            <span className="font-semibold tracking-wider text-xs">SCOUT</span>
            <span className="ml-auto text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">NEW</span>
          </Link>
          <p className="text-[9px] text-gray-500 uppercase font-semibold tracking-wider px-3 mt-2 mb-1">LucySEO</p>
          <Link to="/seo" className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${location.pathname === '/seo' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
            <TrendingUp size={14} className={location.pathname === '/seo' ? 'text-green-400' : ''} /> Dashboard
          </Link>
          <Link to="/seo/audit" className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${location.pathname === '/seo/audit' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
            <Zap size={14} className={location.pathname === '/seo/audit' ? 'text-yellow-400' : ''} /> URL Audit
          </Link>
          <Link to="/seo/plugin" className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${location.pathname === '/seo/plugin' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
            <Puzzle size={14} className={location.pathname === '/seo/plugin' ? 'text-purple-400' : ''} /> WP Plugin
          </Link>
          <Link to="/seo/connect" className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${location.pathname === '/seo/connect' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
            <Link2 size={14} className={location.pathname === '/seo/connect' ? 'text-blue-400' : ''} /> Connect Data
          </Link>
        </div>

        <div className="pt-3 pb-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Clients</span>
            <button onClick={() => setShowNewClient(v => !v)} className="text-gray-300 hover:text-white transition-colors" title="Add client"><Plus size={13} /></button>
          </div>

          {showNewClient && (
            <form onSubmit={handleAddClient} className="mx-2 mb-2 p-2.5 bg-white/10 rounded-lg space-y-1.5">
              <input className="w-full bg-white/10 border-0 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-gray-500"
                placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} autoFocus />
              <input className="w-full bg-white/10 border-0 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-gray-500"
                placeholder="Client email (optional)" type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
              <div className="flex gap-1.5">
                <button type="submit" className="flex-1 bg-brand-500 text-white text-xs py-1 rounded font-medium hover:bg-brand-600 transition-colors">Add</button>
                <button type="button" onClick={() => setShowNewClient(false)} className="flex-1 bg-white/10 text-gray-300 text-xs py-1 rounded hover:bg-white/20 transition-colors">Cancel</button>
              </div>
            </form>
          )}

          {clients.map(client => (
            <div key={client.id}>
              {editingClient === client.id ? (
                <form onSubmit={handleRenameClient} className="mx-2 mb-1">
                  <input className="w-full bg-white/10 border-0 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={editClientName} onChange={e => setEditClientName(e.target.value)} autoFocus
                    onBlur={() => setEditingClient(null)} onKeyDown={e => e.key === 'Escape' && setEditingClient(null)} />
                </form>
              ) : (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                  activeClientId === client.id ? 'bg-white/10 text-white font-medium' : 'text-gray-200 hover:text-white hover:bg-white/5'
                }`} onClick={() => { toggleClient(client.id); navigate(`/client/${client.id}`) }}
                  onContextMenu={e => handleContextMenu(e, 'client', client.id)}>
                  {expanded[client.id] ? <FolderOpen size={13} className={`flex-shrink-0 ${activeClientId === client.id ? 'text-brand-500' : 'text-gray-400'}`} /> : <Folder size={13} className="flex-shrink-0 text-gray-400" />}
                  <span className="text-sm flex-1 truncate">{client.name}</span>
                  <button onClick={e => { e.stopPropagation(); handleContextMenu(e, 'client', client.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all p-0.5"><MoreHorizontal size={12} /></button>
                </div>
              )}

              {expanded[client.id] && (
                <div className="ml-3 pl-3 border-l border-white/10 mb-1">
                  {(projects[client.id] || []).map(proj => (
                    editingProject === proj.id ? (
                      <form key={proj.id} onSubmit={handleRenameProject} className="mb-1">
                        <input className="w-full bg-white/10 border-0 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editProjectName} onChange={e => setEditProjectName(e.target.value)} autoFocus
                          onBlur={() => setEditingProject(null)} onKeyDown={e => e.key === 'Escape' && setEditingProject(null)} />
                      </form>
                    ) : (
                      <div key={proj.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors group/proj cursor-pointer ${
                        activeProjectId === proj.id ? 'bg-brand-500/20 text-brand-400 font-medium' : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`} onClick={() => navigate(`/project/${proj.id}`)}
                        onContextMenu={e => handleContextMenu(e, 'project', proj.id)}>
                        <span className="truncate flex-1">{proj.name}</span>
                        <button onClick={e => { e.stopPropagation(); handleContextMenu(e, 'project', proj.id) }}
                          className="opacity-0 group-hover/proj:opacity-100 text-gray-500 hover:text-white transition-all p-0.5"><MoreHorizontal size={10} /></button>
                      </div>
                    )
                  ))}
                  <Link to={`/client/${client.id}/brand`}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors w-full">
                    <Palette size={11} /> Brand Guidelines
                  </Link>
                  <button onClick={() => setNewProjectClientId(client.id)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors w-full">
                    <Plus size={11} /> New project
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-2 space-y-0.5">
        <SidebarHelp />
        <button onClick={handleSignOut} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors w-full">
          <LogOut size={13} /> Sign out
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          {contextMenu.type === 'client' && (
            <>
              <button onClick={() => { setEditingClient(contextMenu.id); setEditClientName(clients.find(c => c.id === contextMenu.id)?.name || ''); setContextMenu(null) }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Edit2 size={13} /> Rename Client</button>
              <button onClick={() => { handleDeleteClient(contextMenu.id); setContextMenu(null) }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete Client</button>
            </>
          )}
          {contextMenu.type === 'project' && (() => {
            const proj = Object.values(projects).flat().find(p => p.id === contextMenu.id)
            return (
              <>
                <button onClick={() => { setEditingProject(contextMenu.id); setEditProjectName(proj?.name || ''); setContextMenu(null) }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Edit2 size={13} /> Rename Project</button>
                <button onClick={() => { handleDeleteProject(contextMenu.id, proj?.client_id); setContextMenu(null) }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete Project</button>
              </>
            )
          })()}
        </div>
      )}

      {newProjectClientId && (
        <NewProjectModal clientId={newProjectClientId} clientName={clients.find(c => c.id === newProjectClientId)?.name || ''}
          onClose={() => setNewProjectClientId(null)}
          onCreated={(data) => { setNewProjectClientId(null); loadProjects(data.client_id); navigate(`/project/${data.id}`) }} />
      )}
    </aside>
  )
}
