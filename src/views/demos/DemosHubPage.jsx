"use client"
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Sparkles, UtensilsCrossed, Car, Scale, Wrench, DollarSign, Phone, Search, Bot,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../../lib/contact'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
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
  .demo-card {
    background: ${W}; border: 1px solid ${HAIR}; border-radius: 18px;
    padding: 28px 26px; transition: all .2s; cursor: pointer;
    display: flex; flex-direction: column; gap: 14px;
  }
  .demo-card:hover {
    border-color: ${INK}; transform: translateY(-3px);
    box-shadow: 0 14px 36px rgba(17,17,17,.08);
  }
  @media (max-width: 900px) {
    .dh-hero-h1 { font-size: 48px !important; }
    .dh-sec-h2  { font-size: 34px !important; }
    .dh-pad     { padding: 72px 20px !important; }
    .dh-grid    { grid-template-columns: 1fr !important; }
  }
`

const DEMOS = [
  {
    id: 'scan',
    icon: Search,
    accent: R,
    industry: 'Any business',
    title: 'Scan your business — live.',
    scenario: 'Paste any URL. In 20 seconds we pull SEO, social, technical, and conversion signals from the live page, then Claude writes the 3 fixes that\'ll move your needle most.',
    watchFor: ['Real-time homepage fetch + signal extraction', 'Scorecard across SEO, social, technical, conversion', 'Claude-written audit + top 3 fixes ranked by impact'],
    duration: 'interactive',
    href: '/demos/scan',
    cta: 'Try it with your URL →',
    flagship: true,
  },
  {
    id: 'build-agent',
    icon: Bot,
    accent: R,
    industry: 'Any business',
    title: 'Build my AI agent.',
    scenario: 'Describe your business in two sentences. Watch Claude Sonnet 4.5 stream a full production-grade agent spec — persona, system prompt, tool schemas, sample call, deployment recommendation with cost estimates.',
    watchFor: ['Real-time Claude streaming right in your browser', 'Production-grade system prompt + 3–5 tool schemas', 'Sample call transcript + deployment cost estimate'],
    duration: '~60s streamed',
    href: '/demos/build-agent',
    cta: 'Spec mine live →',
  },
  {
    id: 'catering',
    icon: UtensilsCrossed,
    accent: T,
    industry: 'Catering',
    title: 'Boxed-Lunch Order Builder',
    scenario: 'A corporate catering platform takes an order request and fills out the full build — meals, extras, containers, shipping logistics, pricing — in seconds.',
    watchFor: ['Three meals auto-configured with sides + drinks + extras', 'Shipping boxes + pallets + vehicle sized in real time', 'Gross margin computed live against COGS'],
    duration: '~12s animation',
    href: '/demos/catering',
    cta: 'Watch it fill itself →',
  },
  {
    id: 'estimate',
    icon: Car,
    accent: T,
    industry: 'Auto body',
    title: 'Collision Photo Estimator',
    scenario: 'A customer texts three damage photos. The AI identifies the vehicle, affected panels, parts required, labor hours, and writes an insurance-ready estimate.',
    watchFor: ['Panel + damage severity detection', 'OEM vs. aftermarket parts lookup', 'Labor + paint + blending quoted to the cent'],
    duration: '~15s animation',
    href: '/demos/estimate',
    cta: 'See the live run →',
  },
  {
    id: 'intake',
    icon: Scale,
    accent: BLK,
    industry: 'Law firm',
    title: 'Matter Intake Qualifier',
    scenario: 'A prospect fills out a web form. The AI matches the matter type, runs a conflict check, assigns severity, schedules the consult, and drafts the intake memo.',
    watchFor: ['Matter classification + conflict check', 'Severity + urgency + estimated engagement value', 'Consult scheduled into the right attorney\'s calendar'],
    duration: '~15s animation',
    href: '/demos/intake',
    cta: 'See the live run →',
  },
  {
    id: 'dispatch',
    icon: Wrench,
    accent: AMB,
    industry: 'HVAC',
    title: 'Dispatch Assistant',
    scenario: 'A service call comes in — dead AC at 2pm on the hottest day of the year. The AI triages urgency, checks parts, matches technician skills, and routes the nearest qualified tech.',
    watchFor: ['Urgency triage + parts availability check', 'Tech certification + drive-time match', 'Customer gets ETA with live map link'],
    duration: '~15s animation',
    href: '/demos/dispatch',
    cta: 'See the live run →',
  },
  {
    id: 'pre-qual',
    icon: DollarSign,
    accent: GRN,
    industry: 'Mortgage',
    title: 'Pre-Qualification Agent',
    scenario: 'A prospective buyer wants to know what they qualify for at 10pm on a Sunday. The AI collects income + assets + debts, runs a soft-pull, and returns loan options.',
    watchFor: ['Conversational intake across 14 fields', 'Soft-pull credit + DTI calculation', 'Loan program matching + payment schedule'],
    duration: '~15s animation',
    href: '/demos/pre-qual',
    cta: 'See the live run →',
  },
]

export default function DemosHubPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Live AI demos — see Koto systems auto-fill in real time | Koto',
    description: 'Five live, auto-filling AI automation demos across catering, auto body, law, HVAC, and mortgage. Watch Koto-built systems run in real time, then book a build session for yours.',
  })

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="dh-pad" style={{ padding: '120px 40px 64px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 480, height: 480, borderRadius: '50%', background: R + '22', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 440, height: 440, borderRadius: '50%', background: T + '22', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Live, auto-playing
          </div>
          <h1 className="dh-hero-h1 fade" style={{
            fontSize: 72, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 900, margin: '0 auto',
          }}>
            Watch Koto systems<br />fill themselves in.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 720, margin: '22px auto 0' }}>
            Five live demos across catering, auto body, law, HVAC, and mortgage — each fills out end-to-end
            in real time while you watch. No clicks, no scripts. This is what your system could do for you.
          </p>
        </div>
      </section>

      {/* FLAGSHIP — Catering */}
      <section className="dh-pad" style={{ padding: '40px 40px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {(() => {
            const flagship = DEMOS.find(d => d.flagship)
            const Icon = flagship.icon
            return (
              <div onClick={() => navigate(flagship.href)} style={{
                display: 'flex', gap: 28, alignItems: 'stretch',
                background: `linear-gradient(135deg, ${flagship.accent}0d, ${T}0d)`,
                border: `1px solid ${HAIR}`, borderRadius: 20, padding: '32px 32px',
                cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden',
                flexWrap: 'wrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 18px 44px rgba(17,17,17,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div aria-hidden="true" style={{ position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%', background: flagship.accent + '22', filter: 'blur(60px)' }} />
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 11, background: flagship.accent + '18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={22} color={flagship.accent} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: flagship.accent, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH }}>
                      Flagship · {flagship.industry}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.04em', padding: '3px 8px', background: W, border: `1px solid ${HAIR}`, borderRadius: 100 }}>
                      <Sparkles size={10} style={{ verticalAlign: -1 }} /> {flagship.duration}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK, lineHeight: 1.08, marginBottom: 10 }}>
                    {flagship.title}
                  </h2>
                  <p style={{ fontSize: 15, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginBottom: 16, maxWidth: 540 }}>
                    {flagship.scenario}
                  </p>
                  <button className="btn btn-primary">{flagship.cta}</button>
                </div>

                <div style={{
                  position: 'relative',
                  flex: '0 0 320px',
                  background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                  padding: '20px 22px', alignSelf: 'center',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: flagship.accent, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
                    Watch for
                  </div>
                  {flagship.watchFor.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: flagship.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Sparkles size={10} color={flagship.accent} />
                      </div>
                      <div style={{ fontSize: 13, color: INK, fontFamily: FB, lineHeight: 1.5 }}>{w}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* OTHER DEMOS GRID */}
      <section className="dh-pad" style={{ padding: '32px 40px 96px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
            Four more live systems
          </div>
          <h2 className="dh-sec-h2" style={{ fontSize: 40, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1.1, marginBottom: 28 }}>
            Auto body. Law. HVAC. Mortgage.
          </h2>

          <div className="dh-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {DEMOS.filter(d => !d.flagship).map(d => {
              const Icon = d.icon
              return (
                <div key={d.id} className="demo-card" onClick={() => navigate(d.href)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: d.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={22} color={d.accent} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: d.accent, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH }}>
                      {d.industry}
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: MUTED, padding: '3px 8px', background: SURFACE, border: `1px solid ${HAIR}`, borderRadius: 100 }}>
                      {d.duration}
                    </div>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.15 }}>
                    {d.title}
                  </h3>
                  <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
                    {d.scenario}
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 800, color: INK, fontFamily: FH, marginTop: 2,
                  }}>
                    {d.cta}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="dh-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 40, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.08, marginBottom: 14 }}>
              Want one of these for your business?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              Book a 20-minute build session. We'll scope your workflow live, diagram the system, and quote it on the call.
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
