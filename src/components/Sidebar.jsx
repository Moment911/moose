"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Activity, ArrowLeft, BarChart2, BookOpen, Brain, CheckCircle, DollarSign, Eye, HelpCircle, CheckSquare, ChevronDown, ChevronRight, Clock, Code2, Cpu, CreditCard, Database, Download, Edit2, FileSignature, FileText, FlaskConical, Folder, Globe, HardDrive, Inbox, Key, Layers, LayoutGrid, LogOut, Mail, MapPin, MoreHorizontal, Phone, PhoneIncoming, Plug, Plus, Search, Settings, Shield, ShoppingCart, Sparkles, Star, Target, Trash2, TrendingUp, Users, Workflow, X, Zap
} from 'lucide-react'
import { getClients, getProjects, signOut, createClient_, deleteClient, updateProject, deleteProject } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import NewProjectModal from './NewProjectModal'
import NotificationCenter from './NotificationCenter'
import DarkModeToggle from './DarkModeToggle'
import toast from 'react-hot-toast'

import { R, T, W } from '../lib/theme'

function NavLink({ to, icon: Icon, label, exact, startsWith, badge, badgeColor, sub, hidden }) {
  const loc    = useLocation()
  if (hidden) return null
  const active = exact ? loc.pathname === to
    : startsWith ? loc.pathname.startsWith(to)
    : loc.pathname === to

  return (
    <Link to={to} onClick={e => { e.stopPropagation() }} style={{
      display:'flex', alignItems:'center', gap:8,
      padding: sub ? '4px 10px 4px 34px' : '6px 10px',
      borderRadius:8, textDecoration:'none',
      marginBottom:1,
      background: active ? R + '10' : 'transparent',
      borderLeft: active ? `3px solid ${R}` : '3px solid transparent',
      color: active ? R : sub ? '#6b7280' : '#111',
      fontSize: sub ? 12 : 13,
      fontWeight: active ? 700 : sub ? 500 : 600,
      transition:'all .12s ease',
    }}
      onMouseEnter={e=>{ if(!active){e.currentTarget.style.background='rgba(0,0,0,.03)'}}}
      onMouseLeave={e=>{ if(!active){e.currentTarget.style.background='transparent'}}}>
      <Icon size={sub?13:14} style={{flexShrink:0,color:active?R:sub?'#9ca3af':'#374151'}}/>
      <span style={{flex:1,lineHeight:1.2}}>{label}</span>
      {badge && (
        <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,
          background:badgeColor||T,color:'#fff',letterSpacing:'.04em',lineHeight:1.4}}>
          {badge}
        </span>
      )}
    </Link>
  )
}

