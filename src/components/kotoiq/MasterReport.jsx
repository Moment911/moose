"use client"
import { useState, useEffect } from 'react'
import {
  BarChart2, Search, Award, Target, Shield, Link2, Globe, Code, FileText,
  MapPin, Calendar, Loader2, AlertTriangle, ArrowRight, Layers, Activity,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 16 }

function ScoreRing({ score, size = 80, color }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r
  const s = typeof score === 'number' ? score : 0
  const col = color || (s >= 70 ? GRN : s >= 40 ? AMB : R)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={5}
          strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 1s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.3, fontWeight: 900, color: col }}>{s}</div>
    </div>
  )
}

function grade(s) { return s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F' }
function num(v) { return typeof v === 'number' ? v : null }

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color="#0a0a0a" />
        </div>
        <h3 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 17, fontWeight: 800, color: BLK, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message, tab, onSwitchTab }) {
  return (
    <div style={{ background: AMB + '10', border: `1px solid #ececef`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <AlertTriangle size={18} color={AMB} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#92400e', flex: 1 }}>{message}</span>
      {tab && onSwitchTab && (
        <button onClick={() => onSwitchTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: "#0a0a0a", color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Go <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}

function MetricPill({ label, value }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '10px 16px', textAlign: 'center', flex: '1 1 0', minWidth: 100 }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 900, color: BLK }}>{value ?? '—'}</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, color: '#6b6b70', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function AiInterpretation({ text }) {
  if (!text) return null
  return (
    <div style={{ background: '#f9f9fb', border: `1px solid #ececef`, borderRadius: 10, padding: '12px 16px', marginTop: 14 }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: T, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>AI Interpretation</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#1f1f22', lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

async function fetchAction(action, clientId, agencyId) {
  try {
    const res = await fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId }),
    })
    const j = await res.json()
    return j.error ? null : j
  } catch { return null }
}

const ACTIONS = [
  ['dashboard', 'dashboard'], ['authority', 'get_topical_authority'], ['strategy', 'get_latest_strategic_plan'],
  ['brandSerp', 'get_brand_serp'], ['backlinks', 'get_backlink_profile'], ['eeat', 'get_eeat_audit'],
  ['topicalMap', 'get_topical_map'], ['schema', 'get_schema_audit'], ['technical', 'get_technical_deep'],
  ['gsc', 'get_gsc_audit'], ['links', 'get_link_audit'], ['calendar', 'get_content_calendar'],
  ['contentInv', 'get_content_inventory'], ['gbp', 'gmb_health'],
]

export default function MasterReport({ clientId, agencyId, onSwitchTab }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [execSummary, setExecSummary] = useState('')

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    Promise.all(ACTIONS.map(([key, action]) => fetchAction(action, clientId, agencyId).then(r => [key, r])))
      .then(results => {
        const d = Object.fromEntries(results)
        setData(d)
        setLoading(false)
        // fire exec summary
        fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ask_kotoiq', client_id: clientId, agency_id: agencyId,
            question: 'Give a 3-sentence executive summary of this client\'s overall SEO health, biggest strengths, and top priorities. Be specific and actionable.' }),
        }).then(r => r.json()).then(j => { if (j.answer) setExecSummary(j.answer) }).catch(() => {})
      })
  }, [clientId, agencyId])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <Loader2 size={32} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, color: '#6b6b70' }}>Loading master report...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const dash = data.dashboard
  const kw = dash?.keywords || dash?.summary?.keywords || {}
  const scores = [
    num(data.authority?.score), num(data.eeat?.overall_score ?? data.eeat?.score),
    num(data.brandSerp?.overall_score ?? data.brandSerp?.score),
    num(data.technical?.overall_score ?? data.technical?.score),
    num(data.schema?.coverage_pct ?? data.schema?.score),
    num(data.links?.score), num(data.gbp?.score ?? data.gbp?.overall_score),
  ].filter(s => s !== null)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const gaps = []
  if (!dash) gaps.push({ label: 'Keywords', tab: 'keywords', msg: 'Run Quick Scan to discover keywords' })
  if (!data.authority) gaps.push({ label: 'Topical Authority', tab: 'topical_authority', msg: 'Run Topical Authority audit' })
  if (!data.strategy) gaps.push({ label: 'Strategic Plan', tab: 'strategy', msg: 'Generate a Strategic Plan' })
  if (!data.eeat) gaps.push({ label: 'E-E-A-T', tab: 'eeat', msg: 'Run E-E-A-T audit' })
  if (!data.backlinks) gaps.push({ label: 'Backlinks', tab: 'backlinks', msg: 'Analyze backlink profile' })
  if (!data.brandSerp) gaps.push({ label: 'Brand SERP', tab: 'brand_serp', msg: 'Scan Brand SERP' })
  if (!data.technical) gaps.push({ label: 'Technical SEO', tab: 'technical', msg: 'Run Technical Deep audit' })
  if (!data.schema) gaps.push({ label: 'Schema', tab: 'schema', msg: 'Run Schema audit' })
  if (!data.links) gaps.push({ label: 'Internal Links', tab: 'internal_links', msg: 'Run Internal Links audit' })
  if (!data.gbp) gaps.push({ label: 'Google Business Profile', tab: 'gmb_images', msg: 'Check GBP health' })
  if (!data.contentInv) gaps.push({ label: 'Content Health', tab: 'content_refresh', msg: 'Build Content Inventory' })
  if (!data.calendar) gaps.push({ label: 'Content Calendar', tab: 'content_calendar', msg: 'Build Content Calendar' })

  const bl = data.backlinks || {}
  const auth = data.authority || {}
  const eeat = data.eeat || {}
  const bs = data.brandSerp || {}
  const tech = data.technical || {}
  const sch = data.schema || {}
  const lnk = data.links || {}
  const gbp = data.gbp || {}
  const ci = data.contentInv || {}
  const strat = data.strategy || {}
  const cal = data.calendar || {}

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* 1. Executive Summary */}
      <SectionCard icon={BarChart2} title="Executive Summary">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
          {avgScore !== null && <ScoreRing score={avgScore} size={96} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: '#6b6b70', marginBottom: 4 }}>Overall Health: {avgScore !== null ? `${grade(avgScore)} (${avgScore}/100)` : 'Insufficient data'}</div>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>
              {execSummary || (avgScore !== null ? `Based on ${scores.length} modules analyzed. Run remaining tools to get a complete picture.` : 'Run KotoIQ tools to populate this report.')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MetricPill label="Keywords" value={kw.total ?? kw.count ?? '—'} />
          <MetricPill label="Avg Position" value={kw.avg_position != null ? Number(kw.avg_position).toFixed(1) : '—'} />
          <MetricPill label="DA" value={bl.domain_authority ?? bl.da ?? '—'} />
          <MetricPill label="Backlinks" value={bl.total_backlinks ?? bl.total ?? '—'} />
          <MetricPill label="E-E-A-T" value={eeat.grade ?? (eeat.overall_score != null ? grade(eeat.overall_score) : '—')} />
        </div>
      </SectionCard>

      {/* 2. Keyword Intelligence */}
      <SectionCard icon={Search} title="Keyword Intelligence">
        {dash ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="Total Keywords" value={kw.total ?? kw.count ?? '—'} />
            <MetricPill label="Top 3" value={kw.top3 ?? kw.top_3 ?? '—'} />
            <MetricPill label="Top 10" value={kw.top10 ?? kw.top_10 ?? '—'} />
          </div>
          {(kw.categories || kw.buckets) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(kw.categories || kw.buckets || {}).map(([k, v]) => (
                <span key={k} style={{ background: '#f1f1f6', borderRadius: 8, padding: '4px 12px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#1f1f22' }}>
                  {k.replace(/_/g, ' ')}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          )}
          <AiInterpretation text={kw.total != null ? `Tracking ${kw.total ?? kw.count} keywords. ${(kw.top3 ?? 0) + (kw.top10 ?? 0) > 0 ? `${kw.top3 ?? kw.top_3 ?? 0} rank in the top 3 and ${kw.top10 ?? kw.top_10 ?? 0} in the top 10 — focus on moving page-2 keywords into the top 10 for maximum traffic gains.` : 'Run a rank check to see current positions.'}` : null} />
        </>) : <EmptyState message="Keywords not scanned yet — run Quick Scan to discover keywords" tab="keywords" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 3. Topical Authority */}
      <SectionCard icon={Award} title="Topical Authority">
        {data.authority ? (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <ScoreRing score={auth.score ?? 0} size={72} />
            <div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>Authority Score: {auth.score ?? '—'}/100</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#6b6b70' }}>Grade: {auth.grade ?? grade(auth.score ?? 0)}</div>
            </div>
          </div>
          {auth.clusters && auth.clusters.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: '#6b6b70', marginBottom: 6 }}>Cluster Breakdown</div>
              {auth.clusters.slice(0, 8).map((cl, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13 }}>
                  <span style={{ color: '#1f1f22' }}>{cl.name || cl.cluster}</span>
                  <span style={{ fontWeight: 700, color: (cl.score ?? 0) >= 60 ? GRN : AMB }}>{cl.score ?? cl.coverage ?? '—'}%</span>
                </div>
              ))}
            </div>
          )}
          {auth.gaps && auth.gaps.length > 0 && (
            <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Gaps</div>
              {auth.gaps.slice(0, 5).map((g, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#78350f' }}>{typeof g === 'string' ? g : g.topic || g.name}</div>)}
            </div>
          )}
          <AiInterpretation text={`Authority score of ${auth.score ?? 0} means ${(auth.score ?? 0) >= 70 ? 'strong topical coverage — maintain and expand into adjacent clusters.' : (auth.score ?? 0) >= 40 ? 'moderate coverage — prioritize filling cluster gaps to boost authority.' : 'weak topical authority — a sustained content strategy is needed to establish expertise.'}`} />
        </>) : <EmptyState message="Authority not audited — run the Topical Authority tool" tab="topical_authority" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 4. Strategic Plan */}
      <SectionCard icon={Target} title="Strategic Plan">
        {data.strategy ? (<>
          {strat.attack && strat.attack.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: GRN, marginBottom: 4 }}>Attack Priorities</div>
              {strat.attack.slice(0, 5).map((a, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#1f1f22', padding: '2px 0' }}>{typeof a === 'string' ? a : a.keyword || a.topic || JSON.stringify(a)}</div>)}
            </div>
          )}
          {strat.defend && strat.defend.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: AMB, marginBottom: 4 }}>Defend Priorities</div>
              {strat.defend.slice(0, 5).map((d, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#1f1f22', padding: '2px 0' }}>{typeof d === 'string' ? d : d.keyword || d.topic || JSON.stringify(d)}</div>)}
            </div>
          )}
          {strat.abandon && strat.abandon.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: '#8e8e93', marginBottom: 4 }}>Consider Abandoning</div>
              {strat.abandon.slice(0, 3).map((a, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#8e8e93', padding: '2px 0' }}>{typeof a === 'string' ? a : a.keyword || a.topic || JSON.stringify(a)}</div>)}
            </div>
          )}
          {strat.weekly_actions && <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#1f1f22', marginTop: 8 }}><strong>Weekly Actions:</strong> {Array.isArray(strat.weekly_actions) ? strat.weekly_actions.join(', ') : strat.weekly_actions}</div>}
          <AiInterpretation text="The strategic plan identifies which keywords to attack, defend, and abandon based on ranking difficulty and business value. Focus on attack targets with the highest ROI first." />
        </>) : <EmptyState message="Strategic plan not generated — run Strategic Plan tool" tab="strategy" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 5. E-E-A-T */}
      <SectionCard icon={Shield} title="E-E-A-T Analysis">
        {data.eeat ? (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <ScoreRing score={eeat.overall_score ?? eeat.score ?? 0} size={72} />
            <div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>E-E-A-T Score: {eeat.overall_score ?? eeat.score ?? '—'}/100</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#6b6b70' }}>Grade: {eeat.grade ?? grade(eeat.overall_score ?? eeat.score ?? 0)}</div>
            </div>
          </div>
          {eeat.signals && eeat.signals.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {eeat.signals.slice(0, 8).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13 }}>
                  <span style={{ color: s.found ? GRN : '#d1d5db' }}>{s.found ? '\u2713' : '\u2717'}</span>
                  <span style={{ color: s.found ? '#1f1f22' : '#8e8e93' }}>{s.name || s.label}</span>
                </div>
              ))}
            </div>
          )}
          {eeat.recommendations && eeat.recommendations.length > 0 && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: GRN, marginBottom: 4 }}>Recommendations</div>
              {eeat.recommendations.slice(0, 4).map((r, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#166534' }}>{typeof r === 'string' ? r : r.text || r.recommendation}</div>)}
            </div>
          )}
          <AiInterpretation text={`E-E-A-T score of ${eeat.overall_score ?? eeat.score ?? 0} — ${(eeat.overall_score ?? eeat.score ?? 0) >= 70 ? 'strong trust signals. Maintain author bios, citations, and credentials.' : 'improvement needed. Add author bios, expertise credentials, and trust signals to boost perceived authority with Google.'}`} />
        </>) : <EmptyState message="E-E-A-T not audited — run E-E-A-T audit" tab="eeat" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 6. Backlinks */}
      <SectionCard icon={Link2} title="Backlink Profile">
        {data.backlinks ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="DA" value={bl.domain_authority ?? bl.da ?? '—'} />
            <MetricPill label="Total Backlinks" value={bl.total_backlinks ?? bl.total ?? '—'} />
            <MetricPill label="Referring Domains" value={bl.referring_domains ?? '—'} />
            <MetricPill label="Toxic %" value={bl.toxic_pct != null ? `${bl.toxic_pct}%` : '—'} />
            <MetricPill label="High Quality" value={bl.high_quality ?? '—'} />
          </div>
          <AiInterpretation text={`Domain Authority of ${bl.domain_authority ?? bl.da ?? '?'} with ${bl.referring_domains ?? '?'} referring domains. ${(bl.toxic_pct ?? 0) > 10 ? 'Toxic link percentage is concerning — consider a disavow file.' : 'Toxic link percentage is healthy.'} Focus link building on high-authority, relevant domains.`} />
        </>) : <EmptyState message="Backlinks not analyzed — run Backlink Analysis" tab="backlinks" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 7. Brand SERP */}
      <SectionCard icon={Globe} title="Brand SERP">
        {data.brandSerp ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="Overall Score" value={bs.overall_score ?? bs.score ?? '—'} />
            <MetricPill label="Owned Results" value={bs.owned_results ?? bs.owned ?? '—'} />
            <MetricPill label="Knowledge Panel" value={bs.knowledge_panel ? 'Yes' : 'No'} />
            <MetricPill label="PAA Questions" value={bs.paa_count ?? bs.paa_questions ?? '—'} />
          </div>
          {(bs.negative_results ?? bs.negatives ?? []).length > 0 && (
            <div style={{ background: R + '10', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: R, marginBottom: 4 }}>Negative Results</div>
              {(bs.negative_results ?? bs.negatives).slice(0, 3).map((n, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#991b1b' }}>{typeof n === 'string' ? n : n.title || n.url}</div>)}
            </div>
          )}
          <AiInterpretation text={`Brand SERP score of ${bs.overall_score ?? bs.score ?? '?'}. ${bs.knowledge_panel ? 'Knowledge panel is active — great for brand credibility.' : 'No knowledge panel yet — focus on structured data and brand entity signals.'} ${(bs.negative_results ?? bs.negatives ?? []).length > 0 ? 'Negative results detected — consider reputation management.' : ''}`} />
        </>) : <EmptyState message="Brand SERP not scanned — run Brand SERP scan" tab="brand_serp" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 8. Technical SEO */}
      <SectionCard icon={Code} title="Technical SEO">
        {data.technical ? (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <ScoreRing score={tech.overall_score ?? tech.score ?? 0} size={72} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: BLK }}>Technical Score: {tech.overall_score ?? tech.score ?? '—'}/100</div>
              {tech.sub_scores && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {Object.entries(tech.sub_scores).map(([k, v]) => (
                    <span key={k} style={{ background: '#f1f1f6', borderRadius: 6, padding: '2px 10px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, color: '#1f1f22' }}>{k}: <strong>{v}</strong></span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {(tech.critical_issues ?? tech.issues ?? []).length > 0 && (
            <div style={{ background: '#f9f9fb', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: R, marginBottom: 4 }}>Critical Issues</div>
              {(tech.critical_issues ?? tech.issues).slice(0, 5).map((issue, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#991b1b', padding: '2px 0' }}>{typeof issue === 'string' ? issue : issue.title || issue.description}</div>)}
            </div>
          )}
          <AiInterpretation text={`Technical SEO score of ${tech.overall_score ?? tech.score ?? 0}. ${(tech.critical_issues ?? tech.issues ?? []).length > 0 ? `${(tech.critical_issues ?? tech.issues).length} critical issues need attention — fix these before investing in content.` : 'No critical issues detected — technical foundation is solid.'}`} />
        </>) : <EmptyState message="Technical audit not run — run Technical Deep audit" tab="technical" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 9. Schema */}
      <SectionCard icon={Layers} title="Schema Markup">
        {data.schema ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="Coverage" value={sch.coverage_pct != null ? `${sch.coverage_pct}%` : (sch.score != null ? `${sch.score}%` : '—')} />
            <MetricPill label="Types Found" value={sch.types_found ?? sch.types_count ?? '—'} />
          </div>
          {(sch.missing ?? sch.missing_opportunities ?? []).length > 0 && (
            <div style={{ background: AMB + '10', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Missing Opportunities</div>
              {(sch.missing ?? sch.missing_opportunities).slice(0, 5).map((m, i) => <div key={i} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, color: '#78350f' }}>{typeof m === 'string' ? m : m.type || m.name}</div>)}
            </div>
          )}
          <AiInterpretation text={`Schema coverage at ${sch.coverage_pct ?? sch.score ?? '?'}%. ${(sch.missing ?? sch.missing_opportunities ?? []).length > 0 ? 'Adding missing schema types will improve rich snippet eligibility and click-through rates.' : 'Good schema coverage — maintain as you add new pages.'}`} />
        </>) : <EmptyState message="Schema not audited — run Schema audit" tab="schema" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 10. Internal Links */}
      <SectionCard icon={Activity} title="Internal Links">
        {data.links ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="Score" value={lnk.score ?? '—'} />
            <MetricPill label="Total Pages" value={lnk.total_pages ?? '—'} />
            <MetricPill label="Orphan Pages" value={lnk.orphan_pages ?? lnk.orphans ?? '—'} />
          </div>
          <AiInterpretation text={`Internal linking score of ${lnk.score ?? '?'}. ${(lnk.orphan_pages ?? lnk.orphans ?? 0) > 0 ? `${lnk.orphan_pages ?? lnk.orphans} orphan pages found — add internal links to distribute authority and improve crawlability.` : 'No orphan pages — internal linking structure is healthy.'}`} />
        </>) : <EmptyState message="Internal links not audited — run Internal Links audit" tab="internal_links" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 11. GBP */}
      <SectionCard icon={MapPin} title="Google Business Profile">
        {data.gbp ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="GBP Score" value={gbp.score ?? gbp.overall_score ?? '—'} />
            <MetricPill label="Reviews" value={gbp.review_count ?? gbp.reviews ?? '—'} />
            <MetricPill label="Rating" value={gbp.rating != null ? Number(gbp.rating).toFixed(1) : '—'} />
          </div>
          <AiInterpretation text={`GBP score of ${gbp.score ?? gbp.overall_score ?? '?'}. ${(gbp.review_count ?? gbp.reviews ?? 0) > 0 ? `${gbp.review_count ?? gbp.reviews} reviews with a ${gbp.rating ?? '?'} rating.` : ''} Maintain consistent NAP data and actively respond to reviews to boost local visibility.`} />
        </>) : <EmptyState message="GBP health not checked — run GBP audit" tab="gmb_images" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* 12. Content Health */}
      <SectionCard icon={FileText} title="Content Health">
        {data.contentInv ? (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <MetricPill label="Total Pages" value={ci.total_pages ?? ci.total ?? '—'} />
            <MetricPill label="Fresh" value={ci.fresh ?? '—'} />
            <MetricPill label="Aging" value={ci.aging ?? '—'} />
            <MetricPill label="Stale" value={ci.stale ?? '—'} />
          </div>
          <AiInterpretation text={`${ci.total_pages ?? ci.total ?? '?'} pages analyzed. ${(ci.stale ?? 0) > 0 ? `${ci.stale} stale pages need refreshing — prioritize high-traffic pages first.` : 'Content freshness looks good.'} ${(ci.aging ?? 0) > 0 ? `${ci.aging} pages are aging and should be scheduled for updates.` : ''}`} />
        </>) : <EmptyState message="Content inventory not built — run Content Inventory" tab="content_refresh" onSwitchTab={onSwitchTab} />}
      </SectionCard>

      {/* Gaps & Missing Data */}
      {gaps.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Gaps & Missing Data">
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, color: '#6b6b70', marginBottom: 12 }}>
            {gaps.length} tool{gaps.length === 1 ? '' : 's'} ha{gaps.length === 1 ? 's' : 've'}n't been run yet. Complete these for a full picture.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', borderRadius: 8, padding: '10px 14px' }}>
                <AlertTriangle size={14} color={AMB} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: BLK }}>{g.label}</div>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 11, color: '#6b6b70' }}>{g.msg}</div>
                </div>
                <button onClick={() => onSwitchTab?.(g.tab)} style={{ background: "#0a0a0a", color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Go <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
