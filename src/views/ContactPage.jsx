"use client"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Loader2, Check, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const R = '#ea2729'
const T = '#5bc6d0'
const BLK = '#0f0f11'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const REVENUE_OPTIONS = [
  'Under $10k/mo',
  '$10k - $25k/mo',
  '$25k - $50k/mo',
  '$50k - $100k/mo',
  '$100k+/mo',
]

export default function ContactPage() {
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', agency: '', website: '', revenue: '', message: '',
  })

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email) {
      toast.error('Name and email are required')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSent(true)
        toast.success('Message sent! We\'ll be in touch.')
      } else {
        toast.error('Failed to send. Try again.')
      }
    } catch {
      toast.error('Network error. Try again.')
    }
    setSending(false)
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 15, fontFamily: FB,
    outline: 'none', transition: 'border .15s', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: '#fff', fontFamily: FB, color: BLK, minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(15,15,17,.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 26 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[{ label: 'Platform', to: '/' }, { label: 'Services', to: '/services' }, { label: 'Contact', to: '/contact' }].map(l => (
              <button key={l.label} onClick={() => navigate(l.to)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, fontFamily: FH }}>
                {l.label}
              </button>
            ))}
            <button onClick={() => navigate('/login')} style={{ background: R, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '8px 20px', borderRadius: 10, fontFamily: FH, marginLeft: 8 }}>
              Log In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: BLK, paddingTop: 120, paddingBottom: 60, textAlign: 'center' }}>
        <h1 style={{ fontFamily: FH, fontSize: 44, fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-.04em' }}>
          Get In Touch
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,.45)', maxWidth: 500, margin: '0 auto' }}>
          Ready to transform your agency? Let's talk about what Koto can do for you.
        </p>
      </section>

      {/* Split: Info + Form */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 60 }}>
        {/* Left — Info */}
        <div>
          <h2 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK, margin: '0 0 24px', letterSpacing: '-.02em' }}>
            Contact Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 40 }}>
            {[
              { icon: Mail, label: 'Email', value: 'adam@hellokoto.com' },
              { icon: Phone, label: 'Phone', value: '(555) 000-KOTO' },
              { icon: MapPin, label: 'Location', value: 'Remote — Everywhere' },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: R + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.icon size={18} color={R} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2, fontFamily: FH }}>{c.label}</div>
                  <div style={{ fontSize: 15, color: BLK, fontWeight: 600 }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: BLK, borderRadius: 16, padding: 24, color: '#fff' }}>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FH, marginBottom: 8 }}>Prefer a demo?</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Book a live walkthrough and we'll show you everything Koto can do for your agency.
            </p>
            <button onClick={() => navigate('/signup')} style={{
              background: R, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', padding: '10px 20px', borderRadius: 8, fontFamily: FH,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Book Demo <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Right — Form */}
        <div>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#16a34a15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Check size={28} color="#16a34a" />
              </div>
              <h3 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>Message Sent!</h3>
              <p style={{ fontSize: 15, color: '#6b7280' }}>We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Email *</label>
                  <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@agency.com" type="email" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Agency Name</label>
                  <input value={form.agency} onChange={e => set('agency', e.target.value)} placeholder="Your agency" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Website</label>
                  <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Monthly Revenue</label>
                <select value={form.revenue} onChange={e => set('revenue', e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select range...</option>
                  {REVENUE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>Message</label>
                <textarea value={form.message} onChange={e => set('message', e.target.value)} placeholder="Tell us about your agency and what you're looking for..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={sending} style={{
                background: R, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer', padding: '14px 32px', borderRadius: 10,
                fontFamily: FH, display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `0 4px 14px ${R}40`, opacity: sending ? 0.7 : 1,
                width: '100%', justifyContent: 'center',
              }}>
                {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                {sending ? 'Sending...' : 'Send Message'}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 20, opacity: 0.5 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>&copy; {new Date().getFullYear()} Koto</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ label: 'Privacy', to: '/privacy' }, { label: 'Terms', to: '/terms' }].map(l => (
              <button key={l.label} onClick={() => navigate(l.to)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 13, cursor: 'pointer', fontFamily: FB }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
