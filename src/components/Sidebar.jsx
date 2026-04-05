"use client"
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Users, FileSignature, Clock, Inbox, Brain,
  BarChart2, TrendingUp, Target, Plug, Settings, Shield,
  Cpu, Workflow, Star, ChevronDown, ChevronRight,
  LogOut, Plus, Folder, Trash2, Edit2, MoreHorizontal, Zap,
  CreditCard, Database, MapPin, Globe
} from 'lucide-react'
import { getClients, getProjects, signOut, createClient_, deleteClient, updateProject, deleteProject } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import NewProjectModal from './NewProjectModal'
import toast from 'react-hot-toast'

const R  = '#ea2729'
const T  = '#5bc6d0'
const W  = '#ffffff'

function NavLink({ to, icon: Icon, label, exact, startsWith, badge, badgeColor, sub }) {
  const loc    = useLocation()
  const active = exact ? loc.pathname === to
    : startsWith ? loc.pathname.startsWith(to)
    : loc.pathname === to

  return (
    <Link to={to} style={{
      display:'flex', alignItems:'center', gap:10,
      padding: sub ? '5px 12px 5px 36px' : '6px 14px',
      borderRadius:8, textDecoration:'none',
      background: active ? 'rgba(234,39,41,.14)' : 'transparent',
      color: active ? W : 'rgba(255,255,255,.42)',
      fontSize: sub ? 12 : 13,
      fontWeight: active ? 700 : 400,
      letterSpacing: active ? '-.01em' : 'normal',
      transition:'all .12s ease',
      position:'relative',
      margin:'1px 0',
    }}
      onMouseEnter={e=>{ if(!active){e.currentTarget.style.color='rgba(255,255,255,.82)';e.currentTarget.style.background='rgba(255,255,255,.05)'}}}
      onMouseLeave={e=>{ if(!active){e.currentTarget.style.color='rgba(255,255,255,.42)';e.currentTarget.style.background='transparent'}}}>
      {active && <span style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:18,background:R,borderRadius:'0 3px 3px 0'}}/>}
      <Icon size={sub?13:14} style={{flexShrink:0,color:active?R:'inherit',opacity:active?1:.65}}/>
      <span style={{flex:1,lineHeight:1.2}}>{label}</span>
      {badge && (
        <span style={{fontSize:13,fontWeight:800,padding:'2px 6px',borderRadius:20,
          background:badgeColor||T,color:'#fff',letterSpacing:'.07em',lineHeight:1.4}}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function Section({ label }) {
  return (
    <div style={{padding:'18px 14px 4px',fontSize:13,fontWeight:800,
      color:'rgba(255,255,255,.2)',textTransform:'uppercase',letterSpacing:'.12em'}}>
      {label}
    </div>
  )
}

export default function Sidebar() {
  const { user, firstName, agencyId } = useAuth()
  const navigate = useNavigate()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [clients,      setClients]      = useState([])
  const [expanded,     setExpanded]     = useState({})
  const [showModal,    setShowModal]    = useState(false)
  const [newProjClient,setNewProjClient]= useState(null)
  const [projectsMap,  setProjectsMap]  = useState({})

  useEffect(()=>{ loadClients() },[aid])

  async function loadClients() {
    const data = await getClients(aid)
    setClients(data||[])
  }

  async function toggleClient(cid) {
    const next = !expanded[cid]
    setExpanded(e=>({...e,[cid]:next}))
    if (next && !projectsMap[cid]) {
      const projs = await getProjects(cid)
      setProjectsMap(m=>({...m,[cid]:projs||[]}))
    }
  }

  const greeting = getGreeting(firstName)

  return (
    <>
      <div className="desktop-sidebar" style={{
        width:230,
        background:'#0a0a0a',
        display:'flex',flexDirection:'column',
        height:'100vh',overflow:'hidden',flexShrink:0,
        borderRight:'1px solid rgba(255,255,255,.06)',
        fontFamily:"var(--font-body)",
      }}>

        {/* Logo */}
        <div style={{padding:'20px 16px 14px',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:R,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Zap size={15} color="#fff" strokeWidth={2.5}/>
            </div>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:16,fontWeight:800,
                color:W,letterSpacing:'-.03em',lineHeight:1}}>Koto</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,.3)',letterSpacing:'.04em',marginTop:1}}>
                AI Platform
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 6px',
          scrollbarWidth:'none'}}>

          <Section label="Workspace"/>
          <NavLink to="/"            exact icon={LayoutGrid}    label="Dashboard"/>
          <NavLink to="/clients"     startsWith icon={Users}    label="Clients"/>
          <NavLink to="/reviews"     startsWith icon={Star}     label="Reviews"/>
          <NavLink to="/proposals"   startsWith icon={FileSignature} label="Proposals"/>
          <NavLink to="/automations" icon={Workflow}            label="Automations"/>

          <Section label="Intelligence"/>
          <NavLink to="/perf"          startsWith icon={TrendingUp} label="Performance"  badge="AI" badgeColor={R}/>
          <NavLink to="/scout"         startsWith icon={Target}     label="Scout"        badge="NEW" badgeColor={T}/>
          <NavLink to="/scout/history" startsWith icon={Clock}      label="Scout History" sub/>
          <NavLink to="/seo"           startsWith icon={BarChart2}  label="SEO Hub"/>
        <NavLink to="/seo/gbp-audit"            icon={MapPin}    label="GBP Audit"/>
        <NavLink to="/seo/onpage"               icon={Globe}     label="On-Page Audit"/>

          <Section label="Support"/>
          <NavLink to="/desk"          startsWith icon={Inbox}      label="KotoDesk"/>
          <NavLink to="/desk/knowledge" startsWith icon={Brain}     label="Q&A Knowledge" sub/>
          <NavLink to="/desk/reports"  startsWith icon={BarChart2}  label="Desk Reports"  sub/>

          {/* Client tree */}
          {clients.length > 0 && (
            <>
              <Section label="Clients"/>
              {clients.slice(0,8).map(c=>(
                <div key={c.id}>
                  <div onClick={()=>toggleClient(c.id)} style={{
                    display:'flex',alignItems:'center',gap:9,
                    padding:'6px 14px',borderRadius:8,cursor:'pointer',
                    color:'rgba(255,255,255,.42)',fontSize:13,
                    transition:'all .12s',
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.color='rgba(255,255,255,.8)';e.currentTarget.style.background='rgba(255,255,255,.05)'}}
                    onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,.42)';e.currentTarget.style.background='transparent'}}>
                    <Folder size={14} style={{flexShrink:0,opacity:.65}}/>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                    {expanded[c.id]
                      ? <ChevronDown size={11} style={{flexShrink:0,opacity:.4}}/>
                      : <ChevronRight size={11} style={{flexShrink:0,opacity:.4}}/>}
                  </div>
                  {expanded[c.id] && (projectsMap[c.id]||[]).map(p=>(
                    <Link key={p.id} to={`/project/${p.id}`} style={{
                      display:'flex',alignItems:'center',gap:8,
                      padding:'5px 14px 5px 36px',borderRadius:8,
                      textDecoration:'none',color:'rgba(255,255,255,.38)',
                      fontSize:13,transition:'all .12s',
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.color='rgba(255,255,255,.75)'}}
                      onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,.38)'}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,.2)',flexShrink:0}}/>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}

          <Section label="Agency"/>
          <NavLink to="/billing"     icon={CreditCard} label="Billing"/>
        <NavLink to="/agency-settings" startsWith icon={Settings} label="Agency Settings"/>
          <NavLink to="/integrations" icon={Plug} label="Integrations"/>
        </div>

        {/* Footer */}
        <div style={{padding:'12px 10px',borderTop:'1px solid rgba(255,255,255,.06)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 6px',borderRadius:10,
            background:'rgba(255,255,255,.04)'}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:R,flexShrink:0,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:13,fontWeight:800,color:'#fff'}}>
              {(firstName||'A')[0].toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:W,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {firstName||user?.email?.split('@')[0]||'Agent'}
              </div>
              <div style={{fontSize:13,color:'rgba(255,255,255,.3)'}}>Agency</div>
            </div>
            <button onClick={()=>signOut().then(()=>navigate('/login'))}
              style={{padding:5,border:'none',background:'none',cursor:'pointer',
                color:'rgba(255,255,255,.3)',borderRadius:6,transition:'color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.7)'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.3)'}>
              <LogOut size={13}/>
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <NewProjectModal
          clientId={newProjClient}
          onClose={()=>{setShowModal(false);setNewProjClient(null)}}
          onCreated={()=>{loadClients();setShowModal(false)}}
        />
      )}
    </>
  )
}