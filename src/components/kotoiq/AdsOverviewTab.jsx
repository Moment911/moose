"use client"
import { useState, useEffect } from 'react'
import { BarChart2, DollarSign, Target, TrendingUp, AlertCircle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {Icon && <Icon size={16} color={color || T} />}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</div>
      </div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: color || BLK, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 6, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{sub}</div>}
    </div>
  )
}

function fmt(n) { return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${(n || 0).toFixed(2)}` }

export default function AdsOverviewTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!clientId) return
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_get_overview', client_id: clientId }),
      })
      const json = await res.json()
      if (!json.error) setData(json.data || json)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [clientId])

  const syncAll = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ads_sync_google', client_id: clientId, agency_id: agencyId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Synced: ${json.campaigns || 0} campaigns, ${json.keywords || 0} keywords, ${json.search_terms || 0} search terms`)
      load()
    } catch (e) {
      toast.error(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const cost7d = data?.cost_7d || 0
  const clicks7d = data?.clicks_7d || 0
  const conv7d = data?.conversions_7d || 0
  const cpa = conv7d > 0 ? cost7d / conv7d : 0
  const alertCount = data?.alert_count || 0
  const recCount = data?.rec_count || 0

  return (
    <div>
      <HowItWorks tool="ads-overview" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Ads Intelligence Overview</div>
        <button onClick={syncAll} disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? 'Syncing...' : 'Sync Google Ads'}
        </button>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: 8, color: '#6b6b70', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Loading ads data...</div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard label="7-Day Spend" value={fmt(cost7d)} icon={DollarSign} color={BLK} />
            <StatCard label="Clicks" value={clicks7d.toLocaleString()} icon={TrendingUp} color={T} />
            <StatCard label="Conversions" value={conv7d.toLocaleString()} icon={Target} color={GRN} />
            <StatCard label="CPA" value={fmt(cpa)} icon={BarChart2} color={cpa > 100 ? R : GRN} sub={cpa > 100 ? 'Above target' : 'On track'} />
          </div>

          {/* Status Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ ...card, flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={20} color={alertCount > 0 ? R : '#d1d5db'} />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: alertCount > 0 ? R : BLK }}>{alertCount} Active Alerts</div>
                <div style={{ fontSize: 12, color: '#6b6b70' }}>Anomalies detected this week</div>
              </div>
            </div>
            <div style={{ ...card, flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle size={20} color={recCount > 0 ? AMB : '#d1d5db'} />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: recCount > 0 ? AMB : BLK }}>{recCount} Pending Recs</div>
                <div style={{ fontSize: 12, color: '#6b6b70' }}>Recommendations awaiting review</div>
              </div>
            </div>
          </div>

          {/* Campaign Table */}
          {data?.campaigns?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Campaigns</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Campaign', 'Status', 'Spend', 'Clicks', 'Conv', 'CPA'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Campaign' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: c.status === 'ENABLED' ? '#dcfce7' : '#f1f1f6', color: c.status === 'ENABLED' ? GRN : '#6b6b70' }}>{c.status}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmt(c.cost_usd || 0)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{(c.clicks || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{(c.conversions || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{c.conversions > 0 ? fmt(c.cost_usd / c.conversions) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data?.campaigns?.length && !loading && (
            <div style={{ ...card, textAlign: 'center', padding: 40, color: '#8e8e93' }}>
              <BarChart2 size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, marginBottom: 4 }}>No ads data yet</div>
              <div style={{ fontSize: 13 }}>Click "Sync Google Ads" to import your campaign data</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
