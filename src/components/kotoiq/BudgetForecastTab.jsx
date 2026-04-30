"use client"
import { useState, useEffect } from 'react'
import { DollarSign, Loader2, TrendingUp, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }
const PACING_COLORS = { on_track: GRN, over_pace: AMB, under_pace: T, critical: R }
const PACING_LABELS = { on_track: 'On Track', over_pace: 'Over Pacing', under_pace: 'Under Pacing', critical: 'Critical' }

function fmt(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${(n || 0).toFixed(2)}` }

export default function BudgetForecastTab({ clientId, agencyId }) {
  const [forecast, setForecast] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [horizon, setHorizon] = useState(30)

  const load = async () => {
    if (!clientId) return
    try {
      const [fRes, tRes] = await Promise.all([
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'budget_get_forecast', client_id: clientId }) }).then(r => r.json()),
        fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'budget_daily_trend', client_id: clientId, days: 30 }) }).then(r => r.json()),
      ])
      if (fRes.data) setForecast(fRes.data)
      if (tRes.data) setTrend(tRes.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [clientId])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'budget_forecast', client_id: clientId, agency_id: agencyId, horizon_days: horizon }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setForecast(json)
      toast.success('Forecast generated')
      load()
    } catch (e) { toast.error(e.message || 'Forecast failed') }
    finally { setGenerating(false) }
  }

  const p = forecast?.pacing_detail || {}
  const pacingColor = PACING_COLORS[forecast?.pacing_status] || T

  return (
    <div>
      <HowItWorks tool="budget-forecast" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Budget & Forecast</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={horizon} onChange={e => setHorizon(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={generate} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {generating ? 'Calculating...' : 'Generate Forecast'}
          </button>
        </div>
      </div>

      {loading ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><Loader2 size={24} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} /></div> : (
        <>
          {/* Pacing Alert Banner */}
          {forecast?.pacing_status && forecast.pacing_status !== 'on_track' && (
            <div style={{ ...card, background: forecast.pacing_status === 'critical' ? '#fef2f2' : '#fef9c3', borderColor: pacingColor, display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={20} color={pacingColor} />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 800, color: pacingColor }}>{PACING_LABELS[forecast.pacing_status]}</div>
                <div style={{ fontSize: 13, color: '#1f1f22' }}>
                  {forecast.pacing_status === 'critical' && `At current rate, you'll exceed your ${fmt(p.budget)} budget by ${fmt(p.projected_month_end - p.budget)}. `}
                  {forecast.pacing_status === 'over_pace' && `Projected to exceed ${fmt(p.budget)} budget by month end. `}
                  {forecast.pacing_status === 'under_pace' && `Spending below expected pace — consider increasing activity. `}
                  {p.days_until_exhausted != null && p.days_until_exhausted < 15 && `Budget exhausted in ~${p.days_until_exhausted} days.`}
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          {forecast && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ ...card, flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>Projected {horizon}d Total</div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: BLK }}>{fmt(forecast.total_projected)}</div>
              </div>
              <div style={{ ...card, flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>Daily Average</div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: T }}>{fmt(forecast.daily_avg_total)}</div>
              </div>
              <div style={{ ...card, flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>Pacing</div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: pacingColor }}>{PACING_LABELS[forecast.pacing_status] || 'N/A'}</div>
                <div style={{ fontSize: 11, color: '#6b6b70', marginTop: 2 }}>{fmt(p.spent_so_far || 0)} of {fmt(p.budget || 0)} this month</div>
              </div>
              <div style={{ ...card, flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>Days Until Exhausted</div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: p.days_until_exhausted != null && p.days_until_exhausted < 10 ? R : GRN }}>
                  {p.days_until_exhausted != null ? p.days_until_exhausted : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Spend Trend Chart */}
          {trend.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Daily Spend Trend</div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={d => d?.slice(5)} />
                  <YAxis fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, '']} labelFormatter={l => l} />
                  <Area type="monotone" dataKey="ad_spend" stackId="1" stroke={T} fill={T} fillOpacity={0.3} name="Ad Spend" />
                  <Area type="monotone" dataKey="ai_cost" stackId="1" stroke={AMB} fill={AMB} fillOpacity={0.3} name="AI Costs" />
                  <Area type="monotone" dataKey="api_cost" stackId="1" stroke={GRN} fill={GRN} fillOpacity={0.3} name="API Costs" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Breakdown Table */}
          {forecast && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Cost Breakdown</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Category', 'Daily Avg', `${horizon}d Projected`].map(h => (
                      <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', padding: '8px 6px', fontWeight: 700, color: '#6b6b70', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Ad Spend (all platforms)', daily: forecast.daily_avg_ad_spend, projected: forecast.ad_spend_projected, color: T },
                    { name: 'AI / LLM Costs', daily: forecast.daily_avg_ai_cost, projected: forecast.ai_cost_projected, color: AMB },
                    { name: 'API / Token Costs', daily: forecast.daily_avg_api_cost, projected: forecast.api_cost_projected, color: GRN },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8 }} />{row.name}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmt(row.daily)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>{fmt(row.projected)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Total</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 800 }}>{fmt(forecast.daily_avg_total)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{fmt(forecast.total_projected)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!forecast && !loading && (
            <div style={{ ...card, textAlign: 'center', padding: 40, color: '#8e8e93' }}>
              <DollarSign size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, marginBottom: 4 }}>No forecast data yet</div>
              <div style={{ fontSize: 13 }}>Click "Generate Forecast" to project your spend</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
