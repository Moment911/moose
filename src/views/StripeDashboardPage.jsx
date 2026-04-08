"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, CreditCard, Users, TrendingUp, BarChart2, RefreshCw,
  Plus, Trash2, Edit2, X, Check, Loader2, ExternalLink, AlertCircle,
  Package, Percent, Tag
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R   = '#E6007E', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const fmt$ = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const statusColor = (s) => s === 'active' ? GRN : s === 'past_due' || s === 'unpaid' ? AMB : s === 'canceled' || s === 'void' ? R : '#6b7280'

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

const TH = ({ children }) => (
  <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</th>
)
const TD = ({ children, style }) => (
  <td style={{ padding: '12px 14px', fontSize: 13, ...style }}>{children}</td>
)
const Badge = ({ label, color }) => (
  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: color + '18', color, textTransform: 'uppercase' }}>{label}</span>
)
const Btn = ({ onClick, icon: Icon, label, accent = T, small }) => (
  <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: small ? 11 : 12, fontWeight: 700, fontFamily: FH, padding: small ? '4px 10px' : '8px 16px', borderRadius: 8, border: 'none', background: accent + '15', color: accent, cursor: 'pointer' }}>
    {Icon && <Icon size={small ? 11 : 13} />}{label}
  </button>
)

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FH, outline: 'none', boxSizing: 'border-box' }
const labelStyle = { fontSize: 12, fontWeight: 700, color: '#6b7280', fontFamily: FH, display: 'block', marginBottom: 4 }

