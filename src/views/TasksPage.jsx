"use client";
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Check, Trash2, Calendar, Flag, User, MessageSquare, X, Send, Layers, LayoutGrid, UserPlus, Mail, ChevronLeft, Maximize2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import OnboardingTip from '../components/OnboardingTip'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileRow, MobileEmpty, MobileTabs, MobileSearch, MobileSectionHeader } from '../components/mobile/MobilePage'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const R   = '#E6007E'
const T   = '#00C2CB'
const BLK = '#0a0a0a'
const GRY = '#F9F9F9'
const W   = '#ffffff'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const BRD = '#e5e7eb'
const BRD_LT = '#f3f4f6'
const GRY400 = '#9ca3af'
const GRY700 = '#374151'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const STATUSES = [
  { key: 'todo', label: 'To Do', color: '#4b5563' },
  { key: 'acknowledged', label: 'Acknowledged', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'more_info', label: 'More Info Needed', color: '#8b5cf6' },
  { key: 'in_review', label: 'In Review', color: '#06b6d4' },
  { key: 'pending', label: 'Pending', color: '#5bc6d0' },
  { key: 'completed', label: 'Completed', color: '#22c55e' },
]

const PRIORITIES = [
  { key: 'none', label: 'None', color: '#d1d5db' },
  { key: 'low', label: 'Low', color: '#3b82f6' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'high', label: 'High', color: '#ea2729' },
  { key: 'urgent', label: 'Urgent', color: '#dc2626' },
]

