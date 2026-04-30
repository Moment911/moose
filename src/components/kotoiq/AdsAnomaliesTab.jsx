"use client"
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, Zap, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }
const SEVERITY = { critical: { bg: '#fef2f2', color: R }, warn: { bg: '#fef9c3', color: AMB }, info: { bg: '#eff6ff', color: T } }

export default function AdsAnomaliesTab({ clientId, agencyId }) {
  const [alerts, setAlerts] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = () => {
    if (!clientId) return
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_get_anomalies', client_id: clientId }),
    }).then(r => r.json()).then(res => { setAlerts(res.data || []); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [clientId])

  const runDetection = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_anomaly_detect', client_id: clientId, agency_id: agencyId }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Found ${json.flags_found || 0} anomalies, created ${json.alerts_created || 0} alerts`)
      load()
    } catch (e) { toast.error(e.message || 'Detection failed') }
    finally { setAnalyzing(false) }
  }

  const acknowledge = async (id) => {
    await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ads_acknowledge_alert', alert_id: id }) })
    toast.success('Acknowledged')
    load()
  }

  return (
    <div>
      <HowItWorks tool="ads-anomalies" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK }}>Anomaly Detection</div>
        <button onClick={runDetection} disabled={analyzing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: analyzing ? 0.6 : 1 }}>
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {analyzing ? 'Detecting...' : 'Run Detection'}
        </button>
      </div>

      {loading ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
        <>
          {alerts.length === 0 && <div style={{ ...card, textAlign: 'center', padding: 40, color: '#8e8e93' }}>
            <CheckCircle size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontFamily: FH, fontWeight: 700 }}>No anomalies detected</div>
            <div style={{ fontSize: 13 }}>All metrics within normal ranges</div>
          </div>}

          {alerts.map((a, i) => {
            const sev = SEVERITY[a.severity] || SEVERITY.info
            const isExpanded = expanded === i
            return (
              <div key={i} style={{ ...card, borderLeft: `4px solid ${sev.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : i)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={18} color={sev.color} />
                    <div>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: sev.bg, color: sev.color, fontWeight: 700, marginRight: 8 }}>{a.severity?.toUpperCase()}</span>
                      <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 14 }}>{a.metric} anomaly</span>
                      <span style={{ fontSize: 12, color: '#6b6b70', marginLeft: 8 }}>{a.delta_pct > 0 ? '+' : ''}{(a.delta_pct || 0).toFixed(1)}% from baseline</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#8e8e93' }}>{a.created_at?.split('T')[0]}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6, marginBottom: 12, fontFamily: FB }}>{a.explanation_md}</div>
                    {a.contributors?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', marginBottom: 6 }}>TOP CONTRIBUTORS</div>
                        {a.contributors.map((c, j) => (
                          <div key={j} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{c.entity_name}</span>
                            <span style={{ color: c.delta_value > 0 ? R : GRN }}>{c.contribution_pct?.toFixed(0)}% contribution</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!a.acknowledged_at && (
                      <button onClick={() => acknowledge(a.id)}
                        style={{ fontSize: 12, padding: '6px 14px', background: '#f1f1f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Acknowledge</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
