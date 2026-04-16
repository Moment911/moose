"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, MapPin, Mail, Sparkles, Code2, Users,
  Rocket, Heart, Zap, Building2, Brain,
} from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import { usePageMeta } from '../lib/usePageMeta'

/* ─── Tokens (match MarketingSitePage) ─── */
const R    = '#E6007E'
const T    = '#00C2CB'
const INK  = '#111111'
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'
const W      = '#ffffff'
const GRN    = '#16a34a'
const AMB    = '#f59e0b'

const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes orbPulse {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: .85; }
    50%      { transform: translate(40px, -20px) scale(1.08); opacity: 1; }
  }
  .fade { animation: fadeUp .6s ease both; }
  .fade-1 { animation-delay: .06s; }
  .fade-2 { animation-delay: .14s; }
  .fade-3 { animation-delay: .22s; }

  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    border-radius: 10px; cursor: pointer; font-family: ${FH};
    font-weight: 700; transition: all .18s;
    border: 1px solid transparent; white-space: nowrap;
    padding: 12px 22px; font-size: 14px;
  }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; }

  @media (max-width: 900px) {
    .hide-mobile { display: none !important; }
    .about-hero-h1 { font-size: 52px !important; }
    .about-sec-h2 { font-size: 36px !important; }
    .about-split { grid-template-columns: 1fr !important; gap: 40px !important; }
    .about-values { grid-template-columns: 1fr !important; }
    .about-pad { padding: 72px 24px !important; }
    .about-nav { padding: 0 24px !important; }
  }
