"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Loader2, Check, ArrowRight, Menu, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const BLACK = '#0a0a0a'
const WHITE = '#ffffff'
const GRAY  = '#6b7280'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const CSS = `
  .ct-input { width: 100%; padding: 16px 18px; border-radius: 12px; border: 1.5px solid #e5e7eb; font-size: 15px; font-family: ${FB}; outline: none; transition: border-color .2s, box-shadow .2s; background: #fff; box-sizing: border-box; color: #111; }
  .ct-input:focus { border-color: ${RED}; box-shadow: 0 0 0 3px ${RED}15; }
  .ct-input::placeholder { color: #9ca3af; }
  .ct-label { display: block; font-size: 11px; font-weight: 800; color: #9ca3af; margin-bottom: 8px; font-family: ${FH}; text-transform: uppercase; letter-spacing: .1em; }
  .ct-nav-link { background: none; border: none; color: rgba(255,255,255,.5); font-size: 14px; font-weight: 600; cursor: pointer; padding: 8px 16px; border-radius: 8px; font-family: ${FH}; transition: color .15s; }
  .ct-nav-link:hover { color: #fff; }
  @media (max-width: 768px) {
    .ct-hide-mobile { display: none !important; }
    .ct-show-mobile { display: flex !important; }
    .ct-grid-split { grid-template-columns: 1fr !important; }
    .ct-hero-h1 { font-size: 36px !important; }
    .ct-nav-pad { padding: 0 20px !important; }
  }
`

const REVENUE_OPTIONS = ['Under $10k/mo', '$10k – $25k/mo', '$25k – $50k/mo', '$50k – $100k/mo', '$100k+/mo']

