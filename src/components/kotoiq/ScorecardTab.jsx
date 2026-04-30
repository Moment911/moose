"use client"
import { useState } from 'react'
import {
  Award, Loader2, RefreshCw, CheckCircle, AlertCircle, TrendingUp, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

// Metric rows to display in the comparison table
const METRIC_ROWS = [
  { key: 'topical_authority', label: 'Topical Authority' },
  { key: 'content_depth_avg_words', label: 'Content Depth (avg words)' },
  { key: 'eeat_score', label: 'E-E-A-T' },
  { key: 'schema_coverage_pct', label: 'Schema Coverage %' },
  { key: 'backlink_count', label: 'Backlinks' },
  { key: 'referring_domains', label: 'Referring Domains' },
  { key: 'domain_authority', label: 'Domain Authority' },
  { key: 'brand_serp_score', label: 'Brand SERP' },
  { key: 'publishing_velocity_per_month', label: 'Publishing Velocity' },
  { key: 'solv', label: 'Rank Grid SoLV' },
  { key: 'core_web_vitals_passing_pct', label: 'CWV Passing %' },
  { key: 'aeo_multi_engine_score', label: 'AEO' },
]

const POSITION_STYLES = {
  leader: { label: 'Leader', color: GRN, bg: GRN + '18' },
  contender: { label: 'Contender', color: T, bg: T + '18' },
  challenger: { label: 'Challenger', color: AMB, bg: AMB + '18' },
  behind: { label: 'Behind', color: R, bg: R + '18' },
}

// Figure out "winning/level/losing" color for a cell
function cellColor(clientVal, competitorBest, isLowerBetter = false) {
  if (clientVal == null || competitorBest == null) return { bg: 'transparent', color: '#1f1f22' }
  const diff = isLowerBetter ? competitorBest - clientVal : clientVal - competitorBest
  if (Math.abs(diff) < 0.01) return { bg: AMB + '14', color: AMB }
  return diff > 0 ? { bg: GRN + '14', color: GRN } : { bg: R + '14', color: R }
}

function fmtVal(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') {
    if (!isFinite(v)) return '—'
    if (v >= 10000) return `${(v / 1000).toFixed(1)}K`
    if (Number.isInteger(v)) return String(v)
    return v.toFixed(1)
  }
  return String(v)
}

export default function ScorecardTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)
  const [compInput, setCompInput] = useState('')

  const generate = async () => {
    setRunning(true)
    try {
      const competitor_domains = compInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 3)
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_scorecard', client_id: clientId, agency_id: agencyId,
          competitor_domains: competitor_domains.length ? competitor_domains : undefined,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Scorecard generated')
    } catch (e) {
      toast.error(e.message || 'Failed to generate scorecard')
    } finally {
      setRunning(false)
    }
  }

  const client = data?.client_scores || {}
  const competitors = data?.competitor_scores || []
  const gaps = data?.gaps || []
  const strengths = data?.strengths || []
  const focus = data?.recommended_focus_areas || data?.recommended_focus || []
  const pos = POSITION_STYLES[data?.overall_position] || null

  return (
    <div>
      <HowItWorks tool="scorecard" />

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={20} color={T} /> Competitive Scorecard
            </div>
            <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>
              Side-by-side SEO comparison with 12 weighted metrics across up to 3 competitors.
            </div>
          </div>
          {pos && (
            <div style={{
              padding: '8px 16px', borderRadius: 20, background: pos.bg, color: pos.color,
              fontSize: 13, fontWeight: 800, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              {pos.label}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={compInput} onChange={e => setCompInput(e.target.value)} placeholder="competitor1.com, competitor2.com, competitor3.com (optional — autodetects)" style={{
            flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FB, minWidth: 0,
          }} />
          <button onClick={generate} disabled={running || !clientId} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
            border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap',
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : data ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {running ? 'Generating...' : data ? 'Re-generate' : 'Generate Scorecard'}
          </button>
        </div>
      </div>

      {!data && !running && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Award size={42} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Scorecard Yet</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>Optionally list competitor domains above, then click "Generate Scorecard".</div>
        </div>
      )}

      {data && (
        <>
          {data.narrative && (
            <div style={{ ...card, background: 'linear-gradient(135deg,#f0f9ff 0%,#fefce8 100%)', borderLeft: `4px solid ${T}` }}>
              <div style={{ fontSize: 14, color: BLK, lineHeight: 1.65, fontFamily: FB }}>{data.narrative}</div>
            </div>
          )}

          <div style={card}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color={T} /> Side-by-Side Comparison
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', fontFamily: FH }}>Metric</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', fontFamily: FH }}>Client</th>
                    {competitors.map((c, i) => (
                      <th key={i} style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', fontFamily: FH, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.domain}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map(row => {
                    const isLowerBetter = row.key === 'toxic_backlink_pct'
                    const clientVal = client[row.key]
                    const compVals = competitors.map(c => c[row.key]).filter(v => typeof v === 'number' && isFinite(v))
                    const compBest = compVals.length ? (isLowerBetter ? Math.min(...compVals) : Math.max(...compVals)) : null
                    const clientCell = cellColor(clientVal, compBest, isLowerBetter)
                    return (
                      <tr key={row.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1f2937' }}>{row.label}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, background: clientCell.bg, color: clientCell.color }}>{fmtVal(clientVal)}</td>
                        {competitors.map((c, i) => {
                          const v = c[row.key]
                          const cell = v == null ? { bg: 'transparent', color: '#8e8e93' } : cellColor(v, clientVal, isLowerBetter)
                          return (
                            <td key={i} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, background: cell.bg, color: cell.color }}>{fmtVal(v)}</td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: '#6b6b70', fontFamily: FB }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: GRN + '40', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Winning</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: AMB + '40', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Level</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: R + '40', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Losing</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color={GRN} /> Strengths ({strengths.length})
              </div>
              {strengths.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6b6b70', fontStyle: 'italic' }}>No measurable strengths yet — close gaps first.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: GRN + '10', borderRadius: 8, fontSize: 13, color: BLK }}>
                      <CheckCircle size={14} color={GRN} /> {String(s).replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} color={R} /> Priority Focus Areas
              </div>
              {focus.length === 0 && gaps.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6b6b70', fontStyle: 'italic' }}>Nothing urgent.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(focus.length ? focus : gaps.slice(0, 5).map(g => `Close ${g.metric} gap`)).map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: R + '10', borderRadius: 8, fontSize: 13, color: BLK }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: R, color: '#fff', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span>{typeof f === 'string' ? f : (f.recommendation || f.text || JSON.stringify(f))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
