"use client";
"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileImage, Clock, MessageSquare, Send, ExternalLink, LogOut, Calendar, CheckCircle, AlertTriangle, Globe, Smartphone, Palette, Mail, Printer, Film, BarChart2, Folder } from 'lucide-react'
import { supabase, getProjectsByClientEmail, getFiles, getRounds, signOut } from '../lib/supabase'
import { useAuth, getFirstName, getGreeting } from '../hooks/useAuth'
import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'

const TYPE_ICONS = { website: Globe, mobile: Smartphone, brand: Palette, email: Mail, print: Printer, social: Film, presentation: BarChart2, other: Folder }
function TypeIcon({ type, size = 20, className = '' }) { const I = TYPE_ICONS[type] || Folder; return <I size={size} strokeWidth={1.5} className={className || 'text-brand-500'} /> }

export default function ClientDashboardPage() {
  const { user } = useAuth()
  const firstName = getFirstName(user)
  const greeting  = getGreeting(firstName)
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
      <div style={{ background:'#000', padding:'0' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'#ea2729', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', letterSpacing:-0.3 }}>{greeting}</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,.45)', marginTop:1 }}>Client Portal · Powered by Moose AI</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {firstName && (
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#ea2729', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff' }}>
                {firstName[0].toUpperCase()}
              </div>
            )}
            <button onClick={handleSignOut} style={{ fontSize:14, color:'rgba(255,255,255,.5)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 style={{ fontSize:28, fontWeight:900, color:'#111', letterSpacing:-0.5, marginBottom:4 }}>{firstName ? `${firstName}'s Projects` : 'Your Projects'}</h1>
        <p style={{ fontSize:16, color:'#374151', marginBottom:28 }}>Review designs, leave feedback, and track revision rounds.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 card p-8">
            <FileImage size={48} className="text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-black text-gray-900 mb-2">No projects found</h2>
            <p className="text-base text-gray-800">No projects are linked to {user?.email}. Contact Moose if you believe this is an error.</p>
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
                          <h3 className="font-black text-gray-900">{project.name}</h3>
                          <p className="text-base text-gray-800">{project.clients?.name}</p>
                        </div>
                      </div>
                      {isComplete && <span className="text-base bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><CheckCircle size={10} /> Complete</span>}
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-base text-gray-800 mb-1">
                        <span>Round {Math.min(roundsUsed + 1, maxRounds)} of {maxRounds}</span>
                        <span>{Math.round((roundsUsed / maxRounds) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${(roundsUsed / maxRounds) * 100}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mb-4">
                      <span className="text-base text-gray-800 flex items-center gap-1"><FileImage size={10} /> {pd.files.length} files</span>
                      {openComments > 0 && <span className="text-base text-amber-700 font-bold flex items-center gap-1"><MessageSquare size={10} /> {openComments} open</span>}
                      {due && <span className={`text-base px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${due.cls}`}>
                        {due.urgent ? <AlertTriangle size={9} /> : <Calendar size={9} />} {due.label}
                      </span>}
                    </div>

                    {pd.files.length > 0 && (
                      <div className="flex gap-2 mb-4">
                        {pd.files.slice(0, 4).map(f => (
                          <a key={f.id} href={`/review/${f.public_token}`} className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-brand-300 transition-all">
                            {f.type?.startsWith('image/') ? <img src={f.url} alt="" className="w-full h-full object-cover" /> : <FileImage size={16} className="text-gray-700" />}
                          </a>
                        ))}
                        {pd.files.length > 4 && <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-base text-gray-800">+{pd.files.length - 4}</div>}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
                    {pd.files.length > 0 ? (
                      <a href={`/review/${pd.files[0].public_token}`} className="text-base font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                        Review Now <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-base text-gray-800">No files to review yet</span>
                    )}
                    <span className="text-base text-gray-700 font-medium">{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
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
