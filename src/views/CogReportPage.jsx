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
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import {
  DollarSign, RefreshCw, Plus, ExternalLink, TrendingUp,
  Zap, Mic, Server, Search, Briefcase, X, Download, Activity, Database,
  Pencil, Trash2, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

// Tiny badge used on every card to indicate where the numbers come from,
// so there's no ambiguity between live data, historical imports, estimates
// and sections that still need setup. Colors are intentionally muted —
// these are informational, not alerts.
const SOURCE_STYLES = {
  'auto-tracked':        { bg: '#ecfdf5', fg: '#16a34a', border: '#16a34a30' },
  'from billing history':{ bg: '#eef2ff', fg: '#4338ca', border: '#4338ca30' },
  'estimate':            { bg: '#fffbeb', fg: '#b45309', border: '#b4530930' },
  'needs setup':         { bg: '#f3f4f6', fg: '#6b7280', border: '#9ca3af40' },
  'mixed':               { bg: '#faf5ff', fg: '#7c3aed', border: '#7c3aed30' },
}
function SourceBadge({ kind, title }) {
  const s = SOURCE_STYLES[kind] || SOURCE_STYLES['needs setup']
  return (
    <span title={title || ''} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 20,
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4,
      whiteSpace: 'nowrap',
    }}>
      {kind}
    </span>
  )
}

const FEATURE_LABELS = {
  voice_onboarding_analysis: '🎙️ Voice Onboarding Analysis',
  voice_onboarding: '🎙️ Voice Onboarding',
  proposal_generation: '📄 Proposal Generation',
  discovery_ai: '🔍 Discovery AI',
  discovery_coach: '💡 Discovery Coach',
  discovery_coach_autofill: '✨ Discovery Autofill',
  discovery_live_extraction: '🎤 Live Transcription',
  onboarding_suggest: '✨ Onboarding Suggestions',
  seo_research: '🔍 SEO Research',
  seo_content_module: '📝 SEO Content Module',
  agent_chat: '🤖 Agent Chat',
  external_audit: '🔎 External Audit Work',
  koto_app: '🛠️ Koto App',
  obsidian_copilot: '📝 Obsidian Copilot',
  openai_sync: '🟢 OpenAI (historical)',
  external: '🌐 External',
  unknown: '❓ Unknown',
}

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

function fmt$(n) { return `$${Number(n || 0).toFixed(2)}` }
function fmt$4(n) { return `$${Number(n || 0).toFixed(4)}` }

