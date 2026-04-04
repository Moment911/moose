"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Plus, Mail, ChevronRight, ChevronDown, LayoutGrid, LogOut, Folder, FolderOpen, Trash2, Edit2, MoreHorizontal, HelpCircle, BookOpen, CheckSquare, Shield, Calendar, Users, MessageSquare, DollarSign, Plug, Palette, Megaphone, Target, TrendingUp, Link2, Zap, Puzzle, Globe, Settings, Star, BarChart2 } from 'lucide-react'
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


// ── Sidebar nav helpers ────────────────────────────────────────────────────────
function NavLink({ to, icon: Icon, label, exact, startsWith, badge, badgeColor }) {
  const location = useLocation()
  const active = exact
    ? location.pathname === to
    : startsWith
    ? location.pathname.startsWith(to)
    : location.pathname === to
  return (
    <Link to={to} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
    }`}>
      <Icon size={15} className={active ? 'text-orange-400' : ''} />
      <span>{label}</span>
      {badge && <span style={{ marginLeft:'auto', fontSize:8, background: badgeColor||'#f97316', color:'#fff', padding:'1px 6px', borderRadius:20, fontWeight:800, letterSpacing:'.04em' }}>{badge}</span>}
    </Link>
  )
}

function SectionLabel({ label }) {
  return <p className="text-[9px] text-gray-500 uppercase font-semibold tracking-wider px-3 pt-3 pb-1">{label}</p>
}

function DevSection() {
  const [open, setOpen] = useState(false)
  const DEV_ITEMS = [
    { to:'/social',    icon:Star,       label:'Social Planner' },
    { to:'/payments',  icon:DollarSign, label:'Payments' },
    { to:'/reporting', icon:BarChart2,  label:'Reporting' },
    { to:'/marketing', icon:Megaphone,  label:'E-Marketing' },
    { to:'/campaigns', icon:Megaphone,  label:'Campaigns' },
    { to:'/contacts',  icon:Users,      label:'Contacts' },
    { to:'/calendar',  icon:Calendar,   label:'Calendar' },
    { to:'/tasks',     icon:CheckSquare,label:'Tasks' },
    { to:'/messages',  icon:MessageSquare, label:'Messages' },
    { to:'/revenue',   icon:DollarSign, label:'Revenue' },
    { to:'/admin',     icon:Shield,     label:'Admin Portal' },
    { to:'/seo/audit', icon:Zap,        label:'SEO Audit' },
    { to:'/seo/plugin',icon:Puzzle,     label:'WP Plugin' },
    { to:'/seo/connect',icon:Link2,     label:'Connect Data' },
    { to:'/automations',icon:Zap,       label:'Automations' },
    { to:'/templates', icon:BookOpen,   label:'Templates' },
    { to:'/brand-guidelines',icon:Palette, label:'Brand Guidelines' },
    { to:'/email-designer',icon:Mail,   label:'Email Designer' },
    { to:'/welcome',   icon:Globe,      label:'Marketing Site' },
    { to:'/signup',    icon:Plus,       label:'Agency Signup' },
  ]
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-gray-500 hover:text-gray-300 hover:bg-white/5">
        <BookOpen size={14} />
        <span className="text-xs font-semibold tracking-wider uppercase">Dev / Preview</span>
        <ChevronRight size={11} style={{ marginLeft:'auto', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition:'transform .2s' }} />
      </button>
      {open && (
        <div className="ml-2 pl-3 border-l border-white/10 space-y-0.5 mt-0.5">
          {DEV_ITEMS.map(item => (
            <Link key={item.to} to={item.to}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
              <item.icon size={12} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
    <aside className="hidden md:flex w-56 flex-col h-full flex-shrink-0" style={{ background: '#18181b' }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <img src="/moose-logo-white.svg" alt="Moose AI" style={{height:32,width:'auto',display:'block',marginBottom:2}}/>
        <div className="text-gray-500 text-[10px]">Marketing Platform</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

        {/* ── CORE ── */}
        <NavLink to="/" exact icon={LayoutGrid} label="Project Hub" />
        <NavLink to="/clients" icon={Users} label="Clients" startsWith />
        <NavLink to="/reviews" icon={MessageSquare} label="Reviews" startsWith />
        <NavLink to="/ai-agents" icon={Zap} label="AI Agents" startsWith />
        <NavLink to="/integrations" icon={Plug} label="Integrations" />

        {/* ── SEO / INTELLIGENCE ── */}
        <SectionLabel label="Intelligence" />
        <NavLink to="/scout" icon={Target} label="Scout" startsWith badge="NEW" badgeColor="#f97316" />
        <NavLink to="/seo" icon={TrendingUp} label="SEO Hub" />
        <NavLink to="/wordpress" icon={Globe} label="WordPress Sites" startsWith />

        {/* ── AGENCY ── */}
        <SectionLabel label="Agency" />
        <NavLink to="/agency-settings" icon={Shield} label="Agency Settings" />
        <NavLink to="/settings" icon={Settings} label="Settings" exact />

        {/* ── DEV / COMING SOON ── */}
        <DevSection />

        {/* ── CLIENT LIST ── */}
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
