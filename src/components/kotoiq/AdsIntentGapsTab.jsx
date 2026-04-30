"use client"
import { useState, useEffect } from 'react'
import { Target, Loader2, Zap, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function AdsIntentGapsTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!clientId) return
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_get_intent_gaps', client_id: clientId }),
    }).then(r => r.json()).then(res => { setData(res.data || res); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [clientId])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_intent_gaps', client_id: clientId, agency_id: agencyId }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Found ${json.gaps_found || 0} gaps, ${json.recommendations || 0} keywords recommended`)
      load()
    } catch (e) { toast.error(e.message || 'Analysis failed') }
    finally { setAnalyzing(false) }
  }

  const gaps = data?.gaps || []
  const recs = data?.recommendations || []

  return (
    <div>
      <HowItWorks tool="ads-intent-gaps" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Intent Gap Analysis</div>
        <button onClick={runAnalysis} disabled={analyzing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', opacity: analyzing ? 0.6 : 1 }}>
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {analyzing ? 'Analyzing...' : 'Find Gaps'}
        </button>
      </div>

      {loading ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
        <>
          <div style={{ ...card, background: '#f0f9ff', borderColor: '#bae6fd' }}>
            <div style={{ fontSize: 13, color: '#0369a1', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
              <strong>{gaps.length}</strong> GSC queries with 100+ organic impressions that you're not bidding on.
              {recs.length > 0 && <> AI recommended <strong>{recs.length}</strong> new keywords to add.</>}
            </div>
          </div>

          {/* Keyword Recommendations */}
          {recs.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Recommended New Keywords</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Keyword', 'Intent', 'Match', 'Est. Clicks/mo', 'Est. CPC', 'Priority', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Keyword' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}>{r.keyword}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: r.intent === 'transactional' ? '#dcfce7' : r.intent === 'commercial' ? '#fef9c3' : '#f1f1f6', color: r.intent === 'transactional' ? GRN : r.intent === 'commercial' ? AMB : '#6b6b70' }}>{r.intent}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 11 }}>{r.proposed_match_type}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{r.est_monthly_clicks || '—'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{r.est_cpc_usd ? `$${r.est_cpc_usd.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: r.priority === 'high' ? '#fef2f2' : r.priority === 'medium' ? '#fef9c3' : '#f1f1f6', color: r.priority === 'high' ? R : r.priority === 'medium' ? AMB : '#6b6b70', fontWeight: 700 }}>{r.priority}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: r.status === 'approved' ? '#dcfce7' : '#fef9c3', color: r.status === 'approved' ? GRN : AMB }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* GSC Gaps Table */}
          {gaps.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Uncovered GSC Queries</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Query', 'GSC Impressions', 'GSC Clicks', 'Avg Position', 'Ads Coverage'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Query' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gaps.slice(0, 50).map((g, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 500 }}>{g.query}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{(g.gsc_impressions || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{g.gsc_clicks || 0}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{g.avg_position?.toFixed(1) || '—'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: g.ads_coverage === 'none' ? '#fef2f2' : '#fef9c3', color: g.ads_coverage === 'none' ? R : AMB }}>{g.ads_coverage}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
