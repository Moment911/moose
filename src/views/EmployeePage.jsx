"use client";
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Users, CheckSquare, Clock, AlertTriangle, Wand2, Copy, Send, Mail, Loader2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, sendEmailSummary } from '../lib/supabase'
import { callClaude } from '../lib/ai'
import { format, formatDistanceToNow, isToday, isPast, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'

const ROLES_CLS = { owner: 'bg-brand-50 text-brand-700', manager: 'bg-blue-50 text-blue-700', designer: 'bg-purple-50 text-purple-700', viewer: 'bg-gray-100 text-gray-600' }

export default function EmployeePage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [tasks, setTasks] = useState([])
  const [access, setAccess] = useState([])
  const [clients, setClients] = useState([])
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [summaryType, setSummaryType] = useState('daily')

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (staffId) loadStaffDetail(staffId) }, [staffId, staff])

  async function loadAll() {
    try { const { data } = await supabase.from('staff_members').select('*').order('created_at'); setStaff(data || []) } catch { setStaff([]) }
    try { const { data } = await supabase.from('staff_client_access').select('*'); setAccess(data || []) } catch {}
    const { data: c } = await supabase.from('clients').select('*').order('name'); setClients(c || [])
  }

  async function loadStaffDetail(id) {
    const person = staff.find(s => s.id === id)
    if (person) {
      setSelectedStaff(person)
      const { data } = await supabase.from('tasks').select('*, projects(name, clients(name))').or(`assignee_email.eq.${person.email},assignees.cs.[{"email":"${person.email}"}]`).order('due_date', { ascending: true, nullsFirst: false })
      setTasks(data || [])
    }
  }

  async function generateSummary(type) {
    if (!selectedStaff) return
    setAiLoading(true); setSummaryType(type); setAiSummary('')
    const completed = tasks.filter(t => t.completed)
    const inProgress = tasks.filter(t => !t.completed && t.status === 'in_progress')
    const overdue = tasks.filter(t => !t.completed && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)))
    const today = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)))

    const context = `Employee: ${selectedStaff.name || selectedStaff.email}\nRole: ${selectedStaff.role}\n\nCompleted tasks: ${completed.length}\n${completed.slice(0, 10).map(t => `- ${t.title} (${t.projects?.name || 'no project'})`).join('\n')}\n\nIn progress: ${inProgress.length}\n${inProgress.map(t => `- ${t.title} (${t.projects?.name || 'no project'})`).join('\n')}\n\nOverdue: ${overdue.length}\n${overdue.map(t => `- ${t.title} due ${t.due_date}`).join('\n')}\n\nDue today: ${today.length}\n${today.map(t => `- ${t.title}`).join('\n')}\n\nTotal assigned tasks: ${tasks.length}`

    try {
      const prompt = type === 'daily'
        ? `Write a professional daily work summary for this team member. Include what was accomplished today, what's in progress, and any blockers. Keep it concise (3-4 paragraphs). Format with bullet points where appropriate.`
        : `Write a professional weekly work summary for this team member. Summarize the week's accomplishments, progress on ongoing work, upcoming deadlines, and areas needing attention. Include metrics where possible. Format professionally with sections.`

      const result = await callClaude('You are a professional project manager writing work summaries for a design agency called Koto.', `${prompt}\n\nContext:\n${context}`, 1500)
      setAiSummary(result)
    } catch { setAiSummary('AI summary unavailable. Set NEXT_PUBLIC_ANTHROPIC_API_KEY in Vercel environment variables.') }
    setAiLoading(false)
  }

  // Employee list view
  if (!staffId) {
    const getTaskCount = (email) => 0 // Would need async, skip for now
    return (
      <div className="page-shell flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white">
          <div style={{ background: "#231f20" }} className="hidden md:block px-8 py-6">
            <h1 className="text-2xl font-black text-white">Team</h1>
            <p className="text-sm text-gray-700 mt-1">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="px-4 md:px-8 py-4 md:py-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_180px_100px_100px_80px] gap-4 px-5 py-3 bg-gray-50 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b">
                <div>Name</div><div>Email</div><div>Role</div><div>Clients</div><div>Status</div>
              </div>
              {staff.length === 0 && <div className="py-16 text-center text-sm text-gray-700">No team members yet. Add them in Admin Portal.</div>}
              {staff.map(s => {
                const clientCount = access.filter(a => a.staff_id === s.id && a.can_view).length
                return (
                  <div key={s.id} className="grid grid-cols-[1fr_180px_100px_100px_80px] gap-4 px-5 py-3.5 items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/employees/${s.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center">{(s.name || s.email || '?')[0].toUpperCase()}</div>
                      <span className="text-sm font-medium text-gray-900">{s.name || s.email}</span>
                    </div>
                    <div className="text-sm text-gray-700 truncate">{s.email}</div>
                    <div><span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLES_CLS[s.role] || ROLES_CLS.viewer}`}>{s.role}</span></div>
                    <div className="text-sm text-gray-700">{clientCount} client{clientCount !== 1 ? 's' : ''}</div>
                    <div><span className={`text-sm px-2 py-0.5 rounded-full font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s.active ? 'Active' : 'Off'}</span></div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Employee detail view
  if (!selectedStaff) return <div className="flex h-screen"><Sidebar /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>

  const completedTasks = tasks.filter(t => t.completed)
  const activeTasks = tasks.filter(t => !t.completed)
  const overdueTasks = activeTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)))
  const staffClients = access.filter(a => a.staff_id === staffId && a.can_view).map(a => clients.find(c => c.id === a.client_id)).filter(Boolean)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        <div style={{ background: "#231f20" }} className="hidden md:block px-8 py-6">
          <button onClick={() => navigate('/employees')} className="text-gray-700 hover:text-white text-sm flex items-center gap-1 mb-2"><ChevronLeft size={14} /> Team</button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500 text-white text-xl font-extrabold flex items-center justify-center">{(selectedStaff.name || selectedStaff.email)[0].toUpperCase()}</div>
            <div>
              <h1 className="text-2xl font-black text-white">{selectedStaff.name || selectedStaff.email}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLES_CLS[selectedStaff.role] || ROLES_CLS.viewer}`}>{selectedStaff.role}</span>
                <span className="text-sm text-gray-700">{selectedStaff.email}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 md:py-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Tasks', value: activeTasks.length, icon: CheckSquare },
              { label: 'Completed', value: completedTasks.length, icon: CheckSquare },
              { label: 'Overdue', value: overdueTasks.length, icon: AlertTriangle },
              { label: 'Clients', value: staffClients.length, icon: Users },
            ].map(s => { const I = s.icon; return (
              <div key={s.label} className="card p-4">
                <I size={16} strokeWidth={1.5} className="text-brand-500 mb-2" />
                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-700">{s.label}</p>
              </div>
            )})}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Tasks */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Assigned Tasks ({tasks.length})</h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden max-h-[400px] overflow-y-auto">
                {tasks.length === 0 && <div className="py-8 text-center text-sm text-gray-700">No tasks assigned</div>}
                {tasks.map(t => (
                  <div key={t.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/task/${t.id}`)}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {t.completed && <CheckSquare size={8} className="text-white" />}
                      </div>
                      <span className={`text-sm flex-1 ${t.completed ? 'line-through text-gray-700' : 'text-gray-900'}`}>{t.title}</span>
                      {t.due_date && <span className={`text-[13px] ${overdueTasks.includes(t) ? 'text-brand-500 font-medium' : 'text-gray-700'}`}>{format(new Date(t.due_date), 'MMM d')}</span>}
                    </div>
                    {t.projects?.name && <p className="text-[13px] text-gray-700 ml-6 mt-0.5">{t.projects.clients?.name} / {t.projects.name}</p>}
                  </div>
                ))}
              </div>

              {/* Assigned clients */}
              <h2 className="text-sm font-semibold text-gray-900 mt-6 mb-3">Assigned Clients ({staffClients.length})</h2>
              <div className="space-y-2">
                {staffClients.map(c => (
                  <div key={c.id} className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:shadow-sm" onClick={() => navigate(`/client/${c.id}`)}>
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="text-sm text-gray-700">{c.email}</span>
                  </div>
                ))}
                {staffClients.length === 0 && <p className="text-sm text-gray-700">No clients assigned</p>}
              </div>
            </div>

            {/* Right: AI Summary */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Wand2 size={14} strokeWidth={1.5} className="text-brand-500" /> AI Work Summary</h2>
              <div className="card p-5">
                <div className="flex gap-2 mb-4">
                  <button onClick={() => generateSummary('daily')} disabled={aiLoading}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors ${summaryType === 'daily' && aiSummary ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {aiLoading && summaryType === 'daily' ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null} Daily Summary
                  </button>
                  <button onClick={() => generateSummary('weekly')} disabled={aiLoading}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors ${summaryType === 'weekly' && aiSummary ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {aiLoading && summaryType === 'weekly' ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null} Weekly Summary
                  </button>
                </div>

                {aiLoading && <div className="text-center py-8"><Loader2 size={24} className="text-brand-500 animate-spin mx-auto mb-2" /><p className="text-sm text-gray-700">Generating summary...</p></div>}

                {aiSummary && !aiLoading && (
                  <div>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4 max-h-[300px] overflow-y-auto">{aiSummary}</div>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(aiSummary); toast.success('Copied!') }} className="btn-secondary text-sm flex-1"><Copy size={12} strokeWidth={1.5} /> Copy</button>
                      <button onClick={async () => { await sendEmailSummary({ type: 'employee_summary', to: selectedStaff.email, subject: `${summaryType === 'daily' ? 'Daily' : 'Weekly'} Summary - ${selectedStaff.name}`, message: aiSummary }); toast.success('Emailed!') }} className="btn-secondary text-sm flex-1"><Mail size={12} strokeWidth={1.5} /> Email</button>
                    </div>
                  </div>
                )}

                {!aiSummary && !aiLoading && <p className="text-sm text-gray-700 text-center py-6">Click a button above to generate an AI work summary for {selectedStaff.name || 'this team member'}.</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
