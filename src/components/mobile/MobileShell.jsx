"use client"
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart2, Brain, ChevronRight, Clock, FileSignature, Globe, Inbox,
  LayoutGrid, LogOut, Menu, Plug, Settings, Sparkles, Star, Target,
  TrendingUp, Users, X, Zap, Bug, Activity, DollarSign, Shield
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'

const R   = '#ea2729'
const T   = '#5bc6d0'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const TABS = [
  { to: '/',        icon: LayoutGrid, label: 'Home'    },
  { to: '/clients', icon: Users,      label: 'Clients' },
  { to: '/reviews', icon: Star,       label: 'Reviews' },
  { to: '/seo',     icon: BarChart2,  label: 'SEO'     },
  { to: '/scout',   icon: Target,     label: 'Scout'   },
]

const DRAWER_SECTIONS = [
  { title: 'Workspace', items: [
    { to: '/',              icon: LayoutGrid,    label: 'Dashboard'     },
    { to: '/clients',       icon: Users,         label: 'Clients'       },
    { to: '/reviews',       icon: Star,          label: 'Reviews'       },
    { to: '/proposals',     icon: FileSignature, label: 'Proposals'     },
    { to: '/tasks',         icon: Clock,         label: 'Tasks'         },
  ]},
  { title: 'SEO & Content', items: [
    { to: '/seo',              icon: BarChart2,  label: 'SEO Hub'          },
    { to: '/page-builder',     icon: Sparkles,   label: 'Page Builder', badge: 'AI' },
    { to: '/wordpress',        icon: Globe,      label: 'WordPress Sites'  },
    { to: '/seo/local-rank',   icon: Target,     label: 'Local Rank'       },
    { to: '/seo/monthly-report', icon: FileSignature, label: 'Monthly Report' },
  ]},
  { title: 'Intelligence', items: [
    { to: '/scout',          icon: Target,     label: 'Scout',       badge: 'AI' },
    { to: '/scout/history',  icon: Clock,      label: 'Scout History'  },
    { to: '/perf',           icon: TrendingUp, label: 'Performance', badge: 'AI' },
    { to: '/agent',          icon: Brain,      label: 'AI CMO',      badge: 'AI' },
  ]},
  { title: 'Support', items: [
    { to: '/desk',            icon: Inbox,  label: 'KotoDesk'       },
    { to: '/desk/knowledge',  icon: Brain,  label: 'Knowledge Base' },
  ]},
  { title: 'Agency', items: [
    { to: '/agency-settings', icon: Settings,   label: 'Settings'      },
    { to: '/billing',         icon: DollarSign,  label: 'Billing'       },
    { to: '/integrations',    icon: Plug,        label: 'Integrations'  },
    { to: '/debug',           icon: Bug,         label: 'Debug Console' },
    { to: '/master-admin',    icon: Shield,      label: 'Master Admin'  },
  ]},
]

