"use client"
import { useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Users, Plus, Target, Mail, BarChart2, Clock, LogOut, Dumbbell, DollarSign, BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'
import {
  T_FONT, T_BG, T_RED, T_BLUE,
  injectTrainerUICSS,
} from '../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerPortalShell — dedicated sidebar + shell for the trainer product.
// Apple 2026 pass: SF Pro inherit, warm-white canvas, glass-blur dark sidebar.
// ─────────────────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, exact, badge }) {
  const loc = useLocation()
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to)

  return (
    <Link
      to={to}
      className="t-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
        background: active ? 'rgba(255,255,255,.08)' : 'transparent',
        borderLeft: active ? `3px solid ${T_RED}` : '3px solid transparent',
        color: active ? '#fff' : '#9ca3af',
        fontSize: 13, fontWeight: active ? 600 : 500,
        letterSpacing: '-0.005em',
        marginBottom: 2,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} style={{ flexShrink: 0, color: active ? T_RED : '#6b7280' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: T_BLUE, color: '#fff' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export default function TrainerPortalShell({ children }) {
  const navigate = useNavigate()
  const { firstName, fullName, user, agencyName, agency } = useAuth()

  useEffect(() => { injectTrainerUICSS() }, [])

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: T_BG,
      fontFamily: T_FONT,
      color: '#0f1115',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* Dark glass sidebar */}
      <div style={{
        width: 240,
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', flexShrink: 0,
        position: 'sticky', top: 0,
        background: 'rgba(10, 10, 10, 0.82)',
        backdropFilter: 'saturate(1.8) blur(20px)',
        WebkitBackdropFilter: 'saturate(1.8) blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Brand header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: T_RED,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(220,38,38,.3), inset 0 0 0 1px rgba(255,255,255,.08)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>K</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-.018em' }}>Koto Trainer</div>
              <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '-0.003em' }}>{agency?.brand_name || agencyName || 'Training Portal'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Athletes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Athletes
            </div>
            <NavItem to="/trainer" exact icon={Users} label="Dashboard" />
            <NavItem to="/trainer/athletes" icon={Users} label="Athletes" />
            <NavItem to="/trainer/new" icon={Plus} label="Add Athlete" />
          </div>

          {/* Recruiting */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Recruiting
            </div>
            <NavItem to="/trainer/recruiting" icon={Target} label="Programs" badge="549" />
            <NavItem to="/trainer/propath" icon={BarChart2} label="ProPath Score" />
            <NavItem to="/trainer/outreach" icon={Mail} label="Outreach" />
            <NavItem to="/trainer/guide" icon={BookOpen} label="Recruiting Guide" />
            <NavItem to="/trainer/timeline" icon={Clock} label="Timeline" />
          </div>

          {/* Tools */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Tools
            </div>
            <NavItem to="/trainer/scholarships" icon={DollarSign} label="Scholarships" />
            <NavItem to="/trainer/templates" icon={Mail} label="Email Templates" />
            <NavItem to="/trainer/benchmarks" icon={Dumbbell} label="Benchmarks" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
            borderRadius: 10, background: 'rgba(255,255,255,.04)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: T_RED, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)',
            }}>
              {(firstName || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>
                {firstName || user?.email?.split('@')[0] || 'Coach'}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{agencyName || 'Trainer'}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate('/login'))}
              className="t-press"
              style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', borderRadius: 6 }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: T_BG }}>
        {children}
      </main>
    </div>
  )
}
