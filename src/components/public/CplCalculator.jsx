"use client"
import { useState, useMemo } from 'react'
import { ArrowRight, Calculator, TrendingUp, Mail } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../../lib/theme'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'

/**
 * Interactive cost-per-appointment calculator — the highest-intent lead
 * magnet on a B2B lead-gen page. Pure client-side math; emails results on
 * capture via /api/lead-magnet.
 *
 * Numbers are industry benchmarks in ranges — we display the mid-point and
 * label it plainly as a benchmark estimate. Conservative, not salesy.
 */

// Rough benchmark ranges from public CMO-council + Demand Gen reports 2023-2025.
// These are clearly benchmark assumptions, not Koto-specific promises.
const INDUSTRIES = [
  { id: 'home_services',    label: 'Home services (HVAC, roofing, plumbing)', cpl_low: 65,  cpl_high: 185, show_rate: 0.58, close_rate: 0.34 },
  { id: 'legal',            label: 'Legal (personal injury, family, estate)', cpl_low: 120, cpl_high: 380, show_rate: 0.54, close_rate: 0.28 },
  { id: 'dental_medical',   label: 'Dental / medical / dermatology',          cpl_low: 70,  cpl_high: 210, show_rate: 0.62, close_rate: 0.42 },
  { id: 'real_estate',      label: 'Real estate (buyer / seller)',            cpl_low: 90,  cpl_high: 260, show_rate: 0.48, close_rate: 0.22 },
  { id: 'financial',        label: 'Financial advisory / insurance',          cpl_low: 110, cpl_high: 320, show_rate: 0.50, close_rate: 0.24 },
  { id: 'b2b_saas',         label: 'B2B SaaS / services',                     cpl_low: 180, cpl_high: 520, show_rate: 0.62, close_rate: 0.18 },
  { id: 'auto',             label: 'Auto dealers / auto services',            cpl_low: 45,  cpl_high: 165, show_rate: 0.55, close_rate: 0.30 },
  { id: 'other',            label: 'Other / not listed',                      cpl_low: 95,  cpl_high: 290, show_rate: 0.55, close_rate: 0.28 },
]

// Koto multi-channel lift — modest and defensible.
// We cut CPL ~35% vs. single-channel baseline (realistic for blended outbound).
const KOTO_CPL_MULTIPLIER = 0.65

function fmt(n) { return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '$' + Math.round(n) }
function fmtInt(n) { return Math.round(n).toLocaleString() }