export default function TasksPage() {
  const { agencyId } = useAuth()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [view, setView] = useState('list')
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(projectId || 'all')
  const [selectedTask, setSelectedTask] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [inviteEmail, setInviteEmail] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('all')
  const [staffMembers, setStaffMembers] = useState([])
  const [newAssignee, setNewAssignee] = useState('')

  useEffect(() => { loadProjects(); loadStaff() }, [])
  useEffect(() => { loadTasks() }, [selectedProject])

  async function loadProjects() {
    const { data: cl } = await supabase.from('clients').select('*').eq('agency_id', agencyId || '').order('name')
    setClients(cl || [])
    const allProjs = []
    for (const c of (cl || [])) {
      const { data } = await supabase.from('projects').select('*').eq('client_id', c.id)
      allProjs.push(...(data || []).map(p => ({ ...p, clientName: c.name, clientId: c.id })))
    }
    setProjects(allProjs)
    if (projectId) setSelectedProject(projectId)
  }

  async function loadStaff() {
    try { const { data } = await supabase.from('staff_members').select('*').eq('active', true); setStaffMembers(data || []) } catch { setStaffMembers([]) }
  }

  function addAssigneeToTask(name, email) {
    if (!selectedTask) return
    const current = selectedTask.assignees || []
    if (current.some(a => a.email === email)) { toast.error('Already assigned'); return }
    const updated = [...current, { name, email, type: 'email' }]
    handleUpdateTask(selectedTask.id, { assignees: updated, assignee_name: updated.map(a => a.name).join(', '), assignee_email: email })
    setSelectedTask(prev => ({ ...prev, assignees: updated }))
  }

  function removeAssignee(email) {
    if (!selectedTask) return
    const updated = (selectedTask.assignees || []).filter(a => a.email !== email)
    handleUpdateTask(selectedTask.id, { assignees: updated, assignee_name: updated.map(a => a.name).join(', ') })
    setSelectedTask(prev => ({ ...prev, assignees: updated }))
  }

  async function loadTasks() {
    let query = supabase.from('tasks').select('*').order('order_index')
    if (selectedProject !== 'all') query = query.eq('project_id', selectedProject)
    const { data, error } = await query
    if (error) { console.error(error); setTasks([]); return }
    setTasks(data || [])
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return
    const pid = selectedProject === 'all' ? projects[0]?.id : selectedProject
    if (!pid) { toast.error('Select a project first'); return }
    const { data, error } = await supabase.from('tasks').insert({ project_id: pid, title: newTaskTitle.trim(), status: 'todo', priority: 'none', order_index: tasks.length, created_by: user?.email }).select().single()
    if (error) { toast.error('Failed to create task'); return }
    setTasks(prev => [...prev, data]); setNewTaskTitle(''); toast.success('Task added')
  }

  async function handleUpdateTask(id, updates) {
    const { data, error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) { toast.error('Failed to update'); return }
    setTasks(prev => prev.map(t => t.id === data.id ? data : t))
    if (selectedTask?.id === data.id) setSelectedTask(data)
  }

  async function handleDeleteTask(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (selectedTask?.id === id) setSelectedTask(null)
    toast.success('Task deleted')
  }

  async function handleToggleComplete(task) {
    const done = !task.completed
    handleUpdateTask(task.id, { completed: done, completed_at: done ? new Date().toISOString() : null, status: done ? 'completed' : 'todo' })
  }

  async function selectTask(task) {
    setSelectedTask(task)
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
    setComments(data || [])
  }

  async function handleAddComment() {
    if (!newComment.trim() || !selectedTask) return
    const { data } = await supabase.from('task_comments').insert({ task_id: selectedTask.id, text: newComment.trim(), author_name: user?.email?.split('@')[0] || 'Admin', author_email: user?.email }).select().single()
    if (data) { setComments(prev => [...prev, data]); setNewComment('') }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    toast.success(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
  }

  const filteredTasks = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus)
  const currentProject = projects.find(p => p.id === selectedProject)
  const boardColumns = STATUSES.map(s => ({ ...s, tasks: filteredTasks.filter(t => (t.status || 'todo') === s.key) }))

  const isMobile = useMobile()
  const [mStatus, setMStatus] = useState('all')
  const [mSearch, setMSearch] = useState('')

  const [mShowAdd, setMShowAdd] = useState(false)

  /* ─── MOBILE ─── */
  if (isMobile) {
    const statusTabs = [
      {key:'all',       label:'All',       count:tasks.length},
      {key:'todo',      label:'To Do',     count:tasks.filter(t=>t.status==='todo').length},
      {key:'in_progress',label:'In Progress',count:tasks.filter(t=>t.status==='in_progress').length},
      {key:'done',      label:'Done',      count:tasks.filter(t=>t.status==='done').length},
    ]
    const filteredTasks = tasks
      .filter(t => mStatus==='all' || t.status===mStatus)
      .filter(t => !mSearch || t.title?.toLowerCase().includes(mSearch.toLowerCase()))
    const priColor = p => ({high:'#ea2729',medium:'#f59e0b',low:'#9a9a96'})[p]||'#9a9a96'

    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Tasks" subtitle={`${tasks.length} total`}
          action={<button onClick={()=>setMShowAdd(true)}
            style={{width:38,height:38,borderRadius:11,background:'#ea2729',border:'none',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',WebkitTapHighlightColor:'transparent',minHeight:44}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>}/>

        {/* Mobile add task form */}
        {mShowAdd && (
          <div style={{padding:'12px 16px',background:'#fff',borderBottom:'1px solid #e5e7eb'}}>
            <div style={{display:'flex',gap:8}}>
              <input value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){handleAddTask();setMShowAdd(false)}}}
                placeholder="Task title..." autoFocus
                style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1.5px solid #e5e7eb',fontSize:16,outline:'none',fontFamily:"'Raleway','Helvetica Neue',sans-serif",minHeight:44}}/>
              <button onClick={()=>{handleAddTask();setMShowAdd(false)}}
                style={{padding:'10px 18px',borderRadius:10,border:'none',background:'#ea2729',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',minHeight:44,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>Add</button>
              <button onClick={()=>setMShowAdd(false)}
                style={{padding:'10px',borderRadius:10,border:'1px solid #e5e7eb',background:'#fff',color:'#9ca3af',cursor:'pointer',minHeight:44,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          </div>
        )}

        <MobileSearch value={mSearch} onChange={setMSearch} placeholder="Search tasks…"/>
        <MobileTabs tabs={statusTabs} active={mStatus} onChange={setMStatus}/>
        {filteredTasks.length===0 ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>No tasks found</div>
        ) : (
          <MobileCard style={{margin:'12px 16px'}}>
            {filteredTasks.map((t,i)=>(
              <MobileRow key={t.id}
                onClick={()=>navigate(`/tasks/${t.id}`)}
                borderBottom={i<filteredTasks.length-1}
                left={<div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,marginTop:4,background:priColor(t.priority)}}/>}
                title={t.title||'Untitled'}
                subtitle={[t.assignee_name, t.due_date?'Due '+new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):null].filter(Boolean).join(' · ')}
                badge={t.status==='done'
                  ? <span style={{fontSize:10,fontWeight:800,color:'#16a34a',background:'#f0fdf4',padding:'2px 7px',borderRadius:20,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",flexShrink:0}}>✓</span>
                  : null}/>
            ))}
          </MobileCard>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center gap-4 flex-shrink-0">
          {projectId && <button onClick={() => navigate(`/project/${projectId}`)} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={16} /></button>}
          <h1 className="text-lg font-bold text-gray-900">Tasks</h1>

          {/* Client → Project selector */}
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400" value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setSelectedProject('all') }}>
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.filter(p => selectedClient === 'all' || p.clientId === selectedClient).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Status filter */}
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setView('list')} className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700'}`}><Layers size={12} className="inline mr-1" />List</button>
              <button onClick={() => setView('board')} className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700'}`}><LayoutGrid size={12} className="inline mr-1" />Board</button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="max-w-4xl mx-auto p-6">
                <OnboardingTip id="tasks">Select a client and project above, then type a task name and press Enter. Click any task to see details, or use the expand button to open the full page view.</OnboardingTip>
                {/* Add task input */}
                <div className="flex items-center gap-3 mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <Plus size={16} strokeWidth={1.5} className="text-brand-500 flex-shrink-0" />
                  <input className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400" placeholder="Add a task... (press Enter)" value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }} />
                  {newTaskTitle.trim() && <button onClick={handleAddTask} className="text-sm bg-brand-500 text-white px-3 py-1 rounded-lg">Add</button>}
                </div>

                {/* Task list */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[32px_1fr_100px_100px_100px_90px_40px] gap-3 px-4 py-2.5 bg-gray-50 text-[13px] font-semibold text-gray-700 uppercase tracking-wider border-b">
                    <div></div><div>Task</div><div>Assignee</div><div>Status</div><div>Priority</div><div>Due</div><div></div>
                  </div>

                  {filteredTasks.length === 0 && <div className="py-16 text-center text-sm text-gray-700">No tasks yet. Add one above.</div>}

                  {filteredTasks.map(t => {
                    const status = STATUSES.find(s => s.key === t.status) || STATUSES[0]
                    const priority = PRIORITIES.find(p => p.key === t.priority) || PRIORITIES[0]
                    return (
                      <div key={t.id} className={`grid grid-cols-[32px_1fr_100px_100px_100px_90px_40px] gap-3 px-4 py-2.5 items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedTask?.id === t.id ? 'bg-brand-50/40' : ''}`}
                        onClick={() => selectTask(t)}>
                        <button onClick={e => { e.stopPropagation(); handleToggleComplete(t) }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-brand-400'}`}>
                          {t.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                        </button>
                        <span className={`text-sm truncate ${t.completed ? 'line-through text-gray-700' : 'text-gray-900'}`}>{t.title}</span>
                        <span className="text-sm text-gray-700 truncate">{t.assignee_name || '\u2014'}</span>
                        <span className="text-[13px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: status.color + '18', color: status.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />{status.label}
                        </span>
                        <span className="text-[13px] font-medium px-2 py-0.5 rounded-full" style={{ background: priority.color + '18', color: priority.color }}>{priority.label}</span>
                        <span className="text-[13px] text-gray-700">{t.due_date ? format(new Date(t.due_date), 'MMM d') : '\u2014'}</span>
                        <button onClick={e => { e.stopPropagation(); handleDeleteTask(t.id) }} className="text-gray-600 hover:text-brand-500 transition-colors"><Trash2 size={12} strokeWidth={1.5} /></button>
                      </div>
                    )
                  })}
                </div>

                <p className="text-sm text-gray-700 mt-3">{tasks.length} tasks &middot; {tasks.filter(t => t.completed).length} completed</p>
              </div>
            )}

            {/* BOARD VIEW */}
            {view === 'board' && (
              <div className="p-6 flex gap-4 overflow-x-auto h-full">
                {boardColumns.map(col => (
                  <div key={col.key} className="w-72 flex-shrink-0 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                      <h3 className="text-sm font-semibold text-gray-900">{col.label}</h3>
                      <span className="text-sm text-gray-700 ml-auto">{col.tasks.length}</span>
                    </div>
                    <div className="flex-1 space-y-2 min-h-[200px]">
                      {col.tasks.map(t => {
                        const priority = PRIORITIES.find(p => p.key === t.priority) || PRIORITIES[0]
                        return (
                          <div key={t.id} className={`bg-white rounded-xl border p-3 cursor-pointer hover:shadow-md transition-all ${selectedTask?.id === t.id ? 'border-brand-400 shadow-md' : 'border-gray-200'}`}
                            onClick={() => selectTask(t)}>
                            <div className="flex items-start gap-2">
                              <button onClick={e => { e.stopPropagation(); handleToggleComplete(t) }}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                {t.completed && <Check size={8} className="text-white" strokeWidth={3} />}
                              </button>
                              <p className={`text-sm flex-1 ${t.completed ? 'line-through text-gray-700' : 'text-gray-900'}`}>{t.title}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2 ml-6">
                              {t.priority !== 'none' && <span className="text-[13px] px-1.5 py-0.5 rounded font-medium" style={{ background: priority.color + '18', color: priority.color }}>{priority.label}</span>}
                              {t.due_date && <span className="text-[13px] text-gray-700 flex items-center gap-0.5"><Calendar size={8} />{format(new Date(t.due_date), 'MMM d')}</span>}
                              {t.assignee_name && <span className="text-[13px] text-gray-700 ml-auto flex items-center gap-0.5"><User size={8} />{t.assignee_name}</span>}
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={() => {
                        const title = prompt('Task name:')
                        if (!title) return
                        const pid = selectedProject === 'all' ? projects[0]?.id : selectedProject
                        if (!pid) { toast.error('Select a project'); return }
                        supabase.from('tasks').insert({ project_id: pid, title, status: col.key, priority: 'none', order_index: col.tasks.length, created_by: user?.email }).select().single().then(({ data }) => { if (data) setTasks(prev => [...prev, data]) })
                      }} className="w-full text-sm text-gray-700 hover:text-gray-600 py-2 flex items-center justify-center gap-1 hover:bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task detail panel */}
          {selectedTask && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-gray-900 text-sm">Task Details</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/task/${selectedTask.id}`)} className="text-gray-700 hover:text-gray-700 p-1 rounded" title="Open full page"><Maximize2 size={14} /></button>
                  <button onClick={() => setSelectedTask(null)} className="text-gray-700 hover:text-gray-600"><X size={16} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Title */}
                <input className="w-full text-lg font-bold text-gray-900 border-none focus:outline-none" value={selectedTask.title}
                  onChange={e => setSelectedTask(prev => ({ ...prev, title: e.target.value }))}
                  onBlur={() => handleUpdateTask(selectedTask.id, { title: selectedTask.title })} />

                {/* Status */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-20">Status</span>
                  <select className="input text-sm py-1.5 flex-1" value={selectedTask.status || 'todo'}
                    onChange={e => handleUpdateTask(selectedTask.id, { status: e.target.value, completed: e.target.value === 'completed', completed_at: e.target.value === 'completed' ? new Date().toISOString() : null })}>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-20">Priority</span>
                  <select className="input text-sm py-1.5 flex-1" value={selectedTask.priority || 'none'}
                    onChange={e => handleUpdateTask(selectedTask.id, { priority: e.target.value })}>
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>

                {/* Assignees (multi) */}
                <div>
                  <span className="text-sm text-gray-700 mb-1.5 block">Assignees</span>
                  {/* Current assignees */}
                  <div className="space-y-1 mb-2">
                    {(selectedTask.assignees || []).map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{(a.name || a.email || '?')[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{a.name || a.email}</p>
                          {a.name && <p className="text-[13px] text-gray-700 truncate">{a.email}</p>}
                        </div>
                        <button onClick={() => removeAssignee(a.email)} className="text-gray-700 hover:text-brand-500"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  {/* Add from team */}
                  {staffMembers.length > 0 && (
                    <select className="input text-sm py-1.5 w-full mb-1.5" value="" onChange={e => { const s = staffMembers.find(x => x.id === e.target.value); if (s) addAssigneeToTask(s.name || s.email.split('@')[0], s.email) }}>
                      <option value="">+ Add team member...</option>
                      {staffMembers.filter(s => !(selectedTask.assignees || []).some(a => a.email === s.email)).map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.email} ({s.role})</option>
                      ))}
                    </select>
                  )}
                  {/* Add by email */}
                  <div className="flex gap-1.5">
                    <input className="input text-sm py-1.5 flex-1" placeholder="Add by email..." value={newAssignee}
                      onChange={e => setNewAssignee(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newAssignee.trim()) { addAssigneeToTask(newAssignee.split('@')[0], newAssignee.trim()); setNewAssignee('') } }} />
                    <button onClick={() => { if (newAssignee.trim()) { addAssigneeToTask(newAssignee.split('@')[0], newAssignee.trim()); setNewAssignee('') } }}
                      disabled={!newAssignee.trim()} className="text-brand-500 hover:text-brand-700 disabled:opacity-30"><UserPlus size={14} strokeWidth={1.5} /></button>
                  </div>
                </div>

                {/* Due date */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-20">Due date</span>
                  <input className="input text-sm py-1.5 flex-1" type="date" value={selectedTask.due_date || ''}
                    onChange={e => handleUpdateTask(selectedTask.id, { due_date: e.target.value || null })} />
                </div>

                {/* Project */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-20">Project</span>
                  <select className="input text-sm py-1.5 flex-1" value={selectedTask.project_id || ''}
                    onChange={e => handleUpdateTask(selectedTask.id, { project_id: e.target.value })}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.clientName} / {p.name}</option>)}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm text-gray-700 mb-1 block">Description</label>
                  <textarea className="input text-sm resize-none" rows={3} placeholder="Add details..." value={selectedTask.description || ''}
                    onChange={e => setSelectedTask(prev => ({ ...prev, description: e.target.value }))}
                    onBlur={() => handleUpdateTask(selectedTask.id, { description: selectedTask.description })} />
                </div>

                {/* Invite collaborator */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><UserPlus size={11} strokeWidth={1.5} /> Invite to task</h4>
                  <div className="flex gap-2">
                    <input className="input text-sm py-1.5 flex-1" type="email" placeholder="email@..." value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleInvite() }} />
                    <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="text-brand-500 hover:text-brand-700 disabled:opacity-30"><Mail size={14} strokeWidth={1.5} /></button>
                  </div>
                </div>

                {/* Comments */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><MessageSquare size={11} strokeWidth={1.5} /> Comments ({comments.length})</h4>
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {comments.map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">{c.author_name}</span>
                          <span className="text-[13px] text-gray-700">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{c.text}</p>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-sm text-gray-700 text-center py-3">No comments yet</p>}
                  </div>
                  <div className="flex gap-2">
                    <input className="input text-sm py-1.5 flex-1" placeholder="Add a comment..." value={newComment}
                      onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }} />
                    <button onClick={handleAddComment} disabled={!newComment.trim()} className="text-brand-500 hover:text-brand-700 disabled:opacity-30"><Send size={14} strokeWidth={1.5} /></button>
                  </div>
                </div>

                {/* Meta */}
                <div className="border-t border-gray-100 pt-3 text-[13px] text-gray-700 space-y-1">
                  <p>Created by: {selectedTask.created_by || 'Unknown'}</p>
                  <p>Created: {selectedTask.created_at ? format(new Date(selectedTask.created_at), 'MMM d yyyy h:mm a') : '\u2014'}</p>
                  {selectedTask.completed_at && <p>Completed: {format(new Date(selectedTask.completed_at), 'MMM d yyyy h:mm a')}</p>}
                </div>

                <button onClick={() => handleDeleteTask(selectedTask.id)} className="w-full text-sm text-brand-500 hover:bg-brand-50 py-2 rounded-lg flex items-center justify-center gap-1 border border-brand-200"><Trash2 size={11} strokeWidth={1.5} /> Delete task</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
