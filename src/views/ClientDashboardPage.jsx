"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileImage, Clock, MessageSquare, Send, ExternalLink, LogOut, Calendar, CheckCircle, AlertTriangle, Globe, Smartphone, Palette, Mail, Printer, Film, BarChart2, Folder } from 'lucide-react'
import { supabase, getProjectsByClientEmail, getFiles, getRounds, signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'

const TYPE_ICONS = { website: Globe, mobile: Smartphone, brand: Palette, email: Mail, print: Printer, social: Film, presentation: BarChart2, other: Folder }
function TypeIcon({ type, size = 20, className = '' }) { const I = TYPE_ICONS[type] || Folder; return <I size={size} strokeWidth={1.5} className={className || 'text-brand-500'} /> }

export default function ClientDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [projectData, setProjectData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user?.email) loadProjects() }, [user])

  async function loadProjects() {
    setLoading(true)
    const projs = await getProjectsByClientEmail(user.email)
    setProjects(projs)
    for (const p of projs) {
      const [{ data: files }, { data: rounds }] = await Promise.all([getFiles(p.id), getRounds(p.id)])
      setProjectData(prev => ({ ...prev, [p.id]: { files: files || [], rounds: rounds || [] } }))
    }
    setLoading(false)
  }

  function getDueStatus(project, rounds) {
    const dueDate = project.due_date
    if (!dueDate) return null
    const days = differenceInDays(new Date(dueDate), new Date())
    if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`, cls: 'bg-red-50 text-red-700', urgent: true }
    if (days === 0) return { label: 'Due today!', cls: 'bg-red-50 text-red-700', urgent: true }
    if (days <= 3) return { label: `${days} day${days !== 1 ? 's' : ''} remaining`, cls: 'bg-amber-50 text-amber-700', urgent: false }
    return { label: `Due ${format(new Date(dueDate), 'MMM d')}`, cls: 'bg-gray-100 text-gray-600', urgent: false }
  }

  async function handleSignOut() { await signOut(); navigate('/client-login') }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="text-white px-6 py-4" style={{ background: '#231f20' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ea2729' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div className="text-sm font-semibold">Momenta Marketing</div>
              <div className="text-[10px] text-gray-400">Client Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{user?.email}</span>
            <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-white flex items-center gap-1"><LogOut size={12} /> Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Projects</h1>
        <p className="text-sm text-gray-500 mb-8">Review designs, leave feedback, and track revision rounds.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 card p-8">
            <FileImage size={48} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-700 mb-2">No projects found</h2>
            <p className="text-sm text-gray-500">No projects are linked to {user?.email}. Contact Momenta Marketing if you believe this is an error.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map(project => {
              const pd = projectData[project.id] || { files: [], rounds: [] }
              const maxRounds = project.max_rounds || 2
              const roundsUsed = pd.rounds.length
              const openComments = pd.files.reduce((a, f) => a + (f.open_comments || 0), 0)
              const due = getDueStatus(project, pd.rounds)
              const isComplete = roundsUsed >= maxRounds

              return (
                <div key={project.id} className="card overflow-hidden hover:shadow-lg transition-all">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={project.project_type || 'other'} size={24} />
                        <div>
                          <h3 className="font-semibold text-gray-900">{project.name}</h3>
                          <p className="text-xs text-gray-500">{project.clients?.name}</p>
                        </div>
                      </div>
                      {isComplete && <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><CheckCircle size={10} /> Complete</span>}
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Round {Math.min(roundsUsed + 1, maxRounds)} of {maxRounds}</span>
                        <span>{Math.round((roundsUsed / maxRounds) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${(roundsUsed / maxRounds) * 100}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mb-4">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><FileImage size={10} /> {pd.files.length} files</span>
                      {openComments > 0 && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><MessageSquare size={10} /> {openComments} open</span>}
                      {due && <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${due.cls}`}>
                        {due.urgent ? <AlertTriangle size={9} /> : <Calendar size={9} />} {due.label}
                      </span>}
                    </div>

                    {pd.files.length > 0 && (
                      <div className="flex gap-2 mb-4">
                        {pd.files.slice(0, 4).map(f => (
                          <a key={f.id} href={`/review/${f.public_token}`} className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-brand-300 transition-all">
                            {f.type?.startsWith('image/') ? <img src={f.url} alt="" className="w-full h-full object-cover" /> : <FileImage size={16} className="text-gray-400" />}
                          </a>
                        ))}
                        {pd.files.length > 4 && <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-500">+{pd.files.length - 4}</div>}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
                    {pd.files.length > 0 ? (
                      <a href={`/review/${pd.files[0].public_token}`} className="text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1">
                        Review Now <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">No files to review yet</span>
                    )}
                    <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
