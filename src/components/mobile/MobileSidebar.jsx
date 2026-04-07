"use client"
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Star, Target, TrendingUp, Inbox, Brain,
  FileSignature, Clock, BarChart2, Settings, Plug, Shield, Globe,
  Sparkles, Zap, Bug, Activity, ChevronRight, LogOut, X, DollarSign
} from 'lucide-react'
import { signOut } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const R  = '#ea2729'
const T  = '#5bc6d0'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const SECTIONS = [
  { title: 'Workspace', items: [
    { label: 'Dashboard',    icon: LayoutDashboard, path: '/' },
    { label: 'Clients',      icon: Users,           path: '/clients' },
    { label: 'Reviews',      icon: Star,            path: '/reviews' },
    { label: 'Proposals',    icon: FileSignature,   path: '/proposals' },
    { label: 'Tasks',        icon: Clock,           path: '/tasks' },
  ]},
  { title: 'SEO & Content', items: [
    { label: 'SEO Hub',         icon: BarChart2,   path: '/seo' },
    { label: 'Page Builder',    icon: Sparkles,    path: '/page-builder', badge: 'AI' },
    { label: 'WordPress Sites', icon: Globe,       path: '/wordpress' },
  ]},
  { title: 'Intelligence', items: [
    { label: 'Scout',       icon: Target,     path: '/scout',  badge: 'AI' },
    { label: 'Performance', icon: TrendingUp, path: '/perf',   badge: 'AI' },
  ]},
  { title: 'Support', items: [
    { label: 'KotoDesk',       icon: Inbox, path: '/desk' },
    { label: 'Knowledge Base', icon: Brain, path: '/desk/knowledge' },
  ]},
  { title: 'Agency', items: [
    { label: 'Agency Settings', icon: Settings,    path: '/agency-settings' },
    { label: 'Billing',         icon: DollarSign,  path: '/billing' },
    { label: 'Integrations',    icon: Plug,        path: '/integrations' },
    { label: 'Debug Console',   icon: Bug,         path: '/debug' },
    { label: 'System Status',   icon: Activity,    path: '/status', external: true },
    { label: 'Master Admin',    icon: Shield,      path: '/master-admin' },
  ]},
]

export default function MobileSidebar({ isOpen, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, firstName } = useAuth()

  async function handleSignOut() { await signOut(); navigate('/login'); onClose() }

  if (!isOpen) return null

  const name = firstName || user?.email?.split('@')[0] || 'User'
  const initial = name[0]?.toUpperCase() || 'K'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: 'kotoFade .2s ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: '80vw', maxWidth: 300,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        animation: 'kotoSlide .25s cubic-bezier(.22,1,.36,1)',
        boxShadow: '8px 0 40px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: R,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Koto</span>
          </div>
          <button onClick={onClose} style={{
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
          {SECTIONS.map(sec => (
            <div key={sec.title} style={{ marginBottom: 4 }}>
              <div style={{
                padding: '12px 10px 4px', fontFamily: FH, fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.12em',
              }}>{sec.title}</div>
              {sec.items.map(item => {
                const Icon = item.icon
                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
                const Component = item.external ? 'a' : Link
                const linkProps = item.external
                  ? { href: item.path, target: '_blank', rel: 'noopener noreferrer', onClick: onClose }
                  : { to: item.path, onClick: onClose }
                return (
                  <Component key={item.path} {...linkProps} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 10px', borderRadius: 10, border: 'none',
                    background: active ? R + '18' : 'transparent',
                    borderLeft: `2.5px solid ${active ? R : 'transparent'}`,
                    cursor: 'pointer', marginBottom: 1, minHeight: 44,
                    textDecoration: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background .15s ease',
                  }}>
                    <Icon size={16} color={active ? R : 'rgba(255,255,255,.5)'} strokeWidth={active ? 2.5 : 1.8} />
                    <span style={{
                      fontFamily: FH, fontSize: 14, fontWeight: active ? 700 : 500,
                      flex: 1, color: active ? R : 'rgba(255,255,255,.65)',
                    }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontFamily: FH, fontSize: 9, fontWeight: 800,
                        padding: '2px 6px', borderRadius: 20,
                        background: item.badge === 'AI' ? R : T, color: '#fff',
                        letterSpacing: '.06em',
                      }}>{item.badge}</span>
                    )}
                    {item.external && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>↗</span>}
                  </Component>
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
            }}>{initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FH, fontSize: 13, fontWeight: 700, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize',
              }}>{name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: FB }}>Agency Admin</div>
            </div>
          </div>
          <button onClick={handleSignOut} style={{
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

      <style>{`
        @keyframes kotoFade { from { opacity:0 } to { opacity:1 } }
        @keyframes kotoSlide { from { transform:translateX(-100%) } to { transform:translateX(0) } }
      `}</style>
    </div>
  )
}