export default function CplCalculator() {
  const [industryId, setIndustryId] = useState('home_services')
  const [budget, setBudget] = useState(8000)
  const [acv, setAcv] = useState(4500)

  // Second-stage form: email capture for the detailed breakdown
  const [emailed, setEmailed] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const industry = INDUSTRIES.find(i => i.id === industryId) || INDUSTRIES[0]

  const results = useMemo(() => {
    const industryCplMid = (industry.cpl_low + industry.cpl_high) / 2
    const kotoCplMid     = industryCplMid * KOTO_CPL_MULTIPLIER

    const leadsIndustry  = budget / industryCplMid
    const leadsKoto      = budget / kotoCplMid

    const appointmentsIndustry = leadsIndustry * industry.show_rate
    const appointmentsKoto     = leadsKoto     * industry.show_rate

    const cpaIndustry    = budget / Math.max(appointmentsIndustry, 0.01)
    const cpaKoto        = budget / Math.max(appointmentsKoto, 0.01)

    const dealsIndustry  = appointmentsIndustry * industry.close_rate
    const dealsKoto      = appointmentsKoto     * industry.close_rate

    const revenueIndustry = dealsIndustry * acv
    const revenueKoto     = dealsKoto     * acv

    const roiIndustry = (revenueIndustry - budget) / budget
    const roiKoto     = (revenueKoto     - budget) / budget

    const upliftRevenue = revenueKoto - revenueIndustry

    return {
      industryCplMid, kotoCplMid,
      leadsIndustry, leadsKoto,
      appointmentsIndustry, appointmentsKoto,
      cpaIndustry, cpaKoto,
      dealsIndustry, dealsKoto,
      revenueIndustry, revenueKoto,
      roiIndustry, roiKoto,
      upliftRevenue,
    }
  }, [industry, budget, acv])

  async function onEmailSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          magnet: 'cpl-calculator',
          magnet_title: 'Cost-per-appointment calculator results',
          page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          extra: {
            industry: industry.label,
            monthly_budget: budget,
            avg_customer_value: acv,
            projected_appointments_on_koto: Math.round(results.appointmentsKoto),
            projected_revenue_on_koto: Math.round(results.revenueKoto),
            projected_cpa_on_koto: Math.round(results.cpaKoto),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Something broke on our side. Try again?')
        setLoading(false)
        return
      }
      setEmailed(true)
      setLoading(false)
    } catch {
      setError('Network error. Try again?')
      setLoading(false)
    }
  }

  return (
    <section className="cpl-pad" style={{ padding: '72px 40px', background: W, borderTop: `1px solid ${HAIR}` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 100, background: SURFACE,
            border: `1px solid ${HAIR}`,
            fontSize: 11, fontWeight: 700, color: R, letterSpacing: '.08em',
            textTransform: 'uppercase', fontFamily: FH, marginBottom: 16,
          }}>
            <Calculator size={12} />
            Free interactive tool
          </div>
          <h2 className="cpl-h2" style={{
            fontSize: 36, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.025em', color: INK, lineHeight: 1.1, marginBottom: 12,
          }}>
            Cost-per-appointment calculator.
          </h2>
          <p style={{ fontSize: 16, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
            Plug in your industry, monthly budget, and deal size. We'll show
            you the math — single-channel benchmark vs. Koto's multi-channel blend.
          </p>
        </div>

        <div className="cpl-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 28, alignItems: 'flex-start' }}>
          {/* INPUTS */}
          <div style={{
            background: SURFACE, border: `1px solid ${HAIR}`, borderRadius: 16,
            padding: '28px 26px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 20, fontFamily: FH }}>
              Your inputs
            </div>

            {/* Industry */}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 8 }}>
              Industry
            </label>
            <select value={industryId} onChange={e => setIndustryId(e.target.value)} style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${HAIR}`,
              fontSize: 14, fontFamily: FB, color: INK, background: W, outline: 'none', marginBottom: 22,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              backgroundSize: '16px',
            }}>
              {INDUSTRIES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>

            {/* Budget */}
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 8 }}>
              <span>Monthly marketing budget</span>
              <span style={{ color: R }}>{fmt(budget)}</span>
            </label>
            <input type="range" min="1000" max="50000" step="500" value={budget} onChange={e => setBudget(Number(e.target.value))}
              style={{ width: '100%', accentColor: R, marginBottom: 22 }} />

            {/* ACV */}
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 8 }}>
              <span>Avg. value per closed customer</span>
              <span style={{ color: R }}>{fmt(acv)}</span>
            </label>
            <input type="range" min="250" max="50000" step="250" value={acv} onChange={e => setAcv(Number(e.target.value))}
              style={{ width: '100%', accentColor: R, marginBottom: 8 }} />

            <div style={{ fontSize: 11, color: FAINT, fontFamily: FB, marginTop: 14, lineHeight: 1.55 }}>
              Benchmarks drawn from public industry demand-gen reports 2023–2025.
              Your real numbers vary — this is a directional estimate, not a promise.
            </div>
          </div>

          {/* RESULTS */}
          <div style={{
            background: W, border: `1.5px solid ${INK}`, borderRadius: 16,
            padding: '28px 26px', position: 'relative', overflow: 'hidden',
          }}>
            <div aria-hidden="true" style={{
              position: 'absolute', top: -60, right: -60, width: 200, height: 200,
              borderRadius: '50%', background: R + '14', filter: 'blur(50px)',
            }} />

            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: INK, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 20, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color={R} /> Projected on Koto's multi-channel blend
              </div>

              {/* Big numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginBottom: 22 }}>
                <ResultBlock label="Qualified leads / mo"       value={fmtInt(results.leadsKoto)}         accent={R} />
                <ResultBlock label="Appointments / mo"           value={fmtInt(results.appointmentsKoto)}  accent={INK} />
                <ResultBlock label="Cost per appointment"        value={fmt(results.cpaKoto)}              accent={INK} />
                <ResultBlock label="Closed deals / mo"           value={fmtInt(results.dealsKoto)}         accent={GRN} />
              </div>

              {/* Revenue / ROI line */}
              <div style={{
                padding: '18px 20px', background: SURFACE, borderRadius: 12,
                border: `1px solid ${HAIR}`, marginBottom: 18,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 6 }}>
                  Projected monthly revenue
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 34, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK, lineHeight: 1 }}>
                    {fmt(results.revenueKoto)}
                  </span>
                  <span style={{ fontSize: 13, color: MUTED, fontFamily: FB }}>
                    · {Math.round(results.roiKoto * 100)}% ROI on spend
                  </span>
                </div>
              </div>

              {/* Comparison strip */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: SURFACE, borderRadius: 10,
                border: `1px solid ${HAIR}`, fontSize: 13, color: MUTED, fontFamily: FB, marginBottom: 22,
              }}>
                <div>Single-channel industry benchmark</div>
                <div style={{ color: INK, fontWeight: 700 }}>{fmt(results.revenueIndustry)} /mo</div>
              </div>

              {/* Email capture */}
              {!emailed ? (
                <form onSubmit={onEmailSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input type="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    style={{
                      flex: 1, minWidth: 200, border: `1px solid ${HAIR}`, outline: 'none',
                      padding: '12px 14px', fontSize: 14, fontFamily: FB, color: INK,
                      borderRadius: 8, background: W,
                    }} />
                  <button type="submit" disabled={loading || !email.trim()} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 18px', borderRadius: 8, border: 'none',
                    background: loading ? FAINT : INK,
                    color: W, fontSize: 13, fontWeight: 700, fontFamily: FH,
                    cursor: loading ? 'default' : 'pointer',
                    letterSpacing: '.01em',
                  }}>
                    {loading ? 'Sending…' : <>Email me the breakdown <ArrowRight size={13} /></>}
                  </button>
                </form>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: GRN + '12', border: `1.5px solid ${GRN}`,
                  borderRadius: 10,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: GRN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={14} color={W} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FH, color: INK }}>Sent.</div>
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: FB }}>Full breakdown plus a 20-min strategy-call invite in your inbox.</div>
                  </div>
                </div>
              )}
              {error && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#dc2626', fontFamily: FB }}>{error}</div>
              )}

              <div style={{ marginTop: 12, fontSize: 11, color: FAINT, fontFamily: FB }}>
                No spam. No newsletter. Email only used for this breakdown and an optional strategy call.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .cpl-pad  { padding: 56px 20px !important; }
          .cpl-h2   { font-size: 28px !important; }
          .cpl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}

function ResultBlock({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: accent, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}
