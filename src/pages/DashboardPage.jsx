import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, FileImage, Clock, MessageSquare, Trash2, Edit2, Globe, Lock, KeyRound, Send, CheckCircle, Activity, Layers, BarChart3, ArrowUpRight, TrendingUp, Search, Smartphone, Palette, Mail, Printer, Film, BarChart2, Folder, Eye, Shield, Share2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import OnboardingTip from '../components/OnboardingTip'
import NotificationBell from '../components/NotificationBell'
import { getClients, getProjects, getFiles, deleteProject, updateProject, getRounds, getClientActivity } from '../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

const ACCESS_LABELS = {
  public: { label: 'Public', icon: Globe, cls: 'bg-gray-50 text-gray-700 border border-gray-200' },
  password: { label: 'Password', icon: KeyRound, cls: 'bg-gray-50 text-gray-700 border border-gray-200' },
  private: { label: 'Private', icon: Lock, cls: 'bg-gray-50 text-gray-700 border border-gray-200' },
}

const TYPE_ICONS = {
  website: Globe, mobile: Smartphone, brand: Palette, email: Mail,
  print: Printer, social: Film, presentation: BarChart2, other: Folder,
}

function TypeIcon({ type, size = 20, className = '' }) {
  const Icon = TYPE_ICONS[type] || Folder
  return <Icon size={size} strokeWidth={1.5} className={className || 'text-brand-500'} />
}

function getHealthScore(project, files, rounds) {
  const issues = []
  const openComments = files.reduce((a, f) => a + (f.open_comments || 0), 0)
  const lastActivity = project.created_at // simplified
  const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
  const maxRounds = project.max_rounds || 2
  const roundsUsed = rounds.length
  const hasDueDate = project.due_date
  const isPastDue = hasDueDate && new Date(project.due_date) < new Date()

  if (daysSince > 14) issues.push('No activity in ' + daysSince + ' days')
  else if (daysSince > 7) issues.push('Low activity (' + daysSince + ' days)')
  if (isPastDue && openComments > 0) issues.push('Overdue with open comments')
  if (roundsUsed >= maxRounds && openComments > 0) issues.push('All rounds used, still has open comments')
  if (openComments > 10) issues.push(openComments + ' open comments')

  if (issues.some(i => i.includes('Overdue') || i.includes('14 days') || i.includes('All rounds'))) return { color: '#ea2729', label: 'At risk', issues }
  if (issues.length > 0) return { color: '#f59e0b', label: 'Needs attention', issues }
  return { color: '#22c55e', label: 'Healthy', issues: [] }
}

function getProjectStatus(rounds, maxRounds) {
  if (!rounds || rounds.length === 0) return { label: 'Awaiting', cls: 'text-gray-500 bg-gray-50 border border-gray-200' }
  if (rounds.length >= maxRounds) return { label: 'Complete', cls: 'text-gray-700 bg-gray-50 border border-gray-200' }
  return { label: `Round ${rounds.length}/${maxRounds}`, cls: 'text-brand-700 bg-brand-50 border border-brand-200' }
}

