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

// Bottom tab bar — 5 core destinations
const TABS = [
  { to:'/',           icon:LayoutGrid,  label:'Home'    },
  { to:'/clients',    icon:Users,       label:'Clients' },
  { to:'/desk',       icon:Inbox,       label:'Desk'    },
  { to:'/perf',       icon:TrendingUp,  label:'Perf'    },
  { to:'/scout',      icon:Target,      label:'Scout'   },
]

// Full drawer nav
const DRAWER_SECTIONS = [
  { title: 'Workspace', items: [
    { to:'/',                icon:LayoutGrid,    label:'Dashboard'    },
    { to:'/clients',         icon:Users,         label:'Clients'      },
    { to:'/reviews',         icon:Star,          label:'Reviews'      },
    { to:'/proposals',       icon:FileSignature, label:'Proposals'    },
  ]},
  { title: 'Intelligence', items: [
    { to:'/perf',            icon:TrendingUp,    label:'Performance', badge:'AI' },
    { to:'/scout',           icon:Target,        label:'Scout',       badge:'NEW' },
    { to:'/scout/history',   icon:Clock,         label:'Scout History' },
    { to:'/seo',             icon:BarChart2,     label:'SEO Hub'      },
  ]},
  { title: 'Support', items: [
    { to:'/desk',            icon:Inbox,         label:'KotoDesk'     },
    { to:'/desk/knowledge',  icon:Brain,         label:'Q&A Knowledge'},
    { to:'/desk/reports',    icon:BarChart2,     label:'Desk Reports' },
  ]},
  { title: 'Agency', items: [
    { to:'/agency-settings', icon:Settings,      label:'Settings'     },
    { to:'/integrations',    icon:Plug,          label:'Integrations' },
  ]},
]

// Pages that should NOT show the mobile shell (public/auth pages)
const NO_SHELL = ['/login','/welcome','/signup','/onboard','/onboarding',
  '/review/','/r/','/p/','/client-portal','/client-auth','/access/','/privacy']

