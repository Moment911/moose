"use client";
"use client";
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Trash2, Calendar, Flag, User, MessageSquare, Send, UserPlus, X, Paperclip, Clock, ArrowUpRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const STATUSES = [
  { key: 'todo', label: 'To Do', color: '#9ca3af' },
  { key: 'acknowledged', label: 'Acknowledged', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'more_info', label: 'More Info Needed', color: '#8b5cf6' },
  { key: 'in_review', label: 'In Review', color: '#06b6d4' },
  { key: 'pending', label: 'Pending', color: '#f97316' },
  { key: 'completed', label: 'Completed', color: '#22c55e' },
]

const PRIORITIES = [
  { key: 'none', label: 'None', color: '#d1d5db' },
  { key: 'low', label: 'Low', color: '#3b82f6' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'high', label: 'High', color: '#ea2729' },
  { key: 'urgent', label: 'Urgent', color: '#dc2626' },
]

export default function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [task, setTask] = useState(null)
  const [project, setProject] = useState(null)
  const [comments, setComments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [staffMembers, setStaffMembers] = useState([])
  const [newAssignee, setNewAssignee] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTask() }, [taskId])

  async function loadTask() {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*, projects(name, id, client_id, clients(name))').eq('id', taskId).single()
    if (data) { setTask(data); setProject(data.projects) }
    const { data: coms } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at')
    setComments(coms || [])
    try { const { data: att } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('uploaded_at'); setAttachments(att || []) } catch {}
    try { const { data: s } = await supabase.from('staff_members').select('*').eq('active', true); setStaffMembers(s || []) } catch {}
    setLoading(false)
  }

  async function update(updates) {
    const { data } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', taskId).select('*, projects(name, id, client_id, clients(name))').single()
    if (data) setTask(data)
  }

  function handleCommentChange(val) {
    setNewComment(val)
    const match = val.match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1].toLowerCase()); setShowMentions(true) }
    else setShowMentions(false)
  }

  function insertMention(person) {
    const before = newComment.replace(/@\w*$/, '')
    setNewComment(before + `@${person.name || person.email.split('@')[0]} `)
    setShowMentions(false)
  }

  function renderMentions(text) {
    return text.replace(/@(\w+)/g, '<span style="color:#ea2729;font-weight:600">@$1</span>')
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    const mentions = (newComment.match(/@(\w+)/g) || []).map(m => m.slice(1))
    const { data } = await supabase.from('task_comments').insert({ task_id: taskId, text: newComment.trim(), author_name: user?.email?.split('@')[0] || 'Admin', author_email: user?.email }).select().single()
    if (data) { setComments(prev => [...prev, data]); setNewComment('') }
    // Send email notifications for mentions
    for (const name of mentions) {
      const person = staffMembers.find(s => (s.name || s.email.split('@')[0]).toLowerCase() === name.toLowerCase())
      if (person?.email) {
        supabase.functions.invoke('send-email', { body: { type: 'mention', to: person.email, subject: `${user?.email?.split('@')[0]} mentioned you in "${task?.title}"`, message: newComment, link: `${window.location.origin}/task/${taskId}` } }).catch(() => {})
      }
    }
  }

  async function handleUploadAttachment(e) {
    const file = e.target.files?.[0]; if (!file) return
    toast.loading('Uploading...', { id: 'att' })
    try {
      const path = `task-attachments/${taskId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
      await supabase.storage.from('review-files').upload(path, file)
      const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(path)
      const { data } = await supabase.from('task_attachments').insert({ task_id: taskId, name: file.name, url: urlData.publicUrl, type: file.type, size: file.size }).select().single()
      if (data) setAttachments(prev => [...prev, data])
      toast.success('Uploaded!', { id: 'att' })
    } catch { toast.error('Upload failed', { id: 'att' }) }
    e.target.value = ''
  }

  function addAssignee(name, email) {
    const current = task?.assignees || []
    if (current.some(a => a.email === email)) return
    update({ assignees: [...current, { name, email, type: 'email' }], assignee_name: [...current, { name }].map(a => a.name).join(', ') })
  }

  function removeAssignee(email) {
    const updated = (task?.assignees || []).filter(a => a.email !== email)
    update({ assignees: updated, assignee_name: updated.map(a => a.name).join(', ') })
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    toast.success('Deleted'); navigate('/tasks')
  }

  if (loading) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>

  if (!task) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center text-gray-400">Task not found</div></div>

  const status = STATUSES.find(s => s.key === task.status) || STATUSES[0]
  const priority = PRIORITIES.find(p => p.key === task.priority) || PRIORITIES[0]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              {project?.clients?.name && <span className="text-gray-400">{project.clients.name}</span>}
              {project?.name && <><span className="text-gray-300">/</span><span className="text-gray-400">{project.name}</span></>}
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-900 truncate">{task.title}</span>
            </div>
          </div>
          <button onClick={handleDelete} className="text-gray-400 hover:text-brand-500 p-1.5 rounded-lg hover:bg-brand-50"><Trash2 size={15} strokeWidth={1.5} /></button>
        </div>

        {/* Two column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — Task details */}
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl">
            {/* Title */}
            <input className="w-full text-2xl font-bold text-gray-900 border-none focus:outline-none mb-4" value={task.title}
              onChange={e => setTask(prev => ({ ...prev, title: e.target.value }))}
              onBlur={() => update({ title: task.title })} />

            {/* Status + Priority row */}
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => update({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null, status: !task.completed ? 'completed' : 'todo' })}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${task.completed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                  {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                {task.completed ? 'Completed' : 'Mark Complete'}
              </button>
              <select className="text-sm font-medium px-3 py-2 rounded-xl border-0 cursor-pointer" style={{ background: status.color + '15', color: status.color }}
                value={task.status || 'todo'} onChange={e => update({ status: e.target.value, completed: e.target.value === 'completed', completed_at: e.target.value === 'completed' ? new Date().toISOString() : null })}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select className="text-sm font-medium px-3 py-2 rounded-xl border-0 cursor-pointer" style={{ background: priority.color + '15', color: priority.color }}
                value={task.priority || 'none'} onChange={e => update({ priority: e.target.value })}>
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
                <input className="input text-sm" type="date" value={task.due_date || ''} onChange={e => update({ due_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Project</label>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  {project?.name || 'Unassigned'}
                  {project?.id && <button onClick={() => navigate(`/project/${project.id}`)} className="text-brand-500 hover:text-brand-700 ml-auto"><ArrowUpRight size={13} /></button>}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <textarea className="input text-sm resize-none w-full" rows={5} placeholder="Add a detailed description..."
                value={task.description || ''} onChange={e => setTask(prev => ({ ...prev, description: e.target.value }))}
                onBlur={() => update({ description: task.description })} />
            </div>

            {/* Assignees */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block">Assignees</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(task.assignees || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-2.5 py-1">
                    <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{(a.name || a.email || '?')[0].toUpperCase()}</div>
                    <span className="text-sm text-gray-700">{a.name || a.email}</span>
                    <button onClick={() => removeAssignee(a.email)} className="text-gray-400 hover:text-brand-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {staffMembers.length > 0 && (
                  <select className="input text-sm flex-1" value="" onChange={e => { const s = staffMembers.find(x => x.id === e.target.value); if (s) addAssignee(s.name || s.email.split('@')[0], s.email) }}>
                    <option value="">+ Add team member</option>
                    {staffMembers.filter(s => !(task.assignees || []).some(a => a.email === s.email)).map(s => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                  </select>
                )}
                <input className="input text-sm flex-1" placeholder="Add by email..." value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newAssignee.trim()) { addAssignee(newAssignee.split('@')[0], newAssignee.trim()); setNewAssignee('') } }} />
              </div>
            </div>

            {/* Attachments */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1"><Paperclip size={11} /> Attachments ({attachments.length})</label>
              <div className="space-y-2 mb-2">
                {attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    {a.type?.startsWith('image/') ? <img src={a.url} alt="" className="w-10 h-10 rounded object-cover" /> : <Paperclip size={16} className="text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-400">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : ''} {a.uploaded_at && format(new Date(a.uploaded_at), 'MMM d')}</p>
                    </div>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-700 text-xs">Open</a>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200 hover:border-gray-300">
                <Paperclip size={13} /> Upload file
                <input type="file" className="hidden" onChange={handleUploadAttachment} />
              </label>
            </div>

            {/* Meta */}
            <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 space-y-1">
              <p className="flex items-center gap-1"><Clock size={11} /> Created {task.created_at && formatDistanceToNow(new Date(task.created_at), { addSuffix: true })} by {task.created_by || 'Unknown'}</p>
              {task.completed_at && <p className="flex items-center gap-1"><Check size={11} /> Completed {format(new Date(task.completed_at), 'MMM d yyyy h:mm a')}</p>}
            </div>
          </div>

          {/* Right — Comments + Activity */}
          <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><MessageSquare size={14} strokeWidth={1.5} /> Comments</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {comments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No comments yet</p>}
              {comments.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center">{(c.author_name || '?')[0].toUpperCase()}</div>
                    <span className="text-sm font-medium text-gray-800">{c.author_name}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMentions(c.text) }} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex-shrink-0 relative">
              {/* @mention dropdown */}
              {showMentions && (
                <div className="absolute bottom-full left-5 right-5 bg-white rounded-xl border border-gray-200 shadow-lg mb-1 max-h-32 overflow-y-auto z-10">
                  {staffMembers.filter(s => !mentionQuery || (s.name || s.email).toLowerCase().includes(mentionQuery)).slice(0, 5).map(s => (
                    <button key={s.id} onClick={() => insertMention(s)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                      <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[8px] font-bold flex items-center justify-center">{(s.name || s.email)[0].toUpperCase()}</div>
                      <span className="text-gray-800">{s.name || s.email}</span>
                      <span className="text-xs text-gray-400 ml-auto">{s.role}</span>
                    </button>
                  ))}
                  {staffMembers.filter(s => !mentionQuery || (s.name || s.email).toLowerCase().includes(mentionQuery)).length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No matches</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input className="input text-sm flex-1" placeholder="Write a comment... (type @ to mention)" value={newComment}
                  onChange={e => handleCommentChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !showMentions) handleAddComment(); if (e.key === 'Escape') setShowMentions(false) }} />
                <button onClick={handleAddComment} disabled={!newComment.trim()} className="bg-brand-500 text-white px-3 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-30 transition-colors"><Send size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