export default function CogReportPage() {
  // days window is persisted in ?days=… so refreshes stay on the same view
  const [searchParams, setSearchParams] = useSearchParams()
  const days = Number(searchParams.get('days')) || 30
  const setDays = (n) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev)
    p.set('days', String(n))
    return p
  }, { replace: true })

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [platformList, setPlatformList] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [budgets, setBudgets] = useState([])
  const [editingBudget, setEditingBudget] = useState(null) // { category, monthly_budget }
  const [features, setFeatures] = useState([])
  const [trend, setTrend] = useState(null)
  const [liveEvents, setLiveEvents] = useState([])
  const [supabaseUsage, setSupabaseUsage] = useState(null)
  const [buildImpacts, setBuildImpacts] = useState([])
  const [savings, setSavings] = useState([])
  const [editingSavingId, setEditingSavingId] = useState(null) // null | 'new' | uuid
  const [savingDraft, setSavingDraft] = useState(null) // { label, using_tool, instead_of, monthly_savings }

  useEffect(() => { load(); loadBudgets(); loadFeatures(); loadTrend(); loadEvents(); loadSupabaseUsage(); loadBuildImpacts(); loadSavings() }, [days])

  // Live event stream — subscribe to BOTH koto_events and koto_token_usage
  // so new deployments, commits, voice calls, and AI invocations all
  // flow into the activity feed without a full page reload.
  useEffect(() => {
    const eventsChannel = supabase
      .channel('cog-events-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'koto_events',
      }, (payload) => {
        const e = payload.new
        setLiveEvents((prev) => [{
          type: e.event_type,
          title: e.title,
          description: e.description,
          time: e.timestamp,
          metadata: e.metadata,
        }, ...prev].slice(0, 30))
      })
      .subscribe()

    const callsChannel = supabase
      .channel('cog-calls-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'koto_token_usage',
      }, (payload) => {
        const c = payload.new
        setLiveEvents((prev) => [{
          type: 'ai_call',
          title: `💡 ${c.feature || 'AI call'} · ${c.model}`,
          description: null,
          time: c.created_at,
          cost: Number(c.total_cost),
          tokens: Number(c.total_tokens || c.input_tokens + c.output_tokens),
        }, ...prev].slice(0, 30))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(callsChannel)
    }
  }, [])

  async function loadEvents() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'events_feed', limit: 30 }),
      })
      const d = await res.json()
      setLiveEvents(d.events || [])
    } catch {}
  }

  async function loadSupabaseUsage() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_supabase_usage' }),
      })
      const d = await res.json()
      if (d.available !== false) setSupabaseUsage(d)
    } catch {}
  }

  async function loadBuildImpacts() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build_impact', limit: 8 }),
      })
      const d = await res.json()
      setBuildImpacts(d.impacts || [])
    } catch {}
  }

  async function loadTrend() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'month_trend', months: 3 }),
      })
      const d = await res.json()
      setTrend(d)
    } catch {}
  }

  async function loadFeatures() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feature_breakdown', days }),
      })
      const d = await res.json()
      setFeatures(d.features || [])
    } catch {}
  }

  async function loadBudgets() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_budgets' }),
      })
      const d = await res.json()
      setBudgets(d.budgets || [])
    } catch {}
  }

  async function loadSavings() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_savings' }),
      })
      const d = await res.json()
      setSavings(d.savings || [])
    } catch {}
  }

  async function upsertSaving(draft, id) {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_savings',
          id: id && id !== 'new' ? id : undefined,
          label: draft.label,
          using_tool: draft.using_tool,
          instead_of: draft.instead_of,
          monthly_savings: Number(draft.monthly_savings || 0),
          sort_order: draft.sort_order ?? (savings.length + 1) * 10,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Save failed'); return }
      setEditingSavingId(null)
      setSavingDraft(null)
      await loadSavings()
    } catch (e) { toast.error(e.message) }
  }

  async function deleteSaving(id) {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_savings', id }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Delete failed'); return }
      await loadSavings()
    } catch (e) { toast.error(e.message) }
  }

  async function exportPdf() {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export_pdf', days }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'PDF export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `koto-expense-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e.message || 'Export failed')
    }
  }

  async function saveBudget(category, amount) {
    try {
      const res = await fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_budget', category, monthly_budget: Number(amount) }),
      })
      const d = await res.json()
      if (!res.ok) toast.error(d.error || 'Save failed')
      else {
        toast.success('Budget saved')
        await loadBudgets()
      }
    } catch (e) { toast.error(e.message) }
    setEditingBudget(null)
  }

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
      const post = (action, body = {}) => fetch('/api/token-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      }).then((r) => r.json())

      const [retell, openai, vercel, github] = await Promise.all([
        post('sync_retell_calls'),
        post('sync_openai', { days: 30 }),
        post('sync_vercel_deployments', { limit: 50 }),
        post('sync_github_commits', { limit: 50 }),
      ])

      const parts = []
      if (retell.error) parts.push(`Retell failed`)
      else parts.push(`Retell: ${retell.synced || 0}`)
      if (openai.available === false) parts.push('OpenAI: skipped')
      else if (openai.error) parts.push('OpenAI failed')
      else parts.push(`OpenAI: ${openai.synced || 0}`)
      if (vercel.available === false) parts.push('Vercel: skipped')
      else if (vercel.error) parts.push('Vercel failed')
      else parts.push(`Vercel: ${vercel.synced || 0} deploys`)
      if (github.available === false) parts.push('GitHub: skipped')
      else if (github.error) parts.push('GitHub failed')
      else parts.push(`GitHub: ${github.synced || 0} commits`)

      toast.success(parts.join(' · '))
      await Promise.all([load(), loadEvents(), loadBuildImpacts()])
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

  const totalSavings = savings.reduce((a, s) => a + Number(s.monthly_savings || 0), 0)
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
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync All'}
            </button>
            <button onClick={exportPdf} style={btnStyle('#16a34a')}>
              <Download size={13} /> Export PDF
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Total Tech Spend — last {days} days
                  </div>
                  <SourceBadge kind="mixed" title="Real auto-tracked API calls + platform costs imported from your billing history" />
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{fmt$(data?.grand_total || 0)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                  {data?.api_rows || 0} metered API calls · {data?.platform_rows || 0} platform cost entries
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', borderRadius: 16, padding: '22px 26px', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.9 }}>
                    Koto Savings vs Alternatives
                  </div>
                  <SourceBadge kind="estimate" title="Your editable estimates — click the section below to change them" />
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{fmt$(totalSavings)}/mo</div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 8 }}>what you'd pay with separate tools</div>
              </div>
            </div>

            {/* Category bars */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>By Category</div>
                <SourceBadge kind="mixed" title="Rolled up from auto-tracked API calls and billing-history platform costs" />
              </div>
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

            {/* Budget manager */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 4 }}>Monthly Budget</div>
                <SourceBadge kind={budgets.length === 0 ? 'needs setup' : 'auto-tracked'} title={budgets.length === 0 ? 'No budgets set yet — click Set budget on any row to start tracking alerts' : 'Live burn rate vs your saved budgets'} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Set a spending ceiling per category — get a red banner when you hit the alert threshold</div>
              {Object.entries(byCategory).map(([key, cat]) => {
                const budget = budgets.find((b) => b.category === key)
                // Normalize window spend to a monthly-equivalent burn rate so the
                // progress bar is meaningful even when days !== 30.
                const monthlyBurn = days > 0 ? (cat.total / days) * 30 : cat.total
                const pct = budget ? Math.round((monthlyBurn / Number(budget.monthly_budget)) * 100) : 0
                const alertPct = budget?.alert_threshold_pct || 80
                const over = pct >= 100
                const warn = pct >= alertPct && !over
                const barColor = over ? '#dc2626' : warn ? '#f59e0b' : cat.color
                const Icon = CATEGORY_ICONS[key] || DollarSign
                return (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={13} color={cat.color} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{cat.label}</span>
                        {over && <span style={{ padding: '1px 7px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 800 }}>OVER BUDGET</span>}
                        {warn && <span style={{ padding: '1px 7px', borderRadius: 10, background: '#fffbeb', color: '#f59e0b', fontSize: 12, fontWeight: 800 }}>{pct}%</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: '#374151', fontWeight: 700 }}>{fmt$(monthlyBurn)}</span>
                        <span style={{ color: '#9ca3af' }}>/</span>
                        {editingBudget?.category === key ? (
                          <>
                            <input
                              type="number"
                              value={editingBudget.monthly_budget}
                              onChange={(e) => setEditingBudget({ ...editingBudget, monthly_budget: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && saveBudget(key, editingBudget.monthly_budget)}
                              autoFocus
                              style={{ width: 80, padding: '3px 8px', borderRadius: 6, border: '1.5px solid #E6007E', fontSize: 12 }}
                            />
                            <button onClick={() => saveBudget(key, editingBudget.monthly_budget)} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#E6007E', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          </>
                        ) : (
                          <button onClick={() => setEditingBudget({ category: key, monthly_budget: budget?.monthly_budget || '' })}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: budget ? '#111' : '#9ca3af', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {budget ? fmt$(Number(budget.monthly_budget)) : 'Set budget'}
                          </button>
                        )}
                      </div>
                    </div>
                    {budget && (
                      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: barColor, borderRadius: 10, transition: 'width .3s' }} />
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                Spend shown is window-normalized to a 30-day burn rate so it's comparable to the monthly budget regardless of the window you picked.
              </div>
            </div>

            {/* Service cards grid */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={14} /> Service Breakdown
                </div>
                <SourceBadge kind="mixed" title="Per-service totals combining real API usage and billing-history entries" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {byService.map((svc) => (
                  <div key={svc.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{svc.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1 }}>{fmt$(svc.total)}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                      {svc.api_cost > 0 && <span>API: {fmt$4(svc.api_cost)} · </span>}
                      {svc.platform_cost > 0 && <span>Flat: {fmt$(svc.platform_cost)}</span>}
                    </div>
                    {svc.calls > 0 && (
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
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

            {/* Live activity feed + Supabase usage — side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Live activity feed */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Activity size={14} color="#E6007E" />
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Live Activity</div>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#16a34a', animation: 'pulse 2s infinite',
                  }} />
                  <div style={{ marginLeft: 'auto' }}>
                    <SourceBadge kind="auto-tracked" title="Realtime stream from koto_events and koto_token_usage" />
                  </div>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {liveEvents.length === 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af', padding: 20, textAlign: 'center' }}>
                      Nothing yet. Events will stream in live as they happen.
                    </div>
                  )}
                  {liveEvents.slice(0, 20).map((event, i) => (
                    <div key={`${event.time}-${i}`} style={{
                      padding: '8px 12px',
                      background: i === 0 ? '#f0fffe' : '#f9fafb',
                      borderRadius: 8,
                      border: `1px solid ${i === 0 ? '#00C2CB30' : '#f3f4f6'}`,
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: '#111', marginBottom: 2 }}>
                        {event.title}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>
                        {event.cost ? `${fmt$4(event.cost)} · ` : ''}
                        {event.tokens ? `${Number(event.tokens).toLocaleString()} tokens · ` : ''}
                        {event.time ? formatDistanceToNow(new Date(event.time), { addSuffix: true }) : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supabase usage card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Database size={14} color="#3ecf8e" />
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Supabase Usage</div>
                  <div style={{ marginLeft: 'auto' }}>
                    <SourceBadge kind="auto-tracked" title="Live query against your Supabase database" />
                  </div>
                </div>
                {supabaseUsage ? (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Database Size</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{supabaseUsage.db_size || '—'}</div>
                      {/* 500MB is the free tier; Pro has 8GB soft cap */}
                      {supabaseUsage.db_bytes > 0 && (
                        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (supabaseUsage.db_bytes / (8 * 1024 * 1024 * 1024)) * 100)}%`,
                            background: '#3ecf8e',
                            borderRadius: 10,
                          }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                      <div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>Token usage rows</div>
                        <div style={{ fontWeight: 800, color: '#111' }}>{Number(supabaseUsage.token_usage_rows).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>Events</div>
                        <div style={{ fontWeight: 800, color: '#111' }}>{Number(supabaseUsage.events_rows).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>Clients</div>
                        <div style={{ fontWeight: 800, color: '#111' }}>{Number(supabaseUsage.clients_rows).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>Platform costs</div>
                        <div style={{ fontWeight: 800, color: '#111' }}>{Number(supabaseUsage.platform_costs_rows).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, padding: '10px 12px', background: '#f9f9f9', borderRadius: 8, fontSize: 11, color: '#6b7280' }}>
                      Pro plan · ${supabaseUsage.monthly_cost || 25}/month · billed monthly
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#9ca3af', padding: 20, textAlign: 'center' }}>
                    Loading usage…
                  </div>
                )}
              </div>
            </div>

            {/* Build Impact correlation table — hidden entirely when empty */}
            {buildImpacts.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>🚀 Build Impact</div>
                  <SourceBadge kind="auto-tracked" title="Calculated from Vercel deployments synced via Sync All" />
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                  AI cost changes in the 24 hours before and after each deploy
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Deploy', 'When', 'Before', 'After', 'Change', 'Top Feature'].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildImpacts.map((imp) => {
                        const up = imp.change > 0
                        return (
                          <tr key={imp.deployment_id} style={{ borderTop: '1px solid #f9fafb' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374151', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {imp.url ? (
                                <a href={`https://${imp.url}`} target="_blank" rel="noreferrer" style={{ color: '#374151', textDecoration: 'none' }}>{imp.title}</a>
                              ) : imp.title}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                              {formatDistanceToNow(new Date(imp.timestamp), { addSuffix: true })}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{fmt$4(imp.cost_before)}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{fmt$4(imp.cost_after)}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: up ? '#dc2626' : '#16a34a' }}>
                              {up ? '+' : ''}{fmt$4(imp.change)}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#374151', fontSize: 11 }}>
                              {imp.top_feature || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Month-over-month trend */}
            {trend && trend.days && trend.days.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                      3-Month Cost Trend
                      <SourceBadge kind="mixed" title="Real daily spend from API calls and platform costs" />
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Daily stacked spend across all categories</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    {['ai_llms', 'voice_phone', 'infrastructure', 'data_search', 'business_tools'].map((k) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: (byCategory[k]?.color || '#9ca3af') }} />
                        {byCategory[k]?.label || k}
                      </div>
                    ))}
                  </div>
                </div>
                {(() => {
                  const maxTotal = Math.max(...trend.days.map((d) => d.total), 0.01)
                  const H = 120
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: H }}>
                        {trend.days.map((d) => {
                          const cats = ['ai_llms', 'voice_phone', 'infrastructure', 'data_search', 'business_tools', 'other']
                          return (
                            <div key={d.day}
                              title={`${d.day} · ${fmt$(d.total)}`}
                              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 3 }}>
                              {cats.map((c) => {
                                const h = (d[c] / maxTotal) * H
                                if (h <= 0) return null
                                return (
                                  <div key={c}
                                    style={{ height: `${h}px`, background: byCategory[c]?.color || '#9ca3af', opacity: 0.85 }} />
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#9ca3af' }}>
                        <span>{trend.days[0]?.day}</span>
                        <span>{trend.days[trend.days.length - 1]?.day}</span>
                      </div>
                    </>
                  )
                })()}

                {/* Monthly summary table */}
                {trend.by_month && Object.keys(trend.by_month).length > 0 && (
                  <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: `repeat(${Object.keys(trend.by_month).length}, 1fr)`, gap: 10 }}>
                    {Object.entries(trend.by_month).sort((a, b) => a[0].localeCompare(b[0])).map(([month, vals], i, arr) => {
                      const prev = i > 0 ? arr[i - 1][1].total : 0
                      const delta = vals.total - prev
                      const pct = prev > 0 ? Math.round((delta / prev) * 100) : null
                      return (
                        <div key={month} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{month}</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#111', marginTop: 4 }}>{fmt$(vals.total)}</div>
                          {pct !== null && (
                            <div style={{ fontSize: 11, color: delta > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, marginTop: 2 }}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(pct)}% vs prev
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Feature cost breakdown */}
            {features.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Cost per Koto Feature</div>
                  <SourceBadge kind="auto-tracked" title="Aggregated from koto_token_usage rows logged by tokenTracker" />
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>What each feature actually costs per call, and total burn for the window</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Feature', 'Calls', 'Avg / call', 'Total', 'Tokens', 'Primary model'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: i >= 1 && i <= 3 ? 'right' : 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((f) => (
                        <tr key={f.feature} style={{ borderTop: '1px solid #f9fafb' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151' }}>{FEATURE_LABELS[f.feature] || f.feature}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280' }}>{f.calls.toLocaleString()}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280' }}>${f.avg_cost_per_call.toFixed(4)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#E6007E' }}>{fmt$(f.total_cost)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#9ca3af' }}>{Number(f.total_tokens).toLocaleString()}</td>
                          <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 11 }}>{f.primary_model || '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 800 }}>
                        <td style={{ padding: '10px 14px', color: '#111' }}>Total across {features.length} features</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#111' }}>
                          {features.reduce((a, f) => a + f.calls, 0).toLocaleString()}
                        </td>
                        <td></td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#E6007E', fontSize: 14 }}>
                          {fmt$(features.reduce((a, f) => a + f.total_cost, 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Savings tracker — editable rows backed by koto_savings table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #16a34a40', padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  💚 Savings vs Alternatives
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SourceBadge kind="estimate" title="Your own editable estimates — not derived from live data" />
                  <button
                    onClick={() => {
                      setEditingSavingId('new')
                      setSavingDraft({ label: '', using_tool: '', instead_of: '', monthly_savings: '' })
                    }}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #16a34a40', background: '#fff', color: '#16a34a', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} /> Add row
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                What Koto saves you vs buying separate tools. These are your own estimates — click any row to edit.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 110px 70px', gap: 10, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                <div>Tool</div><div>Using</div><div>Instead of</div><div style={{ textAlign: 'right' }}>Savings/mo</div><div></div>
              </div>

              {savings.length === 0 && editingSavingId !== 'new' && (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  No savings rows yet. Click <strong>Add row</strong> to start tracking what Koto replaces.
                </div>
              )}

              {savings.map((s) => {
                const isEditing = editingSavingId === s.id
                const draft = isEditing ? savingDraft : null
                if (isEditing && draft) {
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 110px 70px', gap: 10, fontSize: 13, padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
                      <input value={draft.label} onChange={(e) => setSavingDraft({ ...draft, label: e.target.value })} placeholder="Tool / comparison" style={miniInput} autoFocus />
                      <input value={draft.using_tool} onChange={(e) => setSavingDraft({ ...draft, using_tool: e.target.value })} placeholder="Using" style={miniInput} />
                      <input value={draft.instead_of} onChange={(e) => setSavingDraft({ ...draft, instead_of: e.target.value })} placeholder="Instead of" style={miniInput} />
                      <input type="number" value={draft.monthly_savings} onChange={(e) => setSavingDraft({ ...draft, monthly_savings: e.target.value })} placeholder="0" style={{ ...miniInput, textAlign: 'right' }} />
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => upsertSaving(draft, s.id)} title="Save" style={iconBtn('#16a34a')}><Check size={13} /></button>
                        <button onClick={() => { setEditingSavingId(null); setSavingDraft(null) }} title="Cancel" style={iconBtn('#9ca3af')}><X size={13} /></button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={s.id}
                    onClick={() => {
                      setEditingSavingId(s.id)
                      setSavingDraft({
                        label: s.label,
                        using_tool: s.using_tool,
                        instead_of: s.instead_of,
                        monthly_savings: s.monthly_savings,
                        sort_order: s.sort_order,
                      })
                    }}
                    style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 110px 70px', gap: 10, fontSize: 13, padding: '10px 0', borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 700, color: '#111' }}>{s.label}</div>
                    <div style={{ color: '#374151' }}>{s.using_tool}</div>
                    <div style={{ color: '#6b7280' }}>{s.instead_of}</div>
                    <div style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{fmt$(s.monthly_savings)}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSavingId(s.id)
                          setSavingDraft({
                            label: s.label, using_tool: s.using_tool, instead_of: s.instead_of,
                            monthly_savings: s.monthly_savings, sort_order: s.sort_order,
                          })
                        }}
                        title="Edit" style={iconBtn('#9ca3af')}><Pencil size={12} /></button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete "${s.label}"?`)) deleteSaving(s.id)
                        }}
                        title="Delete" style={iconBtn('#dc2626')}><Trash2 size={12} /></button>
                    </div>
                  </div>
                )
              })}

              {editingSavingId === 'new' && savingDraft && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 110px 70px', gap: 10, fontSize: 13, padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
                  <input value={savingDraft.label} onChange={(e) => setSavingDraft({ ...savingDraft, label: e.target.value })} placeholder="Tool / comparison" style={miniInput} autoFocus />
                  <input value={savingDraft.using_tool} onChange={(e) => setSavingDraft({ ...savingDraft, using_tool: e.target.value })} placeholder="Using" style={miniInput} />
                  <input value={savingDraft.instead_of} onChange={(e) => setSavingDraft({ ...savingDraft, instead_of: e.target.value })} placeholder="Instead of" style={miniInput} />
                  <input type="number" value={savingDraft.monthly_savings} onChange={(e) => setSavingDraft({ ...savingDraft, monthly_savings: e.target.value })} placeholder="0" style={{ ...miniInput, textAlign: 'right' }} />
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => upsertSaving(savingDraft)} title="Save" style={iconBtn('#16a34a')}><Check size={13} /></button>
                    <button onClick={() => { setEditingSavingId(null); setSavingDraft(null) }} title="Cancel" style={iconBtn('#9ca3af')}><X size={13} /></button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '2px solid #16a34a30' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#16a34a' }}>
                  Total: {fmt$(totalSavings)}/mo · {fmt$(totalSavings * 12)}/yr
                </div>
              </div>
            </div>

            {/* Recent platform costs table */}
            {platformList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>
                    Platform Cost Entries ({platformList.length})
                  </div>
                  <SourceBadge kind="from billing history" title="Manually entered or imported from your real invoices (Vercel, Supabase, GHL, Claude.ai, Retell)" />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Date', 'Type', 'Description', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Amount' ? 'right' : 'left', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {platformList.slice(0, 50).map((row) => (
                        <tr key={row.id} style={{ borderTop: '1px solid #f9fafb' }}>
                          <td style={{ padding: '9px 16px', color: '#6b7280' }}>{row.date}</td>
                          <td style={{ padding: '9px 16px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#374151', fontWeight: 700, fontSize: 12 }}>
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50% { opacity: 0.55; transform: scale(0.85) }
        }
      `}</style>
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

// Compact inputs for inline savings row editing
const miniInput = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1.5px solid #e5e7eb',
  fontSize: 12,
  outline: 'none',
  background: '#fff',
  fontFamily: 'inherit',
  minWidth: 0,
}
const iconBtn = (color) => ({
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
})
