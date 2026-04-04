"use client";
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Download, Clock, Calendar as CalIcon } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, startOfDay, addHours, getHours } from 'date-fns'
import toast from 'react-hot-toast'

const EVENT_TYPES = [
  { key: 'task', label: 'Task', color: '#3b82f6' },
  { key: 'event', label: 'Event', color: '#22c55e' },
  { key: 'reminder', label: 'Reminder', color: '#f59e0b' },
]

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ea2729', '#8b5cf6', '#06b6d4', '#ec4899', '#231f20']

export default function CalendarPage() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [view, setView] = useState('month')
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])

  // Form state
  const [form, setForm] = useState({ title: '', type: 'task', description: '', start_at: '', end_at: '', all_day: false, color: '#3b82f6', project_id: '', client_id: '', reminder_minutes: null })

  useEffect(() => { loadEvents(); loadProjects() }, [currentDate])

  async function loadEvents() {
    const start = format(startOfWeek(startOfMonth(currentDate)), 'yyyy-MM-dd')
    const end = format(addDays(endOfWeek(endOfMonth(currentDate)), 7), 'yyyy-MM-dd')
    const { data: calEvents } = await supabase.from('calendar_events').select('*').gte('start_at', start).lte('start_at', end).order('start_at')
    // Also load tasks with due dates as calendar items
    const { data: taskEvents } = await supabase.from('tasks').select('*, projects(name)').gte('due_date', start).lte('due_date', end).order('due_date')
    const tasksMapped = (taskEvents || []).map(t => ({ id: 'task-' + t.id, title: t.title, type: 'task', start_at: t.due_date + 'T09:00:00', color: t.completed ? '#22c55e' : '#3b82f6', project_id: t.project_id, client_id: t.client_id, _isTask: true, _taskId: t.id }))
    setEvents([...(calEvents || []), ...tasksMapped])
  }

  async function loadProjects() {
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    setClients(cl || [])
    const projs = []
    for (const c of (cl || [])) { const { data } = await supabase.from('projects').select('*').eq('client_id', c.id); projs.push(...(data || []).map(p => ({ ...p, clientName: c.name }))) }
    setProjects(projs)
  }

  function openNew(date) {
    const d = date || new Date()
    setEditEvent(null)
    setForm({ title: '', type: 'task', description: '', start_at: format(d, "yyyy-MM-dd'T'HH:mm"), end_at: format(addHours(d, 1), "yyyy-MM-dd'T'HH:mm"), all_day: false, color: '#3b82f6', project_id: '', client_id: '', reminder_minutes: null })
    setShowModal(true)
  }

  function openEdit(ev) {
    setEditEvent(ev)
    setForm({ title: ev.title, type: ev.type || 'task', description: ev.description || '', start_at: ev.start_at ? format(new Date(ev.start_at), "yyyy-MM-dd'T'HH:mm") : '', end_at: ev.end_at ? format(new Date(ev.end_at), "yyyy-MM-dd'T'HH:mm") : '', all_day: ev.all_day || false, color: ev.color || '#3b82f6', project_id: ev.project_id || '', client_id: ev.client_id || '', reminder_minutes: ev.reminder_minutes })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_at) { toast.error('Title and start date required'); return }
    const payload = { ...form, title: form.title.trim(), project_id: form.project_id || null, client_id: form.client_id || null, created_by: user?.email }
    if (editEvent) {
      await supabase.from('calendar_events').update(payload).eq('id', editEvent.id)
      // Also update linked task if type=task
      if (form.type === 'task' && editEvent.linked_task_id) {
        await supabase.from('tasks').update({ title: form.title.trim(), due_date: form.start_at?.split('T')[0], project_id: form.project_id || null, client_id: form.client_id || null }).eq('id', editEvent.linked_task_id)
      }
    } else {
      const { data: ev } = await supabase.from('calendar_events').insert(payload).select().single()
      // If type is task, also create in tasks table
      if (form.type === 'task' && ev && form.project_id) {
        const { data: task } = await supabase.from('tasks').insert({ project_id: form.project_id, client_id: form.client_id || null, title: form.title.trim(), due_date: form.start_at?.split('T')[0], status: 'todo', priority: 'none', created_by: user?.email }).select().single()
        if (task && ev) await supabase.from('calendar_events').update({ google_event_id: task.id }).eq('id', ev.id) // store task link
      }
    }
    toast.success(editEvent ? 'Updated' : 'Created'); setShowModal(false); loadEvents()
  }

  async function handleDelete() {
    if (!editEvent || !confirm('Delete this item?')) return
    await supabase.from('calendar_events').delete().eq('id', editEvent.id)
    toast.success('Deleted'); setShowModal(false); loadEvents()
  }

  function exportIcal() {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moose//EN']
    events.forEach(ev => {
      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART:${format(new Date(ev.start_at), "yyyyMMdd'T'HHmmss")}`)
      if (ev.end_at) lines.push(`DTEND:${format(new Date(ev.end_at), "yyyyMMdd'T'HHmmss")}`)
      lines.push(`SUMMARY:${ev.title}`)
      if (ev.description) lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`)
      lines.push(`UID:${ev.id}@moose`)
      lines.push('END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'moose-calendar.ics'; a.click()
    toast.success('Calendar exported!')
  }

  // Build month grid
  const monthStart = startOfMonth(currentDate)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(endOfMonth(currentDate))
  const days = []; let d = calStart; while (d <= calEnd) { days.push(d); d = addDays(d, 1) }

  // Week view hours
  const weekStart = startOfWeek(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center gap-4 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Calendar</h1>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={() => setCurrentDate(v => view === 'month' ? subMonths(v, 1) : addDays(v, -7))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-gray-900 min-w-[160px] text-center">{view === 'month' ? format(currentDate, 'MMMM yyyy') : `Week of ${format(weekStart, 'MMM d')}`}</span>
            <button onClick={() => setCurrentDate(v => view === 'month' ? addMonths(v, 1) : addDays(v, 7))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200">Today</button>
          <div className="flex bg-gray-100 rounded-lg p-0.5 ml-2">
            {['month', 'week'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{v}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportIcal} className="btn-secondary text-xs"><Download size={12} strokeWidth={1.5} /> Export iCal</button>
            <button onClick={() => openNew()} className="btn-primary text-xs"><Plus size={12} /> New Event</button>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-auto">
          {/* MONTH VIEW */}
          {view === 'month' && (
            <>
              <div className="grid grid-cols-7 border-b border-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 flex-1" style={{ minHeight: 'calc(100vh - 120px)' }}>
                {days.map((day, i) => {
                  const dayEvents = events.filter(ev => isSameDay(new Date(ev.start_at), day))
                  const today = isToday(day)
                  const thisMonth = isSameMonth(day, currentDate)
                  return (
                    <div key={i} className={`border-b border-r border-gray-100 p-1.5 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors ${thisMonth ? 'bg-white' : 'bg-gray-50/50'} ${today ? 'ring-1 ring-inset ring-brand-200' : ''}`}
                      onClick={() => openNew(startOfDay(day))}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${today ? 'bg-brand-500 text-white' : thisMonth ? 'text-gray-900' : 'text-gray-400'}`}>{format(day, 'd')}</span>
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={{ background: (ev.color || '#3b82f6') + '20', color: ev.color || '#3b82f6', borderLeft: `2px solid ${ev.color || '#3b82f6'}` }}
                            onClick={e => { e.stopPropagation(); openEdit(ev) }}>
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <span className="text-[9px] text-gray-400 pl-1">+{dayEvents.length - 3} more</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* WEEK VIEW */}
          {view === 'week' && (
            <div className="flex flex-1">
              {/* Time labels */}
              <div className="w-16 flex-shrink-0 border-r border-gray-200 pt-10">
                {hours.map(h => <div key={h} className="h-12 text-[10px] text-gray-400 text-right pr-2 -mt-2">{h === 0 ? '' : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`}</div>)}
              </div>
              {/* Day columns */}
              <div className="flex-1 flex">
                {weekDays.map((day, di) => {
                  const dayEvents = events.filter(ev => isSameDay(new Date(ev.start_at), day))
                  const today = isToday(day)
                  return (
                    <div key={di} className="flex-1 border-r border-gray-100">
                      <div className={`h-10 flex items-center justify-center text-xs font-semibold border-b border-gray-200 ${today ? 'text-brand-600 bg-brand-50' : 'text-gray-700'}`}>
                        {format(day, 'EEE d')}
                      </div>
                      <div className="relative">
                        {hours.map(h => (
                          <div key={h} className="h-12 border-b border-gray-50 cursor-pointer hover:bg-gray-50" onClick={() => openNew(addHours(startOfDay(day), h))} />
                        ))}
                        {dayEvents.map(ev => {
                          const startH = getHours(new Date(ev.start_at))
                          const endH = ev.end_at ? getHours(new Date(ev.end_at)) : startH + 1
                          return (
                            <div key={ev.id} className="absolute left-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 overflow-hidden"
                              style={{ top: startH * 48, height: Math.max((endH - startH) * 48, 20), background: (ev.color || '#3b82f6') + '20', color: ev.color || '#3b82f6', borderLeft: `2px solid ${ev.color || '#3b82f6'}` }}
                              onClick={() => openEdit(ev)}>
                              {ev.title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="h-8 bg-white border-t border-gray-100 px-4 flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
          <span>{events.length} items this month</span>
          <div className="flex gap-3 ml-auto">
            {EVENT_TYPES.map(t => <span key={t.key} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: t.color }} />{t.label}</span>)}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editEvent ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input className="input text-sm" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />

              <div className="flex gap-2">
                {EVENT_TYPES.map(t => (
                  <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key, color: t.color }))}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium border transition-colors ${form.type === t.key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Start</label><input className="input text-sm" type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} /></div>
                <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">End</label><input className="input text-sm" type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} /></div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-brand-500" /> All day</label>

              <textarea className="input text-sm resize-none" rows={2} placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Client</label>
                  <select className="input text-sm" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, project_id: '' }))}>
                    <option value="">None</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Project</label>
                  <select className="input text-sm" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} disabled={!form.client_id}>
                    <option value="">None</option>
                    {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Reminder</label>
                  <select className="input text-sm" value={form.reminder_minutes || ''} onChange={e => setForm(f => ({ ...f, reminder_minutes: e.target.value ? +e.target.value : null }))}>
                    <option value="">None</option>
                    <option value="15">15 min before</option>
                    <option value="30">30 min before</option>
                    <option value="60">1 hour before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Color</label>
                <div className="flex gap-1.5">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ background: c }}
                      className={`w-6 h-6 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <div>{editEvent && <button onClick={handleDelete} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"><Trash2 size={12} /> Delete</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
                <button onClick={handleSave} disabled={!form.title.trim()} className="btn-primary text-sm">{editEvent ? 'Save' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
