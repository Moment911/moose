"use client"

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock, ArrowRight } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../lib/theme'
import {
  CONTACT_PHONE, CONTACT_PHONE_HREF,
  CONTACT_EMAIL, CONTACT_ADDRESS, CONTACT_HOURS,
} from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import { usePageMeta } from '../lib/usePageMeta'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

/* LeadConnector (GoHighLevel) form — matches the embed Adam provided */
const FORM_SRC     = 'https://api.leadconnectorhq.com/widget/form/a4qjojaBe4g7HaWPIoW9'
const FORM_ID      = 'a4qjojaBe4g7HaWPIoW9'
const FORM_EMBED_JS = 'https://link.msgsndr.com/js/form_embed.js'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes orbPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: .9; } 50% { transform: translate(40px,-20px) scale(1.08); opacity: 1; } }
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 14px 24px; font-size: 15px; text-decoration: none; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  @media (max-width: 900px) {
    .c-hero-h1 { font-size: 48px !important; }
    .c-phone { font-size: 44px !important; }
    .c-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .c-pad { padding: 72px 24px !important; }
  }
`

export default function ContactPage() {
  usePageMeta({
    title: 'Contact Koto — book a 20-min build session | Koto',
    description: 'Tell us what you want to automate. Adam reads every message and replies within one business hour. Book 20 min to scope your build live.',
  })
  const navigate = useNavigate()

  // Load LeadConnector embed script so the form auto-resizes and styles correctly
  useEffect(() => {
    if (document.querySelector(`script[src="${FORM_EMBED_JS}"]`)) return
    const s = document.createElement('script')
    s.src = FORM_EMBED_JS
    s.async = true
    document.body.appendChild(s)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="c-pad" style={{ padding: '120px 40px 48px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: R + '22', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: T + '22', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            We reply within one business hour
          </div>
          <h1 className="c-hero-h1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 900, margin: '0 auto',
          }}>
            Let's build something<br /><span style={{ color: R }}>together.</span>
          </h1>
          <p style={{
            fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6,
            maxWidth: 640, margin: '22px auto 0',
          }}>
            Tell us about your business and what you'd like to automate. Usually a working prototype
            within a week — full production in four to eight.
          </p>
        </div>
      </section>

      {/* LARGE PHONE CALLOUT */}
      <section className="c-pad" style={{ padding: '32px 40px 60px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          background: `linear-gradient(135deg, ${R}10, ${T}10)`,
          border: `1px solid ${HAIR}`, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: -60, right: -60, width: 240, height: 240,
            borderRadius: '50%', background: R + '22', filter: 'blur(60px)',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', bottom: -60, left: -60, width: 220, height: 220,
            borderRadius: '50%', background: T + '22', filter: 'blur(60px)',
          }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Prefer to talk?
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 18, background: INK,
              marginBottom: 22,
            }}>
              <Phone size={28} color={W} />
            </div>
            <a href={CONTACT_PHONE_HREF} className="c-phone" style={{
              display: 'block', fontSize: 80, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.045em', color: INK, lineHeight: 1, marginBottom: 14,
              textDecoration: 'none',
            }}>
              {CONTACT_PHONE}
            </a>
            <div style={{ fontSize: 15, color: MUTED, fontFamily: FB, marginBottom: 24 }}>
              Call to learn more about our custom AI agents and systems.
            </div>
            <a href={CONTACT_PHONE_HREF} className="btn btn-primary">
              Call now <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* FORM + DETAILS */}
      <section className="c-pad" style={{ padding: '64px 40px', borderTop: `1px solid ${HAIR}`, background: SURFACE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="c-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, alignItems: 'flex-start' }}>

            {/* Form column */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                Send us a message
              </div>
              <h2 style={{ fontSize: 40, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.1, marginBottom: 12 }}>
                The fastest way to start.
              </h2>
              <p style={{ fontSize: 16, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 520 }}>
                A few quick questions so we can match you with the right person and walk into the call
                with real context.
              </p>

              {/* Embedded LeadConnector form */}
              <div style={{
                background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
                overflow: 'hidden',
              }}>
                <iframe
                  src={FORM_SRC}
                  style={{ width: '100%', height: 1003, border: 'none', borderRadius: 3, display: 'block' }}
                  id={`inline-${FORM_ID}`}
                  data-layout="{'id':'INLINE'}"
                  data-trigger-type="alwaysShow"
                  data-trigger-value=""
                  data-activation-type="alwaysActivated"
                  data-activation-value=""
                  data-deactivation-type="neverDeactivate"
                  data-deactivation-value=""
                  data-form-name="Koto Contact Us"
                  data-height="1003"
                  data-layout-iframe-id={`inline-${FORM_ID}`}
                  data-form-id={FORM_ID}
                  title="Koto Contact Us"
                />
              </div>
            </div>

            {/* Details column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Other ways to reach us
              </div>

              <a href={CONTACT_PHONE_HREF} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 20, background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                textDecoration: 'none', transition: 'all .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(17,17,17,.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: R + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={20} color={R} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>Phone</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: INK, fontFamily: FH, letterSpacing: '-.015em' }}>{CONTACT_PHONE}</div>
                </div>
              </a>

              <a href={`mailto:${CONTACT_EMAIL}`} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 20, background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                textDecoration: 'none', transition: 'all .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(17,17,17,.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: T + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={20} color={T} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>Email</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: FH }}>{CONTACT_EMAIL}</div>
                </div>
              </a>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 20, background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: GRN + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={20} color={GRN} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>Based in</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: FH }}>{CONTACT_ADDRESS}</div>
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 20, background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: BLK + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={20} color={INK} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>Hours</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: FH }}>{CONTACT_HOURS}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT HAPPENS NEXT — reassurance block before the footer */}
      <section className="c-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}`, background: W }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              What happens after you hit send
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.1 }}>
              No forms black hole. No SDR queue.
            </h2>
          </div>

          <div className="c-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { num: '1', title: 'We read it within one business hour', desc: 'Adam or an engineer on the team reads your note personally. No ticketing system, no auto-reply.' },
              { num: '2', title: 'You get a 15-min call invite back', desc: 'We send 2–3 Calendly slots within a day. You pick one, or propose your own. No qualifying dance.' },
              { num: '3', title: 'Written scope + quote in 72 hours', desc: 'After the call you get a one-pager: what we\'d build, timeline, fixed price. You decide. No pressure.' },
            ].map(step => (
              <div key={step.num} style={{
                background: W, border: `1px solid ${HAIR}`, borderRadius: 14, padding: '28px 26px',
                position: 'relative', transition: 'border-color .2s, transform .2s, box-shadow .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(17,17,17,.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  position: 'absolute', top: -14, left: 22,
                  width: 32, height: 32, borderRadius: '50%', background: INK, color: W,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 900, fontFamily: FH,
                }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', marginBottom: 8, paddingTop: 8 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            textAlign: 'center', marginTop: 44, padding: '20px 28px',
            background: SURFACE, border: `1px solid ${HAIR}`, borderRadius: 14,
            maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
            fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6,
          }}>
            Rather talk now than type?{' '}
            <a href={CONTACT_PHONE_HREF} style={{
              color: INK, fontWeight: 800, textDecoration: 'none', borderBottom: `2px solid ${R}`,
            }}>Call {CONTACT_PHONE}</a>
            {' '}— we pick up 9–6 ET.
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