export default function MobileShell({ children, title, onBack, backLabel, rightAction }) {
  const loc      = useNavigate ? useLocation() : { pathname: '/' }
  const navigate = useNavigate()
  const { firstName } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const drawerRef = useRef(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [loc.pathname])

  // Close on outside tap
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target))
        setDrawerOpen(false)
    }
    document.addEventListener('touchstart', handler)
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousedown', handler)
    }
  }, [drawerOpen])

  if (!isMobile) return children

  // Check if this route should skip the shell
  const path = loc.pathname
  const skipShell = NO_SHELL.some(p => path.startsWith(p))
  if (skipShell) return children

  const activeTab = TABS.findIndex(t =>
    t.to === '/' ? path === '/' : path.startsWith(t.to)
  )

  // Page title fallback
  const pageTitle = title || TABS.find(t =>
    t.to === '/' ? path === '/' : path.startsWith(t.to)
  )?.label || 'Koto'

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'100dvh', overflow:'hidden',
      background:'#f2f2f0', fontFamily:FB,
      position:'relative',
    }}>
      {/* ── Top bar ───────────────────────────────────────────── */}
      <div style={{
        background:BLK, flexShrink:0, zIndex:50,
        paddingTop:'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{
          height:52, display:'flex', alignItems:'center',
          justifyContent:'space-between', padding:'0 4px',
        }}>
          {/* Left */}
          <div style={{ width:64, display:'flex', alignItems:'center' }}>
            {onBack ? (
              <button onClick={onBack}
                style={{ display:'flex', alignItems:'center', gap:2,
                  color:R, background:'none', border:'none', fontSize:17,
                  cursor:'pointer', padding:'8px', WebkitTapHighlightColor:'transparent' }}>
                <ChevronLeft size={28} strokeWidth={2.5} color={R}/>
              </button>
            ) : (
              <button onClick={() => setDrawerOpen(true)}
                style={{ background:'none', border:'none', padding:'10px',
                  cursor:'pointer', WebkitTapHighlightColor:'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Menu size={22} color="rgba(255,255,255,.7)"/>
              </button>
            )}
          </div>

          {/* Center — logo or title */}
          <div style={{ flex:1, textAlign:'center' }}>
            {path === '/' ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <div style={{ width:22, height:22, borderRadius:6, background:R,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Zap size={12} color="#fff" strokeWidth={2.5}/>
                </div>
                <span style={{ fontFamily:FH, fontSize:17, fontWeight:800,
                  color:'#fff', letterSpacing:'-.03em' }}>Koto</span>
              </div>
            ) : (
              <span style={{ fontFamily:FH, fontSize:17, fontWeight:700,
                color:'#fff', letterSpacing:'-.02em' }}>
                {backLabel || pageTitle}
              </span>
            )}
          </div>

          {/* Right */}
          <div style={{ width:64, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
            {rightAction || (
              <div style={{ width:36, height:36, borderRadius:'50%', background:R,
                display:'flex', alignItems:'center', justifyContent:'center',
                marginRight:4, fontFamily:FH, fontSize:14, fontWeight:800, color:'#fff' }}>
                {(firstName||'K')[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div style={{
        flex:1, overflowY:'auto', overflowX:'hidden',
        WebkitOverflowScrolling:'touch',
        paddingBottom:'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Strip the desktop Sidebar from children by CSS */}
        <style>{`
          @media (max-width: 767px) {
            /* Hide desktop sidebar */
            .desktop-sidebar { display: none !important; }
            /* Make page shell fill mobile content area */
            [style*="display:'flex'"][style*="height:'100vh'"],
            [style*='display:"flex"'][style*='height:"100vh"'] {
              height: auto !important;
              min-height: auto !important;
            }
            /* Remove the fixed header area padding */
            .page-header { display: none !important; }
          }
        `}</style>
        {children}
      </div>

      {/* ── Bottom tab bar ─────────────────────────────────────── */}
      <div style={{
        background:BLK, flexShrink:0, zIndex:50,
        borderTop:'1px solid rgba(255,255,255,.08)',
        paddingBottom:'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{
          display:'flex', alignItems:'stretch',
          height:56,
        }}>
          {TABS.map((tab, i) => {
            const Icon  = tab.icon
            const active = i === activeTab
            return (
              <button key={tab.to}
                onClick={() => navigate(tab.to)}
                style={{
                  flex:1, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:4,
                  background:'transparent', border:'none',
                  cursor:'pointer', WebkitTapHighlightColor:'transparent',
                  padding:'6px 0',
                  transition:'opacity .15s',
                }}>
                <div style={{
                  width:32, height:32, borderRadius:10,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: active ? R+'20' : 'transparent',
                  transition:'background .15s',
                }}>
                  <Icon size={20}
                    color={active ? R : 'rgba(255,255,255,.35)'}
                    strokeWidth={active ? 2.5 : 1.8}/>
                </div>
                <span style={{
                  fontFamily:FH, fontSize:10, fontWeight: active ? 700 : 500,
                  color: active ? R : 'rgba(255,255,255,.35)',
                  letterSpacing:'.02em', lineHeight:1,
                }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Drawer overlay ─────────────────────────────────────── */}
      {drawerOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,.6)',
          backdropFilter:'blur(4px)',
          animation:'fadeIn .2s ease',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', top:0, left:0, bottom:0,
            width:'80vw', maxWidth:300,
            background:BLK,
            display:'flex', flexDirection:'column',
            overflowY:'auto',
            paddingTop:'env(safe-area-inset-top, 0px)',
            animation:'slideIn .25s cubic-bezier(.22,1,.36,1)',
          }}>
            {/* Drawer header */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'16px 18px', borderBottom:'1px solid rgba(255,255,255,.07)',
              flexShrink:0,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:R,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Zap size={13} color="#fff" strokeWidth={2.5}/>
                </div>
                <span style={{ fontFamily:FH, fontSize:17, fontWeight:800,
                  color:'#fff', letterSpacing:'-.03em' }}>Koto</span>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                style={{ background:'rgba(255,255,255,.08)', border:'none',
                  borderRadius:8, width:32, height:32, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  WebkitTapHighlightColor:'transparent' }}>
                <X size={16} color="rgba(255,255,255,.6)"/>
              </button>
            </div>

            {/* Nav sections */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px 10px' }}>
              {DRAWER_SECTIONS.map(sec => (
                <div key={sec.title} style={{ marginBottom:4 }}>
                  <div style={{
                    padding:'12px 10px 4px',
                    fontFamily:FH, fontSize:10, fontWeight:700,
                    color:'rgba(255,255,255,.22)',
                    textTransform:'uppercase', letterSpacing:'.1em',
                  }}>{sec.title}</div>
                  {sec.items.map(item => {
                    const Icon = item.icon
                    const active = item.to === '/'
                      ? path === '/'
                      : path.startsWith(item.to)
                    return (
                      <button key={item.to}
                        onClick={() => navigate(item.to)}
                        style={{
                          width:'100%', display:'flex', alignItems:'center', gap:12,
                          padding:'11px 12px', borderRadius:10, border:'none',
                          background: active ? R+'15' : 'transparent',
                          borderLeft:`2.5px solid ${active ? R : 'transparent'}`,
                          cursor:'pointer', WebkitTapHighlightColor:'transparent',
                          marginBottom:1,
                        }}>
                        <Icon size={15}
                          color={active ? R : 'rgba(255,255,255,.4)'}
                          strokeWidth={active ? 2.5 : 1.8}/>
                        <span style={{
                          fontFamily:FH, fontSize:14,
                          fontWeight: active ? 700 : 500,
                          color: active ? '#fff' : 'rgba(255,255,255,.5)',
                          flex:1, textAlign:'left',
                        }}>{item.label}</span>
                        {item.badge && (
                          <span style={{
                            fontFamily:FH, fontSize:9, fontWeight:800,
                            padding:'2px 6px', borderRadius:20,
                            background: item.badge==='AI' ? R : '#5bc6d0',
                            color:'#fff', letterSpacing:'.06em',
                          }}>{item.badge}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Drawer footer */}
            <div style={{
              padding:'12px 12px 16px',
              borderTop:'1px solid rgba(255,255,255,.07)',
              flexShrink:0,
            }}>
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 10px', borderRadius:12,
                background:'rgba(255,255,255,.05)',
                marginBottom:8,
              }}>
                <div style={{
                  width:34, height:34, borderRadius:'50%', background:R,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:FH, fontSize:14, fontWeight:800, color:'#fff', flexShrink:0,
                }}>{(firstName||'K')[0].toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#fff' }}>
                    {firstName || 'Agent'}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', fontFamily:FB }}>Agency Admin</div>
                </div>
              </div>
              <button
                onClick={() => signOut().then(() => navigate('/login'))}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                  gap:8, padding:'11px', borderRadius:10,
                  border:'1px solid rgba(255,255,255,.1)', background:'transparent',
                  color:'rgba(255,255,255,.5)', fontSize:14, fontWeight:600,
                  cursor:'pointer', fontFamily:FH, WebkitTapHighlightColor:'transparent',
                }}>
                <LogOut size={14}/> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { transform:translateX(-100%) } to { transform:translateX(0) } }
      `}</style>
    </div>
  )
}