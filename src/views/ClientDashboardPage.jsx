"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileImage, Clock, MessageSquare, Send, ExternalLink, LogOut,
  Calendar, CheckCircle, AlertTriangle, Globe, Smartphone,
  Palette, Mail, Printer, Film, BarChart2, Folder,
  Inbox, Plus, Loader2, ChevronRight, Tag, Timer, Sparkles
} from 'lucide-react'
import { supabase, getProjectsByClientEmail, getFiles, getRounds, signOut } from '../lib/supabase'
import { useAuth, getFirstName, getGreeting } from '../hooks/useAuth'
import { triageTicket, logActivity, CATEGORIES } from '../lib/moosedesk'
import { emailTicketCreated } from '../lib/deskEmail'
import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'

const TYPE_ICONS = { website: Globe, mobile: Smartphone, brand: Palette, email: Mail, print: Printer, social: Film, presentation: BarChart2, other: Folder }
function TypeIcon({ type, size = 20 }) { const I = TYPE_ICONS[type] || Folder; return <I size={size} strokeWidth={1.5} style={{color:'#ea2729'}}/> }

const STATUS_CFG = {
  new:         { label:'New',         color:'#8b5cf6', bg:'#f5f3ff' },
  open:        { label:'Open',        color:'#3b82f6', bg:'#eff6ff' },
  in_progress: { label:'In Progress', color:'#f59e0b', bg:'#fffbeb' },
  pending:     { label:'Pending',     color:TEAL,      bg:'#e8f9fa' },
  waiting:     { label:'Waiting',     color:'#6b7280', bg:'#f9fafb' },
  resolved:    { label:'Resolved',    color:'#16a34a', bg:'#f0fdf4' },
  closed:      { label:'Closed',      color:'#374151', bg:'#f3f4f6' },
}

const PRI_CFG = {
  low:'↓ Low', normal:'→ Normal', high:'↑ High', urgent:'⚡ Urgent', critical:'🔴 Critical'
}

