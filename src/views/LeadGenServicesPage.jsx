"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, Mail, MessageSquare, Search, Target,
  Filter, BarChart2, Zap, TrendingUp, Users, Check,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import ScopeBand from '../components/public/ScopeBand'
import TrustStrip from '../components/public/TrustStrip'

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

const CHANNELS = [
  { icon: Phone, accent: R,    title: 'AI cold calling', desc: 'Human-sounding voice agents run thousands of qualified outbound calls a day. Bookings land directly on your reps\' calendars.' },
  { icon: Mail, accent: T,     title: 'Cold email sequences', desc: 'Warmed domains, spintax variants, and AI-written copy tuned per industry. Replies triaged and routed in real time.' },
  { icon: Target, accent: GRN, title: 'Paid media landers', desc: 'Conversion-first landing pages wired to your ad accounts. A/B tested live. Leads drop straight into your pipeline.' },
  { icon: Search, accent: BLK, title: 'SEO & content', desc: 'Programmatic SEO pages and authority content that ranks for the exact keywords your buyers search at decision time.' },
  { icon: Filter, accent: AMB, title: 'Scout lead lists', desc: 'AI-researched, enriched, and scored prospect lists built per ICP. Exportable. Ready to dial or email the same day.' },
  { icon: MessageSquare, accent: '#8b5cf6', title: 'SMS & voicemail drops', desc: 'Multi-touch nurture across SMS, ringless voicemail, and re-engagement flows triggered by prospect behavior.' },
]

const INDUSTRIES = [
  'Roofing', 'HVAC', 'Law firms', 'Dental', 'Real estate', 'Med spa',
  'Auto dealers', 'Restaurants', 'Insurance', 'Fitness', 'Home services',
  'Financial advisors', 'Contractors', 'Retail', 'Solar', 'Moving',
  'Cleaning', 'Pest control', 'Landscaping', 'B2B SaaS',
]

const PROCESS = [
  { num: '01', title: 'ICP + offer', desc: 'We lock in who you\'re targeting and the offer that will pull them in. Messaging is written to match — not generic drip.' },
  { num: '02', title: 'Build', desc: 'Lists, scripts, sequences, landers, and ad creative built to spec in 7–10 days — not weeks of kickoff calls.' },
  { num: '03', title: 'Launch', desc: 'Every channel fires on the same day. Calls, emails, ads, SMS, content. Real-time dashboards from hour one.' },
  { num: '04', title: 'Optimize', desc: 'We cut what isn\'t working every week and double down on what is. Cost-per-appointment is the only scoreboard.' },
]

const STATS = [
  { num: '6',    label: 'Channels you can run in parallel' },
  { num: '100+', label: 'Industry playbooks on day one' },
  { num: '24/7', label: 'AI dialing + emailing' },
  { num: '7–10d', label: 'From kickoff to first booked calls' },
]

const PROMISES = [
  'Booked appointments, not raw lead lists',
  'Industry-specific playbooks — 100+ ready on day one',
  'Full channel attribution — every booking traced to source',
  'Weekly performance reviews — you always know what\'s working',
]

export default function LeadGenServicesPage() {
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
            Lead generation — any industry
          </div>
          <h1 className="m-hero-h1" style={{
            fontSize: 76, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
            lineHeight: 1.05, color: INK, maxWidth: 960, margin: '0 auto',
          }}>
            We don't sell leads.<br />
            <span style={{ color: R }}>We book appointments.</span>
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 700, margin: '24px auto 0' }}>
            A performance engine that runs outbound, inbound, paid, and organic in lockstep — tuned per
            industry, measured on booked calls, priced on outcomes.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Book a strategy call <ArrowRight size={14} /></button>
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

      {/* TRUST STRIP */}
      <TrustStrip />

      {/* CHANNELS */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}`, background: SURFACE }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Six channels. One engine.</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              Every way to generate demand.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Start with one, scale into all six. We tune the mix per week based on cost-per-appointment —
              not activity, not impressions, not opens.
            </p>
          </div>
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {CHANNELS.map(c => {
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

      {/* INDUSTRIES */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Any industry. Any market.</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              We speak your language.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              100+ industry playbooks with proven scripts, offers, creative, and ad angles. Launch Monday.
              Meetings on the calendar by Friday.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {INDUSTRIES.map(name => (
              <span key={name} style={{
                padding: '8px 14px', borderRadius: 100,
                background: SURFACE, border: `1px solid ${HAIR}`,
                fontSize: 13, fontWeight: 600, color: INK, fontFamily: FH,
              }}>{name}</span>
            ))}
          </div>

          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 48 }}>
            {[
              { icon: Target, title: 'Built for your ICP', desc: 'Tell us who you sell to. We reverse-engineer the list, the offer, the script, and the channel that wins in your niche.' },
              { icon: BarChart2, title: 'Weekly performance reviews', desc: 'Every Monday you get CPL, show rate, conversion rate, and pipeline value — sliced by channel, campaign, and rep.' },
              { icon: Zap, title: 'Instant lead handoff', desc: 'The second a prospect books, your rep gets a full brief: context, recording, intent signal, next-best question.' },
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
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Four phases to revenue</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              From kickoff to booked calls.
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
              Booked calendars — not lead lists.
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
              Your calendar wants to be full.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 28px' }}>
              30-minute strategy call. We'll show you exactly how to fill it in your market — with real numbers from operators just like you.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book strategy call <ArrowRight size={14} />
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
