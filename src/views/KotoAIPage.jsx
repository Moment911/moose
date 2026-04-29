"use client"

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Check, Phone, MessageSquare, BarChart2, Zap, Star,
  Search, Globe, TrendingUp, Cpu,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { supabase } from '../lib/supabase'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

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
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 14px 24px; font-size: 15px; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; }
  .btn-pink { background: ${R}; color: ${W}; }
  .btn-pink:hover { background: #c90070; transform: translateY(-1px); box-shadow: 0 10px 28px ${R}33; }
  .card { background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px; padding: 28px; transition: border-color .2s, transform .2s, box-shadow .2s; }
  .card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }
  @media (max-width: 900px) {
    .k-hero-h1 { font-size: 52px !important; }
    .k-sec-h2 { font-size: 40px !important; }
    .k-grid-3 { grid-template-columns: 1fr !important; }
    .k-pad { padding: 72px 24px !important; }
  }
`

const TOOLS = [
  { num: '01', title: 'AI Page Builder', icon: Globe, desc: 'Generate full client landing pages from one prompt. SEO-ready, mobile-ready, live in minutes.' },
  { num: '02', title: 'Cold Call Agent', icon: Phone, desc: 'AI outbound that books appointments 24/7. Sounds human, converts like a pro.' },
  { num: '03', title: 'AI Answering Service', icon: MessageSquare, desc: 'Never miss an inbound call. Route, qualify, and respond to leads around the clock.' },
  { num: '04', title: 'Review Management', icon: Star, desc: 'Monitor, respond to, and generate 5-star reviews across every platform automatically.' },
  { num: '05', title: 'Scout Leads', icon: Search, desc: 'Find and qualify perfect prospects with AI-driven research + enrichment pipelines.' },
  { num: '06', title: 'CMO Agent', icon: BarChart2, desc: 'Your always-on fractional CMO. Strategy, campaigns, and competitive analysis on demand.' },
]

const PHASES = [
  { num: '01', title: 'Connect', icon: Zap, desc: 'Link your CRM, phone system, and existing tools in minutes. No-code integrations.' },
  { num: '02', title: 'Research', icon: Search, desc: 'Koto audits your market, competitors, and prospects to build a data-driven blueprint.' },
  { num: '03', title: 'Generate', icon: Cpu, desc: 'AI creates pages, sequences, scripts, and campaigns tailored to your exact market.' },
  { num: '04', title: 'Deploy', icon: TrendingUp, desc: 'Launch AI agents that call, answer, build, review, and optimize — without a break.' },
]

const DEFAULT_PRICING = [
  {
    id: 'starter', name: 'Starter', price: 297, popular: false,
    desc: 'For solo operators and new agencies.',
    features: ['3 team seats', 'Up to 25 clients', 'AI review responses', 'Scout lead intelligence', 'Client onboarding forms'],
  },
  {
    id: 'growth', name: 'Growth', price: 497, popular: true,
    desc: 'For growing agencies ready to scale fast.',
    features: ['10 team seats', 'Up to 100 clients', 'Everything in Starter', 'Agency Autopilot (all 6 agents)', 'White-label platform', 'Social content AI'],
  },
  {
    id: 'agency', name: 'Agency', price: 997, popular: false,
    desc: 'Full power for established agencies.',
    features: ['25 team seats', 'Up to 500 clients', 'Everything in Growth', 'Lead scoring AI', 'API access', 'Priority support'],
  },
]

export default function KotoAIPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState(DEFAULT_PRICING)

  useEffect(() => {
    let cancelled = false
    supabase.from('platform_config').select('value').eq('key', 'signup_plans').maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const fromDb = data?.value
        if (Array.isArray(fromDb) && fromDb.length) {
          setPlans(fromDb.map(p => ({ ...DEFAULT_PRICING.find(d => d.id === p.id), ...p })))
        }
      }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="k-pad" style={{ padding: '120px 40px 80px', position: 'relative' }}>
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
            Koto AI · The agency operating system
          </div>
          <h1 className="k-hero-h1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 920, margin: '0 auto',
          }}>
            The operating system<br />for marketing agencies.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 640, margin: '22px auto 0' }}>
            AI agents that call, answer, qualify, publish, and optimize — so you can scale
            without hiring. Built for the modern agency operator.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
            <button className="btn btn-primary" onClick={() => navigate('/signup')}>
              Start free trial <ArrowRight size={15} />
            </button>
            <button className="btn btn-secondary" onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}>
              See the tools
            </button>
          </div>
          <div style={{ fontSize: 13, color: FAINT, marginTop: 18 }}>
            No credit card required · 14-day free trial · Set up in 10 minutes
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section id="tools" className="k-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>What's inside</div>
            <h2 className="k-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05 }}>
              Six AI agents.<br />One command center.
            </h2>
          </div>
          <div className="k-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {TOOLS.map(t => {
              const Icon = t.icon
              return (
                <div key={t.num} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: R + '10',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} color={R} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.06em' }}>{t.num}</span>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>{t.title}</h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, fontFamily: FB }}>{t.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PHASES */}
      <section className="k-pad" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
            <h2 className="k-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05, marginBottom: 18 }}>
              Four phases. No slowdowns.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              From connect to deploy, Koto replaces the dozens of tools and hires that used to slow your agency down.
            </p>
          </div>
          <div className="k-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {PHASES.map(p => {
              const Icon = p.icon
              return (
                <div key={p.num} className="card" style={{ padding: '28px 24px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: T + '12',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                  }}>
                    <Icon size={20} color={T} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', marginBottom: 6 }}>STEP {p.num}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>{p.title}</h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, fontFamily: FB }}>{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="k-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Pricing</div>
            <h2 className="k-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05, marginBottom: 14 }}>
              Simple plans. No surprises.
            </h2>
            <p style={{ fontSize: 16, color: MUTED, fontFamily: FB }}>No contracts. Cancel anytime. 14-day free trial on every plan.</p>
          </div>
          <div className="k-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, alignItems: 'stretch' }}>
            {plans.map(plan => (
              <div key={plan.id || plan.name} style={{
                position: 'relative', background: W,
                border: plan.popular ? `2px solid ${INK}` : `1px solid ${HAIR}`,
                borderRadius: 16, padding: '36px 28px', display: 'flex', flexDirection: 'column',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -12, left: 28,
                    background: INK, color: W, fontSize: 11, fontWeight: 800,
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    padding: '5px 12px', borderRadius: 100,
                  }}>
                    Most popular
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, letterSpacing: '.04em', marginBottom: 10 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1 }}>
                    ${typeof plan.price === 'number' ? plan.price : String(plan.price).replace('$', '')}
                  </span>
                  <span style={{ fontSize: 15, color: MUTED, fontFamily: FB }}>/mo</span>
                </div>
                <p style={{ fontSize: 14, color: MUTED, marginBottom: 24, fontFamily: FB, lineHeight: 1.5 }}>{plan.desc || ''}</p>
                <button
                  onClick={() => navigate('/signup')}
                  className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}
                >
                  Start free trial
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Check size={15} color={GRN} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: INK, lineHeight: 1.45, fontFamily: FB }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="k-pad" style={{ padding: '96px 40px' }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '64px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="k-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: W, lineHeight: 1.05, marginBottom: 18 }}>
              Ready to run your<br />agency on autopilot?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 32px' }}>
              Replace the dozens of tools and hires that used to slow your agency down. One unified AI system, deployed in minutes.
            </p>
            <button className="btn btn-pink" onClick={() => navigate('/signup')}>
              Start free trial <ArrowRight size={15} />
            </button>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 18 }}>
              No credit card required · Cancel anytime
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
