"use client"
import { useState, useEffect } from 'react'
import {
  AlertCircle, Loader2, RefreshCw, TrendingDown, TrendingUp, FileText, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function riskColor(r) {
  if (r === 'high' || r === 'critical') return R
  if (r === 'medium') return AMB
  return GRN
}

export default function ContentDecayTab({ clientId, agencyId }) {
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [runningOne, setRunningOne] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_content_decay', client_id: clientId }),
      })
      const j = await res.json()
      setUrls(j.urls || j.data || [])
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  const runAll = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'predict_content_decay', client_id: clientId, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setUrls(j.urls || j.data || [])
      toast.success('Decay predictions updated')
    } catch (e) {
      toast.error(e.message || 'Prediction failed')
    } finally {
      setRunning(false)
    }
  }

  const runOne = async (url) => {
    setRunningOne(url)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'predict_content_decay', client_id: clientId, agency_id: agencyId, url }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      await load()
      toast.success('Updated')
    } catch (e) {
      toast.error(e.message || 'Failed')
    } finally {
      setRunningOne(null)
    }
  }

  const priorityQueue = [...urls]
    .filter(u => u.decay_risk === 'high' || u.decay_risk === 'critical')
    .sort((a, b) => (b.refresh_priority || 0) - (a.refresh_priority || 0))
    .slice(0, 10)

  return (
    <div>
      <HowItWorks tool="content_decay" />
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertCircle size={28} color={AMB} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Content Decay Prediction</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>
            {urls.length} URLs in inventory -- predicts 30/60/90-day ranking drops
          </div>
        </div>
        <button onClick={runAll} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {running ? 'Predicting...' : 'Predict All'}
        </button>
      </div>

      {priorityQueue.length > 0 && (
        <div style={{ ...card, borderLeft: `4px solid ${R}` }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color={R} /> Refresh Priority Queue
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {priorityQueue.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9f9fb' }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#f1f1f6', color: R, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1, fontSize: 12, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: riskColor(u.decay_risk) + '14', color: riskColor(u.decay_risk) }}>{u.decay_risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Content Inventory</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color={T} /></div>
        ) : urls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#1f1f22', fontSize: 13 }}>
            <FileText size={32} color="#d1d5db" style={{ marginBottom: 8 }} /><br />
            No URLs indexed yet. Run content refresh audit first.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>URL</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Now</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>30d</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>60d</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>90d</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Risk</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {urls.slice(0, 100).map((u, i) => {
                  const posNow = Number(u.current_position || 0)
                  const pos30 = Number(u.predicted_30d || 0)
                  const trend = pos30 > posNow // higher = worse
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.url === u.url ? '#f9f9fb' : 'transparent' }}
                        onClick={() => setSelected(u)}>
                      <td style={{ padding: '10px 8px', color: T, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{posNow || '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: trend ? R : GRN }}>{pos30 || '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{u.predicted_60d || '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{u.predicted_90d || '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: riskColor(u.decay_risk) + '14', color: riskColor(u.decay_risk) }}>
                          {u.decay_risk || 'unknown'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); runOne(u.url) }} disabled={runningOne === u.url} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff',
                          fontSize: 11, fontWeight: 600, color: '#1f2937', cursor: 'pointer',
                        }}>
                          {runningOne === u.url ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : 'Predict'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && selected.decay_factors?.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 10 }}>Decay Factors — {selected.url}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selected.decay_factors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9f9fb', borderRadius: 8 }}>
                {f.direction === 'up' ? <TrendingUp size={14} color={GRN} /> : <TrendingDown size={14} color={R} />}
                <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>{f.factor || f.name || String(f)}</div>
                {f.weight && <span style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22' }}>Weight: {f.weight}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
