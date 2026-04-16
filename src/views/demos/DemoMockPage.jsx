"use client"

import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Phone, Sparkles } from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../../lib/contact'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import InlineSystemMock from '../../components/public/InlineSystemMock'
import { usePageMeta } from '../../lib/usePageMeta'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes orbPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: .9; } 50% { transform: translate(40px,-20px) scale(1.08); opacity: 1; } }
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; text-decoration: none; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  @media (max-width: 900px) {
    .dm-hero-h1 { font-size: 40px !important; }
    .dm-pad     { padding: 56px 20px !important; }
  }
`

/**
 * Renders a single live animated demo — hero + InlineSystemMock + context strip + CTA.
 * Config drives the whole page so we can add new demos by adding a new route
 * + new config object.
 */
export default function DemoMockPage({ demo }) {
  const navigate = useNavigate()

  usePageMeta({
    title: `${demo.title} — live AI demo | Koto`,
    description: demo.description,
  })

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="dm-pad" style={{ padding: '96px 40px 32px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 460, height: 460, borderRadius: '50%', background: (demo.mockConfig.accent || R) + '1c', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 420, height: 420, borderRadius: '50%', background: T + '1c', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
          <button onClick={() => navigate('/demos')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: FH, marginBottom: 20,
            padding: 0,
          }}
            onMouseEnter={e => e.currentTarget.style.color = INK}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}
          >
            <ArrowLeft size={14} /> All demos
          </button>

          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Auto-playing · {demo.industry}
          </div>

          <h1 className="dm-hero-h1 fade" style={{
            fontSize: 56, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.08, color: INK, maxWidth: 880,
          }}>
            {demo.title}
          </h1>
          <p style={{ fontSize: 18, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 720, marginTop: 16 }}>
            {demo.scenario}
          </p>
        </div>
      </section>

      {/* ANIMATED MOCK */}
      <section className="dm-pad" style={{ padding: '24px 40px 64px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <InlineSystemMock config={demo.mockConfig} />
        </div>
      </section>

      {/* WHAT'S HAPPENING */}
      <section className="dm-pad" style={{ padding: '64px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
            What's actually happening
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.1, marginBottom: 22 }}>
            Under the hood.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {demo.underTheHood.map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                padding: '18px 22px', background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, background: INK, color: W,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, fontFamily: FH, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 15, color: INK, fontFamily: FB, lineHeight: 1.55 }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="dm-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.08, marginBottom: 14 }}>
              Build one of these for your business.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              Book a 20-minute session. We'll diagram your workflow live and quote the build on the call.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a 20-min call <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn" style={{ background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)' }}>
                <Phone size={14} /> {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
