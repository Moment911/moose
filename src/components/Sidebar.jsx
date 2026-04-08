"use client"
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Activity, BarChart2, BookOpen, Brain, CheckCircle, Eye, HelpCircle, CheckSquare, ChevronDown, ChevronRight, Clock, Code2, Cpu, CreditCard, Download, Edit2, FileSignature, FileText, Folder, Globe, HardDrive, Inbox, Layers, LayoutGrid, LogOut, Mail, MapPin, MoreHorizontal, Phone, PhoneIncoming, Plug, Plus, Search, Settings, Shield, Sparkles, Star, Target, Trash2, TrendingUp, Users, Workflow, Zap
} from 'lucide-react'
import { getClients, getProjects, signOut, createClient_, deleteClient, updateProject, deleteProject } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import NewProjectModal from './NewProjectModal'
import NotificationCenter from './NotificationCenter'
import DarkModeToggle from './DarkModeToggle'
import toast from 'react-hot-toast'

const R   = '#E6007E'
const T  = '#00C2CB'
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
      background: active ? 'rgba(234,39,41,.08)' : 'transparent',
      color: active ? R : '#374151',
      fontSize: sub ? 12 : 13,
      fontWeight: active ? 700 : 400,
      letterSpacing: active ? '-.01em' : 'normal',
      transition:'all .12s ease',
      position:'relative',
      margin:'1px 0',
    }}
      onMouseEnter={e=>{ if(!active){e.currentTarget.style.color='#111';e.currentTarget.style.background='rgba(0,0,0,.04)'}}}
      onMouseLeave={e=>{ if(!active){e.currentTarget.style.color='#374151';e.currentTarget.style.background='transparent'}}}>
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
      color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.12em'}}>
      {label}
    </div>
  )
}

