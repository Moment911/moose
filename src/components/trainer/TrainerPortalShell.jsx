"use client"
import { useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Users, Plus, Target, Mail, BarChart2, Clock, LogOut, Dumbbell, DollarSign, BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'
import {
  T_FONT, T_BG, T_INK, T_INK_DIM, T_INK_FADED, T_BRD, T_SURFACE, T_BLUE, T_ACCENT,
  T_SHADOW_SM, injectTrainerUICSS,
} from '../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerPortalShell — Cal-AI aesthetic: light sidebar, white canvas.
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
        padding: '8px 12px', borderRadius: 10, textDecoration: 'none',
        background: active ? T_SURFACE : 'transparent',
        color: active ? T_INK : T_INK_DIM,
        fontSize: 14, fontWeight: active ? 600 : 500,
        letterSpacing: '0px',
        marginBottom: 2,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T_SURFACE }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={16} style={{ flexShrink: 0, color: active ? T_INK : T_INK_FADED }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: T_SURFACE, color: T_INK_DIM, border: `1px solid ${T_BRD}` }}>
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
      color: T_INK,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* Light sidebar */}
      <div style={{
        width: 240,
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', flexShrink: 0,
        position: 'sticky', top: 0,
        background: T_BG,
        borderRight: `1px solid ${T_BRD}`,
      }}>
        {/* Brand header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${T_BRD}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: T_INK,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>K</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T_INK, letterSpacing: '-0.02em' }}>Koto Trainer</div>
              <div style={{ fontSize: 12, color: T_INK_DIM }}>{agency?.brand_name || agencyName || 'Training Portal'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T_INK_FADED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 12px 6px' }}>
              Athletes
            </div>
            <NavItem to="/trainer" exact icon={Users} label="Dashboard" />
            <NavItem to="/trainer/athletes" icon={Users} label="Athletes" />
            <NavItem to="/trainer/new" icon={Plus} label="Add Athlete" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T_INK_FADED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 12px 6px' }}>
              Recruiting
            </div>
            <NavItem to="/trainer/recruiting" icon={Target} label="Programs" badge="549" />
            <NavItem to="/trainer/propath" icon={BarChart2} label="ProPath Score" />
            <NavItem to="/trainer/outreach" icon={Mail} label="Outreach" />
            <NavItem to="/trainer/guide" icon={BookOpen} label="Recruiting Guide" />
            <NavItem to="/trainer/timeline" icon={Clock} label="Timeline" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T_INK_FADED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 12px 6px' }}>
              Tools
            </div>
            <NavItem to="/trainer/scholarships" icon={DollarSign} label="Scholarships" />
            <NavItem to="/trainer/templates" icon={Mail} label="Email Templates" />
            <NavItem to="/trainer/benchmarks" icon={Dumbbell} label="Benchmarks" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${T_BRD}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px',
            borderRadius: 10, background: T_SURFACE,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: T_INK, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
            }}>
              {(firstName || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T_INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firstName || user?.email?.split('@')[0] || 'Coach'}
              </div>
              <div style={{ fontSize: 11, color: T_INK_DIM }}>{agencyName || 'Trainer'}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate('/login'))}
              className="t-press"
              style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', color: T_INK_FADED, borderRadius: 6 }}
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
