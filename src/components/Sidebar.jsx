"use client"
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Users, FileSignature, Clock, Inbox, Brain,
  BarChart2, TrendingUp, Target, Plug, Settings, Shield,
  Cpu, Workflow, MessageSquare, ChevronRight, ChevronDown,
  LogOut, Plus, Folder, FolderOpen, Trash2, Edit2,
  MoreHorizontal, HelpCircle, Star, Zap
} from 'lucide-react'
import { getClients, getProjects, signOut, createClient_, deleteClient, updateProject, deleteProject } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import NewProjectModal from './NewProjectModal'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'

/* ── Nav link ──────────────────────────────────────────────────── */
function NavLink({ to, icon: Icon, label, exact, startsWith, badge, badgeColor, indent }) {
  const location = useLocation()
  const active = exact
    ? location.pathname === to
    : startsWith
    ? location.pathname.startsWith(to)
    : location.pathname === to

  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: indent ? '6px 12px 6px 28px' : '7px 12px',
      borderRadius: 8, textDecoration: 'none',
      background: active ? 'rgba(234,39,41,.12)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,.5)',
      fontSize: 13, fontWeight: active ? 600 : 400,
      transition: 'all .12s ease',
      position: 'relative',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,.8)'; if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,.5)'; if (!active) e.currentTarget.style.background = 'transparent' }}>
      {active && (
        <span style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
          width:2.5, height:16, background:RED, borderRadius:4 }}/>
      )}
      <Icon size={14} style={{ flexShrink:0, color: active ? RED : 'inherit', opacity: active?1:.7 }}/>
      <span style={{ flex:1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:20,
          background: badgeColor || TEAL, color:'#fff', letterSpacing:'.06em' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

/* ── Section label ─────────────────────────────────────────────── */
function SectionLabel({ label }) {
  return (
    <div style={{ padding:'16px 12px 5px', fontSize:9, fontWeight:700,
      color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'.12em' }}>
      {label}
    </div>
  )
}

/* ── Client + project tree ─────────────────────────────────────── */
function ClientTree({ clients, onNewProject }) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const [expanded, setExpanded]   = useState({})
  const [projects, setProjects]   = useState({})
  const [menuOpen, setMenuOpen]   = useState(null)
  const [renaming, setRenaming]   = useState(null)
  const [renameVal, setRenameVal] = useState('')

  async function toggleClient(client) {
    const id = client.id
    setExpanded(e => ({ ...e, [id]: !e[id] }))
    if (!projects[id]) {
      const { data } = await getProjects(id)
      setProjects(p => ({ ...p, [id]: data || [] }))
    }
  }

  async function deleteProj(clientId, projId) {
    if (!confirm('Delete this project?')) return
    await deleteProject(projId)
    setProjects(p => ({ ...p, [clientId]: (p[clientId]||[]).filter(x=>x.id!==projId) }))
    toast.success('Deleted')
  }

  async function renameProj(clientId, proj) {
    if (!renameVal.trim() || renameVal===proj.name) { setRenaming(null); return }
    await updateProject(proj.id, { name: renameVal.trim() })
    setProjects(p => ({ ...p, [clientId]: (p[clientId]||[]).map(x=>x.id===proj.id?{...x,name:renameVal.trim()}:x) }))
    setRenaming(null)
    toast.success('Renamed')
  }

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:8 }}>
      <SectionLabel label="Clients"/>
      {clients.map(client => {
        const isEx = expanded[client.id]
        const projs = projects[client.id] || []
        const initials = client.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
        return (
          <div key={client.id}>
            <button onClick={() => toggleClient(client)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 12px',
                background:'none', border:'none', cursor:'pointer', borderRadius:8,
                color: isEx ? '#fff' : 'rgba(255,255,255,.55)',
                transition:'all .12s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';e.currentTarget.style.color='rgba(255,255,255,.8)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=isEx?'#fff':'rgba(255,255,255,.55)'}}>
              <div style={{ width:22, height:22, borderRadius:6, background: isEx?RED:'rgba(255,255,255,.08)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:800, color: isEx?'#fff':'rgba(255,255,255,.4)', flexShrink:0 }}>
                {initials}
              </div>
              <span style={{ flex:1, fontSize:13, fontWeight: isEx?600:400, textAlign:'left',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {client.name}
              </span>
              <ChevronRight size={11} style={{ flexShrink:0, opacity:.4,
                transform: isEx?'rotate(90deg)':'none', transition:'transform .15s' }}/>
            </button>

            {isEx && (
              <div style={{ paddingLeft:8 }}>
                {projs.map(proj => (
                  <div key={proj.id} style={{ position:'relative', display:'flex', alignItems:'center' }}>
                    {renaming===proj.id ? (
                      <input autoFocus value={renameVal}
                        onChange={e=>setRenameVal(e.target.value)}
                        onBlur={()=>renameProj(client.id,proj)}
                        onKeyDown={e=>{if(e.key==='Enter')renameProj(client.id,proj);if(e.key==='Escape')setRenaming(null)}}
                        style={{ flex:1, margin:'2px 6px', padding:'4px 8px', fontSize:12,
                          background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)',
                          borderRadius:6, color:'#fff', outline:'none' }}/>
                    ) : (
                      <button onClick={()=>navigate(`/project/${proj.id}`)}
                        style={{ flex:1, display:'flex', alignItems:'center', gap:7, padding:'5px 6px 5px 20px',
                          background: location.pathname===`/project/${proj.id}`?'rgba(234,39,41,.1)':'none',
                          border:'none', cursor:'pointer', borderRadius:7, textAlign:'left',
                          color: location.pathname===`/project/${proj.id}`?'#fff':'rgba(255,255,255,.45)',
                          transition:'all .1s', fontSize:12 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';e.currentTarget.style.color='rgba(255,255,255,.75)'}}
                        onMouseLeave={e=>{e.currentTarget.style.background=location.pathname===`/project/${proj.id}`?'rgba(234,39,41,.1)':'none';e.currentTarget.style.color=location.pathname===`/project/${proj.id}`?'#fff':'rgba(255,255,255,.45)'}}>
                        <Folder size={11} style={{ flexShrink:0, opacity:.5 }}/>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                          {proj.name}
                        </span>
                      </button>
                    )}
                    <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===proj.id?null:proj.id)}}
                      style={{ padding:'3px 5px', background:'none', border:'none', cursor:'pointer',
                        color:'rgba(255,255,255,.25)', borderRadius:5, flexShrink:0, marginRight:4 }}
                      onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.6)'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.25)'}>
                      <MoreHorizontal size={11}/>
                    </button>
                    {menuOpen===proj.id && (
                      <div style={{ position:'absolute', right:4, top:'100%', zIndex:99,
                        background:'#1a1a1a', border:'1px solid rgba(255,255,255,.1)',
                        borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.4)', minWidth:140, overflow:'hidden' }}>
                        <button onClick={()=>{setRenaming(proj.id);setRenameVal(proj.name);setMenuOpen(null)}}
                          style={{ width:'100%', padding:'9px 14px', border:'none', background:'none',
                            cursor:'pointer', color:'rgba(255,255,255,.7)', fontSize:13, textAlign:'left',
                            display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                          onMouseLeave={e=>e.currentTarget.style.background='none'}>
                          <Edit2 size={12}/> Rename
                        </button>
                        <button onClick={()=>{deleteProj(client.id,proj.id);setMenuOpen(null)}}
                          style={{ width:'100%', padding:'9px 14px', border:'none', background:'none',
                            cursor:'pointer', color:'#f87171', fontSize:13, textAlign:'left',
                            display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                          onMouseLeave={e=>e.currentTarget.style.background='none'}>
                          <Trash2 size={12}/> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={()=>onNewProject(client)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:6, padding:'5px 6px 5px 20px',
                    background:'none', border:'none', cursor:'pointer', borderRadius:7,
                    color:'rgba(255,255,255,.25)', fontSize:12, transition:'color .1s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.6)'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.25)'}>
                  <Plus size={11}/> New project
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function Sidebar() {
  const navigate = useNavigate()
  const { firstName, agencyName, signOut: authSignOut } = useAuth()
  const [clients, setClients]         = useState([])
  const [newProjClient, setNewProjClient] = useState(null)

  useEffect(() => {
    getClients().then(({ data }) => setClients(data || []))
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="sidebar-root">
      {/* Logo */}
      <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:RED,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Zap size={15} color="#fff" fill="#fff"/>
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:800,
              color:'#fff', letterSpacing:'-.01em', lineHeight:1 }}>
              MOOSE
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', fontWeight:600,
              letterSpacing:'.1em', textTransform:'uppercase', marginTop:2 }}>
              {agencyName || 'Agency Platform'}
            </div>
          </div>
        </div>
      </div>

      {/* Core nav */}
      <div style={{ padding:'10px 8px 0', flexShrink:0 }}>
        <SectionLabel label="Core"/>
        <NavLink to="/"            exact icon={LayoutGrid}    label="Project Hub"/>
        <NavLink to="/clients"     startsWith icon={Users}    label="Clients"/>
        <NavLink to="/reviews"     startsWith icon={Star}     label="Reviews"/>
        <NavLink to="/proposals"   startsWith icon={FileSignature} label="Proposals"/>
        <NavLink to="/automations" icon={Workflow}            label="Automations"/>
      </div>

      {/* Client tree */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 8px', minHeight:0 }}>
        <ClientTree clients={clients} onNewProject={setNewProjClient}/>
      </div>

      {/* Intelligence section */}
      <div style={{ padding:'0 8px', flexShrink:0, borderTop:'1px solid rgba(255,255,255,.06)' }}>
        <SectionLabel label="Intelligence"/>
        <NavLink to="/perf"          startsWith icon={TrendingUp}   label="Performance"  badge="AI" badgeColor={RED}/>
        <NavLink to="/scout"         startsWith icon={Target}       label="Scout"        badge="NEW" badgeColor={TEAL}/>
        <NavLink to="/scout/history" startsWith icon={Clock}        label="Scout History"/>
        <NavLink to="/desk"          startsWith icon={Inbox}        label="MooseDesk"/>
        <NavLink to="/desk/knowledge" startsWith icon={Brain}       label="Q&A Knowledge"/>
        <NavLink to="/desk/reports"  startsWith icon={BarChart2}    label="Desk Reports"/>
        <NavLink to="/seo"           startsWith icon={BarChart2}     label="SEO Hub"/>
      </div>

      {/* Agency section */}
      <div style={{ padding:'0 8px 8px', flexShrink:0, borderTop:'1px solid rgba(255,255,255,.06)' }}>
        <SectionLabel label="Agency"/>
        <NavLink to="/integrations" icon={Plug}     label="Integrations"/>
        <NavLink to="/platform"     startsWith icon={Cpu} label="Platform Admin"/>
        <NavLink to="/settings"     exact icon={Settings} label="Settings"/>
      </div>

      {/* User footer */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0,
        display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:RED,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
          {(firstName||'A')[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.85)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {firstName || 'Account'}
          </div>
        </div>
        <button onClick={handleSignOut}
          style={{ padding:5, background:'none', border:'none', cursor:'pointer',
            color:'rgba(255,255,255,.25)', borderRadius:6, transition:'color .1s' }}
          onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.6)'}
          onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.25)'}>
          <LogOut size={13}/>
        </button>
      </div>

      {newProjClient && (
        <NewProjectModal
          client={newProjClient}
          onClose={()=>setNewProjClient(null)}
          onCreated={()=>setNewProjClient(null)}
        />
      )}
    </div>
  )
}