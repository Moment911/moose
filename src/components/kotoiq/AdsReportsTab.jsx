"use client"
import { useState } from 'react'
import { FileText, Loader2, BarChart2, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function dateStr(daysOffset) {
  const d = new Date(); d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

export default function AdsReportsTab({ clientId, agencyId }) {
  const [tab, setTab] = useState('summary')
  const [summary, setSummary] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [compRange, setCompRange] = useState('week')

  const generateSummary = async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_weekly_summary', client_id: clientId, agency_id: agencyId }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSummary(json.data || json)
      toast.success('Summary generated')
    } catch (e) { toast.error(e.message || 'Failed') }
    finally { setLoadingSummary(false) }
  }

  const runComparison = async () => {
    setLoadingComparison(true)
    const days = compRange === 'week' ? 7 : 30
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ads_period_compare', client_id: clientId, agency_id: agencyId,
          period_a: { start: dateStr(-days * 2), end: dateStr(-days - 1) },
          period_b: { start: dateStr(-days), end: dateStr(-1) },
        }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setComparison(json.data || json)
      toast.success('Comparison generated')
    } catch (e) { toast.error(e.message || 'Failed') }
    finally { setLoadingComparison(false) }
  }

  return (
    <div>
      <HowItWorks tool="ads-reports" />
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 16 }}>Ads Reports</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('summary')}
          style={{ padding: '8px 16px', borderRadius: 8, border: tab === 'summary' ? `2px solid ${T}` : '1px solid #e5e7eb', background: tab === 'summary' ? '#f0f9ff' : '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: tab === 'summary' ? '#5aa0ff' : '#6b6b70', cursor: 'pointer' }}>
          Weekly Summary
        </button>
        <button onClick={() => setTab('comparison')}
          style={{ padding: '8px 16px', borderRadius: 8, border: tab === 'comparison' ? `2px solid ${T}` : '1px solid #e5e7eb', background: tab === 'comparison' ? '#f0f9ff' : '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: tab === 'comparison' ? '#5aa0ff' : '#6b6b70', cursor: 'pointer' }}>
          Period Comparison
        </button>
      </div>

      {/* Weekly Summary */}
      {tab === 'summary' && (
        <div>
          <button onClick={generateSummary} disabled={loadingSummary}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: "#0a0a0a", color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', marginBottom: 16, opacity: loadingSummary ? 0.6 : 1 }}>
            {loadingSummary ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {loadingSummary ? 'Generating...' : 'Generate Weekly Summary'}
          </button>

          {summary && (
            <>
              <div style={{ ...card, borderLeft: `4px solid ${T}` }}>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 900, color: BLK, marginBottom: 8 }}>{summary.headline}</div>
                <div style={{ fontSize: 14, color: '#1f1f22', lineHeight: 1.7, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: 'pre-wrap' }}>{summary.executive_summary_md}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRN, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 8 }}>WINS</div>
                  {(summary.wins || []).map((w, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${GRN}` }}>{w}</div>)}
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: R, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 8 }}>CONCERNS</div>
                  {(summary.concerns || []).map((c, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${R}` }}>{c}</div>)}
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 8 }}>NEXT WEEK</div>
                  {(summary.next_week_priorities || []).map((p, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${T}` }}>{p}</div>)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Period Comparison */}
      {tab === 'comparison' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <select value={compRange} onChange={e => setCompRange(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
              <option value="week">Week-over-Week</option>
              <option value="month">Month-over-Month</option>
            </select>
            <button onClick={runComparison} disabled={loadingComparison}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: "#0a0a0a", color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', opacity: loadingComparison ? 0.6 : 1 }}>
              {loadingComparison ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              {loadingComparison ? 'Comparing...' : 'Compare Periods'}
            </button>
          </div>

          {comparison?.narrative && (
            <div style={{ ...card, borderLeft: `4px solid ${T}` }}>
              <div style={{ fontSize: 14, color: '#1f1f22', lineHeight: 1.7, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: 'pre-wrap' }}>{comparison.narrative.narrative_md}</div>
              {comparison.narrative.key_takeaways?.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 8 }}>KEY TAKEAWAYS</div>
                  {comparison.narrative.key_takeaways.map((t, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${T}` }}>{t}</div>)}
                </div>
              )}
            </div>
          )}

          {comparison?.deltas?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Campaign Deltas</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Campaign', 'Cost Δ', 'Conv Δ', 'CPA Δ', 'Flag'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Campaign' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.deltas.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: d.delta_pct?.cost > 0 ? '#e9695c' : GRN }}>{d.delta_pct?.cost > 0 ? '+' : ''}{(d.delta_pct?.cost || 0).toFixed(1)}%</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: d.delta_pct?.conversions > 0 ? GRN : R }}>{d.delta_pct?.conversions > 0 ? '+' : ''}{(d.delta_pct?.conversions || 0).toFixed(1)}%</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: d.delta_pct?.cpa < 0 ? GRN : R }}>{d.delta_pct?.cpa > 0 ? '+' : ''}{(d.delta_pct?.cpa || 0).toFixed(1)}%</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        {d.flag && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: d.flag?.includes('drop') || d.flag?.includes('increase') ? '#fef2f2' : '#dcfce7', color: d.flag?.includes('drop') || d.flag?.includes('increase') ? '#e9695c' : GRN, fontWeight: 700 }}>{d.flag?.replace(/_/g, ' ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