`

const VALUES = [
  { icon: Rocket, title: 'Ship, then refine.',     desc: 'Agencies can\'t wait six months for features. We deploy constantly and fix fast, in public.' },
  { icon: Heart,  title: 'Built for operators.',   desc: 'Every feature starts with a real problem from Momenta\'s account floor, not a product roadmap.' },
  { icon: Brain,  title: 'AI is infrastructure.',  desc: 'Not a gimmick, not a demo. AI should be as reliable as your database and as invisible as your DNS.' },
  { icon: Users,  title: 'Your data is yours.',    desc: 'Every piece of client data lives in your workspace, scoped to you. We never use it to train models.' },
  { icon: Zap,    title: 'Speed is a feature.',    desc: 'Sub-three-second responses across the platform. Agencies move fast; their tools have to keep up.' },
  { icon: Code2,  title: 'The founder writes code.', desc: 'Adam still ships features. You can reach him directly. No ticket black holes.' },
]

const TIMELINE = [
  { year: '2014',  title: 'Momenta Marketing founded',          desc: 'Adam launches Momenta Marketing (also operating as Unified Marketing) in South Florida — a hands-on digital agency serving local and regional businesses.' },
  { year: '2020',  title: 'AI enters the workflow',              desc: 'Adam starts integrating applied AI into every Momenta workflow — content briefs, ad copy, analytics. A decade of agency pain points meets a step-change in AI capability.' },
  { year: '2024',  title: 'Koto Platform 11 begins',              desc: 'The tools Momenta built internally get rebuilt as a product. The goal: every AI system Adam wished he\'d had, packaged into one platform agencies can actually run their business on.' },
  { year: '2025',  title: 'First live deployment',                 desc: 'The Spine and Wellness Center in Coral Springs, FL goes live with Koto\'s AI front desk, virtual onboarding, and VOB agents — proving the stack in real clinical operations.' },
  { year: '2026',  title: 'KotoIQ and the Custom Builder ship',   desc: 'KotoIQ — the search intelligence engine — and the custom AI agent builder launch, opening the platform to any industry with any workflow.' },
]

export default function AboutPage() {
  usePageMeta({
    title: 'About Koto — founder-led AI builds for operators | Koto',
    description: 'Koto is an agency owner\'s playbook rebuilt as software. Founder-led, 10 engineers shipping every week. Book 20 minutes with Adam — he\'ll tell you honestly whether Koto fits.',
  })
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{GLOBAL_CSS}</style>

      <PublicNav />
      <div style={{ height: 64 }} />{/* spacer for fixed nav */}

      {/* ══ HERO ══ */}
      <section className="about-pad" style={{ padding: '120px 40px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Animated color layer */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 40, left: '15%', width: 440, height: 440,
            borderRadius: '50%', background: R + '1e', filter: 'blur(100px)',
            animation: 'orbPulse 12s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: 100, right: '10%', width: 380, height: 380,
            borderRadius: '50%', background: T + '20', filter: 'blur(100px)',
            animation: 'orbPulse 14s ease-in-out infinite reverse',
          }} />
        </div>

        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            About Koto
          </div>

          <h1 className="about-hero-h1 fade fade-1" style={{
            fontSize: 76, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05,
            color: INK, maxWidth: 880, margin: '0 auto',
          }}>
            Built by an agency owner,<br />
            for agency owners.
          </h1>

          <p className="fade fade-2" style={{
            fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6,
            maxWidth: 640, margin: '24px auto 0',
          }}>
            Koto isn't a startup that decided to dabble in marketing. It's a working agency's playbook,
            rebuilt as software — and it ships every week.
          </p>
        </div>
      </section>

      {/* ══ FOUNDER ══ */}
      <section className="about-pad" style={{ padding: '80px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>
            Founder
          </div>
          <h2 className="about-sec-h2" style={{
            fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
            color: INK, lineHeight: 1.05, textAlign: 'center', marginBottom: 56,
          }}>
            Meet Adam Segall.
          </h2>

          <div className="about-split" style={{
            display: 'grid', gridTemplateColumns: '360px 1fr', gap: 56, alignItems: 'flex-start',
          }}>
            {/* Founder card */}
            <div style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 20,
              padding: 28, position: 'sticky', top: 96,
            }}>
              {/* Avatar placeholder with initials */}
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: 16,
                background: `linear-gradient(135deg, ${R}, ${T})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at 30% 30%, ${W}30, transparent 60%)`,
                }} />
                <span style={{
                  fontSize: 96, fontWeight: 900, fontFamily: FH, color: W,
                  letterSpacing: '-.04em', position: 'relative',
                }}>AS</span>
              </div>

              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em', marginBottom: 4 }}>
                Adam Segall
              </div>
              <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, marginBottom: 16 }}>
                Founder & CEO
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: `1px solid ${HAIR}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED }}>
                  <Building2 size={14} color={T} /> Momenta Marketing · Founder
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED }}>
                  <Sparkles size={14} color={R} /> Applied AI practitioner
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED }}>
                  <MapPin size={14} color={INK} /> Boca Raton, Florida
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED }}>
                  <Code2 size={14} color={GRN} /> Ships code daily
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <p style={{ fontSize: 18, color: INK, fontFamily: FB, lineHeight: 1.7, marginBottom: 20, fontWeight: 500 }}>
                Adam has spent over a decade running a marketing agency in South Florida. He founded
                <strong style={{ color: INK }}> Momenta Marketing</strong> — also operating as Unified
                Marketing — and grew it the way real agencies grow: one client relationship at a time,
                working nights, answering the phone himself, and learning every corner of the stack.
              </p>

              <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.75, marginBottom: 20 }}>
                Running an agency means doing a hundred jobs at once: strategist, writer, designer,
                media buyer, analyst, bookkeeper, recruiter, therapist. Adam did every single one of
                them. And at every role, he noticed the same thing — the tools weren't built for the
                way agencies actually work. Everything was either enterprise software too heavy for a
                25-person team, or point tools that didn't talk to each other.
              </p>

              <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.75, marginBottom: 20 }}>
                When modern AI arrived, Adam didn't treat it as a toy. He treated it as infrastructure.
                He became an <strong style={{ color: INK }}>AI expert</strong> the hard way — shipping
                systems into production at Momenta, calibrating them against real revenue, failing
                publicly when they didn't work, and rebuilding them until they did. Cold call agents
                that actually booked. Review bots that sounded human. Content pipelines that ranked.
                VOB systems that saved healthcare clients hundreds of hours a month.
              </p>

              <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.75, marginBottom: 20 }}>
                After a few years of proving those systems worked inside one agency, it was obvious they
                should exist outside of it too. Koto Platform 11 was born — every AI tool Adam wished
                he'd had earlier, rebuilt as one clean platform that any agency operator could run
                their business on.
              </p>

              <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.75 }}>
                Adam still writes code for Koto every day, still answers support requests personally,
                and still tests the voice agents by calling the numbers himself. He built Koto the
                same way he built Momenta — from the inside out.
              </p>

              {/* Quote card */}
              <div style={{
                marginTop: 32, padding: '24px 28px', borderRadius: 14,
                background: SURFACE, borderLeft: `3px solid ${R}`,
              }}>
                <div style={{ fontSize: 18, color: INK, fontFamily: FB, lineHeight: 1.55, fontStyle: 'italic', fontWeight: 500 }}>
                  "Agencies don't need another dashboard. They need the hundred small systems that
                  keep them up at night to just <em>work</em> — quietly, reliably, in the background.
                  That's what we're building."
                </div>
                <div style={{ marginTop: 14, fontSize: 13, color: MUTED, fontFamily: FH, fontWeight: 700 }}>
                  — Adam Segall
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TIMELINE ══ */}
      <section className="about-pad" style={{ padding: '96px 40px', background: SURFACE }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              The journey
            </div>
            <h2 className="about-sec-h2" style={{
              fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
              color: INK, lineHeight: 1.05,
            }}>
              From agency floor to platform.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {TIMELINE.map((t, i) => (
              <div key={t.year} style={{ display: 'flex', gap: 28, position: 'relative' }}>
                {/* Timeline rail */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: i === TIMELINE.length - 1 ? R : INK,
                    boxShadow: i === TIMELINE.length - 1 ? `0 0 0 4px ${R}22` : `0 0 0 4px ${INK}11`,
                    marginTop: 6,
                  }} />
                  {i < TIMELINE.length - 1 && (
                    <div style={{ flex: 1, width: 2, background: HAIR, marginTop: 4, marginBottom: 4 }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ paddingBottom: i < TIMELINE.length - 1 ? 32 : 0, flex: 1 }}>
                  <div style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                    background: W, border: `1px solid ${HAIR}`,
                    fontSize: 12, fontWeight: 800, color: INK, fontFamily: FH,
                    letterSpacing: '-.01em', marginBottom: 10,
                  }}>{t.year}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>
                    {t.title}
                  </div>
                  <p style={{ fontSize: 15, color: MUTED, fontFamily: FB, lineHeight: 1.65 }}>
                    {t.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ VALUES ══ */}
      <section className="about-pad" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              What we believe
            </div>
            <h2 className="about-sec-h2" style={{
              fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
              color: INK, lineHeight: 1.05, marginBottom: 18,
            }}>
              The principles that run the company.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Not slogans — operating rules. These are how we decide what to build, what to drop,
              and how to treat the people who trust us with their data.
            </p>
          </div>

          <div className="about-values" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {VALUES.map(v => {
              const Icon = v.icon
              return (
                <div key={v.title} style={{
                  background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                  padding: 24, transition: 'border-color .2s, transform .2s, box-shadow .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.boxShadow = '0 10px 28px rgba(17,17,17,.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: R + '12',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                  }}>
                    <Icon size={20} color={R} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: FH, letterSpacing: '-.015em', color: INK, marginBottom: 6 }}>
                    {v.title}
                  </div>
                  <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{v.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ CTA + CONTACT ══ */}
      <section className="about-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          background: INK, borderRadius: 24, padding: '64px 48px',
          textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: -100, right: -100, width: 320, height: 320,
            borderRadius: '50%', background: R + '30', filter: 'blur(70px)',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', bottom: -100, left: -100, width: 280, height: 280,
            borderRadius: '50%', background: T + '30', filter: 'blur(70px)',
          }} />

          <div style={{ position: 'relative' }}>
            <h2 className="about-sec-h2" style={{
              fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
              color: W, lineHeight: 1.05, marginBottom: 18,
            }}>
              Talk directly to Adam.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 32px' }}>
              No sales team, no SDR queue, no form black hole. Book 20 minutes and I'll tell you
              honestly whether Koto is a fit — and if it isn't, who you should use instead.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R, padding: '14px 26px', fontSize: 15 }} onClick={() => navigate('/contact')}>
                Book 20 min with Adam <ArrowRight size={14} />
              </button>
              <a href="mailto:adam@hellokoto.com" className="btn" style={{
                background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)',
                padding: '14px 26px', fontSize: 15, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Mail size={14} /> adam@hellokoto.com
              </a>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginTop: 18, fontFamily: FB }}>
              Or start a free trial →{' '}
              <button onClick={() => navigate('/signup')} style={{
                background: 'none', border: 'none', color: W, fontWeight: 700,
                textDecoration: 'underline', cursor: 'pointer', fontSize: 13, fontFamily: FB,
              }}>hellokoto.com/signup</button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