const NO_SHELL = [
  '/login', '/welcome', '/signup', '/onboard', '/onboarding',
  '/review/', '/r/', '/p/', '/client-portal', '/client-auth',
  '/access/', '/privacy', '/esign', '/terms', '/status',
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

  // DOM patch for desktop layouts on mobile
  useEffect(() => {
    if (!isMobile) return
    const patch = () => {
      document.querySelectorAll('.page-shell').forEach(el => {
        el.style.cssText += ';height:auto!important;min-height:auto!important;overflow:visible!important;display:block!important;'
      })
      document.querySelectorAll('.desktop-sidebar').forEach(el => {
        el.style.display = 'none'
      })
      document.querySelectorAll('.page-shell > div:not(.desktop-sidebar), .page-shell > main').forEach(el => {
        el.style.cssText += ';width:100%!important;height:auto!important;min-height:auto!important;overflow:visible!important;'
      })
      document.querySelectorAll('.reviews-client-col').forEach(el => {
        el.style.display = 'none'
      })
    }
    patch()
    const t = setTimeout(patch, 150)
    return () => clearTimeout(t)
  }, [isMobile, path])

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
    if (path.startsWith('/proposals'))       return 'Proposals'
    if (path.startsWith('/integrations'))    return 'Integrations'
    if (path.startsWith('/desk/knowledge'))  return 'Q&A Knowledge'
    if (path.startsWith('/desk/reports'))    return 'Desk Reports'
    if (path.startsWith('/desk/ticket'))     return 'Ticket'
    if (path.startsWith('/desk'))            return 'KotoDesk'
    if (path.startsWith('/page-builder'))    return 'Page Builder'
    if (path.startsWith('/wordpress'))       return 'WordPress'
    if (path.startsWith('/perf'))            return 'Performance'
    if (path.startsWith('/debug'))           return 'Debug Console'
    if (path.startsWith('/billing'))         return 'Billing'
    return 'Koto'
  })()

  return (
    <>
      <style>{`
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
        .desktop-sidebar { display: none !important; }
        .page-shell {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        .page-shell > div:not(.desktop-sidebar) {
          width: 100% !important;
          max-width: 100vw !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        .flex.h-screen { height: auto !important; overflow: visible !important; }
        .flex-1.flex.flex-col.overflow-hidden { overflow: visible !important; height: auto !important; }
        [style*="overflow:'hidden'"],
        [style*='overflow:"hidden"'],
        [style*="overflow: hidden"] { overflow: visible !important; }
        [style*="display:'flex'"][style*="height:'100vh'"],
        [style*='display:"flex"'][style*='height:"100vh"'],
        [style*="display: flex"][style*="height: 100vh"] {
          flex-direction: column !important;
          height: auto !important;
          min-height: auto !important;
        }
        [style*="width:220px"],[style*="width: 220px"],
        [style*="width:240px"],[style*="width: 240px"],
        [style*="width:252px"],[style*="width: 252px"] { display: none !important; }
        [style*="gridTemplateColumns:'1fr 300px'"],
        [style*="gridTemplateColumns:'1fr 320px'"],
        [style*="gridTemplateColumns:'400px 1fr'"],
        [style*="gridTemplateColumns:'220px 1fr'"] { grid-template-columns: 1fr !important; }
        [style*="gridTemplateColumns:'repeat(4"] { grid-template-columns: 1fr 1fr !important; }
        [style*="gridTemplateColumns:'repeat(3"] { grid-template-columns: 1fr 1fr !important; }
        input, textarea, select { font-size: 16px !important; }
        * { max-width: 100vw; box-sizing: border-box; }
        table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @keyframes kotoFade { from { opacity:0 } to { opacity:1 } }
        @keyframes kotoSlide { from { transform:translateX(-100%) } to { transform:translateX(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      <div id="koto-mobile-shell">

        {/* ── Top bar ── */}
        <div style={{
          background: '#0a0a0a', flexShrink: 0,
          paddingTop: 'env(safe-area-inset-top,0px)',
          zIndex: 100, position: 'relative',
        }}>
          <div style={{
            height: 52, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 6px',
          }}>
            {/* Hamburger */}
            <button onClick={() => setDrawerOpen(true)} style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'none', border: 'none',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', borderRadius: 10,
            }}>
              <Menu size={22} color="rgba(255,255,255,.7)" strokeWidth={1.8} />
            </button>

            {/* Center */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {path === '/' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, background: R,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Zap size={13} color="#fff" strokeWidth={2.5} />
                  </div>
                  <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Koto</span>
                </div>
              ) : (
                <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{pageLabel}</span>
              )}
            </div>

            {/* Avatar */}
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: R,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FH, fontSize: 14, fontWeight: 800, color: '#fff',
              }}>
                {(firstName || 'K')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div id="koto-mobile-content" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </div>

        {/* ── Bottom tab bar ── */}
        <div style={{
          background: '#0a0a0a',
          flexShrink: 0, zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom,0px)',
        }}>
          <div style={{ display: 'flex', height: 56 }}>
            {TABS.map((tab, i) => {
              const Icon   = tab.icon
              const active = i === activeIdx
              return (
                <button key={tab.to} onClick={() => navigate(tab.to)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  padding: '6px 0', minHeight: 44,
                  transition: 'all .15s ease',
                }}>
                  <div style={{
                    width: 36, height: 28, borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? R + '20' : 'transparent',
                    transition: 'background .2s ease',
                  }}>
                    <Icon size={20}
                      color={active ? R : 'rgba(255,255,255,.35)'}
                      strokeWidth={active ? 2.5 : 1.7}
                    />
                  </div>
                  <span style={{
                    fontFamily: FH, fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? R : 'rgba(255,255,255,.35)',
                    letterSpacing: '.01em', lineHeight: 1,
                    transition: 'color .15s ease',
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
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.65)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          animation: 'kotoFade .2s ease',
        }}>
          <div ref={drawerRef} style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: '80vw', maxWidth: 300,
            background: '#0a0a0a',
            display: 'flex', flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top,0px)',
            paddingBottom: 'env(safe-area-inset-bottom,0px)',
            animation: 'kotoSlide .25s cubic-bezier(.22,1,.36,1)',
            boxShadow: '8px 0 40px rgba(0,0,0,.5)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: R,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Zap size={14} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Koto</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'rgba(255,255,255,.06)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <X size={15} color="rgba(255,255,255,.4)" />
              </button>
            </div>

            {/* Nav */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', WebkitOverflowScrolling: 'touch' }}>
              {DRAWER_SECTIONS.map(sec => (
                <div key={sec.title} style={{ marginBottom: 4 }}>
                  <div style={{
                    padding: '12px 10px 4px', fontFamily: FH, fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.12em',
                  }}>{sec.title}</div>
                  {sec.items.map(item => {
                    const Icon = item.icon
                    const active = item.to === '/' ? path === '/' : path.startsWith(item.to)
                    return (
                      <button key={item.to} onClick={() => { navigate(item.to); setDrawerOpen(false) }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                        padding: '11px 10px', borderRadius: 10, border: 'none',
                        background: active ? R + '18' : 'transparent',
                        borderLeft: `2.5px solid ${active ? R : 'transparent'}`,
                        cursor: 'pointer', marginBottom: 1, minHeight: 44,
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'background .15s ease',
                      }}>
                        <Icon size={16} color={active ? R : 'rgba(255,255,255,.5)'} strokeWidth={active ? 2.5 : 1.8} />
                        <span style={{
                          fontFamily: FH, fontSize: 14, fontWeight: active ? 700 : 500,
                          flex: 1, textAlign: 'left',
                          color: active ? R : 'rgba(255,255,255,.65)',
                        }}>{item.label}</span>
                        {item.badge && (
                          <span style={{
                            fontFamily: FH, fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 20,
                            background: item.badge === 'AI' ? R : T, color: '#fff',
                            letterSpacing: '.06em',
                          }}>{item.badge}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px', borderRadius: 12,
                background: 'rgba(255,255,255,.04)', marginBottom: 8,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: R,
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FH, fontSize: 14, fontWeight: 800, color: '#fff',
                }}>
                  {(firstName || 'K')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: FH, fontSize: 13, fontWeight: 700, color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize',
                  }}>{firstName || 'Agent'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: FB }}>Agency Admin</div>
                </div>
              </div>
              <button onClick={() => signOut().then(() => navigate('/login'))} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '11px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,.08)', background: 'transparent',
                color: 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FH, minHeight: 44,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
