"use client"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import {
  Search, TrendingUp, DollarSign, Target, Zap, BarChart2, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Filter, Download,
  CheckCircle, XCircle, AlertCircle, Brain, Eye, Shield, Clock, Star, Users, MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

// ── Category config ─────────────────────────────────────────────────────────
const CAT_CONFIG = {
  organic_cannibal: { label: 'Organic Cannibals', color: R, icon: '💸', desc: 'Ranking top 5 AND paying for ads — reduce waste' },
  striking_distance: { label: 'Striking Distance', color: AMB, icon: '🎯', desc: 'Position 4-15 — push to top 3' },
  quick_win: { label: 'Quick Wins', color: GRN, icon: '⚡', desc: 'Position 11-20 with high volume' },
  dark_matter: { label: 'Dark Matter', color: '#8b5cf6', icon: '🌑', desc: 'Not ranking, not bidding — hidden opportunity' },
  paid_only: { label: 'Paid Only', color: T, icon: '💳', desc: 'Ads traffic but no organic presence' },
  defend: { label: 'Defend', color: GRN, icon: '🛡️', desc: 'Top 3 organically — protect position' },
  underperformer: { label: 'Underperformers', color: AMB, icon: '📉', desc: 'Has impressions but low CTR' },
  monitor: { label: 'Monitor', color: '#6b7280', icon: '👁️', desc: 'Tracking — no immediate action' },
}

const INTENT_COLORS = { transactional: R, commercial: AMB, informational: T, navigational: '#6b7280' }

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) { return n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n}` }
function fmtN(n) { return n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n || 0) }

function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: (color || T) + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={color || T} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: FH }}>{label}</div>
        </div>
        {trend && <div style={{ fontSize: 11, fontWeight: 700, color: trend > 0 ? GRN : R, display: 'flex', alignItems: 'center', gap: 2 }}>
          {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(trend)}%
        </div>}
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>}
    </div>
  )
}

function CategoryPill({ cat, count, active, onClick }) {
  const cfg = CAT_CONFIG[cat] || { label: cat, color: '#6b7280', icon: '•' }
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1.5px solid ${active ? cfg.color : '#e5e7eb'}`,
      background: active ? cfg.color + '12' : '#fff',
      color: active ? cfg.color : '#6b7280', transition: 'all .15s',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{cfg.icon}</span> {cfg.label} <span style={{ fontFamily: FH, fontSize: 11, opacity: .7 }}>({count})</span>
    </button>
  )
}

