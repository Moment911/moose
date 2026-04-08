"use client"
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Phone, PhoneIncoming, Star, Target, Brain,
  Globe, BarChart2, Check, ArrowRight, Menu, X, Zap,
  Shield, TrendingUp, Users, Mail, Clock
} from 'lucide-react'

const RED   = '#E6007E'
const BLACK = '#0a0a0a'
const WHITE = '#ffffff'
const GRAY  = '#6b7280'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const CSS = `
  .svc-fade { opacity: 0; transform: translateY(32px); transition: opacity .65s ease, transform .65s ease; }
  .svc-fade.visible { opacity: 1; transform: translateY(0); }
  .svc-card { border: 1.5px solid #e5e7eb; border-radius: 16px; padding: 28px 24px; background: ${WHITE}; transition: transform .25s, box-shadow .25s; }
  .svc-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,.08); }
  .svc-nav-link { background: none; border: none; color: rgba(255,255,255,.5); font-size: 14px; font-weight: 600; cursor: pointer; padding: 8px 16px; border-radius: 8px; font-family: ${FH}; transition: color .15s; }
  .svc-nav-link:hover { color: #fff; }
  @media (max-width: 768px) {
    .svc-hide-mobile { display: none !important; }
    .svc-show-mobile { display: flex !important; }
    .svc-grid-2 { grid-template-columns: 1fr !important; }
    .svc-hero-h1 { font-size: 36px !important; }
    .svc-section-h2 { font-size: 32px !important; }
    .svc-section-pad { padding: 60px 20px !important; }
    .svc-nav-pad { padding: 0 20px !important; }
  }
`

const SERVICES = [
  {
    num: '01', icon: <Sparkles size={28} color={RED} />, cat: 'SEO', title: 'AI Page Builder',
    desc: 'Research competitors, generate 2,000+ word SEO-optimized pages, and deploy directly to WordPress. County and city drill-down for local service areas.',
    features: ['One-click county/city pages', 'SEO-optimized via GPT-4', 'Auto-publish to WordPress', 'White-label for any client', 'Bulk generation (100+ pages)', 'Competitor content analysis'],
    stats: [{ n: '2,000+', l: 'Words per page' }, { n: '247+', l: 'Pages generated' }, { n: '89%', l: 'Ranking improvement' }],
  },
  {
    num: '02', icon: <Phone size={28} color={RED} />, cat: 'VOICE', title: 'AI Cold Call Agent',
    desc: 'Outbound AI calling with real voices. DNC compliance, timezone enforcement, voicemail detection, live transfers, and automatic appointment booking.',
    features: ['318 real AI voices', 'TCPA/DNC compliant', 'Smart timezone calling', 'Live transfer to closers', 'Voicemail detection', 'Automatic booking'],
    stats: [{ n: '318', l: 'Voice options' }, { n: '24/7', l: 'Calling hours' }, { n: '3x', l: 'More appointments' }],
  },
  {
    num: '03', icon: <PhoneIncoming size={28} color={RED} />, cat: 'VOICE', title: 'AI Answering Service',
    desc: '24/7 AI receptionist with 20 industry-specific intake templates. Never miss a call. Instant email and SMS summaries with caller tracking.',
    features: ['20 intake templates', 'Medical, legal, HVAC & more', 'Instant call summaries', 'Calendar integration', 'Caller CRM tracking', 'Custom greeting scripts'],
    stats: [{ n: '20', l: 'Industry templates' }, { n: '0', l: 'Missed calls' }, { n: '<2s', l: 'Answer time' }],
  },
  {
    num: '04', icon: <Star size={28} color={RED} />, cat: 'GROWTH', title: 'Review Management',
    desc: 'Automated review collection via SMS and email drip campaigns. Monitor Google and Yelp. AI-drafted responses. White-label review pages.',
    features: ['SMS & email campaigns', 'Google & Yelp monitoring', 'AI response drafts', 'White-label pages', 'Star rating analytics', 'Review velocity tracking'],
    stats: [{ n: '5x', l: 'More reviews' }, { n: '4.8', l: 'Average rating' }, { n: '< 1hr', l: 'Response time' }],
  },
  {
    num: '05', icon: <Target size={28} color={RED} />, cat: 'INTELLIGENCE', title: 'Scout Lead Intelligence',
    desc: 'AI-powered prospect research. Find and qualify leads with scoring, build prospect reports, and feed them directly into voice agent campaigns.',
    features: ['AI business research', 'Lead scoring (0-100)', 'Prospect reports', 'Pipeline CRM', 'Auto-enrich data', 'Campaign integration'],
    stats: [{ n: '100+', l: 'Leads per search' }, { n: '< 30s', l: 'Research time' }, { n: '87%', l: 'Accuracy rate' }],
  },
  {
    num: '06', icon: <Brain size={28} color={RED} />, cat: 'INTELLIGENCE', title: 'CMO AI Agent',
    desc: 'Your always-on AI marketing strategist. Natural language queries, cross-client insights, competitive analysis, and strategy recommendations on demand.',
    features: ['Natural language queries', 'Cross-client insights', 'Competitive analysis', 'Strategy recommendations', 'Content ideation', 'Performance analysis'],
    stats: [{ n: '∞', l: 'Queries per day' }, { n: '< 5s', l: 'Response time' }, { n: '24/7', l: 'Availability' }],
  },
]

