'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { KCAccess } from '@/lib/kotoclose-auth'

const KC = {
  acc: '#E6007E', accTint: '#FFF0F7', accMid: '#B5005B',
  blue: '#4A4EFF', blueTint: '#EEF0FF', green: '#16a34a', greenTint: '#f0fdf4',
  text: '#111111', secondary: '#555555', tertiary: '#999999',
  border: 'rgba(0,0,0,0.08)', borderMd: 'rgba(0,0,0,0.13)',
  bg: '#F7F7F6', white: '#ffffff',
  fd: "'Proxima Nova', 'Instrument Sans', sans-serif",
  fb: "'Raleway', 'DM Sans', sans-serif",
}

const PAGE_TITLES: Record<string, string> = {
  '/kotoclose/dashboard': 'Live Dashboard', '/kotoclose/calls': 'Call Log',
  '/kotoclose/callbacks': 'Callback Queue', '/kotoclose/voicemail': 'VM Studio',
  '/kotoclose/campaigns': 'Campaigns', '/kotoclose/industry': 'Industry Config',
  '/kotoclose/intelligence': 'Intelligence Engine', '/kotoclose/analytics': 'Performance',
  '/kotoclose/leaderboard': 'Leaderboard',
}

export default function KCShell({ children, access }: { children: React.ReactNode; access: KCAccess }) {
  const pathname = usePathname()
  const router = useRouter()
  const [liveCount, setLiveCount] = useState(0)
  const [clock, setClock] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = () => {
      fetch('/api/kotoclose?action=dashboard_stats').then(r => r.json()).then(d => {
        setLiveCount(d?.live_calls || 0)
      }).catch(() => {})
    }
    fetchStats()
    const iv = setInterval(fetchStats, 15000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')

  function NavItem({ href, label, icon, badge, badgeColor, show = true }: { href: string; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string; show?: boolean }) {
    if (!show) return null
    const active = isActive(href)
    const isHov = hovered === href
    return (
      <div
        onClick={() => router.push(href)}
        onMouseEnter={() => setHovered(href)}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', cursor: 'pointer', marginBottom: 1,
          fontSize: 12.5, fontFamily: KC.fb, transition: 'all 0.12s', borderRadius: active ? '0 6px 6px 0' : '6px',
          background: active ? KC.accTint : isHov ? KC.bg : 'transparent',
          color: active ? KC.acc : isHov ? KC.text : KC.secondary,
          fontWeight: active ? 500 : 400,
          borderLeft: active ? `2px solid ${KC.acc}` : '2px solid transparent',
        }}
      >
        <span style={{ opacity: active ? 1 : 0.6, display: 'flex' }}>{icon}</span>
        <span>{label}</span>
        {badge !== undefined && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '1px 6px',
            background: active ? 'rgba(230,0,126,0.12)' : 'rgba(0,0,0,0.06)', color: active ? KC.acc : badgeColor || KC.tertiary,
          }}>{badge}</span>
        )}
      </div>
    )
  }

  function Section({ label }: { label: string }) {
    return <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase' as const, color: '#999', padding: '10px 8px 4px', fontFamily: KC.fd }}>{label}</div>
  }

  const initials = (access.userEmail || 'U').substring(0, 2).toUpperCase()
  const pageTitle = PAGE_TITLES[pathname || ''] || 'KotoClose'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: KC.bg }}>
      {/* Sidebar */}
      <div style={{ width: 228, background: KC.white, borderRight: `0.5px solid ${KC.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: 16, borderBottom: `0.5px solid ${KC.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white' }} />
              <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: KC.acc }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: KC.fd, color: KC.text }}>KotoClose</span>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>AI Calling Engine</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '0.5px solid rgba(22,163,74,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700, color: '#16a34a', marginTop: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', animation: 'kcpulse 1.5s infinite' }} />
            System Online
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          <Section label="Command" />
          <NavItem href="/kotoclose/dashboard" label="Live Dashboard" badge={liveCount > 0 ? liveCount : undefined} badgeColor="#16a34a" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>} />
          <NavItem href="/kotoclose/calls" label="Call Log" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>} />
          <NavItem href="/kotoclose/callbacks" label="Callbacks" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />

          <Section label="Campaigns" />
          <NavItem href="/kotoclose/campaigns" label="Campaigns" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>} />
          <NavItem href="/kotoclose/voicemail" label="VM Studio" show={access.features.rvm} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>} />
          <NavItem href="/kotoclose/industry" label="Industry Config" show={access.features.brainBuilder} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/></svg>} />

          <Section label="Intelligence" />
          <NavItem href="/kotoclose/intelligence" label="Intelligence" show={access.features.intelligence} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>} />
          <NavItem href="/kotoclose/analytics" label="Performance" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
          <NavItem href="/kotoclose/leaderboard" label="Leaderboard" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />

          {access.isSuperAdmin && (
            <>
              <Section label="Admin" />
              <NavItem href="/platform-admin" label="KotoClose Admin" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: `0.5px solid ${KC.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: KC.fd }}>{initials}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: KC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{access.userEmail}</div>
            <div style={{ fontSize: 10, color: '#999' }}>{access.isSuperAdmin ? 'Super Admin' : 'Agency Admin'}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 48, background: KC.white, borderBottom: `0.5px solid ${KC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: KC.fd, color: KC.text }}>{pageTitle}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>KotoClose / {pageTitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
            <div style={{ display: 'flex', gap: 6, padding: '5px 10px', background: KC.accTint, border: '0.5px solid rgba(230,0,126,0.2)', borderRadius: 6, fontSize: 11, color: KC.acc, fontWeight: 500, alignItems: 'center' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', animation: 'kcpulse 1.5s infinite' }} />
              Active Campaign
            </div>
            <button onClick={() => router.push('/kotoclose/campaigns')} style={{ background: '#111', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              + New Campaign
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>

      <style>{`@keyframes kcpulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes kcspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
