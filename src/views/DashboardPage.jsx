"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Target, Star, TrendingUp,
  Inbox, Brain, ArrowUpRight, Zap, Users,
  Clock, CheckCircle, AlertCircle, Loader2,
  BarChart2, FileSignature
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase, getProjects } from '../lib/supabase'
import { useAuth, getFirstName, getGreeting } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R = '#ea2729'
const T = '#5bc6d0'

const STATUS_COLOR = {
  active:   R,
  prospect: T,
  inactive: '#6b7280',
  paused:   '#f59e0b',
}

/* ── Stat card ── */
function Stat({ label, value, sub, color=R, icon:Icon, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'#fff',borderRadius:14,padding:'20px 22px',
      border:'1px solid #ececea',cursor:onClick?'pointer':'default',
      transition:'all .18s ease',position:'relative',overflow:'hidden',
    }}
      onMouseEnter={e=>{ if(onClick){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.08)'}}}
      onMouseLeave={e=>{ if(onClick){e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:color,opacity:.7}}/>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.08em'}}>
          {label}
        </span>
        <div style={{width:30,height:30,borderRadius:8,background:color+'12',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={14} color={color}/>
        </div>
      </div>
      <div style={{fontFamily:"var(--font-display)",fontSize:32,fontWeight:800,
        color:'#0a0a0a',lineHeight:1,letterSpacing:'-.03em',marginBottom:4}}>
        {value}
      </div>
      {sub && <div style={{fontSize:13,color:'#9a9a96'}}>{sub}</div>}
    </div>
  )
}

/* ── Quick action card ── */
function QuickAction({ icon:Icon, label, desc, color, to, onClick }) {
  const navigate = useNavigate()
  return (
    <div onClick={onClick||(()=>navigate(to))} style={{
      display:'flex',alignItems:'center',gap:14,padding:'14px 16px',
      background:'#fff',borderRadius:12,border:'1px solid #ececea',
      cursor:'pointer',transition:'all .15s ease',
    }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.transform='translateX(3px)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='#ececea';e.currentTarget.style.transform='none'}}>
      <div style={{width:38,height:38,borderRadius:10,background:color+'15',flexShrink:0,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <Icon size={17} color={color}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:'#0a0a0a',marginBottom:1}}>{label}</div>
        <div style={{fontSize:13,color:'#9a9a96',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{desc}</div>
      </div>
      <ArrowUpRight size={14} color="#d0d0cc"/>
    </div>
  )
}

/* ── Project card ── */
function ProjectCard({ project, client, onClick }) {
  const statusColor = STATUS_COLOR[client?.status] || '#6b7280'
  const pct = project.revision_round > 0
    ? Math.min(100, Math.round((project.revision_round / 3) * 100)) : 0

  return (
    <div onClick={onClick} style={{
      background:'#fff',borderRadius:14,border:'1px solid #ececea',
      padding:'16px 18px',cursor:'pointer',transition:'all .18s ease',
      borderLeft:`3px solid ${statusColor}`,
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.07)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:700,
            color:'#0a0a0a',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {project.name}
          </div>
          <div style={{fontSize:13,color:'#9a9a96'}}>{client?.name||'—'}</div>
        </div>
        <span style={{fontSize:13,fontWeight:800,padding:'3px 8px',borderRadius:20,flexShrink:0,
          background:statusColor+'15',color:statusColor,textTransform:'uppercase',letterSpacing:'.07em'}}>
          {client?.status||'active'}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{height:3,background:'#f2f2f0',borderRadius:2,overflow:'hidden',marginBottom:10}}>
        <div style={{height:'100%',width:pct+'%',background:`linear-gradient(90deg,${statusColor},${statusColor}cc)`,
          borderRadius:2,transition:'width .5s ease'}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        {[
          {icon:Clock,val:project.revision_round||0,label:'rounds'},
          {icon:AlertCircle,val:project.open_comments||0,label:'comments'},
        ].map((m,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
            <m.icon size={11} color="#9a9a96"/>
            <span style={{fontSize:13,fontWeight:600,color:'#5a5a58'}}>{m.val} {m.label}</span>
          </div>
        ))}
        {project.due_date && (
          <div style={{marginLeft:'auto',fontSize:13,color:'#9a9a96'}}>
            Due {new Date(project.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, firstName, agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [projects,  setProjects]  = useState([])
  const [clients,   setClients]   = useState([])
  const [tickets,   setTickets]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')

  const greeting = getGreeting(firstName)
  const hour     = new Date().getHours()

  useEffect(()=>{ load() },[aid])

  async function load() {
    setLoading(true)
    try {
      const [
        {data:cl},{data:pr},{data:tk}
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('agency_id',aid).order('name').limit(50),
        supabase.from('projects').select('*').eq('agency_id',aid).order('updated_at',{ascending:false}).limit(30),
        supabase.from('desk_tickets').select('id,status,priority,subject,created_at')
          .eq('agency_id',aid).in('status',['new','open','in_progress']).limit(5)
          .order('created_at',{ascending:false}).catch(()=>({data:[]})),
      ])
      setClients(cl||[])
      setProjects(pr||[])
      setTickets(tk?.data||[])
    } catch(e) {
      console.warn(e)
    }
    setLoading(false)
  }

  const clientMap = Object.fromEntries((clients||[]).map(c=>[c.id,c]))
  const activeProjects = projects.filter(p=>p.status!=='archived')
  const filtered = filter==='all' ? activeProjects
    : activeProjects.filter(p=>(clientMap[p.client_id]?.status||'active')===filter)

  const stats = {
    clients:  clients.length,
    active:   clients.filter(c=>c.status==='active').length,
    projects: activeProjects.length,
    tickets:  tickets.length,
  }

  return (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f2f2f0',
      fontFamily:"var(--font-body)"}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background:'#0a0a0a',padding:'0 32px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'20px 0 0'}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.3)',
                textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>
                {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
              </div>
              <h1 style={{fontFamily:"var(--font-display)",fontSize:26,fontWeight:800,
                color:'#fff',margin:0,letterSpacing:'-.03em',lineHeight:1}}>
                {greeting}
              </h1>
            </div>
            <button onClick={()=>navigate('/clients')}
              style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
                borderRadius:10,border:'none',background:R,color:'#fff',
                fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:'-.01em',
                boxShadow:`0 4px 14px ${R}40`}}>
              <Plus size={15}/> New Project
            </button>
          </div>

          {/* Stats strip */}
          <div style={{display:'flex',gap:32,padding:'18px 0 0',
            borderBottom:'1px solid rgba(255,255,255,.06)',marginTop:4}}>
            {[
              {label:'Total clients', value:stats.clients, color:'rgba(255,255,255,.9)'},
              {label:'Active',        value:stats.active,  color:T},
              {label:'Projects',      value:stats.projects,color:'rgba(255,255,255,.9)'},
              {label:'Open tickets',  value:stats.tickets, color:stats.tickets>0?R:'rgba(255,255,255,.9)'},
            ].map(s=>(
              <div key={s.label} style={{paddingBottom:16}}>
                <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,
                  color:s.color,lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.3)',marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{display:'flex',gap:0,marginTop:0}}>
            {[
              {key:'all',     label:'All Projects'},
              {key:'active',  label:'Active'},
              {key:'prospect',label:'Prospects'},
              {key:'paused',  label:'Paused'},
            ].map(f=>(
              <button key={f.key} onClick={()=>setFilter(f.key)}
                style={{padding:'12px 18px',border:'none',background:'transparent',
                  borderBottom:`2.5px solid ${filter===f.key?R:'transparent'}`,
                  color:filter===f.key?'#fff':'rgba(255,255,255,.38)',
                  fontSize:13,fontWeight:filter===f.key?700:500,cursor:'pointer',
                  transition:'all .15s',letterSpacing:'-.01em'}}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'28px 32px',display:'grid',
          gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>

          {/* Main: projects */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:17,fontWeight:800,
                color:'#0a0a0a',letterSpacing:'-.02em'}}>
                {filtered.length} project{filtered.length!==1?'s':''}
              </div>
            </div>

            {loading ? (
              <div style={{display:'flex',justifyContent:'center',padding:60}}>
                <Loader2 size={24} color={R} style={{animation:'spin 1s linear infinite'}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 24px',background:'#fff',
                borderRadius:16,border:'1px solid #ececea'}}>
                <div style={{width:52,height:52,borderRadius:14,background:'#f2f2f0',
                  display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                  <Zap size={22} color="#d0d0cc"/>
                </div>
                <div style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:800,
                  color:'#0a0a0a',marginBottom:8,letterSpacing:'-.02em'}}>
                  No projects yet
                </div>
                <div style={{fontSize:14,color:'#9a9a96',marginBottom:20}}>
                  Add a client and create your first project to get started
                </div>
                <button onClick={()=>navigate('/clients')}
                  style={{padding:'10px 22px',borderRadius:10,border:'none',
                    background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  Add Client
                </button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {filtered.map(p=>(
                  <ProjectCard
                    key={p.id}
                    project={p}
                    client={clientMap[p.client_id]}
                    onClick={()=>navigate(`/project/${p.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: stats + quick actions + tickets */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* KPI cards */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Stat label="Clients"   value={stats.clients}  icon={Users}    color={R}   onClick={()=>navigate('/clients')}/>
              <Stat label="Projects"  value={stats.projects} icon={BarChart2} color={T}   onClick={()=>navigate('/clients')}/>
            </div>

            {/* Quick actions */}
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',
              overflow:'hidden'}}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #f2f2f0',
                display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontFamily:"var(--font-display)",fontSize:14,fontWeight:800,
                  color:'#0a0a0a',letterSpacing:'-.02em'}}>Quick Actions</div>
              </div>
              <div style={{padding:'10px 10px',display:'flex',flexDirection:'column',gap:6}}>
                <QuickAction icon={Target}       label="Scout Leads"      desc="Find new prospects"         color={T}  to="/scout"/>
                <QuickAction icon={TrendingUp}   label="Performance"      desc="Ad intelligence + AI recs"  color={R}  to="/perf"/>
                <QuickAction icon={Inbox}        label="Support Desk"     desc="Tickets & knowledge base"   color="#7c3aed" to="/desk"/>
                <QuickAction icon={FileSignature} label="New Proposal"    desc="Build a proposal"           color="#f59e0b" to="/proposals"/>
                <QuickAction icon={Star}         label="Reviews"          desc="Manage reviews & responses" color="#16a34a" to="/reviews"/>
              </div>
            </div>

            {/* Open tickets */}
            {tickets.length > 0 && (
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',
                overflow:'hidden'}}>
                <div style={{padding:'14px 18px',borderBottom:'1px solid #f2f2f0',
                  display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontFamily:"var(--font-display)",fontSize:14,fontWeight:800,
                    color:'#0a0a0a',letterSpacing:'-.02em'}}>Open Tickets</div>
                  <button onClick={()=>navigate('/desk')}
                    style={{fontSize:13,fontWeight:700,color:R,background:'none',border:'none',
                      cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                    View all <ChevronRight size={12}/>
                  </button>
                </div>
                <div style={{padding:'8px 10px',display:'flex',flexDirection:'column',gap:4}}>
                  {tickets.map(tk=>(
                    <div key={tk.id} onClick={()=>navigate(`/desk/ticket/${tk.id}`)}
                      style={{padding:'9px 12px',borderRadius:9,cursor:'pointer',
                        display:'flex',alignItems:'center',gap:10,
                        transition:'background .12s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8f8f6'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                        background:tk.priority==='urgent'?R:tk.priority==='high'?'#f59e0b':T}}/>
                      <span style={{fontSize:13,color:'#0a0a0a',overflow:'hidden',
                        textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
                        {tk.subject}
                      </span>
                      <span style={{fontSize:13,color:'#9a9a96',flexShrink:0,
                        background:'#f2f2f0',padding:'2px 7px',borderRadius:20,fontWeight:600,
                        textTransform:'capitalize'}}>
                        {tk.status.replace('_',' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}