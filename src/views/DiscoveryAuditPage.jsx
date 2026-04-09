"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertOctagon, AlertTriangle, ArrowLeft, Brain, Check, CheckCircle2, ChevronRight,
  Clock, Download, FileSignature, FileText, Loader2, Printer, Sparkles, Target, TrendingUp, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  borderMd: '#d1d5db',
  red: '#E6007E',
  redSoft: '#FEE2E2',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  yellow: '#EAB308',
  yellowSoft: '#FEFCE8',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  tealDark: '#0E7490',
  blue: '#3A7BD5',
  blueSoft: '#EFF6FF',
}

const NAV_SECTIONS = [
  { id: 'exec', label: 'Executive Summary', icon: FileText },
  { id: 'health', label: 'Health Score', icon: TrendingUp },
  { id: 'findings', label: 'Critical Findings', icon: AlertOctagon },
  { id: 'opps', label: 'Opportunities', icon: Sparkles },
  { id: 'tech', label: 'Technology Audit', icon: Zap },
  { id: 'leadgen', label: 'Lead Generation', icon: Target },
  { id: 'crm', label: 'CRM & Automation', icon: Brain },
  { id: 'seo', label: 'Content & SEO', icon: FileText },
  { id: 'roadmap', label: '90-Day Roadmap', icon: Clock },
  { id: 'invest', label: 'Investment Summary', icon: TrendingUp },
]