export default function Sidebar() {
  const { user, firstName, agencyId, isImpersonating, isPreviewingClient, isSuperAdmin, isAgencyAdmin, isAgencyStaff, isViewer, isClient } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
        background:'#ffffff',
        display:'flex',flexDirection:'column',
        height:'100vh',overflow:'hidden',flexShrink:0,
        borderRight:'1px solid #e5e7eb',
        fontFamily:"var(--font-body)",
      }}>

        {/* Logo */}
        <div style={{padding:'20px 16px 14px',flexShrink:0,borderBottom:'1px solid #f3f4f6'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/koto_logo.svg" alt="Koto" style={{height:28,width:'auto',display:'block'}}/>
          </div>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 6px',
          scrollbarWidth:'none'}}>

          {/* ══════ CLIENT VIEW (minimal — only permitted items) ══════ */}
          {isClient && (<>
            <NavLink to="/" exact icon={LayoutGrid} label="Dashboard"/>
            <NavLink to="/tasks" startsWith icon={CheckSquare} label="My Tasks"/>
            <NavLink to="/desk" startsWith icon={Inbox} label="Support"/>
            <NavLink to="/help" icon={HelpCircle} label="Help Center"/>
          </>)}

          {/* ══════ AGENCY VIEW (standard tools) ══════ */}
          {!isClient && (<>

            {/* SUPER ADMIN: Platform section at top */}
            {isSuperAdmin && !isImpersonating && (<>
              <Section label="Platform"/>
              <NavLink to="/" exact icon={LayoutGrid} label="Platform Overview"/>
              <NavLink to="/platform-admin" icon={Shield} label="Platform Admin"/>
              <NavLink to="/billing-admin" icon={CreditCard} label="Billing Admin"/>
{/* Stripe merged into /billing */}
              <NavLink to="/debug" icon={Shield} label="Debug Console"/>
              <NavLink to="/qa" icon={Shield} label="QA Console" badge="NEW" badgeColor={T}/>
              <NavLink to="/voice/live" icon={Phone} label="Live Calls"/>
              <NavLink to="/voice/test-console" icon={Phone} label="Voice Test Lab"/>
              <NavLink to="/uptime" icon={Activity} label="Uptime Monitor"/>
              <a href="/status" target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',borderRadius:8,textDecoration:'none',color:'#374151',fontSize:13,margin:'1px 0',transition:'all .12s ease'}}
                onMouseEnter={e=>{e.currentTarget.style.color='#111';e.currentTarget.style.background='rgba(0,0,0,.04)'}}
                onMouseLeave={e=>{e.currentTarget.style.color='#374151';e.currentTarget.style.background='transparent'}}>
                <Activity size={14} style={{flexShrink:0,opacity:.65}}/><span style={{flex:1,lineHeight:1.2}}>System Status ↗</span>
              </a>
              <NavLink to="/master-admin" icon={Shield} label="Master Admin"/>
            </>)}

            {/* Dashboard (when impersonating or agency admin) */}
            {(isImpersonating || !isSuperAdmin) && (
              <NavLink to="/" exact icon={LayoutGrid} label="Dashboard"/>
            )}

            {/* CLIENTS */}
            <Section label="Clients"/>
            <NavLink to="/clients" startsWith icon={Users} label="Clients"/>
            <NavLink to="/onboarding-dashboard" startsWith icon={CheckCircle} label="Onboarding"/>
            <NavLink to="/tasks" startsWith icon={CheckSquare} label="Tasks"/>
            <NavLink to="/desk" startsWith icon={Inbox} label="KotoDesk"/>
            <NavLink to="/desk/knowledge" startsWith icon={Brain} label="Q&A Knowledge" sub/>
            <NavLink to="/desk/reports" startsWith icon={BarChart2} label="Desk Reports" sub/>

            {/* GROWTH */}
            <Section label="Growth"/>
            <NavLink to="/reviews" startsWith icon={Star} label="Reviews"/>
            <NavLink to="/review-campaigns" startsWith icon={Star} label="Review Campaigns"/>
            <NavLink to="/proposals" startsWith icon={FileSignature} label="Proposals"/>
            <NavLink to="/proposal-library" startsWith icon={Layers} label="Proposal Library"/>
            <NavLink to="/automations" icon={Workflow} label="Automations"/>
            <NavLink to="/invoice-builder" icon={FileText} label="Invoice Builder"/>

            {/* SEO & CONTENT */}
            {/* DESIGN */}
            <Section label="Design"/>
            <NavLink to="/proof" startsWith icon={FileSignature} label="KotoProof"/>

            <Section label="SEO & Content"/>
            <NavLink to="/page-builder" icon={Sparkles} label="Page Builder"/>
            <NavLink to="/wordpress" icon={Globe} label="WP Plugin"/>
            <NavLink to="/seo" startsWith icon={BarChart2} label="SEO Hub"/>
            {location.pathname.startsWith('/seo') && (<>
              <NavLink to="/seo/gbp-audit" icon={MapPin} label="GBP Audit" sub/>
              <NavLink to="/seo/onpage" icon={Globe} label="On-Page Audit" sub/>
              <NavLink to="/seo/keyword-gap" icon={Search} label="Keyword Gap" sub/>
              <NavLink to="/seo/monthly-report" icon={FileText} label="Monthly Report" sub/>
              <NavLink to="/seo/content-gap" icon={BookOpen} label="Content Gap" sub/>
              <NavLink to="/seo/technical-audit" icon={Code2} label="Tech Audit" sub/>
              <NavLink to="/seo/ai-visibility" icon={Brain} label="AI Visibility" sub/>
              <NavLink to="/seo/white-label" icon={Download} label="White-Label Report" sub/>
              <NavLink to="/seo/competitor-intel" icon={BarChart2} label="Competitor Intel" sub/>
              <NavLink to="/seo/citations" icon={MapPin} label="Citation Tracker" sub/>
            </>)}

            {/* INTELLIGENCE */}
            <Section label="Intelligence"/>
            <NavLink to="/intelligence" icon={Brain} label="Predictive Intel" badge="AI" badgeColor={R}/>
            <NavLink to="/agent" icon={Brain} label="CMO Agent" badge="AI"/>
            <NavLink to="/perf" startsWith icon={TrendingUp} label="Performance" badge="AI" badgeColor={R}/>
            <NavLink to="/scout" startsWith icon={Target} label="Scout" badge="NEW" badgeColor={T}/>
            <NavLink to="/scout/history" startsWith icon={Clock} label="Scout History" sub/>
            <NavLink to="/scout/pipeline" startsWith icon={Target} label="Pipeline CRM" sub/>
            <NavLink to="/voice" startsWith icon={Phone} label="Voice Agent" badge="AI" badgeColor={R}/>
            <NavLink to="/voice/closer" icon={Target} label="Closer Dashboard" sub/>
            <NavLink to="/answering" startsWith icon={PhoneIncoming} label="Answering Service"/>
            <NavLink to="/qa-intelligence" icon={Brain} label="Q&A Intelligence" badge="NEW" badgeColor={T}/>
            <NavLink to="/industry-agents" icon={Globe} label="Industry Agents" sub/>
            <NavLink to="/opportunities" icon={Zap} label="Opportunities" badge="NEW" badgeColor={R}/>
            <NavLink to="/pixels" icon={Eye} label="Visitor Intelligence" badge="NEW" badgeColor={R}/>

            {/* OUTREACH */}
            <Section label="Outreach"/>
            <NavLink to="/sequences" icon={Mail} label="Sequences" badge="NEW" badgeColor={T}/>

            {/* AGENCY */}
            <Section label="Agency"/>
            <NavLink to="/phones" icon={Phone} label="Phone Numbers"/>
            <NavLink to="/marketplace" icon={Sparkles} label="Marketplace"/>
            <NavLink to="/integrations" icon={Plug} label="Integrations"/>
            <NavLink to="/integrations/ghl" icon={Zap} label="GoHighLevel" sub/>
            <NavLink to="/billing" icon={CreditCard} label="Billing"/>
            <NavLink to="/agency-settings" startsWith icon={Settings} label="Agency Settings"/>
            <NavLink to="/help" icon={HelpCircle} label="Help Center"/>

          </>)}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 10px',borderTop:'1px solid #f3f4f6',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 6px',borderRadius:10,
            background:'rgba(0,0,0,.03)'}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:R,flexShrink:0,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:13,fontWeight:800,color:'#fff'}}>
              {(firstName||'A')[0].toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#111',
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {firstName||user?.email?.split('@')[0]||'Agent'}
              </div>
              <div style={{fontSize:13,color:'#9ca3af'}}>Agency</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <NotificationCenter/>
              <DarkModeToggle/>
              <button onClick={()=>signOut().then(()=>navigate('/login'))}
                style={{padding:5,border:'none',background:'none',cursor:'pointer',
                  color:'#9ca3af',borderRadius:6,transition:'color .15s'}}
                onMouseEnter={e=>e.currentTarget.style.color='#374151'}
                onMouseLeave={e=>e.currentTarget.style.color='#9ca3af'}>
                <LogOut size={13}/>
              </button>
            </div>
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
