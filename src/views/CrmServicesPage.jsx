"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, Database, Plug, Workflow, Layers, PieChart,
  Shield, GitBranch, Cpu, Users, Zap, Check,
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

const CAPABILITIES = [
  { icon: Database, accent: R,   title: 'Custom data model', desc: 'Objects, fields, relationships, and validation designed around the way your business actually operates — not templates you bend into shape.' },
  { icon: Workflow, accent: T,   title: 'Pipeline automation', desc: 'Status-based triggers that route, assign, enrich, and follow up — every time, on time, without a human remembering.' },
  { icon: Plug, accent: GRN,     title: 'Deep integrations', desc: 'Bi-directional sync with 200+ platforms. HubSpot, Salesforce, Zoho, Pipedrive, Monday, GoHighLevel, and any system with an API.' },
  { icon: Layers, accent: BLK,   title: 'Unified contact record', desc: 'Calls, emails, SMS, forms, ads, site visits, deals, tickets — one history per person, across every tool you use.' },
  { icon: PieChart, accent: AMB, title: 'Dashboards & reporting', desc: 'Pipeline velocity, rep performance, cohort retention — reporting built for the KPIs you actually run the business by.' },
  { icon: Shield, accent: '#8b5cf6', title: 'Enterprise security', desc: 'SOC2-aligned architecture with RLS, audit trails, role permissions, SSO, and field-level encryption where you need it.' },
]

const INTEGRATIONS = [
  'Salesforce', 'HubSpot', 'Zoho', 'Pipedrive', 'Monday', 'GoHighLevel',
  'Zapier', 'Make', 'Slack', 'Microsoft Teams', 'Gmail', 'Outlook',
  'Stripe', 'QuickBooks', 'Xero', 'Twilio', 'Retell', 'Telnyx',
  'Calendly', 'Google Workspace', 'Microsoft 365', 'Shopify', 'Airtable', 'Notion',
  'Webhooks', 'REST APIs', 'GraphQL', 'SFTP',
]

const PROCESS = [
  { num: '01', title: 'Audit', desc: 'We map every tool, data source, and workflow you have today. Gaps, overlaps, and leaks get documented before we write a line of code.' },
  { num: '02', title: 'Architect', desc: 'We design the data model, permission layers, and integration topology for your exact business — then walk you through it before we build.' },
  { num: '03', title: 'Build', desc: 'Custom objects, pipelines, automations, dashboards, and integrations built in your dedicated environment. Staged in days, not quarters.' },
  { num: '04', title: 'Migrate + Train', desc: 'Historical data imported cleanly. Your team trained live. Ongoing support for changes as the business evolves.' },
]

const STATS = [
  { num: '200+', label: 'Platforms we integrate' },
  { num: '30d',  label: 'Kickoff → live system' },
  { num: '0',    label: 'Per-seat fees, forever' },
  { num: '100%', label: 'You own code + data' },
]

const PROMISES = [
  'Built around your real pipeline — not a generic template',
  'Every tool, one unified record per contact',
  'No per-seat tax — add the team without watching costs scale',
  'Your data, your infrastructure, your schema — no vendor lock-in',
]

export default function CrmServicesPage() {
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
            Custom CRM & integrations
          </div>
          <h1 className="m-hero-h1" style={{
            fontSize: 76, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
            lineHeight: 1.05, color: INK, maxWidth: 940, margin: '0 auto',
          }}>
            A CRM built around<br />how you actually work.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 700, margin: '24px auto 0' }}>
            Stop bending your business to fit a generic CRM. We architect a custom system around your
            real pipeline and wire it into every tool you already use.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Book a scoping call <ArrowRight size={14} /></button>
            <a href={CONTACT_PHONE_HREF} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <Phone size={14} /> {CONTACT_PHONE}
            </a>
          </div>

          {/* Hero stats */}
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

      {/* CAPABILITIES */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}`, background: SURFACE }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>What we build</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              Your CRM, engineered from scratch.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Every decision — schema, permissions, automations, reports — starts with your actual workflow
              and the outcomes you measure. Nothing generic, nothing you'll outgrow.
            </p>
          </div>
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {CAPABILITIES.map(c => {
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

      {/* INTEGRATIONS */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Connects to everything</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              One system. Every tool.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Native integrations with 200+ platforms. Two-way sync, webhook events, and an AI enrichment
              layer sitting on top of every record.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {INTEGRATIONS.map(name => (
              <span key={name} style={{
                padding: '8px 14px', borderRadius: 100,
                background: SURFACE, border: `1px solid ${HAIR}`,
                fontSize: 13, fontWeight: 600, color: INK, fontFamily: FH,
              }}>{name}</span>
            ))}
          </div>

          {/* Integration features row */}
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 48 }}>
            {[
              { icon: Plug, title: 'Two-way sync', desc: 'Changes propagate everywhere. HubSpot deal closed → Slack notified → invoice generated → customer enrolled.' },
              { icon: GitBranch, title: 'Webhook & event bus', desc: 'Reactive automation on top of any event in your stack — low latency, retry-safe, fully auditable.' },
              { icon: Cpu, title: 'AI enrichment layer', desc: 'Claude-powered enrichment on every contact — firmographics, intent signals, next best action, summaries.' },
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
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>How we engineer it</div>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.08, marginBottom: 16 }}>
              Four phases. Thirty days to live.
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
              Not a template. A system.
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

      {/* SCOPE BAND */}
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
              Ready for a CRM that actually fits?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 28px' }}>
              30-minute scoping call. We'll map your pipeline, identify leaks, and quote your build live.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a scoping call <ArrowRight size={14} />
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
