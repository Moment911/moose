"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, ArrowRight } from 'lucide-react'
import { BLK, FH } from '../../lib/theme'

const MUTED = '#6b7280'
const HAIR  = '#e5e7eb'
const W     = '#ffffff'

/* Same nav on every public page — home, about, privacy, terms */
/* mix of dedicated pages (href) and homepage anchors (id) */
const LINKS = [
  { href: '/ai-agents',      label: 'AI Agents' },
  { href: '/chatbots',       label: 'Chatbots' },
  { href: '/custom-systems', label: 'Custom Systems' },
  { href: '/about',          label: 'About' },
  { href: '/contact',        label: 'Contact' },
  // { href: '/koto-ai', label: 'Koto AI' }, // HIDDEN — page still live at /koto-ai
]

export default function PublicNav() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goSection = (id) => (e) => {
    e.preventDefault()
    setMenuOpen(false)
    if (window.location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(`/#${id}`)
      // Next tick: scroll if the hash is present (the homepage's own effect also handles this)
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 120)
    }
  }

  const goHref = (href) => (e) => {
    e.preventDefault()
    setMenuOpen(false)
    navigate(href)
  }

  return (
    <>
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: W, zIndex: 9000,
          display: 'flex', flexDirection: 'column', padding: 24, fontFamily: FH,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 28, cursor: 'pointer' }} onClick={() => { setMenuOpen(false); navigate('/') }} />
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLK }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {LINKS.map(l => (
              <button key={l.label} onClick={l.id ? goSection(l.id) : goHref(l.href)}
                style={{ background: 'none', border: 'none', color: BLK, fontSize: 28, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', cursor: 'pointer', textAlign: 'left' }}>
                {l.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            <button onClick={() => { setMenuOpen(false); navigate('/contact') }}
              style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: BLK, color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>
              Get started
            </button>
          </div>
        </div>
      )}

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000,
        background: scrolled ? 'rgba(255,255,255,.85)' : W,
        backdropFilter: scrolled ? 'saturate(180%) blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(14px)' : 'none',
        borderBottom: scrolled ? `1px solid ${HAIR}` : '1px solid transparent',
        transition: 'all .2s',
        padding: '0 40px', height: 64, fontFamily: FH,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }} className="pn-root">
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, cursor: 'pointer' }} onClick={() => navigate('/')} />

        <div className="pn-center" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {LINKS.map(l => (
            <a key={l.label}
              href={l.id ? `/#${l.id}` : l.href}
              onClick={l.id ? goSection(l.id) : goHref(l.href)}
              style={{
                fontSize: 14, color: MUTED, fontWeight: 600, textDecoration: 'none',
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = BLK}
              onMouseLeave={e => e.currentTarget.style.color = MUTED}
            >{l.label}</a>
          ))}
        </div>

        <div className="pn-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/contact')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: 'pointer',
          }}>
            Get started <ArrowRight size={14} />
          </button>
        </div>

        <button className="pn-hamburger" onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', color: BLK, cursor: 'pointer', display: 'none',
        }}>
          <Menu size={24} />
        </button>
      </nav>

      <style>{`
        @media (max-width: 900px) {
          .pn-root { padding: 0 20px !important; }
          .pn-center, .pn-right { display: none !important; }
          .pn-hamburger { display: block !important; }
        }
      `}</style>
    </>
  )
}