// ── New ticket form ───────────────────────────────────────────────────────────
function NewTicketForm({ user, onSubmitted }) {
  const [form, setForm] = useState({ subject:'', description:'', category:'general', priority:'normal' })
  const [step, setStep] = useState('form')  // form | triaging | done
  const INP = { width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e7eb',
    fontSize:15, outline:'none', color:'#111', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' }

  async function submit() {
    if (!form.subject.trim() || !form.description.trim()) { toast.error('Subject and description required'); return }
    setStep('triaging')
    try {
      // Find agency — use the bypass agency for now
      const agencyId = '00000000-0000-0000-0000-000000000099'
      const { data: ticket, error } = await supabase.from('desk_tickets').insert({
        agency_id: agencyId,
        submitter_name:  getFirstName(user) || user.email.split('@')[0],
        submitter_email: user.email,
        submitter_user_id: user.id,
        subject:     form.subject,
        description: form.description,
        category:    form.category,
        priority:    form.priority,
        status:      'new',
      }).select().single()
      if (error) throw error

      await logActivity(ticket.id,
        { name: getFirstName(user)||user.email.split('@')[0], type:'client' },
        'created', 'Client submitted ticket via portal')

      // AI triage
      try {
        const { data: kb } = await supabase.from('desk_knowledge')
          .select('*').eq('agency_id', agencyId).limit(10)
        const ai = await triageTicket(ticket, kb||[])
        await supabase.from('desk_tickets').update({
          ai_category: ai.category, ai_priority: ai.priority,
          ai_summary: ai.summary, ai_suggested_response: ai.suggestedResponse,
          ai_tags: ai.tags, ai_sentiment: ai.sentiment,
          ai_processed_at: new Date().toISOString(),
          status: 'open', updated_at: new Date().toISOString(),
        }).eq('id', ticket.id)
        await logActivity(ticket.id, {name:'MooseDesk AI',type:'ai'}, 'triaged',
          'AI classified: ' + ai.category + ' / ' + ai.priority)
      } catch(e) { console.warn('AI triage:', e.message) }

      setStep('done')
      setTimeout(() => { setStep('form'); setForm({subject:'',description:'',category:'general',priority:'normal'}); onSubmitted() }, 2500)
    } catch(e) { toast.error(e.message); setStep('form') }
  }

  if (step === 'triaging') return (
    <div style={{textAlign:'center',padding:'48px 24px'}}>
      <Sparkles size={36} color={TEAL} style={{margin:'0 auto 16px',display:'block',animation:'spin 2s linear infinite'}}/>
      <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:8}}>AI is reviewing your request</div>
      <div style={{fontSize:14,color:'#374151'}}>Categorizing, prioritizing, and routing your ticket…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (step === 'done') return (
    <div style={{textAlign:'center',padding:'48px 24px'}}>
      <CheckCircle size={44} color="#16a34a" style={{margin:'0 auto 16px',display:'block'}}/>
      <div style={{fontSize:18,fontWeight:900,color:'#111',marginBottom:8}}>Request submitted!</div>
      <div style={{fontSize:15,color:'#374151'}}>We got it and will get back to you shortly.</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:6}}>Subject *</label>
        <input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}
          placeholder="What do you need help with?" style={INP}/>
      </div>
      <div>
        <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:6}}>Description *</label>
        <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
          rows={5} placeholder="Please describe your request in as much detail as possible…"
          style={{...INP,resize:'vertical',lineHeight:1.7}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:6}}>Category</label>
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
            style={{...INP,background:'#fff'}}>
            {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1).replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:6}}>Priority</label>
          <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
            style={{...INP,background:'#fff'}}>
            {Object.entries(PRI_CFG).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <button onClick={submit}
        style={{padding:'13px',borderRadius:12,border:'none',background:RED,color:'#fff',
          fontSize:15,fontWeight:800,cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        <Send size={15}/> Submit Request
      </button>
    </div>
  )
}

// ── Ticket row ────────────────────────────────────────────────────────────────
function TicketRow({ ticket }) {
  const st = STATUS_CFG[ticket.status] || STATUS_CFG.new
  const age = Math.round((Date.now() - new Date(ticket.created_at))/3600000)
  const ageStr = age < 1 ? 'Just now' : age < 24 ? age+'h ago' : Math.round(age/24)+'d ago'
  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
      padding:'16px 18px',marginBottom:10,borderLeft:'3px solid '+st.color}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:800,color:TEAL}}>{ticket.ticket_number}</span>
            <span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,
              background:st.bg,color:st.color}}>{st.label}</span>
          </div>
          <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:4,
            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ticket.subject}</div>
          {ticket.ai_summary && (
            <div style={{fontSize:13,color:'#374151',marginBottom:6,lineHeight:1.5}}>{ticket.ai_summary}</div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {ticket.ai_category && (
              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,
                background:'#f3f4f6',color:'#374151',textTransform:'capitalize'}}>
                {ticket.ai_category.replace(/_/g,' ')}
              </span>
            )}
            <span style={{fontSize:12,color:'#9ca3af'}}>{ageStr}</span>
            {ticket.reply_count > 0 && (
              <span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#374151'}}>
                <MessageSquare size={11}/>{ticket.reply_count} {ticket.reply_count===1?'reply':'replies'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
function getFirstName(user) {
  if (!user) return ''
  const meta = user.user_metadata
  if (meta?.full_name) return meta.full_name.split(' ')[0]
  if (meta?.name)      return meta.name.split(' ')[0]
  return user.email?.split('@')[0] || ''
}

function getGreeting(name) {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? g + ', ' + name + '!' : g + '!'
}

export default function ClientDashboardPage() {
  const { user } = useAuth()
  const firstName = getFirstName(user)
  const greeting  = getGreeting(firstName)
  const navigate  = useNavigate()

  const [tab,         setTab]         = useState('projects')
  const [projects,    setProjects]    = useState([])
  const [projectData, setProjectData] = useState({})
  const [tickets,     setTickets]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)

  useEffect(() => { if (user?.email) { loadProjects(); loadTickets() } }, [user])

  async function loadProjects() {
    setLoading(true)
    const projs = await getProjectsByClientEmail(user.email)
    setProjects(projs)
    for (const p of projs) {
      const [{ data: files }, { data: rounds }] = await Promise.all([getFiles(p.id), getRounds(p.id)])
      setProjectData(prev => ({ ...prev, [p.id]: { files: files||[], rounds: rounds||[] } }))
    }
    setLoading(false)
  }

  async function loadTickets() {
    const { data } = await supabase.from('desk_tickets')
      .select('*')
      .eq('submitter_email', user.email)
      .order('created_at', { ascending: false })
    setTickets(data||[])
  }

  function getDueStatus(project, rounds) {
    const dueDate = project.due_date
    if (!dueDate) return null
    const days = differenceInDays(new Date(dueDate), new Date())
    if (days < 0)  return { label: 'Overdue by '+Math.abs(days)+'d', cls:'bg-red-50 text-red-700',    urgent:true }
    if (days === 0) return { label: 'Due today!',                      cls:'bg-red-50 text-red-700',    urgent:true }
    if (days <= 3)  return { label: days+'d remaining',                 cls:'bg-amber-50 text-amber-700',urgent:false }
    return { label: 'Due '+format(new Date(dueDate),'MMM d'), cls:'bg-gray-100 text-gray-600', urgent:false }
  }

  async function handleSignOut() { await signOut(); navigate('/client-auth') }

  const openTickets     = tickets.filter(t=>!['resolved','closed'].includes(t.status))
  const resolvedTickets = tickets.filter(t=>['resolved','closed'].includes(t.status))

  const TABS = [
    { key:'projects', label:'My Projects',   count: projects.length },
    { key:'support',  label:'Support Requests', count: openTickets.length, alert: openTickets.length > 0 },
  ]

  return (
    <div style={{minHeight:'100vh',background:'#f8f8f8'}}>
      <Toaster position="top-right"/>

      {/* Header */}
      <div style={{background:'#000',padding:0}}>
        <div style={{maxWidth:960,margin:'0 auto',padding:'18px 24px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:40,height:40,borderRadius:12,background:RED,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:'#fff',letterSpacing:-0.3}}>{greeting}</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,.45)',marginTop:1}}>Client Portal · Powered by Moose AI</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {firstName && (
              <div style={{width:36,height:36,borderRadius:'50%',background:RED,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:15,fontWeight:800,color:'#fff'}}>
                {firstName[0].toUpperCase()}
              </div>
            )}
            <button onClick={handleSignOut}
              style={{fontSize:14,color:'rgba(255,255,255,.5)',background:'none',border:'none',
                cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{maxWidth:960,margin:'0 auto',padding:'0 24px',display:'flex'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'12px 20px',border:'none',
                borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),
                background:'transparent',color:tab===t.key?'#fff':'rgba(255,255,255,.45)',
                fontSize:15,fontWeight:tab===t.key?800:600,cursor:'pointer',transition:'all .15s'}}>
              {t.label}
              {(t.count||0) > 0 && (
                <span style={{fontSize:11,fontWeight:800,padding:'1px 7px',borderRadius:20,
                  background:t.alert&&tab!==t.key?RED+'90':tab===t.key?RED+'50':'rgba(255,255,255,.15)',
                  color:'#fff'}}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:960,margin:'0 auto',padding:'32px 24px'}}>

        {/* ── PROJECTS TAB ── */}
        {tab === 'projects' && (
          <>
            <h1 style={{fontSize:26,fontWeight:900,color:'#111',letterSpacing:-0.5,marginBottom:4}}>
              {firstName ? firstName+"'s Projects" : 'Your Projects'}
            </h1>
            <p style={{fontSize:15,color:'#374151',marginBottom:24}}>
              Review designs, leave feedback, and track revision rounds.
            </p>
            {loading ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
                <div style={{width:32,height:32,border:'2.5px solid '+RED,
                  borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : projects.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 24px',background:'#fff',
                borderRadius:16,border:'1px solid #e5e7eb'}}>
                <FileImage size={44} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                <h2 style={{fontSize:18,fontWeight:900,color:'#111',marginBottom:8}}>No projects yet</h2>
                <p style={{fontSize:15,color:'#374151'}}>No projects are linked to {user?.email}.</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
                {projects.map(project => {
                  const pd = projectData[project.id] || { files:[], rounds:[] }
                  const maxRounds  = project.max_rounds || 2
                  const roundsUsed = pd.rounds.length
                  const openComments = pd.files.reduce((a,f)=>a+(f.open_comments||0),0)
                  const due = getDueStatus(project, pd.rounds)
                  const isComplete = roundsUsed >= maxRounds
                  return (
                    <div key={project.id} style={{background:'#fff',borderRadius:16,
                      border:'1px solid #e5e7eb',overflow:'hidden',
                      boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                      <div style={{padding:'18px 20px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <TypeIcon type={project.project_type||'other'} size={22}/>
                            <div>
                              <div style={{fontSize:15,fontWeight:900,color:'#111'}}>{project.name}</div>
                              <div style={{fontSize:13,color:'#374151'}}>{project.clients?.name}</div>
                            </div>
                          </div>
                          {isComplete && (
                            <span style={{fontSize:12,background:'#f0fdf4',color:'#16a34a',
                              padding:'3px 10px',borderRadius:20,fontWeight:700,
                              display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                              <CheckCircle size={10}/> Complete
                            </span>
                          )}
                        </div>
                        <div style={{marginBottom:12}}>
                          <div style={{display:'flex',justifyContent:'space-between',
                            fontSize:13,color:'#374151',marginBottom:5}}>
                            <span>Round {Math.min(roundsUsed+1,maxRounds)} of {maxRounds}</span>
                            <span>{Math.round((roundsUsed/maxRounds)*100)}%</span>
                          </div>
                          <div style={{height:7,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,
                              background:isComplete?'#16a34a':RED,
                              width:(roundsUsed/maxRounds*100)+'%',transition:'width 1s ease'}}/>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}>
                          <span style={{fontSize:12,color:'#374151',display:'flex',alignItems:'center',gap:4}}>
                            <FileImage size={11}/>{pd.files.length} files
                          </span>
                          {openComments > 0 && (
                            <span style={{fontSize:12,fontWeight:700,color:'#d97706',
                              display:'flex',alignItems:'center',gap:4}}>
                              <MessageSquare size={11}/>{openComments} open
                            </span>
                          )}
                          {due && (
                            <span style={{fontSize:12,fontWeight:700,
                              color:due.urgent?RED:'#374151',
                              display:'flex',alignItems:'center',gap:4}}>
                              {due.urgent?<AlertTriangle size={10}/>:<Calendar size={10}/>} {due.label}
                            </span>
                          )}
                        </div>
                        {pd.files.length > 0 && (
                          <div style={{display:'flex',gap:8,marginBottom:4}}>
                            {pd.files.slice(0,4).map(f=>(
                              <a key={f.id} href={'/review/'+f.public_token}
                                style={{width:44,height:44,borderRadius:9,background:'#f3f4f6',
                                  border:'1px solid #e5e7eb',display:'flex',alignItems:'center',
                                  justifyContent:'center',overflow:'hidden',textDecoration:'none'}}>
                                {f.type?.startsWith('image/') ? (
                                  <img src={f.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                ) : <FileImage size={14} color="#9ca3af"/>}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{background:'#f9fafb',padding:'12px 20px',
                        display:'flex',alignItems:'center',justifyContent:'space-between',
                        borderTop:'1px solid #f3f4f6'}}>
                        {pd.files.length > 0 ? (
                          <a href={'/review/'+pd.files[0].public_token}
                            style={{fontSize:14,fontWeight:800,color:RED,textDecoration:'none',
                              display:'flex',alignItems:'center',gap:5}}>
                            Review Now <ExternalLink size={12}/>
                          </a>
                        ) : (
                          <span style={{fontSize:13,color:'#9ca3af'}}>No files yet</span>
                        )}
                        <span style={{fontSize:12,color:'#9ca3af'}}>
                          {formatDistanceToNow(new Date(project.created_at),{addSuffix:true})}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── SUPPORT TAB ── */}
        {tab === 'support' && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
              <div>
                <h1 style={{fontSize:26,fontWeight:900,color:'#111',letterSpacing:-0.5,margin:'0 0 4px'}}>
                  Support Requests
                </h1>
                <p style={{fontSize:15,color:'#374151',margin:0}}>
                  Submit a request or check the status of existing tickets.
                </p>
              </div>
              <button onClick={()=>setShowForm(f=>!f)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'10px 20px',borderRadius:12,
                  border:'none',background:showForm?'#374151':RED,color:'#fff',
                  fontSize:14,fontWeight:800,cursor:'pointer'}}>
                {showForm ? '✕ Cancel' : <><Plus size={14}/> New Request</>}
              </button>
            </div>

            {/* New ticket form */}
            {showForm && (
              <div style={{background:'#fff',borderRadius:16,border:'1.5px solid '+RED+'30',
                padding:'24px',marginBottom:24,boxShadow:'0 4px 20px '+RED+'10'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
                  <div style={{width:34,height:34,borderRadius:10,background:RED,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Inbox size={16} color="#fff"/>
                  </div>
                  <div>
                    <div style={{fontSize:16,fontWeight:900,color:'#111'}}>Submit a Request</div>
                    <div style={{fontSize:13,color:'#374151'}}>AI will review and route your ticket automatically</div>
                  </div>
                </div>
                <NewTicketForm user={user} onSubmitted={()=>{setShowForm(false);loadTickets()}}/>
              </div>
            )}

            {/* Open tickets */}
            {openTickets.length > 0 && (
              <div style={{marginBottom:24}}>
                <div style={{fontSize:13,fontWeight:800,color:'#374151',textTransform:'uppercase',
                  letterSpacing:'.07em',marginBottom:12}}>Open ({openTickets.length})</div>
                {openTickets.map(t=><TicketRow key={t.id} ticket={t}/>)}
              </div>
            )}

            {/* Resolved tickets */}
            {resolvedTickets.length > 0 && (
              <div>
                <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
                  letterSpacing:'.07em',marginBottom:12}}>Resolved ({resolvedTickets.length})</div>
                {resolvedTickets.map(t=><TicketRow key={t.id} ticket={t}/>)}
              </div>
            )}

            {tickets.length === 0 && !showForm && (
              <div style={{textAlign:'center',padding:'60px 24px',background:'#fff',
                borderRadius:16,border:'1px solid #e5e7eb'}}>
                <Inbox size={44} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                <div style={{fontSize:18,fontWeight:900,color:'#111',marginBottom:8}}>No requests yet</div>
                <div style={{fontSize:15,color:'#374151',marginBottom:20}}>
                  Need help with something? Submit a request and our team will get back to you.
                </div>
                <button onClick={()=>setShowForm(true)}
                  style={{padding:'11px 28px',borderRadius:12,border:'none',background:RED,
                    color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer'}}>
                  Submit Your First Request
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}