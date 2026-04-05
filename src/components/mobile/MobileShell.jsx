"use client";
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Users, Inbox, Target, TrendingUp,
  Settings, ChevronLeft, Menu, X, Zap, Star,
  FileSignature, BarChart2, Brain, Clock,
  Plug, LogOut, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'

const R   = '#ea2729'
const BLK = '#0a0a0a'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const TABS = [
  { to:'/',        icon:LayoutGrid, label:'Home'    },
  { to:'/clients', icon:Users,      label:'Clients' },
  { to:'/desk',    icon:Inbox,      label:'Desk'    },
  { to:'/perf',    icon:TrendingUp, label:'Perf'    },
  { to:'/scout',   icon:Target,     label:'Scout'   },
]

const DRAWER_SECTIONS = [
  { title:'Workspace', items:[
    { to:'/',                icon:LayoutGrid,    label:'Dashboard'     },
    { to:'/clients',         icon:Users,         label:'Clients'       },
    { to:'/reviews',         icon:Star,          label:'Reviews'       },
    { to:'/proposals',       icon:FileSignature, label:'Proposals'     },
  ]},
  { title:'Intelligence', items:[
    { to:'/perf',            icon:TrendingUp,    label:'Performance',  badge:'AI'  },
    { to:'/scout',           icon:Target,        label:'Scout',        badge:'NEW' },
    { to:'/scout/history',   icon:Clock,         label:'Scout History'             },
    { to:'/seo',             icon:BarChart2,     label:'SEO Hub'                   },
  ]},
  { title:'Support', items:[
    { to:'/desk',            icon:Inbox,         label:'KotoDesk'      },
    { to:'/desk/knowledge',  icon:Brain,         label:'Q&A Knowledge' },
    { to:'/desk/reports',    icon:BarChart2,     label:'Desk Reports'  },
  ]},
  { title:'Agency', items:[
    { to:'/agency-settings', icon:Settings,      label:'Settings'      },
    { to:'/integrations',    icon:Plug,          label:'Integrations'  },
  ]},
]

const NO_SHELL = [
  '/login','/welcome','/signup','/onboard','/onboarding',
  '/review/','/r/','/p/','/client-portal','/client-auth',
  '/access/','/privacy','/esign',
]

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768)
    check()
    const obs = new ResizeObserver(check)
    obs.observe(document.documentElement)
    return () => obs.disconnect()
  }, [])
  return m
}

