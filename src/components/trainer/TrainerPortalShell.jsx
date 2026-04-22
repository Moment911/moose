"use client"
import { useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Users, Plus, Target, Mail, BarChart2, Clock, Settings, LogOut, ChevronDown, Search, Dumbbell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'
import { R, T, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerPortalShell — dedicated sidebar + shell for the trainer product.
//
// Replaces the main Koto sidebar on all /trainer/* routes.  Shows only
// trainer-relevant navigation.  Designed to be lifted to its own domain later.
// ─────────────────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, exact, badge }) {
  const loc = useLocation()
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to)

  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
      background: active ? R + '10' : 'transparent',
      borderLeft: active ? `3px solid ${R}` : '3px solid transparent',
      color: active ? R : '#374151',
      fontSize: 13, fontWeight: active ? 700 : 500,
      transition: 'all .12s ease',
      marginBottom: 2,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} style={{ flexShrink: 0, color: active ? R : '#6b7280' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: T, color: '#fff' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export default function TrainerPortalShell({ children }) {
  const navigate = useNavigate()
  const { firstName, fullName, user, agencyName, agency } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      {/* Sidebar */}
      <div style={{
        width: 240, background: '#fff', display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', flexShrink: 0,
        borderRight: '1px solid #e5e7eb',
      }}>
        {/* Brand header */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${BLK} 0%, #1e293b 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.12)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: T }}>K</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>Koto Trainer</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{agency?.brand_name || agencyName || 'Training Portal'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Athletes */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Athletes
            </div>
            <NavItem to="/trainer" exact icon={Users} label="All Trainees" />
            <NavItem to="/trainer/new" icon={Plus} label="Add Trainee" />
          </div>

          {/* Recruiting */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Recruiting
            </div>
            <NavItem to="/trainer/recruiting" icon={Target} label="Programs" badge="549" />
            <NavItem to="/trainer/propath" icon={BarChart2} label="ProPath Score" />
            <NavItem to="/trainer/outreach" icon={Mail} label="Outreach" />
            <NavItem to="/trainer/timeline" icon={Clock} label="Recruiting Timeline" />
          </div>

          {/* Tools */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Tools
            </div>
            <NavItem to="/trainer/templates" icon={Mail} label="Email Templates" />
            <NavItem to="/trainer/benchmarks" icon={Dumbbell} label="Benchmarks" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
            borderRadius: 10, background: 'rgba(0,0,0,.03)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: R, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
            }}>
              {(firstName || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firstName || user?.email?.split('@')[0] || 'Coach'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{agencyName || 'Trainer'}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate('/login'))}
              style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 6 }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
