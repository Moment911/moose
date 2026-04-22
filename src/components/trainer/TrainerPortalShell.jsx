"use client"
import { useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Users, Plus, Target, Mail, BarChart2, Clock, LogOut, Dumbbell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerPortalShell — dedicated sidebar + shell for the trainer product.
// Color scheme: black/white/grey base + red (#dc2626) + blue (#2563eb) accents.
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#dc2626'
const BLUE = '#2563eb'

function NavItem({ to, icon: Icon, label, exact, badge }) {
  const loc = useLocation()
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to)

  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
      background: active ? 'rgba(255,255,255,.08)' : 'transparent',
      borderLeft: active ? `3px solid ${RED}` : '3px solid transparent',
      color: active ? '#fff' : '#9ca3af',
      fontSize: 13, fontWeight: active ? 700 : 500,
      transition: 'all .12s ease',
      marginBottom: 2,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} style={{ flexShrink: 0, color: active ? RED : '#6b7280' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: BLUE, color: '#fff' }}>
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Dark sidebar */}
      <div style={{
        width: 240, background: '#0a0a0a', display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Brand header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: RED,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(220,38,38,.3)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>K</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-.3px' }}>Koto Trainer</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{agency?.brand_name || agencyName || 'Training Portal'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Athletes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Athletes
            </div>
            <NavItem to="/trainer" exact icon={Users} label="Dashboard" />
            <NavItem to="/trainer/new" icon={Plus} label="Add Athlete" />
          </div>

          {/* Recruiting */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Recruiting
            </div>
            <NavItem to="/trainer/recruiting" icon={Target} label="Programs" badge="549" />
            <NavItem to="/trainer/propath" icon={BarChart2} label="ProPath Score" />
            <NavItem to="/trainer/outreach" icon={Mail} label="Outreach" />
            <NavItem to="/trainer/timeline" icon={Clock} label="Timeline" />
          </div>

          {/* Tools */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 12px 6px' }}>
              Tools
            </div>
            <NavItem to="/trainer/templates" icon={Mail} label="Email Templates" />
            <NavItem to="/trainer/benchmarks" icon={Dumbbell} label="Benchmarks" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1f1f1f', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
            borderRadius: 10, background: 'rgba(255,255,255,.04)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: RED, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
            }}>
              {(firstName || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firstName || user?.email?.split('@')[0] || 'Coach'}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{agencyName || 'Trainer'}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate('/login'))}
              style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', borderRadius: 6 }}
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
