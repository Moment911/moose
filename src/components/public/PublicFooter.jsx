"use client"
import { useNavigate } from 'react-router-dom'
import { R, T, BLK, GRN, FH, FB } from '../../lib/theme'
import { CONTACT_CITY, CONTACT_EMAIL_HREF } from '../../lib/contact'

const MUTED = '#6b7280'
const FAINT = '#9ca3af'
const HAIR  = '#e5e7eb'
const W     = '#ffffff'

/* Footer columns match the top nav structure so visitors see a consistent menu */
const COLUMNS = [
  { title: 'Platform', links: [
    { label: 'Overview', href: '/#platform' },
    { label: 'KotoIQ', href: '/#kotoiq' },
    { label: 'AI Agents', href: '/#agents' },
    { label: 'Custom AI', href: '/#custom' },
    { label: 'Pricing', href: '/#pricing' },
  ] },
  { title: 'Company', links: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Email us', href: CONTACT_EMAIL_HREF },
    { label: 'Status', href: '/status' },
  ] },
  { title: 'Legal', links: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/privacy#cookies' },
    { label: 'CCPA', href: '/privacy#california' },
  ] },
]

export default function PublicFooter() {
  const navigate = useNavigate()

  const go = (href) => (e) => {
    // External mailto / hash-on-other-page — let default navigation handle
    if (href.startsWith('mailto:')) return
    if (href.startsWith('/#') && window.location.pathname !== '/') return // will navigate + scroll
    // Same-page hash on the homepage — use smooth scroll
    if (href.startsWith('/#') && window.location.pathname === '/') {
      e.preventDefault()
      const id = href.slice(2)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    // Regular route
    e.preventDefault()
    navigate(href)
  }

  return (
    <footer id="contact" style={{
      background: W, borderTop: `1px solid ${HAIR}`, padding: '64px 40px 32px',
      fontFamily: FH,
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="pf-grid" style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48,
        }}>
          {/* Brand column */}
          <div>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, marginBottom: 14, cursor: 'pointer' }}
              onClick={() => navigate('/')} />
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, maxWidth: 280, fontFamily: FB }}>
              The AI operating system for modern marketing agencies. Built by operators. Deployed every week.
            </p>
            <div style={{
              marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: MUTED,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRN }} />
              <span>Based in {CONTACT_CITY}</span>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.title}>
              <div style={{
                fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                color: BLK, marginBottom: 14,
              }}>
                {col.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <a key={l.label} href={l.href} onClick={go(l.href)}
                    style={{
                      fontSize: 14, color: MUTED, textDecoration: 'none',
                      transition: 'color .15s', fontFamily: FB, cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = BLK}
                    onMouseLeave={e => e.currentTarget.style.color = MUTED}
                  >{l.label}</a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: `1px solid ${HAIR}`, paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ fontSize: 13, color: FAINT, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontFamily: FB }}>
            <span>© 2026 Koto Technologies, Inc.</span>
            <a href="/privacy" style={{ color: FAINT, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = BLK}
              onMouseLeave={e => e.currentTarget.style.color = FAINT}>Privacy</a>
            <a href="/terms" style={{ color: FAINT, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = BLK}
              onMouseLeave={e => e.currentTarget.style.color = FAINT}>Terms</a>
            <a href="/about" style={{ color: FAINT, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = BLK}
              onMouseLeave={e => e.currentTarget.style.color = FAINT}>About</a>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            <span style={{ fontSize: 13, color: FAINT, fontFamily: FB }}>All systems operational</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .pf-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </footer>
  )
}
