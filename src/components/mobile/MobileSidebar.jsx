"use client";
"use client";
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, CheckSquare, Calendar, Megaphone, DollarSign, Users, Plug, Shield, Target, X, LogOut, ChevronRight, ListFilter, BookUser, List, Tag, Send, Zap, FileText, TrendingUp, Link2, Puzzle } from 'lucide-react'
import { signOut } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import LucyLogo from '../LucyLogo'

const SECTIONS = [
  { title: null, items: [
    { label: 'Project Hub', icon: LayoutDashboard, path: '/', color: '#ea2729' },
    { label: 'Messages', icon: MessageSquare, path: '/messages', color: '#5856D6' },
    { label: 'Tasks', icon: CheckSquare, path: '/tasks', color: '#FF3B30' },
    { label: 'Calendar', icon: Calendar, path: '/calendar', color: '#007AFF' },
  ]},
  { title: 'Contacts', items: [
    { label: 'All Contacts', icon: BookUser, path: '/marketing/contacts', color: '#0ea5e9' },
    { label: 'Lists', icon: List, path: '/marketing/lists', color: '#22c55e' },
  ]},
  { title: 'E-Marketing', items: [
    { label: 'Overview', icon: Megaphone, path: '/marketing', color: '#FF9500' },
    { label: 'Campaigns', icon: Send, path: '/marketing/campaigns', color: '#f59e0b' },
    { label: 'Automations', icon: Zap, path: '/marketing/automations', color: '#ef4444' },
    { label: 'Templates', icon: FileText, path: '/marketing/templates', color: '#06b6d4' },
  ]},
  { title: 'Intelligence', items: [
    { label: 'SCOUT Search', icon: Target, path: '/scout', color: '#ea2729', badge: 'NEW' },
    { label: 'My Leads', icon: ListFilter, path: '/scout/leads', color: '#ea2729' },
  ]},
  { title: 'Koto SEO', items: [
    { label: 'SEO Hub', icon: TrendingUp, path: '/seo', color: '#10b981' },
    { label: 'URL Audit', icon: Zap, path: '/seo/audit', color: '#f59e0b' },
    { label: 'WP Plugin', icon: Puzzle, path: '/seo/plugin', color: '#8b5cf6' },
    { label: 'Connect Data', icon: Link2, path: '/seo/connect', color: '#3b82f6' },
  ]},
  { title: 'Business', items: [
    { label: 'Revenue', icon: DollarSign, path: '/revenue', color: '#34C759' },
    { label: 'Team', icon: Users, path: '/employees', color: '#007AFF' },
    { label: 'Integrations', icon: Plug, path: '/integrations', color: '#8E8E93' },
    { label: 'Admin', icon: Shield, path: '/admin', color: '#5856D6' },
  ]},
]

export default function MobileSidebar({ isOpen, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleSignOut() { await signOut(); navigate('/login'); onClose() }

  if (!isOpen) return null

  const name = user?.email?.split('@')[0] || 'User'
  const initial = name[0]?.toUpperCase() || 'M'

  return (
    <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{ position: 'relative', width: 300, maxWidth: '85vw', height: '100%', background: '#18181b', overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)', animation: 'slideFromLeft 0.28s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
        {/* Profile */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: 'linear-gradient(135deg,#ea2729,#ff8c42)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{initial}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#f4f4f5', margin: 0, textTransform: 'capitalize' }}>{name}</p>
              <p style={{ fontSize:13, color: '#ea2729', fontWeight: 600, margin: '2px 0 0' }}>Koto</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer' }}><X size={20} color="#71717a" /></button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 0' }}>
          {SECTIONS.map((section, si) => (
            <div key={si}>
              {section.title && <p style={{ fontSize:13, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '16px 20px 6px' }}>{section.title}</p>}
              {section.items.map(item => {
                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
                const I = item.icon
                return (
                  <Link key={item.path} to={item.path} onClick={onClose}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 10px', padding: '10px 10px', borderRadius: 12, background: active ? 'rgba(232,85,26,0.15)' : 'transparent', textDecoration: 'none', minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <I size={17} strokeWidth={1.5} style={{ color: item.color }} />
                    </div>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: active ? 600 : 500, color: active ? '#ea2729' : '#d4d4d8' }}>{item.label}</span>
                    {item.badge && <span style={{ fontSize:13, background: '#ea2729', color: '#fff', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>{item.badge}</span>}
                    {!item.badge && <ChevronRight size={15} color="#52525b" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: 12, borderTop: '0.5px solid rgba(255,255,255,0.1)', marginTop: 'auto', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>
            <LogOut size={17} strokeWidth={1.5} color="#EF4444" />
            <span style={{ fontSize: 15, fontWeight: 500, color: '#EF4444' }}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
