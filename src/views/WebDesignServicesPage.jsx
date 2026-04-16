"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, Globe, Layers, Smartphone, Code,
  Sparkles, PenTool, Cpu, Zap, Users, Check,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import ScopeBand from '../components/public/ScopeBand'

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
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .card { background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px; padding: 26px; transition: border-color .2s, transform .2s, box-shadow .2s; }
  .card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }
  @media (max-width: 900px) {
    .m-hero-h1 { font-size: 48px !important; }
    .m-sec-h2 { font-size: 36px !important; }
    .m-grid-3 { grid-template-columns: 1fr !important; }
    .m-grid-2 { grid-template-columns: 1fr !important; }
    .m-pad { padding: 72px 24px !important; }
  }
`

const OFFERINGS = [
  { icon: PenTool, accent: R,    title: 'Brand-led website design', desc: 'Strategy-first design systems built around your positioning. Not dragged from a template library or reskinned from last year\'s trends.' },
  { icon: Code, accent: T,       title: 'High-performance build', desc: 'Next.js, React, and TypeScript on Vercel. Core Web Vitals green out of the box. Built to rank, built to last.' },
  { icon: Layers, accent: GRN,   title: 'Custom platform development', desc: 'Member portals, booking flows, multi-tenant SaaS, internal tools — architected for scale from day one, not retrofitted.' },
  { icon: Sparkles, accent: AMB, title: 'E-commerce & checkout', desc: 'Shopify Hydrogen, custom Stripe, subscription billing — conversion-tuned checkout flows that actually close the sale.' },
  { icon: Smartphone, accent: BLK, title: 'Mobile-first experiences', desc: 'Pixel-perfect on every screen. PWA-ready. Thumb-tested. Scroll depth and tap targets designed-in, not an afterthought.' },
  { icon: Cpu, accent: '#8b5cf6', title: 'Wired into Koto', desc: 'Your site talks directly to your CRM, voice agents, lead routing, and analytics stack from day one — not a launch checklist item.' },
]

const STACK = [
  'Next.js', 'React', 'TypeScript', 'Tailwind', 'Vercel',
  'Supabase', 'Stripe', 'Resend', 'Shopify', 'Figma',
  'Framer Motion', 'Claude AI', 'Retell', 'Twilio', 'Segment', 'PostHog',
]

const PROCESS = [
  { num: '01', title: 'Discovery', desc: 'We strip your brand to first principles — who, why, offer, proof. That drives every design and build decision after it.' },
  { num: '02', title: 'Design', desc: 'Brand system, wireframes, and high-fidelity Figma designs reviewed with you in KotoProof — annotation-first, zero email threads.' },
  { num: '03', title: 'Build', desc: 'Production engineering on Next.js + Vercel. Integrations wired. Analytics instrumented. QA on every real device.' },
  { num: '04', title: 'Launch + iterate', desc: 'Launch with zero downtime. We then watch the data — conversion, bounce, scroll, heatmaps — and iterate every month.' },
]

const STATS = [
  { num: '98+',  label: 'Avg. Lighthouse score' },
  { num: '30d',  label: 'Design → launch' },
  { num: '100%', label: 'Integrated with Koto' },
  { num: '2.1x', label: 'Conversion vs. template' },
]

const PROMISES = [
  'Wired into your CRM, voice agents, and analytics from day one',
  'Real code on your repo, your hosting, your domain — no lock-in',
  'Mobile-first design — because 70% of your traffic is on a thumb',
  'Fixed-scope pricing — you know the number before we write a line',
]

export default function WebDesignServicesPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="m-pad" style={{ padding: '120px 40px 80px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: R + '28', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: T + '26', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Websites & platforms — integrated by design
          </div>
          <h1 className="m-hero-h1" style={{
            fontSize: 76, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
            lineHeight: 1.05, color: INK, maxWidth: 960, margin: '0 auto',
          }}>
            Sites that sell.<br />
            <span style={{ color: R }}>Platforms that scale.</span>
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 700, margin: '24px auto 0' }}>
            We design and engineer websites, portals, and custom platforms that ship wired directly into your
            Koto CRM, voice agents, and analytics — day one.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Book a design call <ArrowRight size={14} /></button>
            <a href={CONTACT_PHONE_HREF} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <Phone size={14} /> {CONTACT_PHONE}
            </a>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
            marginTop: 72, paddingTop: 36, borderTop: `1px solid ${HAIR}`,
            maxWidth: 820, marginLeft: 'auto', marginRight: 'auto',
          }} className="m-grid-3">
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 8, letterSpacing: '.02em', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OFFERINGS */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}`, background: SURFACE }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>What we build</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              From landing page to full platform.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Every decision — design, stack, integrations — starts with how you sell and how you operate.
              You get production code on your repo, your hosting, your domain.
            </p>
          </div>
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {OFFERINGS.map(c => {
              const Icon = c.icon
              return (
                <div key={c.title} className="card">
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: c.accent + '14',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <Icon size={22} color={c.accent} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', marginBottom: 8 }}>{c.title}</div>
                  <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{c.desc}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* STACK */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>The stack</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              Modern tools. Built to last.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Production-grade infrastructure. No page builders, no vendor lock-in, no surprise bills. Just
              fast, reliable, maintainable code you own.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {STACK.map(name => (
              <span key={name} style={{
                padding: '8px 14px', borderRadius: 100,
                background: SURFACE, border: `1px solid ${HAIR}`,
                fontSize: 13, fontWeight: 600, color: INK, fontFamily: FH,
              }}>{name}</span>
            ))}
          </div>

          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 48 }}>
            {[
              { icon: Cpu, title: 'Connected to your CRM', desc: 'Every form, chat, and CTA syncs live to your Koto CRM with source, campaign, and session context attached.' },
              { icon: Globe, title: 'Voice-agent ready', desc: 'Click-to-call buttons trigger Retell outbound agents. Click-to-chat hands off to AI with full site context.' },
              { icon: Zap, title: 'Instant publishing', desc: 'Push-to-deploy on Vercel. Preview URLs for every change. Roll back to any version in a single click.' },
            ].map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="card">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: INK,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                  }}>
                    <Icon size={20} color={W} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}`, background: SURFACE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Design & build process</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              Kickoff to launch in 30 days.
            </h2>
          </div>
          <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {PROCESS.map(p => (
              <div key={p.num} className="card">
                <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.1em', fontFamily: FH, marginBottom: 10 }}>{p.num}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROMISES */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Our promises</div>
            <h2 className="m-sec-h2" style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08 }}>
              Wired into your systems.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="m-grid-2">
            {PROMISES.map(p => (
              <div key={p} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '16px 18px', borderRadius: 12,
                background: WASH, border: `1px solid ${HAIR}`,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: R,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Check size={14} color={W} />
                </div>
                <div style={{ fontSize: 15, color: INK, fontFamily: FB, lineHeight: 1.55, fontWeight: 500 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ScopeBand />

      {/* CTA */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="m-sec-h2" style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: W, lineHeight: 1.08, marginBottom: 18 }}>
              Ready for a site that actually works?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 28px' }}>
              30-minute design call. We'll scope your build, quote it live, and show three examples in your industry.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a design call <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} style={{ color: W, textDecoration: 'none', fontFamily: FH, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}>
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