// Accordion section — persists open/close state in localStorage
function Section({ id, label, icon: SIcon, children, defaultOpen, currentPath, forceOpen }) {
  // Auto-open if any child route matches the current path
  const childPaths = []
  const extractPaths = (kids) => {
    if (!kids) return
    const arr = Array.isArray(kids) ? kids : [kids]
    arr.forEach(child => {
      if (!child || !child.props) return
      if (child.props.to) childPaths.push(child.props.to)
      if (child.props.children) extractPaths(child.props.children)
    })
  }
  extractPaths(children)
  const hasActiveChild = childPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'))

  // Hide the entire section if ALL children are hidden
  const childArray = Array.isArray(children) ? children.flat() : [children]
  const allHidden = childArray.every(c => !c || c.props?.hidden === true)
  if (allHidden) return null

  const storageKey = `koto_sidebar_${id}`
  // Also check for a global search query passed via prop
  const searchActive = typeof window !== 'undefined' && document.querySelector('[data-sidebar-search]')?.value?.trim()

  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen ?? true
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) return saved === '1'
    return defaultOpen ?? hasActiveChild
  })

  // Auto-open when navigating into this section or when search is active
  useEffect(() => {
    if (hasActiveChild && !open) setOpen(true)
  }, [currentPath])

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem(storageKey, next ? '1' : '0')
      return next
    })
  }, [storageKey])

  return (
    <div style={{ marginBottom: 2, marginTop: 4 }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '4px 10px', border: 'none', background: 'none',
          cursor: 'pointer', textAlign: 'left',
          fontSize: 10, fontWeight: 800, color: hasActiveChild ? R : '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '.1em',
          transition: 'color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#374151'}
        onMouseLeave={e => e.currentTarget.style.color = hasActiveChild ? R : '#9ca3af'}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronDown size={9} style={{
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform .15s',
          opacity: 0.4,
        }} />
      </button>
      {(open || forceOpen) && (
        <div style={{ overflow: 'hidden', padding: '1px 3px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { user, firstName, fullName, agencyId, agencyName, agency, loading: authLoading, isImpersonating, isPreviewingClient, isSuperAdmin, isAgencyAdmin, isAgencyStaff, isViewer, isClient, can, agencyFeatures, clientInfo, impersonateAgency, stopImpersonating } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const path = location.pathname

  const [clients,      setClients]      = useState([])
  const [expanded,     setExpanded]     = useState({})
  const [showModal,    setShowModal]    = useState(false)
  const [newProjClient,setNewProjClient]= useState(null)
  const [projectsMap,  setProjectsMap]  = useState({})
  const [searchQuery, setSearchQuery]   = useState('')
  const navScrollRef = useRef(null)
  const [wsOpen, setWsOpen] = useState(false)
  const [wsAgencies, setWsAgencies] = useState([])
  const [wsSearch, setWsSearch] = useState('')

  // Load agencies for workspace switcher (super admin only)
  useEffect(() => {
    if (!isSuperAdmin) return
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('agencies').select('id, name, brand_name, logo_url').order('name').then(({ data }) => setWsAgencies(data || []))
    })
  }, [isSuperAdmin])

  // Restore sidebar scroll position after mount (survives route changes)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('koto_sidebar_scroll')
      if (saved && navScrollRef.current) navScrollRef.current.scrollTop = parseInt(saved, 10)
    } catch {}
  }, [])

  useEffect(()=>{ loadClients() },[aid])

  async function loadClients() {
    const result = await getClients(aid)
    setClients(Array.isArray(result) ? result : result?.data || [])
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

  // When previewing as a client OR logged in as a real client user,
  // show the restricted client view with only permitted items.
  const showClientView = isClient || isPreviewingClient

  // Detect if we're inside a client detail page
  const isInClientDetail = path.startsWith('/clients/') && path.split('/').length >= 3 && path.split('/')[2]?.length > 10

  // Search filter — matches label text, case insensitive
  const sq = searchQuery.toLowerCase().trim()
  const match = (label) => !sq || label.toLowerCase().includes(sq)

  // Feature gate helper — hides nav items the agency's plan doesn't include.
  // When impersonating, respect the agency's flags (don't bypass with isSuperAdmin).
  const feat = (featureKey) => (!featureKey) || (isSuperAdmin && !isImpersonating) || can?.(featureKey) !== false

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

        {/* Workspace switcher */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid #e5e7eb', position: 'relative' }}>
          <button onClick={() => isSuperAdmin ? setWsOpen(!wsOpen) : null}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', border: 'none', background: 'none', cursor: isSuperAdmin ? 'pointer' : 'default', textAlign: 'left' }}
            onMouseEnter={e => { if (isSuperAdmin) e.currentTarget.style.background = '#f9fafb' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            {showClientView ? (
              <>
                {(agency?.brand_logo_url || agency?.logo_url) ? (
                  <img src={agency.brand_logo_url || agency.logo_url} alt="" style={{ height: 24, maxWidth: 100, objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: R, flexShrink: 0 }}>
                    {(agency?.brand_name || agencyName || 'A')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agency?.brand_name || agencyName || 'Agency'}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '.04em' }}>Client Portal</div>
                </div>
              </>
            ) : isImpersonating ? (
              <>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: R, flexShrink: 0 }}>
                  {(agencyName || 'A')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agencyName}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '.04em' }}>Agency</div>
                </div>
                {isSuperAdmin && <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
              </>
            ) : isSuperAdmin ? (
              <>
                <img src="/koto_logo.svg" alt="Koto" style={{ height: 22, width: 'auto' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Koto Admin</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '.04em' }}>Platform</div>
                </div>
                <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
              </>
            ) : (
              <>
                {(agency?.brand_logo_url || agency?.logo_url) ? (
                  <img src={agency.brand_logo_url || agency.logo_url} alt="" style={{ height: 24, maxWidth: 100, objectFit: 'contain' }} />
                ) : (
                  <img src="/koto_logo.svg" alt="Koto" style={{ height: 22, width: 'auto' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agencyName || 'Koto'}</div>
                </div>
              </>
            )}
          </button>

          {/* Workspace dropdown */}
          {wsOpen && isSuperAdmin && (
            <div style={{ position: 'absolute', top: '100%', left: 8, right: 8, zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.12)', overflow: 'hidden', maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <input value={wsSearch} onChange={e => setWsSearch(e.target.value)} placeholder="Search workspaces..." autoFocus
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#111', outline: 'none' }} />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Koto Admin option */}
                <button onClick={() => { stopImpersonating(); setWsOpen(false); setWsSearch(''); window.location.href = '/dashboard' }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid #f3f4f6', background: !isImpersonating ? '#f9fafb' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = !isImpersonating ? '#f9fafb' : '#fff'}>
                  <img src="/koto_logo.svg" alt="" style={{ height: 18, width: 'auto' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Koto Platform Admin</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>All agencies & settings</div>
                  </div>
                  {!isImpersonating && <div style={{ width: 8, height: 8, borderRadius: '50%', background: R }} />}
                </button>

                {/* Agency list */}
                {wsAgencies.filter(a => !wsSearch || (a.name || a.brand_name || '').toLowerCase().includes(wsSearch.toLowerCase())).map(a => {
                  const isActive = agencyId === a.id
                  return (
                    <button key={a.id} onClick={() => { impersonateAgency(a); setWsOpen(false); setWsSearch(''); window.location.href = '/clients' }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid #f3f4f6', background: isActive ? '#f9fafb' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = isActive ? '#f9fafb' : '#fff'}>
                      {a.logo_url ? (
                        <img src={a.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'contain', background: '#f3f4f6' }} />
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: R, flexShrink: 0 }}>
                          {(a.brand_name || a.name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.brand_name || a.name}</div>
                      </div>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: R }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Click-away to close */}
          {wsOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setWsOpen(false); setWsSearch('') }} />}
        </div>

        {/* Search — scoped to current hierarchy level */}
        <div style={{padding:'8px 8px 4px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'#f3f4f6',borderRadius:8,padding:'6px 10px'}}>
            <Search size={13} style={{color:'#9ca3af',flexShrink:0}}/>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isSuperAdmin && !isImpersonating ? 'Search platform…' : showClientView ? 'Search…' : 'Search tools…'}
              style={{flex:1,border:'none',background:'transparent',outline:'none',fontSize:12,color:'#374151',fontFamily:'inherit'}}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',padding:0,display:'flex'}}>
                <X size={11}/>
              </button>
            )}
          </div>
        </div>

        {/* Nav — scroll position persists across route changes */}
        <div ref={navScrollRef} onScroll={e => { try { sessionStorage.setItem('koto_sidebar_scroll', String(e.currentTarget.scrollTop)) } catch {} }} style={{flex:1,overflowY:'auto',padding:'4px 6px',
          scrollbarWidth:'none'}}>

          {/* ══════ CLIENT VIEW — ONLY shows tools the agency explicitly enabled ══════ */}
          {showClientView && (<>
            <NavLink to="/" exact icon={LayoutGrid} label="Dashboard"/>
            <NavLink to="/proof" startsWith icon={FileSignature} label="KotoProof" hidden={!can?.('view_pages')}/>
            <NavLink to="/tasks" startsWith icon={CheckSquare} label="My Tasks" hidden={!can?.('view_tasks')}/>
            <NavLink to="/reviews" startsWith icon={Star} label="Reviews" hidden={!can?.('view_reviews')}/>
            <NavLink to="/proposals" startsWith icon={FileSignature} label="Proposals" hidden={!can?.('view_proposals')}/>
            <NavLink to="/perf" startsWith icon={TrendingUp} label="Reports" hidden={!can?.('view_reports')}/>
            <NavLink to="/seo" startsWith icon={BarChart2} label="SEO Hub" hidden={!can?.('seo_hub')}/>
            <NavLink to="/page-builder" icon={Sparkles} label="Page Builder" hidden={!can?.('page_builder')}/>
            <NavLink to="/scout" startsWith icon={Target} label="Scout" hidden={!can?.('scout')}/>
            <NavLink to="/voice" startsWith icon={Phone} label="Voice Agent" hidden={!can?.('voice_agent')}/>
            <NavLink to="/my-front-desk" icon={PhoneIncoming} label="Front Desk" hidden={!can?.('front_desk')}/>
            <NavLink to="/agent" icon={Brain} label="AI CMO" hidden={!can?.('cmo_agent')}/>
            <NavLink to="/billing" icon={CreditCard} label="Billing" hidden={!can?.('view_billing')}/>
          </>)}

          {/* ══════ CLIENT DETAIL VIEW — simplified nav when inside a client ══════ */}
          {!showClientView && isInClientDetail && (<>
            <div style={{ padding: '8px 10px 4px' }}>
              <NavLink to="/clients" icon={ArrowLeft} label="All Clients" />
            </div>
            <div style={{ padding: '2px 10px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', padding: '4px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {clients.find(c => path.includes(c.id))?.name || 'Client'}
              </div>
            </div>
            <Section id="client-tools" label="Client Tools" defaultOpen currentPath={path} forceOpen>
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=overview'} icon={LayoutGrid} label="Overview" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=front-desk'} icon={PhoneIncoming} label="Front Desk" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=onboarding'} icon={CheckCircle} label="Onboarding" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=online'} icon={Globe} label="Online Presence" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=reviews'} icon={Star} label="Reviews" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=calls'} icon={Phone} label="Calls" />
              <NavLink to={path.split('/').slice(0, 3).join('/') + '?tab=intelligence'} icon={Brain} label="Intelligence" />
            </Section>
          </>)}

          {/* ══════ AGENCY VIEW (standard tools) ══════ */}
          {!showClientView && !isInClientDetail && (<>

            {/* SUPER ADMIN: Platform + Testing section */}
            {isSuperAdmin && !isImpersonating && (
              <Section id="admin" label="Admin & Testing" icon={Shield} currentPath={path} forceOpen={!!sq}>
                <NavLink to="/" exact icon={LayoutGrid} label="Platform Overview"/>
                <NavLink to="/platform-admin" icon={Shield} label="Platform Admin"/>
                <NavLink to="/billing-admin" icon={CreditCard} label="Billing Admin"/>
                <NavLink to="/master-admin" icon={Shield} label="Master Admin"/>
                <NavLink to="/debug" icon={Shield} label="Debug Console"/>
                <NavLink to="/qa" icon={Shield} label="QA Console" badge="NEW" badgeColor={T}/>
                <NavLink to="/cog-report" icon={DollarSign} label="Expense Intelligence"/>
                <NavLink to="/token-usage" icon={Zap} label="Token Usage" sub/>
                <NavLink to="/uptime" icon={Activity} label="Uptime Monitor"/>
                <a href="/status" target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',borderRadius:8,textDecoration:'none',color:'#374151',fontSize:13,margin:'1px 0',transition:'all .12s ease'}}
                  onMouseEnter={e=>{e.currentTarget.style.color='#111';e.currentTarget.style.background='rgba(0,0,0,.04)'}}
                  onMouseLeave={e=>{e.currentTarget.style.color='#374151';e.currentTarget.style.background='transparent'}}>
                  <Activity size={14} style={{flexShrink:0,opacity:.65}}/><span style={{flex:1,lineHeight:1.2}}>System Status ↗</span>
                </a>
                <NavLink to="/voice/live" icon={Phone} label="Live Calls"/>
                <NavLink to="/voice/test-console" icon={Phone} label="Voice Test Lab"/>
                <NavLink to="/test-data" icon={FlaskConical} label="Test Data" badge="DEV" badgeColor="#D97706"/>
                <NavLink to="/onboarding-simulator" icon={FlaskConical} label="Onboarding Sim" badge="DEV" badgeColor="#D97706"/>
              </Section>
            )}

            {/* Dashboard (when impersonating or agency admin) */}
            {(isImpersonating || !isSuperAdmin) && (
              <NavLink to="/" exact icon={LayoutGrid} label="Dashboard"/>
            )}

            {/* CLIENTS & DELIVERY */}
            <Section id="clients" label="Clients" icon={Users} defaultOpen currentPath={path} forceOpen={!!sq}>
              <NavLink to="/clients" startsWith icon={Users} label="Clients" hidden={!match('Clients') || !feat('clients')}/>
              <NavLink to="/onboarding-dashboard" startsWith icon={CheckCircle} label="Onboarding" hidden={!match('Onboarding') || !feat('onboarding')}/>
              <NavLink to="/discovery" startsWith icon={Brain} label="Discovery" hidden={!match('Discovery') || !feat('discovery')}/>
              <NavLink to="/front-desk" icon={PhoneIncoming} label="Front Desk" badge="AI" badgeColor={R} hidden={!match('Front Desk')}/>
              <NavLink to="/proof" startsWith icon={FileSignature} label="KotoProof" hidden={!match('KotoProof') || !feat('koto_proof')}/>
              <NavLink to="/tasks" startsWith icon={CheckSquare} label="Tasks" hidden={!match('Tasks') || !feat('tasks')}/>
              <NavLink to="/desk" startsWith icon={Inbox} label="KotoDesk" hidden={!match('KotoDesk') || !feat('koto_desk')}/>
              <NavLink to="/desk/knowledge" startsWith icon={Brain} label="Q&A Knowledge" sub hidden={!match('Q&A Knowledge') || !feat('koto_desk')}/>
            </Section>

            {/* GROWTH & SALES */}
            <Section id="growth" label="Growth" icon={TrendingUp} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/reviews" startsWith icon={Star} label="Reviews" hidden={!match('Reviews') || !feat('reviews')}/>
              <NavLink to="/review-campaigns" startsWith icon={Star} label="Review Campaigns" sub hidden={!match('Review Campaigns') || !feat('review_campaigns')}/>
              <NavLink to="/proposals" startsWith icon={FileSignature} label="Proposals" hidden={!match('Proposals') || !feat('proposals')}/>
              <NavLink to="/proposal-library" startsWith icon={Layers} label="Proposal Library" sub hidden={!match('Proposal Library') || !feat('proposal_library')}/>
              <NavLink to="/perf" startsWith icon={TrendingUp} label="Performance" hidden={!match('Performance') || !feat('performance_dashboard')}/>
              <NavLink to="/invoice-builder" icon={FileText} label="Invoice Builder" hidden={!match('Invoice Builder') || !feat('invoice_builder')}/>
              <NavLink to="/order" icon={ShoppingCart} label="KotoOrder" hidden={!match('KotoOrder')}/>
            </Section>

            {/* SEO & CONTENT */}
            <Section id="seo" label="SEO & Content" icon={BarChart2} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/seo" startsWith icon={BarChart2} label="SEO Hub" hidden={!match('SEO Hub') || !feat('seo_hub')}/>
              {path.startsWith('/seo') && (<>
                <NavLink to="/seo/gbp-audit" icon={MapPin} label="GBP Audit" sub hidden={!feat('gbp_audit')}/>
                <NavLink to="/seo/onpage" icon={Globe} label="On-Page Audit" sub hidden={!feat('onpage_audit')}/>
                <NavLink to="/seo/keyword-gap" icon={Search} label="Keyword Gap" sub hidden={!feat('keyword_gap')}/>
                <NavLink to="/seo/monthly-report" icon={FileText} label="Monthly Report" sub hidden={!feat('monthly_report')}/>
                <NavLink to="/seo/content-gap" icon={BookOpen} label="Content Gap" sub hidden={!feat('content_gap')}/>
                <NavLink to="/seo/technical-audit" icon={Code2} label="Tech Audit" sub hidden={!feat('technical_audit')}/>
                <NavLink to="/seo/ai-visibility" icon={Brain} label="AI Visibility" sub hidden={!feat('ai_visibility')}/>
                <NavLink to="/seo/white-label" icon={Download} label="White-Label Report" sub hidden={!feat('white_label_report')}/>
                <NavLink to="/seo/competitor-intel" icon={BarChart2} label="Competitor Intel" sub hidden={!feat('competitor_intel')}/>
                <NavLink to="/seo/citations" icon={MapPin} label="Citation Tracker" sub hidden={!feat('citation_tracker')}/>
              </>)}
              <NavLink to="/page-builder" icon={Sparkles} label="Page Builder" hidden={!match('Page Builder') || !feat('page_builder')}/>
              <NavLink to="/wordpress" icon={Globe} label="WP Plugin" hidden={!match('WP Plugin') || !feat('wordpress_plugin')}/>
            </Section>

            {/* INTELLIGENCE */}
            <Section id="intelligence" label="Intelligence" icon={Brain} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/agent" icon={Brain} label="AI CMO" badge="AI" badgeColor={R} hidden={!match('AI CMO') || !feat('cmo_agent')}/>
              <NavLink to="/intelligence" icon={Brain} label="Predictive Intel" hidden={!match('Predictive Intel') || !feat('predictive_intel')}/>
              <NavLink to="/intel" startsWith icon={Zap} label="KotoIntel" badge="NEW" badgeColor={T} hidden={!match('KotoIntel')}/>
              <NavLink to="/kotoiq" icon={Search} label="KotoIQ" badge="NEW" badgeColor={R} hidden={!match('KotoIQ')}/>
              <NavLink to="/scout" startsWith icon={Target} label="Scout" hidden={!match('Scout') || !feat('scout')}/>
              <NavLink to="/scout/pipeline" startsWith icon={Target} label="Pipeline CRM" sub hidden={!match('Pipeline CRM') || !feat('pipeline_crm')}/>
              <NavLink to="/scout/history" startsWith icon={Clock} label="Scout History" sub hidden={!match('Scout History') || !feat('scout')}/>
              <NavLink to="/qa-intelligence" icon={Brain} label="Q&A Intelligence" hidden={!match('Q&A Intelligence') || !feat('qa_intelligence')}/>
              <NavLink to="/opportunities" icon={Zap} label="Opportunities" hidden={!match('Opportunities') || !feat('opportunities')}/>
            </Section>

            {/* VOICE & AI */}
            <Section id="voice" label="Voice & AI" icon={Phone} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/voice" startsWith icon={Phone} label="Voice Agent" badge="AI" badgeColor={R} hidden={!match('Voice Agent') || !feat('voice_agent')}/>
              <NavLink to="/answering" startsWith icon={PhoneIncoming} label="Answering Service" hidden={!match('Answering') || !feat('answering_service')}/>
              <NavLink to="/industry-agents" icon={Globe} label="Industry Agents" hidden={!match('Industry Agents') || !feat('industry_agents')}/>
              <NavLink to="/trades" icon={Zap} label="Trades Portal" sub hidden={!match('Trades Portal') || !feat('industry_agents')}/>
              <NavLink to="/video-voicemails" icon={Eye} label="Video Voicemails" hidden={!match('Video Voicemails') || !feat('video_voicemails')}/>
              <NavLink to="/avatars" icon={Users} label="AI Avatars" sub hidden={!match('AI Avatars') || !feat('ai_avatars')}/>
              <NavLink to="/pixels" icon={Eye} label="Visitor Intelligence" hidden={!match('Visitor Intelligence') || !feat('pixel_tracking')}/>
              <NavLink to="/vob" icon={Shield} label="VOB Agent" badge="RCM" badgeColor={T} hidden={!match('VOB Agent') || !feat('vob_agent')}/>
            </Section>

            {/* KOTOCLOSE */}
            {feat('kotoclose') && (
            <Section id="kotoclose" label="KotoClose" icon={Target} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/kotoclose/dashboard" startsWith icon={Target} label="Live Dashboard" badge="AI" badgeColor={R} hidden={!match('Live Dashboard')}/>
              <NavLink to="/kotoclose/calls" icon={Phone} label="Call Log" sub hidden={!match('Call Log')}/>
              <NavLink to="/kotoclose/callbacks" icon={Clock} label="Callbacks" sub hidden={!match('Callbacks')}/>
              <NavLink to="/kotoclose/campaigns" icon={Globe} label="Campaigns" sub hidden={!match('Campaigns')}/>
              <NavLink to="/kotoclose/voicemail" icon={PhoneIncoming} label="VM Studio" sub hidden={!match('VM Studio')}/>
              <NavLink to="/kotoclose/analytics" icon={BarChart2} label="Analytics" sub hidden={!match('Analytics')}/>
            </Section>
            )}

            {/* OUTREACH */}
            <Section id="outreach" label="Outreach" icon={Mail} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/sequences" icon={Mail} label="Sequences" hidden={!match('Sequences') || !feat('email_sequences')}/>
              <NavLink to="/email-tracking" startsWith icon={Mail} label="Email Tracking" hidden={!match('Email Tracking') || !feat('email_tracking')}/>
              <NavLink to="/email-tracking/gmail-helper" icon={Mail} label="Gmail Helper" sub hidden={!match('Gmail Helper') || !feat('email_tracking')}/>
            </Section>

            {/* AGENCY */}
            <Section id="agency" label="Agency" icon={Settings} currentPath={path} forceOpen={!!sq}>
              <NavLink to="/vault" icon={Database} label="Data Vault" hidden={!match('Data Vault') || !feat('data_vault')}/>
              <NavLink to="/phones" icon={Phone} label="Phone Numbers" hidden={!match('Phone Numbers') || !feat('phone_numbers')}/>
              <NavLink to="/integrations" icon={Plug} label="Integrations" hidden={!match('Integrations') || !feat('team_management')}/>
              <NavLink to="/integrations/ghl" icon={Zap} label="GoHighLevel" sub hidden={!match('GoHighLevel') || !feat('team_management')}/>
              <NavLink to="/billing" icon={CreditCard} label="Billing" hidden={!match('Billing') || !feat('client_billing')}/>
              <NavLink to="/agency-settings" startsWith icon={Settings} label="Settings" hidden={!match('Settings') || !feat('team_management')}/>
              <NavLink to="/help" icon={HelpCircle} label="Help Center" hidden={!match('Help Center') || !feat('help_center')}/>
            </Section>

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
                {showClientView ? (fullName || firstName || user?.email?.split('@')[0] || 'Client') : (firstName||user?.email?.split('@')[0]||'Agent')}
              </div>
              <div style={{fontSize:13,color:'#9ca3af'}}>{showClientView ? (clientInfo?.name || agency?.brand_name || 'Client') : isSuperAdmin && !isImpersonating ? 'Koto Admin' : (agencyName || 'Agency')}</div>
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
