"use client"
import { useState, useCallback, useEffect } from 'react'
import { R, T, BLK, FH } from '../../lib/theme'

// ── Koto brand overrides (replaces Unified Marketing navy/pink) ──
const NAVY = '#111827'
const NAVY_DEEP = '#0a0e1a'
const PINK = R          // #E6007E
const PINK_DARK = '#c4006b'
const TEAL = T          // #00C2CB
const OFF_WHITE = '#f9fafb'
const BORDER = '#e5e7eb'
const TEXT = '#374151'
const TEXT_LIGHT = '#6b7280'
const MID = '#9ca3af'

// ── Formatters ──
function fmt(n) {
  if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (Math.abs(n) >= 10000) return '$' + Math.round(n / 1000) + 'K'
  return '$' + Math.round(n).toLocaleString('en-US')
}
function fmtFull(n) { return '$' + Math.round(n).toLocaleString('en-US') }
function fmtNum(n) { return Math.round(n).toLocaleString('en-US') }

// ── Shared sub-components ──
function FieldGroup({ label, hint, prefix, suffix, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: NAVY, marginBottom: 10 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: MID, fontSize: 11 }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, prefix, suffix, min, max, step, style: extraStyle }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && <span style={{ position: 'absolute', left: 14, fontSize: 15, color: MID, pointerEvents: 'none', fontWeight: 500 }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        style={{
          width: '100%', background: OFF_WHITE, border: `1px solid ${BORDER}`,
          padding: `13px ${suffix ? 38 : 14}px 13px ${prefix ? 30 : 14}px`,
          fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: NAVY,
          outline: 'none', WebkitAppearance: 'none', MozAppearance: 'textfield',
          borderRadius: 0, transition: 'border-color .2s, box-shadow .2s',
          ...extraStyle
        }}
        onFocus={e => { e.target.style.borderColor = PINK; e.target.style.boxShadow = `0 0 0 3px ${PINK}14` }}
        onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
      />
      {suffix && <span style={{ position: 'absolute', right: 14, fontSize: 13, color: MID, pointerEvents: 'none', fontWeight: 500 }}>{suffix}</span>}
    </div>
  )
}

function SliderRow({ value, onChange, min, max, step, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 110, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step}
          style={{
            width: '100%', background: OFF_WHITE, border: `1px solid ${BORDER}`,
            padding: '13px 26px 13px 14px', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: NAVY,
            outline: 'none', WebkitAppearance: 'none', MozAppearance: 'textfield', borderRadius: 0,
          }}
        />
        {suffix && <span style={{ position: 'absolute', right: 10, fontSize: 13, color: MID, pointerEvents: 'none' }}>{suffix}</span>}
      </div>
      <input
        type="range" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        style={{ flex: 1, height: 3, accentColor: PINK, cursor: 'pointer' }}
      />
    </div>
  )
}

function ResultPrimary({ label, value, note }) {
  return (
    <div style={{ background: PINK, padding: '28px 32px', marginBottom: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 8 }}>{note}</div>}
    </div>
  )
}

function ResultCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.05)', padding: '18px 20px', borderTop: '2px solid transparent', transition: 'border-color .25s' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 8, lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 34, fontWeight: 900, color: color || '#fff', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function MiniLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: MID, marginBottom: 18, marginTop: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'block', width: 20, height: 1, background: BORDER }} />
      {children}
    </div>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '24px 0' }} />
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function UnifiedCalculator({ reportData, reportInputs }) {
  const [activeTab, setActiveTab] = useState(0)

  // ── Pre-fill from tech stack assessment (Claude estimates based on detected tools) ──
  const tsa = reportData?.tech_stack_assessment || {}
  const avgJobVal = parseInt(String(reportInputs?.avg_job_value || '500').replace(/\D/g, '')) || 500
  const estCloseRate = tsa.estimated_close_rate || (reportData?.metrics?.lead_to_close_rate?.value ? parseInt(reportData.metrics.lead_to_close_rate.value) : null) || 30
  const estCPC = tsa.estimated_cpc || 5
  const estCVR = tsa.estimated_conversion_rate || 5
  const estAdSpend = tsa.estimated_monthly_ad_spend || parseInt(String(reportInputs?.budget || '3000').replace(/\D/g, '')) || 3000

  const [shared, setShared] = useState({
    revenue: avgJobVal,
    closeRate: estCloseRate,
    cpc: estCPC,
    cvr: estCVR,
    adSpend: estAdSpend,
  })

  // ── Tab 1: Local SEO inputs (pre-filled from scan data) ──
  const estLeads = reportData?.metrics?.est_monthly_leads?.value || 50
  const [t1, setT1] = useState({
    calls: Math.round(estLeads * 0.6),  // 60% of leads typically come via calls
    callRate: estCloseRate,
    visits: Math.round(estLeads * 3),    // ~3x traffic-to-lead ratio
    visitRate: estCVR,
    seoCost: 1500,
    ppcCost: tsa.has_ad_pixels ? Math.round(estAdSpend * 0.6) : 0,
    socialCost: tsa.has_ad_pixels ? Math.round(estAdSpend * 0.2) : 0,
  })

  // ── Tab 2: Ads budget inputs ──
  const [t2, setT2] = useState({
    targetRevenue: 10000,
    targetConversions: 20,
  })

  // ── Tab 3: PPC efficiency inputs ──
  const [t3, setT3] = useState({
    currentCPA: 150,
    reduction: 20,
  })

  const upShared = useCallback((k, v) => setShared(p => ({ ...p, [k]: v })), [])
  const upT1 = useCallback((k, v) => setT1(p => ({ ...p, [k]: v })), [])
  const upT2 = useCallback((k, v) => setT2(p => ({ ...p, [k]: v })), [])
  const upT3 = useCallback((k, v) => setT3(p => ({ ...p, [k]: v })), [])

  // ═══ CALCULATIONS ═══

  // Tab 1: Local SEO ROI
  const fromCalls = t1.calls * (t1.callRate / 100)
  const fromVisits = t1.visits * (t1.visitRate / 100)
  const t1TotalCust = Math.ceil(fromCalls + fromVisits)
  const t1Revenue = t1TotalCust * shared.revenue
  const t1TotalCost = t1.seoCost + t1.ppcCost + t1.socialCost
  const t1Net = t1Revenue - t1TotalCost
  const t1ROI = t1TotalCost > 0 ? ((t1Revenue - t1TotalCost) / t1TotalCost) * 100 : 0

  // Tab 2: Ads Budget Planner
  const t2CPA = shared.cvr > 0 ? shared.cpc / (shared.cvr / 100) : 0
  const t2ReqBudget = t2CPA * t2.targetConversions
  const t2ReqClicks = shared.cvr > 0 ? t2.targetConversions / (shared.cvr / 100) : 0
  const t2ClosedCust = t2.targetConversions * (shared.closeRate / 100)
  const t2AdRevenue = t2ClosedCust * shared.revenue
  const t2NetRev = t2AdRevenue - t2ReqBudget
  const t2ROAS = t2ReqBudget > 0 ? t2AdRevenue / t2ReqBudget : 0

  // Tab 3: PPC Efficiency
  const t3CurConv = t3.currentCPA > 0 ? shared.adSpend / t3.currentCPA : 0
  const t3CurCust = t3CurConv * (shared.closeRate / 100)
  const t3CurRev = t3CurCust * shared.revenue
  const t3NewCPA = t3.currentCPA * (1 - t3.reduction / 100)
  const t3NewConvA = t3NewCPA > 0 ? shared.adSpend / t3NewCPA : 0
  const t3ExtraConv = t3NewConvA - t3CurConv
  const t3Lift = t3CurConv > 0 ? (t3ExtraConv / t3CurConv) * 100 : 0
  const t3NewCustA = t3NewConvA * (shared.closeRate / 100)
  const t3NewRevA = t3NewCustA * shared.revenue
  const t3RevGainA = t3NewRevA - t3CurRev
  const t3NewSpendB = t3NewCPA * t3CurConv
  const t3SavingsB = shared.adSpend - t3NewSpendB

  // ── Tab bar config ──
  const tabs = [
    { num: '01', title: 'Google Maps & Local SEO ROI', sub: 'Maps calls + visits → revenue & ROI' },
    { num: '02', title: 'Google Ads Budget Planner', sub: 'Set your revenue goal → get your budget' },
    { num: '03', title: 'PPC Efficiency & ROI Improvement', sub: 'CPA reduction → dollars saved or gained' },
  ]

  const panelInputs = { background: '#fff', padding: '36px 40px' }
  const panelResults = { background: NAVY, padding: '36px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}`, background: OFF_WHITE }}>

      {/* ── Section Header ── */}
      <div style={{ padding: '32px 40px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PINK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 32, height: 1, background: PINK, display: 'block' }} />
          ROI Calculator Suite
        </div>
        <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: BLK, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
          THREE TOOLS. EVERY CHANNEL.<br /><span style={{ color: PINK }}>ONE COMPLETE PICTURE.</span>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: TEXT, marginTop: 12, maxWidth: 700 }}>
          Enter your numbers once in the shared fields below, then use each tab to see your ROI, required budget, and efficiency opportunity. Everything updates in real time.
        </p>
      </div>

      {/* ── Shared Inputs Strip ── */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderBottom: 'none', margin: '0 -1px', padding: '20px 40px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'end' }}>
        <div style={{ gridColumn: '1/-1', fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: MID, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 20, height: 1, background: BORDER, display: 'block' }} />
          Shared Inputs — used across all three calculators
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: NAVY, marginBottom: 8 }}>Revenue Per Customer<span style={{ display: 'block', fontWeight: 400, textTransform: 'none', color: MID, fontSize: 10, marginTop: 2 }}>Avg sale or LTV</span></div>
          <NumInput value={shared.revenue} onChange={v => upShared('revenue', v)} prefix="$" min={0} step={50} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: NAVY, marginBottom: 8 }}>Lead→Customer Rate<span style={{ display: 'block', fontWeight: 400, textTransform: 'none', color: MID, fontSize: 10, marginTop: 2 }}>% of leads who buy</span></div>
          <NumInput value={shared.closeRate} onChange={v => upShared('closeRate', v)} suffix="%" min={0} max={100} step={1} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: NAVY, marginBottom: 8 }}>Cost Per Click<span style={{ display: 'block', fontWeight: 400, textTransform: 'none', color: MID, fontSize: 10, marginTop: 2 }}>Google Ads avg CPC</span></div>
          <NumInput value={shared.cpc} onChange={v => upShared('cpc', v)} prefix="$" min={0.01} step={0.25} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: NAVY, marginBottom: 8 }}>Landing Page Conv. Rate<span style={{ display: 'block', fontWeight: 400, textTransform: 'none', color: MID, fontSize: 10, marginTop: 2 }}>% of clicks → leads</span></div>
          <NumInput value={shared.cvr} onChange={v => upShared('cvr', v)} suffix="%" min={0} max={100} step={0.5} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: NAVY, marginBottom: 8 }}>Monthly Ad Spend<span style={{ display: 'block', fontWeight: 400, textTransform: 'none', color: MID, fontSize: 10, marginTop: 2 }}>Total paid budget</span></div>
          <NumInput value={shared.adSpend} onChange={v => upShared('adSpend', v)} prefix="$" min={0} step={100} />
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: `${NAVY}26` }}>
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              background: activeTab === i ? NAVY : `${NAVY}0a`,
              padding: '18px 28px', cursor: 'pointer', border: 'none', textAlign: 'left',
              borderTop: `3px solid ${activeTab === i ? PINK : 'transparent'}`,
              transition: 'background .2s',
            }}
          >
            <div style={{ fontFamily: FH, fontSize: 11, letterSpacing: '2px', color: PINK, marginBottom: 4, fontWeight: 700 }}>{t.num}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: activeTab === i ? '#fff' : NAVY, marginBottom: 3, lineHeight: 1.2 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: activeTab === i ? 'rgba(255,255,255,.5)' : MID, lineHeight: 1.3 }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* ═══ PANEL 1: LOCAL SEO / MAPS ROI ═══ */}
      {activeTab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: `${NAVY}1a` }}>
          <div style={panelInputs}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: NAVY, marginBottom: 6 }}>Local SEO Inputs</div>
            <div style={{ fontSize: 13, color: TEXT_LIGHT, marginBottom: 28 }}>Your Google Maps performance numbers. Adjust any field — results update instantly.</div>

            <MiniLabel>Google Maps Traffic</MiniLabel>

            <FieldGroup label="Monthly Calls from Google Maps" hint="From GBP / Maps listing">
              <NumInput value={t1.calls} onChange={v => upT1('calls', v)} suffix="#" min={0} />
            </FieldGroup>
            <FieldGroup label="Call Closing Rate" hint="% of calls → customers">
              <SliderRow value={t1.callRate} onChange={v => upT1('callRate', v)} min={0} max={100} step={1} suffix="%" />
            </FieldGroup>
            <FieldGroup label="Monthly Website Visits from Maps" hint="Click-throughs from GBP">
              <NumInput value={t1.visits} onChange={v => upT1('visits', v)} suffix="#" min={0} />
            </FieldGroup>
            <FieldGroup label="Website Conversion Rate" hint="% of visitors → leads">
              <SliderRow value={t1.visitRate} onChange={v => upT1('visitRate', v)} min={0} max={100} step={0.5} suffix="%" />
            </FieldGroup>

            <Divider />
            <MiniLabel>Monthly Investment</MiniLabel>

            <FieldGroup label="SEO Retainer" hint="Local SEO management fee">
              <NumInput value={t1.seoCost} onChange={v => upT1('seoCost', v)} prefix="$" min={0} step={100} />
            </FieldGroup>
            <FieldGroup label="Google PPC Budget" hint="Monthly Google Ads spend">
              <NumInput value={t1.ppcCost} onChange={v => upT1('ppcCost', v)} prefix="$" min={0} step={100} />
            </FieldGroup>
            <FieldGroup label="Social Media Ads Budget" hint="Monthly Meta / social spend">
              <NumInput value={t1.socialCost} onChange={v => upT1('socialCost', v)} prefix="$" min={0} step={100} />
            </FieldGroup>
          </div>

          <div style={panelResults}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: '#fff', marginBottom: 6 }}>Your Maps Revenue Potential</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 28 }}>Updates instantly as you type</div>
            </div>
            <div>
              <ResultPrimary label="Monthly Revenue from Google Maps" value={fmtFull(t1Revenue)} note="From calls + website visits combined" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 2 }}>
                <ResultCell label="Customers from Calls" value={Math.ceil(fromCalls)} />
                <ResultCell label="Customers from Visits" value={Math.ceil(fromVisits)} />
                <ResultCell label="Total New Customers" value={t1TotalCust} />
                <ResultCell label="Blended ROI" value={t1TotalCost > 0 ? `${t1ROI >= 0 ? '+' : ''}${Math.round(t1ROI)}%` : '—'} color={t1ROI >= 0 ? '#fff' : '#ff8fa3'} />
              </div>

              {/* Investment breakdown */}
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '16px 20px', marginTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Total Monthly Investment</div>
                  <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,.55)' }}>{fmtFull(t1TotalCost)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, marginBottom: 12 }}>
                  {[['SEO', t1.seoCost], ['PPC', t1.ppcCost], ['Social', t1.socialCost]].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,.05)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,.7)' }}>{fmtFull(v)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Net Revenue After All Investment</div>
                  <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: t1Net >= 0 ? '#fff' : '#ff8fa3' }}>{fmtFull(t1Net)}</div>
                </div>
              </div>

              {/* Projections */}
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                {[
                  { label: '3 MONTHS', rev: t1Revenue * 3, cost: t1TotalCost * 3 },
                  { label: '6 MONTHS', rev: t1Revenue * 6, cost: t1TotalCost * 6 },
                  { label: '12 MONTHS', rev: t1Revenue * 12, cost: t1TotalCost * 12 },
                ].map((p, i) => {
                  const roi = p.cost > 0 ? Math.round(((p.rev - p.cost) / p.cost) * 100) : 0
                  return (
                    <div key={i} style={{ background: i === 2 ? PINK + '30' : 'rgba(255,255,255,.04)', padding: '14px 16px', borderTop: `2px solid ${i === 2 ? PINK : 'transparent'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: i === 2 ? PINK : 'rgba(255,255,255,.35)', marginBottom: 6 }}>{p.label}</div>
                      <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmt(p.rev)}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 6 }}>ROI: {p.cost > 0 ? `${roi}%` : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PANEL 2: GOOGLE ADS BUDGET PLANNER ═══ */}
      {activeTab === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: `${NAVY}1a` }}>
          <div style={panelInputs}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: NAVY, marginBottom: 6 }}>Ads Budget Inputs</div>
            <div style={{ fontSize: 13, color: TEXT_LIGHT, marginBottom: 28 }}>Work backwards from your revenue goal to find the exact monthly spend required.</div>

            <MiniLabel>Revenue Goal</MiniLabel>

            <FieldGroup label="Desired Monthly Revenue from Ads" hint="Your PPC revenue target">
              <NumInput value={t2.targetRevenue} onChange={v => upT2('targetRevenue', v)} prefix="$" min={0} step={500} />
            </FieldGroup>
            <FieldGroup label="Desired Monthly Conversions" hint="Leads / form fills / calls">
              <NumInput value={t2.targetConversions} onChange={v => upT2('targetConversions', v)} suffix="#" min={1} step={1} />
            </FieldGroup>

            <Divider />
            <MiniLabel>Your Current PPC Performance</MiniLabel>

            <FieldGroup label="Cost Per Click" hint="Synced from shared inputs">
              <NumInput value={shared.cpc} onChange={v => upShared('cpc', v)} prefix="$" min={0.01} step={0.25} />
            </FieldGroup>
            <FieldGroup label="Landing Page Conversion Rate" hint="Synced from shared inputs">
              <SliderRow value={shared.cvr} onChange={v => upShared('cvr', v)} min={0} max={100} step={0.5} suffix="%" />
            </FieldGroup>
            <FieldGroup label="Lead → Customer Rate" hint="Synced from shared inputs">
              <SliderRow value={shared.closeRate} onChange={v => upShared('closeRate', v)} min={0} max={100} step={1} suffix="%" />
            </FieldGroup>
            <FieldGroup label="Revenue Per Customer" hint="Synced from shared inputs">
              <NumInput value={shared.revenue} onChange={v => upShared('revenue', v)} prefix="$" min={0} step={50} />
            </FieldGroup>
          </div>

          <div style={panelResults}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: '#fff', marginBottom: 6 }}>Your Required Ad Budget</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 28 }}>To hit your revenue target at current rates</div>
            </div>
            <div>
              <ResultPrimary label="Required Monthly Budget" value={fmtFull(t2ReqBudget)} note="To reach your conversion & revenue goals" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 2 }}>
                <ResultCell label="Required Clicks / Mo" value={fmtNum(Math.ceil(t2ReqClicks))} />
                <ResultCell label="Cost Per Conversion" value={t2CPA > 0 ? fmtFull(t2CPA) : '$0'} />
                <ResultCell label="Closed Customers / Mo" value={Math.ceil(t2ClosedCust)} />
                <ResultCell label="Revenue from Ads / Mo" value={fmt(t2AdRevenue)} />
              </div>

              {/* Net revenue + ROAS */}
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '16px 20px', marginTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Net Revenue After Ad Spend</div>
                  <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: t2NetRev >= 0 ? '#fff' : '#ff8fa3' }}>{fmtFull(t2NetRev)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Return on Ad Spend (ROAS)</div>
                  <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: t2ROAS >= 2 ? '#fff' : t2ROAS > 0 ? '#ffd080' : 'rgba(255,255,255,.55)' }}>{t2ROAS > 0 ? `${t2ROAS.toFixed(1)}x` : '—'}</div>
                </div>
              </div>

              {/* 12-month outlook */}
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '16px 20px', marginTop: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>12-Month Outlook</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Annual Revenue from Ads</div>
                  <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: '#fff' }}>{fmt(t2AdRevenue * 12)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Annual Ad Spend</div>
                  <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,.4)' }}>{fmt(t2ReqBudget * 12)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PANEL 3: PPC EFFICIENCY / ROI IMPROVEMENT ═══ */}
      {activeTab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: `${NAVY}1a` }}>
          <div style={panelInputs}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: NAVY, marginBottom: 6 }}>Current PPC Performance</div>
            <div style={{ fontSize: 13, color: TEXT_LIGHT, marginBottom: 28 }}>See what a {t3.reduction}% improvement in cost-per-conversion means for your account.</div>

            <MiniLabel>Current Account Numbers</MiniLabel>

            <FieldGroup label="Monthly Ad Spend" hint="Synced from shared inputs">
              <NumInput value={shared.adSpend} onChange={v => upShared('adSpend', v)} prefix="$" min={0} step={100} />
            </FieldGroup>
            <FieldGroup label="Current Cost Per Conversion (CPA)" hint="What you pay per lead now">
              <NumInput value={t3.currentCPA} onChange={v => upT3('currentCPA', v)} prefix="$" min={1} step={1} />
            </FieldGroup>
            <FieldGroup label="Lead → Customer Rate" hint="Synced from shared inputs">
              <SliderRow value={shared.closeRate} onChange={v => upShared('closeRate', v)} min={0} max={100} step={1} suffix="%" />
            </FieldGroup>
            <FieldGroup label="Revenue Per Customer" hint="Synced from shared inputs">
              <NumInput value={shared.revenue} onChange={v => upShared('revenue', v)} prefix="$" min={0} step={50} />
            </FieldGroup>

            <Divider />
            <MiniLabel>Improvement Assumption</MiniLabel>

            <FieldGroup label="Expected CPA Reduction">
              <div>
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: PINK, marginBottom: 6 }}>{t3.reduction}%</div>
                <input
                  type="range" value={t3.reduction} onChange={e => upT3('reduction', parseInt(e.target.value))}
                  min={10} max={50} step={5}
                  style={{ width: '100%', height: 3, accentColor: PINK, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MID, marginTop: 4 }}>
                  <span>10%</span><span>50%</span>
                </div>
              </div>
            </FieldGroup>
          </div>

          <div style={panelResults}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: '1px', color: '#fff', marginBottom: 6 }}>Your Improvement Scenarios</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 28 }}>Two ways a lower CPA pays off</div>
            </div>
            <div>
              {/* Current Snapshot */}
              <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', padding: '16px 20px', marginBottom: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Current Snapshot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  {[
                    ['Conv/Mo', fmtNum(Math.ceil(t3CurConv))],
                    ['Current CPA', fmtFull(t3.currentCPA)],
                    ['Rev/Mo', fmt(t3CurRev)],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,.7)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenario A */}
              <div style={{ marginBottom: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(255,255,255,.07)', padding: '8px 14px', color: 'rgba(255,255,255,.5)', borderLeft: `3px solid ${PINK}` }}>
                  SCENARIO A — Same Budget · Lower CPA · More Customers
                </div>
                <div style={{ background: PINK, padding: '20px 24px', marginBottom: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 8 }}>Additional Revenue Per Month</div>
                  <div style={{ fontFamily: FH, fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmtFull(t3RevGainA)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>+{fmt(t3RevGainA * 12)} over 12 months</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 2 }}>
                  <ResultCell label="New CPA" value={fmtFull(t3NewCPA)} />
                  <ResultCell label="New Conv/Mo" value={fmtNum(Math.ceil(t3NewConvA))} />
                  <ResultCell label="Extra Conv/Mo" value={`+${fmtNum(Math.ceil(t3ExtraConv))}`} />
                  <ResultCell label="Conv Lift" value={`+${Math.round(t3Lift)}%`} />
                </div>
              </div>

              {/* Scenario B */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(255,255,255,.07)', padding: '8px 14px', color: 'rgba(255,255,255,.5)', borderLeft: '3px solid rgba(255,255,255,.3)' }}>
                  SCENARIO B — Same Conversions · Lower Spend · More Savings
                </div>
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>Monthly Spend Savings</div>
                    <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: '#fff' }}>{fmtFull(t3SavingsB)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 4 }}>
                    <div style={{ background: 'rgba(255,255,255,.04)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>New Spend/Mo</div>
                      <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,.6)' }}>{fmtFull(t3NewSpendB)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.04)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>Annual Savings</div>
                      <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,.6)' }}>{fmt(t3SavingsB * 12)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