function ScoreBadge({ score, label }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : score > 0 ? R : '#d1d5db'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{score || '—'}</div>
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function KotoIQPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard') // dashboard | keywords
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [portfolio, setPortfolio] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [keywords, setKeywords] = useState([])
  const [kwTotal, setKwTotal] = useState(0)
  const [clientId, setClientId] = useState('')
  const [clients, setClients] = useState([])
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null) // null = add, object = edit
  const [clientForm, setClientForm] = useState({ name: '', website: '', primary_service: '', location: '' })
  const [savingClient, setSavingClient] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [sortBy, setSortBy] = useState('opportunity_score')
  const [sortDir, setSortDir] = useState('desc')
  const [kwPage, setKwPage] = useState(0)
  const KW_LIMIT = 50
  const [compKeyword, setCompKeyword] = useState('')
  const [compAnalysis, setCompAnalysis] = useState(null)
  const [compLoading, setCompLoading] = useState(false)
  const [rankData, setRankData] = useState(null)
  const [rankLoading, setRankLoading] = useState(false)
  const [rankFilter, setRankFilter] = useState('all') // all, improved, declined, top3, top10
  const [gmb, setGmb] = useState(null)
  const [gmbLoading, setGmbLoading] = useState(false)
  const [draftingReview, setDraftingReview] = useState(null)
  const [reviewDraft, setReviewDraft] = useState('')
  const [gmbPosts, setGmbPosts] = useState([])
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [briefs, setBriefs] = useState([])
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefKeyword, setBriefKeyword] = useState('')
  const [briefPageType, setBriefPageType] = useState('service_page')
  const [activeBrief, setActiveBrief] = useState(null)
  const [generatingBrief, setGeneratingBrief] = useState(false)

  // Load clients
  const loadClients = useCallback(() => {
    if (!agencyId) return
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/clients?select=id,name,website,primary_service&agency_id=eq.${agencyId}&deleted_at=is.null&order=name`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }
    }).then(r => r.json()).then(c => { if (Array.isArray(c)) setClients(c) })
  }, [agencyId])

  useEffect(() => {
    loadClients()
    // Load portfolio overview
    if (agencyId) fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'portfolio', agency_id: agencyId }) })
      .then(r => r.json()).then(res => setPortfolio(res)).catch(() => {})
  }, [agencyId, loadClients])

  // Save client (add or edit)
  const saveClient = async () => {
    if (!clientForm.name) { toast.error('Client name is required'); return }
    setSavingClient(true)
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/clients`
      const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
      const payload = { name: clientForm.name, website: clientForm.website || null, primary_service: clientForm.primary_service || null, agency_id: agencyId }

      let res
      if (editingClient?.id) {
        res = await fetch(`${url}?id=eq.${editingClient.id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      } else {
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
      }
      const data = await res.json()
      if (res.ok) {
        toast.success(editingClient ? 'Client updated' : 'Client added')
        setShowClientModal(false)
        setEditingClient(null)
        setClientForm({ name: '', website: '', primary_service: '', location: '' })
        loadClients()
        if (!editingClient && Array.isArray(data) && data[0]?.id) setClientId(data[0].id)
      } else {
        toast.error(data.message || 'Failed to save')
      }
    } catch { toast.error('Failed to save client') }
    setSavingClient(false)
  }

  // Load dashboard
  const loadDashboard = useCallback(() => {
    if (!clientId) return
    setLoading(true)
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard', client_id: clientId }) })
      .then(r => r.json()).then(res => { setDashboard(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  // Load keywords
  const loadKeywords = useCallback(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'keywords', client_id: clientId, category: catFilter || undefined, sort_by: sortBy, sort_dir: sortDir, limit: KW_LIMIT, offset: kwPage * KW_LIMIT, search: searchQ || undefined })
    }).then(r => r.json()).then(res => { setKeywords(res.keywords || []); setKwTotal(res.total || 0) })
  }, [clientId, catFilter, sortBy, sortDir, kwPage, searchQ])

  // Load briefs
  const loadBriefs = useCallback(() => {
    if (!clientId) return
    setBriefLoading(true)
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list_briefs', client_id: clientId }) })
      .then(r => r.json()).then(res => { setBriefs(res.briefs || []); setBriefLoading(false) })
      .catch(() => setBriefLoading(false))
  }, [clientId])

  // Generate brief
  const generateBrief = async (kw) => {
    const keyword = kw || briefKeyword
    if (!keyword || !clientId) return
    setGeneratingBrief(true)
    toast.loading('Generating content brief...', { id: 'brief' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_brief', client_id: clientId, agency_id: agencyId, keyword, page_type: briefPageType }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'brief' }); setGeneratingBrief(false); return }
      toast.success('Brief generated!', { id: 'brief' })
      setActiveBrief(data.brief)
      setBriefKeyword('')
      loadBriefs()
    } catch { toast.error('Failed to generate brief', { id: 'brief' }) }
    setGeneratingBrief(false)
  }

  // Load GMB health
  const loadGMB = useCallback(() => {
    if (!clientId) return
    setGmbLoading(true)
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gmb_health', client_id: clientId }) })
      .then(r => r.json()).then(res => { setGmb(res); setGmbLoading(false) })
      .catch(() => setGmbLoading(false))
  }, [clientId])

  // Draft review response
  const draftReviewResponse = async (review) => {
    setDraftingReview(review)
    setReviewDraft('')
    try {
      const clientName = clients.find(c => c.id === clientId)?.name || ''
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft_review_response', client_id: clientId, review_text: review.text, review_rating: review.rating, reviewer_name: review.author, business_name: clientName }) })
      const data = await res.json()
      setReviewDraft(data.response || 'Failed to generate response')
    } catch { setReviewDraft('Error generating response') }
  }

  // Generate GBP posts
  const generatePosts = async () => {
    setGeneratingPosts(true)
    const clientObj = clients.find(c => c.id === clientId)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_gbp_posts', client_id: clientId, business_name: clientObj?.name, industry: dashboard?.summary?.industry, num_posts: 4 }) })
      const data = await res.json()
      setGmbPosts(data.posts || [])
    } catch { toast.error('Failed to generate posts') }
    setGeneratingPosts(false)
  }

  // Load rank data
  const loadRanks = useCallback(() => {
    if (!clientId) return
    setRankLoading(true)
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rank_history', client_id: clientId, days: 90 }) })
      .then(r => r.json()).then(res => { setRankData(res); setRankLoading(false) })
      .catch(() => setRankLoading(false))
  }, [clientId])

  useEffect(() => { loadDashboard() }, [loadDashboard])
  useEffect(() => { if (tab === 'keywords') loadKeywords() }, [tab, loadKeywords])
  useEffect(() => { if (tab === 'briefs') loadBriefs() }, [tab, loadBriefs])
  useEffect(() => { if (tab === 'ranks') loadRanks() }, [tab, loadRanks])
  useEffect(() => { if (tab === 'gmb') loadGMB() }, [tab, loadGMB])

  // Sync
  const runSync = async () => {
    if (!clientId) return
    setSyncing(true)
    toast.loading('Syncing all data sources...', { id: 'sync' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', client_id: clientId, agency_id: agencyId }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'sync' }); setSyncing(false); return }
      toast.success(`Synced ${data.total_keywords} keywords from ${Object.values(data.data_sources).reduce((a, b) => a + b, 0)} data points`, { id: 'sync' })
      loadDashboard()
      if (tab === 'keywords') loadKeywords()
    } catch (e) { toast.error('Sync failed', { id: 'sync' }) }
    setSyncing(false)
  }

  // Quick Scan (no OAuth needed)
  const runQuickScan = async () => {
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    if (!client?.website) { toast.error('Client needs a website URL for quick scan'); return }
    setSyncing(true)
    toast.loading('Running quick scan — analyzing website + competitors...', { id: 'sync' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quick_scan', client_id: clientId, agency_id: agencyId, website: client.website, industry: client.primary_service || '', location: '' }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'sync' }); setSyncing(false); return }
      toast.success(`Found ${data.total_keywords} keywords · DA: ${data.client_da} · ${data.competitors} competitors`, { id: 'sync' })
      loadDashboard()
      if (tab === 'keywords') loadKeywords()
    } catch { toast.error('Quick scan failed', { id: 'sync' }) }
    setSyncing(false)
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }
  const d = dashboard

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.03em' }}>KotoIQ</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>AI-Powered Search Intelligence</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={clientId} onChange={e => { setClientId(e.target.value); setDashboard(null) }}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', minWidth: 180 }}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {clientId && (
              <button onClick={() => {
                const c = clients.find(x => x.id === clientId)
                if (c) { setEditingClient(c); setClientForm({ name: c.name || '', website: c.website || '', primary_service: c.primary_service || '', location: '' }); setShowClientModal(true) }
              }} title="Edit client" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✏️</button>
            )}
            <button onClick={() => { setEditingClient(null); setClientForm({ name: '', website: '', primary_service: '', location: '' }); setShowClientModal(true) }}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${GRN}`, background: '#fff', color: GRN, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>+ Add Client</button>
            <button onClick={runQuickScan} disabled={syncing || !clientId}
              style={{ padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${R}`, background: syncing ? '#e5e7eb' : '#fff', color: R, fontSize: 13, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
              Quick Scan
            </button>
            <button onClick={runSync} disabled={syncing || !clientId}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: syncing ? '#e5e7eb' : T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              Full Sync
            </button>
            {clientId && dashboard && !dashboard.empty && (
              <button onClick={() => {
                fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export_report', client_id: clientId }) })
                  .then(r => r.json()).then(data => {
                    const win = window.open('', '_blank')
                    if (!win) return
                    const c = data.client || {}
                    const s = data.summary || {}
                    win.document.write(`<html><head><title>KotoIQ Report — ${c.name}</title>
<style>body{font-family:system-ui;padding:40px;max-width:900px;margin:0 auto;color:#111}h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;color:#666;margin-top:32px;border-bottom:2px solid #eee;padding-bottom:8px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:13px}th{background:#f9f9f9;font-weight:700}.stat{display:inline-block;padding:12px 20px;background:#f9f9f9;border-radius:8px;text-align:center;margin:6px}.stat-val{font-size:24px;font-weight:900}.stat-label{font-size:11px;color:#666;text-transform:uppercase}@media print{@page{margin:.75in}}</style></head><body>
<h1>KotoIQ Search Intelligence Report</h1>
<p style="color:#666">${c.name} · ${c.website || ''} · Generated ${new Date(data.generated_at).toLocaleDateString()}</p>
<h2>Summary</h2>
<div>${[['Keywords', s.total_keywords],['Top 3', s.top3],['Top 10', s.top10],['Ads Spend', '$'+s.total_ads_spend],['Wasted', '$'+s.wasted_spend],['Avg Opp', s.avg_opportunity+'/100']].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-label">${l}</div></div>`).join('')}</div>
<h2>Top 20 Opportunities</h2>
<table><tr><th>Keyword</th><th>Opp</th><th>Rank P.</th><th>Position</th><th>Volume</th><th>Ads $</th><th>Category</th><th>Intent</th></tr>
${(data.top_opportunities||[]).map(k=>`<tr><td>${k.keyword}</td><td>${k.opportunity}</td><td>${k.rank_propensity}</td><td>${k.position?'#'+Math.round(k.position):'—'}</td><td>${k.volume||'—'}</td><td>$${k.ads_spend||0}</td><td>${k.category}</td><td>${k.intent}</td></tr>`).join('')}
</table>
<h2>AI Recommendations</h2>
${(data.recommendations||[]).map(r=>`<div style="padding:12px 16px;border-left:3px solid ${r.priority==='critical'||r.priority==='high'?'#e60000':'#f59e0b'};background:#f9f9f9;margin:8px 0;border-radius:4px"><strong>[${r.priority}] ${r.title}</strong><br><span style="color:#444">${r.detail}</span>${r.estimated_impact?`<br><em style="color:green">${r.estimated_impact}</em>`:''}</div>`).join('')}
<h2>Content Briefs</h2>
${(data.briefs||[]).length?`<table><tr><th>Keyword</th><th>URL</th><th>Words</th><th>Status</th></tr>${data.briefs.map(b=>`<tr><td>${b.keyword}</td><td>${b.url||'—'}</td><td>${b.word_count||'—'}</td><td>${b.status}</td></tr>`).join('')}</table>`:'<p>No briefs generated yet.</p>'}
<p style="color:#999;margin-top:40px;text-align:center">Generated by KotoIQ — AI-Powered Search Intelligence · hellokoto.com</p>
</body></html>`)
                    win.document.close()
                    win.print()
                  })
              }} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={14} /> Export PDF
              </button>
            )}
          </div>
        </div>

        {/* Tabs (only show when client selected) */}
        {clientId && (
          <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
            {[['dashboard', 'Dashboard', BarChart2], ['keywords', 'Keyword Explorer', Search], ['briefs', 'Page Builder', Zap], ['competitors', 'Competitors', Target], ['ranks', 'Rank Tracker', TrendingUp], ['gmb', 'GMB', Star]].map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ padding: '10px 24px', borderRadius: '10px 10px 0 0', border: '1px solid #e5e7eb', borderBottom: tab === key ? 'none' : '1px solid #e5e7eb', background: tab === key ? '#fff' : 'transparent', fontSize: 13, fontWeight: 700, color: tab === key ? BLK : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Portfolio view (no client selected) */}
        {!clientId && (
          <>
            {portfolio?.totals && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                <StatCard label="Total Clients" value={portfolio.totals.total_clients} icon={Users} color={T} />
                <StatCard label="Synced" value={portfolio.totals.synced_clients} icon={CheckCircle} color={GRN} />
                <StatCard label="Total Keywords" value={fmtN(portfolio.totals.total_keywords)} icon={Search} color={T} />
                <StatCard label="Total Top 3" value={portfolio.totals.total_top3} icon={Star} color={GRN} />
              </div>
            )}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 16 }}>Client Portfolio</div>
              {portfolio?.clients?.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      {['Client', 'Keywords', 'Top 3', 'Top 10', 'Avg Opp', 'Ads Spend', 'Cannibals', 'Actions', 'Last Sync', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Client' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.clients.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => { setClientId(c.id); setTab('dashboard') }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.service || c.website}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: c.total_keywords > 0 ? BLK : '#d1d5db' }}>{c.total_keywords || '—'}</td>
                        <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: c.top3 > 0 ? GRN : '#d1d5db' }}>{c.top3 || '—'}</td>
                        <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: c.top10 > 0 ? T : '#d1d5db' }}>{c.top10 || '—'}</td>
                        <td style={{ textAlign: 'center' }}><ScoreBadge score={c.avg_opportunity} label="" /></td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{c.ads_spend ? fmt$(c.ads_spend) : '—'}</td>
                        <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: c.cannibals > 0 ? R : '#d1d5db' }}>{c.cannibals || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {c.critical_actions > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: R + '15', color: R }}>{c.critical_actions}</span>}
                          {c.critical_actions === 0 && c.total_actions > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: T + '15', color: T }}>{c.total_actions}</span>}
                          {c.total_actions === 0 && <span style={{ fontSize: 10, color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af' }}>{c.last_sync ? new Date(c.last_sync).toLocaleDateString() : 'Never'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={e => { e.stopPropagation(); setClientId(c.id); setTab('dashboard') }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: T }}>Open</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: '#9ca3af', fontSize: 14 }}>
                  Select a client above to get started, or sync your first client's data.
                </div>
              )}
            </div>
          </>
        )}

        {!clientId && !portfolio && (
          <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
            <Zap size={48} color={T} style={{ margin: '0 auto 16px', opacity: .3 }} />
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Loading portfolio...</div>
          </div>
        )}

        {clientId && loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* ══ DASHBOARD TAB ══ */}
        {clientId && tab === 'dashboard' && d && !loading && (
          <>
            {d.empty ? (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <Brain size={48} color={T} style={{ margin: '0 auto 16px', opacity: .3 }} />
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No data yet</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Choose how to get started:</div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <div style={{ padding: '24px', borderRadius: 14, border: `2px solid ${R}20`, background: R + '04', maxWidth: 280, textAlign: 'center' }}>
                    <Zap size={32} color={R} style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>Quick Scan</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>No login required. Scans website, sitemap, competitors, and Moz DA. AI extracts 30-60 target keywords.</div>
                    <button onClick={runQuickScan} disabled={syncing}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Run Quick Scan
                    </button>
                  </div>
                  <div style={{ padding: '24px', borderRadius: 14, border: `2px solid ${T}20`, background: T + '04', maxWidth: 280, textAlign: 'center' }}>
                    <RefreshCw size={32} color={T} style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>Full Sync</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>Requires Google OAuth. Pulls real data from Search Console, Google Ads, GA4. Connect at /seo/connect first.</div>
                    <button onClick={runSync} disabled={syncing}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Run Full Sync
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                  <StatCard label="Total Keywords" value={fmtN(d.summary?.total_keywords)} icon={Search} color={T} />
                  <StatCard label="Organic Clicks (30d)" value={fmtN(d.summary?.total_organic_clicks)} icon={TrendingUp} color={GRN} />
                  <StatCard label="Ads Spend (30d)" value={fmt$(d.summary?.total_ads_spend || 0)} icon={DollarSign} color={AMB} />
                  <StatCard label="Wasted Spend" value={fmt$(d.summary?.wasted_spend || 0)} sub="Organic cannibals" icon={AlertCircle} color={R} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                  <StatCard label="Top 3 Rankings" value={d.summary?.top3_keywords || 0} icon={Star} color={GRN} />
                  <StatCard label="Top 10 Rankings" value={d.summary?.top10_keywords || 0} icon={Eye} color={T} />
                  <StatCard label="Avg Position" value={d.summary?.avg_position || '—'} icon={Target} color={AMB} />
                  <StatCard label="Avg CPC" value={d.summary?.avg_cpc ? `$${d.summary.avg_cpc}` : '—'} icon={DollarSign} color={T} />
                </div>

                {/* Category breakdown */}
                <div style={card}>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Keyword Categories</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {Object.entries(d.categories || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                      const cfg = CAT_CONFIG[cat] || { label: cat, color: '#6b7280', icon: '•', desc: '' }
                      return (
                        <div key={cat} onClick={() => { setTab('keywords'); setCatFilter(cat) }}
                          style={{ padding: '16px 18px', borderRadius: 12, background: cfg.color + '08', border: `1.5px solid ${cfg.color}20`, cursor: 'pointer', transition: 'all .15s' }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{cfg.icon}</div>
                          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: cfg.color }}>{count}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{cfg.label}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{cfg.desc}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Top opportunities */}
                {d.top_opportunities?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={18} color={T} /> Top Opportunities
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          {['Keyword', 'Opp', 'Rank', 'Position', 'Volume', 'Ads $', 'Conv', 'Category', 'Intent'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Keyword' ? 'left' : 'center' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.top_opportunities.map((kw, i) => {
                          const cfg = CAT_CONFIG[kw.category] || { color: '#6b7280', label: kw.category }
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px', fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</td>
                              <td style={{ textAlign: 'center' }}><ScoreBadge score={kw.opportunity_score} label="Opp" /></td>
                              <td style={{ textAlign: 'center' }}><ScoreBadge score={kw.rank_propensity} label="Rank" /></td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: kw.sc_position <= 3 ? GRN : kw.sc_position <= 10 ? AMB : kw.sc_position ? R : '#d1d5db' }}>{kw.sc_position ? `#${Math.round(kw.sc_position)}` : '—'}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, fontFamily: FH }}>{kw.volume ? fmtN(kw.volume) : '—'}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, fontFamily: FH }}>{kw.ads_spend ? fmt$(kw.ads_spend) : '—'}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, fontFamily: FH }}>{kw.ads_conversions || '—'}</td>
                              <td style={{ textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: cfg.color + '15', color: cfg.color }}>{cfg.label}</span></td>
                              <td style={{ textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: INTENT_COLORS[kw.intent] || '#6b7280' }}>{kw.intent}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* AI Recommendations */}
                {d.recommendations?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Brain size={18} color={T} /> AI Recommendations
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {d.recommendations.map((rec, i) => {
                        const pColor = rec.priority === 'critical' ? R : rec.priority === 'high' ? AMB : rec.priority === 'medium' ? T : '#6b7280'
                        return (
                          <div key={i} style={{ padding: '16px 20px', borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pColor}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: pColor + '15', color: pColor, textTransform: 'uppercase' }}>{rec.priority}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>{rec.type?.replace(/_/g, ' ')}</span>
                              {rec.effort && <span style={{ fontSize: 10, color: '#9ca3af' }}>{rec.effort.replace(/_/g, ' ')}</span>}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{rec.title}</div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{rec.detail}</div>
                            {rec.estimated_impact && (
                              <div style={{ fontSize: 12, color: GRN, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowUpRight size={12} /> {rec.estimated_impact}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ KEYWORDS TAB ══ */}
        {clientId && tab === 'keywords' && (
          <>
            {/* Filters */}
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setKwPage(0) }}
                    placeholder="Search keywords..." style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, background: '#fff', cursor: 'pointer' }}>
                  <option value="opportunity_score">Sort: Opportunity</option>
                  <option value="rank_propensity">Sort: Rank Propensity</option>
                  <option value="sc_avg_position">Sort: Position</option>
                  <option value="ads_cost_cents">Sort: Ad Spend</option>
                  <option value="sc_clicks">Sort: Organic Clicks</option>
                  <option value="kp_monthly_volume">Sort: Volume</option>
                  <option value="ads_conversions">Sort: Conversions</option>
                </select>
                <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                  {sortDir === 'desc' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <CategoryPill cat="" count={kwTotal} active={!catFilter} onClick={() => { setCatFilter(''); setKwPage(0) }} />
                {Object.keys(CAT_CONFIG).map(cat => (
                  <CategoryPill key={cat} cat={cat} count={dashboard?.categories?.[cat] || 0} active={catFilter === cat} onClick={() => { setCatFilter(catFilter === cat ? '' : cat); setKwPage(0) }} />
                ))}
              </div>
            </div>

            {/* Keywords table */}
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Keyword', 'Opp', 'Rank P.', 'Position', 'SC Clicks', 'Volume', 'Ads $', 'Conv', 'CPC', 'QS', 'Cat', 'Intent', ''].map(h => (
                      <th key={h} style={{ padding: '8px 8px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Keyword' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw, i) => {
                    const cfg = CAT_CONFIG[kw.category] || { color: '#6b7280', label: kw.category, icon: '•' }
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: BLK, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</td>
                        <td style={{ textAlign: 'center' }}><ScoreBadge score={kw.opportunity_score} label="" /></td>
                        <td style={{ textAlign: 'center' }}><ScoreBadge score={kw.rank_propensity} label="" /></td>
                        <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 13, fontWeight: 800, color: kw.sc_avg_position && kw.sc_avg_position <= 3 ? GRN : kw.sc_avg_position && kw.sc_avg_position <= 10 ? AMB : kw.sc_avg_position ? R : '#d1d5db' }}>
                          {kw.sc_avg_position ? `#${Math.round(kw.sc_avg_position * 10) / 10}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.sc_clicks || '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.kp_monthly_volume || '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.ads_cost_cents ? fmt$(Math.round(kw.ads_cost_cents / 100)) : '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.ads_conversions || '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.ads_cpc_cents ? `$${(kw.ads_cpc_cents / 100).toFixed(2)}` : '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH, color: kw.ads_quality_score >= 7 ? GRN : kw.ads_quality_score >= 5 ? AMB : kw.ads_quality_score ? R : '#d1d5db' }}>{kw.ads_quality_score || '—'}</td>
                        <td style={{ textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 12, background: cfg.color + '12', color: cfg.color }}>{cfg.icon}</span></td>
                        <td style={{ textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 700, color: INTENT_COLORS[kw.intent] || '#6b7280', textTransform: 'uppercase' }}>{kw.intent?.slice(0, 4)}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button title="Generate Brief" onClick={() => { setBriefKeyword(kw.keyword); setTab('briefs') }}
                              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={10} color={T} /></button>
                            <button title="Analyze Competitors" onClick={() => { setCompKeyword(kw.keyword); setTab('competitors') }}
                              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={10} color={R} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {kwTotal > KW_LIMIT && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Showing {kwPage * KW_LIMIT + 1}–{Math.min((kwPage + 1) * KW_LIMIT, kwTotal)} of {kwTotal}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setKwPage(p => Math.max(0, p - 1))} disabled={kwPage === 0}
                      style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: kwPage === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: kwPage === 0 ? .4 : 1 }}>Previous</button>
                    <button onClick={() => setKwPage(p => p + 1)} disabled={(kwPage + 1) * KW_LIMIT >= kwTotal}
                      style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: (kwPage + 1) * KW_LIMIT >= kwTotal ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: (kwPage + 1) * KW_LIMIT >= kwTotal ? .4 : 1 }}>Next</button>
                  </div>
                </div>
              )}

              {keywords.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
                  {searchQ || catFilter ? 'No keywords match your filters' : 'No keyword data — run a sync first'}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ PAGE BUILDER TAB ══ */}
        {clientId && tab === 'briefs' && (
          <>
            {/* Generate new brief */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color={T} /> Generate Content Brief
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Target Keyword</div>
                  <input value={briefKeyword} onChange={e => setBriefKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateBrief()}
                    placeholder="e.g. emergency plumber boca raton" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Page Type</div>
                  <select value={briefPageType} onChange={e => setBriefPageType(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                    <option value="service_page">Service Page</option>
                    <option value="location_page">Location Page</option>
                    <option value="blog_post">Blog Post</option>
                    <option value="landing_page">Landing Page</option>
                  </select>
                </div>
                <button onClick={() => generateBrief()} disabled={generatingBrief || !briefKeyword}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: generatingBrief || !briefKeyword ? '#e5e7eb' : R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: generatingBrief ? 'wait' : 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {generatingBrief ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                  {generatingBrief ? 'Generating...' : 'Generate Brief'}
                </button>
              </div>
              {/* Quick generate from keyword explorer */}
              {dashboard?.top_opportunities?.length > 0 && !briefKeyword && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8 }}>Quick generate from top opportunities:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dashboard.top_opportunities.filter(k => k.category === 'striking_distance' || k.category === 'quick_win' || k.category === 'dark_matter').slice(0, 8).map((kw, i) => (
                      <button key={i} onClick={() => generateBrief(kw.keyword)}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${T}30`, background: '#fff', color: T, transition: 'all .15s' }}>
                        {kw.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active brief viewer */}
            {activeBrief && (
              <div style={card} id="brief-printable">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK }}>{activeBrief.h1}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{activeBrief.target_url} · {activeBrief.target_word_count} words</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Status workflow */}
                    {activeBrief.id && (
                      <select value={activeBrief.status || 'draft'} onChange={async e => {
                        const newStatus = e.target.value
                        await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'update_brief', id: activeBrief.id, status: newStatus }) })
                        setActiveBrief(prev => ({ ...prev, status: newStatus }))
                        loadBriefs()
                        toast.success(`Brief marked as ${newStatus}`)
                      }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11, fontWeight: 700, background: '#fff', cursor: 'pointer' }}>
                        <option value="draft">Draft</option>
                        <option value="approved">Approved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="published">Published</option>
                        <option value="tracking">Tracking</option>
                      </select>
                    )}
                    {/* Copy as text */}
                    <button onClick={() => {
                      const b = activeBrief
                      const text = [
                        `CONTENT BRIEF: ${b.h1}`,
                        `URL: ${b.target_url}`,
                        `Word Count Target: ${b.target_word_count}`,
                        '',
                        `TITLE TAG: ${b.title_tag}`,
                        `META DESCRIPTION: ${b.meta_description}`,
                        '',
                        'OUTLINE:',
                        ...(b.outline || []).flatMap(s => [
                          `  H2: ${s.h2} (~${s.word_count_target} words)`,
                          ...(s.h3s || []).map(h => `    H3: ${h}`),
                          ...(s.key_points || []).map(p => `    • ${p}`),
                          '',
                        ]),
                        'SCHEMA: ' + (b.schema_types || []).join(', '),
                        '',
                        'FAQ QUESTIONS:',
                        ...(b.faq_questions || []).map(f => `  Q: ${f.question}\n  A: ${f.answer_guidance}`),
                        '',
                        'TARGET ENTITIES: ' + (b.target_entities || []).join(', '),
                        '',
                        b.aeo_optimization ? `AEO: Target ${b.aeo_optimization.target_snippet_type} snippet. AI Overview: ${b.aeo_optimization.ai_overview_eligible ? 'Yes' : 'No'}` : '',
                        b.content_guidelines ? `TONE: ${b.content_guidelines.tone}` : '',
                        b.ranking_timeline ? `TIMELINE: ${b.ranking_timeline}` : '',
                      ].filter(Boolean).join('\n')
                      navigator.clipboard.writeText(text)
                      toast.success('Brief copied to clipboard!')
                    }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Download size={12} /> Copy
                    </button>
                    {/* Print/PDF */}
                    <button onClick={() => {
                      const el = document.getElementById('brief-printable')
                      if (!el) return
                      const win = window.open('', '_blank')
                      if (!win) return
                      win.document.write(`<html><head><title>Content Brief: ${activeBrief.h1}</title><style>body{font-family:system-ui;padding:40px;max-width:800px;margin:0 auto;color:#111}h1{font-size:22px}h2{font-size:16px;color:#666;margin-top:24px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ddd;text-align:left;font-size:13px}.tag{display:inline-block;padding:2px 8px;border-radius:4px;background:#f3f4f6;font-size:11px;margin:2px}</style></head><body>${el.innerHTML}</body></html>`)
                      win.document.close()
                      win.print()
                    }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Download size={12} /> Print/PDF
                    </button>
                    <button onClick={() => setActiveBrief(null)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>

                {/* Title + Meta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 16, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Title Tag</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{activeBrief.title_tag}</div>
                    <div style={{ fontSize: 10, color: activeBrief.title_tag?.length <= 60 ? GRN : R, marginTop: 4 }}>{activeBrief.title_tag?.length || 0}/60 chars</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Meta Description</div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{activeBrief.meta_description}</div>
                    <div style={{ fontSize: 10, color: activeBrief.meta_description?.length <= 155 ? GRN : R, marginTop: 4 }}>{activeBrief.meta_description?.length || 0}/155 chars</div>
                  </div>
                </div>

                {/* Schema types */}
                {activeBrief.schema_types?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Required Schema Markup</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {activeBrief.schema_types.map((s, i) => (
                        <span key={i} style={{ padding: '4px 12px', borderRadius: 6, background: T + '12', color: T, fontSize: 12, fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Outline */}
                {activeBrief.outline?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Content Outline</div>
                    {activeBrief.outline.map((section, i) => (
                      <div key={i} style={{ padding: '14px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: 8, borderLeft: `3px solid ${T}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>H2: {section.h2}</div>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>~{section.word_count_target} words</span>
                        </div>
                        {section.h3s?.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 16 }}>
                            {section.h3s.map((h3, j) => <div key={j} style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>↳ H3: {h3}</div>)}
                          </div>
                        )}
                        {section.key_points?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {section.key_points.map((pt, j) => <div key={j} style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>• {pt}</div>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* FAQ Section */}
                {activeBrief.faq_questions?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>FAQ Questions (FAQPage Schema)</div>
                    {activeBrief.faq_questions.map((faq, i) => (
                      <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>Q: {faq.question}</div>
                        <div style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>A: {faq.answer_guidance}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Target entities */}
                {activeBrief.target_entities?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Target Entities (NLP Coverage)</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {activeBrief.target_entities.map((e, i) => (
                        <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: '#f3f4f6', fontSize: 11, fontWeight: 600, color: '#374151' }}>{e}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AEO + Guidelines */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {activeBrief.aeo_optimization && (
                    <div style={{ padding: 16, borderRadius: 10, background: R + '06', border: `1px solid ${R}20` }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>AEO / Featured Snippet</div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                        <div><strong>Target:</strong> {activeBrief.aeo_optimization.target_snippet_type} snippet</div>
                        <div><strong>AI Overview eligible:</strong> {activeBrief.aeo_optimization.ai_overview_eligible ? 'Yes' : 'No'}</div>
                        {activeBrief.aeo_optimization.optimization_notes && <div style={{ marginTop: 6 }}>{activeBrief.aeo_optimization.optimization_notes}</div>}
                      </div>
                    </div>
                  )}
                  {activeBrief.content_guidelines && (
                    <div style={{ padding: 16, borderRadius: 10, background: GRN + '06', border: `1px solid ${GRN}20` }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: GRN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Content Guidelines</div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                        <div><strong>Tone:</strong> {activeBrief.content_guidelines.tone}</div>
                        <div><strong>CTA:</strong> {activeBrief.content_guidelines.cta_placement}</div>
                        <div><strong>Angle:</strong> {activeBrief.content_guidelines.differentiator_angle}</div>
                        {activeBrief.ranking_timeline && <div style={{ marginTop: 6 }}><strong>Ranking timeline:</strong> {activeBrief.ranking_timeline}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Saved briefs list */}
            {briefs.length > 0 && (
              <div style={card}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Saved Briefs</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {briefs.map((b, i) => (
                    <div key={i} onClick={() => { setActiveBrief(b); }} style={{ padding: '14px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{b.target_keyword}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{b.target_url} · {b.page_type?.replace(/_/g, ' ')} · {b.target_word_count} words</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: { draft: '#f3f4f6', approved: T + '15', in_progress: AMB + '15', published: GRN + '15', tracking: GRN + '15' }[b.status] || '#f3f4f6', color: { draft: '#6b7280', approved: T, in_progress: AMB, published: GRN, tracking: GRN }[b.status] || '#6b7280' }}>{b.status}</span>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(b.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {briefs.length === 0 && !activeBrief && !briefLoading && (
              <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>No briefs yet — enter a keyword above to generate your first content brief.</div>
              </div>
            )}
          </>
        )}

        {/* ══ RANK TRACKER TAB ══ */}
        {clientId && tab === 'ranks' && (
          <>
            {rankLoading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

            {!rankLoading && !rankData?.total_tracked && (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <TrendingUp size={48} color={T} style={{ margin: '0 auto 16px', opacity: .3 }} />
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No ranking data yet</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Run a sync to pull Search Console rankings. Position history builds over time with each sync.</div>
              </div>
            )}

            {!rankLoading && rankData?.total_tracked > 0 && (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
                  <StatCard label="Tracked Keywords" value={rankData.total_tracked} icon={Search} color={T} />
                  <StatCard label="Top 3" value={rankData.top3} icon={Star} color={GRN} />
                  <StatCard label="Top 10" value={rankData.top10} icon={Eye} color={T} />
                  <StatCard label="Improved" value={rankData.improved?.length || 0} icon={ArrowUpRight} color={GRN} />
                  <StatCard label="Declined" value={rankData.declined?.length || 0} icon={ArrowDownRight} color={R} />
                </div>

                {/* Position distribution bar */}
                <div style={card}>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Position Distribution</div>
                  {(() => {
                    const all = rankData.all || []
                    const buckets = [
                      { label: '#1-3', count: all.filter(k => k.current_position <= 3).length, color: GRN },
                      { label: '#4-10', count: all.filter(k => k.current_position > 3 && k.current_position <= 10).length, color: T },
                      { label: '#11-20', count: all.filter(k => k.current_position > 10 && k.current_position <= 20).length, color: AMB },
                      { label: '#21-50', count: all.filter(k => k.current_position > 20 && k.current_position <= 50).length, color: R },
                      { label: '#50+', count: all.filter(k => k.current_position > 50).length, color: '#9ca3af' },
                    ]
                    const total = all.length || 1
                    return (
                      <>
                        <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                          {buckets.filter(b => b.count > 0).map((b, i) => (
                            <div key={i} style={{ width: `${(b.count / total) * 100}%`, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', minWidth: b.count > 0 ? 30 : 0 }}>
                              {b.count}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {buckets.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280' }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
                              {b.label}: {b.count} ({Math.round((b.count / total) * 100)}%)
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Filter pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {[['all', 'All', '#6b7280'], ['improved', 'Improved ↑', GRN], ['declined', 'Declined ↓', R], ['top3', 'Top 3', GRN], ['top10', 'Top 10', T]].map(([key, label, color]) => (
                    <button key={key} onClick={() => setRankFilter(key)}
                      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${rankFilter === key ? color : '#e5e7eb'}`, background: rankFilter === key ? color + '12' : '#fff', color: rankFilter === key ? color : '#6b7280' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Movers table */}
                {(() => {
                  let filtered = rankData.all || []
                  if (rankFilter === 'improved') filtered = rankData.improved || []
                  else if (rankFilter === 'declined') filtered = rankData.declined || []
                  else if (rankFilter === 'top3') filtered = filtered.filter(k => k.current_position <= 3)
                  else if (rankFilter === 'top10') filtered = filtered.filter(k => k.current_position <= 10)

                  return (
                    <div style={card}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            {['Keyword', 'Position', 'Change', 'Previous', 'Clicks', 'Impressions', 'Opp Score', 'Category'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Keyword' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((kw, i) => {
                            const cfg = CAT_CONFIG[kw.category] || { color: '#6b7280', icon: '•' }
                            const changeColor = kw.change > 0 ? GRN : kw.change < 0 ? R : '#9ca3af'
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: BLK, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</td>
                                <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 16, fontWeight: 900, color: kw.current_position <= 3 ? GRN : kw.current_position <= 10 ? T : kw.current_position <= 20 ? AMB : R }}>
                                  #{Math.round(kw.current_position * 10) / 10}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {kw.change != null ? (
                                    <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: changeColor, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      {kw.change > 0 ? <ArrowUpRight size={14} /> : kw.change < 0 ? <ArrowDownRight size={14} /> : null}
                                      {kw.change > 0 ? '+' : ''}{kw.change}
                                    </span>
                                  ) : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', fontFamily: FH }}>
                                  {kw.previous_position ? `#${Math.round(kw.previous_position * 10) / 10}` : '—'}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.clicks || 0}</td>
                                <td style={{ textAlign: 'center', fontSize: 12, fontFamily: FH }}>{kw.impressions?.toLocaleString() || 0}</td>
                                <td style={{ textAlign: 'center' }}><ScoreBadge score={kw.opportunity_score} label="" /></td>
                                <td style={{ textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 12, background: cfg.color + '12', color: cfg.color }}>{cfg.icon}</span></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>No keywords match this filter</div>}
                    </div>
                  )
                })()}

                {/* Biggest movers highlight */}
                {(rankData.improved?.length > 0 || rankData.declined?.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {rankData.improved?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: GRN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ArrowUpRight size={16} /> Biggest Improvers (7d)
                        </div>
                        {rankData.improved.slice(0, 5).map((kw, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: BLK, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>#{Math.round(kw.previous_position)}</span>
                              <span style={{ color: GRN }}>→</span>
                              <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: GRN }}>#{Math.round(kw.current_position)}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: GRN, background: GRN + '12', padding: '2px 6px', borderRadius: 4 }}>+{kw.change}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {rankData.declined?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: R, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ArrowDownRight size={16} /> Biggest Declines (7d)
                        </div>
                        {rankData.declined.slice(0, 5).map((kw, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: BLK, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>#{Math.round(kw.previous_position)}</span>
                              <span style={{ color: R }}>→</span>
                              <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: R }}>#{Math.round(kw.current_position)}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: R, background: R + '12', padding: '2px 6px', borderRadius: 4 }}>{kw.change}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ COMPETITORS TAB ══ */}
        {clientId && tab === 'competitors' && (
          <>
            {/* Keyword input */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} color={R} /> Competitor Page Analysis
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Enter a keyword to reverse-engineer the top-ranking pages — word count, headings, schema, FAQ, keyword placement, and Moz authority.</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input value={compKeyword} onChange={e => setCompKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && compKeyword) { setCompLoading(true); fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_competitors', client_id: clientId, keyword: compKeyword }) }).then(r => r.json()).then(res => { setCompAnalysis(res); setCompLoading(false) }).catch(() => setCompLoading(false)) } }}
                  placeholder="e.g. emergency plumber boca raton" style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                <button onClick={() => { if (!compKeyword) return; setCompLoading(true); fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze_competitors', client_id: clientId, keyword: compKeyword }) }).then(r => r.json()).then(res => { setCompAnalysis(res); setCompLoading(false) }).catch(() => setCompLoading(false)) }}
                  disabled={compLoading || !compKeyword}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: compLoading || !compKeyword ? '#e5e7eb' : R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: compLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {compLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                  {compLoading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
              {/* Quick picks from striking distance */}
              {dashboard?.top_opportunities?.filter(k => k.category === 'striking_distance').length > 0 && !compKeyword && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6 }}>Striking distance keywords:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dashboard.top_opportunities.filter(k => k.category === 'striking_distance').slice(0, 6).map((kw, i) => (
                      <button key={i} onClick={() => setCompKeyword(kw.keyword)} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, border: `1px solid ${AMB}30`, background: '#fff', color: AMB, cursor: 'pointer' }}>#{Math.round(kw.sc_position)} {kw.keyword}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {compLoading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /><div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Fetching and analyzing competitor pages...</div></div>}

            {/* Results */}
            {compAnalysis && !compLoading && (
              <>
                {/* Page comparison table */}
                {compAnalysis.analyses?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Page-by-Page Comparison: "{compAnalysis.keyword}"</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            {['Page', 'Words', 'H2s', 'H3s', 'Schema', 'FAQ', 'Images', 'Int. Links', 'DA', 'PA', 'KW in Title', 'KW in H1'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {compAnalysis.analyses.map((a, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: a.is_client ? T + '06' : 'transparent' }}>
                              <td style={{ padding: '10px', fontSize: 12, fontWeight: a.is_client ? 800 : 600, color: BLK, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.is_client && <span style={{ color: T, marginRight: 4 }}>★</span>}{a.name}
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>{a.word_count?.toLocaleString()}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{a.h2_count}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{a.h3_count}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                                  {(a.schemas || []).slice(0, 3).map((s, j) => <span key={j} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: T + '12', color: T, fontWeight: 700 }}>{s}</span>)}
                                  {(!a.schemas || a.schemas.length === 0) && <span style={{ fontSize: 10, color: R }}>None</span>}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: a.has_faq ? GRN : R }}>{a.has_faq ? `✓ ${a.faq_count}` : '✕'}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{a.image_count} <span style={{ fontSize: 9, color: '#9ca3af' }}>({a.images_with_alt} alt)</span></td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{a.internal_links}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 16, fontWeight: 900, color: (a.da || 0) >= 40 ? GRN : (a.da || 0) >= 20 ? AMB : R }}>{a.da || '—'}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{a.pa || '—'}</td>
                              <td style={{ textAlign: 'center', color: a.keyword_in_title ? GRN : R, fontSize: 14 }}>{a.keyword_in_title ? '✓' : '✕'}</td>
                              <td style={{ textAlign: 'center', color: a.keyword_in_h1 ? GRN : R, fontSize: 14 }}>{a.keyword_in_h1 ? '✓' : '✕'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* H2 comparison */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>H2 Heading Comparison</div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compAnalysis.analyses.length}, 1fr)`, gap: 12 }}>
                        {compAnalysis.analyses.map((a, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: a.is_client ? T : '#6b7280', marginBottom: 6 }}>{a.is_client ? '★ ' : ''}{a.name}</div>
                            {(a.h2s || []).map((h, j) => <div key={j} style={{ fontSize: 11, color: '#374151', marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${a.is_client ? T : '#e5e7eb'}` }}>{h}</div>)}
                            {(!a.h2s || a.h2s.length === 0) && <div style={{ fontSize: 11, color: '#d1d5db' }}>No H2s found</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Gap Analysis */}
                {compAnalysis.gap_analysis && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Brain size={18} color={T} /> AI Competitive Gap Analysis
                    </div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 20, padding: '14px 18px', background: T + '06', borderRadius: 10, border: `1px solid ${T}20` }}>
                      {compAnalysis.gap_analysis.summary}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      {compAnalysis.gap_analysis.client_strengths?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: GRN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Your Strengths</div>
                          {compAnalysis.gap_analysis.client_strengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>✓ {s}</div>)}
                        </div>
                      )}
                      {compAnalysis.gap_analysis.client_weaknesses?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Gaps to Close</div>
                          {compAnalysis.gap_analysis.client_weaknesses.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>✕ {w}</div>)}
                        </div>
                      )}
                    </div>

                    {/* Priority actions */}
                    {compAnalysis.gap_analysis.priority_actions?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Priority Actions</div>
                        {compAnalysis.gap_analysis.priority_actions.map((a, i) => {
                          const impColor = { high: R, medium: AMB, low: GRN }[a.impact] || '#6b7280'
                          return (
                            <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `3px solid ${impColor}`, marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: impColor + '15', color: impColor, textTransform: 'uppercase' }}>{a.impact}</span>
                                <span style={{ fontSize: 9, color: '#9ca3af' }}>{a.effort}</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{a.action}</div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.detail}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Content targets */}
                    {compAnalysis.gap_analysis.content_targets && (
                      <div style={{ padding: '16px 20px', borderRadius: 10, background: R + '06', border: `1px solid ${R}15` }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Content Targets to Win</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          {[
                            ['Word Count', `${compAnalysis.gap_analysis.content_targets.target_word_count?.toLocaleString()}+`],
                            ['H2 Sections', compAnalysis.gap_analysis.content_targets.required_h2_sections?.length || 0],
                            ['FAQ Questions', compAnalysis.gap_analysis.content_targets.faq_count_target || 0],
                            ['Images', compAnalysis.gap_analysis.content_targets.image_count_target || 0],
                          ].map(([l, v]) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: R }}>{v}</div>
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        {compAnalysis.gap_analysis.content_targets.required_schema?.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {compAnalysis.gap_analysis.content_targets.required_schema.map((s, i) => (
                              <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: T + '12', color: T, fontWeight: 700 }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Winning formula */}
                    {compAnalysis.gap_analysis.winning_formula && (
                      <div style={{ marginTop: 16, padding: '14px 18px', background: '#f0fdf4', borderRadius: 10, border: `1px solid #bbf7d0`, fontSize: 14, fontWeight: 600, color: '#166534', lineHeight: 1.6 }}>
                        <strong>Winning Formula:</strong> {compAnalysis.gap_analysis.winning_formula}
                      </div>
                    )}

                    {/* Generate brief button */}
                    <button onClick={() => { setBriefKeyword(compAnalysis.keyword); setTab('briefs') }}
                      style={{ marginTop: 16, padding: '12px 24px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={14} /> Generate Content Brief for "{compAnalysis.keyword}"
                    </button>
                  </div>
                )}
              </>
            )}

            {!compAnalysis && !compLoading && (
              <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>Enter a keyword above to analyze how competitors' pages are built and find your gaps.</div>
              </div>
            )}
          </>
        )}

        {/* ══ GMB TAB ══ */}
        {clientId && tab === 'gmb' && (
          <>
            {gmbLoading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

            {!gmbLoading && !gmb?.gbp && (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <Star size={48} color={AMB} style={{ margin: '0 auto 16px', opacity: .3 }} />
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No GBP data found</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Run a KotoIntel scan first, or check that the client has a Google Business Profile listing.</div>
              </div>
            )}

            {!gmbLoading && gmb?.gbp && (() => {
              const g = gmb.gbp
              const audit = g.audit || {}
              const scoreColor = audit.score >= 80 ? GRN : audit.score >= 60 ? AMB : R
              return (
                <>
                  {/* GBP Health Score */}
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: scoreColor + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 36, fontWeight: 900, color: scoreColor }}>{audit.score}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK }}>{g.name}</div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{g.address}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{g.phone} · {g.primary_category?.replace(/_/g, ' ')}</div>
                      </div>
                      {g.maps_url && <a href={g.maps_url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: 8, background: T, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>View on Maps</a>}
                    </div>

                    {/* Key metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                      {[
                        ['Rating', g.rating ? `${g.rating}★` : '—', g.rating >= 4.5 ? GRN : g.rating >= 4.0 ? AMB : R],
                        ['Reviews', g.review_count || 0, g.review_count >= 50 ? GRN : g.review_count >= 10 ? AMB : R],
                        ['Photos', g.photo_count || 0, g.photo_count >= 10 ? GRN : g.photo_count >= 5 ? AMB : R],
                        ['Status', g.business_status === 'OPERATIONAL' ? 'Active' : 'Inactive', g.business_status === 'OPERATIONAL' ? GRN : R],
                        ['GBP Score', `${audit.score}/100`, scoreColor],
                      ].map(([label, val, color]) => (
                        <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Audit passes + fails */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: GRN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Passing ({audit.passes?.length || 0})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(audit.passes || []).map((p, i) => (
                            <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: GRN + '10', color: GRN, fontSize: 11, fontWeight: 600 }}>✓ {p}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Failing ({audit.fails?.length || 0})</div>
                        {(audit.fails || []).map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: R, marginBottom: 4 }}>✕ <strong>{f.label}</strong> — {f.fix}</div>
                        ))}
                      </div>
                    </div>

                    {/* Moz DA */}
                    {gmb.moz && (
                      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: gmb.moz.domain_authority >= 40 ? GRN : gmb.moz.domain_authority >= 20 ? AMB : R }}>{gmb.moz.domain_authority}</div>
                          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' }}>Domain Authority</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#0c4a6e' }}>Spam Score: {gmb.moz.spam_score}% · {gmb.moz.linking_root_domains?.toLocaleString()} linking domains · {gmb.moz.external_backlinks?.toLocaleString()} backlinks</div>
                      </div>
                    )}
                  </div>

                  {/* Reviews + AI Response Drafts */}
                  {g.recent_reviews?.length > 0 && (
                    <div style={card}>
                      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Star size={18} color={AMB} /> Recent Reviews ({g.recent_reviews.length})
                      </div>
                      {g.recent_reviews.map((rev, i) => {
                        const isActive = draftingReview === rev
                        return (
                          <div key={i} style={{ padding: '14px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: 8, borderLeft: `3px solid ${rev.rating >= 4 ? GRN : rev.rating >= 3 ? AMB : R}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{rev.author}</span>
                                <span style={{ fontSize: 12, color: rev.rating >= 4 ? GRN : rev.rating >= 3 ? AMB : R, marginLeft: 8 }}>{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                              </div>
                              <button onClick={() => draftReviewResponse(rev)}
                                style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${T}30`, background: '#fff', color: T, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                <Brain size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Draft Response
                              </button>
                            </div>
                            {rev.text && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{rev.text}</div>}
                            {rev.time && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{new Date(rev.time).toLocaleDateString()}</div>}

                            {/* AI Draft Response */}
                            {isActive && reviewDraft && (
                              <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, background: T + '06', border: `1px solid ${T}20` }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>AI-Drafted Response</div>
                                <textarea value={reviewDraft} onChange={e => setReviewDraft(e.target.value)}
                                  style={{ width: '100%', minHeight: 100, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                  <button onClick={() => { navigator.clipboard.writeText(reviewDraft); toast.success('Copied!') }}
                                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Copy to Clipboard</button>
                                  <button onClick={() => { setDraftingReview(null); setReviewDraft('') }}
                                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Dismiss</button>
                                </div>
                              </div>
                            )}
                            {isActive && !reviewDraft && (
                              <div style={{ marginTop: 8, fontSize: 12, color: T, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Drafting response...
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* GBP Post Generator */}
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={18} color={R} /> GBP Post Generator
                      </div>
                      <button onClick={generatePosts} disabled={generatingPosts}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: generatingPosts ? '#e5e7eb' : R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: generatingPosts ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {generatingPosts ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                        {generatingPosts ? 'Generating...' : 'Generate 4 Posts'}
                      </button>
                    </div>
                    {gmbPosts.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {gmbPosts.map((post, i) => {
                          const typeColors = { offer: R, tips: T, team: GRN, seasonal: AMB }
                          const color = typeColors[post.type] || '#6b7280'
                          return (
                            <div key={i} style={{ padding: '16px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderTop: `3px solid ${color}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: color + '15', color, textTransform: 'uppercase' }}>{post.type}</span>
                                <span style={{ fontSize: 10, color: '#9ca3af' }}>{post.text?.length || 0} chars</span>
                              </div>
                              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 10 }}>{post.text}</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color }}>{post.cta}</span>
                                <button onClick={() => { navigator.clipboard.writeText(post.text); toast.success('Post copied!') }}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, cursor: 'pointer' }}>Copy</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {gmbPosts.length === 0 && !generatingPosts && (
                      <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                        Click "Generate 4 Posts" to create a week's worth of GBP content — offer, tips, team, and seasonal posts.
                      </div>
                    )}
                  </div>

                  {/* Review Velocity Chart */}
                  {g.review_count > 0 && (
                    <div style={card}>
                      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={18} color={GRN} /> Review Velocity & Growth Projection
                      </div>
                      {(() => {
                        const current = g.review_count
                        const target = Math.max(200, current + 100)
                        const monthlyVelocity = 8 // target pace
                        const currentPace = Math.max(2, Math.round(current / 24)) // estimate from total / assumed months
                        const monthsToTarget = Math.ceil((target - current) / monthlyVelocity)
                        const monthsAtCurrent = currentPace > 0 ? Math.ceil((target - current) / currentPace) : 999

                        // Visual bar showing progress to target
                        const pct = Math.min((current / target) * 100, 100)
                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                              {[
                                ['Current Reviews', current, T],
                                ['Target', target, GRN],
                                ['Est. Monthly Pace', `~${currentPace}/mo`, currentPace >= 8 ? GRN : currentPace >= 4 ? AMB : R],
                                ['Months to Target', monthsAtCurrent > 100 ? '∞' : monthsAtCurrent, monthsAtCurrent <= 12 ? GRN : AMB],
                              ].map(([label, val, color]) => (
                                <div key={label} style={{ padding: '14px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                                  <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Progress bar */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                                <span>{current} reviews</span>
                                <span>Target: {target}</span>
                              </div>
                              <div style={{ height: 24, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T}, ${GRN})`, borderRadius: 8, transition: 'width .6s' }} />
                                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 11, fontWeight: 800, color: pct > 50 ? '#fff' : BLK }}>{Math.round(pct)}%</div>
                              </div>
                            </div>

                            {/* Pace comparison */}
                            <div style={{ padding: '14px 18px', borderRadius: 10, background: currentPace < 4 ? R + '06' : GRN + '06', border: `1px solid ${currentPace < 4 ? R + '20' : GRN + '20'}` }}>
                              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                                {currentPace < 4
                                  ? `At ~${currentPace} reviews/month, reaching ${target} reviews will take ${monthsAtCurrent > 100 ? 'forever' : `${monthsAtCurrent} months`}. Industry leaders earn 8-12/month. Implement SMS follow-up within 2 hours of service — conversion rate: 35-45%.`
                                  : currentPace < 8
                                  ? `Good pace at ~${currentPace}/month, but top performers earn 8-12. At target pace of ${monthlyVelocity}/month, you'd reach ${target} in ${monthsToTarget} months.`
                                  : `Excellent review velocity at ~${currentPace}/month! You'll reach ${target} reviews in ~${monthsToTarget} months. Keep this pace — each review compounds your ranking signal.`
                                }
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>Source: BrightLocal 2026 — review signals now account for 20% of local pack ranking weight</div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* Post Calendar (4-week view) */}
                  {gmbPosts.length > 0 && (
                    <div style={card}>
                      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} color={T} /> 4-Week Post Calendar
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[0, 1, 2, 3].map(week => {
                          const post = gmbPosts[week % gmbPosts.length]
                          const weekDate = new Date(Date.now() + week * 7 * 86400000)
                          const typeColors = { offer: R, tips: T, team: GRN, seasonal: AMB }
                          const color = typeColors[post?.type] || '#6b7280'
                          return (
                            <div key={week} style={{ padding: '16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderTop: `3px solid ${color}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase' }}>Week {week + 1}</span>
                                <span style={{ fontSize: 10, color: '#9ca3af' }}>{weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: color + '15', color }}>{post?.type}</span>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginTop: 8, maxHeight: 60, overflow: 'hidden' }}>{post?.text?.slice(0, 120)}...</div>
                              <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color }}>{post?.cta}</div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                        Source: News.opositive.io 2026 — "Post at least once a week. Build GBP posting into a recurring content task."
                      </div>
                    </div>
                  )}

                  {/* Grid Rank Map (placeholder — needs DataForSEO) */}
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color={R} /> Local Pack Grid Tracker
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                      See your Google Maps 3-Pack position from 25 geographic points around your business. Green = you're in the pack. Red = competitors dominate.
                    </div>

                    {/* Simulated 5x5 grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, maxWidth: 400, margin: '0 auto 20px' }}>
                      {Array.from({ length: 25 }).map((_, i) => {
                        const row = Math.floor(i / 5)
                        const col = i % 5
                        const isCenter = row === 2 && col === 2
                        const dist = Math.sqrt(Math.pow(row - 2, 2) + Math.pow(col - 2, 2))
                        // Simulate: green near center, yellow mid, red far
                        const color = isCenter ? BLK : dist <= 1.5 ? GRN : dist <= 2.5 ? AMB : R
                        const rank = isCenter ? '📍' : dist <= 1.5 ? '#1' : dist <= 2.5 ? '#3' : '#7'
                        return (
                          <div key={i} style={{
                            aspectRatio: '1', borderRadius: 8,
                            background: isCenter ? BLK : color + '15',
                            border: `2px solid ${color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isCenter ? 16 : 13, fontWeight: 800,
                            color: isCenter ? '#fff' : color, fontFamily: FH,
                          }}>
                            {rank}
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                      {[['#1-3 (In Pack)', GRN], ['#4-10 (Visible)', AMB], ['#11+ (Invisible)', R], ['📍 Your Business', BLK]].map(([label, color]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: '14px 18px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                      <strong>This is a preview.</strong> Live grid tracking requires DataForSEO API (~$5/month for 10 keywords × 25 grid points). Once connected, this map shows real-time local pack positions from every direction around your business — updated weekly.
                    </div>
                  </div>
                </>
              )
            })()}
          </>
        )}

      </div>

      {/* Client Add/Edit Modal */}
      {showClientModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowClientModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: '32px', width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK, marginBottom: 4 }}>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              {editingClient ? 'Update client details below.' : 'Add a client to start tracking their SEO performance.'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 6, display: 'block' }}>Business Name *</label>
                <input value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sunrise Plumbing" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 6, display: 'block' }}>Website URL</label>
                <input value={clientForm.website} onChange={e => setClientForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="e.g. https://sunriseplumbing.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: BLK, marginBottom: 6, display: 'block' }}>Industry / Primary Service</label>
                <input value={clientForm.primary_service} onChange={e => setClientForm(f => ({ ...f, primary_service: e.target.value }))}
                  placeholder="e.g. Plumbing, HVAC, Dental, Law" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowClientModal(false); setEditingClient(null) }}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveClient} disabled={savingClient || !clientForm.name}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: savingClient || !clientForm.name ? '#e5e7eb' : T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: savingClient ? 'wait' : 'pointer' }}>
                {savingClient ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
