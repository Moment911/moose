"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Target, Star, TrendingUp,
  Inbox, Brain, ArrowUpRight, Zap, Users,
  Clock, AlertCircle, Loader2, BarChart2, FileSignature, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import {
  MobilePage, MobilePageHeader, MobileStatStrip, MobileTabs,
  MobileRow, MobileSectionHeader, MobileCard, MobileEmpty,
  MobileButton
} from '../components/mobile/MobilePage'

const R = '#ea2729'
const T = '#5bc6d0'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const STATUS_COLOR = { active:R, prospect:T, inactive:'#6b7280', paused:'#f59e0b' }

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, firstName, agencyId } = useAuth()
  const aid      = agencyId || '00000000-0000-0000-0000-000000000099'
  const isMobile = useMobile()

  const [projects, setProjects] = useState([])
  const [clients,  setClients]  = useState([])
  const [tickets,  setTickets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')

  const greeting = getGreeting(firstName)

  useEffect(() => { load() }, [aid])

  async function load() {
    setLoading(true)
    try {
      const [{data:cl},{data:pr},{data:tk}] = await Promise.all([
        supabase.from('clients').select('*').eq('agency_id',aid).order('name').limit(50),
        supabase.from('projects').select('*').eq('agency_id',aid).order('updated_at',{ascending:false}).limit(30),
        supabase.from('desk_tickets').select('id,status,priority,subject,created_at')
          .eq('agency_id',aid).in('status',['new','open','in_progress']).limit(5)
          .order('created_at',{ascending:false}).catch(()=>({data:[]})),
      ])
      setClients(cl||[]); setProjects(pr||[]); setTickets(tk?.data||[])
    } catch(e) { console.warn(e) }
    setLoading(false)
  }

  const clientMap      = Object.fromEntries((clients||[]).map(c=>[c.id,c]))
  const activeProjects = projects.filter(p=>p.status!=='archived')
  const filtered       = filter==='all' ? activeProjects
    : activeProjects.filter(p=>(clientMap[p.client_id]?.status||'active')===filter)
  const stats = {
    clients:  clients.length,
    active:   clients.filter(c=>c.status==='active').length,
    projects: activeProjects.length,
    tickets:  tickets.length,
  }

  /* ─────────────────── MOBILE ─────────────────── */
  if (isMobile) {
    const TABS = [
      { key:'all',      label:'All',       count: activeProjects.length },
      { key:'active',   label:'Active',    count: clients.filter(c=>c.status==='active').length },
      { key:'prospect', label:'Prospects', count: clients.filter(c=>c.status==='prospect').length },
    ]

    const QUICK = [
      { icon:Target,       label:'Scout',       sub:'Find new leads',         to:'/scout',   color:T },
      { icon:TrendingUp,   label:'Performance', sub:'AI ad optimization',     to:'/perf',    color:R },
      { icon:Inbox,        label:'KotoDesk',    sub:'Support tickets',        to:'/desk',    color:'#7c3aed' },
      { icon:FileSignature,label:'Proposals',   sub:'Build & send proposals', to:'/proposals',color:'#f59e0b' },
      { icon:Star,         label:'Reviews',     sub:'Manage client reviews',  to:'/reviews', color:'#16a34a' },
      { icon:BarChart2,    label:'SEO Hub',     sub:'Search visibility',      to:'/seo',     color:'#0ea5e9' },
    ]

    return (
      <MobilePage padded={false}>
        {/* Greeting header */}
        <div style={{ background:'#0a0a0a', padding:'16px 16px 0' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.3)',
            textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4, fontFamily:FH }}>
            {new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
          </div>
          <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff',
            margin:'0 0 2px', letterSpacing:'-.03em' }}>{greeting}</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 16px', fontFamily:FB }}>
            {stats.clients} clients · {stats.projects} projects
          </p>
        </div>

        {/* Stats strip */}
        <MobileStatStrip stats={[
          { label:'Clients',  value:stats.clients,  color:'#fff' },
          { label:'Active',   value:stats.active,   color:T      },
          { label:'Projects', value:stats.projects, color:'#fff' },
          { label:'Tickets',  value:stats.tickets,  color:stats.tickets>0?R:'#fff' },
        ]}/>

        {/* Quick actions */}
        <MobileSectionHeader title="Quick Actions"
          action={<button onClick={()=>navigate('/clients')}
            style={{ fontSize:13, color:R, fontWeight:700, background:'none', border:'none',
              cursor:'pointer', fontFamily:FH }}>+ New</button>}/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 16px', marginBottom:8 }}>
          {QUICK.map(q=>(
            <button key={q.to} onClick={()=>navigate(q.to)}
              style={{ background:'#fff', borderRadius:14, padding:'14px',
                border:'1px solid #ececea', cursor:'pointer', textAlign:'left',
                WebkitTapHighlightColor:'transparent', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:q.color+'15',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <q.icon size={18} color={q.color}/>
              </div>
              <div>
                <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{q.label}</div>
                <div style={{ fontSize:12, color:'#9a9a96', fontFamily:FB }}>{q.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Projects */}
        <div style={{ display:'flex', overflowX:'auto', gap:0,
          background:'#fff', borderBottom:'1px solid #ececea',
          scrollbarWidth:'none', marginTop:8 }}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setFilter(t.key)}
              style={{ flexShrink:0, padding:'0 16px', height:44,
                border:'none', borderBottom:`2.5px solid ${filter===t.key?R:'transparent'}`,
                background:'transparent', color:filter===t.key?R:'#9a9a96',
                fontSize:14, fontWeight:filter===t.key?700:500,
                cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap',
                display:'flex', alignItems:'center', gap:6 }}>
              {t.label}
              <span style={{ fontSize:11, fontWeight:800, background:filter===t.key?R+'15':'#f2f2f0',
                color:filter===t.key?R:'#9a9a96', padding:'1px 6px', borderRadius:20 }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
            <Loader2 size={22} color={R} style={{ animation:'spin 1s linear infinite' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <MobileEmpty icon={Zap} title="No projects yet"
            body="Add a client and start your first project"
            action={<MobileButton label="Add Client" onPress={()=>navigate('/clients')}/>}/>
        ) : (
          <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(p => {
              const cl = clientMap[p.client_id]
              const sc = STATUS_COLOR[cl?.status||'active']
              return (
                <button key={p.id} onClick={()=>navigate(`/project/${p.id}`)}
                  style={{ background:'#fff', borderRadius:14, border:'1px solid #ececea',
                    borderLeft:`3px solid ${sc}`, padding:'14px',
                    cursor:'pointer', textAlign:'left', width:'100%',
                    WebkitTapHighlightColor:'transparent' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#0a0a0a',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                      {p.name}
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20,
                      background:sc+'15', color:sc, textTransform:'uppercase', letterSpacing:'.05em',
                      marginLeft:8, flexShrink:0, fontFamily:FH }}>
                      {cl?.status||'active'}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'#9a9a96', fontFamily:FB }}>{cl?.name||'—'}</div>
                  {p.due_date && (
                    <div style={{ fontSize:12, color:'#9a9a96', marginTop:6, fontFamily:FB }}>
                      Due {new Date(p.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Open tickets */}
        {tickets.length > 0 && (
          <>
            <MobileSectionHeader title="Open Tickets"
              action={<button onClick={()=>navigate('/desk')}
                style={{ fontSize:13, color:R, fontWeight:700, background:'none', border:'none',
                  cursor:'pointer', fontFamily:FH }}>View all</button>}/>
            <MobileCard style={{ margin:'0 16px 16px' }}>
              {tickets.map((tk,i)=>(
                <MobileRow key={tk.id}
                  onClick={()=>navigate(`/desk/ticket/${tk.id}`)}
                  borderBottom={i<tickets.length-1}
                  left={<div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background:tk.priority==='urgent'?R:tk.priority==='high'?'#f59e0b':T }}/>}
                  title={tk.subject}
                  subtitle={tk.status.replace('_',' ')}/>
              ))}
            </MobileCard>
          </>
        )}
      </MobilePage>
    )
  }

  /* ─────────────────── DESKTOP ─────────────────── */
  return (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f2f2f0',
      fontFamily:FB}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'#0a0a0a',padding:'0 32px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 0 0'}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>
                {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
              </div>
              <h1 style={{fontFamily:FH,fontSize:26,fontWeight:800,color:'#fff',margin:0,letterSpacing:'-.03em',lineHeight:1}}>
                {greeting}
              </h1>
            </div>
            <button onClick={()=>navigate('/clients')}
              style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:`0 4px 14px ${R}40`}}>
              <Plus size={15}/> New Project
            </button>
          </div>
          <div style={{display:'flex',gap:32,padding:'18px 0 0',borderBottom:'1px solid rgba(255,255,255,.06)',marginTop:4}}>
            {[{label:'Total clients',value:stats.clients},{label:'Active',value:stats.active,color:T},{label:'Projects',value:stats.projects},{label:'Open tickets',value:stats.tickets,color:stats.tickets>0?R:undefined}].map(s=>(
              <div key={s.label} style={{paddingBottom:16}}>
                <div style={{fontFamily:FH,fontSize:22,fontWeight:800,color:s.color||'rgba(255,255,255,.9)',lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.3)',marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:0}}>
            {[{key:'all',label:'All Projects'},{key:'active',label:'Active'},{key:'prospect',label:'Prospects'},{key:'paused',label:'Paused'}].map(f=>(
              <button key={f.key} onClick={()=>setFilter(f.key)}
                style={{padding:'12px 18px',border:'none',background:'transparent',borderBottom:`2.5px solid ${filter===f.key?R:'transparent'}`,color:filter===f.key?'#fff':'rgba(255,255,255,.38)',fontSize:13,fontWeight:filter===f.key?700:500,cursor:'pointer',transition:'all .15s'}}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'28px 32px',display:'grid',gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>
          <div>
            {loading ? (
              <div style={{display:'flex',justifyContent:'center',padding:60}}>
                <Loader2 size={24} color={R} style={{animation:'spin 1s linear infinite'}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 24px',background:'#fff',borderRadius:16,border:'1px solid #ececea'}}>
                <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:'#0a0a0a',marginBottom:8,letterSpacing:'-.02em'}}>No projects yet</div>
                <button onClick={()=>navigate('/clients')} style={{padding:'10px 22px',borderRadius:10,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>Add Client</button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {filtered.map(p=>{
                  const cl=clientMap[p.client_id];const sc=STATUS_COLOR[cl?.status||'active']
                  return(
                    <div key={p.id} onClick={()=>navigate(`/project/${p.id}`)}
                      style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',borderLeft:`3px solid ${sc}`,padding:'16px 18px',cursor:'pointer',transition:'all .18s ease'}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.07)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:FH,fontSize:15,fontWeight:700,color:'#0a0a0a',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                          <div style={{fontSize:12,color:'#9a9a96'}}>{cl?.name||'—'}</div>
                        </div>
                        <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,flexShrink:0,background:sc+'15',color:sc,textTransform:'uppercase',letterSpacing:'.07em'}}>{cl?.status||'active'}</span>
                      </div>
                      <div style={{height:3,background:'#f2f2f0',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${Math.min(100,(p.revision_round||0)/3*100)}%`,background:`linear-gradient(90deg,${sc},${sc}cc)`,borderRadius:2}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{label:'Clients',value:stats.clients,icon:Users,color:R},{label:'Projects',value:stats.projects,icon:BarChart2,color:T}].map(s=>(
                <div key={s.label} onClick={()=>navigate('/clients')}
                  style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',padding:'18px',cursor:'pointer'}}>
                  <div style={{position:'relative',height:2,background:s.color,opacity:.7,marginBottom:14,margin:'-18px -18px 14px',borderRadius:'14px 14px 0 0'}}/>
                  <div style={{fontFamily:FH,fontSize:28,fontWeight:800,color:'#0a0a0a',lineHeight:1,letterSpacing:'-.03em'}}>{s.value}</div>
                  <div style={{fontSize:11,color:'#9a9a96',marginTop:4,fontFamily:FH,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',overflow:'hidden'}}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #f2f2f0'}}>
                <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:'#0a0a0a'}}>Quick Actions</div>
              </div>
              <div style={{padding:'10px'}}>
                {[{icon:Target,label:'Scout Leads',desc:'Find prospects',color:T,to:'/scout'},{icon:TrendingUp,label:'Performance',desc:'Ad intelligence',color:R,to:'/perf'},{icon:Inbox,label:'KotoDesk',desc:'Support tickets',color:'#7c3aed',to:'/desk'},{icon:FileSignature,label:'Proposal',desc:'Build a proposal',color:'#f59e0b',to:'/proposals'},{icon:Star,label:'Reviews',desc:'Manage reviews',color:'#16a34a',to:'/reviews'}].map(q=>(
                  <div key={q.to} onClick={()=>navigate(q.to)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'11px 10px',borderRadius:10,cursor:'pointer',transition:'all .12s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f8f8f6'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                    <div style={{width:34,height:34,borderRadius:9,background:q.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <q.icon size={15} color={q.color}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#0a0a0a',fontFamily:FH}}>{q.label}</div>
                      <div style={{fontSize:12,color:'#9a9a96',fontFamily:FB}}>{q.desc}</div>
                    </div>
                    <ArrowUpRight size={13} color="#d0d0cc"/>
                  </div>
                ))}
              </div>
            </div>
            {tickets.length>0&&(
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',overflow:'hidden'}}>
                <div style={{padding:'14px 18px',borderBottom:'1px solid #f2f2f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:'#0a0a0a'}}>Open Tickets</div>
                  <button onClick={()=>navigate('/desk')} style={{fontSize:12,fontWeight:700,color:R,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontFamily:FH}}>View all <ChevronRight size={12}/></button>
                </div>
                <div style={{padding:'8px 10px'}}>
                  {tickets.map(tk=>(
                    <div key={tk.id} onClick={()=>navigate(`/desk/ticket/${tk.id}`)}
                      style={{padding:'9px 10px',borderRadius:9,cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'background .12s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8f8f6'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background:tk.priority==='urgent'?R:tk.priority==='high'?'#f59e0b':T}}/>
                      <span style={{fontSize:13,color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{tk.subject}</span>
                      <span style={{fontSize:10,color:'#9a9a96',flexShrink:0,background:'#f2f2f0',padding:'2px 7px',borderRadius:20,fontWeight:600,textTransform:'capitalize'}}>{tk.status.replace('_',' ')}</span>
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