export default function MobileShell({ children }) {
  const loc      = useLocation()
  const navigate = useNavigate()
  const { firstName } = useAuth()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)

  const path = loc.pathname

  useEffect(() => { setDrawerOpen(false) }, [path])

  useEffect(() => {
    if (!drawerOpen) return
    const handler = e => {
      if (drawerRef.current && !drawerRef.current.contains(e.target))
        setDrawerOpen(false)
    }
    document.addEventListener('touchstart', handler, { passive: true })
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousedown', handler)
    }
  }, [drawerOpen])

  // Always render children on desktop
  if (!isMobile) return children

  const skipShell = NO_SHELL.some(p => path.startsWith(p))
  if (skipShell) return children

  const activeIdx = TABS.findIndex(t =>
    t.to === '/' ? path === '/' : path.startsWith(t.to)
  )

  const pageLabel = TABS.find(t =>
    t.to === '/' ? path === '/' : path.startsWith(t.to)
  )?.label || (() => {
    if (path.startsWith('/agency-settings')) return 'Settings'
    if (path.startsWith('/reviews'))         return 'Reviews'
    if (path.startsWith('/proposals'))       return 'Proposals'
    if (path.startsWith('/integrations'))    return 'Integrations'
    if (path.startsWith('/seo'))             return 'SEO Hub'
    if (path.startsWith('/desk/knowledge'))  return 'Q&A Knowledge'
    if (path.startsWith('/desk/reports'))    return 'Desk Reports'
    if (path.startsWith('/desk/ticket'))     return 'Ticket'
    return 'Koto'
  })()

  return (
    <>
      {/* ── Global mobile CSS injected once ── */}
      <style>{`
        /* Lock the shell itself */
        #koto-mobile-shell {
          display: flex !important;
          flex-direction: column !important;
          height: 100dvh !important;
          overflow: hidden !important;
          background: #f2f2f0;
          position: fixed !important;
          inset: 0 !important;
          z-index: 0;
        }
        #koto-mobile-content {
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain;
        }
        /* Kill desktop sidebar everywhere */
        .desktop-sidebar { display: none !important; }
        /* Un-fix page shell heights so content scrolls */
        .page-shell {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        /* Each page's inner content div fills width */
        .page-shell > div:not(.desktop-sidebar) {
          width: 100% !important;
          max-width: 100vw !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        /* Tailwind flex + h-screen used by ScoutLayout */
        .flex.h-screen { height: auto !important; overflow: visible !important; }
        .flex-1.flex.flex-col.overflow-hidden { overflow: visible !important; height: auto !important; }
        /* Inner overflow:hidden panels → visible + scrollable */
        [style*="overflow:'hidden'"],
        [style*='overflow:"hidden"'],
        [style*="overflow: hidden"] {
          overflow: visible !important;
        }
        /* Flex rows that contain sidebar+content → stack vertically */
        [style*="display:'flex'"][style*="height:'100vh'"],
        [style*='display:"flex"'][style*='height:"100vh"'],
        [style*="display: flex"][style*="height: 100vh"],
        [style*="display:'flex'"][style*="minHeight:'100vh'"] {
          flex-direction: column !important;
          height: auto !important;
          min-height: auto !important;
        }
        /* Column panels (SEO client list, Agency settings nav) → hide on mobile */
        [style*="width:220px"],
        [style*="width: 220px"],
        [style*="width:240px"],
        [style*="width: 240px"] {
          display: none !important;
        }
        /* Right-side panels in 2-col layouts */
        [style*="gridTemplateColumns:'1fr 300px'"],
        [style*="gridTemplateColumns:'1fr 320px'"],
        [style*="gridTemplateColumns:'220px 1fr'"],
        [style*="gridTemplateColumns:'1fr 1fr'"] {
          grid-template-columns: 1fr !important;
        }
        /* Dark page headers: compact on mobile */
        [style*="background:'#0a0a0a'"] > div:first-child,
        [style*='background:"#0a0a0a"'] > div:first-child {
          padding: 12px 16px !important;
        }
        /* Horizontal tab bars scroll */
        [style*="display:'flex'"][style*="gap:0"] {
          overflow-x: auto !important;
          scrollbar-width: none !important;
          flex-wrap: nowrap !important;
          -webkit-overflow-scrolling: touch !important;
        }
        /* Prevent inputs from causing zoom */
        input, textarea, select { font-size: 16px !important; }
        /* Prevent horizontal overflow */
        * { max-width: 100vw; box-sizing: border-box; }
        /* Cards full width */
        [style*="maxWidth:1"] { max-width: 100% !important; }
        /* Grid: stat cards 2-col */
        [style*="gridTemplateColumns:'repeat(4"] { grid-template-columns: 1fr 1fr !important; }
        [style*="gridTemplateColumns:'repeat(3"] { grid-template-columns: 1fr 1fr !important; }
        /* Tables scroll horizontally */
        table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @keyframes koto-fade  { from { opacity:0 }              to { opacity:1 } }
        @keyframes koto-slide { from { transform:translateX(-100%) } to { transform:translateX(0) } }
      `}</style>

      <div id="koto-mobile-shell">

        {/* ── Top bar ── */}
        <div style={{
          background: BLK, flexShrink:0,
          paddingTop: 'env(safe-area-inset-top,0px)',
          zIndex: 100, position: 'relative',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <div style={{
            height:52, display:'flex', alignItems:'center',
            justifyContent:'space-between', padding:'0 6px',
          }}>
            {/* Hamburger */}
            <button onClick={() => setDrawerOpen(true)}
              style={{ width:44, height:44, display:'flex', alignItems:'center',
                justifyContent:'center', background:'none', border:'none',
                cursor:'pointer', WebkitTapHighlightColor:'transparent',
                borderRadius:10 }}>
              <Menu size={22} color="rgba(255,255,255,.7)" strokeWidth={1.8}/>
            </button>

            {/* Center */}
            <div style={{ flex:1, textAlign:'center' }}>
              {path === '/' ? (
                <div style={{ display:'flex', alignItems:'center',
                  justifyContent:'center', gap:7 }}>
                  <div style={{ width:24, height:24, borderRadius:7,
                    background:R, display:'flex', alignItems:'center',
                    justifyContent:'center' }}>
                    <Zap size={13} color="#fff" strokeWidth={2.5}/>
                  </div>
                  <span style={{ fontFamily:FH, fontSize:18, fontWeight:800,
                    color:'#fff', letterSpacing:'-.03em' }}>Koto</span>
                </div>
              ) : (
                <span style={{ fontFamily:FH, fontSize:17, fontWeight:700,
                  color:'#fff', letterSpacing:'-.02em' }}>{pageLabel}</span>
              )}
            </div>

            {/* Avatar */}
            <div style={{ width:44, height:44, display:'flex',
              alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:32, height:32, borderRadius:'50%',
                background:R, display:'flex', alignItems:'center',
                justifyContent:'center', fontFamily:FH,
                fontSize:14, fontWeight:800, color:'#fff' }}>
                {(firstName||'K')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div id="koto-mobile-content">
          {children}
        </div>

        {/* ── Bottom tab bar ── */}
        <div style={{
          background: BLK, flexShrink: 0, zIndex: 100,
          borderTop: '1px solid rgba(255,255,255,.09)',
          paddingBottom: 'env(safe-area-inset-bottom,0px)',
        }}>
          <div style={{ display:'flex', height:56 }}>
            {TABS.map((tab, i) => {
              const Icon   = tab.icon
              const active = i === activeIdx
              return (
                <button key={tab.to} onClick={() => navigate(tab.to)}
                  style={{
                    flex:1, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', gap:3,
                    background:'transparent', border:'none',
                    cursor:'pointer', WebkitTapHighlightColor:'transparent',
                    padding:'6px 0', transition:'opacity .1s',
                  }}>
                  <div style={{
                    width:34, height:28, borderRadius:9,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: active ? R+'22' : 'transparent',
                    transition:'background .15s',
                  }}>
                    <Icon size={21}
                      color={active ? R : 'rgba(255,255,255,.32)'}
                      strokeWidth={active ? 2.5 : 1.7}/>
                  </div>
                  <span style={{
                    fontFamily: FH, fontSize:10, fontWeight: active ? 700 : 500,
                    color: active ? R : 'rgba(255,255,255,.32)',
                    letterSpacing:'.02em', lineHeight:1,
                  }}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Drawer ── */}
      {drawerOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(0,0,0,.65)',
          backdropFilter:'blur(4px)',
          WebkitBackdropFilter:'blur(4px)',
          animation:'koto-fade .2s ease',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', top:0, left:0, bottom:0,
            width:'78vw', maxWidth:290,
            background: BLK,
            display:'flex', flexDirection:'column',
            paddingTop:'env(safe-area-inset-top,0px)',
            paddingBottom:'env(safe-area-inset-bottom,0px)',
            animation:'koto-slide .22s cubic-bezier(.22,1,.36,1)',
            boxShadow:'8px 0 40px rgba(0,0,0,.5)',
          }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', padding:'14px 16px 12px',
              borderBottom:'1px solid rgba(255,255,255,.07)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ width:26, height:26, borderRadius:7, background:R,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Zap size={13} color="#fff" strokeWidth={2.5}/>
                </div>
                <span style={{ fontFamily:FH, fontSize:17, fontWeight:800,
                  color:'#fff', letterSpacing:'-.03em' }}>Koto</span>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                style={{ width:32, height:32, borderRadius:8,
                  background:'rgba(255,255,255,.08)', border:'none',
                  cursor:'pointer', display:'flex', alignItems:'center',
                  justifyContent:'center', WebkitTapHighlightColor:'transparent' }}>
                <X size={15} color="rgba(255,255,255,.55)"/>
              </button>
            </div>

            {/* Nav */}
            <div style={{ flex:1, overflowY:'auto', padding:'6px 8px',
              WebkitOverflowScrolling:'touch' }}>
              {DRAWER_SECTIONS.map(sec => (
                <div key={sec.title} style={{ marginBottom:2 }}>
                  <div style={{ padding:'10px 8px 3px', fontFamily:FH, fontSize:10,
                    fontWeight:700, color:'rgba(255,255,255,.2)',
                    textTransform:'uppercase', letterSpacing:'.12em' }}>
                    {sec.title}
                  </div>
                  {sec.items.map(item => {
                    const Icon = item.icon
                    const active = item.to === '/'
                      ? path === '/'
                      : path.startsWith(item.to)
                    return (
                      <button key={item.to} onClick={() => navigate(item.to)}
                        style={{
                          width:'100%', display:'flex', alignItems:'center', gap:11,
                          padding:'10px 10px', borderRadius:10, border:'none',
                          background: active ? R+'18' : 'transparent',
                          borderLeft:`2.5px solid ${active ? R : 'transparent'}`,
                          cursor:'pointer', marginBottom:1,
                          WebkitTapHighlightColor:'transparent',
                          transition:'background .1s',
                        }}>
                        <Icon size={15}
                          color={active ? R : 'rgba(255,255,255,.38)'}
                          strokeWidth={active ? 2.5 : 1.8}/>
                        <span style={{ fontFamily:FH, fontSize:14,
                          fontWeight: active ? 700 : 500, flex:1, textAlign:'left',
                          color: active ? '#fff' : 'rgba(255,255,255,.5)' }}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span style={{ fontFamily:FH, fontSize:9, fontWeight:800,
                            padding:'2px 6px', borderRadius:20,
                            background: item.badge==='AI' ? R : '#5bc6d0',
                            color:'#fff', letterSpacing:'.06em' }}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding:'10px 10px 12px',
              borderTop:'1px solid rgba(255,255,255,.07)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10,
                padding:'10px 10px', borderRadius:12,
                background:'rgba(255,255,255,.05)', marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:R,
                  flexShrink:0, display:'flex', alignItems:'center',
                  justifyContent:'center', fontFamily:FH, fontSize:13,
                  fontWeight:800, color:'#fff' }}>
                  {(firstName||'K')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#fff',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {firstName||'Agent'}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', fontFamily:FB }}>
                    Agency Admin
                  </div>
                </div>
              </div>
              <button onClick={() => signOut().then(() => navigate('/login'))}
                style={{ width:'100%', display:'flex', alignItems:'center',
                  justifyContent:'center', gap:8, padding:'10px',
                  borderRadius:10, border:'1px solid rgba(255,255,255,.1)',
                  background:'transparent', color:'rgba(255,255,255,.45)',
                  fontSize:14, fontWeight:600, cursor:'pointer',
                  fontFamily:FH, WebkitTapHighlightColor:'transparent' }}>
                <LogOut size={14}/> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}