export default function StripeDashboardPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [products, setProducts] = useState([])
  const [coupons, setCoupons] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [customers, setCustomers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [revenue, setRevenue] = useState({ mrr: 0, arr: 0, active_subscriptions: 0, failed_payments: 0 })
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', description: '', monthly_price: '', annual_price: '', category: 'plan', features: [] })
  const [couponForm, setCouponForm] = useState({ name: '', percent_off: '', amount_off: '', duration: 'once', duration_in_months: '', max_redemptions: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const results = await Promise.allSettled([
      fetch('/api/stripe-admin?action=get_revenue').then(r => r.json()),
      fetch('/api/stripe-admin?action=list_products').then(r => r.json()),
      fetch('/api/stripe-admin?action=list_subscriptions').then(r => r.json()),
      fetch('/api/stripe-admin?action=list_coupons').then(r => r.json()),
      fetch('/api/stripe-admin?action=list_invoices').then(r => r.json()),
    ])
    if (results[0].status === 'fulfilled' && results[0].value && !results[0].value.error) setRevenue(results[0].value)
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setProducts(results[1].value)
    if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) setSubscriptions(results[2].value)
    if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) setCoupons(results[3].value)
    if (results[4].status === 'fulfilled' && Array.isArray(results[4].value)) setInvoices(results[4].value)
    setLoading(false)
  }

  async function syncStripe() {
    setSyncing(true)
    try {
      const res = await fetch('/api/stripe-admin?action=sync', { method: 'POST' }).then(r => r.json())
      toast.success(`Synced: ${res.synced?.products || res.products || 0} products, ${res.synced?.prices || 0} prices, ${res.synced?.coupons || 0} coupons`)
      loadData()
    } catch { toast.error('Sync failed') }
    setSyncing(false)
  }

  async function saveProduct() {
    setSaving(true)
    try {
      if (editingProduct) {
        await fetch('/api/stripe-admin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_product', stripe_product_id: editingProduct.stripe_product_id, name: productForm.name, description: productForm.description }),
        })
        toast.success('Product updated in Stripe')
      } else {
        await fetch('/api/stripe-admin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_product', ...productForm }),
        })
        toast.success('Product created in Stripe')
      }
      setShowProductModal(false)
      setEditingProduct(null)
      setProductForm({ name: '', description: '', monthly_price: '', annual_price: '', category: 'plan', features: [] })
      loadData()
    } catch { toast.error('Failed to save product') }
    setSaving(false)
  }

  function openEditProduct(p) {
    setEditingProduct(p)
    setProductForm({
      name: p.name || '', description: p.description || '',
      monthly_price: p.monthly_price || '', annual_price: p.annual_price || '',
      category: p.metadata?.category || 'plan', features: [],
    })
    setShowProductModal(true)
  }

  async function saveCoupon() {
    setSaving(true)
    try {
      await fetch('/api/stripe-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_coupon', ...couponForm }),
      })
      toast.success('Coupon created')
      setShowCouponModal(false)
      setCouponForm({ name: '', percent_off: '', amount_off: '', duration: 'once', duration_in_months: '', max_redemptions: '' })
      loadData()
    } catch { toast.error('Failed to create coupon') }
    setSaving(false)
  }

  async function archiveProduct(stripeProductId) {
    if (!confirm('Archive this product in Stripe? This will deactivate it.')) return
    try {
      await fetch('/api/stripe-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive_product', stripe_product_id: stripeProductId }),
      })
      toast.success('Product archived in Stripe')
      loadData()
    } catch { toast.error('Failed to archive') }
  }

  async function cancelSubscription(id) {
    if (!confirm('Cancel this subscription?')) return
    try {
      await fetch('/api/stripe-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_subscription', subscription_id: id }),
      })
      toast.success('Subscription cancelled')
      loadData()
    } catch { toast.error('Failed to cancel') }
  }

  async function deleteCoupon(id) {
    if (!confirm('Delete this coupon?')) return
    try {
      await fetch('/api/stripe-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_coupon', coupon_id: id }),
      })
      toast.success('Coupon deleted')
      loadData()
    } catch { toast.error('Failed to delete coupon') }
  }

  const TABS = ['Overview', 'Products', 'Coupons', 'Subscriptions', 'Invoices']
  const recentInvoices = invoices.slice(0, 5)

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: BLK, padding: '20px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em' }}>Stripe Control Center</h1>
              <p style={{ fontSize: 13, color: '#999999', margin: '4px 0 0' }}>Products, subscriptions, coupons &amp; revenue</p>
            </div>
            <button onClick={syncStripe} disabled={syncing} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Sync
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{ padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === i ? 700 : 500, fontFamily: FH, color: tab === i ? '#fff' : 'rgba(255,255,255,.4)', background: 'transparent', borderBottom: tab === i ? `2px solid ${R}` : '2px solid transparent' }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

          {/* TAB 0 — OVERVIEW */}
          {tab === 0 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="MRR" value={fmt$(revenue.mrr)} icon={DollarSign} accent={GRN} loading={loading} />
                <StatCard label="ARR" value={fmt$(revenue.arr)} icon={TrendingUp} accent={T} loading={loading} />
                <StatCard label="Active Subscriptions" value={revenue.active_subscriptions} icon={Users} accent={AMB} loading={loading} />
                <StatCard label="Failed Payments" value={revenue.failed_payments} icon={AlertCircle} accent={R} loading={loading} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Recent Invoices</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                    {['Customer', 'Amount', 'Status', 'Date'].map(h => <TH key={h}>{h}</TH>)}
                  </tr></thead>
                  <tbody>
                    {recentInvoices.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No invoices yet</td></tr>
                    ) : recentInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                        <TD style={{ fontWeight: 600, color: BLK }}>{inv.customer_email || inv.customer_name || inv.customer || '—'}</TD>
                        <TD style={{ fontFamily: FH, fontWeight: 700 }}>{fmt$(inv.amount_paid ?? inv.amount)}</TD>
                        <TD><Badge label={inv.status || 'unknown'} color={statusColor(inv.status)} /></TD>
                        <TD style={{ color: '#9a9a96' }}>{inv.created ? new Date(inv.created * 1000).toLocaleDateString() : inv.date ? new Date(inv.date).toLocaleDateString() : '—'}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 1 — PRODUCTS */}
          {tab === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Btn onClick={() => { setEditingProduct(null); setProductForm({ name:'', description:'', monthly_price:'', annual_price:'', category:'plan', features:[] }); setShowProductModal(true) }} icon={Plus} label="Add Product" accent={T} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Products</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                    {['Name', 'Monthly', 'Annual', 'Active', 'Actions'].map(h => <TH key={h}>{h}</TH>)}
                  </tr></thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No products — click "Add Product" or "Sync" to pull from Stripe</td></tr>
                    ) : products.map(p => (
                      <tr key={p.stripe_product_id || p.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                        <TD>
                          <div style={{ fontWeight: 700, color: BLK }}>{p.name}</div>
                          {p.description && <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>{p.description}</div>}
                          <div style={{ fontSize: 10, color: '#c0c0c0', marginTop: 2, fontFamily: 'monospace' }}>{p.stripe_product_id}</div>
                        </TD>
                        <TD style={{ fontFamily: FH, fontWeight: 700 }}>{p.monthly_price ? `$${Number(p.monthly_price).toFixed(2)}` : '—'}</TD>
                        <TD style={{ fontFamily: FH, fontWeight: 700 }}>{p.annual_price ? `$${Number(p.annual_price).toFixed(2)}` : '—'}</TD>
                        <TD><Badge label={p.is_active !== false ? 'Active' : 'Inactive'} color={p.is_active !== false ? GRN : '#6b7280'} /></TD>
                        <TD>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn onClick={() => openEditProduct(p)} icon={Edit2} label="Edit" accent={T} small />
                            <Btn onClick={() => archiveProduct(p.stripe_product_id)} icon={Trash2} label="Archive" accent={R} small />
                            {p.stripe_product_id && (
                              <a href={`https://dashboard.stripe.com/test/products/${p.stripe_product_id}`} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                                <ExternalLink size={10} /> Stripe
                              </a>
                            )}
                          </div>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 — COUPONS */}
          {tab === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Btn onClick={() => setShowCouponModal(true)} icon={Plus} label="Create Coupon" accent={T} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0' }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Coupons</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                    {['Name', 'Type', 'Discount', 'Duration', 'Used', 'Active', 'Actions'].map(h => <TH key={h}>{h}</TH>)}
                  </tr></thead>
                  <tbody>
                    {coupons.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No coupons found</td></tr>
                    ) : coupons.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                        <TD style={{ fontWeight: 700, color: BLK }}>{c.name || c.id}</TD>
                        <TD><Badge label={c.percent_off ? 'Percent' : 'Amount'} color={T} /></TD>
                        <TD style={{ fontFamily: FH, fontWeight: 700 }}>{c.percent_off ? `${c.percent_off}%` : fmt$(c.amount_off / 100)}</TD>
                        <TD style={{ color: '#6b7280' }}>{c.duration === 'repeating' ? `${c.duration_in_months}mo` : c.duration}</TD>
                        <TD style={{ fontFamily: FH }}>{c.times_redeemed ?? 0}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}</TD>
                        <TD><Badge label={c.valid ? 'Active' : 'Inactive'} color={c.valid ? GRN : '#6b7280'} /></TD>
                        <TD><Btn onClick={() => deleteCoupon(c.id)} icon={Trash2} label="Delete" accent={R} small /></TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3 — SUBSCRIPTIONS */}
          {tab === 3 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Subscriptions</div>
                <span style={{ fontSize: 12, color: '#9a9a96' }}>{subscriptions.length} total</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                  {['Customer', 'Plan', 'Amount', 'Status', 'Period End', 'Actions'].map(h => <TH key={h}>{h}</TH>)}
                </tr></thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No subscriptions found</td></tr>
                  ) : subscriptions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                      <TD>
                        <div style={{ fontWeight: 600, color: BLK }}>{s.customer_email || s.customer_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#9a9a96' }}>{s.customer_id || s.customer}</div>
                      </TD>
                      <TD style={{ fontWeight: 600, color: BLK }}>{s.plan_name || s.plan || (s.items?.data?.[0]?.price?.nickname) || '—'}</TD>
                      <TD style={{ fontFamily: FH, fontWeight: 700 }}>{fmt$((s.amount ?? (s.plan?.amount ?? 0)) / 100)}/mo</TD>
                      <TD><Badge label={s.status} color={statusColor(s.status)} /></TD>
                      <TD style={{ color: '#9a9a96' }}>{s.current_period_end ? new Date(s.current_period_end * 1000).toLocaleDateString() : '—'}</TD>
                      <TD><Btn onClick={() => cancelSubscription(s.id)} icon={X} label="Cancel" accent={R} small /></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4 — INVOICES */}
          {tab === 4 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f2f2f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>Invoices</div>
                <span style={{ fontSize: 12, color: '#9a9a96' }}>{invoices.length} total</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #f2f2f0' }}>
                  {['#', 'Customer', 'Amount', 'Status', 'Date', 'Actions'].map(h => <TH key={h}>{h}</TH>)}
                </tr></thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9a9a96', fontSize: 13 }}>No invoices found</td></tr>
                  ) : invoices.map((inv, idx) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f8f8f6' }}>
                      <TD style={{ fontFamily: FH, color: '#9a9a96', fontSize: 11 }}>{inv.number || `#${idx + 1}`}</TD>
                      <TD style={{ fontWeight: 600, color: BLK }}>{inv.customer_email || inv.customer_name || '—'}</TD>
                      <TD style={{ fontFamily: FH, fontWeight: 700 }}>{fmt$((inv.amount_paid ?? inv.total ?? 0) / 100)}</TD>
                      <TD><Badge label={inv.status || 'unknown'} color={statusColor(inv.status)} /></TD>
                      <TD style={{ color: '#9a9a96' }}>{inv.created ? new Date(inv.created * 1000).toLocaleDateString() : '—'}</TD>
                      <TD>
                        {inv.invoice_pdf && (
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: FH, padding: '4px 10px', borderRadius: 8, background: T + '15', color: T, textDecoration: 'none' }}>
                            <ExternalLink size={11} /> PDF
                          </a>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 480, maxWidth: '95vw', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}><Package size={18} color={T} /> {editingProduct ? 'Edit Product' : 'Add Product'}</div>
              <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a96' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Name</label><input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Growth Plan" /></div>
              <div><label style={labelStyle}>Description</label><input value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} placeholder="Short description" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Monthly Price ($)</label><input type="number" value={productForm.monthly_price} onChange={e => setProductForm(f => ({ ...f, monthly_price: e.target.value }))} style={inputStyle} placeholder="297" /></div>
                <div><label style={labelStyle}>Annual Price ($)</label><input type="number" value={productForm.annual_price} onChange={e => setProductForm(f => ({ ...f, annual_price: e.target.value }))} style={inputStyle} placeholder="2970" /></div>
              </div>
              <div><label style={labelStyle}>Category</label>
                <select value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  <option value="plan">Plan</option>
                  <option value="addon">Add-on</option>
                  <option value="credit">Credits</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowProductModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#6b7280' }}>Cancel</button>
              <button onClick={saveProduct} disabled={saving || !productForm.name} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving || !productForm.name ? '#ccc' : T, cursor: saving || !productForm.name ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} {editingProduct ? 'Update in Stripe' : 'Create in Stripe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Modal */}
      {showCouponModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 460, maxWidth: '95vw', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={18} color={T} /> Create Coupon</div>
              <button onClick={() => setShowCouponModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a96' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Coupon Name</label><input value={couponForm.name} onChange={e => setCouponForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. LAUNCH50" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Percent Off (%)</label><input type="number" value={couponForm.percent_off} onChange={e => setCouponForm(f => ({ ...f, percent_off: e.target.value, amount_off: '' }))} style={inputStyle} placeholder="50" /></div>
                <div><label style={labelStyle}>Amount Off ($)</label><input type="number" value={couponForm.amount_off} onChange={e => setCouponForm(f => ({ ...f, amount_off: e.target.value, percent_off: '' }))} style={inputStyle} placeholder="100" /></div>
              </div>
              <div><label style={labelStyle}>Duration</label>
                <select value={couponForm.duration} onChange={e => setCouponForm(f => ({ ...f, duration: e.target.value }))} style={inputStyle}>
                  <option value="once">Once</option>
                  <option value="repeating">Repeating</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              {couponForm.duration === 'repeating' && (
                <div><label style={labelStyle}>Duration in Months</label><input type="number" value={couponForm.duration_in_months} onChange={e => setCouponForm(f => ({ ...f, duration_in_months: e.target.value }))} style={inputStyle} placeholder="3" /></div>
              )}
              <div><label style={labelStyle}>Max Redemptions (optional)</label><input type="number" value={couponForm.max_redemptions} onChange={e => setCouponForm(f => ({ ...f, max_redemptions: e.target.value }))} style={inputStyle} placeholder="100" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCouponModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#6b7280' }}>Cancel</button>
              <button onClick={saveCoupon} disabled={saving || !couponForm.name} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving || !couponForm.name ? '#ccc' : T, cursor: saving || !couponForm.name ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} Create Coupon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
