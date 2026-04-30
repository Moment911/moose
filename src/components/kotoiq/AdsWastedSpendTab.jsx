"use client"
import { useState, useEffect } from 'react'
import { DollarSign, Loader2, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function AdsWastedSpendTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_get_wasted_spend', client_id: clientId }),
    }).then(r => r.json()).then(res => { setData(res.data || res); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [clientId])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_wasted_spend', client_id: clientId, agency_id: agencyId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Found ${json.candidates || 0} wasted terms, ${json.recommendations || 0} negatives recommended`)
      load()
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const candidates = data?.candidates || []
  const recs = data?.recommendations || []
  const totalWasted = data?.total_wasted_usd || candidates.reduce((s, c) => s + (c.cost_usd || 0), 0)

  return (
    <div>
      <HowItWorks tool="ads-wasted-spend" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK }}>Wasted Spend Detection</div>
        <button onClick={runAnalysis} disabled={analyzing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: R, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: analyzing ? 0.6 : 1 }}>
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
            <AlertTriangle size={32} color={totalWasted > 100 ? R : AMB} />
            <div>
              <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: R }}>${totalWasted.toFixed(2)}</div>
              <div style={{ fontSize: 13, color: '#6b6b70' }}>Wasted in last 30 days across {candidates.length} search terms (0 conversions, 5+ clicks)</div>
            </div>
          </div>

          {/* Negative Recommendations */}
          {recs.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>
                <CheckCircle size={14} color={GRN} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {recs.length} Negative Keyword Recommendations
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Search Term', 'Match', 'Scope', 'Savings/mo', 'Status', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Search Term' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 500 }}>{r.search_term}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f1f1f6' }}>{r.proposed_match_type}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 11 }}>{r.scope}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: GRN, fontWeight: 700 }}>${(r.estimated_savings_usd || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fef2f2' : '#fef9c3', color: r.status === 'approved' ? GRN : r.status === 'rejected' ? R : AMB }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        {r.status === 'pending' && (
                          <button onClick={async () => {
                            await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'ads_approve_rec', rec_type: 'negatives', rec_id: r.id, action_type: 'approved' }) })
                            toast.success('Approved'); load()
                          }} style={{ fontSize: 11, padding: '4px 10px', background: GRN, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Wasted Terms Table */}
          {candidates.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>All Wasted Search Terms</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Search Term', 'Cost', 'Clicks', 'First Seen', 'Last Seen'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Search Term' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 50).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 500 }}>{c.search_term}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: R, fontWeight: 700 }}>${(c.cost_usd || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{c.clicks || 0}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 11, color: '#8e8e93' }}>{c.first_seen || '—'}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 11, color: '#8e8e93' }}>{c.last_seen || '—'}</td>
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