export default function DashboardPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [projectFiles, setProjectFiles] = useState({})
  const [projectRounds, setProjectRounds] = useState({})
  const [recentActivity, setRecentActivity] = useState([])
  const [refresh, setRefresh] = useState(0)
  const [editingProject, setEditingProject] = useState(null)
  const [editName, setEditName] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [portalView, setPortalView] = useState(() => localStorage.getItem('mm_portal_view') || 'agency')

  useEffect(() => { loadClients() }, [refresh])
  useEffect(() => {
    if (clientId && clients.length > 0) { const c = clients.find(c => c.id === clientId); if (c) { setSelectedClient(c); loadProjects(clientId) } }
    else if (!clientId && clients.length > 0) { setSelectedClient(clients[0]); loadProjects(clients[0].id) }
  }, [clientId, clients])

  async function loadClients() { const { data } = await getClients(); setClients(data || []) }
  async function loadProjects(cId) {
    const { data } = await getProjects(cId); setProjects(data || [])
    if (data) { for (const p of data) { loadProjectFiles(p.id); loadProjectRounds(p.id) } }
    setRecentActivity(await getClientActivity(cId))
  }
  async function loadProjectFiles(pid) { const { data } = await getFiles(pid); setProjectFiles(pf => ({ ...pf, [pid]: data || [] })) }
  async function loadProjectRounds(pid) { const { data } = await getRounds(pid); setProjectRounds(pr => ({ ...pr, [pid]: data || [] })) }

  async function handleDeleteProject(id, e) { e.stopPropagation(); if (!confirm('Delete this project and all its files?')) return; await deleteProject(id); toast.success('Project deleted'); setRefresh(r => r + 1) }
  async function handleRenameProject(e) { e.preventDefault(); await updateProject(editingProject, { name: editName }); toast.success('Renamed'); setEditingProject(null); setRefresh(r => r + 1) }

  const allFiles = Object.values(projectFiles).flat()
  const totalComments = allFiles.reduce((a, f) => a + (f.comment_count || 0), 0)
  const totalOpen = allFiles.reduce((a, f) => a + (f.open_comments || 0), 0)
  const totalResolved = totalComments - totalOpen
  const totalRounds = Object.values(projectRounds).flat().length
  const completedProjects = projects.filter(p => (projectRounds[p.id] || []).length >= (p.max_rounds || 2)).length

  const types = [...new Set(projects.map(p => p.project_type || 'other'))]
  const filteredProjects = projects.filter(p => {
    if (typeFilter !== 'all' && (p.project_type || 'other') !== typeFilter) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeClientId={selectedClient?.id} onRefresh={refresh} />
      <main className="flex-1 overflow-y-auto bg-white">
        {/* Header - hidden on mobile */}
        <div className="hidden md:block" style={{ background: '#231f20' }}>
          <div className="px-4 md:px-8 py-6 md:py-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Dashboard</p>
                {selectedClient ? (
                  <>
                    <h1 className="text-xl md:text-3xl font-bold text-white">{selectedClient.name}</h1>
                    {selectedClient.email && <p className="text-sm text-gray-400 mt-1">{selectedClient.email}</p>}
                  </>
                ) : <h1 className="text-xl md:text-3xl font-bold text-white">Overview</h1>}
              </div>
              <div className="flex items-center gap-4">
                <NotificationBell />
                <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                  <button onClick={() => { setPortalView('agency'); localStorage.setItem('mm_portal_view', 'agency') }}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${portalView === 'agency' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                    <Shield size={12} strokeWidth={1.5} /> Agency
                  </button>
                  <button onClick={() => { setPortalView('client'); localStorage.setItem('mm_portal_view', 'client') }}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${portalView === 'client' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                    <Eye size={12} strokeWidth={1.5} /> Client View
                  </button>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>{projects.length} projects</span>
                  <span className="w-1 h-1 bg-gray-600 rounded-full" />
                  <span>{allFiles.length} files</span>
                </div>
              </div>
            </div>

            {/* Stat cards — minimal, black/red only */}
            {selectedClient && projects.length > 0 && (
              <div className="grid grid-cols-5 gap-3 mt-6">
                {[
                  { label: 'Active Projects', value: projects.length - completedProjects, icon: Layers, sub: `${completedProjects} completed` },
                  { label: 'Total Files', value: allFiles.length, icon: FileImage, sub: `across ${projects.length} projects` },
                  { label: 'Open Comments', value: totalOpen, icon: MessageSquare, sub: totalOpen > 0 ? 'needs attention' : 'all clear' },
                  { label: 'Resolved', value: totalResolved, icon: CheckCircle, sub: totalComments > 0 ? `${Math.round(totalResolved / totalComments * 100)}% rate` : 'none yet' },
                  { label: 'Rounds', value: totalRounds, icon: TrendingUp, sub: `${completedProjects} complete` },
                ].map(s => { const I = s.icon; return (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <I size={20} strokeWidth={1.5} className="text-brand-500" />
                    <p className="text-2xl md:text-4xl font-bold text-white mt-3">{s.value}</p>
                    <p className="text-sm text-gray-300 mt-1">{s.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* Mobile greeting */}
        <div className="md:hidden bg-white border-b border-gray-100">
          <div style={{ padding: '16px 16px 0' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>Here's what's happening</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e5e7eb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', margin: '12px 0 0' }}>
            {[
              { label: 'Projects', value: projects.length },
              { label: 'Clients', value: clients.length },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', padding: '14px 16px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {portalView === 'client' && (
          <div className="bg-blue-500 text-white text-sm text-center py-2 font-medium flex items-center justify-center gap-2">
            <Eye size={14} strokeWidth={1.5} /> You are previewing the client view
            <button onClick={() => { setPortalView('agency'); localStorage.setItem('mm_portal_view', 'agency') }} className="underline text-blue-100 hover:text-white ml-2">Switch back</button>
          </div>
        )}

        <div className="px-4 md:px-8 py-4 md:py-6">
          <OnboardingTip id="dashboard">Start by creating a client in the sidebar, then add projects under them. Upload design files for review, or create a canvas/email from the project page.</OnboardingTip>
          {/* Toolbar */}
          {projects.length > 0 && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 max-w-xs">
                <Search size={16} strokeWidth={1.5} className="text-brand-500" />
                <input className="text-base bg-transparent outline-none flex-1 placeholder-gray-400" placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setTypeFilter('all')} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>All</button>
                {types.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${typeFilter === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                    <TypeIcon type={t} size={13} /> {t}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-brand-500'}`}><Layers size={16} strokeWidth={1.5} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-brand-500'}`}><Activity size={16} strokeWidth={1.5} /></button>
              </div>
            </div>
          )}

          {!selectedClient && clients.length === 0 && (
            <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
              <FolderOpen size={32} strokeWidth={1.5} className="text-brand-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Lucy</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">Create your first client using the sidebar to get started.</p>
            </div>
          )}
          {projects.length === 0 && selectedClient && (
            <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
              <FolderOpen size={32} strokeWidth={1.5} className="text-brand-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h2>
              <p className="text-gray-500 text-sm">Add a project for {selectedClient.name} using the sidebar.</p>
            </div>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const files = projectFiles[project.id] || []
                const rounds = projectRounds[project.id] || []
                const openComments = files.reduce((a, f) => a + (f.open_comments || 0), 0)
                const access = ACCESS_LABELS[project.access_level || 'private']
                const AccessIcon = access.icon
                const maxRounds = project.max_rounds || 2
                const status = getProjectStatus(rounds, maxRounds)
                const pType = project.project_type || 'other'
                const progress = Math.min(100, (rounds.length / maxRounds) * 100)
                const health = getHealthScore(project, files, rounds)

                return (
                  <div key={project.id} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                    onClick={() => navigate(`/project/${project.id}`)}>
                    <div className="h-40 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200"><div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div>
                      {files.length > 0 ? (
                        <div className="flex gap-2 p-4">
                          {files.slice(0, 3).map((f, i) => (
                            <div key={f.id} className={`bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden ${i === 0 ? 'w-24 h-28' : 'w-16 h-20 opacity-50'}`}>
                              {f.type?.startsWith('image/') ? <img src={f.url} alt="" className="w-full h-full object-cover" /> : <FileImage size={20} strokeWidth={1.5} className="text-brand-300" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center"><TypeIcon type={pType} size={40} className="text-brand-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No files yet</p></div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={e => { e.stopPropagation(); setEditingProject(project.id); setEditName(project.name) }}
                          className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900"><Edit2 size={14} strokeWidth={1.5} /></button>
                        <button onClick={e => handleDeleteProject(project.id, e)}
                          className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-brand-500 hover:text-brand-700"><Trash2 size={14} strokeWidth={1.5} /></button>
                      </div>
                    </div>

                    <div className="p-5">
                      {editingProject === project.id ? (
                        <form onSubmit={handleRenameProject} onClick={e => e.stopPropagation()}>
                          <input className="input text-base mb-2" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                          <div className="flex gap-2"><button type="submit" className="btn-primary text-sm py-1 px-3">Save</button><button type="button" onClick={() => setEditingProject(null)} className="btn-secondary text-sm py-1 px-3">Cancel</button></div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: health.color }} title={health.issues.length ? health.issues.join(', ') : 'Healthy'} />
                              <h3 className="font-semibold text-gray-900 text-base leading-tight">{project.name}</h3>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 flex-shrink-0 ${access.cls}`}><AccessIcon size={10} strokeWidth={1.5} />{access.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${status.cls}`}>{status.label}</span>
                            {openComments > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1"><MessageSquare size={10} strokeWidth={1.5} />{openComments}</span>}
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span className="flex items-center gap-1.5"><FileImage size={13} strokeWidth={1.5} className="text-brand-500" /> {files.length} file{files.length !== 1 ? 's' : ''}</span>
                            <span className="flex items-center gap-1.5"><Clock size={13} strokeWidth={1.5} className="text-brand-500" />{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_100px_80px_140px_40px] gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <div>Project</div><div>Status</div><div>Comments</div><div>Files</div><div>Updated</div><div></div>
              </div>
              {filteredProjects.map(project => {
                const files = projectFiles[project.id] || []
                const rounds = projectRounds[project.id] || []
                const openComments = files.reduce((a, f) => a + (f.open_comments || 0), 0)
                const status = getProjectStatus(rounds, project.max_rounds || 2)
                const pType = project.project_type || 'other'
                return (
                  <div key={project.id} className="grid grid-cols-[1fr_100px_100px_80px_140px_40px] gap-4 px-5 py-4 items-center hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
                    onClick={() => navigate(`/project/${project.id}`)}>
                    <div className="flex items-center gap-3">
                      <TypeIcon type={pType} size={16} />
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                    </div>
                    <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span></div>
                    <div>{openComments > 0 ? <span className="text-sm text-brand-600 font-medium">{openComments} open</span> : <span className="text-sm text-gray-400">0</span>}</div>
                    <div className="text-sm text-gray-500">{files.length}</div>
                    <div className="text-sm text-gray-400">{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</div>
                    <div><ArrowUpRight size={14} strokeWidth={1.5} className="text-brand-500" /></div>
                  </div>
                )
              })}
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3"><Activity size={14} strokeWidth={1.5} className="text-brand-500" /> Recent Activity</h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {recentActivity.slice(0, 8).map(act => (
                  <div key={act.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${act.action === 'round_submitted' || act.action === 'comment' ? 'bg-brand-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-800 truncate flex-1"><span className="font-medium">{act.actor}</span> <span className="text-gray-400">&mdash;</span> {act.detail}</span>
                    <span className="text-sm text-gray-400 flex-shrink-0">{format(new Date(act.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ is now in the sidebar Help section */}
        </div>
      </main>
    </div>
  )
}
