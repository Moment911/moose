"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Users, CreditCard, BarChart2, Phone,
  AlertCircle, Check, ChevronRight, Edit2, Loader2, RefreshCw,
  ArrowUpRight, ArrowDownRight, Shield, Zap, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R   = '#E6007E', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function StatCard({ label, value, icon: Icon, accent = T, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>{loading ? '—' : value}</div>
          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={accent} />
        </div>
      </div>
    </div>
  )
}

export default function BillingAdminPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [mrr, setMrr] = useState({ mrr: 0, by_plan: {}, total_agencies: 0, total_usage_revenue: 0, credits_purchased_this_month: 0, cancelled: 0 })
  const [agencies, setAgencies] = useState([])
  const [pricing, setPricing] = useState([])
  const [editingPrice, setEditingPrice] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [profitability, setProfitability] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [mrrRes, agRes, prRes, profRes] = await Promise.all([
        fetch('/api/billing?action=get_mrr').then(r => r.json()),
        fetch('/api/billing?action=get_all_agencies_billing').then(r => r.json()),
        fetch('/api/billing?action=get_platform_pricing').then(r => r.json()),
        fetch('/api/billing?action=get_profitability').then(r => r.json()),
      ])
      setMrr(mrrRes)
      setAgencies(Array.isArray(agRes) ? agRes : [])
      setPricing(Array.isArray(prRes) ? prRes : [])
      if (profRes && !profRes.error) setProfitability(profRes)
    } catch {}
    setLoading(false)
  }

  async function savePrice(feature) {
    try {
      await fetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_platform_pricing', feature, cost_per_unit: parseFloat(editValue) }),
      })
      toast.success('Price updated')
      setEditingPrice(null)
      loadData()
    } catch { toast.error('Failed to update') }
  }

  async function adjustCredits(agencyId, amount) {
    const desc = prompt(`Description for ${amount >= 0 ? '+' : ''}$${amount} adjustment:`)
    if (!desc) return
    await fetch('/api/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_credits', agency_id: agencyId, amount, description: desc }),
    })
    toast.success('Credits adjusted')
    loadData()
  }

  async function changePlan(agencyId, plan) {
    await fetch('/api/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_plan', agency_id: agencyId, plan }),
    })
    toast.success(`Plan changed to ${plan}`)
    loadData()
  }

  const statusColor = (s) => s === 'active' ? GRN : s === 'past_due' ? AMB : s === 'cancelled' ? R : '#6b7280'
  const TABS = ['Revenue', 'Agencies', 'Profitability', 'Platform Pricing']

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: BLK, padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em' }}>Billing Admin</h1>
              <p style={{ fontSize: 13, color: '#999999', margin: '4px 0 0' }}>Platform revenue, agency billing, pricing</p>
            </div>
            <button onClick={loadData} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: tab === i ? 700 : 500, fontFamily: FH,
                color: tab === i ? '#fff' : 'rgba(255,255,255,.4)', background: 'transparent',
                borderBottom: tab === i ? `2px solid ${R}` : '2px solid transparent',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {/* Revenue Tab */}
          {tab === 0 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Monthly Recurring Revenue" value={`$${mrr.mrr?.toLocaleString()}`} icon={DollarSign} accent={GRN} loading={loading} />
                <StatCard label="Total Agencies" value={mrr.total_agencies} icon={Users} accent={T} loading={loading} />
                <StatCard label="Usage Revenue (Month)" value={`$${mrr.total_usage_revenue?.toFixed(2)}`} icon={TrendingUp} accent={AMB} loading={loading} />
                <StatCard label="Credits Purchased (Month)" value={`$${mrr.credits_purchased_this_month?.toFixed(2)}`} icon={CreditCard} accent={R} loading={loading} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Starter Plans" value={mrr.by_plan?.starter || 0} icon={Users} accent="#6b7280" loading={loading} />
                <StatCard label="Growth Plans" value={mrr.by_plan?.growth || 0} icon={Users} accent={T} loading={loading} />
                <StatCard label="Agency Plans" value={mrr.by_plan?.agency || 0} icon={Users} accent={R} loading={loading} />
                <StatCard label="Cancelled" value={mrr.cancelled || 0} icon={AlertCircle} accent={R} loading={loading} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 24 }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Revenue Breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Subscription Revenue</div>
                    <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 800, color: GRN }}>${mrr.mrr?.toLocaleString()}<span style={{ fontSize: 14, color: '#9a9a96' }}>/mo</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Usage + Credits Revenue</div>
                    <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 800, color: T }}>${(mrr.total_usage_revenue + mrr.credits_purchased_this_month).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agencies Tab */}
          {tab === 1 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>All Agencies</div>
                <span style={{ fontSize: 12, color: '#9a9a96' }}>{agencies.length} total</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                      {['Agency', 'Plan', 'Price', 'Balance', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: BLK }}>{a.agencies?.brand_name || a.agencies?.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9a9a96' }}>{a.agencies?.owner_email || ''}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: a.plan === 'agency' ? R + '15' : a.plan === 'growth' ? T + '15' : '#f2f2f0', color: a.plan === 'agency' ? R : a.plan === 'growth' ? T : '#6b7280', textTransform: 'uppercase' }}>{a.plan}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700 }}>${Number(a.plan_price || 0).toFixed(0)}/mo</td>
                        <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: Number(a.credit_balance || 0) < 20 ? R : BLK }}>${Number(a.credit_balance || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: statusColor(a.status) + '15', color: statusColor(a.status), textTransform: 'uppercase' }}>{a.status}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => adjustCredits(a.agency_id, 50)} style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: 'none', background: GRN + '15', color: GRN, cursor: 'pointer' }}>+$50</button>
                            <select onChange={e => { if (e.target.value) changePlan(a.agency_id, e.target.value); e.target.value = '' }} style={{ fontSize: 10, fontWeight: 700, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff' }}>
                              <option value="">Plan...</option>
                              {Object.keys(PLANS).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profitability Tab */}
          {tab === 2 && profitability && (
            <div>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Usage Revenue" value={`$${profitability.total_revenue?.toFixed(2)}`} icon={DollarSign} accent={GRN} loading={loading} />
                <StatCard label="Platform Cost" value={`$${profitability.total_cost?.toFixed(2)}`} icon={DollarSign} accent={R} loading={loading} />
                <StatCard label="Gross Margin" value={`$${profitability.total_margin?.toFixed(2)}`} icon={TrendingUp} accent={T} loading={loading} />
                <StatCard label="Margin %" value={`${profitability.margin_pct}%`} icon={BarChart2} accent={profitability.margin_pct >= 50 ? GRN : profitability.margin_pct >= 20 ? AMB : R} loading={loading} />
              </div>

              {/* Revenue by feature */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Revenue vs Cost by Feature</div>
                </div>
                <div style={{ padding: '12px 20px' }}>
                  {(profitability.by_feature || []).length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No usage data this month yet</div>
                  ) : (profitability.by_feature || []).map(f => {
                    const maxVal = Math.max(...(profitability.by_feature || []).map(x => Math.max(x.revenue, x.cost)), 1)
                    return (
                      <div key={f.feature} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 700, color: BLK }}>{f.feature.replace(/_/g, ' ')}</span>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: FH }}>
                            <span style={{ color: GRN, fontWeight: 700 }}>Rev: ${Number(f.revenue||0).toFixed(2)}</span>
                            <span style={{ color: R, fontWeight: 700 }}>Cost: ${Number(f.cost||0).toFixed(2)}</span>
                            <span style={{ color: f.margin >= 0 ? GRN : R, fontWeight: 800 }}>Margin: ${Number(f.margin||0).toFixed(2)} ({f.margin_pct}%)</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, height: 8 }}>
                          <div style={{ width: `${(f.revenue / maxVal) * 100}%`, height: '100%', borderRadius: 4, background: GRN }} />
                          <div style={{ width: `${(f.cost / maxVal) * 100}%`, height: '100%', borderRadius: 4, background: R + '60' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Per-agency profitability */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Profitability by Agency</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                      {['Agency', 'Revenue', 'Cost', 'Margin', 'Margin %'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(profitability.by_agency || []).length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#9a9a96' }}>No agency usage data yet</td></tr>
                    ) : (profitability.by_agency || []).map(a => (
                      <tr key={a.agency_id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: BLK }}>{a.name}</td>
                        <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: GRN }}>${Number(a.revenue||0).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: R }}>${Number(a.cost||0).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 800, color: a.margin >= 0 ? GRN : R }}>${Number(a.margin||0).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: (a.revenue > 0 ? (a.margin / a.revenue * 100 >= 50 ? GRN : AMB) : '#6b7280') + '15', color: a.revenue > 0 ? (a.margin / a.revenue * 100 >= 50 ? GRN : AMB) : '#6b7280' }}>
                            {a.revenue > 0 ? Math.round(a.margin / a.revenue * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 2 && !profitability && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>Loading profitability data...</div>
          )}

          {/* Platform Pricing Tab */}
          {tab === 3 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Platform Pricing (Koto Cost Basis)</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                    {['Feature', 'Unit', 'Cost per Unit', 'Last Updated', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pricing.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: BLK }}>{p.feature}</td>
                      <td style={{ padding: '12px 14px', color: '#6b7280' }}>{p.unit}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {editingPrice === p.feature ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                            <button onClick={() => savePrice(p.feature)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: GRN + '15', color: GRN, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingPrice(null)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f2f2f0', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        ) : (
                          <span style={{ fontFamily: FH, fontWeight: 700 }}>${Number(p.cost_per_unit).toFixed(4)}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: '#9a9a96' }}>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {editingPrice !== p.feature && (
                          <button onClick={() => { setEditingPrice(p.feature); setEditValue(String(p.cost_per_unit)) }} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: T + '15', color: T, cursor: 'pointer' }}>
                            <Edit2 size={11} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PLANS = { starter: 297, growth: 597, agency: 997, enterprise: 1997 }
