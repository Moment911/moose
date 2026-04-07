"use client"
import { useState, useEffect } from 'react'
import {
  CreditCard, Check, Zap, Users, BarChart2, Shield, Loader2, Star,
  AlertCircle, RefreshCw, DollarSign, Phone, MessageSquare, FileText,
  TrendingUp, Plus, Send, ChevronRight, X, ArrowUpRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const PLANS = [
  { id: 'starter', name: 'Starter', price: 297, features: ['25 clients', '3 seats', 'SEO Hub', 'Reviews', 'Scout', 'KotoDesk'] },
  { id: 'growth', name: 'Growth', price: 597, popular: true, features: ['100 clients', '10 seats', 'Voice Agent', 'Answering', 'White-label portal', 'Priority support'] },
  { id: 'agency', name: 'Agency', price: 997, features: ['Unlimited clients', 'Unlimited seats', 'All features', 'API access', 'Custom branding', 'Dedicated support'] },
]

const CREDIT_AMOUNTS = [50, 100, 250, 500]

const TABS = ['Overview', 'Credits', 'Usage', 'Invoices', 'Client Billing']

function StatCard({ label, value, icon: Icon, accent = T }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>{value}</div>
          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState(null)
  const [balance, setBalance] = useState(null)
  const [usage, setUsage] = useState([])
  const [invoices, setInvoices] = useState([])
  const [clientInvoices, setClientInvoices] = useState([])
  const [clientPricing, setClientPricing] = useState([])
  const [purchasing, setPurchasing] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [clientProfit, setClientProfit] = useState([])

  useEffect(() => { loadDashboard() }, [aid])
  useEffect(() => { loadTabData() }, [tab])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [dashRes, profRes] = await Promise.all([
        fetch(`/api/billing?action=get_dashboard&agency_id=${aid}`),
        fetch(`/api/billing?action=get_client_profitability&agency_id=${aid}`),
      ])
      setDash(await dashRes.json())
      const profData = await profRes.json()
      if (Array.isArray(profData)) setClientProfit(profData)
    } catch {}
    setLoading(false)
  }

  async function loadTabData() {
    try {
      if (tab === 1) {
        const res = await fetch(`/api/billing?action=get_balance&agency_id=${aid}`)
        setBalance(await res.json())
      } else if (tab === 2) {
        const res = await fetch(`/api/billing?action=get_usage&agency_id=${aid}`)
        setUsage(await res.json())
      } else if (tab === 3) {
        const res = await fetch(`/api/billing?action=get_invoices&agency_id=${aid}`)
        setInvoices(await res.json())
      } else if (tab === 4) {
        const [invRes, prRes] = await Promise.all([
          fetch(`/api/billing?action=get_client_invoices&agency_id=${aid}`),
          fetch(`/api/billing?action=get_client_pricing&agency_id=${aid}`),
        ])
        setClientInvoices(await invRes.json())
        setClientPricing(await prRes.json())
      }
    } catch {}
  }

  async function purchaseCredits(amount) {
    setPurchasing(true)
    try {
      const res = await fetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purchase_credits', agency_id: aid, amount }),
      })
      const data = await res.json()
      if (data.balance !== undefined) {
        toast.success(`$${amount} credits added! Balance: $${data.balance.toFixed(2)}`)
        loadDashboard()
        loadTabData()
      } else {
        toast.error(data.error || 'Purchase failed')
      }
    } catch { toast.error('Purchase failed') }
    setPurchasing(false)
  }

  async function initBilling() {
    await fetch('/api/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_billing_account', agency_id: aid }),
    })
    toast.success('Billing account created')
    loadDashboard()
  }

  const statusColor = (s) => s === 'paid' ? GRN : s === 'sent' || s === 'open' ? T : s === 'overdue' || s === 'past_due' ? R : '#6b7280'

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: BLK, padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em' }}>Billing</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '4px 0 0' }}>Credits, usage, invoices, client billing</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowUpgrade(true)} style={{ background: R, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} /> Upgrade Plan
              </button>
            </div>
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

          {/* Overview Tab */}
          {tab === 0 && (
            <div>
              {/* Plan + Balance row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                <StatCard label="Current Plan" value={dash?.plan?.toUpperCase() || 'STARTER'} icon={Shield} accent={R} />
                <StatCard label="Credit Balance" value={`$${Number(dash?.credit_balance || 0).toFixed(2)}`} icon={DollarSign} accent={Number(dash?.credit_balance || 0) < 20 ? R : GRN} />
                <StatCard label="Usage This Month" value={`$${Number(dash?.usage_this_month || 0).toFixed(2)}`} icon={TrendingUp} accent={T} />
                <StatCard label="Plan Price" value={`$${dash?.plan_price || 297}/mo`} icon={CreditCard} accent={AMB} />
              </div>

              {/* Low balance warning */}
              {Number(dash?.credit_balance || 0) < 20 && (
                <div style={{ background: R + '08', border: `1px solid ${R}30`, borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AlertCircle size={18} color={R} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: R, fontFamily: FH }}>Low Credit Balance</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Your balance is below $20. Voice calls and SMS may be interrupted.</div>
                  </div>
                  <button onClick={() => purchaseCredits(100)} style={{ background: R, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH }}>Add $100</button>
                </div>
              )}

              {/* Usage by feature */}
              {dash?.usage_by_feature && Object.keys(dash.usage_by_feature).length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Usage Breakdown</div>
                  {Object.entries(dash.usage_by_feature).map(([feature, data]) => {
                    const d = data
                    const maxCost = Math.max(...Object.values(dash.usage_by_feature).map(v => v.cost || 0), 1)
                    return (
                      <div key={feature} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK }}>{feature.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 700, color: BLK }}>${d.cost.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: '#ececea', overflow: 'hidden' }}>
                          <div style={{ width: `${(d.cost / maxCost) * 100}%`, height: '100%', background: T, borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Client Profitability */}
              {clientProfit.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Client Profitability</div>
                    <span style={{ fontSize: 11, color: '#9a9a96' }}>Your cost vs what you charge</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                        {['Client', 'Your Cost', 'Client Revenue', 'Margin'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientProfit.map(c => (
                        <tr key={c.client_id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: BLK }}>{c.name}</td>
                          <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: R }}>${c.cost.toFixed(2)}</td>
                          <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: GRN }}>${c.revenue.toFixed(2)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontFamily: FH, fontWeight: 800, color: c.margin >= 0 ? GRN : R }}>${c.margin.toFixed(2)}</span>
                            {c.revenue > 0 && <span style={{ fontSize: 11, color: '#9a9a96', marginLeft: 6 }}>({Math.round(c.margin / c.revenue * 100)}%)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent transactions */}
              {dash?.recent_transactions?.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Recent Transactions</div>
                  </div>
                  <div style={{ padding: '4px 12px' }}>
                    {dash.recent_transactions.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: Number(t.amount) >= 0 ? GRN : R, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, color: BLK }}>{t.type}</div>
                        <div style={{ fontFamily: FH, fontWeight: 700, color: Number(t.amount) >= 0 ? GRN : R }}>{Number(t.amount) >= 0 ? '+' : ''}${Number(t.amount).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Init billing if no account */}
              {!dash?.plan && !loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <button onClick={initBilling} style={{ background: R, border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: FH }}>
                    Activate Billing Account
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Credits Tab */}
          {tab === 1 && (
            <div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 24, marginBottom: 20 }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Purchase Credits</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  {CREDIT_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => purchaseCredits(amt)} disabled={purchasing}
                      style={{
                        padding: '20px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb',
                        background: '#fff', cursor: purchasing ? 'wait' : 'pointer', textAlign: 'center',
                        transition: 'all .15s', fontFamily: FH,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = R; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'none' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: BLK }}>${amt}</div>
                      <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 4 }}>Add credits</div>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#f9fafb', borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>Auto-Recharge</div>
                    <div style={{ fontSize: 12, color: '#9a9a96' }}>Automatically add credits when balance drops below threshold</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: balance?.auto_recharge ? GRN : '#9a9a96', fontFamily: FH }}>
                    {balance?.auto_recharge ? `ON — below $${balance.threshold} → add $${balance.recharge_amount}` : 'OFF'}
                  </div>
                </div>
              </div>
              {/* Transaction history */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Transaction History</div>
                </div>
                <div style={{ padding: '4px 12px' }}>
                  {(balance?.transactions || []).length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No transactions yet</div>
                  ) : (balance?.transactions || []).map((t, i) => (
                    <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.type === 'purchase' || t.type === 'bonus' ? GRN : t.type === 'usage' ? AMB : '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: BLK, fontWeight: 600 }}>{t.description || t.type}</div>
                        <div style={{ fontSize: 11, color: '#9a9a96' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</div>
                      </div>
                      <div style={{ fontFamily: FH, fontWeight: 700, color: Number(t.amount) >= 0 ? GRN : R }}>
                        {Number(t.amount) >= 0 ? '+' : ''}${Number(t.amount).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH }}>${Number(t.balance_after).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Usage Tab */}
          {tab === 2 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Usage This Month</div>
                <span style={{ fontSize: 12, color: '#9a9a96' }}>{usage.length} records</span>
              </div>
              <div style={{ padding: '4px 12px' }}>
                {usage.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No usage recorded this month</div>
                ) : usage.map((u, i) => (
                  <div key={u.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{u.feature?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 11, color: '#9a9a96' }}>{u.quantity} {u.unit} @ ${Number(u.unit_cost).toFixed(4)}/{u.unit}</div>
                    </div>
                    <div style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(u.total_cost).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {tab === 3 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Invoices from Koto</div>
              </div>
              <div style={{ padding: '4px 12px' }}>
                {invoices.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No invoices yet</div>
                ) : invoices.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{inv.invoice_number || '—'}</div>
                      <div style={{ fontSize: 11, color: '#9a9a96' }}>{inv.billing_period_start} — {inv.billing_period_end}</div>
                    </div>
                    <div style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(inv.total || 0).toFixed(2)}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: statusColor(inv.status) + '15', color: statusColor(inv.status), textTransform: 'uppercase' }}>{inv.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client Billing Tab */}
          {tab === 4 && (
            <div>
              {/* Client Pricing */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Client Pricing</div>
                </div>
                <div style={{ padding: '4px 12px' }}>
                  {clientPricing.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No client pricing configured yet</div>
                  ) : clientPricing.map(cp => (
                    <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>Client {(cp.client_id || '').slice(0, 8)}...</div>
                        <div style={{ fontSize: 11, color: '#9a9a96' }}>Retainer: ${cp.monthly_retainer}/mo · Voice: ${cp.voice_call_rate}/min · SMS: ${cp.sms_rate}/msg</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cp.auto_invoice ? GRN : '#9a9a96' }}>{cp.auto_invoice ? 'Auto-Invoice' : 'Manual'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Invoices Sent */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Invoices Sent to Clients</div>
                </div>
                <div style={{ padding: '4px 12px' }}>
                  {clientInvoices.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No client invoices yet</div>
                  ) : clientInvoices.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: '1px solid #f8f8f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{inv.invoice_number}</div>
                        <div style={{ fontSize: 11, color: '#9a9a96' }}>Client {(inv.client_id || '').slice(0, 8)}... · Due: {inv.due_date}</div>
                      </div>
                      <div style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(inv.total || 0).toFixed(2)}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: statusColor(inv.status) + '15', color: statusColor(inv.status), textTransform: 'uppercase' }}>{inv.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowUpgrade(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 900, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0 }}>Choose Your Plan</h2>
              <button onClick={() => setShowUpgrade(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a96' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {PLANS.map(p => (
                <div key={p.id} style={{
                  border: p.popular ? `2px solid ${R}` : '1.5px solid #e5e7eb',
                  borderRadius: 16, padding: 24, position: 'relative',
                }}>
                  {p.popular && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: R, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em' }}>Most Popular</div>
                  )}
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 800, color: BLK, marginBottom: 16 }}>${p.price}<span style={{ fontSize: 14, color: '#9a9a96' }}>/mo</span></div>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Check size={14} color={GRN} /><span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                    </div>
                  ))}
                  <button onClick={async () => {
                    await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change_plan', agency_id: aid, plan: p.id }) })
                    toast.success(`Switched to ${p.name}!`)
                    setShowUpgrade(false)
                    loadDashboard()
                  }} style={{
                    width: '100%', marginTop: 16, background: p.popular ? R : BLK, border: 'none',
                    color: '#fff', padding: '12px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                    fontWeight: 700, fontFamily: FH,
                  }}>
                    {dash?.plan === p.id ? 'Current Plan' : `Switch to ${p.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