function useFadeIn() {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } },
      { threshold: 0.12 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return ref
}

function FadeIn({ children, style }) {
  const ref = useFadeIn()
  return <div ref={ref} className="svc-fade" style={style}>{children}</div>
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div style={{ background: WHITE, fontFamily: FB, color: BLACK }}>
      <style>{CSS}</style>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: BLACK, display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 26 }} />
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: WHITE, cursor: 'pointer' }}><X size={26} /></button>
          </div>
          {['/', '/services', '/contact', '/login'].map(p => (
            <button key={p} onClick={() => { setMenuOpen(false); navigate(p) }} style={{ background: 'none', border: 'none', color: WHITE, fontSize: 22, fontWeight: 700, fontFamily: FH, padding: '16px 0', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {p === '/' ? 'Platform' : p.slice(1).charAt(0).toUpperCase() + p.slice(2)}
            </button>
          ))}
          <button onClick={() => { setMenuOpen(false); navigate('/signup') }} style={{ marginTop: 32, background: RED, border: 'none', color: WHITE, fontSize: 16, fontWeight: 700, padding: '16px 32px', borderRadius: 12, cursor: 'pointer', fontFamily: FH }}>
            Get Demo <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="svc-nav-pad" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000, background: BLACK,
        borderBottom: scrolled ? '1px solid rgba(255,255,255,.1)' : '1px solid transparent',
        transition: 'border-color .3s', padding: '0 48px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 28, cursor: 'pointer' }} onClick={() => navigate('/')} />
        <div className="svc-hide-mobile" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[{ l: 'Platform', t: '/' }, { l: 'Services', t: '/services' }, { l: 'Contact', t: '/contact' }].map(n => (
            <button key={n.l} className="svc-nav-link" onClick={() => navigate(n.t)}>{n.l}</button>
          ))}
        </div>
        <div className="svc-hide-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="svc-nav-link" onClick={() => navigate('/login')} style={{ color: WHITE }}>Login</button>
          <button onClick={() => navigate('/signup')} style={{ background: RED, border: 'none', color: WHITE, fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontFamily: FH }}>Get Demo →</button>
        </div>
        <button className="svc-show-mobile" onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 'none', color: WHITE, cursor: 'pointer', display: 'none' }}>
          <Menu size={26} />
        </button>
      </nav>

      {/* Hero */}
      <section style={{ background: BLACK, paddingTop: 140, paddingBottom: 80, textAlign: 'center' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: RED, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 28, fontFamily: FH }}>
            ◆ EVERYTHING YOUR AGENCY NEEDS
          </div>
          <h1 className="svc-hero-h1" style={{ fontFamily: FH, fontSize: 64, fontWeight: 800, color: WHITE, margin: '0 0 20px', letterSpacing: '-.04em', lineHeight: 1.05 }}>
            WHAT KOTO CAN DO<br />FOR YOUR AGENCY
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
            Six AI-powered tools that replace an entire marketing team. Built specifically for agencies who want to scale without hiring.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/signup')} style={{ background: RED, border: 'none', color: WHITE, fontSize: 16, fontWeight: 700, padding: '16px 36px', borderRadius: 12, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 6px 24px ${RED}40` }}>
              Start Free Trial <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/contact')} style={{ background: 'transparent', border: '1.5px solid rgba(255,255,255,.2)', color: WHITE, fontSize: 16, fontWeight: 700, padding: '16px 36px', borderRadius: 12, cursor: 'pointer', fontFamily: FH }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Services */}
      {SERVICES.map((svc, i) => {
        const isDark = i % 2 === 1
        return (
          <section key={svc.num} style={{ background: isDark ? BLACK : '#f9fafb', padding: '100px 24px' }}>
            <FadeIn>
              <div className="svc-grid-2" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
                {/* Text side */}
                <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <span style={{ fontFamily: FH, fontSize: 48, fontWeight: 800, color: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', letterSpacing: '-.03em', lineHeight: 1 }}>{svc.num}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: FH, background: RED + '12', padding: '4px 12px', borderRadius: 6 }}>{svc.cat}</span>
                  </div>
                  <h2 className="svc-section-h2" style={{ fontFamily: FH, fontSize: 40, fontWeight: 800, color: isDark ? WHITE : BLACK, margin: '0 0 16px', letterSpacing: '-.03em', lineHeight: 1.1 }}>
                    {svc.title}
                  </h2>
                  <p style={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,.5)' : GRAY, lineHeight: 1.7, marginBottom: 28 }}>
                    {svc.desc}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
                    {svc.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Check size={14} color={RED} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,.6)' : '#374151', fontWeight: 500 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 32 }}>
                    {svc.stats.map(s => (
                      <div key={s.l}>
                        <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: isDark ? WHITE : BLACK, letterSpacing: '-.02em' }}>{s.n}</div>
                        <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,.35)' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, marginTop: 2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual side */}
                <div style={{ order: i % 2 === 0 ? 2 : 1 }}>
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
                    border: isDark ? '1px solid rgba(255,255,255,.08)' : '1.5px solid #e5e7eb',
                    borderRadius: 20, padding: 48, minHeight: 340,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
                  }}>
                    <div style={{ width: 72, height: 72, borderRadius: 18, background: RED + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {svc.icon}
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: isDark ? WHITE : BLACK, textAlign: 'center' }}>{svc.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {svc.features.slice(0, 3).map(f => (
                        <span key={f} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,.06)' : '#f3f4f6', color: isDark ? 'rgba(255,255,255,.5)' : '#6b7280', fontFamily: FH, letterSpacing: '.02em' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </section>
        )
      })}

      {/* CTA */}
      <section style={{ background: BLACK, padding: '100px 24px', textAlign: 'center' }}>
        <FadeIn>
          <div style={{ maxWidth: 650, margin: '0 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: RED, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 24, fontFamily: FH }}>
              ◆ READY TO SCALE
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 44, fontWeight: 800, color: WHITE, margin: '0 0 16px', letterSpacing: '-.03em', lineHeight: 1.1 }}>
              BUILD YOUR AGENCY'S FUTURE
            </h2>
            <p style={{ fontSize: 16, color: '#999999', lineHeight: 1.7, marginBottom: 36 }}>
              No contracts. No credit card required. Set up in 10 minutes.
            </p>
            <button onClick={() => navigate('/signup')} style={{
              background: RED, border: 'none', color: WHITE, fontSize: 17, fontWeight: 700,
              padding: '18px 44px', borderRadius: 14, cursor: 'pointer', fontFamily: FH,
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: `0 8px 32px ${RED}50`,
            }}>
              Get Started Today <ArrowRight size={18} />
            </button>
          </div>
        </FadeIn>
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
