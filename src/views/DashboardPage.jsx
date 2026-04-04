"use client"
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Search, FolderOpen, ClipboardList, Target, Star,
  ArrowRight, Loader2, MoreHorizontal, Pencil, Trash2,
  FileSignature, Users, TrendingUp, MessageSquare,
  CheckCircle, Clock, AlertCircle, ChevronRight, Zap
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getProjects, createProject, deleteProject, updateProject } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'

const PROJECT_TYPE_COLORS = {
  website:   RED,
  social:    '#7c3aed',
  email:     '#0891b2',
  branding:  '#d97706',
  video:     '#059669',
  default:   '#6b7280',
}

function getTypeColor(type) {
  return PROJECT_TYPE_COLORS[type?.toLowerCase()] || PROJECT_TYPE_COLORS.default
}

function ProjectCard({ project, onDelete, onRename, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName]         = useState(project.name)
  const color = getTypeColor(project.project_type)
  const daysOld = Math.round((Date.now() - new Date(project.created_at)) / 86400000)

  async function doRename() {
    if (!name.trim() || name === project.name) { setRenaming(false); return }
    await onRename(project.id, name.trim())
    setRenaming(false)
  }

  return (
    <div className="card hover-lift" style={{ cursor:'pointer', overflow:'hidden' }}
      onClick={() => !menuOpen && !renaming && navigate(`/project/${project.id}`)}>
      {/* Color strip */}
      <div style={{ height:3, background:color, borderRadius:'16px 16px 0 0', marginTop:-1, marginLeft:-1, marginRight:-1 }}/>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            {renaming ? (
              <input autoFocus value={name}
                onChange={e=>setName(e.target.value)}
                onBlur={doRename}
                onKeyDown={e=>{if(e.key==='Enter')doRename();if(e.key==='Escape')setRenaming(false)}}
                onClick={e=>e.stopPropagation()}
                className="input" style={{ fontSize:14, fontWeight:600, padding:'4px 8px' }}/>
            ) : (
              <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:700,
                color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {project.name}
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
              <span style={{ fontSize:11, fontWeight:600, color, padding:'2px 7px',
                borderRadius:20, background:color+'15' }}>
                {project.project_type || 'Project'}
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                {daysOld === 0 ? 'Today' : daysOld === 1 ? 'Yesterday' : daysOld + 'd ago'}
              </span>
            </div>
          </div>
          <div style={{ position:'relative' }} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setMenuOpen(o=>!o)}
              style={{ padding:5, borderRadius:6, border:'none', background:'none',
                cursor:'pointer', color:'var(--text-muted)' }}>
              <MoreHorizontal size={14}/>
            </button>
            {menuOpen && (
              <div className="card-sm" style={{ position:'absolute', right:0, top:'100%', zIndex:50,
                minWidth:150, boxShadow:'0 8px 24px rgba(0,0,0,.1)', overflow:'hidden' }}>
                <button onClick={()=>{navigate(`/esign/${project.id}`);setMenuOpen(false)}}
                  className="btn-ghost" style={{ width:'100%', justifyContent:'flex-start', padding:'9px 14px', borderRadius:0, fontSize:13, gap:8 }}>
                  <FileSignature size={12}/> Proposal / Sign
                </button>
                <button onClick={()=>{setRenaming(true);setMenuOpen(false)}}
                  className="btn-ghost" style={{ width:'100%', justifyContent:'flex-start', padding:'9px 14px', borderRadius:0, fontSize:13, gap:8 }}>
                  <Pencil size={12}/> Rename
                </button>
                <div className="divider"/>
                <button onClick={()=>{onDelete(project.id);setMenuOpen(false)}}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 14px',
                    border:'none', background:'none', cursor:'pointer', fontSize:13, color:RED }}>
                  <Trash2 size={12}/> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickStatPill({ icon:Icon, label, value, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
      background:'rgba(255,255,255,.06)', borderRadius:8, border:'1px solid rgba(255,255,255,.08)' }}>
      <Icon size={12} color={color || 'rgba(255,255,255,.4)'}/>
      <span style={{ fontSize:12, color:'rgba(255,255,255,.45)' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { clientId: urlClientId } = useParams()
  const { agencyId, firstName, agencyName } = useAuth()
  const { clients, selectedClient, selectClient } = useClient()

  const [tab,            setTab]            = useState('projects')
  const [projects,       setProjects]       = useState([])
  const [reviews,        setReviews]        = useState([])
  const [onboarding,     setOnboarding]     = useState(null)
  const [profile,        setProfile]        = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [search,         setSearch]         = useState('')
  const [newProjName,    setNewProjName]    = useState('')
  const [adding,         setAdding]         = useState(false)
  const [showAddForm,    setShowAddForm]    = useState(false)
  const [refresh,        setRefresh]        = useState(0)

  useEffect(() => {
    if (urlClientId && clients.length > 0) {
      const c = clients.find(x => x.id === urlClientId)
      if (c) selectClient(c)
    }
  }, [urlClientId, clients])

  useEffect(() => {
    if (!selectedClient) return
    setTab('projects')
    load(selectedClient.id)
  }, [selectedClient?.id, refresh])

  async function load(clientId) {
    setLoading(true)
    const [{ data:proj }, { data:tok }, { data:prof }, { data:rev }] = await Promise.all([
      getProjects(clientId),
      supabase.from('onboarding_tokens').select('*').eq('client_id',clientId).order('created_at',{ascending:false}).limit(1),
      supabase.from('client_profiles').select('*').eq('client_id',clientId).single(),
      supabase.from('moose_review_queue').select('*').eq('client_id',clientId).order('reviewed_at',{ascending:false}).limit(20),
    ])
    setProjects(proj||[]); setOnboarding(tok?.[0]||null)
    setProfile(prof||null); setReviews(rev||[])
    setLoading(false)
  }

  async function addProject() {
    if (!newProjName.trim() || !selectedClient) return
    setAdding(true)
    const { data, error } = await createProject(selectedClient.id, newProjName.trim())
    if (error) { toast.error('Failed to create project'); setAdding(false); return }
    toast.success('Project created')
    setNewProjName(''); setAdding(false); setShowAddForm(false)
    setRefresh(r=>r+1)
    navigate(`/project/${data.id}`)
  }

  async function deleteProj(id) {
    if (!confirm('Delete this project?')) return
    await deleteProject(id); toast.success('Deleted'); setRefresh(r=>r+1)
  }

  async function renameProj(id, name) {
    await updateProject(id,{name}); toast.success('Renamed'); setRefresh(r=>r+1)
  }

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const TABS = [
    { id:'projects',   label:'Projects',   count:projects.length },
    { id:'onboarding', label:'Onboarding', count:null },
    { id:'reviews',    label:'Reviews',    count:reviews.length||null },
  ]

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page-shell">
      <Sidebar/>
      <div className="page-content">

        {/* ── Dark header ─────────────────────────────────────────── */}
        <div className="page-header" style={{ padding:'0 28px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            paddingTop:18, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800,
                color:'#fff', letterSpacing:'-.02em', lineHeight:1 }}>
                {greeting}{firstName ? `, ${firstName}` : ''}.
              </div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.35)', marginTop:4 }}>
                {agencyName && <span>{agencyName} · </span>}
                {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <QuickStatPill icon={Users}       label="Clients"  value={clients.length}  color={TEAL}/>
              <QuickStatPill icon={FolderOpen}  label="Projects" value={projects.length} color={RED}/>
              <button className="btn btn-primary" onClick={()=>navigate('/clients')}
                style={{ marginLeft:8 }}>
                <Plus size={13}/> New Client
              </button>
            </div>
          </div>

          {/* Client selector strip */}
          {clients.length > 0 && (
            <div style={{ display:'flex', gap:6, padding:'12px 0', overflowX:'auto',
              scrollbarWidth:'none' }}>
              {clients.map(c => {
                const active = selectedClient?.id === c.id
                const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
                return (
                  <button key={c.id} onClick={()=>{selectClient(c);navigate(`/client/${c.id}`)}}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
                      borderRadius:20, border:'1px solid',
                      borderColor: active ? RED : 'rgba(255,255,255,.1)',
                      background: active ? RED : 'rgba(255,255,255,.05)',
                      color: active ? '#fff' : 'rgba(255,255,255,.55)',
                      cursor:'pointer', fontSize:13, fontWeight: active?600:400,
                      whiteSpace:'nowrap', flexShrink:0, transition:'all .15s' }}>
                    <div style={{ width:18, height:18, borderRadius:4,
                      background: active?'rgba(255,255,255,.2)':'rgba(255,255,255,.08)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:8, fontWeight:800, color:active?'#fff':'rgba(255,255,255,.4)' }}>
                      {initials}
                    </div>
                    {c.name}
                    {active && <ChevronRight size={10}/>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Tabs (only show when client selected) */}
          {selectedClient && (
            <div className="tab-bar">
              {TABS.map(t => (
                <button key={t.id} className={`tab-item${tab===t.id?' active':''}`}
                  onClick={()=>setTab(t.id)}>
                  {t.label}
                  {t.count > 0 && <span className="tab-count">{t.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="page-body">
          {!selectedClient ? (
            <div className="empty-state" style={{ marginTop:60 }}>
              <div className="empty-state-icon">
                <Users size={22} color="var(--text-muted)"/>
              </div>
              <div className="empty-state-title">Select a client to get started</div>
              <div className="empty-state-body">
                Choose a client from the header bar above, or add your first client to begin managing their projects.
              </div>
              <button className="btn btn-primary" onClick={()=>navigate('/clients')}>
                <Plus size={13}/> Add your first client
              </button>
            </div>
          ) : loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:80 }}>
              <Loader2 size={24} color={RED} style={{ animation:'spin 1s linear infinite' }}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {/* ── Client context bar ─────────────────────────── */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800,
                    color:'var(--text-primary)', letterSpacing:'-.02em' }}>
                    {selectedClient.name}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>
                    {selectedClient.industry || 'No industry'} · {selectedClient.status || 'Active'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-secondary" onClick={()=>navigate(`/perf/${selectedClient.id}`)}>
                    <TrendingUp size={13}/> Performance
                  </button>
                  <button className="btn btn-secondary" onClick={()=>navigate(`/clients/${selectedClient.id}`)}>
                    View Profile <ArrowRight size={13}/>
                  </button>
                </div>
              </div>

              {/* ── PROJECTS TAB ───────────────────────────────── */}
              {tab === 'projects' && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div style={{ display:'flex', gap:8, flex:1 }}>
                      <div style={{ position:'relative', flex:1, maxWidth:320 }}>
                        <Search size={13} style={{ position:'absolute', left:11, top:'50%',
                          transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)}
                          className="input" placeholder="Search projects…"
                          style={{ paddingLeft:32, fontSize:13 }}/>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={()=>setShowAddForm(s=>!s)}>
                      <Plus size={13}/> New Project
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="card-sm" style={{ padding:'14px 16px', marginBottom:16,
                      display:'flex', gap:8, alignItems:'center',
                      borderLeft:`3px solid ${RED}`, borderRadius:'0 var(--radius-md) var(--radius-md) 0',
                      animation:'fadeUp .2s ease both' }}>
                      <input value={newProjName} onChange={e=>setNewProjName(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')addProject();if(e.key==='Escape')setShowAddForm(false)}}
                        className="input" placeholder="Project name…"
                        style={{ flex:1, fontSize:14 }} autoFocus/>
                      <button className="btn btn-primary" onClick={addProject} disabled={adding}>
                        {adding ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : 'Create'}
                      </button>
                      <button className="btn btn-ghost" onClick={()=>setShowAddForm(false)}>Cancel</button>
                    </div>
                  )}

                  {filtered.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon"><FolderOpen size={22} color="var(--text-muted)"/></div>
                      <div className="empty-state-title">
                        {search ? 'No projects match that search' : 'No projects yet'}
                      </div>
                      <div className="empty-state-body">
                        {search ? 'Try a different keyword' : `Create the first project for ${selectedClient.name}`}
                      </div>
                      {!search && (
                        <button className="btn btn-primary" onClick={()=>setShowAddForm(true)}>
                          <Plus size={13}/> Create Project
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                      {filtered.map((p,i) => (
                        <div key={p.id} className="animate-fade-up" style={{ animationDelay:`${i*.04}s` }}>
                          <ProjectCard project={p} onDelete={deleteProj} onRename={renameProj} navigate={navigate}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ONBOARDING TAB ─────────────────────────────── */}
              {tab === 'onboarding' && (
                <div>
                  <div className="card" style={{ padding:24, marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                      <div>
                        <div className="section-eyebrow">Client onboarding</div>
                        <div className="section-title">{selectedClient.name}</div>
                      </div>
                      {onboarding && (
                        <button className="btn btn-secondary" onClick={()=>{
                          const link = `${window.location.origin}/onboard/${onboarding.token}`
                          navigator.clipboard.writeText(link)
                          toast.success('Link copied!')
                        }}>
                          Copy Onboarding Link
                        </button>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom:20 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:600 }}>Profile completion</span>
                        <span style={{ fontSize:13, fontWeight:700, color:RED }}>{onboarding?.used_at ? '80%' : '0%'}</span>
                      </div>
                      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:onboarding?.used_at?'80%':'0%',
                          background:`linear-gradient(90deg,${RED},#f87171)`,
                          borderRadius:3, transition:'width .8s ease' }}/>
                      </div>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      {[
                        { label:'Link sent', done:!!onboarding },
                        { label:'Form completed', done:!!onboarding?.used_at },
                        { label:'Profile built', done:!!profile },
                        { label:'Projects created', done:projects.length>0 },
                      ].map(step => (
                        <div key={step.label} style={{ display:'flex', alignItems:'center', gap:10,
                          padding:'12px 14px', borderRadius:'var(--radius-md)',
                          background: step.done?'#f0fdf4':'var(--surface-2)',
                          border:`1px solid ${step.done?'#bbf7d0':'var(--border)'}` }}>
                          <CheckCircle size={16} color={step.done?'#16a34a':'#d1d5db'}/>
                          <span style={{ fontSize:14, fontWeight:600,
                            color:step.done?'#15803d':'var(--text-secondary)' }}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── REVIEWS TAB ──────────────────────────────────── */}
              {tab === 'reviews' && (
                <div>
                  {reviews.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon"><Star size={22} color="var(--text-muted)"/></div>
                      <div className="empty-state-title">No reviews yet</div>
                      <div className="empty-state-body">Reviews from Google, Facebook, and Yelp will appear here once connected.</div>
                      <button className="btn btn-primary" onClick={()=>navigate('/reviews')}>
                        Manage Reviews <ArrowRight size={13}/>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {reviews.map(r => (
                        <div key={r.id} className="card card-sm" style={{ padding:'14px 18px' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>
                                {r.author_name || 'Anonymous'}
                              </div>
                              <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>
                                {r.review_text?.slice(0,200)}{(r.review_text?.length||0)>200?'…':''}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                              {[1,2,3,4,5].map(s=>(
                                <Star key={s} size={12} fill={s<=(r.star_rating||0)?'#f59e0b':'none'}
                                  color={s<=(r.star_rating||0)?'#f59e0b':'#d1d5db'}/>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}