export default function DiscoveryAuditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [eng, setEng] = useState(null)
  const [activeSection, setActiveSection] = useState('exec')
  const sectionRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/discovery/audit?action=get_audit&id=${id}`).then(r => r.json()).catch(() => null)
    if (res?.data) setEng(res.data)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Scroll-spy
  useEffect(() => {
    if (!eng?.audit_data) return
    const handler = () => {
      const scrollY = window.scrollY + 160
      let current = 'exec'
      for (const nav of NAV_SECTIONS) {
        const el = sectionRefs.current[nav.id]
        if (el && el.offsetTop <= scrollY) current = nav.id
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [eng])

  function scrollTo(secId) {
    const el = sectionRefs.current[secId]
    if (el) window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        <Loader2 size={30} className="anim-spin" color={C.teal} />
        <div style={{ marginTop: 10, color: C.muted }}>Loading audit…</div>
      </div>
    )
  }

  if (!eng || !eng.audit_data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        <AlertTriangle size={30} color={C.amber} />
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 10 }}>
          No audit available yet
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          Go back to the discovery engagement and click "Generate Audit" to create one.
        </div>
        <button
          onClick={() => navigate('/discovery')}
          style={{
            marginTop: 16, background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >Back to Discovery</button>
      </div>
    )
  }

  const a = eng.audit_data

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 24px', fontFamily: 'var(--font-body)' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <Header eng={eng} onBack={() => navigate(-1)} navigate={navigate} />

        {/* Layout: sticky nav + main */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginTop: 18, alignItems: 'flex-start' }}>
          <StickyNav active={activeSection} onSelect={scrollTo} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionWrap id="exec" title="Executive Summary" innerRef={el => (sectionRefs.current.exec = el)}>
              <ExecutiveSummary text={a.executive_summary} />
            </SectionWrap>

            <SectionWrap id="health" title="Business Health Score" innerRef={el => (sectionRefs.current.health = el)}>
              <BusinessHealth data={a.business_health_score} />
            </SectionWrap>

            <SectionWrap id="findings" title="Critical Findings" innerRef={el => (sectionRefs.current.findings = el)}>
              <CriticalFindings findings={a.critical_findings} />
            </SectionWrap>

            <SectionWrap id="opps" title="Opportunities" innerRef={el => (sectionRefs.current.opps = el)}>
              <Opportunities opps={a.opportunities} />
            </SectionWrap>

            <SectionWrap id="tech" title="Technology Audit" innerRef={el => (sectionRefs.current.tech = el)}>
              <TechAudit audit={a.technology_audit} />
            </SectionWrap>

            <SectionWrap id="leadgen" title="Lead Generation Plan" innerRef={el => (sectionRefs.current.leadgen = el)}>
              <LeadGenPlan plan={a.lead_generation_plan} />
            </SectionWrap>

            <SectionWrap id="crm" title="CRM & Automation Plan" innerRef={el => (sectionRefs.current.crm = el)}>
              <CrmPlan plan={a.crm_and_automation_plan} />
            </SectionWrap>

            <SectionWrap id="seo" title="Content & SEO Plan" innerRef={el => (sectionRefs.current.seo = el)}>
              <SeoPlan plan={a.content_and_seo_plan} />
            </SectionWrap>

            <SectionWrap id="roadmap" title="90-Day Roadmap" innerRef={el => (sectionRefs.current.roadmap = el)}>
              <Roadmap roadmap={a.ninety_day_roadmap} />
            </SectionWrap>

            <SectionWrap id="invest" title="Investment Summary" innerRef={el => (sectionRefs.current.invest = el)}>
              <InvestSummary data={a.investment_summary} />
            </SectionWrap>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Header with circular health gauge
// ─────────────────────────────────────────────────────────────
function Header({ eng, onBack, navigate }) {
  const overall = eng.audit_data?.business_health_score?.overall ?? 0
  const color = overall >= 71 ? C.green : overall >= 41 ? C.amber : C.red
  const date = eng.audit_generated_at ? new Date(eng.audit_generated_at).toLocaleString() : '—'
  const [busyProposal, setBusyProposal] = useState(false)

  async function createProposal() {
    setBusyProposal(true)
    const loadingToast = toast.loading('Building proposal from audit…')
    try {
      const res = await fetch('/api/discovery/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_proposal_from_audit', engagement_id: eng.id }),
      }).then(r => r.json())
      toast.dismiss(loadingToast)
      if (res?.data?.proposal_id) {
        toast.success('Proposal created')
        navigate(`/proposals/${res.data.proposal_id}`)
      } else {
        toast.error(res?.error || 'Failed to create proposal')
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      toast.error('Proposal request failed')
    } finally {
      setBusyProposal(false)
    }
  }

  return (
    <div style={{
      background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 20,
    }}>
      <button
        onClick={onBack}
        style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          color: C.text, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <ArrowLeft size={13} /> Back
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={22} color={C.teal} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Strategic Discovery Audit
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
              {eng.client_name}
            </h1>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {eng.client_industry || 'No industry'} · Generated {date}
            </div>
          </div>
        </div>
      </div>

      {/* Circular gauge */}
      <CircularGauge value={overall} color={color} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={createProposal}
          disabled={busyProposal}
          style={{
            background: C.teal, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 700,
            cursor: busyProposal ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: busyProposal ? 0.7 : 1,
          }}
        >
          {busyProposal
            ? <Loader2 size={13} className="anim-spin" />
            : <FileSignature size={13} />}
          {busyProposal ? 'Building…' : 'Create Proposal'}
        </button>
        <button
          onClick={() => window.print()}
          style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            color: C.text, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Printer size={13} /> Print / Export
        </button>
      </div>
    </div>
  )
}

function CircularGauge({ value, color }) {
  const size = 100
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {Math.round(value)}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
          Health
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sticky left nav
// ─────────────────────────────────────────────────────────────
function StickyNav({ active, onSelect }) {
  return (
    <div style={{
      position: 'sticky', top: 12, background: C.white, borderRadius: 12,
      border: `1px solid ${C.border}`, padding: 10, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase',
        letterSpacing: '.08em', padding: '6px 10px 8px',
      }}>
        Audit Sections
      </div>
      {NAV_SECTIONS.map((nav, i) => {
        const Icon = nav.icon
        const isActive = active === nav.id
        return (
          <div
            key={nav.id}
            onClick={() => onSelect(nav.id)}
            style={{
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
              background: isActive ? C.tealSoft : 'transparent',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: isActive ? C.tealDark : C.text,
              borderLeft: isActive ? `3px solid ${C.teal}` : '3px solid transparent',
            }}
          >
            <Icon size={13} />
            <div style={{ flex: 1 }}>{nav.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────
function SectionWrap({ id, title, innerRef, children }) {
  return (
    <div
      id={`section-${id}`}
      ref={innerRef}
      style={{
        background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: '24px 28px',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
        letterSpacing: '.08em', marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 1. Executive Summary
// ─────────────────────────────────────────────────────────────
function ExecutiveSummary({ text }) {
  if (!text) return <div style={{ color: C.muted, fontSize: 14 }}>No executive summary.</div>
  const paras = String(text).split(/\n\n+/).filter(Boolean)
  return (
    <div>
      {paras.map((p, i) => (
        <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: C.mutedDark, marginTop: i === 0 ? 8 : 14 }}>
          {p}
        </p>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. Business Health Score breakdown
// ─────────────────────────────────────────────────────────────
function BusinessHealth({ data }) {
  if (!data) return <div style={{ color: C.muted, fontSize: 14 }}>No health data.</div>
  const breakdown = Array.isArray(data.breakdown) ? data.breakdown : []
  return (
    <div>
      <div style={{ fontSize: 14, color: C.mutedDark, marginBottom: 14 }}>
        Overall health score: <strong style={{ color: C.text, fontSize: 18 }}>{data.overall}/100</strong>
      </div>
      {breakdown.map((b, i) => {
        const score = Math.max(0, Math.min(100, b.score || 0))
        const color = score >= 71 ? C.green : score >= 41 ? C.amber : C.red
        return (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.category}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{score}/100</div>
            </div>
            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score}%`, background: color, transition: 'width .6s ease-out' }} />
            </div>
            {b.rationale && <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{b.rationale}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. Critical Findings
// ─────────────────────────────────────────────────────────────
function CriticalFindings({ findings }) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return <div style={{ color: C.muted, fontSize: 14 }}>No critical findings.</div>
  }
  const groups = { critical: [], high: [], medium: [] }
  for (const f of findings) {
    const sev = f.severity || 'medium'
    if (groups[sev]) groups[sev].push(f)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {['critical', 'high', 'medium'].map(sev => {
        if (groups[sev].length === 0) return null
        const palette = sev === 'critical'
          ? { bg: C.redSoft, border: '#FCA5A5', fg: '#991B1B' }
          : sev === 'high'
            ? { bg: C.amberSoft, border: '#FCD34D', fg: '#92400E' }
            : { bg: C.yellowSoft, border: '#FDE68A', fg: '#854D0E' }
        return (
          <div key={sev}>
            <div style={{ fontSize: 11, fontWeight: 800, color: palette.fg, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {sev} ({groups[sev].length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups[sev].map((f, i) => (
                <div key={i} style={{
                  background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: palette.fg, color: '#fff', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {sev}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: palette.fg, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {f.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{f.finding}</div>
                  {f.impact && <div style={{ fontSize: 13, color: C.mutedDark, marginBottom: 6 }}><strong>Impact:</strong> {f.impact}</div>}
                  {f.evidence && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}><strong>Evidence:</strong> {f.evidence}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 4. Opportunities (filterable + expandable)
// ─────────────────────────────────────────────────────────────
function Opportunities({ opps }) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  if (!Array.isArray(opps) || opps.length === 0) {
    return <div style={{ color: C.muted, fontSize: 14 }}>No opportunities identified.</div>
  }
  const filtered = filter === 'all' ? opps : opps.filter(o => o.priority === filter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['all', 'immediate', 'short_term', 'long_term'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f ? C.text : C.white,
              color: filter === f ? '#fff' : C.mutedDark,
              border: filter === f ? 'none' : `1px solid ${C.border}`,
              textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((o, i) => {
          const prio = o.priority
          const prioColor = prio === 'immediate' ? C.red : prio === 'short_term' ? C.amber : C.blue
          const prioBg = prio === 'immediate' ? C.redSoft : prio === 'short_term' ? C.amberSoft : C.blueSoft
          const effortColor = o.estimated_effort === 'low' ? C.green : o.estimated_effort === 'medium' ? C.amber : C.red
          const isExp = expanded[i]

          return (
            <div key={i} style={{
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 10,
                  background: prioBg, color: prioColor, textTransform: 'uppercase', letterSpacing: '.05em',
                }}>
                  {String(prio).replace('_', ' ')}
                </span>
                {o.estimated_effort && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: '#f3f4f6', color: effortColor, textTransform: 'uppercase',
                  }}>
                    {o.estimated_effort} effort
                  </span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>{o.title}</div>
              <div style={{ fontSize: 14, color: C.mutedDark, lineHeight: 1.55, marginBottom: 10 }}>{o.description}</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 10 }}>
                {o.estimated_impact && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                      Estimated Impact
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginTop: 2 }}>{o.estimated_impact}</div>
                  </div>
                )}
                {o.revenue_potential && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                      Revenue Potential
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{o.revenue_potential}</div>
                  </div>
                )}
              </div>

              {Array.isArray(o.implementation_steps) && o.implementation_steps.length > 0 && (
                <>
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
                    style={{
                      background: 'none', border: 'none', color: C.teal, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {isExp ? 'Hide' : 'Show'} {o.implementation_steps.length} implementation steps <ChevronRight size={12} style={{ transform: isExp ? 'rotate(90deg)' : 'none' }} />
                  </button>
                  {isExp && (
                    <ol style={{ marginTop: 10, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {o.implementation_steps.map((step, j) => (
                        <li key={j} style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 5. Technology Audit
// ─────────────────────────────────────────────────────────────
function TechAudit({ audit }) {
  if (!Array.isArray(audit) || audit.length === 0) {
    return <div style={{ color: C.muted, fontSize: 14 }}>No tech audit.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {audit.map((cat, i) => (
        <div key={i} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', paddingTop: i > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>{cat.category}</div>
          {cat.current_state && (
            <div style={{ fontSize: 13, color: C.mutedDark, marginBottom: 10 }}>{cat.current_state}</div>
          )}
          {Array.isArray(cat.gaps) && cat.gaps.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.amber, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                Gaps
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cat.gaps.map((g, j) => (
                  <li key={j} style={{ fontSize: 13, color: C.mutedDark }}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(cat.recommendations) && cat.recommendations.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle}>Tool</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Est. Cost</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {cat.recommendations.map((r, j) => {
                  const prio = r.priority
                  const palette = prio === 'replace'
                    ? { bg: C.redSoft, fg: '#991B1B' }
                    : prio === 'add'
                      ? { bg: C.greenSoft, fg: C.green }
                      : prio === 'optimize'
                        ? { bg: C.blueSoft, fg: C.blue }
                        : { bg: '#f3f4f6', fg: C.muted }
                  const highlight = prio === 'replace'
                  return (
                    <tr key={j} style={{ borderTop: `1px solid ${C.border}`, background: highlight ? C.redSoft : 'transparent' }}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.tool}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                          background: palette.bg, color: palette.fg, textTransform: 'uppercase', letterSpacing: '.05em',
                        }}>
                          {prio}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: C.mutedDark }}>{r.estimated_cost || '—'}</td>
                      <td style={{ ...tdStyle, color: C.muted, fontSize: 12 }}>
                        {r.reason || r.implementation_notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

const thStyle = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: C.muted, padding: '8px 12px', textAlign: 'left' }
const tdStyle = { padding: '10px 12px', fontSize: 13, color: C.text, verticalAlign: 'top' }

// ─────────────────────────────────────────────────────────────
// 6. Lead Generation Plan
// ─────────────────────────────────────────────────────────────
function LeadGenPlan({ plan }) {
  if (!plan) return <div style={{ color: C.muted, fontSize: 14 }}>No lead gen plan.</div>
  const channels = Array.isArray(plan.recommended_channels) ? plan.recommended_channels : []
  const funnel = plan.funnel_analysis || {}
  const quickWins = Array.isArray(plan.quick_wins) ? plan.quick_wins : []

  return (
    <div>
      {plan.current_state_assessment && (
        <p style={{ fontSize: 14, color: C.mutedDark, lineHeight: 1.6, marginBottom: 18 }}>
          {plan.current_state_assessment}
        </p>
      )}

      {channels.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Recommended Channels</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
            {channels.map((c, i) => {
              const usageColor = {
                none: { bg: '#f3f4f6', fg: C.muted },
                underutilized: { bg: C.amberSoft, fg: C.amber },
                active: { bg: C.blueSoft, fg: C.blue },
                strong: { bg: C.greenSoft, fg: C.green },
              }[c.current_usage] || { bg: '#f3f4f6', fg: C.muted }
              return (
                <div key={i} style={{ background: '#fafafa', borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.channel}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: usageColor.bg, color: usageColor.fg, textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>
                      {c.current_usage}
                    </span>
                  </div>
                  {c.recommended_action && (
                    <div style={{ fontSize: 13, color: C.mutedDark, marginBottom: 6 }}>{c.recommended_action}</div>
                  )}
                  {c.expected_result && (
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 4 }}>
                      → {c.expected_result}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 8 }}>
                    <span>{c.timeline || '—'}</span>
                    <span style={{ fontWeight: 600 }}>{c.monthly_budget_range || '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {(funnel.top_of_funnel || funnel.middle_of_funnel || funnel.bottom_of_funnel || funnel.retention) && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Funnel Analysis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            <FunnelCol label="Top" value={funnel.top_of_funnel} color={C.blue} />
            <FunnelCol label="Middle" value={funnel.middle_of_funnel} color={C.teal} />
            <FunnelCol label="Bottom" value={funnel.bottom_of_funnel} color={C.green} />
            <FunnelCol label="Retention" value={funnel.retention} color={C.amber} />
          </div>
        </>
      )}

      {quickWins.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Quick Wins</div>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quickWins.map((q, i) => (
              <li key={i} style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>
                <strong style={{ color: C.text }}>{q.action}</strong>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {q.timeline && <span>⏱ {q.timeline}</span>}
                  {q.expected_result && <span style={{ marginLeft: 12, color: C.green }}>→ {q.expected_result}</span>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function FunnelCol({ label, value, color }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: 10, padding: 12, borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: C.mutedDark, lineHeight: 1.5 }}>{value || '—'}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 7. CRM & Automation Plan
// ─────────────────────────────────────────────────────────────
function CrmPlan({ plan }) {
  if (!plan) return <div style={{ color: C.muted, fontSize: 14 }}>No CRM plan.</div>
  const phases = Array.isArray(plan.implementation_phases) ? plan.implementation_phases : []
  const autos = Array.isArray(plan.automations_to_build) ? plan.automations_to_build : []

  return (
    <div>
      {plan.platform_recommendation && (
        <div style={{
          background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 10,
          padding: 16, marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Platform Recommendation
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>
            {plan.platform_recommendation}
          </div>
          {plan.rationale && <div style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>{plan.rationale}</div>}
        </div>
      )}

      {phases.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Implementation Phases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            {phases.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <div style={{
                  flexShrink: 0, width: 44, height: 44, borderRadius: '50%', background: C.teal,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)',
                }}>
                  {p.phase || i + 1}
                </div>
                <div style={{ flex: 1, background: '#fafafa', borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title}</div>
                    {p.duration && <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{p.duration}</div>}
                  </div>
                  {Array.isArray(p.actions) && p.actions.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginBottom: 4 }}>
                        Actions
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {p.actions.map((a, j) => (
                          <li key={j} style={{ fontSize: 13, color: C.mutedDark }}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(p.deliverables) && p.deliverables.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginBottom: 4 }}>
                        Deliverables
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {p.deliverables.map((d, j) => (
                          <span key={j} style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12,
                            background: C.greenSoft, color: C.green,
                          }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {autos.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Automations to Build</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {autos.map((a, i) => (
              <div key={i} style={{ background: '#fafafa', borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>{a.name}</div>
                {a.trigger && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                    <strong>Trigger:</strong> {a.trigger}
                  </div>
                )}
                {Array.isArray(a.sequence) && a.sequence.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {a.sequence.map((s, j) => (
                      <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.mutedDark }}>
                        {j > 0 && <span style={{ color: C.muted }}>→</span>}
                        <span style={{ background: C.tealSoft, padding: '3px 9px', borderRadius: 6, border: `1px solid ${C.teal}40` }}>{s}</span>
                      </span>
                    ))}
                  </div>
                )}
                {a.expected_impact && (
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>→ {a.expected_impact}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 8. Content & SEO Plan
// ─────────────────────────────────────────────────────────────
function SeoPlan({ plan }) {
  if (!plan) return <div style={{ color: C.muted, fontSize: 14 }}>No SEO plan.</div>
  return (
    <div>
      {plan.current_assessment && (
        <p style={{ fontSize: 14, color: C.mutedDark, lineHeight: 1.6, marginBottom: 18 }}>
          {plan.current_assessment}
        </p>
      )}

      {Array.isArray(plan.keyword_opportunities) && plan.keyword_opportunities.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Keyword Opportunities</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {plan.keyword_opportunities.map((k, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 14,
                background: C.blueSoft, color: C.blue, border: `1px solid ${C.blue}30`,
              }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(plan.content_priorities) && plan.content_priorities.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Content Priorities</div>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plan.content_priorities.map((p, i) => (
              <li key={i} style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {Array.isArray(plan.local_seo_actions) && plan.local_seo_actions.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Local SEO Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.local_seo_actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.mutedDark }}>
                <Check size={13} color={C.green} style={{ flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(plan.recommendations) && plan.recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Additional Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plan.recommendations.map((r, i) => (
              <li key={i} style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 9. 90-Day Roadmap
// ─────────────────────────────────────────────────────────────
function Roadmap({ roadmap }) {
  if (!Array.isArray(roadmap) || roadmap.length === 0) {
    return <div style={{ color: C.muted, fontSize: 14 }}>No roadmap.</div>
  }
  function urgencyColor(weekRange) {
    const match = String(weekRange || '').match(/(\d+)/)
    const week = match ? parseInt(match[1], 10) : 99
    if (week <= 2) return { bg: C.redSoft, fg: '#991B1B', border: '#FCA5A5' }
    if (week <= 6) return { bg: C.amberSoft, fg: '#92400E', border: '#FDE68A' }
    return { bg: C.greenSoft, fg: C.green, border: '#BBF7D0' }
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={thStyle}>Week Range</th>
            <th style={thStyle}>Focus</th>
            <th style={thStyle}>Actions</th>
            <th style={thStyle}>Owner</th>
            <th style={thStyle}>Success Metric</th>
          </tr>
        </thead>
        <tbody>
          {roadmap.map((r, i) => {
            const pal = urgencyColor(r.week_range)
            return (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12,
                    background: pal.bg, color: pal.fg, border: `1px solid ${pal.border}`,
                  }}>
                    {r.week_range}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{r.focus}</td>
                <td style={tdStyle}>
                  {Array.isArray(r.actions) ? (
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {r.actions.map((a, j) => (<li key={j}>{a}</li>))}
                    </ul>
                  ) : (r.actions || '—')}
                </td>
                <td style={{ ...tdStyle, color: C.muted }}>{r.owner || '—'}</td>
                <td style={{ ...tdStyle, color: C.green, fontWeight: 600 }}>{r.success_metric || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 10. Investment Summary
// ─────────────────────────────────────────────────────────────
function InvestSummary({ data }) {
  if (!data) return <div style={{ color: C.muted, fontSize: 14 }}>No investment summary.</div>
  const prios = Array.isArray(data.first_90_day_priorities) ? data.first_90_day_priorities : []

  return (
    <div style={{
      background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 12, padding: 22,
    }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
          Recommended Monthly Retainer
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
          {data.recommended_monthly_retainer_range || '—'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
        <InvestStat label="One-Time Setup" value={data.one_time_setup_costs} />
        <InvestStat label="ROI Projection" value={data.roi_projection} />
        <InvestStat label="Payback Period" value={data.payback_period} />
      </div>

      {prios.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            First 90-Day Priorities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prios.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CheckCircle2 size={14} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InvestStat({ label, value }) {
  return (
    <div style={{ background: C.white, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{value || '—'}</div>
    </div>
  )
}
