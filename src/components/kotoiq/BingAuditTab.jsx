"use client"
import { useState, useEffect } from 'react'
import { Search, Loader2, RefreshCw, Key, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

export default function BingAuditTab({ clientId, agencyId }) {
  const [apiKey, setApiKey] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_bing_audit', client_id: clientId }),
    }).then(r => r.json()).then(r => { if (r?.data) setData(r.data) }).catch(() => {})
  }, [clientId])

  const run = async () => {
    if (!apiKey.trim()) return toast.error('Bing Webmaster API key required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_bing_audit', client_id: clientId, agency_id: agencyId, bing_api_key: apiKey }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Bing audit complete')
    } catch (e) {
      toast.error(e.message || 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="bing_audit" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={20} color="#0078D4" /> Bing Webmaster Audit
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Pull Bing rankings + compare to Google. Most sites underperform on Bing — find the gaps.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <Key size={14} color="#6b6b70" />
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Bing Webmaster Tools API key" style={{
            flex: 1, padding: '10px 14px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          }} />
        </div>
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: '#0078D4', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {running ? 'Running...' : data ? 'Re-run Audit' : 'Run Audit'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <Stat label="Total Impressions" value={fmtN(data.total_impressions)} color={BLK} />
            <Stat label="Total Clicks" value={fmtN(data.total_clicks)} color={GRN} />
            <Stat label="Avg Position" value={data.avg_position ? data.avg_position.toFixed(1) : '—'} color={AMB} />
            <Stat label="Indexed Pages" value={fmtN(data.indexed_pages)} color="#0a0a0a" />
          </div>

          {data.top_queries?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Top Bing Queries</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ececef' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Query</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Impr.</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Clicks</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_queries.slice(0, 30).map((q, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f1f6' }}>
                        <td style={{ padding: '8px', color: BLK }}>{q.query}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#1f1f22' }}>{fmtN(q.impressions)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: GRN }}>{fmtN(q.clicks)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#1f1f22' }}>{q.position?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.google_vs_bing_discrepancies?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color={AMB} /> Google vs Bing Discrepancies
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ececef' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Query</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Google Pos</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Bing Pos</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.google_vs_bing_discrepancies.slice(0, 20).map((d, i) => {
                      const gap = Number(d.bing_position || 0) - Number(d.google_position || 0)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f1f6' }}>
                          <td style={{ padding: '8px', color: BLK }}>{d.query}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{d.google_position?.toFixed(1) || '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{d.bing_position?.toFixed(1) || '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: gap > 5 ? '#e9695c' : gap < -5 ? GRN : '#6b6b70' }}>
                            {gap > 0 ? '+' : ''}{gap.toFixed(1)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', border: '1px solid #ececef' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

function fmtN(n) {
  if (n == null) return '—'
  return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}
