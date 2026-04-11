"use client"
// ─────────────────────────────────────────────────────────────
// CogReportPage — /cog-report
//
// Master expense dashboard. Reads koto_token_usage (metered API
// calls, auto-logged by server-side tokenTracker) AND
// koto_platform_costs (flat fees — subscriptions, phone rentals,
// manual entries) via the cog_overview action on /api/token-usage.
//
// V1 sections:
//   - Grand total banner with category breakdown
//   - Category bars (AI, Voice, Infrastructure, Data, Business)
//   - Service cards grid (one per service)
//   - Savings tracker (what Koto saves vs buying alternatives)
//   - Manual expense entry modal
//   - Recent platform cost entries table
//
// Deferred (noted in commit message):
//   - Realtime cost meter bar
//   - Budget manager with alerts
//   - Month-over-month trends
//   - Feature-level cost breakdown table
//   - PDF export
//   - Import historical CSV drop zone
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import {
  DollarSign, RefreshCw, Plus, ExternalLink, TrendingUp,
  Zap, Mic, Server, Search, Briefcase, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_ICONS = {
  ai_llms:        Zap,
  voice_phone:    Mic,
  infrastructure: Server,
  data_search:    Search,
  business_tools: Briefcase,
  other:          DollarSign,
}

const COST_TYPE_OPTIONS = [
  { value: 'vercel',           label: '⚡ Vercel',             category: 'infrastructure' },
  { value: 'supabase',         label: '🗄️ Supabase',           category: 'infrastructure' },
  { value: 'ghl',              label: '🔗 GoHighLevel',        category: 'business_tools' },
  { value: 'claude_ai_max',    label: '🧠 Claude.ai Max Plan', category: 'ai_llms' },
  { value: 'claude_ai_extra',  label: '🧠 Claude.ai Extras',   category: 'ai_llms' },
  { value: 'openai_api',       label: '🟢 OpenAI API',         category: 'ai_llms' },
  { value: 'gemini_api',       label: '🔵 Gemini API',         category: 'ai_llms' },
  { value: 'heygen_api',       label: '🎬 HeyGen',             category: 'ai_llms' },
  { value: 'retell_numbers',   label: '☎️ Retell Numbers',     category: 'voice_phone' },
  { value: 'retell_voice',     label: '🎙️ Retell Voice',       category: 'voice_phone' },
  { value: 'telnyx_numbers',   label: '☎️ Telnyx Numbers',     category: 'voice_phone' },
  { value: 'telnyx_sms',       label: '💬 Telnyx SMS',         category: 'voice_phone' },
  { value: 'twilio_voice',     label: '☎️ Twilio Voice',       category: 'voice_phone' },
  { value: 'twilio_sms',       label: '💬 Twilio SMS',         category: 'voice_phone' },
  { value: 'google_places',    label: '🗺️ Google Places',      category: 'data_search' },
  { value: 'google_ads',       label: '📊 Google Ads',         category: 'data_search' },
  { value: 'brave_search',     label: '🔍 Brave Search',       category: 'data_search' },
  { value: 'resend_email',     label: '📧 Resend',             category: 'business_tools' },
  { value: 'stripe_fees',      label: '💳 Stripe fees',        category: 'business_tools' },
  { value: 'other',            label: '📦 Other',              category: 'other' },
]

// What Koto features save you vs alternatives (for savings tracker)
const SAVINGS = [
  { label: 'Obsidian vs Notion AI',             saves: 20,  using: 'Obsidian + Copilot', instead: 'Notion AI' },
  { label: 'Koto voice onboarding vs Calendly + VA', saves: 300, using: 'Retell + Koto',      instead: 'Calendly + virtual assistant' },
  { label: 'Koto proposals vs Proposify',       saves: 49,  using: 'Claude API',        instead: 'Proposify' },
  { label: 'Koto proof review vs Filestage',    saves: 49,  using: 'Koto built-in',     instead: 'Filestage' },
  { label: 'Koto discovery vs strategy consult', saves: 500, using: 'Claude API',        instead: 'Strategy consultant /session' },
]

function fmt$(n) { return `$${Number(n || 0).toFixed(2)}` }
function fmt$4(n) { return `$${Number(n || 0).toFixed(4)}` }

export default function CogReportPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [syncing, setSyncing] = useState(false)
  const [platformList, setPlatformList] = useState([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { load() }, [days])

  async function load() {
    setLoading(true)
    try {
      const [overviewRes, platformRes] = await Promise.all([
        fetch('/api/token-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cog_overview', days }),
        }),
        fetch('/api/token-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'platform_summary',
            date_from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
          }),
        }),
      ])
      const overview = await overviewRes.json()
      const platform = await platformRes.json()
      setData(overview)
      setPlatformList(platform.rows || [])
    } catch (e) {
      console.warn('[CogReportPage load]', e)
    }
    setLoading(false)
  }

  async function syncAll() {
    setSyncing(true)
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_retell_calls' }),
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error || 'Retell sync failed')
      } else if (d.synced === 0) {
        toast.success(`Retell: nothing new — ${d.calls_fetched} calls already synced`)
      } else {
        toast.success(`Retell: ${d.synced} new calls · ${d.total_minutes} min · ${fmt$(d.total_cost)}`)
        await load()
      }
    } catch (e) {
      toast.error(e.message || 'Sync failed')
    }
    setSyncing(false)
  }

  async function addExpense(form) {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_platform_cost',
          cost_type: form.cost_type,
          amount: Number(form.amount),
          description: form.description,
          date: form.date,
          metadata: { manual: true },
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Save failed'); return }
      toast.success('Expense added')
      setShowAdd(false)
      await load()
    } catch (e) {
      toast.error(e.message || 'Save failed')
    }
  }

  const totalSavings = SAVINGS.reduce((a, s) => a + s.saves, 0)
  const byCategory = data?.by_category || {}
  const byService = data?.by_service || []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9f9f9', fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 32, maxWidth: 1400 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: 0 }}>Expense Intelligence</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Every dollar you spend on technology — tracked, categorized, optimized
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAdd(true)} style={btnStyle('#E6007E', true)}>
              <Plus size={13} /> Add Expense
            </button>
            <button onClick={syncAll} disabled={syncing} style={btnStyle('#8b5cf6')}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync Retell'}
            </button>
            <a href="/token-usage" style={{ ...btnStyle('#00C2CB'), textDecoration: 'none' }}>
              <ExternalLink size={13} /> AI detail
            </a>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff' }}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last 365 days</option>
            </select>
            <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>Loading expense data…</div>
        ) : (
          <>
            {/* Grand total + savings banners */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)', borderRadius: 16, padding: '26px 30px', color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
                  Total Tech Spend — last {days} days
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{fmt$(data?.grand_total || 0)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                  {data?.api_rows || 0} metered API calls · {data?.platform_rows || 0} platform cost entries
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', borderRadius: 16, padding: '22px 26px', color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, opacity: 0.9 }}>
                  Koto Savings vs Alternatives
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{fmt$(totalSavings)}/mo</div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 8 }}>what you'd pay with separate tools</div>
              </div>
            </div>

            {/* Category bars */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>By Category</div>
              {Object.entries(byCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([key, cat]) => {
                  const Icon = CATEGORY_ICONS[key] || DollarSign
                  const pct = data.grand_total > 0 ? Math.round((cat.total / data.grand_total) * 100) : 0
                  return (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={14} color={cat.color} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{cat.label}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{pct}%</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: '#111' }}>{fmt$(cat.total)}</span>
                      </div>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 10, transition: 'width .3s' }} />
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Service cards grid */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} /> Service Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {byService.map((svc) => (
                  <div key={svc.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{svc.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1 }}>{fmt$(svc.total)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                      {svc.api_cost > 0 && <span>API: {fmt$4(svc.api_cost)} · </span>}
                      {svc.platform_cost > 0 && <span>Flat: {fmt$(svc.platform_cost)}</span>}
                    </div>
                    {svc.calls > 0 && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                        {svc.calls} calls · {Number(svc.tokens).toLocaleString()} tokens
                      </div>
                    )}
                  </div>
                ))}
                {byService.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                    No services tracked in this window yet.
                  </div>
                )}
              </div>
            </div>

            {/* Savings tracker */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #16a34a40', padding: 22, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                💚 Savings vs Alternatives
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>What Koto saves you vs buying separate tools</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 10, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                <div>Tool</div><div>Using</div><div>Instead of</div><div style={{ textAlign: 'right' }}>Savings/mo</div>
              </div>
              {SAVINGS.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 10, fontSize: 13, padding: '10px 0', borderBottom: i < SAVINGS.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <div style={{ fontWeight: 700, color: '#111' }}>{s.label}</div>
                  <div style={{ color: '#374151' }}>{s.using}</div>
                  <div style={{ color: '#6b7280' }}>{s.instead}</div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{fmt$(s.saves)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '2px solid #16a34a30' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#16a34a' }}>
                  Total: {fmt$(totalSavings)}/mo · {fmt$(totalSavings * 12)}/yr
                </div>
              </div>
            </div>

            {/* Recent platform costs table */}
            {platformList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>
                    Platform Cost Entries ({platformList.length})
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Date', 'Type', 'Description', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Amount' ? 'right' : 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {platformList.slice(0, 50).map((row) => (
                        <tr key={row.id} style={{ borderTop: '1px solid #f9fafb' }}>
                          <td style={{ padding: '9px 16px', color: '#6b7280' }}>{row.date}</td>
                          <td style={{ padding: '9px 16px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#374151', fontWeight: 700, fontSize: 10 }}>
                              {row.cost_type}
                            </span>
                          </td>
                          <td style={{ padding: '9px 16px', color: '#374151' }}>{row.description}</td>
                          <td style={{ padding: '9px 16px', fontWeight: 800, textAlign: 'right', color: Number(row.amount) < 0 ? '#16a34a' : '#111' }}>
                            {Number(row.amount) < 0 ? '−' : ''}{fmt$(Math.abs(Number(row.amount)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add expense modal */}
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSave={addExpense} />}
    </div>
  )
}

function AddExpenseModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    cost_type: 'vercel',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Add Expense</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Log a platform cost that isn't auto-tracked</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Service</label>
            <select value={form.cost_type} onChange={(e) => setForm({ ...form, cost_type: e.target.value })} style={inputStyle}>
              {COST_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Amount ($)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.amount}
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: form.amount ? '#E6007E' : '#e5e7eb', color: '#fff', fontSize: 13, fontWeight: 800, cursor: form.amount ? 'pointer' : 'not-allowed' }}>
            Save Expense
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

const btnStyle = (color, solid = false) => ({
  padding: '8px 14px', borderRadius: 8,
  border: solid ? 'none' : `1px solid ${color}40`,
  background: solid ? color : '#fff',
  color: solid ? '#fff' : color,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
})
