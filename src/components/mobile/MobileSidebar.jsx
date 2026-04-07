"use client"
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Star, Target, TrendingUp, Inbox, Brain,
  FileSignature, Clock, BarChart2, HelpCircle, Settings, Plug, Shield, Globe,
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
    { label: 'Knowledge Base', icon: Brain,      path: '/desk/knowledge' },
    { label: 'Help Center',   icon: HelpCircle, path: '/help' },
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

      {/* Full-screen white tile overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        animation: 'kotoFade .2s ease',
      }}>
        {/* Dark header */}
        <div style={{
          background: '#0a0a0a', flexShrink: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}>
          <div style={{
            height: 52, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: R, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={14} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Koto</span>
            </div>
            <button onClick={onClose} style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,.1)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* White tile nav */}
        <div style={{ flex: 1, background: '#ffffff', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px' }}>
          {SECTIONS.map((sec, si) => (
            <div key={sec.title}>
              {si > 0 && <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0 12px' }} />}
              <div style={{
                fontFamily: FH, fontSize: 11, fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 4px 10px',
              }}>{sec.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
                {sec.items.map(item => {
                  const Icon = item.icon
                  const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
                  const handleClick = () => {
                    if (item.external) { window.open(item.path, '_blank') } else { navigate(item.path) }
                    onClose()
                  }
                  return (
                    <button key={item.path} onClick={handleClick} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '14px 8px', borderRadius: 14, border: 'none',
                      background: active ? R : '#f2f2f0',
                      cursor: 'pointer', minHeight: 80,
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all .2s ease', position: 'relative',
                    }}>
                      <Icon size={20} color={active ? '#fff' : '#0a0a0a'} strokeWidth={1.8} />
                      <span style={{
                        fontFamily: FH, fontSize: 11, fontWeight: 600,
                        color: active ? '#fff' : '#0a0a0a',
                        textAlign: 'center', lineHeight: 1.2,
                      }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6,
                          fontFamily: FH, fontSize: 8, fontWeight: 800,
                          padding: '1px 5px', borderRadius: 10,
                          background: active ? 'rgba(255,255,255,.3)' : R, color: '#fff',
                        }}>{item.badge}</span>
                      )}
                      {item.external && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: active ? 'rgba(255,255,255,.5)' : '#9ca3af' }}>↗</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* White footer */}
        <div style={{
          background: '#ffffff', flexShrink: 0, borderTop: '1px solid #e5e7eb',
          padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: R,
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FH, fontSize: 15, fontWeight: 800, color: '#fff',
            }}>{initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FH, fontSize: 14, fontWeight: 700, color: '#0a0a0a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize',
              }}>{name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>Agency Admin</div>
            </div>
          </div>
          <button onClick={handleSignOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '12px', borderRadius: 10,
            border: 'none', background: R,
            color: '#fff', fontSize: 14, fontWeight: 700,
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