export default function ContactPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', agency: '', website: '', revenue: '', message: '' })

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email) { toast.error('Name and email are required'); return }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setSent(true); toast.success("Message sent! We'll be in touch.") }
      else toast.error('Failed to send. Try again.')
    } catch { toast.error('Network error. Try again.') }
    setSending(false)
  }

  return (
    <div style={{ background: WHITE, fontFamily: FB, color: BLACK, minHeight: '100vh' }}>
      <style>{CSS}</style>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: BLACK, display: 'flex', flexDirection: 'column', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 26 }} />
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: WHITE, cursor: 'pointer' }}><X size={26} /></button>
          </div>
          {['/', '/services', '/contact', '/login'].map(p => (
            <button key={p} onClick={() => { setMenuOpen(false); navigate(p) }} style={{ background: 'none', border: 'none', color: WHITE, fontSize: 22, fontWeight: 700, fontFamily: FH, padding: '16px 0', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {p === '/' ? 'Platform' : p.slice(1).charAt(0).toUpperCase() + p.slice(2)}
            </button>
          ))}
        </div>
      )}

      {/* Nav */}
      <nav className="ct-nav-pad" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000, background: BLACK,
        borderBottom: scrolled ? '1px solid rgba(255,255,255,.1)' : '1px solid transparent',
        transition: 'border-color .3s', padding: '0 48px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 28, cursor: 'pointer' }} onClick={() => navigate('/')} />
        <div className="ct-hide-mobile" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[{ l: 'Platform', t: '/' }, { l: 'Services', t: '/services' }, { l: 'Contact', t: '/contact' }].map(n => (
            <button key={n.l} className="ct-nav-link" onClick={() => navigate(n.t)}>{n.l}</button>
          ))}
        </div>
        <div className="ct-hide-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="ct-nav-link" onClick={() => navigate('/login')} style={{ color: WHITE }}>Login</button>
          <button onClick={() => navigate('/signup')} style={{ background: RED, border: 'none', color: WHITE, fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontFamily: FH }}>Get Demo →</button>
        </div>
        <button className="ct-show-mobile" onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 'none', color: WHITE, cursor: 'pointer', display: 'none' }}>
          <Menu size={26} />
        </button>
      </nav>

      {/* Hero */}
      <section style={{ background: BLACK, paddingTop: 140, paddingBottom: 60, textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: RED, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 28, fontFamily: FH }}>
            ◆ GET IN TOUCH
          </div>
          <h1 className="ct-hero-h1" style={{ fontFamily: FH, fontSize: 56, fontWeight: 800, color: WHITE, margin: '0 0 16px', letterSpacing: '-.04em', lineHeight: 1.05 }}>
            LET'S BUILD YOUR<br />AGENCY'S FUTURE
          </h1>
          <p style={{ fontSize: 17, color: '#999999', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            Ready to transform your agency with AI? Tell us about your goals and we'll show you exactly how Koto can help.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '80px 24px' }}>
        <div className="ct-grid-split" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 60 }}>

          {/* Left: Info */}
          <div>
            <h2 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLACK, margin: '0 0 8px', letterSpacing: '-.02em' }}>
              Contact Information
            </h2>
            <p style={{ fontSize: 14, color: GRAY, marginBottom: 32, lineHeight: 1.6 }}>
              Fill out the form and our team will get back to you within 2 hours.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 40 }}>
              {[
                { icon: Mail, label: 'EMAIL', value: 'adam@hellokoto.com' },
                { icon: Phone, label: 'PHONE', value: '(555) 000-KOTO' },
                { icon: MapPin, label: 'LOCATION', value: 'Remote — Everywhere' },
                { icon: Clock, label: 'RESPONSE TIME', value: 'Under 2 hours' },
              ].map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={18} color={BLACK} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.1em', marginBottom: 3, fontFamily: FH }}>{c.label}</div>
                    <div style={{ fontSize: 15, color: BLACK, fontWeight: 600, fontFamily: FH }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Demo CTA card */}
            <div style={{ background: BLACK, borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: WHITE, marginBottom: 8 }}>Prefer a live demo?</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, margin: '0 0 20px' }}>
                Book a 15-minute walkthrough. We'll show you everything Koto can do — tailored to your agency.
              </p>
              <button onClick={() => navigate('/signup')} style={{
                background: RED, border: 'none', color: WHITE, fontSize: 14, fontWeight: 700,
                padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontFamily: FH,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Book Demo <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            {sent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#16a34a12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Check size={32} color="#16a34a" />
                </div>
                <h3 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLACK, margin: '0 0 8px', letterSpacing: '-.02em' }}>Message Sent!</h3>
                <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.6 }}>We'll get back to you within 2 hours.</p>
                <button onClick={() => navigate('/')} style={{ marginTop: 24, background: BLACK, border: 'none', color: WHITE, fontSize: 14, fontWeight: 700, padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontFamily: FH }}>
                  Back to Home
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: '#f9fafb', borderRadius: 20, padding: 40, border: '1.5px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label className="ct-label">Name *</label>
                    <input className="ct-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="ct-label">Email *</label>
                    <input className="ct-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@agency.com" type="email" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label className="ct-label">Agency Name</label>
                    <input className="ct-input" value={form.agency} onChange={e => set('agency', e.target.value)} placeholder="Your agency" />
                  </div>
                  <div>
                    <label className="ct-label">Website</label>
                    <input className="ct-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="ct-label">Monthly Revenue</label>
                  <select className="ct-input" value={form.revenue} onChange={e => set('revenue', e.target.value)} style={{ cursor: 'pointer', appearance: 'none' }}>
                    <option value="">Select range...</option>
                    {REVENUE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label className="ct-label">Message</label>
                  <textarea className="ct-input" value={form.message} onChange={e => set('message', e.target.value)} placeholder="Tell us about your agency and what you're looking for..." rows={5} style={{ resize: 'vertical' }} />
                </div>
                <button type="submit" disabled={sending} style={{
                  width: '100%', background: RED, border: 'none', color: WHITE, fontSize: 16, fontWeight: 700,
                  padding: '16px 32px', borderRadius: 12, cursor: sending ? 'wait' : 'pointer',
                  fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 6px 24px ${RED}40`, opacity: sending ? 0.7 : 1,
                  transition: 'opacity .2s, transform .2s',
                }}>
                  {sending ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>
                  We respect your privacy. No spam, ever.
                </p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#050505', padding: '48px 24px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 20, opacity: 0.4 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>© {new Date().getFullYear()} Koto. All rights reserved.</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[{ l: 'Privacy', t: '/privacy' }, { l: 'Terms', t: '/terms' }, { l: 'Status', t: '/status' }].map(lnk => (
              <button key={lnk.l} onClick={() => navigate(lnk.t)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', fontSize: 13, cursor: 'pointer', fontFamily: FB, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.6)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.25)'}>
                {lnk.l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
