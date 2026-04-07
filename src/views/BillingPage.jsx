"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, Check, Zap, Users, BarChart2, Shield, DollarSign,
  AlertCircle, RefreshCw, TrendingUp, Plus, X, FileText,
  ArrowUpRight, Package, Tag, Building2, ChevronRight, Star
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const CREDIT_AMOUNTS = [50, 100, 250, 500]

const PLANS = [
  { id: 'starter', name: 'Starter', price: 297, features: ['25 clients', '3 seats', 'SEO Hub', 'Reviews', 'Scout', 'KotoDesk'] },
  { id: 'growth', name: 'Growth', price: 597, popular: true, features: ['100 clients', '10 seats', 'Voice Agent', 'Answering', 'White-label portal', 'Priority support'] },
  { id: 'agency', name: 'Agency', price: 997, features: ['Unlimited clients', 'Unlimited seats', 'All features', 'API access', 'Custom branding', 'Dedicated support'] },
]

// ─── Module-level helper components ──────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent = T, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>{value}</div>
          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: accent, marginTop: 3, fontFamily: FH, fontWeight: 600 }}>{sub}</div>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
      background: color + '18', color, textTransform: 'uppercase',
      letterSpacing: '.05em', fontFamily: FH, display: 'inline-block',
    }}>{label}</span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillingPage() {
  const navigate = useNavigate()
  const { agencyId, isSuperAdmin, user } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState(null)
  const [balance, setBalance] = useState(null)
  const [usage, setUsage] = useState([])
  const [invoices, setInvoices] = useState([])
  const [clientInvoices, setClientInvoices] = useState([])
  const [clientPricing, setClientPricing] = useState([])
  const [agencies, setAgencies] = useState([])
  const [stripeOverview, setStripeOverview] = useState(null)
  const [stripeInvoices, setStripeInvoices] = useState([])
  const [purchasing, setPurchasing] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [redeemingPromo, setRedeemingPromo] = useState(false)

  const TABS = isSuperAdmin
    ? ['Platform Overview', 'Agencies', 'Invoices', 'Credits & Usage', 'Client Billing', 'Stripe']
    : ['Overview', 'Credits', 'Usage', 'Invoices', 'Client Billing']

  useEffect(() => { loadDashboard() }, [aid])
  useEffect(() => { loadTabData() }, [tab, isSuperAdmin])

  async function loadDashboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/billing?action=get_dashboard&agency_id=${aid}`)
      setDash(await res.json())
    } catch {}
    setLoading(false)
  }

  async function loadTabData() {
    try {
      if (isSuperAdmin) {
        if (tab === 0) {
          const [ovRes, mrrRes] = await Promise.all([
            fetch('/api/billing?action=get_stripe_overview'),
            fetch('/api/billing?action=get_mrr'),
          ])
          const ov = await ovRes.json()
          const mrr = await mrrRes.json()
          setStripeOverview({ ...ov, ...mrr })
        } else if (tab === 1) {
          const res = await fetch('/api/billing?action=get_all_agencies_billing')
          const data = await res.json()
          if (Array.isArray(data)) setAgencies(data)
        } else if (tab === 2) {
          const [kotoRes, stripeRes] = await Promise.all([
            fetch(`/api/billing?action=get_invoices&agency_id=${aid}`),
            fetch('/api/billing?action=get_stripe_invoices'),
          ])
          setInvoices(await kotoRes.json())
          const si = await stripeRes.json()
          if (Array.isArray(si)) setStripeInvoices(si)
        } else if (tab === 3) {
          const [balRes, usageRes] = await Promise.all([
            fetch(`/api/billing?action=get_balance&agency_id=${aid}`),
            fetch(`/api/billing?action=get_usage&agency_id=${aid}`),
          ])
          setBalance(await balRes.json())
          setUsage(await usageRes.json())
        } else if (tab === 4) {
          const [invRes, prRes] = await Promise.all([
            fetch(`/api/billing?action=get_client_invoices&agency_id=${aid}`),
            fetch(`/api/billing?action=get_client_pricing&agency_id=${aid}`),
          ])
          setClientInvoices(await invRes.json())
          setClientPricing(await prRes.json())
        } else if (tab === 5) {
          const res = await fetch('/api/stripe-admin?action=list_products')
          const data = await res.json()
          if (data.products) setStripeOverview(prev => ({ ...prev, products: data.products }))
        }
      } else {
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
        loadDashboard(); loadTabData()
      } else {
        toast.error(data.error || 'Purchase failed')
      }
    } catch { toast.error('Purchase failed') }
    setPurchasing(false)
  }

  async function redeemPromo() {
    if (!promoCode.trim()) return
    setRedeemingPromo(true)
    try {
      const res = await fetch('/api/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem_promo', agency_id: aid, code: promoCode.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Promo code applied!')
        setPromoCode(''); loadDashboard()
      } else {
        toast.error(data.error || 'Invalid promo code')
      }
    } catch { toast.error('Failed to apply code') }
    setRedeemingPromo(false)
  }

  async function syncStripe() {
    try {
      await fetch('/api/stripe-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_products' }) })
      toast.success('Synced from Stripe')
      loadTabData()
    } catch { toast.error('Sync failed') }
  }

  function statusColor(s) {
    if (s === 'paid') return GRN
    if (s === 'sent' || s === 'open') return T
    if (s === 'overdue' || s === 'past_due') return R
    return '#6b7280'
  }

  // ─── Render helpers (no hooks) ────────────────────────────────────────────

  function renderPlatformOverview() {
    const ov = stripeOverview || {}
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          <StatCard label="MRR" value={`$${Number(ov.mrr || 0).toLocaleString()}`} icon={TrendingUp} accent={GRN} />
          <StatCard label="ARR" value={`$${Number((ov.mrr || 0) * 12).toLocaleString()}`} icon={ArrowUpRight} accent={T} />
          <StatCard label="Active Subscriptions" value={ov.active_subscriptions || ov.total_agencies || '—'} icon={Users} accent={R} />
          <StatCard label="Past Due" value={ov.past_due || '0'} icon={AlertCircle} accent={AMB} />
          <StatCard label="Credits Sold" value={`$${Number(ov.credits_purchased_this_month || 0).toLocaleString()}`} icon={CreditCard} accent={T} />
          <StatCard label="Failed Payments" value={ov.failed_payments || '0'} icon={X} accent={R} />
        </div>
        {ov.by_plan && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20 }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>Revenue by Plan</div>
            {Object.entries(ov.by_plan).map(([plan, count]) => (
              <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f2f2f0' }}>
                <span style={{ fontFamily: FH, fontWeight: 600, color: BLK, textTransform: 'capitalize' }}>{plan}</span>
                <Badge label={`${count} agencies`} color={T} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderAgencies() {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>All Agencies</div>
          <span style={{ fontSize: 12, color: '#9a9a96' }}>{agencies.length} agencies</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f2f2f0', background: '#fafafa' }}>
              {['Agency', 'Plan', 'Price', 'Balance', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agencies.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>No agencies found</td></tr>
            ) : agencies.map(ag => (
              <tr key={ag.id || ag.agency_id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, color: BLK }}>{ag.name || ag.brand_name || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: '#9a9a96' }}>{ag.id || ag.agency_id}</div>
                </td>
                <td style={{ padding: '12px 14px' }}><Badge label={ag.plan || 'starter'} color={ag.plan === 'agency' ? R : ag.plan === 'growth' ? T : AMB} /></td>
                <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: BLK }}>${ag.plan_price || 297}/mo</td>
                <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: Number(ag.credit_balance || 0) < 20 ? R : GRN }}>${Number(ag.credit_balance || 0).toFixed(2)}</td>
                <td style={{ padding: '12px 14px' }}><Badge label={ag.billing_status || 'active'} color={statusColor(ag.billing_status || 'active')} /></td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => navigate(`/billing-admin?agency=${ag.id || ag.agency_id}`)}
                    style={{ background: 'none', border: `1px solid #e5e7eb`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FH, color: BLK, display: 'flex', alignItems: 'center', gap: 4 }}>
                    View <ChevronRight size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderInvoicesTab() {
    const allInvoices = [
      ...(Array.isArray(invoices) ? invoices.map(i => ({ ...i, _src: 'koto' })) : []),
      ...(Array.isArray(stripeInvoices) ? stripeInvoices.map(i => ({ ...i, _src: 'stripe' })) : []),
    ]
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
            {isSuperAdmin ? 'All Invoices (Koto + Stripe)' : 'Invoices from Koto'}
          </div>
        </div>
        {allInvoices.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No invoices yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f2f2f0', background: '#fafafa' }}>
                {['Invoice', 'Period', 'Amount', 'Status', isSuperAdmin ? 'Source' : null].filter(Boolean).map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allInvoices.map((inv, i) => (
                <tr key={inv.id || i} style={{ borderBottom: '1px solid #f8f8f6' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: BLK }}>{inv.invoice_number || inv.number || '—'}</td>
                  <td style={{ padding: '12px 14px', color: '#6b7280' }}>{inv.billing_period_start || inv.period_start || '—'} — {inv.billing_period_end || inv.period_end || ''}</td>
                  <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(inv.total || inv.amount_due || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px 14px' }}><Badge label={inv.status || 'open'} color={statusColor(inv.status)} /></td>
                  {isSuperAdmin && <td style={{ padding: '12px 14px' }}><Badge label={inv._src} color={inv._src === 'stripe' ? AMB : T} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  function renderCreditsUsage() {
    return (
      <div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 24, marginBottom: 20 }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Purchase Credits</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {CREDIT_AMOUNTS.map(amt => (
              <button key={amt} onClick={() => purchaseCredits(amt)} disabled={purchasing}
                style={{ padding: '20px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', cursor: purchasing ? 'wait' : 'pointer', textAlign: 'center', transition: 'all .15s', fontFamily: FH }}
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

        {/* Usage records */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Usage This Month</div>
            <span style={{ fontSize: 12, color: '#9a9a96' }}>{usage.length} records</span>
          </div>
          <div style={{ padding: '4px 12px' }}>
            {usage.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No usage this month</div>
            ) : usage.map((u, i) => (
              <div key={u.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{u.feature?.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 11, color: '#9a9a96' }}>{u.quantity} {u.unit} @ ${Number(u.unit_cost || 0).toFixed(4)}/{u.unit}</div>
                </div>
                <div style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(u.total_cost || 0).toFixed(2)}</div>
              </div>
            ))}
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
            ) : (balance.transactions || []).map((t, i) => (
              <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.type === 'purchase' || t.type === 'bonus' ? GRN : AMB, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: BLK, fontWeight: 600 }}>{t.description || t.type}</div>
                  <div style={{ fontSize: 11, color: '#9a9a96' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</div>
                </div>
                <div style={{ fontFamily: FH, fontWeight: 700, color: Number(t.amount) >= 0 ? GRN : R }}>
                  {Number(t.amount) >= 0 ? '+' : ''}${Number(t.amount).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH }}>${Number(t.balance_after || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderOverviewAgency() {
    const balance = Number(dash?.credit_balance || 0)
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <StatCard label="Current Plan" value={dash?.plan?.toUpperCase() || 'STARTER'} icon={Shield} accent={R} />
          <StatCard label="Credit Balance" value={`$${balance.toFixed(2)}`} icon={DollarSign} accent={balance < 20 ? R : GRN} />
          <StatCard label="Usage This Month" value={`$${Number(dash?.usage_this_month || 0).toFixed(2)}`} icon={TrendingUp} accent={T} />
          <StatCard label="Plan Price" value={`$${dash?.plan_price || 297}/mo`} icon={CreditCard} accent={AMB} />
        </div>

        {balance < 20 && (
          <div style={{ background: R + '08', border: `1px solid ${R}30`, borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertCircle size={18} color={R} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: R, fontFamily: FH }}>Low Credit Balance</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Your balance is below $20. Voice calls and SMS may be interrupted.</div>
            </div>
            <button onClick={() => purchaseCredits(100)} style={{ background: R, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH }}>Add $100</button>
          </div>
        )}

        {/* Promo code */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 20 }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Promo Code</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              onKeyDown={e => e.key === 'Enter' && redeemPromo()}
              style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: FH, outline: 'none' }}
            />
            <button onClick={redeemPromo} disabled={redeemingPromo || !promoCode.trim()}
              style={{ background: R, border: 'none', color: '#fff', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH, opacity: redeemingPromo || !promoCode.trim() ? .5 : 1 }}>
              {redeemingPromo ? '...' : 'Apply'}
            </button>
          </div>
        </div>

        {/* Usage breakdown */}
        {dash?.usage_by_feature && Object.keys(dash.usage_by_feature).length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, marginBottom: 20 }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Usage Breakdown</div>
            {Object.entries(dash.usage_by_feature).map(([feature, data]) => {
              const maxCost = Math.max(...Object.values(dash.usage_by_feature).map(v => v.cost || 0), 1)
              return (
                <div key={feature} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK }}>{feature.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 700, color: BLK }}>${(data.cost || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#ececea', overflow: 'hidden' }}>
                    <div style={{ width: `${((data.cost || 0) / maxCost) * 100}%`, height: '100%', background: T, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
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
      </div>
    )
  }

  function renderCreditsTabAgency() {
    return (
      <div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 24, marginBottom: 20 }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16 }}>Purchase Credits</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {CREDIT_AMOUNTS.map(amt => (
              <button key={amt} onClick={() => purchaseCredits(amt)} disabled={purchasing}
                style={{ padding: '20px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', cursor: purchasing ? 'wait' : 'pointer', textAlign: 'center', transition: 'all .15s', fontFamily: FH }}
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
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Transaction History</div>
          </div>
          <div style={{ padding: '4px 12px' }}>
            {(balance?.transactions || []).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No transactions yet</div>
            ) : (balance.transactions || []).map((t, i) => (
              <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid #f8f8f6' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.type === 'purchase' || t.type === 'bonus' ? GRN : AMB, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: BLK, fontWeight: 600 }}>{t.description || t.type}</div>
                  <div style={{ fontSize: 11, color: '#9a9a96' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</div>
                </div>
                <div style={{ fontFamily: FH, fontWeight: 700, color: Number(t.amount) >= 0 ? GRN : R }}>
                  {Number(t.amount) >= 0 ? '+' : ''}${Number(t.amount).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH }}>${Number(t.balance_after || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderUsageTab() {
    return (
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
                <div style={{ fontSize: 11, color: '#9a9a96' }}>{u.quantity} {u.unit} @ ${Number(u.unit_cost || 0).toFixed(4)}/{u.unit}</div>
              </div>
              <div style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>${Number(u.total_cost || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderClientBilling() {
    return (
      <div>
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
                <Badge label={cp.auto_invoice ? 'Auto-Invoice' : 'Manual'} color={cp.auto_invoice ? GRN : '#9a9a96'} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Invoices Sent to Clients</div>
            <button onClick={() => navigate('/invoice-builder')}
              style={{ background: R, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={13} /> Create Invoice
            </button>
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
                <Badge label={inv.status || 'draft'} color={statusColor(inv.status)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStripeProducts() {
    const products = stripeOverview?.products || []
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={syncStripe}
            style={{ background: BLK, border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Sync from Stripe
          </button>
          <button onClick={() => navigate('/stripe-products/new')}
            style={{ background: R, border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Create Product
          </button>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Stripe Products</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f2f2f0', background: '#fafafa' }}>
                {['Name', 'ID', 'Price', 'Active'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9a9a96' }}>No products — sync from Stripe to load</td></tr>
              ) : products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: BLK }}>{p.name}</td>
                  <td style={{ padding: '12px 14px', color: '#9a9a96', fontSize: 11, fontFamily: 'monospace' }}>{p.id}</td>
                  <td style={{ padding: '12px 14px', fontFamily: FH, fontWeight: 700, color: BLK }}>{p.default_price ? `$${(p.default_price.unit_amount / 100).toFixed(2)}/${p.default_price.recurring?.interval || 'once'}` : '—'}</td>
                  <td style={{ padding: '12px 14px' }}><Badge label={p.active ? 'Active' : 'Inactive'} color={p.active ? GRN : '#9a9a96'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderTabContent() {
    if (isSuperAdmin) {
      if (tab === 0) return renderPlatformOverview()
      if (tab === 1) return renderAgencies()
      if (tab === 2) return renderInvoicesTab()
      if (tab === 3) return renderCreditsUsage()
      if (tab === 4) return renderClientBilling()
      if (tab === 5) return renderStripeProducts()
    } else {
      if (tab === 0) return renderOverviewAgency()
      if (tab === 1) return renderCreditsTabAgency()
      if (tab === 2) return renderUsageTab()
      if (tab === 3) return renderInvoicesTab()
      if (tab === 4) return renderClientBilling()
    }
    return null
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: BLK, padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em' }}>
                {isSuperAdmin ? 'Platform Billing' : 'Billing'}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '4px 0 0' }}>
                {isSuperAdmin ? 'Revenue, agencies, invoices, and Stripe' : 'Credits, usage, invoices, client billing'}
              </p>
            </div>
            {!isSuperAdmin && (
              <button onClick={() => setShowUpgrade(true)} style={{ background: R, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} /> Upgrade Plan
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: tab === i ? 700 : 500, fontFamily: FH,
                color: tab === i ? '#fff' : 'rgba(255,255,255,.4)', background: 'transparent',
                borderBottom: tab === i ? `2px solid ${R}` : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {loading && tab === 0 && !isSuperAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div style={{ fontSize: 13, color: '#9a9a96', fontFamily: FH }}>Loading...</div>
            </div>
          ) : renderTabContent()}
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowUpgrade(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 900, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0 }}>Choose Your Plan</h2>
              <button onClick={() => setShowUpgrade(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a96' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {PLANS.map(p => (
                <div key={p.id} style={{ border: p.popular ? `2px solid ${R}` : '1.5px solid #e5e7eb', borderRadius: 16, padding: 24, position: 'relative' }}>
                  {p.popular && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: R, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                      Most Popular
                    </div>
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
                    setShowUpgrade(false); loadDashboard()
                  }} style={{ width: '100%', marginTop: 16, background: p.popular ? R : BLK, border: 'none', color: '#fff', padding: 12, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: FH }}>
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
